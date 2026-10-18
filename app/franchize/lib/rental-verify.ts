// app/franchize/lib/rental-verify.ts
//
// Task 101 — RENTAL VERIFICATION («verified» salary state), SERVER HALF.
// Pure types/state-machine/formatting live in rental-verify-core.ts (zero
// imports — unit-testable); everything here touches Supabase/Telegram.
//
// WHY: month-end salary deduction used to mean hand-auditing EVERY rental of
// the period — a half-day process, and a sensitive one (boss: «this topic is
// very sensitive, treat it with full respect»). Now, right after a rental is
// CLOSED, the bot sends the calculated commission to BOTH the attributed
// operator and the crew owner with an inline keyboard:
//   ✅ Подтверждаю  /  ⚠️ Оспорить
// When both parties confirm, the rental becomes VERIFIED — lists/profile/CSV
// mark it, so month-end only reviews the small ⏳/⚠️ remainder. This turns
// the monthly reconciliation into an on-the-fly, gamified routine.
//
// MONEY-SAFETY CONTRACT:
//   • The commission math is the EXACT canonical one (computeRentalSalary +
//     resolveBikeCategories + countEquipmentUnits + standardRentalPrice — the
//     same functions computeCategoryBonuses uses for the actual salary).
//   • The snapshot is FROZEN at request time into rental_verifications.snapshot
//     — the numbers both parties saw are the numbers stored.
//   • Nothing here writes to the cash ledger / wallet — verification is a
//     REVIEW state, payouts stay an explicit owner action.
//   • Every DB touch degrades gracefully: if Paul has not applied
//     docs/crewDocs/rental-verifications-table-2026-10-17.sql yet, requests
//     no-op with a warn and UI simply shows no badges. Deploy order-agnostic.
//
// Callback wiring: command-handler.ts routes `vrf_*` callback_data here via
// app/webhook-handlers/commands/rental-verify.ts.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import {
  getSalaryConfig,
  getBikeCategoryOverrides,
  resolveBikeCategories,
  countEquipmentUnits,
  computeRentalSalary,
  equipmentStandardCost,
  standardRentalPrice,
  RENTAL_CATEGORY_LABELS,
  type RentalEquipment,
} from "@/lib/salary-coefficients";
import { equipmentFlagsLabel } from "@/lib/salary-coefficients-shared";
import { resolveRentalOperator, type ShiftLike } from "@/app/franchize/lib/operator-attribution";
import {
  grantFranchizeAchievementAction,
  syncFranchizeCountersAction,
} from "@/app/franchize/profile-actions";
import {
  acceptOpenProposal,
  adjustPartKeyboard,
  applyVerificationAction,
  applySplitDelta,
  clearDraft,
  declineOpenProposal,
  disputeEditorKeyboard,
  escapeVerifyHtml,
  formatDealDoneText,
  formatDisputeEditor,
  formatProposalMessage,
  formatRubVerify,
  formatVerificationSummary,
  labelFromUsersMap,
  otherPartyChatId,
  parseNegotiation,
  parseProposalCallback,
  partyRole,
  proposalResponseKeyboard,
  resetSplitPart,
  sendProposalFromDraft,
  setDraftComment,
  setDraftSplit,
  snapshotSplitOf,
  splitTotal,
  startDraft,
  verificationKeyboard,
  verificationStatusNote,
  type InlineButton,
  type NegotiationState,
  type OpenProposal,
  type RentalVerificationRow,
  type RentalVerificationSnapshot,
  type SplitPartKey,
  type VerificationBrief,
} from "./rental-verify-core";

// Re-export the pure surface so consumers (webhook wrapper, server actions,
// CSV builder, category bonuses) have ONE import path.
export {
  acceptOpenProposal,
  applyVerificationAction,
  declineOpenProposal,
  disputeEditorKeyboard,
  escapeVerifyHtml,
  formatDealDoneText,
  formatDisputeEditor,
  formatProposalMessage,
  formatRubVerify,
  formatVerificationSummary,
  labelFromUsersMap,
  parseNegotiation,
  parseProposalCallback,
  proposalResponseKeyboard,
  sendProposalFromDraft,
  snapshotSplitOf,
  splitTotal,
  startDraft,
  tallyVerificationStatuses,
  verificationKeyboard,
  verificationStatusNote,
  VERIFICATION_STATUS_LABELS,
} from "./rental-verify-core";
export type {
  ApplyActionResult,
  InlineButton,
  NegotiationRound,
  NegotiationState,
  OpenProposal,
  RentalVerificationRow,
  RentalVerificationSnapshot,
  RentalVerificationStatus,
  SplitPartKey,
  SplitParts,
  VerificationBrief,
  VerificationEffect,
} from "./rental-verify-core";

// ── Snapshot computation (canonical math) ────────────────────────────────────

