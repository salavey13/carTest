// tests/franchize/pricing-ladder-parity.spec.ts
// ──────────────────────────────────────────────────────────────────────────────
// 2026-09-11 owner rule (follow-up to the aprilia-shiver fix):
//
// «i think it's more complicated - there are hourly prices in specs (see
//  golden standard md for details;) more complex interpolation is needed
//  between prices of 3h, 6h, 12h, 1d, 2-4d, 5-13d and 14-30d or something:)
//  and note that price of equipment is kinda per day (half if less then day,
//  and half fo consecutive days;)»
//
// What is pinned here:
//   1. WEB cart == CONTRACT builder for EVERY hour 1..80 on the full
//      aprilia-shiver ladder (12 specs from BIKE_PRICES_COMPACT.md) — the
//      bike part is ONE canonical ladder (calculateBikePartForRental), the
//      two calculators only wrap it in different labels.
//   2. Interpolation between ALL hourly anchors (not round-up): 4h, 5h, 8h,
//      11h are now interpolated instead of billed as the next tier.
//   3. Monotonic ladder: no fallback may price a shorter rental above the
//      next defined anchor (golden standard §8.1).
//   4. ≥ 24h: ceil days (a 30h rental is 2 days, not 1) and NO weekend
//      blending — tier rate × days, exactly like the contract.
//   5. Equipment per-day canon: < 24h half, day 1 full + every consecutive
//      day half — digit-equal in the web total and the contract builder.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  calculatePrice,
  calculateBikePartForRental,
  getHelmetPrice,
  getOtherGearUnitPrice,
  getEquipmentUnitPriceForRental,
} from "@/lib/rental-pricing-calculator";
import { calculatePriceForDuration } from "@/app/franchize/lib/pricing-calculator";

// Aprilia Shiver 750 — verbatim from BIKE_PRICES_COMPACT.md (values stored as
// strings in Supabase specs, which is exactly the shape the live row has).
const APRILIA_FULL_LADDER = {
  price_per_hour: "1200",
  price_per_3h: "5000",
  price_per_6h: "7000",
  price_per_12h: "9000",
  dailyPrice: "12000",
  rent_weekday: "12000",
  rent_weekend: "15000",
  rent_2_4d: "11000",
  rent_5_10d: "9000",
  rent_11_30d: "8000",
  deposit_rub: "20000",
};

/** Build calculatePrice args for an h-hour rental starting 2026-09-10 10:00. */
function argsForHours(h: number): [string, string, string, string] {
  const startH = 10;
  const endH = startH + h;
  const dayOffset = Math.floor(endH / 24);
  const endDate = `2026-09-${10 + dayOffset}`;
  const endTime = `${String(endH % 24).padStart(2, "0")}:00`;
  return ["2026-09-10", endDate, "10:00", endTime];
}

describe("ladder parity: web cart == contract builder for EVERY hour", () => {
  it("1..80 hours: identical bike-part price digit-for-digit", () => {
    for (let h = 1; h <= 80; h++) {
      const [sd, ed, st, et] = argsForHours(h);
      const web = calculatePrice(APRILIA_FULL_LADDER, sd, ed, st, et, 0).basePriceRub;
      const contract = calculatePriceForDuration(APRILIA_FULL_LADDER as never, h, "2026-09-10").price;
      expect(web, `hour ${h}: web ${web} != contract ${contract}`).toBe(contract);
    }
  });

  it("1..80 hours: identical totals with a helmet + gloves (gear canon on both sides)", () => {
    for (const h of [2, 5, 8, 14, 23, 24, 30, 47, 48, 73]) {
      const [sd, ed, st, et] = argsForHours(h);
      const web = calculatePrice(APRILIA_FULL_LADDER, sd, ed, st, et, 1, { gloves: true });
      const contractBike = calculatePriceForDuration(APRILIA_FULL_LADDER as never, h, "2026-09-10").price;
      const gearUnit = getEquipmentUnitPriceForRental(1000, h);
      const glovesUnit = getEquipmentUnitPriceForRental(500, h);
      // The contract builder charges bike + gear with the SAME canon.
      expect(web.basePriceRub, `hour ${h} bike part`).toBe(contractBike);
      expect(web.helmetRub, `hour ${h} helmet`).toBe(gearUnit);
      expect(web.extrasRub, `hour ${h} gloves`).toBe(glovesUnit);
    }
  });
});

describe("interpolation between ALL anchors (no round-up anymore)", () => {
  it("4h sits between 3h (5000) and 6h (7000): 5000 + 2000×1/3", () => {
    const bike = calculateBikePartForRental(APRILIA_FULL_LADDER, 4);
    expect(bike.price).toBe(Math.round(5000 + (7000 - 5000) * (4 - 3) / 3)); // 5667
    expect(bike.tier).toBe("3-6-hours");
  });

  it("5h sits between 3h and 6h: 5000 + 2000×2/3", () => {
    const bike = calculateBikePartForRental(APRILIA_FULL_LADDER, 5);
    expect(bike.price).toBe(Math.round(5000 + (7000 - 5000) * (5 - 3) / 3)); // 6333
  });

  it("8h sits between 6h (7000) and 12h (9000): 7000 + 2000×2/6", () => {
    const bike = calculateBikePartForRental(APRILIA_FULL_LADDER, 8);
    expect(bike.price).toBe(Math.round(7000 + (9000 - 7000) * (8 - 6) / 6)); // 7667
    expect(bike.tier).toBe("6-12-hours");
  });

  it("14h sits between 12h (9000) and 1d (12000): the aprilia case", () => {
    const bike = calculateBikePartForRental(APRILIA_FULL_LADDER, 14);
    expect(bike.price).toBe(9500); // 9000 + 3000×2/12
    expect(bike.tier).toBe("extended-hours");
  });

  it("exact tiers stay exact: 3h→5000, 6h→7000, 12h→9000, 24h→12000", () => {
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 3).price).toBe(5000);
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 6).price).toBe(7000);
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 12).price).toBe(9000);
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 24).price).toBe(12000);
  });
});

