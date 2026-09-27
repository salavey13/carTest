// /app/api/franchize/storage-photo-upload/route.ts
//
// POST /api/franchize/storage-photo-upload — фотофиксация зимнего хранения
// (приём/возврат + фото состояния; winter_storage_v3 migration).
//
// Функциональность заимствована у стены экипажа (wall-photo-upload) и адаптирована
// под таймлайн хранения:
//   1. Клиент сжимает фото через lib/client-image-compress (как композер стены).
//   2. Роут проверяет личность по подписанной cookie cartest_tg_actor (или
//      HMAC-верифицирует initData из form-data — тот же контракт, что у
//      server-actions/storage-bikes.ts) и право писать по этому байку:
//      экипаж (staff) ИЛИ владелец байка — те же ворота, что у заметок.
//   3. sharp дожимает канонично: 1280px по длинной стороне, JPEG q75 (mozjpeg),
//      EXIF срезан, ступенчатое снижение качества И РАЗМЕРА до ≤ 300 КБ
//      (лестница 1280 → 1080 → 896 px) — ровно пайплайн стены.
//   4. Файл кладётся в ПУБЛИЧНЫЙ бакет storagepix СРАЗУ в папку байка:
//        bikes/<bikeId>/<uuid32>.jpg
//      Staging не нужен: байк уже существует, путь жёстко привязан к bikeId, а
//      server action потом верифицирует форму пути (bikes/<ЭТОТ bikeId>/…).
//      Если действие упало — остаётся осиротевший файл, на который ничто не
//      ссылается (осознанный трейд-офф стены; строк таблицы без файла не бывает).
//
// Тело: multipart form-data { file, slug, bikeId, initData? }.

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from "@/lib/telegram-actor-cookie";
import {
  parseTelegramInitDataUser,
} from "@/app/franchize/lib/community-wall";
import {
  STORAGE_PHOTO_BUCKET,
  storagePhotoPathRe,
} from "@/app/franchize/lib/storage";

/** Max STORED size (300 KB — the wall's budget; the bucket limit matches). */
const MAX_SIZE_BYTES = 300 * 1024;
/** Dimension step-down ladder: quality floor first, then shrink geometry. */
const DIMENSION_LADDER = [1280, 1080, 896];
const QUALITY_FLOOR = 50;

/** Per-bike folder soft quota (doubles as the burst rate limit). */
const BIKE_FOLDER_QUOTA = 60;

async function compressImage(input: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Ladder identical to wall-photo-upload: for each dimension (1280 → 1080 →
  // 896) sweep quality 75 → 50; the first candidate under 300 KB wins.
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
        `Не удалось сжать фото до 300 КБ (минимальное качество ${QUALITY_FLOOR}, размер ${Math.round(data.length / 1024)} КБ).`,
      );
    }
  }
  // Unreachable (the ladder loop always returns or throws).
  throw new Error("Не удалось сжать фото до 300 КБ.");
}