export async function computeRentalVerificationSnapshot(params: {
  rental: {
    rental_id: string;
    total_cost: number | null;
    metadata: Record<string, unknown> | null;
    requested_start_date: string | null;
    requested_end_date: string | null;
    agreed_start_date: string | null;
    agreed_end_date: string | null;
    created_by_operator_chat_id?: string | null;
    created_at?: string | null;
    vehicle: {
      id?: string;
      make?: string | null;
      model?: string | null;
      specs?: Record<string, unknown> | null;
      daily_price?: number | null;
    } | null;
  };
  crewId: string;
  requestedAtIso: string;
}): Promise<RentalVerificationSnapshot> {
  const { rental, crewId } = params;
  const [config, bikeOverrides] = await Promise.all([
    getSalaryConfig(crewId),
    getBikeCategoryOverrides(crewId),
  ]);
  const vehicle = rental.vehicle;
  const meta = (rental.metadata || {}) as Record<string, unknown>;
  const eq = (meta.equipment || {}) as RentalEquipment;
  const categories = resolveBikeCategories(vehicle?.id || "", bikeOverrides);
  const price = Number(rental.total_cost) || 0;
  const stdPrice =
    standardRentalPrice({
      specs: vehicle?.specs,
      startIso: rental.requested_start_date || rental.agreed_start_date,
      endIso: rental.requested_end_date || rental.agreed_end_date,
      dailyPrice: vehicle?.daily_price,
      fallbackTotalCost: price,
    }) + equipmentStandardCost(eq);
  const salary = computeRentalSalary({
    config,
    rentalCategory: categories.rental,
    equipmentUnits: countEquipmentUnits(eq),
    totalCost: price,
    standardPrice: stdPrice,
  });

  const freeze = meta.pickup_freeze as Record<string, unknown> | undefined;
  const penaltyMeta = meta.penalty as { amount?: number; destination?: string; reason?: string } | undefined;

  return {
    bikeName: `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim(),
    rentalCategory: categories.rental,
    rentalCategoryLabel: RENTAL_CATEGORY_LABELS[categories.rental] || categories.rental,
    totalCost: price,
    base: salary.base,
    equipment: salary.equipment,
    overprice: salary.overprice,
    total: salary.total,
    equipmentUnits: countEquipmentUnits(eq),
    equipmentFlags: equipmentFlagsLabel(eq),
    overpricePercent: config.overpricePercent,
    depositReturned: typeof meta.deposit_returned === "boolean" ? (meta.deposit_returned as boolean) : null,
    damageNotes:
      typeof meta.damage_notes === "string" && meta.damage_notes.trim() ? (meta.damage_notes as string) : null,
    returnNotes:
      typeof meta.return_notes === "string" && meta.return_notes.trim() ? (meta.return_notes as string) : null,
    penalty:
      penaltyMeta && Number(penaltyMeta.amount) > 0
        ? {
            amount: Number(penaltyMeta.amount),
            destination: String(penaltyMeta.destination || "cash"),
            reason: String(penaltyMeta.reason || ""),
          }
        : null,
    attribution: {
      source: "request",
      createdByChatId:
        typeof rental.created_by_operator_chat_id === "string" && rental.created_by_operator_chat_id.trim()
          ? rental.created_by_operator_chat_id.trim()
          : null,
      handedByChatId:
        freeze && typeof freeze.frozen_by === "string" && freeze.frozen_by.trim()
          ? freeze.frozen_by.trim()
          : null,
      returnedByChatId:
        typeof meta.return_confirmed_by === "string" && meta.return_confirmed_by.trim()
          ? meta.return_confirmed_by.trim()
          : null,
    },
    requestedAtIso: params.requestedAtIso,
  };
}

// ── Graceful table access ────────────────────────────────────────────────────

/** True when the failure is «Paul hasn't applied the SQL yet» — feature no-ops. */
export function isMissingRelationError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true; // undefined_table
  return /relation .* does not exist|schema cache/i.test(error.message || "");
}

/**
 * Task 106 degradation: the negotiation lives in ONE extra jsonb column.
 * Until Paul applies the ALTER TABLE, every write/select touching it fails
 * with PGRST204 (unknown column) — the editor then no-ops and «Оспорить»
 * behaves exactly like the task-101 plain dispute.
 */
function isMissingNegotiationError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST204") return true;
  return /'negotiation' column/i.test(error.message || "");
}

// ── Users lookup ─────────────────────────────────────────────────────────────

/** Chat id → @username/full_name labels (exported for the drawer resend action). */
export async function loadUsersMap(
  chatIds: Array<string | null | undefined>,
): Promise<Map<string, { username?: string | null; full_name?: string | null }>> {
  const unique = [...new Set(chatIds.filter(Boolean).map(String))];
  const map = new Map<string, { username?: string | null; full_name?: string | null }>();
  if (unique.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("users")
    .select("user_id, username, full_name")
    .in("user_id", unique);
  for (const row of (data || []) as Array<{
    user_id: string | number;
    username?: string | null;
    full_name?: string | null;
  }>) {
    map.set(String(row.user_id), { username: row.username, full_name: row.full_name });
  }
  return map;
}

// ── Request orchestration ────────────────────────────────────────────────────

/**
 * Called (fire-and-forget, non-fatal) right after a rental is closed, from
 * BOTH closure paths: confirmVehicleReturn (rental page) and updateRentalStatus
 * (analytics dashboard). Creates the verification row and DMs both parties.
 */
export async function requestRentalVerification(params: {
  rentalId: string;
  actorChatId: string;
  source: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    // ── Fetch the closed rental + vehicle ──
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
    if (!rental) return { sent: false, reason: "rental not found" };
    if (!rental.crew_id) return { sent: false, reason: "no crew — personal rental" };

    // Gear/service docs carry no operator bonus — nothing to verify.
    const meta = (rental.metadata || {}) as Record<string, unknown>;
    const vehicle = Array.isArray(rental.vehicle) ? rental.vehicle[0] : rental.vehicle;
    if (meta.item_type === "equipment" || vehicle?.type === "equipment" || vehicle?.type === "service") {
      return { sent: false, reason: "equipment/service doc — no operator bonus" };
    }

    // ── Attributed operator (canonical chain) ──
    // Same window idiom as computeCategoryBonuses: ±1 day around created_at so
    // a rental created at 23:50 still matches the operator's shift.
    const createdAtMs = Date.parse(String(rental.created_at || "")) || Date.now();
    const { data: shiftRows } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("member_id, clock_in_time, clock_out_time")
      .eq("crew_id", rental.crew_id)
      .gte("clock_in_time", new Date(createdAtMs - 25 * 3600 * 1000).toISOString())
      .lte("clock_in_time", new Date(createdAtMs + 25 * 3600 * 1000).toISOString());
    const shifts: ShiftLike[] = (shiftRows || []).map((s: any) => ({
      member_id: s.member_id,
      clock_in_time: s.clock_in_time,
      clock_out_time: s.clock_out_time ?? null,
    }));
    const attribution = resolveRentalOperator(
      {
        created_by_operator_chat_id: rental.created_by_operator_chat_id,
        created_at: rental.created_at,
        metadata: rental.metadata,
      },
      shifts,
    );

    const operatorChatId = attribution.operatorId ? String(attribution.operatorId) : null;
    const ownerChatId = rental.owner_id ? String(rental.owner_id) : null;
    if (!operatorChatId && !ownerChatId) return { sent: false, reason: "no parties to verify" };

    // ── Snapshot BEFORE anything else (freeze the numbers) ──
    const nowIso = new Date().toISOString();
    const snapshot = await computeRentalVerificationSnapshot({
      rental: {
        rental_id: rental.rental_id,
        total_cost: rental.total_cost,
        metadata: rental.metadata,
        requested_start_date: rental.requested_start_date,
        requested_end_date: rental.requested_end_date,
        agreed_start_date: rental.agreed_start_date,
        agreed_end_date: rental.agreed_end_date,
        created_by_operator_chat_id: rental.created_by_operator_chat_id,
        created_at: rental.created_at,
        vehicle,
      },
      crewId: rental.crew_id,
      requestedAtIso: nowIso,
    });

    const { data: crewRow } = await supabaseAdmin
      .from("crews")
      .select("slug, name")
      .eq("id", rental.crew_id)
      .maybeSingle();
    const crewSlug = (crewRow?.slug as string) || null;
    const crewName = (crewRow?.name as string) || null;

    // ── Idempotent insert: first request wins (re-closures don't re-spam) ──
    const insertPayload = {
      rental_id: rental.rental_id,
      crew_id: rental.crew_id,
      crew_slug: crewSlug,
      operator_chat_id: operatorChatId,
      owner_chat_id: ownerChatId,
      requested_by: String(params.actorChatId),
      status: "pending" as const,
      snapshot,
      source: params.source,
    };
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("rental_verifications")
      .upsert(insertPayload, { onConflict: "rental_id", ignoreDuplicates: true })
      .select("rental_id")
      .maybeSingle();
    if (insertError) {
      if (isMissingRelationError(insertError)) {
        logger.warn(
          "[rental-verify] rental_verifications table missing — run docs/crewDocs/rental-verifications-table-2026-10-17.sql; skipping verify request",
        );
        return { sent: false, reason: "table missing" };
      }
      throw insertError;
    }
    // ignoreDuplicates + select returns nothing when the row already existed.
    if (!inserted) {
      return { sent: false, reason: "verification already requested" };
    }

    // ── Notify both parties ──
    const usersMap = await loadUsersMap([
      operatorChatId,
      ownerChatId,
      snapshot.attribution.createdByChatId,
      snapshot.attribution.handedByChatId,
      snapshot.attribution.returnedByChatId,
    ]);
    const operatorLabel = labelFromUsersMap(usersMap, operatorChatId);
    const ownerLabel = labelFromUsersMap(usersMap, ownerChatId);

    const singleParty = !operatorChatId || operatorChatId === ownerChatId;
    const statusNote = verificationStatusNote({
      status: "pending",
      singleParty,
      operatorLabel,
      ownerLabel,
    });

    const summary = formatVerificationSummary({
      crewName,
      snapshot,
      usersMap,
      operatorChatId,
      ownerChatId,
      statusNote,
    });
    const keyboard = verificationKeyboard(rental.rental_id);

    const recipients = [...new Set([operatorChatId, ownerChatId].filter(Boolean) as string[])];
    for (const chatId of recipients) {
      try {
        await sendComplexMessage(chatId, summary, keyboard, { parseMode: "HTML", keyboardType: "inline" });
      } catch (e) {
        logger.warn(`[rental-verify] summary send failed for ${chatId} (rental ${rental.rental_id}):`, e);
      }
    }
    logger.info(
      `[rental-verify] verification requested for ${rental.rental_id}: operator=${operatorChatId ?? "—"} owner=${ownerChatId ?? "—"} total=${snapshot.total}₽`,
    );
    return { sent: true };
  } catch (err) {
    logger.warn(`[rental-verify] requestRentalVerification failed for ${params.rentalId} (non-fatal):`, err);
    return { sent: false, reason: "exception" };
  }
}

// ── Callback handling (Telegram buttons) ─────────────────────────────────────

export async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(
      `https://api.telegram.org/bot${token}/answerCallbackQuery?callback_query_id=${encodeURIComponent(callbackQueryId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
  } catch (e) {
    logger.warn("[rental-verify] answerCallbackQuery failed:", e);
  }
}

