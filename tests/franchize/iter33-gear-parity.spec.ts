// tests/franchize/iter33-gear-parity.spec.ts
// ──────────────────────────────────────────────────────────────────────────────
// iter33 (updated 2026-09-11) — «motopark from the subrenter POV», owner canon:
//
// 1. GEAR PRO-RATES WITH THE RENTAL DURATION (owner, 2026-09-11): «проверь,
//    что в случае аренды на часы (меньше суток) снаряжение всё ещё в половину
//    цены (шлем 500 вместо 1000, остальное 250 вместо 500), а при нескольких
//    сутках цена снаряжения уменьшается вдвое со 2-х суток». Fixed BASE
//    prices per tariff: helmet 1000₽, other gear 500₽. ONE canon in
//    getEquipmentUnitPriceForRental() — used by BOTH calculators (web
//    checkout + franchize /doc), the contract builder, the Item modal and
//    the bot quoter, so metadata.equipment_price always carries the same
//    pro-rated amounts everywhere.
//
// 2. SPLIT VIEW == PROFILE VIEW (owner: «Compare with what subrenter will
//    see in his profile - should get same total in both places»): the
//    drawer's computePartnerSplit and the profile's getEquipmentCostPart +
//    getSubrenterCut must produce IDENTICAL equipment / bike-part / partner
//    numbers for every row shape (stored, legacy estimate, gift, gear-only,
//    stored>total edge).
//
// 3. 13–23h BIKE PRICE (owner, 2026-09-11, aprilia-shiver): the web
//    calculator must agree with the contract builder's tier calculator in
//    the 12→24h window — cart == contract == stored total.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  calculatePrice,
  getHelmetPrice,
  getOtherGearUnitPrice,
  getEquipmentUnitPriceForRental,
} from "@/lib/rental-pricing-calculator";
import { getHelmetPrice as getFranchizeHelmetPrice } from "@/app/franchize/lib/pricing-calculator";
import { calculatePriceForDuration } from "@/app/franchize/lib/pricing-calculator";
import { computePartnerSplit, EQUIPMENT_UNIT_PRICES_RUB } from "@/app/franchize/lib/rental-price-split";
import {
  getEquipmentCostPart,
  getBikeRevenuePart,
  getSubrenterCut,
  buildSubrenterActivationMessage,
  buildSubrenterCompletionMessage,
} from "@/app/franchize/lib/subrenter-economics";

const TOTAL = 12000;

describe("iter34: gear pro-rates with the rental duration (2026-09-11 canon)", () => {
  it("helmet unit price: hourly half, day-1 full, 2nd+ day half", () => {
    expect(getHelmetPrice(undefined)).toBe(1000); // no duration → full day
    expect(getHelmetPrice(1)).toBe(500);
    expect(getHelmetPrice(2)).toBe(500);
    expect(getHelmetPrice(3)).toBe(500);
    expect(getHelmetPrice(12)).toBe(500);
    expect(getHelmetPrice(23.5)).toBe(500);
    expect(getHelmetPrice(24)).toBe(1000); // exactly one day → full
    expect(getHelmetPrice(48)).toBe(1500); // day 1 full + day 2 half
    expect(getHelmetPrice(72)).toBe(2000); // + 2 × half
  });

  it("other gear unit price follows the SAME rule (250 hourly, day-1 500, +250/day)", () => {
    expect(getOtherGearUnitPrice(undefined)).toBe(500);
    expect(getOtherGearUnitPrice(3)).toBe(250);
    expect(getOtherGearUnitPrice(12)).toBe(250);
    expect(getOtherGearUnitPrice(24)).toBe(500);
    expect(getOtherGearUnitPrice(48)).toBe(750);
    expect(getOtherGearUnitPrice(72)).toBe(1000);
  });

  it("the shared helper is duration-linear for any base", () => {
    expect(getEquipmentUnitPriceForRental(800, 10)).toBe(400);
    expect(getEquipmentUnitPriceForRental(800, 24)).toBe(800);
    expect(getEquipmentUnitPriceForRental(800, 96)).toBe(800 + 400 * 3);
  });

  it("franchize (/doc) helmet matches the web canon digit-for-digit", () => {
    for (const h of [1, 2, 3, 8, 12, 23, 24, 48, 72]) {
      expect(getFranchizeHelmetPrice(h)).toBe(getHelmetPrice(h));
    }
  });

  it("a 2h web checkout charges HALF-priced gear (owner: helmet 500, gloves 250)", () => {
    // aprilia-style specs: 1200/hour, 5000/3h
    const r = calculatePrice(
      { price_per_hour: 1200, price_per_3h: 5000, dailyPrice: 12000 },
      "2026-09-10", "2026-09-10", "10:00", "12:00",
      1,
      { gloves: true },
    );
    expect(r.helmetRub).toBe(500);
    expect(r.extrasRub).toBe(250);
    // The checkout persists equipment_price = helmetRub + extrasRub, so the
    // split and the profile read the SAME pro-rated amounts.
    expect(r.helmetRub + r.extrasRub).toBe(750);
  });

  it("a 3-day checkout charges day-1-full gear (helmet 2000, gloves 1000 per unit)", () => {
    const r = calculatePrice(
      { dailyPrice: 5000, rent_2_4d: 5000 },
      "2026-06-19", "2026-06-22", "10:00", "10:00",
      1,
      { gloves: true },
    );
    expect(r.helmetRub).toBe(2000);
    expect(r.extrasRub).toBe(1000);
  });
});

