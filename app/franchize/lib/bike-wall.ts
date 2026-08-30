// /app/franchize/lib/bike-wall.ts
// ─────────────────────────────────────────────────────────────────────────────
// iter28 — «стена мото»: pure, dependency-free logic for the bike story pages.
//
// A bike's wall is a VK-style chronological feed of everything that happened
// to one bike: rentals (with start/end photos from rental-photos storage),
// odometer progression, money earned, equipment handed out.
//
// Pure by design: NO supabase, NO React — so tests can import it directly and
// the server action / client components share one source of truth.
//
// Money rule (iter27, applies here too): CANCELLED rentals never count into
// earnings / counters. They still render on the wall (crossed out) because the
// story of a bike includes aborted deals — but they contribute ₽0.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";

// ── Types (mirrored by the server action's response) ─────────────────────────

export type RentalWallStatus =
  | "pending_confirmation"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled"
  | "expired"
  | string;

export interface WallPhoto {
  photoId: string;
  /** "start" = фото ДО, "end" = фото ПОСЛЕ */
  photoType: string;
  url: string;
  width: number | null;
  height: number | null;
  takenAt: string | null;
  uploaderRole: string | null;
}

/** discriminator: обычная аренда | сервисная работа (metadata.bike link) */
export type WallFeedKind = "rental" | "service";

/** Service work event — a rentals row whose vehicle_id is a SERVICE price-list
 *  item and whose metadata.bike points at THIS bike (source="service_work"). */
export interface ServiceWallEvent {
  rentalId: string;
  serviceName: string;
  cost: number;
  /** metadata.performed_at (fallback agreed_start_date/created_at) */
  performedAt: string | null;
  /** who logged the work (created_by_operator_chat_id → users lookup) */
  masterName: string | null;
}

export interface WallFeedItem {
  kind: WallFeedKind;
  rentalId: string;
  status: RentalWallStatus;
  renterName: string;
  renterPhone: string | null;
  start: string | null;
  end: string | null;
  createdAt: string | null;
  /** ₽ total (0/null → «цена не указана») */
  totalCost: number;
  depositAmount: number;
  depositMethod: string | null;
  depositReturned: boolean;
  odometerBefore: number | null;
  odometerAfter: number | null;
  /** positive deltas only — garbage rows (7899 → 2562) contribute 0 */
  odometerDelta: number;
  /** e.g. [{ label: "шлем", count: 2 }] */
  equipment: Array<{ label: string; count: number }>;
  partnerRub: number;
  companyRub: number;
  operatorChatId: string | null;
  operatorName: string | null;
  photos: WallPhoto[];
  /** «активна сейчас» (for wall ordering badges), computed server-side */
  isNow: boolean;
  /** only for kind="service" */
  service?: ServiceWallEvent;
}

export interface BikeWallStats {
  /** completed + active + confirmed + pending (cancelled excluded) */
  earnedTotal: number;
  /** MSK-calendar-month slice of earnedTotal */
  earnedThisMonth: number;
  completedCount: number;
  activeCount: number;
  cancelledCount: number;
  totalCount: number;
  /** sum of ceil(end − start) over non-cancelled rentals, min 1 per rental */
  daysInRent: number;
  avgCheck: number;
  /** last known odometer_after (max, garbage-tolerant) */
  odometerLatest: number | null;
  /** sum of POSITIVE deltas only */
  distanceTotal: number;
  lastRentalAt: string | null;
  /** service work logged against this bike (metadata.bike linkage) */
  serviceCount: number;
  /** ₽ spent on service work — shown separately from earnings */
  serviceTotal: number;
  lastServiceAt: string | null;
}

export interface BikeWallSummary {
  bikeId: string;
  label: string;
  image: string | null;
  gallery: string[];
  dailyPrice: number | null;
  year: string | null;
  plate: string | null;
  engineType: string | null;
  vin: string | null;
  isPartnerBike: boolean;
  stats: BikeWallStats;
  /** any non-cancelled rental with status active/confirmed right now */
  onRentNow: boolean;
}

// ── Money / number formatting ─────────────────────────────────────────────────

const NBSP = "\u00A0";

