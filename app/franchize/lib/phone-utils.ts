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
