// @ts-nocheck — imports a plain .mjs CLI script (no type declarations).
// Pins scripts/pricing-quote-skill.mjs to the WEB APP tier model
// (app/franchize/lib/pricing-calculator.ts). 2026-09-10: the bot script used
// a legacy percentage model (-10% / -15%) and silently misquoted prices —
// these tests make future drift impossible.

import { describe, it, expect } from "vitest";
import { calculatePrice, helmetPrice, calculateEquipment, isWeekendDate } from "../../scripts/pricing-quote-skill.mjs";

const DAILY = 2500;

// Full tier card, mirrors what catalog-adder-text derives into specs
const FULL_TIERS = {
  price_per_hour: 900,
  price_per_2h: 2000,
  price_per_3h: 2700,
  rent_2_4d: 2400,
  rent_5_10d: 2100,
  rent_11_30d: 1800,
  rent_weekday: 2500,
  rent_weekend: 3000,
};

describe("pricing-quote-skill: tier model parity with pricing-calculator.ts", () => {
  it("2h uses the exact price_per_2h tier", () => {
    const r = calculatePrice(DAILY, 0, 2, FULL_TIERS);
    expect(r.base).toBe(2000);
    expect(r.tier).toBe("/ 2 часа");
  });

  it("3h uses the exact price_per_3h tier", () => {
    expect(calculatePrice(DAILY, 0, 3, FULL_TIERS).base).toBe(2700);
  });

  it("≤1h bills per-hour rate × hours", () => {
    expect(calculatePrice(DAILY, 0, 1, FULL_TIERS).base).toBe(900);
    expect(calculatePrice(DAILY, 0, 1, {}).base).toBe(DAILY); // fallback: daily as hourly
  });

  it("12–24h interpolates toward daily and never exceeds daily for <24h", () => {
    const r = calculatePrice(DAILY, 0, 20, FULL_TIERS);
    expect(r.base).toBeLessThanOrEqual(DAILY);
    expect(r.base).toBeGreaterThanOrEqual(FULL_TIERS.price_per_12h ?? 0);
  });

  it("1 day uses rent_weekday when set", () => {
    const r = calculatePrice(DAILY, 1, 0, FULL_TIERS);
    expect(r.base).toBe(2500);
  });

  it("1 day on a weekend start date uses rent_weekend", () => {
    // 2026-09-12 is a Saturday
    expect(isWeekendDate("2026-09-12")).toBe(true);
    const r = calculatePrice(DAILY, 1, 0, FULL_TIERS, "2026-09-12");
    expect(r.base).toBe(3000);
    expect(r.tier).toBe("/ день (выходные)");
  });

  it("2–4 days use rent_2_4d as PER-DAY rate × days", () => {
    expect(calculatePrice(DAILY, 3, 0, FULL_TIERS).base).toBe(2400 * 3);
  });

  it("5–10 days use rent_5_10d as PER-DAY rate × days", () => {
    expect(calculatePrice(DAILY, 7, 0, FULL_TIERS).base).toBe(2100 * 7);
  });

  it("11+ days use rent_11_30d as PER-DAY rate × days", () => {
    expect(calculatePrice(DAILY, 14, 0, FULL_TIERS).base).toBe(1800 * 14);
    expect(calculatePrice(DAILY, 40, 0, FULL_TIERS).base).toBe(1800 * 40);
  });

  it("NO percentage discounts exist — 7 days without tiers is exactly daily × 7", () => {
    // Legacy model would return 2500 × 7 × 0.9 = 15 750 — this assertion fails then
    expect(calculatePrice(DAILY, 7, 0, {}).base).toBe(17_500);
    expect(calculatePrice(DAILY, 14, 0, {}).base).toBe(35_000);
  });

  it("hours ≥ 24 are converted to days and tiered (48h = 2 days → rent_2_4d)", () => {
    expect(calculatePrice(DAILY, 0, 48, FULL_TIERS).base).toBe(2400 * 2);
  });

  it("helmet is duration-dependent: 500₽ hourly, 1000₽ daily+", () => {
    expect(helmetPrice(5)).toBe(500);
    expect(helmetPrice(0)).toBe(1000);
    expect(calculateEquipment({ hours: 5, helmets: 2 }).total).toBe(1000);
    expect(calculateEquipment({ hours: 0, helmets: 2 }).total).toBe(2000);
  });
});
