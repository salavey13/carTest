// /app/api/cron/cleanup-wallpix-staging/route.ts
//
// GET /api/cron/cleanup-wallpix-staging — глобальная зачистка staging-папок
// публичного бакета wallpix (OnlyBike wall). Вызывается Vercel Cron
// (vercel.json → «30 3 * * *») или вручную:
//   curl -X GET "https://<deploy>/api/cron/cleanup-wallpix-staging?token=<secret>"
//
// Guard: либо заголовок x-vercel-cron (ставит сам Vercel Scheduler), либо
// query-параметр token, совпадающий с CRON_SECRET / CLEANUP_WALLPIX_TOKEN.
//
// Удаляет объекты staging/<userId>/<file> старше WALL_STAGING_TTL_HOURS (48h):
// это черновики «прикрепил фото, но пост не создал». Опубликованные фото живут
// в posts/<postId>/ и не трогаются. Логика зеркалит оппортунистическую чистку
// в /api/franchize/wall-photo-upload (TTL 24h, только своя папка).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { WALLPHOTO_BUCKET } from "@/app/franchize/lib/community-wall";

export const dynamic = "force-dynamic"; // no static generation during build

const TTL_HOURS = 48;
const PAGE_SIZE = 1000;
const REMOVE_BATCH = 100;

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const token = req.nextUrl.searchParams.get("token");
  const secret = process.env.CLEANUP_WALLPIX_TOKEN || process.env.CRON_SECRET;
  return !!secret && !!token && token === secret;
}

async function listPage(prefix: string, offset: number): Promise<{ name: string; id: string | null; created_at?: string; updated_at?: string }[]> {
  const { data, error } = await supabaseAdmin.storage
    .from(WALLPHOTO_BUCKET)
    .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: "created_at", order: "asc" } });
  if (error) throw new Error(`list ${prefix} failed: ${error.message}`);
  return (data ?? []) as { name: string; id: string | null; created_at?: string; updated_at?: string }[];
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = Date.now() - TTL_HOURS * 60 * 60 * 1000;
    const stalePaths: string[] = [];
    let scanned = 0;

    // Page through user folders (id === null marks a folder in Storage list).
    let folderOffset = 0;
    for (;;) {
      const folders = await listPage("staging", folderOffset);
      for (const folder of folders) {
        if (!folder.name || folder.name === ".emptyFolderPlaceholder" || folder.id !== null) continue;
        const userPrefix = `staging/${folder.name}`;
        let fileOffset = 0;
        for (;;) {
          const files = await listPage(userPrefix, fileOffset);
          for (const file of files) {
            if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
            scanned += 1;
            const ts = Date.parse(file.created_at || file.updated_at || "");
            if (Number.isFinite(ts) && ts < cutoff) {
              stalePaths.push(`${userPrefix}/${file.name}`);
            }
          }
          if (files.length < PAGE_SIZE) break;
          fileOffset += PAGE_SIZE;
        }
      }
      if (folders.length < PAGE_SIZE) break;
      folderOffset += PAGE_SIZE;
    }

    let removed = 0;
    for (let i = 0; i < stalePaths.length; i += REMOVE_BATCH) {
      const batch = stalePaths.slice(i, i + REMOVE_BATCH);
      const { error } = await supabaseAdmin.storage.from(WALLPHOTO_BUCKET).remove(batch);
      if (error) {
        logger.warn("[cleanup-wallpix] batch remove failed:", error.message);
      } else {
        removed += batch.length;
      }
    }

    logger.info(`[cleanup-wallpix] scanned=${scanned} stale=${stalePaths.length} removed=${removed}`);
    return NextResponse.json({ success: true, scanned, stale: stalePaths.length, removed });
  } catch (error) {
    logger.error("[cleanup-wallpix] failed:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
