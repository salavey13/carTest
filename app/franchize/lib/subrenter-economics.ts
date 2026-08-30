// app/franchize/lib/subrenter-economics.ts
// ──────────────────────────────────────────────────────────────────────────
// Pure helpers for the subrenter revenue split (iter18).
//
// Subrented bikes carry the real owner's Telegram chat id in
// cars.specs.subrenter_chat_id. Revenue of such bikes is split 50/50 between
// the crew (vip-bike) and the partner — BUT the equipment part of the rental
// is NOT split: helmets/gloves/etc. belong to the crew, so the partner's cut
// is 50% of (total − equipment part).
//
// iter25: the equipment part now prefers the PERSISTED split
// (metadata.equipment_price — the amount actually charged at creation) and
// falls back to the unit-price estimate for legacy rows. The unit-price
// table lives in rental-price-split.ts — ONE table for analytics, CSV, salary
// and partner payouts.
//
// Zero dependencies — safe to import from client components AND server actions
// (the analytics KPI cards, the profile monthly panels and the activation
// notification all read the SAME math from here).

import {
  EQUIPMENT_UNIT_PRICES_RUB,
  EQUIPMENT_UNIT_PRICE_FALLBACK_RUB,
  getRentalEquipmentPart,
} from "./rental-price-split";

/** Default owner share of the bike part (subrent contract §5.5). */
export const SUBRENTER_SHARE_PCT = 50;

/**
 * Operator equipment price list (₽ per unit) — re-exported from the single
 * source of truth (rental-price-split.ts). Charger is a freebie bundled
 * with the bike.
 */
export const SUBRENTER_EQUIPMENT_UNIT_PRICES: Record<string, number> = EQUIPMENT_UNIT_PRICES_RUB;

/** Fallback unit price for unknown equipment keys (new gear types). */
export const SUBRENTER_EQUIPMENT_PRICE_FALLBACK = EQUIPMENT_UNIT_PRICE_FALLBACK_RUB;

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Equipment revenue part of a rental (₽). PERSISTED split first
 * (metadata.equipment_price — the actually charged amount, iter25+),
 * gift-aware unit-price estimate for legacy rows.
 *
 * Values are quantities (helmets: 2) or booleans (gloves: true).
 * GIFT AWARENESS: an item flagged as a gift (`${key}_gift: true` inside the
 * same equipment object — the way operators mark «перчатки в подарок») brings
 * ZERO revenue: the crew did not charge for it, so neither the equipment
 * counter nor the subrenter split may count it.
 */
export function getEquipmentCostPart(
  metadata: Record<string, unknown> | null | undefined,
): number {
  return getRentalEquipmentPart(metadata);
}

/** Bike-only revenue part: total minus the equipment part, floored at 0. */
export function getBikeRevenuePart(
  totalCost: number | string | null | undefined,
  equipmentPart: number,
): number {
  const total = toFiniteNumber(totalCost);
  return Math.max(0, total - Math.max(0, toFiniteNumber(equipmentPart)));
}

/**
 * Partner's cut of a rental: `pct`% of the BIKE part (equipment excluded —
 * it is not split with the subrenter). Rounded to whole ₽.
 */
export function getSubrenterCut(
  totalCost: number | string | null | undefined,
  equipmentPart: number,
  pct: number = SUBRENTER_SHARE_PCT,
): number {
  const share = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : SUBRENTER_SHARE_PCT;
  const bikePart = getBikeRevenuePart(totalCost, equipmentPart);
  return Math.round((bikePart * share) / 100);
}

/** Crew's own part of a subrented-bike rental (100% of equipment + (100−pct)% of the bike part). */
export function getCrewPart(
  totalCost: number | string | null | undefined,
  equipmentPart: number,
  pct: number = SUBRENTER_SHARE_PCT,
): number {
  const total = toFiniteNumber(totalCost);
  return Math.max(0, total - getSubrenterCut(total, equipmentPart, pct));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatRub(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export interface SubrenterActivationMessageInput {
  bikeTitle: string;
  renterName?: string | null;
  totalRub: number | string | null | undefined;
  equipmentRub: number;
  cutRub: number;
  shortRentalId?: string;
  startDate?: string | null;
  endDate?: string | null;
  crewName?: string | null;
}

/**
 * Immediate-satisfaction TG message for the partner: «your bike is out with a
 * renter right now, and here is your cut». Equipment is explicitly excluded.
 */
export function buildSubrenterActivationMessage(
  input: SubrenterActivationMessageInput,
): string {
  const bikePart = getBikeRevenuePart(input.totalRub, input.equipmentRub);
  const lines: string[] = [
    "🏍 <b>Ваш байк в аренде</b>",
    "",
    `Байк: <b>${escapeHtml(input.bikeTitle || "байк")}</b>`,
  ];
  if (input.renterName) lines.push(`Арендатор: ${escapeHtml(input.renterName)}`);
  if (input.startDate) {
    const end = input.endDate ? ` → ${formatRuDate(input.endDate)}` : "";
    lines.push(`Период: ${formatRuDate(input.startDate)}${end}`);
  }
  lines.push(
    "",
    `Сумма аренды: <b>${formatRub(toFiniteNumber(input.totalRub))}</b>`,
  );
  if (input.equipmentRub > 0) {
    lines.push(`Экипировка (не делится): ${formatRub(input.equipmentRub)}`);
  }
  lines.push(
    `Ваша доля (50% от аренды байка ${formatRub(bikePart)}): <b>${formatRub(input.cutRub)}</b>`,
  );
  if (input.shortRentalId) lines.push("", `ID аренды: <code>${escapeHtml(input.shortRentalId)}</code>`);
  if (input.crewName) lines.push(`Экипаж: ${escapeHtml(input.crewName)}`);
  return lines.join("\n");
}

function formatRuDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  } catch {
    return iso;
  }
}

