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
  applyVerificationAction,
  escapeVerifyHtml,
  formatRubVerify,
  formatVerificationSummary,
  labelFromUsersMap,
  verificationKeyboard,
  verificationStatusNote,
  type RentalVerificationRow,
  type RentalVerificationSnapshot,
  type RentalVerificationStatus,
  type VerificationBrief,
} from "./rental-verify-core";

// Re-export the pure surface so consumers (webhook wrapper, server actions,
// CSV builder, category bonuses) have ONE import path.
export {
  applyVerificationAction,
  escapeVerifyHtml,
  formatRubVerify,
  formatVerificationSummary,
  labelFromUsersMap,
  tallyVerificationStatuses,
  verificationKeyboard,
  verificationStatusNote,
  VERIFICATION_STATUS_LABELS,
} from "./rental-verify-core";
export type {
  ApplyActionResult,
  RentalVerificationRow,
  RentalVerificationSnapshot,
  RentalVerificationStatus,
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
function isMissingRelationError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true; // undefined_table
  return /relation .* does not exist|schema cache/i.test(error.message || "");
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

async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
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
      for (const chatId of [...new Set([current.operator_chat_id, current.owner_chat_id].filter(Boolean) as string[])]) {
        try {
          await sendComplexMessage(chatId, doneText, [], { parseMode: "HTML" });
        } catch {
          /* non-fatal */
        }
      }
      await grantVerificationAchievements(current, { speedy: isSpeedyConfirm(current) });
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
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await supabaseAdmin
        .from("rental_verifications")
        .select("rental_id, status, operator_chat_id, owner_chat_id")
        .in("rental_id", chunk);
      if (error) throw error;
      for (const row of (data || []) as Array<{
        rental_id: string;
        status: RentalVerificationStatus;
        operator_chat_id: string | null;
        owner_chat_id: string | null;
      }>) {
        map.set(String(row.rental_id), {
          status: row.status,
          operatorChatId: row.operator_chat_id,
          ownerChatId: row.owner_chat_id,
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
