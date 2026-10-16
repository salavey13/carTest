// app/franchize/server-actions/rental-verify-actions.ts
// "use server"
//
// Task 101 — web-side actions for the rental verification state.
//
// The Telegram flow (vrf_* buttons) covers rentals closed AFTER the feature
// ships; this action gives the crew owner/co_owner/admin a manual «verify»
// for everything else — primarily the backfill of already-closed rentals
// (October 2026) after an offline double-check. It is the web equivalent of
// «обе стороны подтвердили»: the boss confirms FOR the pair after they
// reconciled in person, so the row is marked verified with both timestamps.
//
// Money-safety: owner/co_owner/admin only (server-checked), snapshot frozen
// at action time, full audit trail in the row (requested_by/source).

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  verifyCrewAccess,
  handleError,
  errorResponse,
  successResponse,
  type ActionResponse,
} from "./shared/auth-helpers";
import {
  applyVerificationAction,
  computeRentalVerificationSnapshot,
  grantVerificationAchievements,
  type RentalVerificationRow,
} from "@/app/franchize/lib/rental-verify";

export interface AdminVerifyResult {
  rentalId: string;
  status: string;
}

export async function adminVerifyRentalAction(params: {
  slug: string;
  rentalId: string;
}): Promise<ActionResponse<AdminVerifyResult>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed) return { success: false, error: access.error };
    // Server-side gate: owner/co_owner/admin only (verifyCrewAccess isOwner
    // covers owner+admin+co_owner — the same gate as the team-salary views).
    if (access.isOwner !== true) {
      return { success: false, error: "Подтверждать расчёты может владелец или администратор экипажа." };
    }
    const actorChatId = String(access.actorUserId || "");
    if (!actorChatId) return { success: false, error: "Не удалось определить пользователя." };

    // ── Load the rental (for the snapshot when the row doesn't exist yet) ──
    const { data: rentalRow, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id, crew_id, owner_id, total_cost, metadata, status,
        created_by_operator_chat_id, created_at,
        requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
        vehicle:cars(id, make, model, specs, daily_price, type, crew_id)
      `)
      .eq("rental_id", params.rentalId)
      .maybeSingle();
    if (rentalError) throw rentalError;
    const rental = rentalRow as any;
    if (!rental) return { success: false, error: "Аренда не найдена." };

    // ── Load or create the verification row ──
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("rental_verifications")
      .select("*")
      .eq("rental_id", params.rentalId)
      .maybeSingle();
    if (fetchError) {
      const msg = fetchError.message || "";
      if (!/relation .* does not exist|schema cache/i.test(msg) && fetchError.code !== "42P01") throw fetchError;
      return { success: false, error: "Таблица сверок ещё не создана — примените SQL (rental-verifications-table-2026-10-17.sql)." };
    }

    let row: RentalVerificationRow;
    let createdNow = false;
    if (existing) {
      row = existing as RentalVerificationRow;
    } else {
      // Old rental without a verification row — build one from current data.
      const nowIso = new Date().toISOString();
      const snapshot = await computeRentalVerificationSnapshot({
        rental,
        crewId: rental.crew_id,
        requestedAtIso: nowIso,
      });
      const { data: crewRow } = await supabaseAdmin
        .from("crews")
        .select("slug")
        .eq("id", rental.crew_id)
        .maybeSingle();
      const meta = (rental.metadata || {}) as Record<string, unknown>;
      const freeze = meta.pickup_freeze as Record<string, unknown> | undefined;
      const insert = {
        rental_id: rental.rental_id,
        crew_id: rental.crew_id,
        crew_slug: (crewRow?.slug as string) || params.slug,
        operator_chat_id:
          typeof rental.created_by_operator_chat_id === "string" && rental.created_by_operator_chat_id.trim()
            ? rental.created_by_operator_chat_id.trim()
            : null,
        owner_chat_id: rental.owner_id ? String(rental.owner_id) : null,
        requested_by: actorChatId,
        status: "pending" as const,
        snapshot: {
          ...snapshot,
          attribution: {
            ...snapshot.attribution,
            handedByChatId:
              freeze && typeof freeze.frozen_by === "string" && freeze.frozen_by.trim()
                ? freeze.frozen_by.trim()
                : null,
            returnedByChatId:
              typeof meta.return_confirmed_by === "string" && meta.return_confirmed_by.trim()
                ? meta.return_confirmed_by.trim()
                : null,
          },
        },
        source: "admin_manual",
      };
      const { data: created, error: insertError } = await supabaseAdmin
        .from("rental_verifications")
        .upsert(insert, { onConflict: "rental_id", ignoreDuplicates: true })
        .select("*")
        .maybeSingle();
      if (insertError) throw insertError;
      if (!created) {
        // Lost a race — re-read.
        const { data: reread } = await supabaseAdmin
          .from("rental_verifications")
          .select("*")
          .eq("rental_id", params.rentalId)
          .maybeSingle();
        if (!reread) return { success: false, error: "Не удалось создать запись сверки." };
        row = reread as RentalVerificationRow;
      } else {
        row = created as RentalVerificationRow;
        createdNow = true;
      }
    }

    // ── Apply the owner-side confirm through the SAME state machine ──
    // applyVerificationAction refuses a second confirm on verified rows and
    // any foreign chat ids — the single funnel keeps the transitions audited.
    const result = applyVerificationAction(row, {
      action: "confirm",
      chatId: actorChatId,
      nowIso: new Date().toISOString(),
      reason: undefined,
    });
    if (!result.row) {
      // Not-a-party (owner chat id mismatch) or already verified.
      if (row.status === "verified") {
        return successResponse({ rentalId: params.rentalId, status: "verified" });
      }
      return { success: false, error: result.error || "Действие недоступно." };
    }
    // Admin manual verify is the web equivalent of «both agreed in person»:
    // stamp the operator's side too when it's still missing.
    const finalRow: RentalVerificationRow = {
      ...result.row,
      status: "verified",
      verified_at: result.row.verified_at ?? new Date().toISOString(),
      operator_confirmed_at: result.row.operator_confirmed_at ?? new Date().toISOString(),
      owner_confirmed_at: result.row.owner_confirmed_at ?? new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("rental_verifications")
      .update({
        status: finalRow.status,
        operator_confirmed_at: finalRow.operator_confirmed_at,
        owner_confirmed_at: finalRow.owner_confirmed_at,
        verified_at: finalRow.verified_at,
        updated_at: new Date().toISOString(),
      })
      .eq("rental_id", params.rentalId);
    if (updateError) throw updateError;

    logger.info(`[rental-verify] admin manual verify: ${params.rentalId} by ${actorChatId} (created=${createdNow})`);
    grantVerificationAchievements(finalRow, { speedy: false }).catch(() => undefined);

    return successResponse({ rentalId: params.rentalId, status: "verified" });
  } catch (err) {
    logger.error("[rental-verify] adminVerifyRentalAction exception:", err);
    return errorResponse(handleError(err, "adminVerifyRentalAction"));
  }
}