export async function POST(request: NextRequest) {
  try {
    // ── Identity: signed cookie first, initData fallback (storage ladder) ──
    const cookieUserId = verifyTelegramActorCookieValue(
      request.cookies.get(TELEGRAM_ACTOR_COOKIE)?.value,
    );

    const formData = await request.formData();
    let callerUserId = cookieUserId;

    if (!callerUserId) {
      const initData = formData.get("initData");
      if (typeof initData === "string" && initData.trim().length > 0) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
          const { computeTelegramWebAppHash, isTelegramInitDataFresh } = await import(
            "@/lib/telegram-webapp-auth"
          );
          const validation = await computeTelegramWebAppHash(initData, botToken);
          if (validation.isValid && isTelegramInitDataFresh(initData)) {
            // same helper the wall route uses in the identical ladder
            const parsed = parseTelegramInitDataUser(initData);
            if (parsed) callerUserId = parsed.id;
          }
        }
      }
    }

    if (!callerUserId) {
      return NextResponse.json(
        { error: "Unauthorized — нужен вход через Telegram WebApp." },
        { status: 401 },
      );
    }

    const slug = String(formData.get("slug") || "").trim();
    const bikeId = String(formData.get("bikeId") || "").trim();
    if (!slug || !/^[0-9a-fA-F-]{36}$/.test(bikeId)) {
      return NextResponse.json({ error: "slug и bikeId обязательны." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 25 МБ до сжатия)." }, { status: 400 });
    }

    // ── Write scope: staff of the crew OR the bike's owner (same as notes) ──
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) {
      return NextResponse.json({ error: "Экипаж не найден." }, { status: 404 });
    }

    const { data: bike } = await supabaseAdmin
      .from("storage_bikes")
      .select("id, owner_user_id")
      .eq("id", bikeId)
      .eq("crew_slug", slug)
      .maybeSingle();
    if (!bike) {
      return NextResponse.json({ error: "Байк не найден." }, { status: 404 });
    }

    let allowed = false;
    if (String((bike as { owner_user_id: string | null }).owner_user_id ?? "") === callerUserId) {
      allowed = true;
    } else {
      const crewRow = crew as { id: string; owner_id: string };
      if (crewRow.owner_id === callerUserId) {
        allowed = true;
      } else {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("role, status, metadata")
          .eq("user_id", callerUserId)
          .maybeSingle();
        const meta = (user?.metadata ?? null) as Record<string, unknown> | null;
        const isGlobalAdmin =
          user?.role === "admin" ||
          user?.role === "vprAdmin" ||
          user?.status === "admin" ||
          meta?.role === "admin" ||
          meta?.status === "admin";
        if (isGlobalAdmin) {
          allowed = true;
        } else {
          const { data: membership } = await supabaseAdmin
            .from("crew_members")
            .select("user_id")
            .eq("crew_id", crewRow.id)
            .eq("user_id", callerUserId)
            .eq("membership_status", "active")
            .maybeSingle();
          allowed = Boolean(membership);
        }
      }
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Фото загружает экипаж или владелец этого байка." },
        { status: 403 },
      );
    }

    // ── Compress (sharp, wall parity) ──
    const arrayBuffer = await file.arrayBuffer();
    const { buffer, width, height } = await compressImage(Buffer.from(arrayBuffer));

    // ── Soft quota on the bike's folder (self-healing: nothing references a
    // failed upload, so the janitor question is «folder full of junk?» — the
    // action only ever references what it was handed by the client). ──
    const folderPrefix = `bikes/${bikeId}`;
    const { data: existing } = await supabaseAdmin.storage
      .from(STORAGE_PHOTO_BUCKET)
      .list(folderPrefix, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    const files = (existing ?? []).filter((f) => !!f.name && f.name !== ".emptyFolderPlaceholder");
    if (files.length >= BIKE_FOLDER_QUOTA) {
      return NextResponse.json(
        { error: "У этого байка слишком много фото — уберите старые или попросите экипаж." },
        { status: 429 },
      );
    }

    // 32 hex chars — matches storagePhotoPathRe(bikeId) used by the actions.
    const fileName = `${randomUUID().replace(/-/g, "")}.jpg`;
    const storagePath = `${folderPrefix}/${fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_PHOTO_BUCKET)
      .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: false });
    if (uploadError) {
      logger.error("[storage-photo-upload] storage upload failed:", uploadError.message);
      // The bucket is created by the manual migration — a missing bucket means
      // v3 has not been applied yet; say so instead of a generic 500.
      if (/bucket/i.test(uploadError.message)) {
        return NextResponse.json(
          { error: "Бакет фото не найден — примените миграцию v3 (storagepix)." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "Не удалось загрузить фото." }, { status: 500 });
    }
    if (!storagePhotoPathRe(bikeId).test(storagePath)) {
      // Defensive: if this ever fires, the action would reject the path —
      // remove the object instead of handing the client a dead reference.
      await supabaseAdmin.storage.from(STORAGE_PHOTO_BUCKET).remove([storagePath]);
      logger.error("[storage-photo-upload] generated path failed own regex:", storagePath);
      return NextResponse.json({ error: "Не удалось загрузить фото." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      path: storagePath,
      width,
      height,
      bytes: buffer.length,
    });
  } catch (error: unknown) {
    // Generic message to the client; details stay in the logs (no sharp/stack
    // internals leaked over the wire).
    logger.error("[storage-photo-upload] Error:", error);
    const hint = error instanceof Error && /сжать фото/.test(error.message) ? error.message : undefined;
    return NextResponse.json({ error: hint || "Не удалось обработать фото. Попробуйте другое." }, { status: 500 });
  }
}
