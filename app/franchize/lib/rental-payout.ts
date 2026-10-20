// app/franchize/lib/rental-payout.ts
//
// Task 107 — VERIFIED PAYOUT, SERVER HALF.
// Loads the per-viewer payout picture from rental_verifications, stamps
// «выплачено» with an audit log inside the payout jsonb column, and runs the
// `payo_` Telegram callback flow (hub → card → confirm → result).
//
// Design invariants (money surface — the same discipline as task 102/106):
//   • the tracked money is ALWAYS the frozen/агрид operator commission from
//     the verification row — never recomputed live, never taken from the user;
//   • every stamp requires authority: a party of the row OR owner-tier of the
//     crew (crew owner / global admin / active admin-or-co_owner member);
//   • stamps land only on verified rows (optimistic lock on status), so a
//     parallel dispute/verify can never race past a payout write;
//   • the payout column degrades exactly like the negotiation column
//     (task 106): not applied → counters work with «everything unpaid», the
//     stamp buttons answer with a friendly «apply the SQL» note.
//
// Scope model:
//   • «Мои комиссии»  — rows where the viewer is the operator party;
//   • «все экипажи»   — owner-tier viewers additionally see every payout row
//     of the crews they own/admin (the boss walks rentals one by one and
//     marks the money handed over).

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import {
  answerCallback,
  editTelegramMessageText,
  isMissingRelationError,
  labelFromUsersMap,
  loadUsersMap,
  requestRentalVerification,
  selfHealVerificationRow,
} from "./rental-verify";
import {
  buildPayoutItem,
  commissionOf,
  encodePayoutCallback,
  formatPayoutAllConfirm,
  formatPayoutCard,
  formatPayoutConfirm,
  formatPayoutHub,
  formatPayoutNotifyText,
  formatPayoutResult,
  isPayoutRow,
  isoToDateLabel,
  parsePayoutCallback,
  parsePayoutInfo,
  payoutAllConfirmKeyboard,
  payoutCardKeyboard,
  payoutConfirmKeyboard,
  payoutHubKeyboard,
  summarizePayoutItems,
  PAYOUT_PAGE_SIZE,
  type PayoutConvertible,
  type PayoutInfo,
  type PayoutItem,
  type PayoutSummary,
  type PayoutSourceRow,
} from "./rental-payout-core";

const PAYOUT_SQL_HINT = "примените SQL: docs/crewDocs/rental-verifications-payout-2026-10-18.sql";

// ── Graceful column access (same pattern as negotiation, task 106) ───────────

const COL_BASE =
  "rental_id, crew_id, crew_slug, status, operator_chat_id, owner_chat_id, requested_at, verified_at, snapshot";
const COLS_FULL = `${COL_BASE}, negotiation, payout`;

function missingColumnFromError(error: { message?: string; code?: string } | null | undefined): string | null {
  if (!error) return null;
  if (error.code !== "PGRST204") return null;
  const m = /'([A-Za-z_]+)' column/.exec(error.message || "");
  return m ? m[1] : null;
}

interface PayoutRowsResult {
  rows: PayoutSourceRow[];
  payoutColumnMissing: boolean;
}

/**
 * Runs a select over rental_verifications with the FULL column list and
 * retries without the offending column on PGRST204 (SQL not applied yet).
 * `run` receives the column list and performs the awaited query.
 */
async function runPayoutSelect(
  // PostgrestBuilder is a thenable, not a real Promise — PromiseLike keeps
  // the `await` honest without forcing the caller to wrap the builder.
  run: (cols: string) => PromiseLike<{ data: any; error: any }>,
): Promise<PayoutRowsResult> {
  let cols = COLS_FULL;
  let payoutColumnMissing = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await run(cols);
    const missing = missingColumnFromError(error);
    if (!error) return { rows: (data || []) as PayoutSourceRow[], payoutColumnMissing };
    // Table itself missing (SQL not applied) → empty result, feature degrades.
    if (isMissingRelationError(error)) return { rows: [], payoutColumnMissing: true };
    if (!missing || !cols.includes(missing)) throw error;
    if (missing === "payout") payoutColumnMissing = true;
    cols = cols.split(", ").filter((c) => c !== missing).join(", ");
  }
  throw new Error("rental_verifications: column fallback loop");
}

