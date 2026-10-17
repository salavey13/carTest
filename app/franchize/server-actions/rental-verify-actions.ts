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
  formatVerificationSummary,
  grantVerificationAchievements,
  labelFromUsersMap,
  loadUsersMap,
  verificationKeyboard,
  verificationStatusNote,
  type RentalVerificationRow,
} from "@/app/franchize/lib/rental-verify";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

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

    // ── Load or create the verification row (shared with the resend action) ──
    let row: RentalVerificationRow;
    let createdNow: boolean;
    try {
      const loaded = await loadOrCreateVerificationRow({
        rental,
        actorChatId,
        source: "admin_manual",
        fallbackSlug: params.slug,
      });
      row = loaded.row;
      createdNow = loaded.created;
    } catch (rowErr: any) {
      const msg = typeof rowErr?.message === "string" ? rowErr.message : "";
      if (msg.includes("Таблица сверок")) return { success: false, error: msg };
      throw rowErr;
    }

    // ── Apply the owner-side confirm through the SAME state machine ──
    // applyVerificationAction refuses a second confirm on verified rows and
    // any foreign chat ids — the single funnel keeps the transitions audited.
    // TASK 102: a co_owner/admin with a DIFFERENT chat id than the recorded
    // owner_chat_id used to bounce off the party check («Вы не участник
    // сверки») while the UI happily showed them the ✅ button. The action is
    // owner-tier gated above, so a non-party authority acts ON THE OWNER
    // SIDE (the docstring's «boss confirms FOR the pair» semantics) instead
    // of failing silently.
    const stateChatId =
      row.operator_chat_id === actorChatId || row.owner_chat_id === actorChatId
        ? actorChatId
        : row.owner_chat_id || actorChatId;
    const result = applyVerificationAction(row, {
      action: "confirm",
      chatId: stateChatId,
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

// ── Shared backfill: load the row or build one from current rental data ──────
// Used by BOTH adminVerifyRentalAction and resendVerificationDmsAction so the
// «old rental without a row» case is handled identically (attribution pulled
// from pickup_freeze / return_confirmed_by when metadata is richer than the
// plain snapshot).
async function loadOrCreateVerificationRow(params: {
  rental: any;
  actorChatId: string;
  source: string;
  fallbackSlug: string;
}): Promise<{ row: RentalVerificationRow; created: boolean }> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("rental_verifications")
    .select("*")
    .eq("rental_id", params.rental.rental_id)
    .maybeSingle();
  if (fetchError) {
    const msg = fetchError.message || "";
    if (!/relation .* does not exist|schema cache/i.test(msg) && fetchError.code !== "42P01") throw fetchError;
    throw new Error("Таблица сверок ещё не создана — примените SQL (rental-verifications-table-2026-10-17.sql).");
  }
  if (existing) return { row: existing as RentalVerificationRow, created: false };

  const nowIso = new Date().toISOString();
  const snapshot = await computeRentalVerificationSnapshot({
    rental: params.rental,
    crewId: params.rental.crew_id,
    requestedAtIso: nowIso,
  });
  const { data: crewRow } = await supabaseAdmin
    .from("crews")
    .select("slug")
    .eq("id", params.rental.crew_id)
    .maybeSingle();
  const meta = (params.rental.metadata || {}) as Record<string, unknown>;
  const freeze = meta.pickup_freeze as Record<string, unknown> | undefined;
  const insert = {
    rental_id: params.rental.rental_id,
    crew_id: params.rental.crew_id,
    crew_slug: (crewRow?.slug as string) || params.fallbackSlug,
    operator_chat_id:
      typeof params.rental.created_by_operator_chat_id === "string" && params.rental.created_by_operator_chat_id.trim()
        ? params.rental.created_by_operator_chat_id.trim()
        : null,
    owner_chat_id: params.rental.owner_id ? String(params.rental.owner_id) : null,
    requested_by: params.actorChatId,
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
    source: params.source,
  };
  const { data: created, error: insertError } = await supabaseAdmin
    .from("rental_verifications")
    .upsert(insert, { onConflict: "rental_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (insertError) throw insertError;
  if (created) return { row: created as RentalVerificationRow, created: true };
  // Lost a race — re-read.
  const { data: reread } = await supabaseAdmin
    .from("rental_verifications")
    .select("*")
    .eq("rental_id", params.rental.rental_id)
    .maybeSingle();
  if (!reread) throw new Error("Не удалось создать запись сверки.");
  return { row: reread as RentalVerificationRow, created: false };
}

// ── Task 105: (re)send the verification DMs to both parties ──────────────────
// WHY: bd948bd0 closed while the verification trigger was a `void` fire-and-
// forget — Vercel froze the lambda before the row was written, so NOBODY got
// the ✅/⚠️ keyboard. Also covers lost chats / re-sent summaries after a
// dispute talk. Owner-tier gated like adminVerifyRentalAction; sends from the
// STORED snapshot (the numbers both parties must see are the frozen ones).
export interface ResendDmsResult {
  rentalId: string;
  sentTo: string[];
  created: boolean;
  status: string;
}

export async function resendVerificationDmsAction(params: {
  slug: string;
  rentalId: string;
}): Promise<ActionResponse<ResendDmsResult>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed) return { success: false, error: access.error };
    if (access.isOwner !== true) {
      return { success: false, error: "Выслать сверку может владелец или администратор экипажа." };
    }
    const actorChatId = String(access.actorUserId || "");

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
    if (rental.status !== "completed") {
      return { success: false, error: "Сверка отправляется по закрытым арендам." };
    }

    const { row, created } = await loadOrCreateVerificationRow({
      rental,
      actorChatId,
      source: "admin_resend",
      fallbackSlug: params.slug,
    });

    const usersMap = await loadUsersMap([row.operator_chat_id, row.owner_chat_id]);
    const operatorLabel = labelFromUsersMap(usersMap, row.operator_chat_id);
    const ownerLabel = labelFromUsersMap(usersMap, row.owner_chat_id);
    const singleParty = !row.operator_chat_id || row.operator_chat_id === row.owner_chat_id;
    const summary = formatVerificationSummary({
      crewName: row.crew_slug,
      snapshot: row.snapshot as any,
      usersMap,
      operatorChatId: row.operator_chat_id,
      ownerChatId: row.owner_chat_id,
      statusNote: verificationStatusNote({
        status: row.status,
        singleParty,
        operatorLabel,
        ownerLabel,
      }),
    });
    const withKeyboard = row.status === "pending" || row.status === "operator_confirmed" || row.status === "owner_confirmed";
    const keyboard = withKeyboard ? verificationKeyboard(row.rental_id) : [];

    const sentTo: string[] = [];
    const recipients = [...new Set([row.operator_chat_id, row.owner_chat_id].filter(Boolean) as string[])];
    for (const chatId of recipients) {
      try {
        const res = await sendComplexMessage(chatId, summary, keyboard, { parseMode: "HTML", keyboardType: "inline" });
        if (res?.success !== false) sentTo.push(chatId);
      } catch (e) {
        logger.warn(`[rental-verify] resend DM failed for ${chatId} (rental ${row.rental_id}):`, e);
      }
    }
    logger.info(`[rental-verify] DMs resent for ${row.rental_id} by ${actorChatId} (created=${created}, sent=${sentTo.length}/${recipients.length}, status=${row.status})`);
    return successResponse({ rentalId: row.rental_id, sentTo, created, status: row.status });
  } catch (err: any) {
    logger.error("[rental-verify] resendVerificationDmsAction exception:", err);
    const friendly = typeof err?.message === "string" && err.message.includes("Таблица сверок")
      ? err.message
      : handleError(err, "resendVerificationDmsAction");
    return errorResponse(friendly);
  }
}
