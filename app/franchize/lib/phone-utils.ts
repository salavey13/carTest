/**
 * Shared phone normalization utilities for franchise flows.
 * Safe to import from both client and server code (no "use server").
 */

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Normalize Russian numbers: 8xxxxxxxxxx → +7xxxxxxxxxx
  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.startsWith("7") && digits.length === 11) {
    return `+${digits}`;
  }
  return `+${digits}`;
}