// ── Authority ────────────────────────────────────────────────────────────────

async function isGlobalAdmin(chatId: string): Promise<boolean> {
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("role, status, metadata")
    .eq("user_id", chatId)
    .maybeSingle();
  const meta = (u?.metadata || {}) as Record<string, unknown>;
  return (
    u?.role === "admin" ||
    u?.role === "vprAdmin" ||
    u?.status === "admin" ||
    meta.role === "admin" ||
    meta.status === "admin"
  );
}

/**
 * Owner-tier = crew owner, global admin, or an active admin/co_owner member.
 * The same gate the team-salaries surface uses — a money view follows a
 * money gate.
 */
export async function resolveOwnerTierCrewIds(chatId: string): Promise<string[]> {
  const out = new Set<string>();
  try {
    const { data: owned } = await supabaseAdmin.from("crews").select("id").eq("owner_id", chatId).limit(500);
    for (const c of owned || []) out.add(String((c as any).id));
  } catch (e) {
    logger.warn("[rental-payout] crews.owner_id lookup failed:", e);
  }
  if (await isGlobalAdmin(chatId)) {
    const { data: all } = await supabaseAdmin.from("crews").select("id").limit(500);
    for (const c of all || []) out.add(String((c as any).id));
  } else {
    try {
      const { data: ms } = await supabaseAdmin
        .from("crew_members")
        .select("crew_id, role, membership_status")
        .eq("user_id", chatId)
        .limit(500);
      for (const m of ms || []) {
        if (m.membership_status === "active" && ["admin", "co_owner"].includes(m.role || "")) {
          out.add(String(m.crew_id));
        }
      }
    } catch (e) {
      logger.warn("[rental-payout] crew_members lookup failed:", e);
    }
  }
  return [...out];
}

/** Who may stamp the payout on a row: a party, or owner-tier of the crew. */
async function canMarkPayout(row: PayoutSourceRow, chatId: string): Promise<boolean> {
  if (row.operator_chat_id && String(row.operator_chat_id) === chatId) return true;
  if (row.owner_chat_id && String(row.owner_chat_id) === chatId) return true;
  if (!row.crew_id) return false;
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", row.crew_id)
      .maybeSingle();
    if (crew?.owner_id && String(crew.owner_id) === chatId) return true;
  } catch {
    /* fall through */
  }
  if (await isGlobalAdmin(chatId)) return true;
  try {
    const { data: m } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", row.crew_id)
      .eq("user_id", chatId)
      .maybeSingle();
    return m?.membership_status === "active" && ["admin", "co_owner"].includes(m.role || "");
  } catch {
    return false;
  }
}

// ── Hub data ─────────────────────────────────────────────────────────────────

export interface PayoutHubData {
  items: PayoutItem[];
  summary: PayoutSummary;
  isOwnerTier: boolean;
  scopeLabel: string;
  payoutColumnMissing: boolean;
  /** Completed rentals without a verification row (one-tap conversion). */
  convertibles: PayoutConvertible[];
}

/**
 * Everything the payout hub needs for one viewer: ALL payout items (the
 * summary covers the full set; the list is paginated at render time).
 * Rows come from two scopes merged: operator-party rows (mine) + crew-wide
 * rows for the owner-tier crews.
 */