export function formatMoney(rub: number | null | undefined): string {
  const n = Math.round(Number(rub) || 0);
  return `${n.toLocaleString("ru-RU").replace(/\u00A0/g, NBSP)}${NBSP}₽`;
}

export function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km <= 0) return "—";
  return `${Math.round(km).toLocaleString("ru-RU").replace(/\u00A0/g, NBSP)}${NBSP}км`;
}

export function formatOdometer(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return "—";
  return `${Math.round(km).toLocaleString("ru-RU").replace(/\u00A0/g, NBSP)}${NBSP}км`;
}

// ── Status meta ───────────────────────────────────────────────────────────────

export type WallStatusTone = "positive" | "accent" | "warning" | "muted" | "danger";

export function statusMeta(status: RentalWallStatus): { label: string; tone: WallStatusTone } {
  switch (status) {
    case "active":
      return { label: "В аренде", tone: "accent" };
    case "confirmed":
      return { label: "Подтверждена", tone: "warning" };
    case "pending_confirmation":
      return { label: "Ожидает", tone: "warning" };
    case "completed":
      return { label: "Завершена", tone: "positive" };
    case "cancelled":
      return { label: "Отменена", tone: "muted" };
    case "expired":
      return { label: "Просрочена", tone: "danger" };
    default:
      return { label: String(status || "—"), tone: "muted" };
  }
}

/** Date-aware status like the rentals list: past-due active → expired. */
export function effectiveStatus(
  status: RentalWallStatus,
  agreedEndDate: string | null | undefined,
  nowMs: number = Date.now(),
): RentalWallStatus {
  if ((status === "active" || status === "confirmed") && agreedEndDate) {
    const endTs = Date.parse(agreedEndDate);
    // 24h grace — same constant as profile-actions / actions-runtime.
    if (!Number.isNaN(endTs) && endTs + 24 * 60 * 60 * 1000 < nowMs) return "expired";
  }
  return status;
}

// ── Rental math ───────────────────────────────────────────────────────────────

