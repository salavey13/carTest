// tests/franchize/iter33-gear-parity.spec.ts
// ──────────────────────────────────────────────────────────────────────────────
// iter33 — «motopark from the subrenter POV» owner fixes, pinned as tests:
//
// 1. GEAR IS NEVER HALF-PRICED (owner, 2026-09-10): «in case rent was in
//    hours, then equipment price which is deducted before revenue split with
//    subrenter is half priced: helmet 500 instead of 1000, other gear 250
//    instead of 500». The hourly halving is retired — getHelmetPrice() is
//    FLAT 1000₽ in BOTH calculators (web checkout + franchize /doc), so the
//    stored metadata.equipment_price of an hourly rent carries the same unit
//    prices as the official table (EQUIPMENT_UNIT_PRICES_RUB).
//
// 2. SPLIT VIEW == PROFILE VIEW (owner: «Compare with what subrenter will
//    see in his profile - should get same total in both places»): the
//    drawer's computePartnerSplit and the profile's getEquipmentCostPart +
//    getSubrenterCut must produce IDENTICAL equipment / bike-part / partner
//    numbers for every row shape (stored, legacy estimate, gift, gear-only,
//    stored>total edge).
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { calculatePrice, getHelmetPrice } from "@/lib/rental-pricing-calculator";
import { getHelmetPrice as getFranchizeHelmetPrice } from "@/app/franchize/lib/pricing-calculator";
import { computePartnerSplit, EQUIPMENT_UNIT_PRICES_RUB } from "@/app/franchize/lib/rental-price-split";
import {
  getEquipmentCostPart,
  getBikeRevenuePart,
  getSubrenterCut,
  buildSubrenterActivationMessage,
  buildSubrenterCompletionMessage,
} from "@/app/franchize/lib/subrenter-economics";

const TOTAL = 12000;

describe("iter33: gear is never half-priced on hourly rents", () => {
  it("web checkout helmet is FLAT 1000₽ for 1h / 2h / 3h / 12h / daily", () => {
    for (const h of [1, 2, 3, 6, 12, 24, 48]) {
      expect(getHelmetPrice(h)).toBe(1000);
    }
  });

  it("franchize (/doc) helmet is FLAT 1000₽ too", () => {
    for (const h of [1, 2, 3, 8, 12, 23, 24, 72]) {
      expect(getFranchizeHelmetPrice(h)).toBe(1000);
    }
  });

  it("a 2h web checkout charges the FULL helmet price (was 500)", () => {
    // aprilia-style specs: 1200/hour, 5000/3h
    const r = calculatePrice(
      { price_per_hour: 1200, price_per_3h: 5000, dailyPrice: 12000 },
      "2026-09-10", "2026-09-10", "10:00", "12:00",
      1,
      { gloves: true },
    );
    expect(r.helmetRub).toBe(1000); // 2026-09-09 live row stored 500 here
    expect(r.extrasRub).toBe(500);
    // franchize-order.ts persists equipment_price = helmetRub + extrasRub:
    // an hourly rent now stores FULL-priced gear, so the split and the
    // profile read the same official prices.
    const storedEquipmentPrice = r.helmetRub + r.extrasRub;
    expect(storedEquipmentPrice).toBe(1500);
  });

  it("stored gear part of an hourly rent matches the official unit-price table", () => {
    // What the writer persists (helmetRub + extrasRub) vs what every reader
    // would estimate from EQUIPMENT_UNIT_PRICES_RUB — must agree now.
    const md = { equipment: { helmets: 1, gloves: true, charger: true } };
    const estimate =
      EQUIPMENT_UNIT_PRICES_RUB.helmets * 1 + EQUIPMENT_UNIT_PRICES_RUB.gloves;
    const stored = getHelmetPrice(2) + 500; // web checkout math for 2h + gloves
    expect(stored).toBe(estimate); // 1000 + 500 = 1500 — same table
    expect(getEquipmentCostPart(md, TOTAL)).toBe(Math.min(estimate, TOTAL));
  });
});

describe("iter33: split view == profile view (same totals in both places)", () => {
  const rows = [
    {
      name: "hourly rent with stored half-priced helmet (legacy row a5908ba2)",
      total: 8000,
      md: { equipment: { helmets: 1, gloves: 1 }, equipment_price: 1000, subrenter_chat_id: "1569357326" },
    },
    {
      name: "subrented 8h rent, price-overridden, stored 1500 (aea9e510)",
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

describe("iter33: partner messages show the ACTUAL share (not hardcoded 50%)", () => {
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