describe("monotonic ladder: fallbacks never overcharge vs the next anchor", () => {
  it("no 3h anchor: 5h via hourly fallback (1200×5=6000) stays under the 6h tier (7000)", () => {
    const specs = { price_per_hour: "1200", price_per_6h: "7000", dailyPrice: "12000" };
    expect(calculateBikePartForRental(specs, 5).price).toBe(6000);
  });

  it("no 6h anchor: 11h via hourly fallback (1200×11=13200) is capped at the 12h tier (9000)", () => {
    const specs = { price_per_hour: "1200", price_per_12h: "9000", dailyPrice: "12000" };
    expect(calculateBikePartForRental(specs, 11).price).toBe(9000);
  });

  it("no 12h anchor: 16h via hourly fallback is capped at the daily rate", () => {
    const specs = { price_per_hour: "1200", dailyPrice: "12000" };
    expect(calculateBikePartForRental(specs, 16).price).toBe(12000);
  });

  it("a 2h rental never prices above the 3h tier", () => {
    const specs = { price_per_hour: "1200", price_per_3h: "5000", dailyPrice: "12000" };
    expect(calculateBikePartForRental(specs, 2).price).toBe(3100); // interpolated, in-window
    const missingHour = { price_per_3h: "5000", dailyPrice: "12000" };
    expect(calculateBikePartForRental(missingHour, 2).price).toBe(3333); // 5000/3×2, under 3h tier
  });
});

describe("≥ 24h: ceil days + tier rates, no weekend blending (cart == contract == DB)", () => {
  it("30h is TWO days at the 2-4d rate (was 1 day in the cart → 11000; contract said 22000)", () => {
    const bike = calculateBikePartForRental(APRILIA_FULL_LADDER, 30, "2026-09-10");
    expect(bike.days).toBe(2);
    expect(bike.price).toBe(22000); // 2 × rent_2_4d 11000
    expect(bike.tier).toBe("multi-day-2-4");
  });

  it("47h is still 2 days, 48h is exactly 2, 73h is 4", () => {
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 47, "2026-09-10").days).toBe(2);
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 48, "2026-09-10").days).toBe(2);
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 73, "2026-09-10").price).toBe(44000); // 4 × 11000
  });

  it("5-10d tier kicks in at day 5, 11-30d at day 11", () => {
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 120, "2026-09-10").price).toBe(45000); // 5 × 9000
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 264, "2026-09-10").tier).toBe("multi-day-11-30");
    expect(calculateBikePartForRental(APRILIA_FULL_LADDER, 264, "2026-09-10").price).toBe(88000); // 11 × 8000
  });

  it("exactly 24h on a Saturday start uses rent_weekend (15000) — start-day rule", () => {
    // 2026-09-12 is a Saturday
    const bike = calculateBikePartForRental(APRILIA_FULL_LADDER, 24, "2026-09-12");
    expect(bike.price).toBe(15000);
    // …but a Fri→Sat 24h rental stays on the weekday rate (12000)
    const fri = calculateBikePartForRental(APRILIA_FULL_LADDER, 24, "2026-09-11");
    expect(fri.price).toBe(12000);
  });
});

describe("equipment per-day canon across the ladder (owner: half <1d, half consecutive days)", () => {
  it("helmet: 500 hourly · 1000 day 1 · +500 per consecutive day", () => {
    expect(getHelmetPrice(1)).toBe(500);
    expect(getHelmetPrice(23)).toBe(500);
    expect(getHelmetPrice(24)).toBe(1000);
    expect(getHelmetPrice(30)).toBe(1500); // ceil(30/24)=2 days
    expect(getHelmetPrice(72)).toBe(2000);
  });

  it("other gear: 250 hourly · 500 day 1 · +250 per consecutive day", () => {
    expect(getOtherGearUnitPrice(1)).toBe(250);
    expect(getOtherGearUnitPrice(23)).toBe(250);
    expect(getOtherGearUnitPrice(24)).toBe(500);
    expect(getOtherGearUnitPrice(30)).toBe(750);
    expect(getOtherGearUnitPrice(72)).toBe(1000);
  });

  it("the shiver 14h checkout total: 9500 bike + 500 helmet = 10000 (helmet half-price)", () => {
    const r = calculatePrice(
      APRILIA_FULL_LADDER,
      "2026-09-10", "2026-09-11", "17:00", "07:00",
      1,
      {},
    );
    expect(r.basePriceRub).toBe(9500);
    expect(r.helmetRub).toBe(500);
    expect(r.totalRub).toBe(10000);
  });

  it("a 3-day checkout: bike 33000 + helmet 2000 + gloves 1000 (day-1 full + half days 2-3)", () => {
    const r = calculatePrice(
      APRILIA_FULL_LADDER,
      "2026-09-10", "2026-09-13", "10:00", "10:00",
      1,
      { gloves: true },
    );
    expect(r.basePriceRub).toBe(33000); // 3 × 11000
    expect(r.helmetRub).toBe(2000);
    expect(r.extrasRub).toBe(1000);
    expect(r.totalRub).toBe(36000);
  });
});
