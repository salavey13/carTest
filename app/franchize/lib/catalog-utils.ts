// Shared helpers for catalog pricing + Russian pluralization.
// Used by both CatalogClient.tsx and Item.tsx to avoid duplication.

import type { CatalogItemVM } from "../actions";

/** Check if a rawSpecs flag is explicitly enabled (rent=1, sale=1, etc.) */
const isSpecExplicitlyEnabled = (rawSpecs: Record<string, unknown> | undefined, key: string): boolean => {
  if (!rawSpecs || !(key in rawSpecs)) return false;
  const value = rawSpecs[key];
  return value === 1 || value === true || String(value).toLowerCase() === "1" || String(value).toLowerCase() === "true";
};

/** True when item is available for rent (rent=1 or legacy pricePerDay>0 with no rent=0) */
export const hasRentPrice = (item: CatalogItemVM): boolean => {
  const rs = item.rawSpecs as Record<string, unknown> | undefined;
  // If rent spec exists, it must be explicitly enabled
  if (rs && "rent" in rs) {
    return isSpecExplicitlyEnabled(rs, "rent") && item.pricePerDay > 0;
  }
  // If sale is explicitly enabled but rent is absent — treat as sale-only
  if (rs && "sale" in rs && isSpecExplicitlyEnabled(rs, "sale")) {
    return false;
  }
  // Fallback: if no rent/sale specs, use pricePerDay (backward compatibility)
  return item.pricePerDay > 0;
};

/** True when item is available for sale with a valid sale price AND sale=1 spec is explicitly set */
export const hasSalePrice = (item: CatalogItemVM): boolean => {
  const rs = item.rawSpecs as Record<string, unknown> | undefined;
  // If sale spec exists, it must be explicitly enabled
  if (rs && "sale" in rs) {
    return isSpecExplicitlyEnabled(rs, "sale") && item.saleAvailable && Boolean(item.salePrice && item.salePrice > 0);
  }
  // Fallback: if no sale spec, use saleAvailable (backward compatibility)
  return item.saleAvailable && Boolean(item.salePrice && item.salePrice > 0);
};

/**
 * Russian plural form for "день" (day).
 * Handles the full Slavic plural rule:
 *   1 день, 2–4 дня, 5–20 дней, 21 день, 22–24 дня, 25–30 дней, …
 */
export function ruPluralDays(n: number): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}