export async function loadPayoutHubData(chatId: string): Promise<PayoutHubData> {
  const viewer = String(chatId);
  const byId = new Map<string, PayoutSourceRow>();

  const mine = await runPayoutSelect((cols) =>
    supabaseAdmin
      .from("rental_verifications")
      .select(cols)
      .or(`operator_chat_id.eq.${viewer},owner_chat_id.eq.${viewer}`)
      .limit(1000),
  );
  for (const r of mine.rows) byId.set(String(r.rental_id), r);

  let payoutColumnMissing = mine.payoutColumnMissing;
  const crewIds = await resolveOwnerTierCrewIds(viewer);
  let isOwnerTier = false;
  if (crewIds.length > 0) {
    isOwnerTier = true;
    const crewRows = await runPayoutSelect((cols) =>
      supabaseAdmin.from("rental_verifications").select(cols).in("crew_id", crewIds).limit(1000),
    );
    payoutColumnMissing = payoutColumnMissing || crewRows.payoutColumnMissing;
    for (const r of crewRows.rows) byId.set(String(r.rental_id), r);
  }

  const items: PayoutItem[] = [];
  for (const row of byId.values()) {
    const item = buildPayoutItem(row, viewer);
    if (item) items.push(item);
  }
  // Money order: ready-to-pay first, then blockers, then the paid archive;
  // within a bucket — newest money date first.
  const rank = (i: PayoutItem) => (i.paid ? 2 : i.status === "verified" ? 0 : 1);
  const ts = (i: PayoutItem) => Date.parse(i.verifiedAt || i.requestedAt || "") || 0;
  items.sort((a, b) => rank(a) - rank(b) || ts(b) - ts(a));

  const convertibles = await loadConvertibles(viewer, crewIds, byId);

  return {
    items,
    summary: summarizePayoutItems(items),
    isOwnerTier,
    scopeLabel: isOwnerTier ? "все экипажи" : "Мои комиссии",
    payoutColumnMissing,
    convertibles,
  };
}

/**
 * Old completed rentals WITHOUT a verification row — the payout counters
 * cannot see their money. Personal scope (own/created rentals) plus, for an
 * owner-tier viewer, the crews' recent closures. The tap reuses
 * requestRentalVerification 1:1 (frozen snapshot + DMs to both parties), so
 * the conversion is the SAME verification the renter-side flow produces.
 */
