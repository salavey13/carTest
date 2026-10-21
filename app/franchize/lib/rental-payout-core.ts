// app/franchize/lib/rental-payout-core.ts
//
// Task 107 — VERIFIED PAYOUT, PURE HALF.
// The money half of the verification game: after a rental is verified its
// operator commission becomes REAL money somebody still has to hand over.
// This module buckets that money per viewer, renders the payout hub/card
// texts and defines the `payo_` callback grammar (Telegram buttons).
//
// Money model (deliberately narrow, mirrors the verification snapshot):
//   • the tracked money is the OPERATOR COMMISSION (base + equipment +
//     overprice, or the agreed negotiation split when the pair corrected it)
//     — that is the part that leaves the company till and reaches a human;
//   • the company part (totalCost − commission) stays with the crew — it is
//     never «paid out», so it never enters the buckets;
//   • single-party rows (operator === owner or operator absent) hold the
//     boss's own money — nothing to hand over, they are NOT payout items;
//   • «paid out» is a PER-ROW stamp on the operator commission (payout jsonb
//     column) with an audit log inside the same jsonb.
//
// Buckets per viewer:
//   ✅ К выплате   — verified && !paid   (ready to hand over)
//   ⏳ Не сверено  — not verified yet    (convert via the verify flow)
//   🏦 Выплачено   — verified && paid    (archive, excluded from «к выплате»)
//
// ZERO imports from server modules — unit-testable in isolation. The only
// import is the task-101/106 verification core (same pure layer), reused for
// the money math + escaping so both halves always agree on the numbers.

import {
  escapeVerifyHtml,
  formatRubVerify,
  parseNegotiation,
  splitTotal,
  snapshotSplitOf,
  type RentalVerificationStatus,
  type SplitParts,
} from "./rental-verify-core";

// ── Types ────────────────────────────────────────────────────────────────────

/** One paid-out stamp (inside payout jsonb). */
export interface PayoutMark {
  marked: boolean;
  at?: string;
  by?: string;
  note?: string | null;
}

export interface PayoutLogEntry {
  action: "marked" | "unmarked";
  at: string;
  by: string;
  note?: string | null;
}

/**
 * The payout jsonb column. NULL/absent = never touched (= unpaid).
 * { operator: { marked: true, … }, log: […] } after a mark;
 * { operator: { marked: false, … }, log: […] } after an undo (audit kept).
 */
export interface PayoutInfo {
  operator?: PayoutMark | null;
  log?: PayoutLogEntry[];
}

/** Minimal row shape the payout math needs (rental_verifications row). */
export interface PayoutSourceRow {
  rental_id: string;
  crew_id?: string | null;
  crew_slug?: string | null;
  status: RentalVerificationStatus;
  operator_chat_id?: string | null;
  owner_chat_id?: string | null;
  requested_at?: string | null;
  verified_at?: string | null;
  snapshot?: unknown;
  negotiation?: unknown;
  payout?: unknown;
}

/** One list item of the payout hub. */
export interface PayoutItem {
  rentalId: string;
  crewSlug: string | null;
  bikeName: string;
  status: RentalVerificationStatus;
  /** The tracked money: operator commission (agreed split when corrected). */
  amount: number;
  /** Frozen client price of the rental. */
  totalCost: number;
  /** totalCost − amount — stays with the company, informational only. */
  companyPart: number;
  paid: boolean;
  markedAt: string | null;
  markedBy: string | null;
  verifiedAt: string | null;
  requestedAt: string | null;
  /** dd.MM label of the money date (verified, else requested). */
  dateLabel: string;
  /** The pair corrected the numbers via an accepted deal (task 106). */
  adjusted: boolean;
  /** The viewer is the operator who receives this money. */
  mine: boolean;
  /** An open negotiation proposal is waiting (money not final yet). */
  proposalOpen: boolean;
}

export interface PayoutBucket {
  sum: number;
  count: number;
}

export interface PayoutSummary {
  toPay: PayoutBucket;
  unverified: PayoutBucket;
  paid: PayoutBucket;
}

// ── Safe jsonb parsing ───────────────────────────────────────────────────────

