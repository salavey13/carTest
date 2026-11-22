// gear-estimate-duration — duration-aware equipment estimate (2026-10-03).
//
// Boss: «more precisely calculate prices for subrents and for equipment».
// Legacy rows (no persisted metadata.equipment_price) used to be estimated at
// the FLAT per-rental price: a 3-hour rental with a helmet estimated 1 000 ₽
// while the pricing canon (lib/rental-pricing-calculator.ts, owner rule
// 2026-09-11, digit-verified on Task 63) charges HALF price for <24h and
// day-1-full + halves-after for multi-day windows. One formula everywhere:
// rental-price-split.durationAwareUnitPrice.
import { describe, expect, it } from "vitest";
import {
  durationAwareUnitPrice,
  estimateEquipmentPrice,
  splitRentalPrice,
} from "@/app/franchize/lib/rental-price-split";
import { getEquipmentCostPart } from "@/app/franchize/lib/subrenter-economics";

const DAY = "2026-09-14T09:00:00+00:00";

describe("gear estimate: duration-aware canon (owner rule 2026-09-11)", () => {
  it("unit price: <24h → half; ≥24h → day 1 full + each next day half; broken window → flat", () => {
    expect(durationAwareUnitPrice(1000, { startIso: DAY, endIso: "2026-09-14T12:00:00+00:00" })).toBe(500); // 3h
    expect(durationAwareUnitPrice(1000, { startIso: DAY, endIso: "2026-09-15T09:00:00+00:00" })).toBe(1000); // 24h → 1 day
    expect(durationAwareUnitPrice(1000, { startIso: DAY, endIso: "2026-09-16T09:00:00+00:00" })).toBe(1500); // 48h → 2 days
    expect(durationAwareUnitPrice(1000, { startIso: DAY, endIso: "2026-09-16T16:30:00+00:00" })).toBe(2000); // 55.5h → ceil 3 days
    expect(durationAwareUnitPrice(1000, { startIso: DAY, endIso: "garbage" })).toBe(1000); // broken window → flat
    expect(durationAwareUnitPrice(1000, { startIso: DAY, endIso: DAY })).toBe(1000); // zero window → flat
    expect(durationAwareUnitPrice(0, { startIso: DAY, endIso: "2026-09-15T09:00:00+00:00" })).toBe(0); // freebie stays free
  });

  it("estimate: helmet for 3h = 500 ₽ (was flat 1 000 ₽), gifts still free", () => {
    const md = { equipment: { helmets: 1 } };
    expect(estimateEquipmentPrice(md, { startIso: DAY, endIso: "2026-09-14T12:00:00+00:00" })).toBe(500);
    expect(estimateEquipmentPrice(md)).toBe(1000); // no window → old flat behaviour
    expect(
      estimateEquipmentPrice({ equipment: { gloves: 1, gloves_gift: true, helmets: 1 } }, { startIso: DAY, endIso: "2026-09-14T12:00:00+00:00" }),
    ).toBe(500);
  });

  it("splitRentalPrice passes the window through: 3h helmet rental → bike part 5 500 of 6 000", () => {
    const split = splitRentalPrice(6000, { equipment: { helmets: 1 } }, { startIso: DAY, endIso: "2026-09-14T12:00:00+00:00" });
    expect(split.source).toBe("estimated");
    expect(split.equipmentPartRub).toBe(500);
    expect(split.bikePartRub).toBe(5500);
  });

  it("getEquipmentCostPart: stored split still wins over the window estimate", () => {
    expect(
      getEquipmentCostPart({ equipment_price: 1500, equipment: { helmets: 1, gloves: 1 } }, 11500, {
        startIso: DAY,
        endIso: "2026-09-14T12:00:00+00:00",
      }),
    ).toBe(1500); // stored — exact, window ignored
    // the real Kawasaki September case (ff6dbfee): 3h helmet+jacket legacy row
    expect(
      getEquipmentCostPart({ equipment: { helmets: 1, jacket: true } }, 6000, {
        startIso: "2026-09-24T14:00:00+00:00",
        endIso: "2026-09-24T17:00:00+00:00",
      }),
    ).toBe(750);
  });
});
