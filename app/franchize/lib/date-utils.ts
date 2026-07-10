// /app/franchize/lib/date-utils.ts
// ─────────────────────────────────────────────────────────────────────────────
// Strict ISO date utilities for the franchize flow.
//
// THE BUG WE'RE FIXING:
//   "07.09.2026" is ambiguous — it can be read as 9 July (DD.MM) or
//   7 September (MM.DD). When this DD.MM.YYYY string leaked into the
//   database or into a `new Date(...)` call, V8 sometimes resolved it
//   as September 7, which made a 8-9 July rental show "busy till
//   07.09.2026" (September 7) on the catalog card.
//
// THE FIX:
//   - All internal storage / network / computation uses YYYY-MM-DD or
//     full ISO 8601 timestamps.
//   - `new Date(yyyymmdd)` is only called via `parseISODate` which
//     validates the format BEFORE constructing a Date.
//   - Display formatting is always done through `formatRuDate` /
//     `formatRuDateTime` with explicit DD.MM.YYYY (ru-RU locale).
//   - Any function that previously did `new Date("09.07.2026")` now
//     throws / returns null instead of silently picking the wrong day.
// ─────────────────────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Strict YYYY-MM-DD → Date (UTC midnight).
 * Returns null if the string is not exactly YYYY-MM-DD.
 *
 * ⚠️ This is the ONLY safe way to parse a calendar date in this codebase.
 * Do NOT call `new Date(string)` directly elsewhere — it will silently
 * accept "09.07.2026" and resolve it to September 7 in some V8 builds.
 */
export function parseISODate(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Construct via Date.UTC so the result is timezone-independent.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    // Catches e.g. Feb 30 → Mar 2.
    return null;
  }
  return date;
}

/**
 * Lenient parser that ALSO accepts a full ISO timestamp (e.g. from
 * Supabase TIMESTAMPTZ columns). Returns the UTC Date, or null.
 */
export function parseISODateTime(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  // Bare date → UTC midnight.
  const dateOnly = parseISODate(trimmed);
  if (dateOnly) return dateOnly;
  const match = ISO_DATETIME_RE.exec(trimmed);
  if (!match) return null;
  const ts = Date.parse(trimmed);
  return Number.isNaN(ts) ? null : new Date(ts);
}

/**
 * Format a Date as DD.MM.YYYY using the server / client locale.
 * Output is always 10 characters, zero-padded.
 */
export function formatRuDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Format a Date as DD.MM.YYYY HH:mm.
 */
export function formatRuDateTime(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

/**
 * Format a YYYY-MM-DD string as DD.MM.YYYY without timezone shifts.
 * Use this everywhere a calendar date is shown to the user.
 */
export function formatRuDateFromISO(value: string | null | undefined): string {
  const date = parseISODate(value);
  return formatRuDate(date);
}

/**
 * Add `n` days to a YYYY-MM-DD string. Returns a new YYYY-MM-DD string.
 * Safe across DST/timezone because we operate on the UTC components.
 */
export function addDaysISO(value: string, n: number): string {
  const date = parseISODate(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + n);
  return formatISODate(date);
}

/**
 * Date → YYYY-MM-DD.
 */
export function formatISODate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Count whole days between two YYYY-MM-DD strings (inclusive of both ends).
 * Returns at least 1.
 */
export function diffDaysISO(start: string, end: string): number {
  const s = parseISODate(start);
  const e = parseISODate(end);
  if (!s || !e) return 1;
  const ms = e.getTime() - s.getTime();
  const days = Math.round(ms / 86400000) + 1;
  return Math.max(1, days);
}

/**
 * Convert a YYYY-MM-DD + HH:mm into a UTC ISO timestamp.
 */
export function isoDateTimeFromParts(dateISO: string, timeHHmm: string): string | null {
  const d = parseISODate(dateISO);
  if (!d) return null;
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeHHmm.trim());
  if (!timeMatch) return null;
  const hh = Number(timeMatch[1]);
  const mm = Number(timeMatch[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  d.setUTCHours(hh, mm, 0, 0);
  return d.toISOString();
}

/**
 * Today as YYYY-MM-DD in UTC. Use this as a default `min` for date inputs.
 */
export function todayISO(): string {
  return formatISODate(new Date());
}

/**
 * Sanity check: a string is a valid YYYY-MM-DD calendar date.
 */
export function isISODate(value: string | null | undefined): value is string {
  return parseISODate(value) !== null;
}
