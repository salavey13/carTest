// Shared helpers for catalog pricing + Russian pluralization.
// Used by both CatalogClient.tsx and Item.tsx to avoid duplication.

import type { CatalogItemVM } from "../actions";

/** True when item has rental pricing (pricePerDay > 0) */
export const hasRentPrice = (item: CatalogItemVM): boolean => item.pricePerDay > 0;

/** True when item is available for sale with a valid sale price */
export const hasSalePrice = (item: CatalogItemVM): boolean =>
  item.saleAvailable && Boolean(item.salePrice && item.salePrice > 0);

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