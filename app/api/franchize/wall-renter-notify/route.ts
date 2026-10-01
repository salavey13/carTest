// /app/api/franchize/wall-renter-notify/route.ts
//
// POST /api/franchize/wall-renter-notify — staff kick для рассылки поста
// прошлым арендаторам (crew_posts.metadata.notify_job → wall-renter-notify).
//
// Почему отдельный роут, а не хвост createCommunityPostAction:
//   · рассылка может занять до ~50с (пакеты 20 × 1.1с, ≤ ~800 получателей) —
//     сервер-экшен публикации не должен столько висеть;
//   · maxDuration=60 здесь локально, публикации не нужен;
//   · идемпотентно: повторный kick продолжает с ledger (exactly-once).
//
// КЛИЕНТ: после публикации поста композер/map-модалка зовут этот роут
// (awaited fetch) и показывают тост с числом доставленных; если вкладку
// закрыли — хвост добивает крон /api/cron/wall-renter-notify.
//
// SECURITY: только crew-staff (owner / глобальный админ / активный член
// экипажа, которому принадлежит пост) — resolveWallActor (cookie или
// HMAC-верифицированный initData) + isCrewStaffUser. Никаких chat_id в
// ответе — только счётчики.

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getCrewBySlug, isCrewStaffUser, resolveWallActor } from "@/app/franchize/lib/wall-access";
import { processWallRenterNotifyJob, RENTER_NOTIFY_TIME_BUDGET_MS } from "@/app/franchize/lib/wall-renter-notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { postId?: string; slug?: string; initData?: string }
      | null;
    const postId = body?.postId?.trim() || "";
    const slug = body?.slug?.trim() || "";
    if (!postId || !slug) {
      return NextResponse.json({ success: false, error: "postId и slug обязательны" }, { status: 400 });
    }

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
    const result = await processWallRenterNotifyJob(postId, RENTER_NOTIFY_TIME_BUDGET_MS, crew.id);
    // absent (job не ставился / пост удалён) — это НЕ серверная ошибка: 500 шумит
    // в Vercel логах и пугает клиента на гонке с кроном. 200 + success:false.
    const httpStatus = result.ok || result.status === "absent" ? 200 : 500;
    return NextResponse.json({ success: result.ok, ...result }, { status: httpStatus });
  } catch (error) {
    logger.warn("[wall-renter-notify] kick crashed", error);
    return NextResponse.json({ success: false, error: "Внутренняя ошибка рассылки" }, { status: 500 });
  }
}