/** payout IS NULL / column not applied yet → never touched. */
export function parsePayoutInfo(raw: unknown): PayoutInfo {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const info: PayoutInfo = {};
  const op = r.operator;
  if (op && typeof op === "object" && !Array.isArray(op)) {
    const m = op as Record<string, unknown>;
    info.operator = {
      marked: m.marked === true,
      at: typeof m.at === "string" ? m.at : undefined,
      by: typeof m.by === "string" ? m.by : undefined,
      note: typeof m.note === "string" ? m.note : null,
    };
  }
  if (Array.isArray(r.log)) info.log = r.log as PayoutLogEntry[];
  return info;
}

/** The commission is paid out only when the stamp explicitly says so. */
export function isCommissionPaid(row: Pick<PayoutSourceRow, "payout">): boolean {
  return parsePayoutInfo(row.payout).operator?.marked === true;
}

// ── Money math ───────────────────────────────────────────────────────────────

/** Commission for a row: agreed (corrected) split total, else the snapshot. */
export function commissionOf(row: Pick<PayoutSourceRow, "snapshot" | "negotiation">): {
  amount: number;
  split: SplitParts;
  adjusted: boolean;
} {
  const snap = (row.snapshot || {}) as Record<string, unknown>;
  const original = snapshotSplitOf(snap as never);
  const nego = row.negotiation !== undefined ? parseNegotiation(row.negotiation) : parseNegotiation(undefined);
  const agreed = nego?.agreed?.split;
  if (agreed) {
    return { amount: splitTotal(agreed), split: agreed, adjusted: true };
  }
  // snapshot.total is the canonical commission; fall back to the parts sum
  // when an old/foreign row lacks it (hand-made rows during backfill).
  const total = Number(snap.total);
  const amount = Number.isFinite(total) && total > 0 ? total : splitTotal(original);
  return { amount, split: original, adjusted: false };
}

/**
 * True when the row carries REAL payout money: an operator commission that
 * must leave the till. Single-party rows (operator === owner, or no operator)
 * are the boss's own money — not a payout.
 */
export function isPayoutRow(row: Pick<PayoutSourceRow, "operator_chat_id" | "owner_chat_id">): boolean {
  const op = row.operator_chat_id ? String(row.operator_chat_id) : null;
  if (!op) return false;
  const ow = row.owner_chat_id ? String(row.owner_chat_id) : null;
  return !ow || ow !== op;
}

