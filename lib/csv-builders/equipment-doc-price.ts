// lib/csv-builders/equipment-doc-price.ts
//
// PURE, client-safe reference price for a standalone equipment doc row
// (iter53, 2026-10-08 — boss request «restore non zero prices for equipment
// SPECIFICALLY FOR DOWNLOADABLE EXPORTED TABLE, keeping counters intact»).
//
// Background: since 2026-09-13 equipment issued with a bike rental is an
// INVENTORY MIRROR row with total_cost = 0 (the gear money lives inside the
// primary rental's total). In the ЭКИП block of the exported sheet those
// zeros look broken next to pre-12.09 rows that still carry real prices.
//
// This helper computes the REFERENCE («справочно») price the doc WOULD have
// been charged under the pricing canon — the SAME duration-aware rule used
// everywhere else (app/franchize/lib/rental-price-split.ts, owner rule
// 2026-09-11):
//   • window < 24h  → half of the daily price  («hourly rental — half price»);
//   • window ≥ 24h  → day 1 full + every next day half
//                     («starting from the second day equipment is half
//                      priced as well»);
//   • no/broken window → flat daily price (safe fallback, same as canon).
//
// It is DISPLAY-ONLY: the builder keeps СВОДКА / ВСЕГО / summary counters on
// the STORED revenue so nothing is double-accounted.

import { durationAwareUnitPrice } from "@/app/franchize/lib/rental-price-split";

type Metadata = Record<string, unknown> | null | undefined;

function toPositiveNumber(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Daily-price basis for an equipment doc row (₽/unit/day):
 *   1. metadata.equipment_items[].daily_price  — web-checkout multi-item docs
 *      (each item carries its own catalog price snapshot); summed across items
 *      (the duration rule is linear, so summing bases ≈ per-item × rule);
 *   2. metadata.daily_price — per-crew catalog price snapshot written by
 *      /ekip, /doc and the unified server actions;
 *   3. vehicleDailyPrice — cars.daily_price of the linked equipment item
 *      (last resort, column may have changed since the doc was issued);
 *   4. 0 → caller keeps the stored value (no basis → no invention).
 */
export function equipmentDocDailyPriceBasis(
  metadata: Metadata,
  vehicleDailyPrice?: number | string | null,
): number {
  const items = Array.isArray(metadata?.equipment_items) ? metadata!.equipment_items : [];
  let base = 0;
  if (items.length > 0) {
    for (const item of items as Array<Record<string, unknown>>) {
      base += toPositiveNumber((item as any)?.daily_price);
    }
  }
  if (!(base > 0)) base = toPositiveNumber(metadata?.daily_price);
  if (!(base > 0)) base = toPositiveNumber(vehicleDailyPrice);
  return base;
}

/** Quantity multiplier of an equipment doc row (metadata.quantity, default 1). */
export function equipmentDocQuantity(metadata: Metadata): number {
  const qty = toPositiveNumber(metadata?.quantity);
  return qty > 0 ? qty : 1;
}

/**
 * Reference price (₽) of one standalone equipment doc under the pricing
 * canon. Returns 0 when no price basis exists (caller then keeps the stored
 * value instead of inventing one).
 */
export function estimateEquipmentDocPrice(input: {
  metadata: Metadata;
  vehicleDailyPrice?: number | string | null;
  startIso?: string | null;
  endIso?: string | null;
}): number {
  const base = equipmentDocDailyPriceBasis(input.metadata, input.vehicleDailyPrice);
  if (!(base > 0)) return 0;
  const unit = durationAwareUnitPrice(base, { startIso: input.startIso, endIso: input.endIso });
  return Math.round(unit * equipmentDocQuantity(input.metadata));
}
