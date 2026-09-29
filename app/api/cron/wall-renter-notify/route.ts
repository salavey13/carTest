// /app/api/cron/wall-renter-notify/route.ts
//
// GET /api/cron/wall-renter-notify — крон-досылка хвостов рассылки постов
// прошлым арендаторам (crew_posts.metadata.notify_job в статусе queued/
// running). Вызывается Vercel Cron (vercel.json) или вручную:
//   curl -H "Authorization: Bearer <CRON_SECRET>" https://<deploy>/api/cron/wall-renter-notify
//
// Guard (как у cleanup-wallpix-staging): x-vercel-cron / Bearer CRON_SECRET /
// ?token= — timing-safe.
//
// Обычно рассылка завершается kick-запросом клиента сразу после публикации
// (maxDuration=60). Крон — страховка: вкладку закрыли, серверлесс-инвокация
// упала по таймауту и т.п. Один прогон = один пост (бюджет 50с); следующие
// в очереди подхватятся следующим запуском.
//
// Поиск постов-кандидатов: последние 7 дней ленты (bounded fetch 300 постов),
// фильтр по metadata.notify_job в JS — PostgREST JSON-фильтры по вложенным
// полям хрупки между версиями, а недельный срез ленты крошечный.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  RENTER_NOTIFY_JOB_TTL_DAYS,
  RENTER_NOTIFY_TIME_BUDGET_MS,
  parseNotifyJob,
  processWallRenterNotifyJob,
} from "@/app/franchize/lib/wall-renter-notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    for (const secret of [process.env.CRON_SECRET]) {
      if (secret && tokenMatches(bearer, secret)) return true;
    }
  }
  const token = req.nextUrl.searchParams.get("token");
  for (const secret of [process.env.CRON_SECRET]) {
    if (secret && tokenMatches(token, secret)) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const since = new Date(
      Date.now() - RENTER_NOTIFY_JOB_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("crew_posts")
      .select("id, created_at, metadata")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      logger.warn("[wall-renter-notify][cron] candidate fetch failed:", error.message);
      return NextResponse.json({ success: false, error: "db read failed" }, { status: 500 });
    }

    const pendingIds = ((rows ?? []) as { id: string; metadata: unknown }[])
      .map((row) => ({ id: row.id, job: parseNotifyJob(row.metadata) }))
      .filter(({ job }) => job && (job.status === "queued" || job.status === "running"))
      .map(({ id }) => id);

    if (pendingIds.length === 0) {
      return NextResponse.json({ success: true, processed: 0, pending: 0 });
    }

    // Один прогон = один пост (бюджет 50с внутри maxDuration=60).
    const result = await processWallRenterNotifyJob(pendingIds[0], RENTER_NOTIFY_TIME_BUDGET_MS);
    logger.info("[wall-renter-notify][cron] processed", {
      postId: pendingIds[0],
      ok: result.ok,
      sent: result.sent,
      remaining: result.remaining,
      queueLeft: pendingIds.length - 1,
    });
    return NextResponse.json({
      success: true,
      processed: 1,
      pending: pendingIds.length,
      result,
    });
  } catch (error) {
    logger.warn("[wall-renter-notify][cron] crashed", error);
    return NextResponse.json({ success: false, error: "internal error" }, { status: 500 });
  }
}
