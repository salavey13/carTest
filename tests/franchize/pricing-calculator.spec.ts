import { describe, expect, it } from "vitest";
import { calculatePrice, validateBikePricing } from "@/lib/rental-pricing-calculator";

describe("rental pricing calculator", () => {
  it("calculates 2-hour rental", () => {
    const result = calculatePrice(
      { price_per_hour: 2000, deposit_rub: 15000 },
      "2026-06-19",
      "2026-06-19",
      "10:00",
      "12:00",
      0
    );

    expect(result.totalRub).toBe(4000);
    expect(result.basePriceRub).toBe(4000);
    expect(result.helmetRub).toBe(0);
    expect(result.depositRub).toBe(15000);
    expect(result.savingsRub).toBe(0);
    expect(result.savingsPercent).toBe(0);
    expect(result.tier).toBe("hourly");
  });

  it("calculates 3-hour rental with exact balloon", () => {
    const result = calculatePrice(
      { price_per_3h: 5000, price_per_hour: 2000, deposit_rub: 15000 },
      "2026-06-19",
      "2026-06-19",
      "10:00",
      "13:00",
      1
    );

    expect(result.totalRub).toBe(6000);
    expect(result.basePriceRub).toBe(5000);
    expect(result.helmetRub).toBe(1000);
    expect(result.depositRub).toBe(15000);
    expect(result.savingsRub).toBe(1000); // 3h price (5000) vs hourly (2000×3=6000)
    expect(result.savingsPercent).toBe(17); // 1000/6000 ≈ 17%
    expect(result.tier).toBe("3-hours");
  });

  it("rounds 4.5-hour rental to 6 hours", () => {
    const result = calculatePrice(
      { price_per_6h: 9000, price_per_hour: 2000, deposit_rub: 15000 },
      "2026-06-19",
      "2026-06-19",
      "10:00",
      "14:30",
      0
    );

    expect(result.totalRub).toBe(9000);
    expect(result.basePriceRub).toBe(9000);
    expect(result.rounded).toBe(true);
    expect(result.displayHours).toBe(6);
    expect(result.tier).toBe("6-hours");
  });

  it("calculates 1-day rental", () => {
    const result = calculatePrice(
      { dailyPrice: 5000, deposit_rub: 20000 },
      "2026-06-19",
      "2026-06-20",
      "10:00",
      "10:00",
      0
    );

    expect(result.totalRub).toBe(5000);
    expect(result.basePriceRub).toBe(5000);
    expect(result.helmetRub).toBe(0);
    expect(result.depositRub).toBe(20000);
    expect(result.savingsRub).toBe(0);
    expect(result.savingsPercent).toBe(0);
    expect(result.tier).toBe("daily");
  });

  it("calculates 3-day rental with 7% discount", () => {
    const result = calculatePrice(
      { dailyPrice: 5000, rent_2_4d: 4650, deposit_rub: 20000 },
      "2026-06-19",
      "2026-06-22",
      "10:00",
      "10:00",
      2
    );

    expect(result.totalRub).toBe(15950);
    expect(result.basePriceRub).toBe(13950);
    expect(result.helmetRub).toBe(2000);
    expect(result.depositRub).toBe(20000);
    expect(result.savingsRub).toBe(1050);
    expect(result.savingsPercent).toBe(7);
    expect(result.tier).toBe("multi-day-2-4");
  });

  it("calculates 7-day rental with 11% discount", () => {
    const result = calculatePrice(
      { dailyPrice: 5000, rent_5_10d: 4450, deposit_rub: 20000 },
      "2026-06-19",
      "2026-06-26",
      "10:00",
      "10:00",
      0
    );

    expect(result.totalRub).toBe(31150);
    expect(result.basePriceRub).toBe(31150);
    expect(result.helmetRub).toBe(0);
    expect(result.depositRub).toBe(20000);
    expect(result.savingsRub).toBe(3850);
    expect(result.savingsPercent).toBe(11);
    expect(result.tier).toBe("multi-day-5-10");
  });

  it("calculates helmet cost correctly", () => {
    const result = calculatePrice(
      { dailyPrice: 5000, deposit_rub: 20000 },
      "2026-06-19",
      "2026-06-20",
      "10:00",
      "10:00",
      5
    );

    expect(result.totalRub).toBe(10000);
    expect(result.basePriceRub).toBe(5000);
    expect(result.helmetRub).toBe(5000);
  });

  it("rounds 11-hour rental to 12 hours", () => {
    const result = calculatePrice(
      { price_per_12h: 15000, price_per_hour: 2000, deposit_rub: 15000 },
      "2026-06-19",
      "2026-06-19",
      "10:00",
      "21:00",
      0
    );

    expect(result.totalRub).toBe(15000);
    expect(result.basePriceRub).toBe(15000);
    expect(result.rounded).toBe(true);
    expect(result.displayHours).toBe(12);
    expect(result.tier).toBe("12-hours");
  });

  it("detects missing pricing data", () => {
    const result = validateBikePricing({});

    expect(result.valid).toBe(false);
    expect(result.needsAdminFix).toBe(true);
  });
});