/** Days in rent for one rental: ceil(end − start), min 1 when any date exists. */
export function rentalDays(startIso: string | null | undefined, endIso: string | null | undefined): number {
  if (!startIso) return 0;
  const s = Date.parse(startIso);
  const e = endIso ? Date.parse(endIso) : Number.NaN;
  if (Number.isNaN(s)) return 0;
  if (Number.isNaN(e)) return 1;
  const days = Math.ceil((e - s) / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

/** Positive odometer delta or 0 (garbage/decreasing rows contribute nothing). */
export function odometerDelta(before: unknown, after: unknown): number {
  const b = Number(before);
  const a = Number(after);
  if (!Number.isFinite(b) || !Number.isFinite(a)) return 0;
  const d = a - b;
  return d > 0 ? Math.round(d) : 0;
}

const EQUIPMENT_LABELS: Record<string, string> = {
  helmets: "шлем",
  gloves: "перчатки",
  jacket: "куртка",
  pants: "штаны",
  boots: "боты",
  charger: "зарядка",
  bag: "сумка",
  backpack: "рюкзак",
  net: "сетка",
  phone_holder: "держатель",
};

/**
 * Equipment chips from rentals.metadata.equipment.
 * Shape on live rows: { helmets: 0|2, gloves: 0|1, jacket: true|false, ... }
 * — numbers are unit counts, booleans count as 1, 0/false skip.
 */
export function equipmentChips(equipment: unknown): Array<{ label: string; count: number }> {
  if (!equipment || typeof equipment !== "object") return [];
  const out: Array<{ label: string; count: number }> = [];
  for (const [key, raw] of Object.entries(equipment as Record<string, unknown>)) {
    let count = 0;
    if (typeof raw === "number" && Number.isFinite(raw)) count = Math.floor(raw);
    else if (typeof raw === "boolean") count = raw ? 1 : 0;
    else if (typeof raw === "string") {
      const n = Number(raw);
      count = raw === "true" ? 1 : raw === "false" ? 0 : Number.isFinite(n) ? Math.floor(n) : 0;
    }
    if (count <= 0) continue;
    out.push({ label: EQUIPMENT_LABELS[key] || key, count });
  }
  // stable, readable order: biggest counts first
  return out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
}

// ── Wall stats ────────────────────────────────────────────────────────────────

/** Statuses that earn money. Cancelled / expired-limbo rows never do. */
const EARNING_STATUSES = new Set(["completed", "active", "confirmed", "pending_confirmation"]);

/** MSK calendar month key ("2026-08") of an ISO date — the app tz convention. */
export function mskMonthKey(iso: string | null | undefined, nowMs: number = Date.now()): string {
  const ts = Date.parse(iso || "");
  const t = Number.isNaN(ts) ? nowMs : ts;
  const d = new Date(t + 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface StatsInputRow {
  status: RentalWallStatus;
  totalCost: number | null | undefined;
  start: string | null | undefined;
  end: string | null | undefined;
  odometerBefore: unknown;
  odometerAfter: unknown;
  createdAt?: string | null | undefined;
}

/** Service stats input — one row per service-work rental (metadata.bike link). */
export interface ServiceStatsInputRow {
  cost: number | null | undefined;
  performedAt: string | null | undefined;
}

export function computeBikeStats(
  rows: StatsInputRow[],
  nowMs: number = Date.now(),
  serviceRows: ServiceStatsInputRow[] = [],
): BikeWallStats {
  const stats: BikeWallStats = {
    earnedTotal: 0,
    earnedThisMonth: 0,
    completedCount: 0,
    activeCount: 0,
    cancelledCount: 0,
    totalCount: rows.length,
    daysInRent: 0,
    avgCheck: 0,
    odometerLatest: null,
    distanceTotal: 0,
    lastRentalAt: null,
    serviceCount: 0,
    serviceTotal: 0,
    lastServiceAt: null,
  };

  const currentMonth = mskMonthKey(null, nowMs);
  let earnedCount = 0;
  let latestOdo: number | null = null;

  for (const r of rows) {
    const eff = effectiveStatus(r.status, r.end, nowMs);
    if (eff === "cancelled") {
      stats.cancelledCount++;
      continue;
    }
    if (eff === "completed") stats.completedCount++;
    if (eff === "active" || eff === "confirmed" || eff === "pending_confirmation") stats.activeCount++;

    const cost = Math.round(Number(r.totalCost) || 0);
    if (EARNING_STATUSES.has(eff) && cost > 0) {
      stats.earnedTotal += cost;
      earnedCount++;
      if (mskMonthKey(r.start || r.createdAt, nowMs) === currentMonth) {
        stats.earnedThisMonth += cost;
      }
    }
    stats.daysInRent += rentalDays(r.start, r.end);

    const after = Number(r.odometerAfter);
    if (Number.isFinite(after) && after > 0) {
      stats.distanceTotal += odometerDelta(r.odometerBefore, r.odometerAfter);
      if (latestOdo == null || after > latestOdo) latestOdo = after;
    }
  }

  stats.avgCheck = earnedCount > 0 ? Math.round(stats.earnedTotal / earnedCount) : 0;
  stats.odometerLatest = latestOdo;

  const lastTs = rows.reduce<number>((acc, r) => {
    const t = Date.parse(r.start || r.createdAt || "");
    return Number.isNaN(t) ? acc : Math.max(acc, t);
  }, 0);
  stats.lastRentalAt = lastTs > 0 ? new Date(lastTs).toISOString() : null;

  // Service work: cost + recency (never mixed into rental earnings).
  let lastSvcTs = 0;
  for (const s of serviceRows) {
    stats.serviceCount++;
    stats.serviceTotal += Math.round(Number(s.cost) || 0);
    const t = Date.parse(s.performedAt || "");
    if (!Number.isNaN(t) && t > lastSvcTs) lastSvcTs = t;
  }
  stats.lastServiceAt = lastSvcTs > 0 ? new Date(lastSvcTs).toISOString() : null;

  return stats;
}

// ── Wall ordering / grouping ──────────────────────────────────────────────────

/** Wall sort key: «right now» first, then newest start (fallback createdAt), then id.
 *  For service events the caller passes performedAt as `start`. */
export function wallSortKey(item: Pick<WallFeedItem, "isNow" | "start" | "createdAt" | "rentalId">): number {
  const ts = Date.parse(item.start || item.createdAt || "");
  const t = Number.isNaN(ts) ? 0 : ts;
  return item.isNow ? t + 1e13 : t;
}

export function compareWallItems(
  a: Pick<WallFeedItem, "isNow" | "start" | "createdAt" | "rentalId">,
  b: Pick<WallFeedItem, "isNow" | "start" | "createdAt" | "rentalId">,
): number {
  const ka = wallSortKey(a);
  const kb = wallSortKey(b);
  if (ka !== kb) return kb - ka;
  return String(b.rentalId).localeCompare(String(a.rentalId));
}

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/**
 * VK-style date divider label, MSK-fixed (+03:00 — the app's canonical tz,
 * same as shift-crew-status / analytics).
 */
export function dateDividerLabel(iso: string | null | undefined, nowMs: number = Date.now()): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  // MSK wall-clock parts (UTC+3, fixed offset)
  const msk = (t: number) => {
    const d = new Date(t + 3 * 60 * 60 * 1000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
  };
  const a = msk(ts);
  const n = msk(nowMs);
  const dayDiff = Math.round(
    (Date.UTC(n.y, n.m, n.d) - Date.UTC(a.y, a.m, a.d)) / (24 * 60 * 60 * 1000),
  );
  if (dayDiff === 0) return "Сегодня";
  if (dayDiff === 1) return "Вчера";
  if (a.y === n.y) return `${a.d} ${MONTHS_RU[a.m]}`;
  return `${a.d} ${MONTHS_RU[a.m]} ${a.y}`;
}

/** «30 авг · 14:30» compact MSK stamp for card headers. */
export function formatMskShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const d = new Date(ts + 3 * 60 * 60 * 1000);
  const monthsShort = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${monthsShort[d.getUTCMonth()]} · ${hh}:${mm}`;
}

/** «30 авг – 2 сен» rental range label (start required, end optional). */
export function formatRangeLabel(startIso: string | null | undefined, endIso: string | null | undefined): string {
  const fmt = (iso: string | null | undefined, withTime: boolean) => {
    if (!iso) return null;
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return null;
    const d = new Date(ts + 3 * 60 * 60 * 1000);
    const monthsShort = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const date = `${d.getUTCDate()} ${monthsShort[d.getUTCMonth()]}`;
    if (!withTime) return date;
    return `${date}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };
  const s = fmt(startIso, true);
  const e = fmt(endIso, false);
  if (!s && !e) return "даты не указаны";
  if (!e) return `${s} · без даты возврата`;
  return `${s} → ${e}`;
}

// ── Photo grid layout (VK wall rules) ─────────────────────────────────────────

/**
 * CSS class recipe for an n-photo VK-style attachment grid:
 *   1 → single, natural aspect
 *   2 → two squares side by side
 *   3 → three squares in a row
 *   4+ → 2×2 grid, last cell gets «+N» overlay
 */
export function photoGridRecipe(n: number): {
  className: string;
  /** how many photos actually render in the grid (rest go under «+N») */
  visible: number;
  overflow: number;
} {
  if (n <= 0) return { className: "hidden", visible: 0, overflow: 0 };
  if (n === 1) return { className: "grid grid-cols-1 gap-1", visible: 1, overflow: 0 };
  if (n === 2) return { className: "grid grid-cols-2 gap-1", visible: 2, overflow: 0 };
  if (n === 3) return { className: "grid grid-cols-3 gap-1", visible: 3, overflow: 0 };
  return { className: "grid grid-cols-2 gap-1", visible: Math.min(4, n), overflow: Math.max(0, n - 4) };
}

/** First photo of a rental (wall card cover / og image). */
export function coverPhoto(photos: WallPhoto[]): WallPhoto | null {
  const first = photos.find((p) => p.photoType === "start") || photos.find((p) => p.photoType === "end");
  return first || photos[0] || null;
}

/** aspect-ratio style string for an img with known w/h (CLS-safe mobile). */
export function aspectStyle(w: number | null | undefined, h: number | null | undefined): CSSProperties {
  if (w && h && w > 0 && h > 0) {
    return { aspectRatio: `${w} / ${h}` };
  }
  return { aspectRatio: "4 / 3" };
}
