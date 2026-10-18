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
  getCrewPayoutSummary,
  getMyPayoutSummary,
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