describe("iter34: 13–23h window — web calculator == contract tier calculator", () => {
  const apriliaSpecs = {
    price_per_hour: "1200",
    price_per_3h: "5000",
    price_per_6h: "7000",
    price_per_12h: "9000",
    dailyPrice: "12000",
    rent_weekday: "12000",
    rent_weekend: "15000",
  };

  it("the aprilia-shiver 14h order prices the bike at 9500 (was 0 → helmet-only 1000)", () => {
    const r = calculatePrice(
      apriliaSpecs,
      "2026-09-10", "2026-09-11", "17:00", "07:00",
      1,
      {},
    );
    // 12h tier 9000 + (12000 − 9000) × 2/12 = 9500 — the same number the
    // contract builder recomputed before the fix (doc said 9500 + helmet).
    expect(r.basePriceRub).toBe(9500);
    expect(r.tier).toBe("extended-hours");
    expect(r.helmetRub).toBe(500); // < 24h → half price
    expect(r.totalRub).toBe(10000);
  });

  it("interpolation is continuous with the contract builder across the window", () => {
    for (const h of [13, 14, 17, 20, 23]) {
      const endH = 10 + h;
      const endDate = endH >= 24 ? "2026-09-11" : "2026-09-10";
      const endTime = `${String(endH % 24).padStart(2, "0")}:00`;
      const web = calculatePrice(apriliaSpecs, "2026-09-10", endDate, "10:00", endTime, 0).basePriceRub;
      const contract = calculatePriceForDuration(apriliaSpecs as never, h, "2026-09-10").price;
      expect(web).toBe(contract);
    }
  });

  it("an exactly-24h rental is a full day (no interpolation)", () => {
    const r = calculatePrice(apriliaSpecs, "2026-09-10", "2026-09-11", "10:00", "10:00", 0);
    expect(r.basePriceRub).toBe(12000);
    expect(r.tier).toBe("daily");
  });
});

describe("iter34: stored gear part matches the charge on pro-rated rows", () => {
  it("hourly row: stored (500+250) vs flat legacy estimate — stored WINS", () => {
    const md = { equipment: { helmets: 1, gloves: 1 }, equipment_price: 750 };
    expect(getEquipmentCostPart(md, TOTAL)).toBe(750);
  });

  it("legacy row without stored split falls back to the flat estimate", () => {
    const md = { equipment: { helmets: 1, gloves: 1 } };
    const estimate = EQUIPMENT_UNIT_PRICES_RUB.helmets + EQUIPMENT_UNIT_PRICES_RUB.gloves;
    expect(getEquipmentCostPart(md, TOTAL)).toBe(estimate);
  });
});

