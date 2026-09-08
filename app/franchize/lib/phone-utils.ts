/**
 * Shared phone normalization utilities for franchise flows.
 * Safe to import from both client and server code (no "use server").
 *
 * Canonical implementation (single source of truth).
 * Combines:
 *  - Inline copy's RU-prefix inference (10-digit → +7)
 *  - phone-utils.ts's garbage rejection (< 10 digits → null)
 *
 * All inline copies in leads.ts, crew-todos.ts, useLeadsData.ts,
 * and leads-utils.tsx should import this function instead.
 *
 * @see docs/franchize-identity-flow-audit.md §15.2 NEW #6
 */

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().replace(/[\s\-\(\)]/g, "");
  if (!s) return null;
  if (/^8\d{10}$/.test(s)) s = "+7" + s.slice(1);
  else if (/^7\d{10}$/.test(s)) s = "+" + s;
  else if (/^\d{10}$/.test(s)) s = "+7" + s;       // RU-prefix inference
  else if (!s.startsWith("+")) s = "+" + s;
  // Reject garbage (length check from original phone-utils.ts)
  const digits = s.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return s;
}

/**
 * Normalize a phone to its last 10 digits — the comparison key for matching
 * renter phones stored in different formats ("89960430155", "+7 996 043 01 55",
 * "79960430155" all → "9960430155"). Lives here (NOT in user-rental-secrets.ts)
 * because that file is "use server" and every export there must be async.
 */
export function normalizePhoneDigits(rawPhone: string | null | undefined): string {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  // RU numbers: 11 digits starting with 8 or 7 → drop the leading country code
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Best-effort phone extraction from free text (Avito chat messages, forwards).
 *
 * Avito never exposes the buyer's phone via the messenger API (privacy), but
 * buyers very often type it into the chat ("звоните +7 912 345-67-89").
 * This helper pulls the first plausible RU phone out of that text so the
 * webhook can backfill the lead's `phone` column.
 *
 * Conservative by design — a wrong phone is worse than no phone:
 *  - only digit runs of 10-11 digits (with spaces/dashes/parens allowed);
 *  - the run must not be glued to letters (otherwise ids like "u2i-…" or
 *    "abc89001234567" would produce junk);
 *  - after normalization it must be a RU MOBILE number (+79XXXXXXXXX) —
 *    buyers give mobiles, and this single rule also rejects Avito item ids
 *    (10 digits starting with 3), order numbers and glued timestamps.
 * Returns the normalized "+79XXXXXXXXX" or null.
 */
export function extractPhoneFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const candidates = String(text).match(
    /(?<![\dA-Za-zА-Яа-яЁё])\+?\d[\d\s\-().]{7,18}\d(?![\dA-Za-zА-Яа-яЁё])/g,
  );
  if (!candidates) return null;
  for (const candidate of candidates) {
    const normalized = normalizePhone(candidate);
    if (!normalized) continue;
    // RU mobiles only: +7 followed by 9 and 9 more digits. One rule rejects
    // everything else plausibly phone-shaped: Avito item ids (3XXXXXXXXX),
    // order numbers, timestamps, hotline/city numbers (a "lead phone" of
    // 8-800-… would be useless anyway).
    if (/^\+79\d{9}$/.test(normalized)) return normalized;
  }
  return null;
}
