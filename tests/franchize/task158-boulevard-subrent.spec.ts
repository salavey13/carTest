// Task 158 — boss follow-up to task 156/157 (2026-10-28, same day):
// «same here — Boulevard is subrented and this rental is hourly, so 50% from
// 50%». The Suzuki M109R 1800 Boulevard is a SUBRENTED bike at 16 000 ₽/сутки
// → operator commission must resolve to partner_premium (750 ₽ full day,
// 375 ₽ for a <24h window), not premium (1500 ₽). Root cause unique to this
// bike: cars.specs.salary was the corrupted STRING "[object Object]" —
// parseSpecsSalary correctly rejects it, but the bike was not in the fallback
// list, so it resolved as OWNED premium. Fix both layers + the string
// tolerance is pinned here so a future corruption can't resurrect the bug.

import { describe, expect, it } from "vitest";
import {
  computeRentalSalary,
  isSubrentedBike,
  OFFICIAL_SALARY_CONFIG,
  parseSpecsSalary,
  resolveCategoriesForBike,
  SUBRENTED_BIKE_IDS,
} from "../../lib/salary-coefficients-shared";

const BOULEVARD = "suzuki-vzr1800-boulevard-2006";

describe("task158 · Suzuki M109R Boulevard is a partner bike (750/375 ₽, not 1500 ₽)", () => {
  it("boulevard is in the subrented fallback list", () => {
    expect(SUBRENTED_BIKE_IDS).toContain(BOULEVARD);
    expect(isSubrentedBike(BOULEVARD)).toBe(true);
    // the task156/157 five stay
    for (const id of [
      "ducati-panigale-s-electro-black-aero",
      "yamaha-r7",
      "suzuki-gsx-s1000f",
      "kawasaki-ex650k",
      "aprilia-shiver",
    ]) {
      expect(isSubrentedBike(id)).toBe(true);
    }
    expect(isSubrentedBike("horwin-ek1")).toBe(false);
  });

  it("the prod root cause: corrupted specs.salary string is ignored, not crashed on", () => {
    // what actually sat in prod cars.specs.salary until 2026-10-28
    expect(parseSpecsSalary({ salary: "[object Object]" })).toBeNull();
    // with the bike now in the fallback list the price-derived path lands
    // partner_premium even while specs is corrupted
    const cats = resolveCategoriesForBike({
      bikeId: BOULEVARD,
      specs: { salary: "[object Object]" },
      dailyPrice: 16000,
    });
    expect(cats.rental).toBe("partner_premium");
    expect(cats.subrented).toBe(true);
    expect(cats.source).toBe("price");
  });

  it("specs.salary partner_premium wins (the DB shape after the 2026-10-28 patch)", () => {
    const cats = resolveCategoriesForBike({
      bikeId: BOULEVARD,
      specs: {
        salary: {
          tier: "premium",
          subrented: true,
          rentalCategory: "partner_premium",
          saleCategory: "premium",
          dailyPriceAtSet: 16000,
          setAt: "2026-10-28T00:00:00.000Z",
        },
      },
      dailyPrice: 16000,
    });
    expect(cats.rental).toBe("partner_premium");
    expect(cats.subrented).toBe(true);
    expect(cats.source).toBe("specs");
  });

  it("the math: 50% from 50% — full day 750 ₽, hourly (<24h) 375 ₽", () => {
    const full = computeRentalSalary({
      config: OFFICIAL_SALARY_CONFIG,
      rentalCategory: "partner_premium",
      equipmentUnits: 0,
      totalCost: 16000,
      standardPrice: 16000,
      rentalHours: 24,
    });
    expect(full.base).toBe(750); // was 1500 as premium
    // the boss's case: 17.10 rental, 1 hour, client paid 3 000 ₽
    const hourly = computeRentalSalary({
      config: OFFICIAL_SALARY_CONFIG,
      rentalCategory: "partner_premium",
      equipmentUnits: 0,
      totalCost: 3000,
      standardPrice: 3000,
      rentalHours: 1,
    });
    expect(hourly.base).toBe(375); // 1500 × 50% (subrent) × 50% (<24h)
    expect(hourly.shortRental).toBe(true);
    // exactly-24h windows are NOT short (task120 rule: strictly < 24h)
    const day = computeRentalSalary({
      config: OFFICIAL_SALARY_CONFIG,
      rentalCategory: "partner_premium",
      equipmentUnits: 0,
      totalCost: 16000,
      standardPrice: 16000,
      rentalHours: 24,
    });
    expect(day.shortRental).toBe(false);
  });
});