/**
 * Entry point from command-handler.ts (prefix `vrf_`):
 *   vrf_ok_<rentalId>   — «✅ Подтверждаю»
 *   vrf_dis_<rentalId>  — «⚠️ Оспорить»
 */
export async function handleRentalVerifyCallback(params: {
  data: string;
  chatId: string;
  callbackQueryId: string;
  /** For stripping the buttons from the tapped message after the decision. */
  messageId?: number;
}): Promise<boolean> {
  const data = params.data || "";
  const ok = data.startsWith("vrf_ok_");
  const dispute = data.startsWith("vrf_dis_");
  if (!ok && !dispute) return false;
  const rentalId = data.replace(ok ? "vrf_ok_" : "vrf_dis_", "").trim();
  if (!rentalId) {
    await answerCallback(params.callbackQueryId, "Не распознал аренду.");
    return true;
  }

  try {
    const { data: row, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("*")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (error && !isMissingRelationError(error)) throw error;
    if (!row) {
      await answerCallback(params.callbackQueryId, "Сверка не найдена (аренда закрыта до ввода сверки).");
      return true;
    }

    const current = row as RentalVerificationRow;
    // ── TASK 102 race hardening ──────────────────────────────────────────────
    // Both parties can tap ✅ within the same second: two callbacks each read
    // `pending`, each computes its own next state, and the SECOND write used
    // to blindly overwrite the first — final state stuck at operator_confirmed
    // / owner_confirmed while BOTH humans had confirmed (buttons already
    // stripped → dead end). The update is now a conditional (optimistic-lock)
    // write: it only lands while the row still has the status we read. When a
    // parallel writer won the race we re-read and re-apply against the fresh
    // row — the state machine is idempotent, so the loser converges to
    // «verified» instead of clobbering it.
    let current_ = current;
    let result = applyVerificationAction(current_, {
      action: ok ? "confirm" : "dispute",
      chatId: String(params.chatId),
      nowIso: new Date().toISOString(),
    });
    if (!result.row) {
      await answerCallback(params.callbackQueryId, result.error || "Действие недоступно.");
      return true;
    }

    let writeLanded = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data: written, error: updateError } = await supabaseAdmin
        .from("rental_verifications")
        .update({
          status: result.row.status,
          operator_confirmed_at: result.row.operator_confirmed_at,
          owner_confirmed_at: result.row.owner_confirmed_at,
          verified_at: result.row.verified_at,
          disputed_by: result.row.disputed_by,
          dispute_reason: result.row.dispute_reason,
          updated_at: new Date().toISOString(),
        })
        .eq("rental_id", rentalId)
        // Optimistic lock: only write while nobody else changed the status
        // since our read. (verified is terminal — nobody can race past it.)
        .eq("status", current_.status)
        .select("status")
        .maybeSingle();
      if (updateError) throw updateError;
      if (written) {
        writeLanded = true;
        break;
      }
      // Lost the race — re-read the row someone else just advanced and apply
      // our action to THAT state instead.
      const { data: fresh, error: rereadError } = await supabaseAdmin
        .from("rental_verifications")
        .select("*")
        .eq("rental_id", rentalId)
        .maybeSingle();
      if (rereadError) throw rereadError;
      if (!fresh) break;
      current_ = fresh as RentalVerificationRow;
      result = applyVerificationAction(current_, {
        action: ok ? "confirm" : "dispute",
        chatId: String(params.chatId),
        nowIso: new Date().toISOString(),
      });
      if (!result.row) {
        await answerCallback(params.callbackQueryId, result.error || "Действие недоступно.");
        return true;
      }
    }
    if (!writeLanded) {
      await answerCallback(params.callbackQueryId, "Не удалось сохранить — попробуйте ещё раз.");
      return true;
    }

    // Best-effort: strip the buttons from the tapped message so the decision
    // feels final (cosmetic — failures are ignored).
    if (params.messageId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: params.chatId,
              message_id: params.messageId,
              reply_markup: { inline_keyboard: [] },
            }),
          });
        }
      } catch {
        /* cosmetic only */
      }
    }

    const usersMap = await loadUsersMap([current.operator_chat_id, current.owner_chat_id]);
    const snapshot = current.snapshot as RentalVerificationSnapshot;

    if (result.effect === "verified") {
      await answerCallback(params.callbackQueryId, "✅ Подтверждено — спасибо!");
      const doneText = [
        `🤝 <b>Расчёт подтверждён обеими сторонами</b>`,
        ``,
        `🛵 ${escapeVerifyHtml(snapshot?.bikeName || "аренда")} · комиссия ${formatRubVerify(Number(snapshot?.total) || 0)}`,
        `Аренда помечена как <b>проверенная</b> ✅ — в конце месяца она уже не требует разбора.`,
      ].join("\n");
      // Task 106: when the row carries an AGREED (corrected) split, both
      // parties get the honest final numbers instead of the frozen ones.
      const agreedNego = parseNegotiation((current_ as any).negotiation);
      const doneFinal = agreedNego.agreed
        ? formatDealDoneText({
            snapshot: snapshot || {},
            agreedSplit: agreedNego.agreed.split,
            proposerLabel: labelFromUsersMap(usersMap, agreedNego.agreed.proposedBy),
            acceptorLabel: labelFromUsersMap(usersMap, agreedNego.agreed.acceptedBy),
          })
        : doneText;
      // Task 107: every «verified» DM now carries the payout-hub entry —
      // the money game continues after the confirm (see the payout counter).
      const payoutDoneKb = [[{ text: "💰 Мои выплаты", callback_data: "payo_hub_0" }]];
      for (const chatId of [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean) as string[])]) {
        try {
          await sendComplexMessage(chatId, doneFinal, payoutDoneKb, { parseMode: "HTML", keyboardType: "inline" });
        } catch {
          /* non-fatal */
        }
      }
      await grantVerificationAchievements(current_, { speedy: isSpeedyConfirm(current_) });
      await grantNegotiationAchievements(current_);
      return true;
    }

    if (result.effect === "disputed") {
      await answerCallback(params.callbackQueryId, "Отмечено как спор — сверьтесь вручную.");
      const actorLabel = labelFromUsersMap(usersMap, String(params.chatId));
      const disputeText = [
        `⚠️ <b>Расчёт оспорен</b>`,
        ``,
        `${escapeVerifyHtml(actorLabel)} оспорил сверку по аренде ${escapeVerifyHtml(snapshot?.bikeName || "")} (комиссия ${formatRubVerify(Number(snapshot?.total) || 0)}).`,
        `Аренда помечена как «спор» в ЗП-списках — разберитесь лично и закройте вопрос до конца месяца.`,
      ].join("\n");
      for (const chatId of [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean) as string[])]) {
        if (chatId === String(params.chatId)) continue;
        try {
          await sendComplexMessage(chatId, disputeText, [], { parseMode: "HTML" });
        } catch {
          /* non-fatal */
        }
      }
      // Task 106: the dispute is no longer a dead end — the disputant gets a
      // live split editor right away (two-party rows only; degrade silently
      // when the negotiation column is not applied yet).
      await openDisputeEditorAfterDispute(rentalId, current_, String(params.chatId), result.actor as "operator" | "owner");
      return true;
    }

    // wait_other_party — nudge the other side with a fresh keyboard.
    const otherChatId = result.actor === "operator" ? current.owner_chat_id : current.operator_chat_id;
    await answerCallback(params.callbackQueryId, "Принято ✅ Ждём вторую сторону.");
    if (otherChatId) {
      const actorLabel = labelFromUsersMap(usersMap, String(params.chatId));
      const nudge = [
        `✅ ${escapeVerifyHtml(actorLabel)} подтвердил расчёт по аренде ${escapeVerifyHtml(snapshot?.bikeName || "")} (комиссия ${formatRubVerify(Number(snapshot?.total) || 0)}).`,
        `Осталось ваше подтверждение:`,
      ].join("\n");
      try {
        await sendComplexMessage(otherChatId, nudge, verificationKeyboard(rentalId), {
          parseMode: "HTML",
          keyboardType: "inline",
        });
      } catch {
        /* non-fatal */
      }
    }
    return true;
  } catch (err) {
    logger.warn(`[rental-verify] callback failed for ${rentalId}:`, err);
    await answerCallback(params.callbackQueryId, "Ошибка сверки — попробуйте ещё раз.");
    return true;
  }
}

