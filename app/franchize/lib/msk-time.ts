// app/franchize/lib/msk-time.ts
//
// 2026-09-26 salary audit follow-up: ONE source of truth for Moscow-time
// windows. The crew thinks in MSK calendar dates («период 10–25», «выплатной
// 25-го»), but the old normalizePeriodStart/End helpers pinned date-only
// inputs to UTC midnight (`T00:00:00.000Z`), so every window silently slid by
// 3 hours: a shift clocked in at 00:30 MSK on the 25th (21:30Z on the 24th)
// fell OUT of a "10–25" period, and the last MSK day of a month window was
// cut at 20:59 MSK. All money/salary consumers (owner overview, payout,
// my-earnings, cash day summary) now go through these helpers so every
// screen and every payout agrees on where a day starts.
//
// Pure module — no server-only imports — so specs can exercise it directly.

/** Fixed MSK offset (Russia does not observe DST; Moscow is always UTC+3). */
export const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Strict "YYYY-MM-DD" matcher — date-only strings from date pickers. */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * MSK calendar-day bounds for a "YYYY-MM-DD" date, expressed in UTC ISO.
 * "2026-08-25" → { startUtcIso: "2026-08-24T21:00:00.000Z",
 *                   endUtcIso:   "2026-08-25T20:59:59.999Z" }.
 */
export function mskDayBoundsUtcIso(dateStr: string): { startUtcIso: string; endUtcIso: string } {
  // Parse the calendar date WITHOUT timezone interpretation: take the Y/M/D
  // parts literally, then subtract the MSK offset from UTC midnight.
  const [y, m, d] = dateStr.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - MSK_OFFSET_MS;
  return {
    startUtcIso: new Date(startMs).toISOString(),
    endUtcIso: new Date(startMs + 24 * 60 * 60 * 1000 - 1).toISOString(),
  };
}

/**
 * Normalize a period-start input:
 *  • date-only "YYYY-MM-DD" → MSK midnight of that day (as UTC ISO);
 *  • already-timestamped input → parsed ISO as-is (caller meant it).
 * Throws on unparseable input — callers validate Number.isFinite themselves.
 */
export function normalizePeriodStartMsk(from: string): string {
  if (!from) return from;
  if (DATE_ONLY_RE.test(from)) {
    return mskDayBoundsUtcIso(from).startUtcIso;
  }
  return new Date(from).toISOString();
}

/**
 * Normalize a period-end input:
 *  • date-only "YYYY-MM-DD" → last millisecond of that MSK day (UTC ISO);
 *  • already-timestamped input → parsed ISO as-is.
 */
export function normalizePeriodEndMsk(to: string): string {
  if (!to) return to;
  if (DATE_ONLY_RE.test(to)) {
    return mskDayBoundsUtcIso(to).endUtcIso;
  }
  return new Date(to).toISOString();
}

/**
 * The current MSK month as a UTC ISO window [start, end): the same
 * convention getMyPayoutHistory already used («приложение считает месяцы
 * по Москве»). "2026-09-26 02:00 MSK" → start = 2026-08-31T21:00:00.000Z.
 */
export function mskMonthWindowUtcIso(now: Date = new Date()): { startUtcIso: string; endUtcIso: string } {
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  const y = msk.getUTCFullYear();
  const m = msk.getUTCMonth();
  const startMs = Date.UTC(y, m, 1, 0, 0, 0, 0) - MSK_OFFSET_MS;
  const endMs = Date.UTC(y, m + 1, 1, 0, 0, 0, 0) - MSK_OFFSET_MS;
  return { startUtcIso: new Date(startMs).toISOString(), endUtcIso: new Date(endMs).toISOString() };
}

/**
 * MSK calendar date ("YYYY-MM-DD") of a UTC timestamp — the wallet
 * (owner_cash_entries.entry_date) is keyed by MSK calendar days, so period
 * windows must be translated before querying it.
 */
export function mskDateFromUtcIso(iso: string): string {
  const msk = new Date(new Date(iso).getTime() + MSK_OFFSET_MS);
  return `${msk.getUTCFullYear()}-${pad2(msk.getUTCMonth() + 1)}-${pad2(msk.getUTCDate())}`;
}