// ── Monthly aggregation (profile panels) ─────────────────────────────────────

export interface SubrenterMonthRentalRow {
  rentalId: string;
  bikeId: string;
  bikeLabel: string;
  status: string;
  totalCost: number;
  equipmentRub: number;
  bikePartRub: number;
  cutRub: number;
  startedAt: string | null;
  endedAt: string | null;
  docLink?: string;
}

export interface SubrenterMonthSummary {
  month: string;
  rentals: SubrenterMonthRentalRow[];
  rentalCount: number;
  totalRub: number;
  equipmentRub: number;
  bikePartRub: number;
  cutRub: number;
}

/** Normalize a "YYYY-MM" month key; returns "" for garbage input. */
export function normalizeMonthKey(month: string | null | undefined): string {
  if (typeof month !== "string") return "";
  const m = month.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return "";
  const monthNum = Number(m[2]);
  if (monthNum < 1 || monthNum > 12) return "";
  return `${m[1]}-${m[2]}`;
}

/** Current MSK month as "YYYY-MM". */
export function currentMskMonthKey(now: Date = new Date()): string {
  const msk = new Date(now.getTime() + 3 * 3600 * 1000);
  return `${msk.getUTCFullYear()}-${String(msk.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Shift a "YYYY-MM" key by delta months (may cross year boundaries). */
export function shiftMonthKey(month: string, delta: number): string {
  const norm = normalizeMonthKey(month) || currentMskMonthKey();
  const [y, m] = norm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * "2026-08" → "Август 2026" — locale-independent (no Intl/Date needed), used
 * by the shared MonthPickerBar (iter21). Invalid keys → "Месяц".
 */
export function monthKeyToLabelRu(monthKey: string | null | undefined): string {
  const norm = normalizeMonthKey(monthKey);
  if (!norm) return "Месяц";
  const [y, m] = norm.split("-").map(Number);
  const full = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ][m - 1];
  return `${full} ${y}`;
}

/**
 * Aggregate a set of rental rows into a month summary. Rows are expected to
 * be ALREADY scoped to the partner's bikes and the requested month (query
 * filters); this function only does the money math and the totals.
 */
export function summarizeSubrenterMonth(
  month: string,
  rows: Array<{
    rentalId: string;
    bikeId: string;
    bikeLabel: string;
    status: string;
    totalCost: number | string | null | undefined;
    agreedStartDate: string | null;
    agreedEndDate: string | null;
    requestedStartDate?: string | null;
    metadata?: Record<string, unknown> | null;
  }>,
  opts?: { docLinkBase?: string; pct?: number },
): SubrenterMonthSummary {
  const pct = opts?.pct ?? SUBRENTER_SHARE_PCT;
  const out: SubrenterMonthRentalRow[] = rows.map((r) => {
    const equipmentRub = getEquipmentCostPart(r.metadata);
    const total = toFiniteNumber(r.totalCost);
    const bikePartRub = getBikeRevenuePart(total, equipmentRub);
    return {
      rentalId: r.rentalId,
      bikeId: r.bikeId,
      bikeLabel: r.bikeLabel || "Байк",
      status: r.status,
      totalCost: total,
      equipmentRub,
      bikePartRub,
      cutRub: getSubrenterCut(total, equipmentRub, pct),
      startedAt: r.agreedStartDate ?? r.requestedStartDate ?? null,
      endedAt: r.agreedEndDate ?? null,
      docLink: opts?.docLinkBase ? `${opts.docLinkBase}/${r.rentalId}` : undefined,
    };
  });
  return {
    month: normalizeMonthKey(month) || currentMskMonthKey(),
    rentals: out,
    rentalCount: out.length,
    totalRub: out.reduce((s, r) => s + r.totalCost, 0),
    equipmentRub: out.reduce((s, r) => s + r.equipmentRub, 0),
    bikePartRub: out.reduce((s, r) => s + r.bikePartRub, 0),
    cutRub: out.reduce((s, r) => s + r.cutRub, 0),
  };
}

// ── Achievement notification message (bonus task) ────────────────────────────

export interface AchievementMessageInput {
  crewName: string;
  achieverName: string;
  achieverUsername?: string | null;
  achievementTitle: string;
  achievementDescription?: string | null;
  recipientRole: "achiever" | "owner" | "admin";
}

/** TG message for an unlocked achievement, by recipient role. */
export function buildAchievementNotificationMessage(
  input: AchievementMessageInput,
): string {
  const who = input.achieverUsername
    ? `@${input.achieverUsername}`
    : input.achieverName || "участник";
  if (input.recipientRole === "achiever") {
    const lines = [
      "🏅 <b>Достижение получено!</b>",
      "",
      `«${escapeHtml(input.achievementTitle)}»`,
    ];
    if (input.achievementDescription) {
      lines.push("", escapeHtml(input.achievementDescription));
    }
    lines.push("", `Экипаж: ${escapeHtml(input.crewName)}`, "Так держать! 🔥");
    return lines.join("\n");
  }
  const lines = [
    "🏅 <b>Новое достижение в экипаже</b>",
    "",
    `${escapeHtml(who)} получил «${escapeHtml(input.achievementTitle)}»`,
  ];
  if (input.achievementDescription) {
    lines.push("", escapeHtml(input.achievementDescription));
  }
  lines.push("", `Экипаж: ${escapeHtml(input.crewName)}`);
  return lines.join("\n");
}
