// /app/api/map-riders/meetup-photo-upload/route.ts
//
// POST /api/map-riders/meetup-photo-upload — фото для meetup-точки на карте.
//
// «please allow to add respective photo (to be used for icon on map)» —
// map-riders feedback, 2026-09-25. Пайплайн «украден» у стены
// (wall-photo-upload) и ужат под маркер/попап:
//   1. Клиент сжимает фото через lib/client-image-compress (как в стене).
//   2. Роут проверяет личность по guardMapRidersWriteRequest (тот же контракт,
//      что у /api/map-riders/meetups) + членство в экипаже + авторство meetup.
//   3. sharp дожимает канонично: 640px по длинной стороне (маркеру и попапу
//      больше не нужно), JPEG q75→50 (mozjpeg), EXIF срезан, бюджет ≤ 150 КБ.
//   4. Файл кладётся в ПУБЛИЧНЫЙ бакет wallpix сразу в финальную папку:
//        meetups/<meetupId>/<uuid32>.jpg
//      Никакого staging-цикла (в отличие от стены) — запись уже привязана к
//      meetup. URL пишется в map_rider_meetups.photo_url (миграция
//      20260925120000_meetup_photo_url) и возвращается клиенту.
//
// Тело: multipart form-data { file, meetupId, crewSlug, userId }.
//
// OPS NOTE (преемственность бакета): wall-стейджинг чистит janitor
// (scripts/cleanup-wallpix-staging.mjs), а prefix meetups/ — нет: замена фото
// оставляет предыдущий объект навсегда. Объёмы малые (rate-limit 10/мин,
// замена фото только автором), но если папка разрастётся — добавить строку
// в janitor-скрипт: удалить meetups/<meetupId>/* не из photo_url текущего ряда.

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { guardMapRidersWriteRequest, applyRateLimitHeaders } from "@/lib/map-riders-security";
import { enforceRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";
import { assertCrewMembership } from "@/app/api/map-riders/_lib/crew-access";
import { wallPhotoPublicUrl, WALLPHOTO_BUCKET } from "@/app/franchize/lib/community-wall";
import { logger } from "@/lib/logger";

/** Max STORED size: map markers/popups render ≤ 96px round; 150 KB is generous. */
const MAX_SIZE_BYTES = 150 * 1024;
/** Dimension step-down ladder (longest side): 640 → 480 → 384. */
const DIMENSION_LADDER = [640, 480, 384];
const QUALITY_FLOOR = 50;

/** Allow-listed content types (same grammar as the wall upload). */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function compressImage(input: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  for (const dimension of DIMENSION_LADDER) {
    let quality = 75;
    const first = await sharp(input)
      .rotate() // auto-orient from EXIF
      .resize(dimension, dimension, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    let { data, info } = first;
    while (data.length > MAX_SIZE_BYTES && quality > QUALITY_FLOOR) {
      quality -= 5;
      const retry = await sharp(input)
        .rotate()
        .resize(dimension, dimension, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      data = retry.data;
    }
    if (data.length <= MAX_SIZE_BYTES) {
      return { buffer: data, width: info.width, height: info.height };
    }
    if (dimension === DIMENSION_LADDER[DIMENSION_LADDER.length - 1]) {
      throw new Error(
        `Не удалось сжать фото до ${MAX_SIZE_BYTES / 1024} КБ (минимальное качество ${QUALITY_FLOOR}, размер ${Math.round(data.length / 1024)} КБ).`,
      );
    }
  }
  // Unreachable (the ladder loop always returns or throws).
  throw new Error("Не удалось сжать фото meetup.");
}

/** Server-only PostgREST error on an unknown column (photo_url) — surfaced
 *  verbatim so the operator understands the migration hasn't been applied. */
function isUnknownColumn(error: { message?: string; code?: string } | null): boolean {
  return Boolean(error && (error.code === "PGRST204" || /column .* does not exist/i.test(error.message || "")));
}

export async function POST(request: NextRequest) {
  const guard = await guardMapRidersWriteRequest(request);
  if (!guard.ok) {
    return guard.response;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Ожидается multipart form-data" }, { status: 400 });
  }

  const userId = String(form.get("userId") || "").trim();
  const meetupId = String(form.get("meetupId") || "").trim();
  const crewSlug = String(form.get("crewSlug") || "vip-bike").trim();
  const file = form.get("file");

  if (!userId || !meetupId || !crewSlug) {
    return NextResponse.json({ success: false, error: "userId, meetupId и crewSlug обязательны" }, { status: 400 });
  }
  if (userId !== guard.subject) {
    return NextResponse.json({ success: false, error: "Unauthorized", reason: "subject_mismatch" }, { status: 403 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: "Файл фото обязателен" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ success: false, error: "Поддерживаются только фото (JPEG/PNG/WebP)" }, { status: 415 });
  }
  // Hard client-side ceiling before sharp (a 50 MB upload would stall the lambda).
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "Фото слишком большое (максимум 25 МБ)" }, { status: 413 });
  }

  const isCrewMember = await assertCrewMembership(userId, crewSlug);
  if (!isCrewMember) {
    return NextResponse.json({ success: false, error: "Вступи в экипаж, чтобы добавлять фото точек", code: "join_required", reason: "membership_required" }, { status: 403 });
  }

  const limit = enforceRateLimit(`map-riders:meetup-photo:${guard.subject}`, 10, 60_000);
  if (!limit.allowed) {
    const response = NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
    applyRateLimitHeaders(response, limit.retryAfterSeconds, limit.remaining, limit.limit);
    return response;
  }

  // The meetup must exist, belong to this crew, and be the caller's own —
  // photos are attached by the creator at creation time.
  const { data: meetup, error: meetupError } = await supabaseAdmin
    .from("map_rider_meetups")
    .select("id, crew_slug, created_by_user_id")
    .eq("id", meetupId)
    .maybeSingle();
  if (meetupError || !meetup) {
    return NextResponse.json({ success: false, error: "Meetup не найден" }, { status: 404 });
  }
  if (meetup.crew_slug !== crewSlug) {
    return NextResponse.json({ success: false, error: "Meetup относится к другому экипажу" }, { status: 403 });
  }
  if (meetup.created_by_user_id !== userId) {
    return NextResponse.json({ success: false, error: "Фото к точке добавляет её автор" }, { status: 403 });
  }

  let compressed: { buffer: Buffer; width: number; height: number };
  try {
    compressed = await compressImage(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Не удалось обработать фото" },
      { status: 400 },
    );
  }

  // Final storage path — no staging lifecycle (the photo belongs to the meetup
  // row from the first second, nothing needs to "promote" it later).
  const storagePath = `meetups/${meetupId}/${randomUUID().replace(/-/g, "")}.jpg`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(WALLPHOTO_BUCKET)
    .upload(storagePath, compressed.buffer, { contentType: "image/jpeg", upsert: false });
  if (uploadError) {
    logger.error("[meetup-photo-upload] storage upload failed", { error: uploadError.message, meetupId });
    return NextResponse.json({ success: false, error: "Не удалось сохранить фото" }, { status: 500 });
  }

  const photoUrl = wallPhotoPublicUrl(storagePath);
  const { error: updateError } = await supabaseAdmin
    .from("map_rider_meetups")
    .update({ photo_url: photoUrl })
    .eq("id", meetupId);
  if (updateError) {
    // Missing column (migration 20260925120000 not applied) → explain, keep
    // the uploaded object (harmless: an unreferenced file in the bucket).
    const hint = isUnknownColumn(updateError)
      ? " (миграция 20260925120000_meetup_photo_url не применена — прогони её в SQL editor)"
      : "";
    logger.error("[meetup-photo-upload] photo_url update failed", { error: updateError.message, meetupId });
    return NextResponse.json(
      { success: false, error: `Не удалось привязать фото к точке${hint}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    photoUrl,
    width: compressed.width,
    height: compressed.height,
    bytes: compressed.buffer.length,
  });
}