// ── Task 106: NEGOTIATION server half («дил») ────────────────────────────────
// The dispute editor + proposal flow. All money-sensitive transitions still
// go through applyVerificationAction (the task-101/102 state machine); the
// negotiation jsonb only carries the DRAFT / OPEN proposal / AGREED split.

/** True editMessageText (the shared editMessage deletes+resends — flickers). */
export async function editTelegramMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  buttons: InlineButton[][] = [],
): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : { reply_markup: { inline_keyboard: [] } }),
      }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    // «message is not modified» — the same content; harmless, counts as ok.
    if (json && !json.ok && /message is not modified/i.test(json.description || "")) return true;
    return !!(json && json.ok);
  } catch (e) {
    logger.warn("[rental-verify] editMessageText failed:", e);
    return false;
  }
}

/** Render-or-send: edit the tapped editor message, fall back to a fresh DM. */
async function renderEditorMessage(
  chatId: string,
  messageId: number | undefined,
  text: string,
  buttons: InlineButton[][],
): Promise<void> {
  if (messageId && (await editTelegramMessageText(chatId, messageId, text, buttons))) return;
  try {
    await sendComplexMessage(chatId, text, buttons, { parseMode: "HTML", keyboardType: "inline" });
  } catch (e) {
    logger.warn(`[rental-verify] editor render failed for ${chatId}:`, e);
  }
}

/**
 * After a dispute lands, open the split editor for the disputant (new DM).
 * Pure negotiation — the row was already written by the caller; here we only
 * attach a draft so the first render shows the frozen numbers.
 */
