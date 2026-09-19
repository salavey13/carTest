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
//      EXIF срезан, прогрессивное снижение качества до ≤ 500 КБ —
//      ровно тот же пайплайн, что у арендных фото.
//   4. Файл кладётся в ПУБЛИЧНЫЙ бакет wallpix в staging-папку пользователя:
//        staging/<userId>/<uuid32>.jpg
//      createCommunityPostAction потом верифицирует путь (строго своя staging-
//      папка), ПЕРЕНОСИТ объект в posts/<postId>/<n>.jpg и вставляет строку в
//      crew_post_photos. Фантомных фото не остаётся: неопубликованные staging-
//      объекты просто затираются следующим upload'ом (и это самая маленькая
//      грязь по сравнению с черновыми строками в БД).
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

const MAX_SIZE_BYTES = 500 * 1024; // 500 KB post-compression (rental parity)
const MAX_DIMENSION = 1280;
const QUALITY_FLOOR = 50;

async function compressImage(input: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  let quality = 75;
  const compressed = await sharp(input)
    .rotate() // auto-orient from EXIF
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  let { data, info } = compressed;
  const width = info.width;
  const height = info.height;
  while (data.length > MAX_SIZE_BYTES && quality > QUALITY_FLOOR) {
    quality -= 5;
    const retry = await sharp(input)
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    data = retry.data;
  }
  if (data.length > MAX_SIZE_BYTES) {
    throw new Error(
      `Не удалось сжать фото до 500 КБ (минимальное качество ${QUALITY_FLOOR}, размер ${Math.round(data.length / 1024)} КБ).`,
    );
  }
  return { buffer: data, width, height };
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

    // 32 hex chars — passes the wall's STAGING_FILE_RE (8–64 of [A-Za-z0-9_-]).
    const fileName = `${randomUUID().replace(/-/g, "")}.jpg`;
    const storagePath = `staging/${callerUserId}/${fileName}`;
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
    const message = error instanceof Error ? error.message : "Failed to upload photo";
    logger.error("[wall-photo-upload] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
