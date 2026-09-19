// /app/api/cron/cleanup-wallpix-staging/route.ts
//
// GET /api/cron/cleanup-wallpix-staging — глобальная зачистка staging-папок
// публичного бакета wallpix (OnlyBike wall). Вызывается Vercel Cron
// (vercel.json → «30 3 * * *») или вручную:
//   curl -H "Authorization: Bearer <CRON_SECRET>" https://<deploy>/api/cron/cleanup-wallpix-staging
//
// Guard (любой из вариантов):
//   · заголовок x-vercel-cron — ставит сам Vercel Scheduler (внешне подделать
//     нельзя: платформа его срезает);
//   · Authorization: Bearer <CRON_SECRET | CLEANUP_WALLPIX_TOKEN>;
//   · query-параметр ?token=<CRON_SECRET | CLEANUP_WALLPIX_TOKEN>.
//   Сравнение токенов — timing-safe.
//
// LIVENESS: удаление идёт ПО ФОЛДЕРАМ внутри скана (не «собрал и потом удалил»),
// плюс бюджет времени: при превышении WALL_CLEANUP_TIME_BUDGET_MS проход
// завершается частично — сделанный прогресс ДУРИРУЕТ (удалённое не вернётся),
// а следующий дневной запуск продолжает. maxDuration=60 в vercel.json.
//
// Удаляет объекты staging/<userId>/<file> старше WALL_STAGING_TTL_HOURS (48h):
// это черновики «прикрепил фото, но пост не создал». Опубликованные фото живут
// в posts/<postId>/ и не трогаются.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { WALLPHOTO_BUCKET } from "@/app/franchize/lib/community-wall";

export const dynamic = "force-dynamic"; // no static generation during build

const TTL_HOURS = 48;
const PAGE_SIZE = 1000;
const REMOVE_BATCH = 100;
const TIME_BUDGET_MS = 50_000; // keep clear of the 60s function ceiling

function tokenMatches(candidate: string | null, secret: string): boolean {
  if (!candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice("Bearer ".length).trim();
    for (const secret of [process.env.CRON_SECRET, process.env.CLEANUP_WALLPIX_TOKEN]) {
      if (secret && tokenMatches(bearer, secret)) return true;
    }
  }
  const token = req.nextUrl.searchParams.get("token");
  for (const secret of [process.env.CRON_SECRET, process.env.CLEANUP_WALLPIX_TOKEN]) {
    if (secret && tokenMatches(token, secret)) return true;
  }
  return false;
}

async function listPage(prefix: string, offset: number): Promise<{ name: string; id: string | null; created_at?: string; updated_at?: string }[]> {
  const { data, error } = await supabaseAdmin.storage
    .from(WALLPHOTO_BUCKET)
    .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: "created_at", order: "asc" } });
  if (error) throw new Error(`list ${prefix} failed: ${error.message}`);
  return (data ?? []) as { name: string; id: string | null; created_at?: string; updated_at?: string }[];
}

/** Remove stale files of ONE folder, batched. Durable per folder. */
async function purgeFolder(userPrefix: string, cutoff: number): Promise<number> {
  let removed = 0;
  let offset = 0;
  for (;;) {
    const files = await listPage(userPrefix, offset);
    const stale: string[] = [];
    for (const file of files) {
      if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
      const ts = Date.parse(file.created_at || file.updated_at || "");
      if (Number.isFinite(ts) && ts < cutoff) {
        stale.push(`${userPrefix}/${file.name}`);
      }
    }
    for (let i = 0; i < stale.length; i += REMOVE_BATCH) {
      const { error } = await supabaseAdmin.storage.from(WALLPHOTO_BUCKET).remove(stale.slice(i, i + REMOVE_BATCH));
      if (error) {
        logger.warn("[cleanup-wallpix] batch remove failed:", error.message);
      } else {
        removed += Math.min(stale.length - i, REMOVE_BATCH);
      }
    }
    if (files.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return removed;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const cutoff = Date.now() - TTL_HOURS * 60 * 60 * 1000;
  let scanned = 0;
  let removed = 0;
  let foldersProcessed = 0;
  let timeBudgetExceeded = false;

  try {
    let folderOffset = 0;
    for (;;) {
      const folders = await listPage("staging", folderOffset);
      for (const folder of folders) {
        // id === null marks a folder in the Storage listing.
        if (!folder.name || folder.name === ".emptyFolderPlaceholder" || folder.id !== null) continue;
        // Time budget check BEFORE the next folder: never start work we
        // cannot finish — partial progress is already durable.
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          timeBudgetExceeded = true;
          break;
        }
        const purged = await purgeFolder(`staging/${folder.name}`, cutoff);
        scanned += purged > 0 ? purged : 0; // scanned counted loosely; removals matter
        removed += purged;
        foldersProcessed += 1;
      }
      if (timeBudgetExceeded) break;
      if (folders.length < PAGE_SIZE) break;
      folderOffset += PAGE_SIZE;
    }

    logger.info(`[cleanup-wallpix] folders=${foldersProcessed} removed=${removed} budgetExceeded=${timeBudgetExceeded}`);
    return NextResponse.json({
      success: true,
      foldersProcessed,
      removed,
      timeBudgetExceeded,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("[cleanup-wallpix] failed:", error);
    return NextResponse.json({ error: "Cleanup failed", removed, foldersProcessed }, { status: 500 });
  }
}
