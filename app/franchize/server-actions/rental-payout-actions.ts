// app/franchize/server-actions/rental-payout-actions.ts
// "use server"
//
// Task 107 — web read surface for the VERIFIED PAYOUT counters.
//
// The Telegram hub (/payouts, ?start=payout) is where the money is MARKED;
// these actions only READ the three buckets (к выплате / не сверено /
// выплачено) so the profile shows the same truth as the bot. Money-safety:
// crew scope is gated by verifyCrewAccess, the crew-wide view additionally
// requires owner-tier (owner/co_owner/admin — the team-salaries gate).

"use server";

import { logger } from "@/lib/logger";
import {
  verifyCrewAccess,
  errorResponse,
  successResponse,
  type ActionResponse,
} from "./shared/auth-helpers";
import {
  getCrewPayoutLedger,
  getCrewPayoutSummary,
  getMyPayoutSummary,
  stampRentalPayout,
  type CrewPayoutLedgerView,
  type PayoutSummaryView,
} from "@/app/franchize/lib/rental-payout";

/** Personal buckets for THIS user inside one crew (MyEarningsPanel strip). */
export async function getMyPayoutSummaryAction(params: {
  slug: string;
}): Promise<ActionResponse<PayoutSummaryView>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed || !access.actorUserId) {
      return { success: false, error: access.error || "Не авторизовано." };
    }
    const summary = await getMyPayoutSummary(params.slug, access.actorUserId);
    return successResponse(summary);
  } catch (err) {
    logger.error("[rental-payout] getMyPayoutSummaryAction failed:", err);
    return errorResponse("Не удалось собрать счётчик выплат.");
  }
}

/** Crew-wide buckets — owner-tier only (team-salaries modal strip). */
export async function getCrewPayoutSummaryAction(params: {
  slug: string;
}): Promise<ActionResponse<PayoutSummaryView>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed) return { success: false, error: access.error };
    if (access.isOwner !== true) {
      return { success: false, error: "Общий счётчик выплат доступен владельцу или администратору экипажа." };
    }
    const summary = await getCrewPayoutSummary(params.slug);
    return successResponse(summary);
  } catch (err) {
    logger.error("[rental-payout] getCrewPayoutSummaryAction failed:", err);
    return errorResponse("Не удалось собрать общий счётчик выплат.");
  }
}

/**
 * Task 117 — КОПИЛКА КОМАНДЫ: crew-wide ledger (per-operator piggy banks +
 * actionable «к выплате» rows + paid archive) for the owner's profile.
 * Owner-tier only — the same gate as the team-salaries modal.
 */
export async function getCrewPayoutLedgerAction(params: {
  slug: string;
}): Promise<ActionResponse<CrewPayoutLedgerView>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed) return { success: false, error: access.error };
    if (access.isOwner !== true) {
      return { success: false, error: "Копилка команды доступна владельцу или администратору экипажа." };
    }
    const ledger = await getCrewPayoutLedger(params.slug);
    return successResponse(ledger);
  } catch (err) {
    logger.error("[rental-payout] getCrewPayoutLedgerAction failed:", err);
    return errorResponse("Не удалось собрать копилку команды.");
  }
}

/**
 * Task 117 — mark / unmark a verified commission as PAID from the owner's
 * profile. Rights + status are enforced inside stampRentalPayout (canMarkPayout:
 * operator-party or crew owner/admin; row must still be verified), so this
 * wrapper only gates the surface owner-tier and forwards the note.
 */
export async function markCrewPayoutAction(params: {
  slug: string;
  rentalId: string;
  mark: boolean;
}): Promise<ActionResponse<{ ok: boolean; error?: string }>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed || !access.actorUserId) {
      return { success: false, error: access.error || "Не авторизовано." };
    }
    if (access.isOwner !== true) {
      return { success: false, error: "Отмечать выплаты может владелец или администратор экипажа." };
    }
    const res = await stampRentalPayout({
      rentalId: params.rentalId,
      chatId: access.actorUserId,
      mark: params.mark === true,
    });
    if (!res.ok) {
      // Row-level refusals (not verified / no rights) surface verbatim —
      // the boss must know WHY a mark did not land (task-102 lesson).
      return { success: true, data: { ok: false, error: res.error || "Не удалось сохранить отметку." } };
    }
    logger.info(
      `[rental-payout] profile ${params.mark ? "mark" : "unmark"} ok for ${params.rentalId} by ${access.actorUserId}`,
    );
    return successResponse({ ok: true });
  } catch (err) {
    logger.error("[rental-payout] markCrewPayoutAction failed:", err);
    return errorResponse("Не удалось отметить выплату.");
  }
}