async function openDisputeEditorAfterDispute(
  rentalId: string,
  row: RentalVerificationRow,
  chatId: string,
  role: "operator" | "owner",
): Promise<void> {
  try {
    const singleParty = !row.operator_chat_id || row.operator_chat_id === row.owner_chat_id;
    if (singleParty) return; // no second human — nothing to negotiate with
    const original = snapshotSplitOf(row.snapshot as Partial<RentalVerificationSnapshot>);
    const nego = startDraft(parseNegotiation((row as any).negotiation), chatId, role, original);
    const { error } = await supabaseAdmin
      .from("rental_verifications")
      .update({ negotiation: nego, updated_at: new Date().toISOString() })
      .eq("rental_id", rentalId);
    if (error) {
      if (isMissingNegotiationError(error)) {
        logger.warn("[rental-verify] negotiation column missing — editor skipped (apply rental-verifications-negotiation SQL)");
        return;
      }
      throw error;
    }
    const usersMap = await loadUsersMap([chatId]);
    const text = [
      `⚠️ Расчёт оспорен. Поправьте числа прямо здесь и отправьте предложение второй стороне —`,
      `или подтвердите, если передумали.`,
      ``,
      formatDisputeEditor({
        snapshot: row.snapshot as Partial<RentalVerificationSnapshot>,
        draft: original,
        actorLabel: labelFromUsersMap(usersMap, chatId),
      }),
    ].join("\n");
    try {
      await sendComplexMessage(chatId, text, disputeEditorKeyboard(rentalId, original, original), {
        parseMode: "HTML",
        keyboardType: "inline",
      });
    } catch {
      /* non-fatal */
    }
  } catch (e) {
    logger.warn(`[rental-verify] openDisputeEditorAfterDispute failed for ${rentalId} (non-fatal):`, e);
  }
}

/**
 * Entry point from command-handler.ts (prefix `vrfp_`): the dispute editor
 * stepper + the proposal answer buttons. Every path answers the callback.
 * Returns false for foreign data so the router can fall through.
 */
