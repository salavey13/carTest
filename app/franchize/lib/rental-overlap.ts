// /app/franchize/lib/rental-overlap.ts
//
// Hour-precise rental overlap math shared by the order-page availability gate
// (checkFranchizeCarsAvailability). Extracted as pure functions so the exact
// live scenarios can be unit-tested without Supabase.
//
// WHY THIS EXISTS (2026-08-29, "bike busy for the whole day"): the old gate
// blew the requested window up to whole calendar days (start 00:00:00Z →
// end 23:59:59Z) and matched it against other rentals with SQL date filters.
// A rental that ended at 11:30 therefore blocked a new order starting at
// 12:00 the SAME day — the renter saw "Часть байков уже занята" even though
// the bike was back on the stand for hours. The web cart carries explicit
// pickup/return times (rentStartTime/rentEndTime), and the checkout persists
// them as Moscow-local (+03:00) timestamps in requested_start_date /
// requested_end_date — the gate must compare the same hour-precise windows.

/** Late-return buffer added to a rental's end before the bike counts as free. */
export const RENTAL_BLOCK_GRACE_MS = 30 * 60 * 1000;

/** Last-resort assumed duration when a rental row has a start but no end. */
const MISSING_END_FALLBACK_MS = 24 * 60 * 60 * 1000;

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RequestedRentalWindow {
  rentalStartDate: string;
  rentalEndDate: string;
  /** HH:MM in Moscow local time (same convention the checkout persists). */
  rentalStartTime?: string;
  /** HH:MM in Moscow local time. */
  rentalEndTime?: string;
}

export interface RequestedWindowMs {
  startMs: number;
  endMs: number;
  /** true when the caller supplied explicit times (hour-precise mode). */
  hourPrecise: boolean;
}

/**
 * Build the requested rental window in epoch ms.
 *
 * With times: `2026-08-29` + `12:00` → 2026-08-29T12:00:00+03:00 (Moscow —
 * exactly how createFranchizeOrderCheckout stores requested_start_date).
 * Without times: whole calendar days in UTC (legacy behaviour for callers
 * that only know dates, e.g. the sale test-drive landing).
 *
 * Returns null when the input cannot produce a sane window.
 */
export function buildRequestedWindowMs(input: RequestedRentalWindow): RequestedWindowMs | null {
  const startDate = typeof input.rentalStartDate === "string" ? input.rentalStartDate.trim() : "";
  const endDate = typeof input.rentalEndDate === "string" ? input.rentalEndDate.trim() : "";
  if (!startDate || !endDate) return null;

  const hasStartTime = typeof input.rentalStartTime === "string" && HH_MM_RE.test(input.rentalStartTime.trim());
  const hasEndTime = typeof input.rentalEndTime === "string" && HH_MM_RE.test(input.rentalEndTime.trim());

  // Hour-precise mode requires BOTH bounds; a half-specified window would
  // silently mix Moscow times with UTC day edges — fall back to day mode.
  const hourPrecise = hasStartTime && hasEndTime;
  if (!hourPrecise && (input.rentalStartTime || input.rentalEndTime)) {
    // Caller tried to be precise but the values are malformed → day window.
  }

  let startMs: number;
  let endMs: number;
  if (hourPrecise) {
    startMs = Date.parse(`${startDate}T${input.rentalStartTime!.trim()}:00+03:00`);
    endMs = Date.parse(`${endDate}T${input.rentalEndTime!.trim()}:00+03:00`);
  } else {
    startMs = Date.parse(`${startDate}T00:00:00.000Z`);
    endMs = Date.parse(`${endDate}T23:59:59.999Z`);
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  if (endMs < startMs) return null;
  return { startMs, endMs, hourPrecise };
}

export interface RentalOverlapRow {
  vehicle_id?: string | null;
  status?: string | null;
  requested_start_date?: string | null;
  requested_end_date?: string | null;
  agreed_start_date?: string | null;
  agreed_end_date?: string | null;
}

/**
 * Parse a stored rental timestamp.
 * Bare calendar dates ("2026-08-29") mean the whole day:
 *   - start → 00:00:00 MSK
 *   - end   → 23:59:59 MSK  (a rental "until 29.08" occupies the entire day)
 * Returns NaN for missing/unparseable values.
 */
export function parseStoredRentalTs(value: unknown, edge: "start" | "end"): number {
  if (typeof value !== "string") return Number.NaN;
  const s = value.trim();
  if (!s) return Number.NaN;
  if (ISO_DATE_RE.test(s)) {
    return edge === "start"
      ? Date.parse(`${s}T00:00:00.000+03:00`)
      : Date.parse(`${s}T23:59:59.999+03:00`);
  }
  const ts = Date.parse(s);
  return Number.isFinite(ts) ? ts : Number.NaN;
}

/**
 * Does this rental row block the requested window?
 *
 * A row blocks iff ALL hold:
 *   1. effective start  <  window end      (interval overlap)
 *   2. effective end    >  window start    (interval overlap, +grace on the end)
 *   3. effective end    >  now             (a rental whose time has already
 *      passed — hours ago, or closed by the operator — never blocks anything,
 *      even a stale `pending_confirmation` row that nobody flipped)
 *
 * Effective bounds: requested_* dates take priority (what the web flow
 * writes), agreed_* as fallback; a missing end falls back to start + 24h;
 * a missing start is assumed ≤ end (start = end − 24h).
 */
export function rentalRowBlocksWindow(
  row: RentalOverlapRow,
  windowMs: RequestedWindowMs,
  nowMs: number,
): boolean {
  let startTs = parseStoredRentalTs(row.requested_start_date, "start");
  if (Number.isNaN(startTs)) startTs = parseStoredRentalTs(row.agreed_start_date, "start");

  let endTs = parseStoredRentalTs(row.requested_end_date, "end");
  if (Number.isNaN(endTs)) endTs = parseStoredRentalTs(row.agreed_end_date, "end");

  if (Number.isNaN(startTs) && Number.isNaN(endTs)) {
    // No usable dates at all — too broken to gate availability on.
    return false;
  }
  if (Number.isNaN(endTs)) endTs = startTs + MISSING_END_FALLBACK_MS;
  if (Number.isNaN(startTs)) startTs = endTs - MISSING_END_FALLBACK_MS;

  const effectiveEnd = endTs + RENTAL_BLOCK_GRACE_MS;
  const overlapsWindow = startTs < windowMs.endMs && effectiveEnd > windowMs.startMs;
  const notOverYet = effectiveEnd > nowMs;
  return overlapsWindow && notOverYet;
}
