// Task 157 — boss follow-up to task 156 (2026-10-28, same day):
// «поправь shiver — он как kawasaki, комиссия считается как не субарендный
// 1000, а надо 500». The Aprilia Shiver 750 is a SUBRENTED bike → operator
// commission must resolve to partner_regular (500 ₽), not regular (1000 ₽).
// Same two layers as Kawasaki: SUBRENTED_BIKE_IDS fallback list + the DB
// cars.specs.salary patch (explicit specs win over the list — both must agree).

import { describe, expect, it } from "vitest";
import {
  computeRentalSalary,
  isSubrentedBike,
  OFFICIAL_SALARY_CONFIG,
  resolveCategoriesForBike,
  SUBRENTED_BIKE_IDS,
} from "../../lib/salary-coefficients-shared";

describe("task157 · Aprilia Shiver 750 is a partner bike (500 ₽, not 1000 ₽)", () => {
  it("aprilia-shiver is in the subrented fallback list", () => {
    expect(SUBRENTED_BIKE_IDS).toContain("aprilia-shiver");
    expect(isSubrentedBike("aprilia-shiver")).toBe(true);
    // the task156 four stay
    for (const id of [
      "ducati-panigale-s-electro-black-aero",
      "yamaha-r7",
      "suzuki-gsx-s1000f",
      "kawasaki-ex650k",
    ]) {
      expect(isSubrentedBike(id)).toBe(true);
    }
    expect(isSubrentedBike("horwin-ek1")).toBe(false);
  });

  it("specs.salary partner_regular wins (the DB shape after the 2026-10-28 patch)", () => {
    const cats = resolveCategoriesForBike({
      bikeId: "aprilia-shiver",
      specs: {
        salary: {
          tier: "regular",
          subrented: true,
          rentalCategory: "partner_regular",
          saleCategory: "regular",
          dailyPriceAtSet: 12000,
          setAt: "2026-10-28T00:00:00.000Z",
        },
      },
      dailyPrice: 12000,
    });
    expect(cats.rental).toBe("partner_regular");
    expect(cats.subrented).toBe(true);
  });

  it("price-derived fallback also lands partner_regular for the 12 000 ₽ Shiver", () => {
    // no specs at all → the hardcoded list decides: subrented + regular price
    const cats = resolveCategoriesForBike({ bikeId: "aprilia-shiver", specs: null, dailyPrice: 12000 });
    expect(cats.rental).toBe("partner_regular");
  });

  it("the math: full day → 500 ₽ base, short (<24h) rental → 250 ₽", () => {
    const full = computeRentalSalary({
      config: OFFICIAL_SALARY_CONFIG,
      rentalCategory: "partner_regular",
      equipmentUnits: 0,
      totalCost: 12000,
      standardPrice: 12000,
      rentalHours: 24,
    });
    expect(full.base).toBe(500); // was 1000 as regular
    const short = computeRentalSalary({
      config: OFFICIAL_SALARY_CONFIG,
      rentalCategory: "partner_regular",
      equipmentUnits: 0,
      totalCost: 6000,
      standardPrice: 6000,
      rentalHours: 3,
    });
    expect(short.base).toBe(250); // task120 halving on top of partner rate
  });
});