async function loadConvertibles(
  viewer: string,
  crewIds: string[],
  rowsWithPayout: Map<string, unknown>,
): Promise<PayoutConvertible[]> {
  // 92 days (was 45): the boss asked to сверять ALREADY closed rentals — the
  // July closures (pre-verification-system era) must surface here too.
  const sinceIso = new Date(Date.now() - 92 * 24 * 3600 * 1000).toISOString();
  const found = new Map<string, { bike: string; at: string }>();
  const grab = (rows: any[] | null) => {
    for (const r of rows || []) {
      if (!r?.rental_id || found.has(String(r.rental_id))) continue;
      const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
      // Gear/service docs carry no operator bonus — nothing to convert.
      if (vehicle?.type === "equipment" || vehicle?.type === "service") continue;
      found.set(String(r.rental_id), {
        bike: `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim() || "аренда",
        at: String(r.created_at || ""),
      });
    }
  };
  try {
    const personal = await supabaseAdmin
      .from("rentals")
      .select("rental_id, crew_id, created_at, created_by_operator_chat_id, vehicle:cars(make, model, type)")
      .eq("status", "completed")
      .gte("created_at", sinceIso)
      .or(`owner_id.eq.${viewer},created_by_operator_chat_id.eq.${viewer}`)
      .order("created_at", { ascending: false })
      // limit 500 (was 30): 30 only reached back ~2 weeks, so older closures
      // were invisible to the conversion list forever.
      .limit(500);
    grab(personal.data);
    if (crewIds.length > 0) {
      const crewRows = await supabaseAdmin
        .from("rentals")
        .select("rental_id, crew_id, created_at, created_by_operator_chat_id, vehicle:cars(make, model, type)")
        .eq("status", "completed")
        .gte("created_at", sinceIso)
        .in("crew_id", crewIds)
        .order("created_at", { ascending: false })
        .limit(500);
      grab(crewRows.data);
    }
  } catch (e) {
    logger.warn("[rental-payout] convertibles lookup failed (non-fatal):", e);
    return [];
  }
  const out: PayoutConvertible[] = [];
  for (const [rentalId, info] of found) {
    if (rowsWithPayout.has(rentalId)) continue; // already a сверка row
    out.push({ rentalId, bikeName: info.bike, dateLabel: isoToDateLabel(info.at) });
  }
  // 10 (was 5): the July-era rowless backlog alone is 13 rentals.
  return out.slice(0, 10);
}

/** Page slice for the hub keyboard (the summary always covers ALL items). */
export function sliceHubPage(items: PayoutItem[], page: number): { slice: PayoutItem[]; hasMore: boolean } {
  const start = Math.max(0, page) * PAYOUT_PAGE_SIZE;
  const slice = items.slice(start, start + PAYOUT_PAGE_SIZE);
  return { slice, hasMore: items.length > start + PAYOUT_PAGE_SIZE };
}

async function renderHubInto(params: {
  chatId: string;
  page: number;
  messageId?: number;
}): Promise<void> {
  const { chatId, page, messageId } = params;
  const data = await loadPayoutHubData(chatId);
  const { slice, hasMore } = sliceHubPage(data.items, page);
  const text = formatPayoutHub({
    scopeLabel: data.scopeLabel,
    summary: data.summary,
    items: slice,
    page,
    hasMore,
    isOwnerTier: data.isOwnerTier,
    sqlNote: data.payoutColumnMissing ? `выплаты пока только на чтение — ${PAYOUT_SQL_HINT}` : null,
    convertibles: data.convertibles,
  });
  const keyboard = payoutHubKeyboard(slice, {
    page,
    hasMore,
    toPayCount: data.summary.toPay.count,
    convertibles: data.convertibles,
  });
  if (messageId) {
    const ok = await editTelegramMessageText(chatId, messageId, text, keyboard);
    if (ok) return;
  }
  await sendComplexMessage(chatId, text, keyboard, { parseMode: "HTML", keyboardType: "inline" });
}

/** Fresh message entry — /payouts command and the ?start=payout deep link. */
export async function sendPayoutHubMessage(chatId: string, page = 0): Promise<void> {
  try {
    await renderHubInto({ chatId: String(chatId), page });
  } catch (e: any) {
    if (isMissingRelationError(e)) {
      await sendComplexMessage(
        chatId,
        "ℹ️ Таблица сверок ещё не создана — примените SQL: docs/crewDocs/rental-verifications-table-2026-10-17.sql и docs/crewDocs/rental-verifications-payout-2026-10-18.sql",
        [],
      );
      return;
    }
    logger.warn("[rental-payout] hub message failed:", e);
    await sendComplexMessage(chatId, "⚠️ Не удалось собрать выплаты — попробуйте ещё раз.", []);
  }
}

// ── Row load for cards ───────────────────────────────────────────────────────

async function loadRowById(rentalId: string): Promise<{ row: PayoutSourceRow | null; payoutColumnMissing: boolean }> {
  let payoutColumnMissing = false;
  let row: PayoutSourceRow | null = null;
  const res = await runPayoutSelect((cols) =>
    supabaseAdmin.from("rental_verifications").select(cols).eq("rental_id", rentalId).maybeSingle(),
  );
  payoutColumnMissing = res.payoutColumnMissing;
  row = (res.rows[0] as PayoutSourceRow) || null;
  return { row, payoutColumnMissing };
}

// ── Mark / unmark ────────────────────────────────────────────────────────────

export interface PayoutStampResult {
  ok: boolean;
  error?: string;
  item?: PayoutItem;
  alreadyInState?: boolean;
}

/**
 * Stamps (or unstamps) the operator-commission payout on ONE verified row.
 * Optimistic lock on status='verified' — a payout can never overwrite a
 * parallel dispute/verify transition; on race we re-read and re-evaluate.
 */
export async function stampRentalPayout(params: {
  rentalId: string;
  chatId: string;
  mark: boolean;
  note?: string | null;
}): Promise<PayoutStampResult> {
  const { rentalId, chatId, mark } = params;
  try {
    const { row } = await loadRowById(rentalId);
    if (!row) return { ok: false, error: "Сверка не найдена." };
    if (!isPayoutRow(row)) return { ok: false, error: "У этой аренды нет выплаты оператору — отмечать нечего." };
    if (row.status !== "verified") return { ok: false, error: "Сначала завершите сверку — выплата отмечается только по свёрнутой аренде." };
    if (!(await canMarkPayout(row, chatId))) {
      return { ok: false, error: "Отмечать выплату может участник сверки или владелец экипажа." };
    }

    const nowIso = new Date().toISOString();
    const current = parsePayoutInfo(row.payout);
    if ((current.operator?.marked === true) === mark) {
      // Idempotent tap — the state already matches.
      const item = buildPayoutItem(row, chatId);
      return { ok: true, item: item || undefined, alreadyInState: true };
    }

    const logEntry = {
      action: (mark ? "marked" : "unmarked") as "marked" | "unmarked",
      at: nowIso,
      by: String(chatId),
      note: params.note || null,
    };
    const nextPayout: PayoutInfo = {
      ...current,
      operator: {
        marked: mark,
        at: nowIso,
        by: String(chatId),
        note: params.note || null,
      },
      log: [...(current.log || []), logEntry].slice(-50),
    };

    // Optimistic lock: only while the row is still verified.
    const { data: written, error: updateError } = await supabaseAdmin
      .from("rental_verifications")
      .update({ payout: nextPayout, updated_at: nowIso })
      .eq("rental_id", rentalId)
      .eq("status", "verified")
      .select("payout")
      .maybeSingle();
    if (updateError) {
      const missing = missingColumnFromError(updateError as any);
      if (missing === "payout") {
        return { ok: false, error: `Колонки выплат ещё нет — ${PAYOUT_SQL_HINT}.` };
      }
      throw updateError;
    }
    if (!written) {
      // Lost the race — the row is no longer verified (dispute opened).
      return { ok: false, error: "Статус сверки изменился — обновите карточку и попробуйте снова." };
    }

    const item = buildPayoutItem({ ...row, payout: nextPayout }, chatId) || undefined;
    logger.info(`[rental-payout] ${mark ? "marked" : "unmarked"} payout for ${rentalId} by ${chatId}`);
    return { ok: true, item };
  } catch (e: any) {
    if (isMissingRelationError(e)) {
      return { ok: false, error: "Таблица сверок не создана — примените SQL (rental-verifications-table-2026-10-17.sql)." };
    }
    logger.warn(`[rental-payout] stamp failed for ${rentalId}:`, e);
    return { ok: false, error: "Не удалось сохранить отметку — попробуйте ещё раз." };
  }
}

/** The other parties to ping about a payout change (excluding the actor). */
function otherPartyChatIds(row: PayoutSourceRow, actorChatId: string): string[] {
  return [...new Set([row.operator_chat_id, row.owner_chat_id].filter(Boolean).map(String))].filter(
    (c) => c !== String(actorChatId),
  );
}

async function notifyPartiesAboutPayout(params: {
  row: PayoutSourceRow;
  actorChatId: string;
  mark: boolean;
}): Promise<void> {
  const { row, actorChatId, mark } = params;
  const recipients = otherPartyChatIds(row, actorChatId);
  if (recipients.length === 0) return;
  const { amount } = commissionOf(row);
  const usersMap = await loadUsersMap([actorChatId]);
  const actorLabel = labelFromUsersMap(usersMap, actorChatId);
  const snap = (row.snapshot || {}) as Record<string, unknown>;
  const text = formatPayoutNotifyText({
    kind: mark ? "marked" : "unmarked",
    amount,
    bikeName: String(snap.bikeName || "аренда"),
    actorLabel,
  });
  for (const chatId of recipients) {
    try {
      await sendComplexMessage(chatId, text, [], { parseMode: "HTML" });
    } catch (e) {
      logger.warn(`[rental-payout] notify failed for ${chatId}:`, e);
    }
  }
}

/** Marks every verified-unpaid item of the viewer's scope. Bounded loop. */
export async function markAllPayouts(chatId: string): Promise<{ count: number; sum: number; failed: number }> {
  const data = await loadPayoutHubData(String(chatId));
  const targets = data.items.filter((i) => i.status === "verified" && !i.paid);
  let count = 0;
  let sum = 0;
  let failed = 0;
  for (const target of targets) {
    const res = await stampRentalPayout({ rentalId: target.rentalId, chatId: String(chatId), mark: true });
    if (res.ok) {
      count += 1;
      sum += target.amount;
    } else {
      failed += 1;
    }
  }
  return { count, sum, failed };
}

// ── Callback flow (payo_*) ───────────────────────────────────────────────────

async function buildCardFor(rentalId: string, chatId: string): Promise<{ text: string; keyboard: any[][] } | { error: string }> {
  let { row, payoutColumnMissing } = await loadRowById(rentalId);
  if (!row) {
    // Boss 2026-10-20: «we should be able to "сверять" already closed rentals»
    // — a stale hub entry (row cleaned up later, or a pre-system closure that
    // still floats in an old hub render) must CONVert, not dead-end: create
    // the сверка on the fly and show the real card. Service/equipment docs
    // answer with a polite refusal instead.
    const heal = await selfHealVerificationRow(rentalId, chatId);
    if (heal.healed) {
      const fresh = await loadRowById(rentalId);
      row = fresh.row;
      payoutColumnMissing = payoutColumnMissing || fresh.payoutColumnMissing;
    } else if (heal.message) {
      return { error: heal.message };
    }
  }
  if (!row) return { error: "Сверка не найдена (аренда закрыта до ввода сверки)." };
  const item = buildPayoutItem(row, chatId);
  if (!item) return { error: "У этой аренды нет выплаты оператору." };
  const usersMap = await loadUsersMap([row.operator_chat_id, item.markedBy]);
  const text = formatPayoutCard({
    item,
    markedByLabel: item.markedBy ? labelFromUsersMap(usersMap, item.markedBy) : null,
    operatorLabel: labelFromUsersMap(usersMap, row.operator_chat_id),
  });
  let keyboard = payoutCardKeyboard(item);
  if (payoutColumnMissing && item.status === "verified") {
    keyboard = [
      [{ text: "ℹ️ SQL не применён", callback_data: encodePayoutCallback("open", rentalId) }],
      ...keyboard,
    ];
  }
  return { text, keyboard };
}

/**
 * Entry point from command-handler.ts (prefix `payo_`). Every tap re-reads
 * the row — the hub never acts on stale cached money.
 */
export async function handleRentalPayoutCallback(params: {
  data: string;
  chatId: string;
  callbackQueryId: string;
  messageId?: number;
}): Promise<boolean> {
  const parsed = parsePayoutCallback(params.data || "");
  if (!parsed) return false;
  const chatId = String(params.chatId);
  const messageId = params.messageId;

  try {
    switch (parsed.action) {
      case "hub": {
        await renderHubInto({ chatId, page: parsed.page, messageId });
        await answerCallback(params.callbackQueryId, "Обновлено 🔄");
        return true;
      }
      case "open": {
        const card = await buildCardFor(parsed.rentalId!, chatId);
        if ("error" in card) {
          await answerCallback(params.callbackQueryId, card.error);
          return true;
        }
        if (messageId) await editTelegramMessageText(chatId, messageId, card.text, card.keyboard);
        else await sendComplexMessage(chatId, card.text, card.keyboard, { parseMode: "HTML", keyboardType: "inline" });
        await answerCallback(params.callbackQueryId, "");
        return true;
      }
      case "mark": {
        const { row } = await loadRowById(parsed.rentalId!);
        const freshItem = row ? buildPayoutItem(row, chatId) : null;
        if (!freshItem) {
          await answerCallback(params.callbackQueryId, row ? "У этой аренды нет выплаты оператору." : "Сверка не найдена.");
          return true;
        }
        const confirmText = formatPayoutConfirm(freshItem);
        if (messageId) await editTelegramMessageText(chatId, messageId, confirmText, payoutConfirmKeyboard(freshItem.rentalId));
        else await sendComplexMessage(chatId, confirmText, payoutConfirmKeyboard(freshItem.rentalId), { parseMode: "HTML", keyboardType: "inline" });
        await answerCallback(params.callbackQueryId, "");
        return true;
      }
      case "yes": {
        const res = await stampRentalPayout({ rentalId: parsed.rentalId!, chatId, mark: true });
        if (!res.ok || !res.item) {
          await answerCallback(params.callbackQueryId, res.error || "Не удалось отметить выплату.");
          return true;
        }
        await answerCallback(params.callbackQueryId, res.alreadyInState ? "Уже отмечено 🏦" : "💸 Записано!");
        const doneText = formatPayoutResult({
          kind: "marked",
          amount: res.item.amount,
          bikeName: res.item.bikeName,
        });
        const kb = [[{ text: "⬅️ К выплатам", callback_data: encodePayoutCallback("hub", 0) }]];
        if (messageId) await editTelegramMessageText(chatId, messageId, doneText, kb);
        else await sendComplexMessage(chatId, doneText, kb, { parseMode: "HTML", keyboardType: "inline" });
        const { row } = await loadRowById(parsed.rentalId!);
        if (row && !res.alreadyInState) await notifyPartiesAboutPayout({ row, actorChatId: chatId, mark: true });
        return true;
      }
      case "undo": {
        const res = await stampRentalPayout({ rentalId: parsed.rentalId!, chatId, mark: false });
        if (!res.ok || !res.item) {
          await answerCallback(params.callbackQueryId, res.error || "Не удалось вернуть.");
          return true;
        }
        await answerCallback(params.callbackQueryId, "↩️ Вернулено в ожидание");
        const doneText = formatPayoutResult({
          kind: "unmarked",
          amount: res.item.amount,
          bikeName: res.item.bikeName,
        });
        const kb = [[{ text: "⬅️ К выплатам", callback_data: encodePayoutCallback("hub", 0) }]];
        if (messageId) await editTelegramMessageText(chatId, messageId, doneText, kb);
        else await sendComplexMessage(chatId, doneText, kb, { parseMode: "HTML", keyboardType: "inline" });
        const { row } = await loadRowById(parsed.rentalId!);
        if (row && !res.alreadyInState) await notifyPartiesAboutPayout({ row, actorChatId: chatId, mark: false });
        return true;
      }
      case "conv": {
        const res = await convertNoRowRental({ rentalId: parsed.rentalId!, actorChatId: chatId });
        if (!res.sent) {
          const reason =
            res.reason === "verification already requested"
              ? "Сверка уже выслана — проверьте сообщения."
              : res.reason === "equipment/service doc — no operator bonus"
                ? "По этой позиции нет комиссии оператора — сверка не нужна."
                : "Не удалось выслать сверку — нет участников или аренда не закрыта.";
          await answerCallback(params.callbackQueryId, reason);
          return true;
        }
        await answerCallback(params.callbackQueryId, "📨 Сверка выслана обеим сторонам!");
        await renderHubInto({ chatId, page: 0, messageId });
        return true;
      }
      case "all": {
        const data = await loadPayoutHubData(chatId);
        if (data.summary.toPay.count === 0) {
          await answerCallback(params.callbackQueryId, "Нечего выплачивать — счётчик «К выплате» пуст.");
          return true;
        }
        const text = formatPayoutAllConfirm(data.summary);
        if (messageId) await editTelegramMessageText(chatId, messageId, text, payoutAllConfirmKeyboard());
        else await sendComplexMessage(chatId, text, payoutAllConfirmKeyboard(), { parseMode: "HTML", keyboardType: "inline" });
        await answerCallback(params.callbackQueryId, "");
        return true;
      }
      case "allyes": {
        const res = await markAllPayouts(chatId);
        if (res.count === 0) {
          await answerCallback(params.callbackQueryId, res.failed > 0 ? "Ничего не записалось — попробуйте ещё раз." : "Нечего выплачивать.");
          return true;
        }
        await answerCallback(params.callbackQueryId, `💸 Записано: ${res.count}`);
        const text = formatPayoutResult({ kind: "markedAll", amount: res.sum, count: res.count });
        const kb = [[{ text: "💰 К выплатам", callback_data: encodePayoutCallback("hub", 0) }]];
        if (messageId) await editTelegramMessageText(chatId, messageId, text, kb);
        else await sendComplexMessage(chatId, text, kb, { parseMode: "HTML", keyboardType: "inline" });
        return true;
      }
      default:
        return false;
    }
  } catch (e: any) {
    logger.warn(`[rental-payout] callback failed (${parsed.action}):`, e);
    await answerCallback(params.callbackQueryId, "Ошибка выплат — попробуйте ещё раз.");
    return true;
  }
}

// ── No-row conversion (old rentals) ──────────────────────────────────────────

/**
 * Old completed rentals have no verification row — the payout hub cannot see
 * their money. This conversion reuses requestRentalVerification 1:1 (row +
 * snapshot + DMs to both parties with the ✅/⚠️ keyboard), only the source
 * label differs so the audit trail shows the hub as the trigger.
 */
export async function convertNoRowRental(params: { rentalId: string; actorChatId: string }): Promise<{ sent: boolean; reason?: string }> {
  return requestRentalVerification({
    rentalId: params.rentalId,
    actorChatId: params.actorChatId,
    source: "payout_hub",
  });
}

// ── Web summaries (server actions layer calls these) ─────────────────────────

export interface PayoutSummaryView {
  toPay: { sum: number; count: number };
  unverified: { sum: number; count: number };
  paid: { sum: number; count: number };
  payoutColumnMissing: boolean;
}

async function summarizeRowsForScope(
  build: (cols: string) => Promise<{ rows: PayoutSourceRow[]; payoutColumnMissing: boolean }>,
  viewerChatId: string,
): Promise<PayoutSummaryView> {
  const { rows, payoutColumnMissing } = await build(COLS_FULL);
  const items: PayoutItem[] = [];
  for (const row of rows) {
    const item = buildPayoutItem(row, viewerChatId);
    if (item) items.push(item);
  }
  const summary = summarizePayoutItems(items);
  return { ...summary, payoutColumnMissing };
}

/** Personal (viewer as operator party) counters, scoped to one crew slug. */
export async function getMyPayoutSummary(slug: string, chatId: string): Promise<PayoutSummaryView> {
  const res = await runPayoutSelect((cols) =>
    supabaseAdmin
      .from("rental_verifications")
      .select(cols)
      .eq("crew_slug", slug)
      .or(`operator_chat_id.eq.${chatId},owner_chat_id.eq.${chatId}`)
      .limit(1000),
  );
  const items: PayoutItem[] = [];
  for (const row of res.rows) {
    const item = buildPayoutItem(row, String(chatId));
    if (item) items.push(item);
  }
  return { ...summarizePayoutItems(items), payoutColumnMissing: res.payoutColumnMissing };
}

/** Crew-wide counters (owner-tier surface: the team-salaries modal). */
export async function getCrewPayoutSummary(slug: string): Promise<PayoutSummaryView> {
  const res = await runPayoutSelect((cols) =>
    supabaseAdmin.from("rental_verifications").select(cols).eq("crew_slug", slug).limit(1000),
  );
  const items: PayoutItem[] = [];
  for (const row of res.rows) {
    // Crew-wide: viewer id is irrelevant — pass an impossible id so
    // `mine` is false and the money still buckets correctly.
    const item = buildPayoutItem(row, "__crew_scope__");
    if (item) items.push(item);
  }
  return { ...summarizePayoutItems(items), payoutColumnMissing: res.payoutColumnMissing };
}
