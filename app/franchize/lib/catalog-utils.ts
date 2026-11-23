// Shared helpers for catalog pricing + Russian pluralization.
// Used by both CatalogClient.tsx and Item.tsx to avoid duplication.

import type { CatalogItemVM } from "../actions";

/** Check if a rawSpecs flag is explicitly enabled (rent=1, sale=1, etc.) */
const isSpecExplicitlyEnabled = (rawSpecs: Record<string, unknown> | undefined, key: string): boolean => {
  if (!rawSpecs || !(key in rawSpecs)) return false;
  const value = rawSpecs[key];
  return value === 1 || value === true || String(value).toLowerCase() === "1" || String(value).toLowerCase() === "true";
};

/** True when item is an equipment item (type="equipment") */
export const hasEquipmentPrice = (item: CatalogItemVM): boolean => {
  // Check item.type for equipment
  if ((item as any).type === "equipment") return true;
  // Also check rawSpecs as fallback
  const rs = item.rawSpecs as Record<string, unknown> | undefined;
  if (rs && (rs.equipment === true || rs.equipment === 1)) return true;
  return false;
};

/** True when item is available for rent (rent=1 or legacy pricePerDay>0 with no rent=0) */
export const hasRentPrice = (item: CatalogItemVM): boolean => {
  // Service items are never rentable
  if (hasServicePrice(item)) return false;
  // Equipment items are never in the rent tab
  if (hasEquipmentPrice(item)) return false;
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

/** True when item is a service item (type="service" or specs.service=true) */
export const hasServicePrice = (item: CatalogItemVM): boolean => {
  const rs = item.rawSpecs as Record<string, unknown> | undefined;
  // Check specs.service flag or item type
  if (rs && (rs.service === true || rs.service === 1 || String(rs.service).toLowerCase() === "true")) {
    return true;
  }
  return false;
};

/** True when item is available for sale with a valid sale price AND sale=1 spec is explicitly set */
export const hasSalePrice = (item: CatalogItemVM): boolean => {
  // Service items are never for sale
  if (hasServicePrice(item)) return false;
  // Equipment items are never in the sale tab
  if (hasEquipmentPrice(item)) return false;
  const rs = item.rawSpecs as Record<string, unknown> | undefined;
  // If sale spec exists, it must be explicitly enabled
  if (rs && "sale" in rs) {
    return isSpecExplicitlyEnabled(rs, "sale") && item.saleAvailable && Boolean(item.salePrice && item.salePrice > 0);
  }
  // Fallback: if no sale spec, use saleAvailable (backward compatibility)
  return item.saleAvailable && Boolean(item.salePrice && item.salePrice > 0);
};

/** The four countable catalog display modes, in header-rail order. */
export type CatalogDisplayMode = "rent" | "sale" | "service" | "equipment";

/**
 * task207b (boss: «fix modal by not showing bike equipment for non-bike
 * stuff in other crews like renta-flat»): the item modal's MOTO blocks
 * (helmet/jacket/pants gear «Доп. оборудование», the «Режим тест-драйва»
 * switch, propulsion pairing) must not render for non-bike verticals.
 * A vertical is a VEHICLE when the item rides on the road: bikes (default,
 * no marker), cars (vehicle_class="car")… Flats (vehicle_class="flat") and
 * anything else non-vehicle do not carry a rider → no gear, no test-drive.
 * Default: true — every legacy bike row (no marker) keeps the full modal.
 */
export const isVehicleItem = (item: CatalogItemVM): boolean => {
  const rs = item.rawSpecs as Record<string, unknown> | undefined;
  const vc = typeof rs?.vehicle_class === "string" ? rs.vehicle_class.toLowerCase().trim() : "";
  if (!vc) return true; // unmarked rows are bikes (historical default)
  return vc === "bike" || vc === "car" || vc === "moto" || vc === "scooter" || vc === "snowmobile";
};

/**
 * 2026-11-20 (boss): the catalog used to open in «Аренда» by default even for
 * crews without a single rentable item — a deep link into a services-only
 * crew (moto-selection) landed on a properly empty tab. The default mode is
 * now the FIRST NON-EMPTY mode in rail order (rent → sale → service →
 * equipment); classic «Аренда» stays when the catalog is empty so every crew
 * renders something familiar rather than a blank section.
 */
export function firstNonEmptyCatalogMode(items: CatalogItemVM[]): CatalogDisplayMode {
  if (items.some(hasRentPrice)) return "rent";
  if (items.some(hasSalePrice)) return "sale";
  if (items.some(hasServicePrice)) return "service";
  if (items.some(hasEquipmentPrice)) return "equipment";
  return "rent";
}

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