describe("iter34: split view == profile view (same totals in both places)", () => {
  const rows = [
    {
      name: "hourly rent with stored pro-rated helmet (3h, helmet+gloves = 750)",
      total: 8000,
      md: { equipment: { helmets: 1, gloves: 1 }, equipment_price: 750, subrenter_chat_id: "1569357326" },
    },
    {
      name: "subrented 8h rent, price-overridden, stored 1500 (aea9e510 shape)",
      total: 10000,
      md: { equipment: { helmets: 2, gloves: 1 }, equipment_price: 1500, subrenter_chat_id: "1569357326" },
    },
    {
      name: "legacy row without stored split (estimate path)",
      total: 15000,
      md: { equipment: { helmets: 2, gloves: true, charger: true }, subrenter_chat_id: "1569357326" },
    },
    {
      name: "gift row (gloves in gift → zero revenue)",
      total: 7000,
      md: { equipment: { helmets: 2, gloves: 2, gloves_gift: true }, equipment_price: 1000, subrenter_chat_id: "1569357326" },
    },
    {
      name: "stored gear part exceeds the total (override edge — clamp must agree)",
      total: 4000,
      md: { equipment: { helmets: 2 }, equipment_price: 5000, subrenter_chat_id: "1569357326" },
    },
  ];

  for (const row of rows) {
    it(`parity for: ${row.name}`, () => {
      // Both views only ever meet on PARTNER-bike rows (the profile and the
      // weekly report scope to specs.subrenter_chat_id = his id; the drawer
      // shows the split tile exactly when the bike is subrented). Own-bike
      // rows show partnerRub = 0 in the split by design.
      // DRAWER / bike-wall view (computePartnerSplit)
      const split = computePartnerSplit({
        totalCost: row.total,
        metadata: row.md,
        subrenterChatId: row.md.subrenter_chat_id as string,
      });

      // PROFILE / weekly-report / TG-message view (subrenter-economics)
      const equipmentRub = getEquipmentCostPart(row.md, row.total);
      const bikePartRub = getBikeRevenuePart(row.total, equipmentRub);
      const cutRub = getSubrenterCut(row.total, equipmentRub);

      expect(equipmentRub).toBe(split.equipmentPartRub);
      expect(bikePartRub).toBe(split.bikePartRub);
      expect(cutRub).toBe(split.partnerRub);
      expect(row.total - cutRub).toBe(split.companyRub);
    });
  }

  it("own-bike rows: the split shows partnerRub 0 — getSubrenterCut is partner-only by design", () => {
    // The subrenter profile and the payout report only ever query the
    // partner's bikes (specs.subrenter_chat_id), so getSubrenterCut is never
    // applied to own bikes. computePartnerSplit keeps the honest owner view.
    const split = computePartnerSplit({ totalCost: 8000, metadata: { equipment: { helmets: 1, gloves: 1 }, equipment_price: 1000 } });
    expect(split.isPartnerBike).toBe(false);
    expect(split.partnerRub).toBe(0);
    expect(split.companyRub).toBe(8000);
  });

  it("equipment-only rows: whole total is gear revenue in BOTH views", () => {
    const md = { item_type: "equipment", equipment_title: "Шлем LS2", equipment_price: 700 };
    const split = computePartnerSplit({ totalCost: 700, metadata: md, subrenterChatId: "123" });
    expect(split.equipmentPartRub).toBe(700);
    expect(getEquipmentCostPart(md, 700)).toBe(700);
    expect(getSubrenterCut(700, getEquipmentCostPart(md, 700))).toBe(0); // gear is never split
  });
});

describe("iter34: partner messages show the ACTUAL share (not hardcoded 50%)", () => {
  it("activation message renders a non-default pct", () => {
    const text = buildSubrenterActivationMessage({
      bikeTitle: "Honda PCX",
      totalRub: 10000,
      equipmentRub: 1500,
      cutRub: 4250,
      pct: 55,
    });
    expect(text).toContain("(55% от аренды байка");
    expect(text).not.toContain("(50% от аренды байка");
  });

  it("completion message defaults to 50% when pct is not passed", () => {
    const text = buildSubrenterCompletionMessage({
      bikeTitle: "Honda PCX",
      totalRub: 10000,
      equipmentRub: 1500,
      cutRub: 4250,
    });
    expect(text).toContain("(50% от аренды байка");
  });
});
