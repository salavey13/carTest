// /app/api/franchize/wall-renter-notify/route.ts
//
// POST /api/franchize/wall-renter-notify — staff kick для рассылки поста
// прошлым арендаторам (crew_posts.metadata.notify_job → wall-renter-notify).
//
// Почему отдельный роут, а не хвост createCommunityPostAction:
//   · рассылка может занять до ~50с (пакеты 20 × 1.1с, ≤ ~800 получателей) —
//     сервер-экшен публикации не должен столько висеть;
//   · maxDuration=60 здесь локально, публикации не нужен;
//   · идемпотентно: повторный kick продолжает с ledger (exactly-once),
//     параллельные прогоны разведены single-flight claim'ом (run_token).
//
// КЛИЕНТ: после публикации поста композер/map-модалка зовут этот роут
// (awaited fetch) и показывают тост с числом доставленных; если вкладку
// закрыли — хвост добивает крон /api/cron/wall-renter-notify.
//
// SELF-HEAL (robustness pack 2026-10-02): если job отсутствует (absent —
// постановка упала на этапе публикации), а staff прислал audience — роут
// ДОставляет job заново и сразу запускает рассылку. Клиент всегда шлёт
// audience (он знает выбранную), так что потерянная постановка больше не
// означает потерянную рассылку.
//
// SECURITY: только crew-staff (owner / глобальный админ / активный член
// экипажа, которому принадлежит пост) — resolveWallActor (cookie или
// HMAC-верифицированный initData) + isCrewStaffUser. Никаких chat_id в
// ответе — только счётчики.

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getCrewBySlug, isCrewStaffUser, resolveWallActor } from "@/app/franchize/lib/wall-access";
import {
  WALL_RENTER_AUDIENCES,
  processWallRenterNotifyJob,
  queueWallRenterNotifyJob,
  RENTER_NOTIFY_TIME_BUDGET_MS,
  type WallNotifyAudience,
} from "@/app/franchize/lib/wall-renter-notify";
import { isUuidLike } from "@/lib/wall-deeplink";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { postId?: string; slug?: string; initData?: string; audience?: string }
      | null;
    const postId = body?.postId?.trim() || "";
    const slug = body?.slug?.trim() || "";
    if (!postId || !slug) {
      return NextResponse.json({ success: false, error: "postId и slug обязательны" }, { status: 400 });
    }
    // audience (robustness): валиден только как полный идентификатор сегмента —
    // мусор молча игнорируется (repair не выполняется, обычный kick идёт).
    const audience =
      body?.audience && WALL_RENTER_AUDIENCES.includes(body.audience as WallNotifyAudience)
        ? (body.audience as WallNotifyAudience)
        : null;

    const crew = await getCrewBySlug(slug);
    if (!crew) {
      return NextResponse.json({ success: false, error: "Экипаж не найден" }, { status: 404 });
    }

    const actor = await resolveWallActor(body?.initData);
    if (!actor) {
      return NextResponse.json({ success: false, error: "Действие доступно из Telegram-бота экипажа" }, { status: 401 });
    }
    if (!(await isCrewStaffUser(actor.userId, crew))) {
      logger.warn("[wall-renter-notify] non-staff kick rejected", { postId, userId: actor.userId });
      return NextResponse.json({ success: false, error: "Рассылка доступна только экипажу" }, { status: 403 });
    }

    // Code review 2026-10-02: staff-гейт проверяет экипаж из body.slug, поэтому
    // процессор сверяет post.crew_id — staff экипажа A не может пнуть job чужого поста.
    let result = await processWallRenterNotifyJob(postId, RENTER_NOTIFY_TIME_BUDGET_MS, crew.id);

    // ── self-heal: постановка job потерялась на этапе публикации ──
    // absent + валидный audience + пост жив и принадлежит экипажу → ставим job
    // заново и доставляем здесь же (один round trip, клиент ничего не заметил).
    if (result.status === "absent" && audience && isUuidLike(postId)) {
      const postRow = await safePostLookup(postId, crew.id);
      if (postRow) {
        logger.info("[wall-renter-notify] absent job — self-heal requeue", { postId, audience });
        const queued = await queueWallRenterNotifyJob(postId, audience, actor.userId);
        if (queued) {
          result = await processWallRenterNotifyJob(postId, RENTER_NOTIFY_TIME_BUDGET_MS, crew.id);
        }
      }
    }

    // absent (job не ставился / пост удалён) — это НЕ серверная ошибка: 500 шумит
    // в Vercel логах и пугает клиента на гонке с кроном. 200 + success:false.
    const httpStatus = result.ok || result.status === "absent" ? 200 : 500;
    return NextResponse.json({ success: result.ok, ...result }, { status: httpStatus });
  } catch (error) {
    logger.warn("[wall-renter-notify] kick crashed", error);
    return NextResponse.json({ success: false, error: "Внутренняя ошибка рассылки" }, { status: 500 });
  }
}

/** Локальный lookup «пост жив и из этого экипажа» — без выноса в lib. */
async function safePostLookup(postId: string, crewId: string): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin
    .from("crew_posts")
    .select("id")
    .eq("id", postId)
    .eq("crew_id", crewId)
    .eq("is_hidden", false)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}
