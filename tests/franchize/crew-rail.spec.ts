// Behavioral contract for the CrewHeader rail pill visibility (2026-10-18).
// The visibility rule used to live as an inline filter chain in CrewHeader.tsx
// and was only covered by source-string assertions (a tautology — an inverted
// condition still passed). The rule is now extracted to lib/crew-rail.ts and
// unit-tested here: boss task = services-only crews (moto-selection) must not
// show empty «Аренда»/«Продажа» balloons, while callers without a loaded
// catalog keep the classic rail.
import { describe, expect, it } from "vitest";
import { COUNTABLE_RAIL_KEYS, isRailPillVisible, type RailPillLike } from "@/app/franchize/lib/crew-rail";

const NO_HIDDEN = new Set<string>();
const openOptions = { itemsLoaded: false, hiddenTabs: NO_HIDDEN, storageEnabled: true };

const pill = (key: string, count = 0): RailPillLike => ({ key, count });

describe("isRailPillVisible", () => {
  it("keeps the classic rail when the catalog is NOT loaded (itemsLoaded=false)", () => {
    // Callers that never fetch items (admin surfaces historically passed a
    // fake []) must keep every pill — the gate only trusts a LOADED catalog.
    for (const key of ["rent", "sale", "service", "equipment", "parts", "storage"]) {
      expect(isRailPillVisible(pill(key), openOptions), key).toBe(true);
    }
  });

  it("hides empty countable balloons when the catalog IS loaded", () => {
    const options = { itemsLoaded: true, hiddenTabs: NO_HIDDEN, storageEnabled: true };
    expect(isRailPillVisible(pill("rent", 0), options)).toBe(false);
    expect(isRailPillVisible(pill("sale", 0), options)).toBe(false);
    expect(isRailPillVisible(pill("service", 0), options)).toBe(false);
    expect(isRailPillVisible(pill("equipment", 0), options)).toBe(false);
  });

  it("keeps loaded countable pills with a non-zero count", () => {
    const options = { itemsLoaded: true, hiddenTabs: NO_HIDDEN, storageEnabled: true };
    expect(isRailPillVisible(pill("rent", 12), options)).toBe(true);
    expect(isRailPillVisible(pill("service", 8), options)).toBe(true);
  });

  it("services-only catalog: service stays, rent/sale/equipment disappear", () => {
    // The moto-selection case from the boss report (2026-10-18).
    const options = { itemsLoaded: true, hiddenTabs: NO_HIDDEN, storageEnabled: true };
    expect(isRailPillVisible(pill("service", 8), options)).toBe(true);
    expect(isRailPillVisible(pill("rent", 0), options)).toBe(false);
    expect(isRailPillVisible(pill("sale", 0), options)).toBe(false);
    expect(isRailPillVisible(pill("equipment", 0), options)).toBe(false);
    // parts/storage are NOT countable — never hidden by the empty gate
    expect(isRailPillVisible(pill("parts", 0), options)).toBe(true);
    expect(isRailPillVisible(pill("storage", 0), options)).toBe(true);
  });

  it("hides the storage pill when storage is disabled for the crew", () => {
    const options = { itemsLoaded: false, hiddenTabs: NO_HIDDEN, storageEnabled: false };
    expect(isRailPillVisible(pill("storage"), options)).toBe(false);
    expect(isRailPillVisible(pill("rent"), options)).toBe(true);
  });

  it("hiddenTabs (crew.ui hydration) wins over everything", () => {
    const options = { itemsLoaded: false, hiddenTabs: new Set(["rent", "parts"]), storageEnabled: true };
    expect(isRailPillVisible(pill("rent", 5), options)).toBe(false);
    expect(isRailPillVisible(pill("parts"), options)).toBe(false);
    expect(isRailPillVisible(pill("sale", 0), options)).toBe(true);
  });

  it("countable key list is exactly rent/sale/service/equipment", () => {
    expect([...COUNTABLE_RAIL_KEYS].sort()).toEqual(["equipment", "rent", "sale", "service"]);
  });
});
