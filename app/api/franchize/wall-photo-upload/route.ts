// /app/api/franchize/wall-photo-upload/route.ts
//
// POST /api/franchize/wall-photo-upload — фото для постов стены экипажа.
//
// Функциональность «украдена» у страницы аренды (rental-photo-upload) и
// адаптирована под стену OnlyBike:
//   1. Клиент сжимает фото через lib/client-image-compress (как в RentalPhotoGallery).
//   2. Роут проверяет личность по подписанной cookie cartest_tg_actor (или
//      HMAC-верифицирует initData из form-data — тот же контракт, что у
//      server-actions/community-wall.ts) и право писать на стену экипажа.
//   3. sharp дожимает канонично: 1280px по длинной стороне, JPEG q75 (mozjpeg),
//      EXIF срезан, ступенчатое снижение качества И РАЗМЕРА до ≤ 300 КБ
//      (wall v4: 500 КБ → 300 КБ — милистоун-бюджет босса; лестница
//      1280 → 1080 → 896 px гарантирует попадание даже для пёстрых фото),
//      ровно тот же пайплайн, что у арендных фото.
//   4. Файл кладётся в ПУБЛИЧНЫЙ бакет wallpix в staging-папку пользователя:
//        staging/<userId>/<uuid32>.jpg
//      createCommunityPostAction потом верифицирует путь (строго своя staging-
//      папка), ПЕРЕНОСИТ объект в posts/<postId>/<n>.jpg и вставляет строку в
//      crew_post_photos.
//
// Жизненный цикл staging (честно):
//   · квота: не больше WALL_STAGING_QUOTA файлов в папке автора (ниже) —
//     при переполнении роут отвечает 429;
//   · оппортунистическая чистка: при каждой загрузке роут удаляет из папки
//     автора объекты старше WALL_STAGING_TTL_HOURS (фото, к которым пост так
//     и не был создан);
//   · janitor: scripts/cleanup-wallpix-staging.mjs — глобальная зачистка
//     staging/* старше TTL (повесить на pg_cron/Vercel cron/внешний таймер).
//
// Тело: multipart form-data { file, slug, initData? }.

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
  WALLPHOTO_BUCKET,
} from "@/app/franchize/lib/community-wall";
import { canWriteOnWall, getCrewBySlug } from "@/app/franchize/lib/wall-access";

/** Max STORED size (300 KB wall v4 — the bucket limit matches this exactly). */
const MAX_SIZE_BYTES = 300 * 1024;
/** Dimension step-down ladder: quality floor first, then shrink geometry. */
const DIMENSION_LADDER = [1280, 1080, 896];
const QUALITY_FLOOR = 50;

/** Max staging files per author (quota; doubles as the burst rate limit). */
export const WALL_STAGING_QUOTA = 60;
/** Staging files older than this are janitored on every upload. */
export const WALL_STAGING_TTL_HOURS = 24;

async function compressImage(input: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Ladder: for each dimension (1280 → 1080 → 896) sweep quality 75 → 50.
  // The first candidate under 300 KB wins; the 896px stop makes the budget
  // reachable even for noisy, high-detail photos where q50 @1280 is ~350 KB.
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
    // 896px @ q50 still over 300 KB is effectively impossible for a photo —
    // but keep the hard guard so the contract holds unconditionally.
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
    // ── Identity: signed cookie first, initData fallback (wall parity) ──
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
          const parsed = validation.isValid && isTelegramInitDataFresh(initData)
            ? parseTelegramInitDataUser(initData)
            : null;
          if (parsed) callerUserId = parsed.id;
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
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 25 МБ до сжатия)." }, { status: 400 });
    }

    // ── Write scope: the wall is for crew staff + riders (same as posting) ──
    const crewRow = await getCrewBySlug(slug);
    if (!crewRow) {
      return NextResponse.json({ error: "Экипаж не найден." }, { status: 404 });
    }

    if (!(await canWriteOnWall(callerUserId, crewRow))) {
      return NextResponse.json(
        { error: "Стена — для своих: арендуй байк в этом экипаже (или вступи в него)." },
        { status: 403 },
      );
    }

    // ── Compress (sharp, rental parity) + upload to staging ──
    const arrayBuffer = await file.arrayBuffer();
    const { buffer, width, height } = await compressImage(Buffer.from(arrayBuffer));

    // ── Quota + opportunistic staging janitor (own folder only) ──
    // The TTL purge runs BEFORE the quota check: a user with a folder full of
    // stale drafts must self-heal on the next upload, never lock out forever.
    const stagingPrefix = `staging/${callerUserId}`;
    const { data: existingStaging } = await supabaseAdmin.storage
      .from(WALLPHOTO_BUCKET)
      .list(stagingPrefix, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    const stagingFiles = (existingStaging ?? []).filter((f) => !!f.name && f.name !== ".emptyFolderPlaceholder");
    const ttlCutoff = Date.now() - WALL_STAGING_TTL_HOURS * 60 * 60 * 1000;
    const stale = stagingFiles.filter((f) => {
      const ts = f.updated_at ? Date.parse(f.updated_at) : Number.NaN;
      return Number.isFinite(ts) && ts < ttlCutoff;
    });
    if (stale.length > 0) {
      // Best-effort: abandoned drafts (photo picked, post never created).
      await supabaseAdmin.storage
        .from(WALLPHOTO_BUCKET)
        .remove(stale.map((f) => `${stagingPrefix}/${f.name}`));
    }
    // Only LIVE (non-stale) files count against the quota.
    if (stagingFiles.length - stale.length >= WALL_STAGING_QUOTA) {
      return NextResponse.json(
        { error: "Слишком много черновых фото — опубликуй пост или попробуй позже." },
        { status: 429 },
      );
    }

    // 32 hex chars — passes the wall's STAGING_FILE_RE (8–64 of [A-Za-z0-9_-]).
    const fileName = `${randomUUID().replace(/-/g, "")}.jpg`;
    const storagePath = `${stagingPrefix}/${fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(WALLPHOTO_BUCKET)
      .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: false });
    if (uploadError) {
      logger.error("[wall-photo-upload] storage upload failed:", uploadError.message);
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
    logger.error("[wall-photo-upload] Error:", error);
    const hint = error instanceof Error && /сжать фото/.test(error.message) ? error.message : undefined;
    return NextResponse.json({ error: hint || "Не удалось обработать фото. Попробуй другое." }, { status: 500 });
  }
}
