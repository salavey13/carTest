// CrewHeader rail pill visibility (2026-10-18 boss task + review round 2).
// Extracted from CrewHeader.tsx so the contract is unit-testable — the
// previous source-string assertions could not catch an inverted condition.
//
// Contract:
//   • hiddenTabs (crew.ui.hiddenTabs, hydration metadata) always wins;
//   • «Хранение» renders only when the crew's storage config is enabled;
//   • countable pills (rent/sale/service/equipment) hide when the catalog
//     has LOADED and that type is empty — services-only crews (moto-selection)
//     must not show empty «Аренда»/«Продажа» balloons (boss 2026-10-18);
//   • «Запчасти» renders only when parts are available for the crew — the
//     hardcoded Surge CSV list is vip-bike-only, so CrewHeader passes
//     partsAvailable = (slug === "vip-bike" || crew.partsCount > 0) — a crew
//     without its own Supabase parts (cars.type="parts") never sees the pill
//     (boss 2026-11-20);
//   • an UNLOADED catalog (no items prop) keeps the classic rail — callers
//     that don't fetch items (admin surfaces) never lose pills.

export const COUNTABLE_RAIL_KEYS = ["rent", "sale", "service", "equipment"] as const;

export type CountableRailKey = (typeof COUNTABLE_RAIL_KEYS)[number];

const countableRailKeys = new Set<string>(COUNTABLE_RAIL_KEYS);

export interface RailPillLike {
  key: string;
  count: number;
}

export interface RailVisibilityOptions {
  /** true only when the caller passed a real, loaded items array */
  itemsLoaded: boolean;
  hiddenTabs: ReadonlySet<string>;
  storageEnabled: boolean;
  /** vip-bike's hardcoded list OR a non-empty Supabase parts catalogue */
  partsAvailable?: boolean;
}

export function isRailPillVisible(pill: RailPillLike, options: RailVisibilityOptions): boolean {
  if (options.hiddenTabs.has(pill.key)) return false;
  if (pill.key === "storage" && !options.storageEnabled) return false;
  // Default OFF: a caller that forgets the flag (or a crew with zero parts)
  // loses only the parts pill — the conservative side of the gate.
  if (pill.key === "parts" && options.partsAvailable !== true) return false;
  if (options.itemsLoaded && countableRailKeys.has(pill.key) && pill.count === 0) return false;
  return true;
}