export async function handleRentalVerifyProposalCallback(params: {
  data: string;
  chatId: string;
  callbackQueryId: string;
  messageId?: number;
}): Promise<boolean> {
  const parsed = parseProposalCallback(params.data || "");
  if (!parsed) return false;
  const { rentalId } = parsed;
  try {
    const { data: row, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("*")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (error && !isMissingRelationError(error)) throw error;
    if (!row) {
      await answerCallback(params.callbackQueryId, "Сверка не найдена.");
      return true;
    }
    const current = row as RentalVerificationRow;
    const chatId = String(params.chatId);
    const role = partyRole(current, chatId);
    if (!role) {
      await answerCallback(params.callbackQueryId, "Вы не участник сверки по этой аренде.");
      return true;
    }
    const singleParty = !current.operator_chat_id || current.operator_chat_id === current.owner_chat_id;
    if (singleParty) {
      await answerCallback(params.callbackQueryId, "Вторая сторона отсутствует — расчёт подтверждается одним ✅.");
      return true;
    }
    const original = snapshotSplitOf(current.snapshot as Partial<RentalVerificationSnapshot>);
    let nego = parseNegotiation((current as any).negotiation);
    const usersMap = await loadUsersMap([current.operator_chat_id, current.owner_chat_id]);
    const actorLabel = labelFromUsersMap(usersMap, chatId);

    // Draft guard: view/part/adjust silently (re)create the actor's draft.
    const ensureDraft = (): void => {
      if (!nego.draft || nego.draft.by !== chatId) {
        nego = startDraft(nego, chatId, role, original, nego.draft?.by !== chatId ? undefined : nego.open?.split);
      }
    };

    /** Persist negotiation (degrades to a callback error when column missing). */
    const saveNego = async (next: NegotiationState, extra: Record<string, unknown> = {}): Promise<boolean> => {
      const { error: upErr } = await supabaseAdmin
        .from("rental_verifications")
        .update({ negotiation: next, updated_at: new Date().toISOString(), ...extra })
        .eq("rental_id", rentalId);
      if (upErr) {
        if (isMissingNegotiationError(upErr)) {
          await answerCallback(params.callbackQueryId, "Редактор недоступен — примените SQL (rental-verifications-negotiation).");
          return false;
        }
        throw upErr;
      }
      return true;
    };

    switch (parsed.action) {
      case "view": {
        ensureDraft();
        if (!(await saveNego(nego))) return true;
        await answerCallback(params.callbackQueryId, "Редактор расчёта");
        await renderEditorMessage(chatId, params.messageId, formatDisputeEditor({
          snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
          draft: nego.draft!.split,
          actorLabel,
          comment: nego.draft!.comment,
        }), disputeEditorKeyboard(rentalId, nego.draft!.split, original));
        return true;
      }

      case "part": {
        ensureDraft();
        await answerCallback(params.callbackQueryId, `${parsed.part === "base" ? "🏍" : parsed.part === "equipment" ? "🧰" : "📈"} Правка части`);
        await renderEditorMessage(chatId, params.messageId, formatDisputeEditor({
          snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
          draft: nego.draft!.split,
          actorLabel,
          comment: nego.draft!.comment,
          activePart: parsed.part,
        }), adjustPartKeyboard(parsed.part as SplitPartKey, rentalId));
        return true;
      }

      case "adjust": {
        ensureDraft();
        const delta = parsed.delta || 0;
        const nextSplit = delta === 0
          ? resetSplitPart(nego.draft!.split, parsed.part as SplitPartKey, original)
          : applySplitDelta(nego.draft!.split, parsed.part as SplitPartKey, delta);
        nego = setDraftSplit(nego, nextSplit);
        if (!(await saveNego(nego))) return true;
        await answerCallback(params.callbackQueryId, delta === 0 ? "Сброшено к исходному" : "Обновлено");
        await renderEditorMessage(chatId, params.messageId, formatDisputeEditor({
          snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
          draft: nextSplit,
          actorLabel,
          comment: nego.draft!.comment,
          activePart: parsed.part,
        }), adjustPartKeyboard(parsed.part as SplitPartKey, rentalId));
        return true;
      }

      case "comment": {
        ensureDraft();
        if (!(await saveNego(nego))) return true;
        // Switch the chat into capture mode: the next plain text message
        // becomes the comment (hook in command-handler.ts → handleRentalVerifyCommentText).
        // NB task110: user_states has NO `updated_at` column (live table comes
        // from 20250721100000_create_user_states_table.sql: user_id/state/context/
        // expires_at/created_at only). Writing `updated_at` made PostgREST reject
        // the whole upsert (42703/PGRST204) and supabase-js does NOT throw on API
        // errors — the state silently never existed, the next text message fell
        // through every handler and the operator got «Неизвестная команда».
        // Payload mirrors doc/subrent setState; expires_at set explicitly (the
        // on-conflict update would otherwise keep a stale 15-min default).
        const { error: stateErr } = await supabaseAdmin.from("user_states").upsert(
          {
            user_id: chatId,
            state: `vrf_comment_${rentalId}`,
            context: { editorMessageId: params.messageId ?? null },
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (stateErr) {
          // Loud failure instead of a fake prompt: the capture hook would
          // never fire and the next message would die in the router.
          logger.error("[rental-verify] vrf_comment state upsert failed:", stateErr.message);
          await answerCallback(params.callbackQueryId, "⚠️ Не удалось включить режим ввода. Попробуйте ещё раз.");
          return true;
        }
        await answerCallback(params.callbackQueryId, "Напишите комментарий следующим сообщением");
        await renderEditorMessage(chatId, params.messageId, [
          `✍️ <b>Комментарий к предложению</b>`,
          ``,
          `Напишите его следующим сообщением (до 300 символов) — он уйдёт второй стороне вместе с числами.`,
          ``,
          `«cancel» — отменить ввод.`,
        ].join("\n"), [[{ text: "⬅️ К частям", callback_data: `vrfp_v_${rentalId}` }]]);
        return true;
      }

      case "send": {
        ensureDraft();
        const res = sendProposalFromDraft(nego, { chatId, role, nowIso: new Date().toISOString(), original });
        if (!res.ok) {
          await answerCallback(params.callbackQueryId, res.error || "Не удалось отправить.");
          return true;
        }
        // A proposal is a dispute being negotiated — pin the row to «disputed»
        // when it somehow isn't yet (status transitions keep the state machine).
        const extraStatus: Record<string, unknown> =
          current.status === "disputed" || current.status === "verified"
            ? {}
            : { status: "disputed", disputed_by: chatId, dispute_reason: "предложена корректировка расчёта" };
        if (!(await saveNego(res.state, extraStatus))) return true;
        const otherChatId = otherPartyChatId(current, chatId);
        await answerCallback(params.callbackQueryId, "📤 Предложение отправлено");
        // Replace the editor with a «sent» stub.
        await renderEditorMessage(chatId, params.messageId, [
          `📤 <b>Предложение отправлено</b> ${escapeVerifyHtml(actorLabel)}`,
          ``,
          formatDisputeEditor({
            snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
            draft: res.state.open?.split || original,
            actorLabel,
            comment: res.state.open?.comment,
          }),
          ``,
          `Ждём ответ второй стороны: ✅ согласиться / ⚠️ предложить своё / ❌ отклонить.`,
        ].join("\n"), []);
        if (otherChatId) {
          const proposal = res.state.open as OpenProposal;
          try {
            await sendComplexMessage(
              otherChatId,
              formatProposalMessage({
                snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
                proposal,
                proposerLabel: actorLabel,
                forChatId: otherChatId,
              }),
              proposalResponseKeyboard(rentalId),
              { parseMode: "HTML", keyboardType: "inline" },
            );
          } catch {
            /* non-fatal */
          }
        }
        return true;
      }

      case "confirm": {
        // «Расчёт верный» right from the editor = the plain ✅ flow.
        // Clear the draft first, then reuse the state-machine confirm path.
        nego = clearDraft(nego);
        if (!(await saveNego(nego))) return true;
        await handleRentalVerifyCallback({
          data: `vrf_ok_${rentalId}`,
          chatId,
          callbackQueryId: params.callbackQueryId,
          messageId: params.messageId,
        });
        return true;
      }

      case "accept": {
        const acc = acceptOpenProposal(nego, { chatId, role });
        if (!acc.ok) {
          await answerCallback(params.callbackQueryId, acc.error || "Нельзя принять.");
          return true;
        }
        // The acceptor AGREES with the numbers — run it through the same
        // optimistic-lock confirm transition as a regular ✅.
        const confirm = applyVerificationAction(current, { action: "confirm", chatId, nowIso: new Date().toISOString() });
        if (!confirm.row) {
          await answerCallback(params.callbackQueryId, confirm.error || "Подтверждение недоступно.");
          return true;
        }
        const { data: written, error: upErr } = await supabaseAdmin
          .from("rental_verifications")
          .update({
            negotiation: acc.state,
            status: confirm.row.status,
            operator_confirmed_at: confirm.row.operator_confirmed_at,
            owner_confirmed_at: confirm.row.owner_confirmed_at,
            verified_at: confirm.row.verified_at,
            updated_at: new Date().toISOString(),
          })
          .eq("rental_id", rentalId)
          .eq("status", current.status)
          .select("status")
          .maybeSingle();
        if (upErr) {
          if (isMissingNegotiationError(upErr)) {
            await answerCallback(params.callbackQueryId, "Редактор недоступен — примените SQL (rental-verifications-negotiation).");
            return true;
          }
          throw upErr;
        }
        if (!written) {
          await answerCallback(params.callbackQueryId, "Не удалось сохранить — попробуйте ещё раз.");
          return true;
        }
        const proposerChatId = acc.state.agreed ? acc.state.agreed.proposedBy : null;
        if (confirm.effect === "verified") {
          await answerCallback(params.callbackQueryId, "🤝 Дил закрыт — аренда проверена!");
          const done = formatDealDoneText({
            snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
            agreedSplit: acc.state.agreed!.split,
            proposerLabel: labelFromUsersMap(usersMap, proposerChatId),
            acceptorLabel: actorLabel,
          });
          for (const c of [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean) as string[])]) {
            try {
              await sendComplexMessage(c, done, [[{ text: "💰 Мои выплаты", callback_data: "payo_hub_0" }]], {
                parseMode: "HTML",
                keyboardType: "inline",
              });
            } catch {
              /* non-fatal */
            }
          }
          await grantVerificationAchievements({ ...current, ...confirm.row }, { speedy: isSpeedyConfirm(current) });
          await grantNegotiationAchievements({ ...current, ...confirm.row, negotiation: acc.state } as RentalVerificationRow);
        } else {
          // wait_other_party — the proposer still owes his ✅ on the NEW numbers.
          await answerCallback(params.callbackQueryId, "✅ Согласились — ждём подтверждение второй стороны.");
          if (proposerChatId) {
            const nudge = [
              `✅ ${escapeVerifyHtml(actorLabel)} согласился с вашими числами по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")}:`,
              `📊 Итог оператору: <b>${formatRubVerify(splitTotal(acc.state.agreed!.split))}</b>`,
              ``,
              `Осталось ваше подтверждение:`,
            ].join("\n");
            try {
              await sendComplexMessage(proposerChatId, nudge, verificationKeyboard(rentalId), {
                parseMode: "HTML",
                keyboardType: "inline",
              });
            } catch {
              /* non-fatal */
            }
          }
        }
        return true;
      }

      case "decline": {
        const dec = declineOpenProposal(nego, { chatId, role, nowIso: new Date().toISOString() });
        if (!dec.ok) {
          await answerCallback(params.callbackQueryId, dec.error || "Нельзя отклонить.");
          return true;
        }
        if (!(await saveNego(dec.state))) return true;
        await answerCallback(params.callbackQueryId, "❌ Предложение отклонено.");
        const proposer = nego.open?.by || null;
        if (proposer) {
          try {
            await sendComplexMessage(
              proposer,
              [
                `❌ ${escapeVerifyHtml(actorLabel)} отклонил предложение по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")}.`,
                `Расчёт остаётся в статусе «спор» — сверьтесь лично; владелец может закрыть спор вручную в аналитике.`,
              ].join("\n"),
              [],
              { parseMode: "HTML" },
            );
          } catch {
            /* non-fatal */
          }
        }
        return true;
      }

      case "counter": {
        // The other party wants to propose their own numbers: withdraw the
        // open proposal (history keeps it) and open the editor prefilled
        // with the counterparty's numbers.
        const fromSplit = nego.open?.split || original;
        const wasBy = nego.open?.by || null;
        nego = clearDraft(startDraft({ ...nego, open: null }, chatId, role, original, fromSplit));
        if (!(await saveNego(nego))) return true;
        if (wasBy && wasBy !== chatId) {
          try {
            await sendComplexMessage(
              wasBy,
              `⚠️ ${escapeVerifyHtml(actorLabel)} решил предложить свои числа по аренде ${escapeVerifyHtml((current.snapshot as any)?.bikeName || "")} — ждите новое предложение.`,
              [],
              { parseMode: "HTML" },
            );
          } catch {
            /* non-fatal */
          }
        }
        await answerCallback(params.callbackQueryId, "⚖️ Редактор открыт — предложите свои числа");
        await renderEditorMessage(chatId, params.messageId, formatDisputeEditor({
          snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
          draft: nego.draft!.split,
          actorLabel,
        }), disputeEditorKeyboard(rentalId, nego.draft!.split, original));
        return true;
      }
    }
    return true;
  } catch (err) {
    logger.warn(`[rental-verify] proposal callback failed for ${parsed.rentalId}:`, err);
    await answerCallback(params.callbackQueryId, "Ошибка — попробуйте ещё раз.");
    return true;
  }
}

/**
 * Text-message hook (command-handler.ts): the user is in comment-capture
 * mode after tapping «✍️ Комментарий». Returns true when the message was
 * consumed by the editor.
 */
export async function handleRentalVerifyCommentText(params: {
  userId: string;
  chatId: string;
  text: string;
}): Promise<boolean> {
  try {
    const { data: stateRow, error: stateReadErr } = await supabaseAdmin
      .from("user_states")
      .select("state, context")
      .eq("user_id", params.userId)
      .like("state", "vrf_comment_%")
      .maybeSingle();
    if (stateReadErr) {
      // NB task110: a transient read error must not push the operator's next
      // message into the generic router (that produced «Неизвестная команда»).
      // Missing table → fall through (degradation), any other blip → consume.
      logger.warn("[rental-verify] vrf_comment state read failed:", stateReadErr.message);
      return !isMissingRelationError(stateReadErr);
    }
    if (!stateRow?.state) return false;
    const rentalId = String(stateRow.state).slice("vrf_comment_".length);
    const text = String(params.text || "").trim();
    // Best-effort state cleanup regardless of outcome.
    await supabaseAdmin.from("user_states").delete().eq("user_id", params.userId).like("state", "vrf_comment_%");
    if (!rentalId) return true;

    const { data: row, error } = await supabaseAdmin
      .from("rental_verifications")
      .select("*")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (error && !isMissingRelationError(error)) throw error;
    if (!row) return true;
    const current = row as RentalVerificationRow;
    const role = partyRole(current, String(params.userId));
    if (!role) return true;
    const original = snapshotSplitOf(current.snapshot as Partial<RentalVerificationSnapshot>);
    let nego = parseNegotiation((current as any).negotiation);
    if (!nego.draft || nego.draft.by !== String(params.userId)) {
      nego = startDraft(nego, String(params.userId), role, original);
    }
    if (text.toLowerCase() === "cancel" || text === "/cancel") {
      // Cancel the input only — keep whatever draft existed.
      const ctx = (stateRow.context || {}) as { editorMessageId?: number | null };
      await renderEditorMessage(String(params.chatId), ctx.editorMessageId ?? undefined, formatDisputeEditor({
        snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
        draft: nego.draft!.split,
        actorLabel: labelFromUsersMap(await loadUsersMap([String(params.userId)]), String(params.userId)),
        comment: nego.draft!.comment,
      }), disputeEditorKeyboard(rentalId, nego.draft!.split, original));
      return true;
    }
    nego = setDraftComment(nego, text);
    const { error: upErr } = await supabaseAdmin
      .from("rental_verifications")
      .update({ negotiation: nego, updated_at: new Date().toISOString() })
      .eq("rental_id", rentalId);
    if (upErr) {
      if (isMissingNegotiationError(upErr)) return true;
      throw upErr;
    }
    const ctx = (stateRow.context || {}) as { editorMessageId?: number | null };
    await renderEditorMessage(String(params.chatId), ctx.editorMessageId ?? undefined, formatDisputeEditor({
      snapshot: current.snapshot as Partial<RentalVerificationSnapshot>,
      draft: nego.draft!.split,
      actorLabel: labelFromUsersMap(await loadUsersMap([String(params.userId)]), String(params.userId)),
      comment: nego.draft!.comment,
    }), disputeEditorKeyboard(rentalId, nego.draft!.split, original));
    return true;
  } catch (e) {
    logger.warn("[rental-verify] comment capture failed (non-fatal):", e);
    return true; // consumed — do not let the text leak into other flows
  }
}

// ── Deal achievements (the negotiation game) ─────────────────────────────────

/**
 * Fired when a rental reaches «verified» AND the row carries an agreed
 * (corrected) split: the pair didn't just confirm — they settled a dispute.
 * deal_first / deal_5, counted from the DB truth (client-side filter, the
 * per-party set is small; the 731-shift lesson still applies — counters are
 * derived here from a bounded, indexed query, never incremented blindly).
 */
export async function grantNegotiationAchievements(row: RentalVerificationRow): Promise<void> {
  try {
    const nego = parseNegotiation((row as any).negotiation);
    if (!nego.agreed) return;
    const slug = row.crew_slug;
    if (!slug) return;
    const parties = [...new Set([row.operator_chat_id, row.owner_chat_id].filter(Boolean) as string[])];
    for (const chatId of parties) {
      const { data, error } = await supabaseAdmin
        .from("rental_verifications")
        .select("negotiation")
        .eq("status", "verified")
        .or(`operator_chat_id.eq.${chatId},owner_chat_id.eq.${chatId}`)
        .limit(500);
      if (error) {
        if (!isMissingRelationError(error) && !isMissingNegotiationError(error)) {
          logger.warn("[rental-verify] deal count query failed:", error.message);
        }
        continue;
      }
      const dealCount = (data || []).filter((r: any) => parseNegotiation(r.negotiation).agreed).length;
      const grants: Array<{ id: string; context?: Record<string, unknown> }> = [];
      if (dealCount >= 1) grants.push({ id: "deal_first", context: { dealCount } });
      if (dealCount >= 5) grants.push({ id: "deal_5", context: { dealCount } });
      for (const g of grants) {
        grantFranchizeAchievementAction({
          slug,
          userId: chatId,
          achievementId: g.id,
          source: "rental:deal",
          context: g.context,
        }).catch((e) => logger.warn(`[rental-verify] grant ${g.id} failed for ${chatId}:`, e));
      }
    }
  } catch (e) {
    logger.warn("[rental-verify] grantNegotiationAchievements failed (non-fatal):", e);
  }
}

function isSpeedyConfirm(row: RentalVerificationRow): boolean {
  const requested = Date.parse(row.requested_at || "");
  if (!Number.isFinite(requested)) return false;
  return Date.now() - requested < 3600 * 1000;
}

// ── Achievements (gamified reconciliation) ───────────────────────────────────

/**
 * Fired when a rental reaches «verified». Both confirming humans get credit:
 *   • rentalsVerified counter — ABSOLUTE SET from the DB (the shift.ts
 *     «731 смены» lesson: derived values are never incremented from stale
 *     totals);
 *   • verify_first / verify_10 / verify_50 thresholds;
 *   • verify_speedy — both sides agreed within one hour of the request.
 */
export async function grantVerificationAchievements(
  row: RentalVerificationRow,
  opts: { speedy: boolean },
): Promise<void> {
  try {
    const slug = row.crew_slug;
    if (!slug) return;
    const parties = [...new Set([row.operator_chat_id, row.owner_chat_id].filter(Boolean) as string[])];
    for (const chatId of parties) {
      const { count, error } = await supabaseAdmin
        .from("rental_verifications")
        .select("rental_id", { count: "exact", head: true })
        .eq("status", "verified")
        .or(`operator_chat_id.eq.${chatId},owner_chat_id.eq.${chatId}`);
      if (error) {
        logger.warn("[rental-verify] verified count query failed:", error.message);
        continue;
      }
      const verifiedCount = count || 0;

      syncFranchizeCountersAction({
        slug,
        userId: chatId,
        counters: { rentalsVerified: verifiedCount },
        source: "rental:verified",
      }).catch((e) => logger.warn("[rental-verify] counter sync failed:", e));

      const grants: Array<{ id: string; context?: Record<string, unknown> }> = [];
      if (verifiedCount >= 1) grants.push({ id: "verify_first", context: { verifiedCount } });
      if (verifiedCount >= 10) grants.push({ id: "verify_10", context: { verifiedCount } });
      if (verifiedCount >= 50) grants.push({ id: "verify_50", context: { verifiedCount } });
      if (opts.speedy) {
        grants.push({
          id: "verify_speedy",
          context: { minutes: Math.round((Date.now() - Date.parse(row.requested_at)) / 60000) },
        });
      }
      for (const g of grants) {
        grantFranchizeAchievementAction({
          slug,
          userId: chatId,
          achievementId: g.id,
          source: "rental:verified",
          context: g.context,
        }).catch((e) => logger.warn(`[rental-verify] grant ${g.id} failed for ${chatId}:`, e));
      }
    }
  } catch (e) {
    logger.warn("[rental-verify] grantVerificationAchievements failed (non-fatal):", e);
  }
}

// ── Batch status lookup for UI/CSV ───────────────────────────────────────────

/**
 * Map rental_id → verification status for lists. Returns an EMPTY map when
 * the table does not exist yet (SQL not applied) — callers must treat a
 * missing entry as «no verification data», not «unverified».
 */
export async function getVerificationStatusMap(rentalIds: string[]): Promise<Map<string, VerificationBrief>> {
  const map = new Map<string, VerificationBrief>();
  const ids = [...new Set((rentalIds || []).filter(Boolean))].map(String);
  if (ids.length === 0) return map;
  try {
    // Chunked: the lists can carry hundreds of ids per period.
    // Task 106: negotiation rides along so the UI can show «предложение
    // отправлено» chips and the agreed (corrected) split. Falls back to a
    // negotiation-free select while the column is not applied yet.
    const COLS_WITH_NEGO = "rental_id, status, operator_chat_id, owner_chat_id, negotiation";
    const COLS_PLAIN = "rental_id, status, operator_chat_id, owner_chat_id";
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      let rows: Array<any> | null = null;
      let selErr: any = null;
      {
        const res = await supabaseAdmin.from("rental_verifications").select(COLS_WITH_NEGO).in("rental_id", chunk);
        if (res.error && isMissingNegotiationError(res.error)) {
          const retry = await supabaseAdmin.from("rental_verifications").select(COLS_PLAIN).in("rental_id", chunk);
          rows = retry.data as any[] | null;
          selErr = retry.error;
        } else {
          rows = res.data as any[] | null;
          selErr = res.error;
        }
      }
      if (selErr) throw selErr;
      for (const row of rows || []) {
        const nego = row.negotiation !== undefined ? parseNegotiation(row.negotiation) : null;
        map.set(String(row.rental_id), {
          status: row.status,
          operatorChatId: row.operator_chat_id,
          ownerChatId: row.owner_chat_id,
          ...(nego ? { proposalOpen: !!nego.open, agreedSplit: nego.agreed ? nego.agreed.split : null } : {}),
        });
      }
    }
  } catch (err: any) {
    if (isMissingRelationError(err)) {
      logger.warn("[rental-verify] rental_verifications missing — badges hidden until SQL applied");
    } else {
      logger.warn("[rental-verify] getVerificationStatusMap failed:", err?.message);
    }
  }
  return map;
}