/** dd.MM from an ISO timestamp (money-date label; no TZ dance on purpose). */
export function isoToDateLabel(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}` : "—";
}

/** rental_verifications row → hub item (null when not payout money). */
export function buildPayoutItem(row: PayoutSourceRow, viewerChatId: string): PayoutItem | null {
  if (!row || !row.rental_id) return null;
  if (!isPayoutRow(row)) return null;
  const viewer = String(viewerChatId || "");
  const snap = (row.snapshot || {}) as Record<string, unknown>;
  const { amount, adjusted } = commissionOf(row);
  const totalCost = Math.max(0, Number(snap.totalCost) || 0);
  const payout = parsePayoutInfo(row.payout);
  const op = payout.operator;
  const status = row.status;
  const moneyIso = row.verified_at || row.requested_at || null;
  return {
    rentalId: String(row.rental_id),
    crewSlug: (row.crew_slug as string) || null,
    bikeName: String(snap.bikeName || "аренда"),
    status,
    amount,
    totalCost,
    companyPart: Math.max(0, totalCost - amount),
    paid: op?.marked === true,
    markedAt: op?.marked === true ? op.at || null : null,
    markedBy: op?.marked === true ? op.by || null : null,
    verifiedAt: row.verified_at || null,
    requestedAt: row.requested_at || null,
    dateLabel: isoToDateLabel(moneyIso),
    adjusted,
    mine: !!row.operator_chat_id && String(row.operator_chat_id) === viewer,
    proposalOpen: !!negoOpen(row),
  };
}

function negoOpen(row: PayoutSourceRow): boolean {
  if (row.negotiation === undefined) return false;
  try {
    return !!parseNegotiation(row.negotiation)?.open;
  } catch {
    return false;
  }
}

/** Bucket a finished item into the per-viewer counters. */
export function bucketKeyOf(item: Pick<PayoutItem, "status" | "paid">): "toPay" | "unverified" | "paid" {
  if (item.status === "verified") return item.paid ? "paid" : "toPay";
  return "unverified";
}

export function summarizePayoutItems(items: PayoutItem[]): PayoutSummary {
  const summary: PayoutSummary = {
    toPay: { sum: 0, count: 0 },
    unverified: { sum: 0, count: 0 },
    paid: { sum: 0, count: 0 },
  };
  for (const item of items) {
    const key = bucketKeyOf(item);
    summary[key].sum += item.amount;
    summary[key].count += 1;
  }
  return summary;
}

// ── Callback grammar (≤ 64 bytes, unique `payo_` prefix) ─────────────────────
//
//   payo_hub_<page>       — open / refresh the hub (page = list page, 0-based)
//   payo_open_<rentalId>  — one rental's payout card
//   payo_mark_<rentalId>  — «отметить выплаченной?» confirm card
//   payo_yes_<rentalId>   — confirm → stamp payout.operator.marked = true
//   payo_undo_<rentalId>  — stamp back to false (audit kept in the log)
//   payo_conv_<rentalId>  — old rental WITHOUT a verification row → create the
//                           row + DM both parties (requestRentalVerification)
//   payo_all              — «выплатить всё» confirm card (toPay bucket)
//   payo_allyes           — confirm → mark every verified-unpaid item
//
// `payo_` is deliberately NOT `pay_` — that prefix belongs to the /doc
// payment-split callbacks (pay_cash / pay_all_cash / …) and must stay alone.

export type PayoutCallbackAction =
  | "hub"
  | "open"
  | "mark"
  | "yes"
  | "undo"
  | "conv"
  | "all"
  | "allyes";

export interface ParsedPayoutCallback {
  action: PayoutCallbackAction;
  rentalId: string | null;
  page: number;
}

export function encodePayoutCallback(kind: "all" | "allyes"): string;
export function encodePayoutCallback(kind: "hub", page: number): string;
export function encodePayoutCallback(kind: "open" | "mark" | "yes" | "undo" | "conv", rentalId: string): string;
export function encodePayoutCallback(kind: PayoutCallbackAction, arg: number | string = 0): string {
  if (kind === "all") return "payo_all";
  if (kind === "allyes") return "payo_allyes";
  if (kind === "hub") return `payo_hub_${Math.max(0, Math.floor(Number(arg) || 0))}`;
  return `payo_${kind}_${arg}`;
}

/** Returns null for foreign data — the caller must fall through to other routers. */
export function parsePayoutCallback(data: string): ParsedPayoutCallback | null {
  const raw = String(data || "");
  if (!raw.startsWith("payo_")) return null;
  const body = raw.slice("payo_".length);
  const us = body.indexOf("_");
  const head = us < 0 ? body : body.slice(0, us);
  const tail = us < 0 ? "" : body.slice(us + 1).trim();
  if (head === "all" && !tail) return { action: "all", rentalId: null, page: 0 };
  if (head === "allyes" && !tail) return { action: "allyes", rentalId: null, page: 0 };
  if (head === "hub") {
    const page = Math.max(0, Math.floor(Number(tail) || 0));
    return { action: "hub", rentalId: null, page };
  }
  if ((head === "open" || head === "mark" || head === "yes" || head === "undo" || head === "conv") && tail) {
    return { action: head, rentalId: tail, page: 0 };
  }
  return null;
}

// ── Keyboards ────────────────────────────────────────────────────────────────

export interface PayoutButton {
  text: string;
  callback_data: string;
}

export const PAYOUT_PAGE_SIZE = 6;

/** Row of buttons for one hub list entry. */
export function payoutItemButtons(item: PayoutItem): PayoutButton[] {
  const icon = item.status === "verified" ? (item.paid ? "🏦" : "✅") : item.status === "disputed" ? "⚠️" : "⏳";
  const flag = item.paid ? " · выплачено" : item.mine ? "" : "";
  return [
    {
      text: `${icon} ${item.bikeName} · ${formatRubVerify(item.amount)}${flag}`,
      callback_data: encodePayoutCallback("open", item.rentalId),
    },
  ];
}

/** A completed rental without a verification row — a one-tap conversion. */
export interface PayoutConvertible {
  rentalId: string;
  bikeName: string;
  dateLabel: string;
}

export function payoutHubKeyboard(
  items: PayoutItem[],
  params: { page: number; hasMore: boolean; toPayCount: number; convertibles?: PayoutConvertible[] },
): PayoutButton[][] {
  const rows: PayoutButton[][] = [];
  for (const item of items) rows.push(payoutItemButtons(item));
  // Old rentals without a сверка — tap to send the verification request
  // (row + DMs to both parties). Money enters the counters after two ✅.
  for (const conv of params.convertibles || []) {
    rows.push([
      {
        text: `➕ ${conv.bikeName} · ${conv.dateLabel} — выслать сверку`,
        callback_data: encodePayoutCallback("conv", conv.rentalId),
      },
    ]);
  }
  const nav: PayoutButton[] = [];
  if (params.page > 0) nav.push({ text: "◀️ Назад", callback_data: encodePayoutCallback("hub", params.page - 1) });
  if (params.hasMore) nav.push({ text: "Ещё ▶️", callback_data: encodePayoutCallback("hub", params.page + 1) });
  if (nav.length) rows.push(nav);
  if (params.toPayCount > 0) {
    rows.push([{ text: `💸 Выплатить всё (${params.toPayCount})`, callback_data: encodePayoutCallback("all") }]);
  }
  rows.push([{ text: "🔄 Обновить", callback_data: encodePayoutCallback("hub", params.page) }]);
  return rows;
}

export function payoutCardKeyboard(item: PayoutItem): PayoutButton[][] {
  const back: PayoutButton[] = [{ text: "⬅️ К выплатам", callback_data: encodePayoutCallback("hub", 0) }];
  if (item.status === "verified") {
    return item.paid
      ? [[{ text: "↩️ Вернуть в ожидание", callback_data: encodePayoutCallback("undo", item.rentalId) }], back]
      : [[{ text: "💸 Отметить выплаченной", callback_data: encodePayoutCallback("mark", item.rentalId) }], back];
  }
  // Not verified yet — route through the EXISTING verify callbacks so the
  // whole state machine / race hardening / DM chain stays single-funnel.
  return [
    [
      { text: "✅ Подтвердить", callback_data: `vrf_ok_${item.rentalId}` },
      { text: "⚠️ Оспорить", callback_data: `vrf_dis_${item.rentalId}` },
    ],
    back,
  ];
}

export function payoutConfirmKeyboard(rentalId: string): PayoutButton[][] {
  return [
    [
      { text: "Да, выплачено ✅", callback_data: encodePayoutCallback("yes", rentalId) },
      { text: "Нет ⬅️", callback_data: encodePayoutCallback("open", rentalId) },
    ],
  ];
}

export function payoutAllConfirmKeyboard(): PayoutButton[][] {
  return [
    [
      { text: "Да, выплатить всё ✅", callback_data: encodePayoutCallback("allyes") },
      { text: "Нет ⬅️", callback_data: encodePayoutCallback("hub", 0) },
    ],
  ];
}

// ── Formatters (HTML parse mode) ─────────────────────────────────────────────

const bucketLine = (icon: string, label: string, b: PayoutBucket): string =>
  `${icon} ${label}: <b>${formatRubVerify(b.sum)}</b> (${b.count})`;

/**
 * The payout hub text. `scopeLabel` is «Мои комиссии» for an operator view or
 * «Выплаты · <crew slug>» / «Выплаты — все экипажи» for an owner-tier view.
 */
export function formatPayoutHub(params: {
  scopeLabel: string;
  summary: PayoutSummary;
  items: PayoutItem[];
  page: number;
  hasMore: boolean;
  isOwnerTier: boolean;
  /** Friendly note when the payout column is not applied yet. */
  sqlNote?: string | null;
  /** Completed rentals without a verification row (one-tap conversion). */
  convertibles?: PayoutConvertible[];
}): string {
  const { summary: s } = params;
  const lines: string[] = [
    `💰 <b>Выплаты — ${escapeVerifyHtml(params.scopeLabel)}</b>`,
    ``,
    bucketLine("✅", "К выплате (сверено)", s.toPay),
    bucketLine("⏳", "Не сверено", s.unverified),
    bucketLine("🏦", "Выплачено всего", s.paid),
  ];
  if (params.sqlNote) lines.push(``, `ℹ️ ${escapeVerifyHtml(params.sqlNote)}`);
  if (s.toPay.count > 0) {
    lines.push(
      ``,
      params.isOwnerTier
        ? `Это свёрнутые комиссии операторам — деньги, которые экипаж ещё должен раздать.`
        : `Это ваши свёрнутые комиссии — деньги, которые ещё не выплачены.`,
    );
  }
  if (params.items.length > 0) {
    lines.push(``, `👉 <b>Аренды</b> (стр. ${params.page + 1}):`);
    for (const item of params.items) {
      const icon = item.status === "verified" ? (item.paid ? "🏦" : "✅") : item.status === "disputed" ? "⚠️" : "⏳";
      const who = item.mine ? "" : " · оператору";
      const adj = item.adjusted ? " · скорректирована" : "";
      const paidMark = item.paid ? " · 💸 выплачено" : "";
      lines.push(
        `• ${icon} ${escapeVerifyHtml(item.bikeName)} — ${formatRubVerify(item.amount)}${who}${adj}${paidMark} · ${item.dateLabel}`,
      );
    }
  } else {
    lines.push(
      ``,
      s.toPay.count + s.unverified.count + s.paid.count === 0
        ? `Пока нет свёрок с деньгами. Закройте аренду — сверка появится автоматически.`
        : `На этой странице аренд нет — листайте дальше.`,
    );
  }
  if ((params.convertibles || []).length > 0) {
    lines.push(
      ``,
      `➕ <b>Без сверки</b> — деньги пока не видны:`,
    );
    for (const conv of params.convertibles || []) {
      lines.push(`• ${escapeVerifyHtml(conv.bikeName)} · ${conv.dateLabel}`);
    }
    lines.push(`Тапните аренду ниже, чтобы выслать сверку обеим сторонам.`);
  }
  lines.push(``, `Тапайте аренду, чтобы отметить выплату или сверить расчёт.`);
  return lines.join("\n");
}

/** One rental's payout card. */
export function formatPayoutCard(params: {
  item: PayoutItem;
  /** @username label of who stamped the payout (when paid). */
  markedByLabel?: string | null;
  operatorLabel?: string | null;
}): string {
  const item = params.item;
  const statusLine =
    item.status === "verified"
      ? item.paid
        ? `🏦 <b>Выплачено</b>${params.markedByLabel ? ` — отметил ${escapeVerifyHtml(params.markedByLabel)}` : ""}`
        : `✅ <b>Сверка подтверждена</b> — деньги к выплате`
      : item.status === "disputed"
        ? `⚠️ <b>Спор</b> — расчёт не свёрнут, деньги ждать рано`
        : `⏳ <b>Сверка не завершена</b>${item.proposalOpen ? " · идёт переговоры" : ""}`;

  const lines: string[] = [
    `💰 <b>Выплата по аренде</b> — ${escapeVerifyHtml(item.bikeName)}`,
  ];
  if (item.crewSlug) lines.push(`👥 Экипаж: ${escapeVerifyHtml(item.crewSlug)}`);
  lines.push(
    ``,
    statusLine,
    `💵 Комиссия оператора${params.operatorLabel ? ` (${escapeVerifyHtml(params.operatorLabel)})` : ""}: <b>${formatRubVerify(item.amount)}</b>`,
    `🧾 Сумма аренды (клиент): ${formatRubVerify(item.totalCost)}`,
    `🏢 Остаток экипажу: ${formatRubVerify(item.companyPart)}`,
  );
  if (item.adjusted) lines.push(`⚖️ Числа скорректированы сделкой по сверке`);
  if (item.paid && item.markedAt) lines.push(`💸 Отмечено выплаченным: ${isoToDateLabel(item.markedAt)}`);
  if (item.status === "verified" && !item.paid) {
    lines.push(``, `Деньги переданы? Жмите «💸 Отметить выплаченной» — аренда уйдёт из «К выплате».`);
  }
  if (item.status === "verified" && item.paid) {
    lines.push(``, `Ошиблись? «↩️ Вернуть в ожидание» вернёт сумму в счётчик (след остаётся в журнале).`);
  }
  if (item.status !== "verified") {
    lines.push(``, `Сначала завершите сверку — после двух ✅ деньги попадут в «К выплате».`);
  }
  return lines.join("\n");
}

/** «Отметить выплату?» confirm card. */
export function formatPayoutConfirm(item: PayoutItem): string {
  return [
    `💸 <b>Отметить выплату?</b>`,
    ``,
    `🛵 ${escapeVerifyHtml(item.bikeName)} · ${item.dateLabel}`,
    `💵 Комиссия оператора: <b>${formatRubVerify(item.amount)}</b>`,
    ``,
    `После подтверждения сумма уйдёт из «✅ К выплате» в «🏦 Выплачено».`,
  ].join("\n");
}

/** «Выплатить всё?» confirm card. */
export function formatPayoutAllConfirm(summary: PayoutSummary): string {
  return [
    `💸 <b>Отметить ВСЁ выплаченным?</b>`,
    ``,
    `✅ К выплате: <b>${formatRubVerify(summary.toPay.sum)}</b> (${summary.toPay.count} аренд)`,
    ``,
    `Все свёрнутые аренды уйдут в «🏦 Выплачено» одной кнопкой — используйте после реальной передачи денег.`,
  ].join("\n");
}

/** Result text after mark / unmark / mark-all. */
export function formatPayoutResult(params: {
  kind: "marked" | "unmarked" | "markedAll";
  amount: number;
  count?: number;
  bikeName?: string;
}): string {
  if (params.kind === "markedAll") {
    return [
      `🏦 <b>Готово</b>`,
      ``,
      `💸 Выплачено отмечено: <b>${formatRubVerify(params.amount)}</b> (${params.count || 0} аренд).`,
      `Счётчик «✅ К выплате» обнулился — до следующей сверки.`,
    ].join("\n");
  }
  const bike = escapeVerifyHtml(params.bikeName || "аренда");
  return params.kind === "marked"
    ? [
        `🏦 <b>Выплата записана</b>`,
        ``,
        `🛵 ${bike} · <b>${formatRubVerify(params.amount)}</b>`,
        `Аренда ушла из «К выплате» в «Выплачено».`,
      ].join("\n")
    : [
        `↩️ <b>Возвращено в ожидание</b>`,
        ``,
        `🛵 ${bike} · <b>${formatRubVerify(params.amount)}</b>`,
        `Снова в «✅ К выплате» — до следующей отметки.`,
      ].join("\n");
}

/** DM to the OTHER party when a payout is stamped / unstamped. */
export function formatPayoutNotifyText(params: {
  kind: "marked" | "unmarked";
  amount: number;
  bikeName: string;
  actorLabel: string;
}): string {
  const bike = escapeVerifyHtml(params.bikeName || "аренда");
  const actor = escapeVerifyHtml(params.actorLabel);
  return params.kind === "marked"
    ? [
        `💸 <b>Выплата по аренде</b>`,
        ``,
        `🛵 ${bike} · <b>${formatRubVerify(params.amount)}</b>`,
        `${actor} отметил выплату — деньги отправлены. Приятного!`,
      ].join("\n")
    : [
        `↩️ <b>Выплата возвращена в ожидание</b>`,
        ``,
        `🛵 ${bike} · <b>${formatRubVerify(params.amount)}</b>`,
        `${actor} вернул отметку выплаты — сумма снова в счётчике «К выплате».`,
      ].join("\n");
}

// ── Task 117: КОПИЛКА КОМАНДЫ (crew-wide payout ledger, pure half) ──────────
//
// Boss: «в профиле владельца можно помечать подтверждённые как выплаченные,
// с соответствующими записями в копилке команды». The per-row payout stamp
// (payout jsonb → log[]) IS the ledger entry — this view aggregates it
// crew-wide: per-operator piggy bank lines + the actionable «к выплате»
// list + the paid archive. Marking itself goes through stampRentalPayout
// (canMarkPayout enforces operator-party / owner-tier rights server-side).

/** One entry of the crew payout ledger (a verified commission row). */
export interface CrewPayoutLedgerEntry {
  rentalId: string;
  bikeName: string;
  /** The tracked money: agreed split when corrected, else snapshot total. */
  amount: number;
  operatorChatId: string | null;
  operatorLabel: string;
  dateLabel: string;
  /** ISO of the payout stamp (paid rows) — null for unpaid. */
  markedAt: string | null;
  markedByLabel: string | null;
  adjusted: boolean;
}

/** Per-operator piggy bank (the game score per human). */
export interface CrewOperatorMoney {
  chatId: string;
  label: string;
  /** Verified commissions total (счёт). */
  verifiedSum: number;
  verifiedCount: number;
  /** Already stamped paid. */
  paidSum: number;
  paidCount: number;
  /** Verified but not yet paid (к выплате). */
  toPaySum: number;
  toPayCount: number;
}

export interface CrewPayoutLedgerView {
  crewSlug: string | null;
  totals: {
    toPay: PayoutBucket;
    paid: PayoutBucket;
    unverified: PayoutBucket;
  };
  operators: CrewOperatorMoney[];
  /** verified && !paid — the owner marks these from the profile. */
  unpaid: CrewPayoutLedgerEntry[];
  /** verified && paid — the archive (log visually newest-first). */
  paidLog: CrewPayoutLedgerEntry[];
  payoutColumnMissing: boolean;
}

/**
 * Aggregate crew-wide verification rows into the ledger view. `labelOf`
 * renders @username/full-name labels (server half feeds the users map);
 * rows missing money (non-payout rows) are skipped exactly like the hub.
 */
export function buildCrewPayoutLedger(
  rows: PayoutSourceRow[],
  params: { crewSlug: string | null; labelOf: (chatId: string | null | undefined) => string; payoutColumnMissing?: boolean },
): CrewPayoutLedgerView {
  const view: CrewPayoutLedgerView = {
    crewSlug: params.crewSlug,
    totals: { toPay: { sum: 0, count: 0 }, paid: { sum: 0, count: 0 }, unverified: { sum: 0, count: 0 } },
    operators: [],
    unpaid: [],
    paidLog: [],
    payoutColumnMissing: params.payoutColumnMissing === true,
  };
  const byOperator = new Map<string, CrewOperatorMoney>();

  for (const row of rows) {
    if (!row || !row.rental_id) continue;
    if (!isPayoutRow(row)) continue; // boss's own cash never enters the ledger
    const snap = (row.snapshot || {}) as Record<string, unknown>;
    const { amount, adjusted } = commissionOf(row);
    const opChatId = row.operator_chat_id ? String(row.operator_chat_id) : null;
    const opLabel = params.labelOf(opChatId);
    const payout = parsePayoutInfo(row.payout);
    const paid = payout.operator?.marked === true;
    const moneyIso = row.verified_at || row.requested_at || null;
    const entry: CrewPayoutLedgerEntry = {
      rentalId: String(row.rental_id),
      bikeName: String(snap.bikeName || "аренда"),
      amount,
      operatorChatId: opChatId,
      operatorLabel: opLabel,
      dateLabel: isoToDateLabel(moneyIso),
      markedAt: paid ? payout.operator?.at || null : null,
      markedByLabel: paid ? params.labelOf(payout.operator?.by) : null,
      adjusted,
    };

    if (row.status === "verified") {
      const bucket = paid ? view.totals.paid : view.totals.toPay;
      bucket.sum += amount;
      bucket.count += 1;
      if (opChatId) {
        let m = byOperator.get(opChatId);
        if (!m) {
          m = { chatId: opChatId, label: opLabel, verifiedSum: 0, verifiedCount: 0, paidSum: 0, paidCount: 0, toPaySum: 0, toPayCount: 0 };
          byOperator.set(opChatId, m);
        }
        m.verifiedSum += amount;
        m.verifiedCount += 1;
        if (paid) {
          m.paidSum += amount;
          m.paidCount += 1;
        } else {
          m.toPaySum += amount;
          m.toPayCount += 1;
        }
      }
      if (paid) view.paidLog.push(entry);
      else view.unpaid.push(entry);
    } else {
      // Not verified yet — money not real; show the volume for context only.
      view.totals.unverified.sum += amount;
      view.totals.unverified.count += 1;
    }
  }

  // Biggest piggy bank first; archives newest-stamp-first.
  view.operators = [...byOperator.values()].sort((a, b) => b.verifiedSum - a.verifiedSum);
  const stampTs = (e: CrewPayoutLedgerEntry) => Date.parse(e.markedAt || "") || 0;
  view.paidLog.sort((a, b) => stampTs(b) - stampTs(a));
  view.paidLog = view.paidLog.slice(0, 50);
  const moneyTs = (e: CrewPayoutLedgerEntry) => Date.parse(e.dateLabel.split(".").reverse().join("-")) || 0;
  view.unpaid.sort((a, b) => moneyTs(b) - moneyTs(a));
  return view;
}
