// tests/franchize/hotfix-string-prices.spec.ts
//
// HOTFIX regression suite (2026-08-28, "in franchize during rental web app
// prices summed as strings, not as numbers").
//
// Root cause: many bikes in the live DB store price fields as TEXT in the
// cars.specs JSONB (yamaha-r7: dailyPrice "10000"), and the shared pricing
// calculator returned those raw strings — so `price + helmetRub`
// concatenated ("10000" + 2000 → "100002000") across the Item modal, the
// cart, the order page and the server-side rental row.
//
// Secondary bug fixed in the same hotfix: the Item modal emits the perk
// string as "Шлем ×2" (with a space), but the cart hook's helmet regex was
// NOT space-tolerant → helmets were silently not priced in cart/order.
//
// This suite pins BOTH fixes plus the server-side sanitize/heal layer
// (app/franchize/lib/order-money-sanitize.ts) that protects the deploy
// window while stale cached Telegram WebApp frontends keep submitting
// old-payload numbers.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { calculatePrice, validateBikePricing, num } from "@/lib/rental-pricing-calculator";
import { parseHelmetCount, parseHelmetCountFromPerk } from "@/app/franchize/lib/perk-parse";
import {
  sanitizeFranchizeOrderMoneyFields,
  toFiniteNumber,
} from "@/app/franchize/lib/order-money-sanitize";
import { calculatePriceForDuration } from "@/app/franchize/lib/pricing-calculator";
import { buildRentalContractVariables } from "@/app/lib/rental-contract-vars";

// ── LIVE spec shapes (verbatim from Supabase, 2026-08-28) ────────────────────

// yamaha-r7 stores EVERYTHING as strings (the bug reporter's case)
const YAMAHA_R7_STRING_SPECS = {
  dailyPrice: "10000",
  price_per_hour: "1200",
  price_per_3h: "6000",
  price_per_6h: "8000",
  price_per_12h: "9000",
  rent_weekday: "10000",
  rent_weekend: "12000",
  rent_2_4d: "9000",
  rent_5_10d: "9000",
  rent_11_30d: "7000",
  deposit_rub: "20000",
  price_rub: "800000",
  sale_price: "0",
};

// kawasaki-ex650k stores numbers (worked before, must keep working)
const KAWASAKI_NUMERIC_SPECS = {
  dailyPrice: 10000,
  price_per_hour: 1000,
  price_per_3h: 7000,
  price_per_6h: 8000,
  price_per_12h: 9000,
  rent_weekday: 10000,
  rent_weekend: 11000,
  rent_2_4d: 9000,
  rent_5_10d: 8000,
  rent_11_30d: 7500,
  deposit_rub: 20000,
};

describe("HOTFIX string prices — num() coercion helper", () => {
  it("coerces numeric strings, spaced strings and decimals", () => {
    expect(num("10000")).toBe(10000);
    expect(num("10 000")).toBe(10000);
    expect(num("10000.50")).toBe(10000.5);
    expect(num("10 000,50")).toBe(10000.5);
    expect(num(12000)).toBe(12000);
  });

  it("returns undefined for missing / garbage / non-positive values", () => {
    expect(num(undefined)).toBeUndefined();
    expect(num(null)).toBeUndefined();
    expect(num("")).toBeUndefined();
    expect(num("abc")).toBeUndefined();
    expect(num(0)).toBeUndefined();
    expect(num(-5)).toBeUndefined();
    expect(num(Number.NaN)).toBeUndefined();
  });
});

describe("HOTFIX string prices — calculatePrice with TEXT specs (yamaha-r7)", () => {
  it("1 day + 2 helmets sums NUMERICALLY: 10000 + 2000 = 12000 (not \"100002000\")", () => {
    const result = calculatePrice(YAMAHA_R7_STRING_SPECS, "2026-08-28", "2026-08-29", "10:00", "10:00", 2);
    expect(typeof result.totalRub).toBe("number");
    expect(result.totalRub).toBe(12000);
    expect(typeof result.basePriceRub).toBe("number");
    expect(result.basePriceRub).toBe(10000);
    expect(result.helmetRub).toBe(2000);
    expect(result.depositRub).toBe(20000);
  });

  it("3-hour tier with string specs stays numeric (6000 + 1000 helmet)", () => {
    const result = calculatePrice(YAMAHA_R7_STRING_SPECS, "2026-08-28", "2026-08-28", "10:00", "13:00", 1);
    expect(typeof result.totalRub).toBe("number");
    expect(result.totalRub).toBe(7000);
    expect(result.tier).toBe("3-hours");
  });

  it("hourly interpolation with string specs stays numeric", () => {
    const result = calculatePrice(YAMAHA_R7_STRING_SPECS, "2026-08-28", "2026-08-28", "10:00", "12:00", 0);
    expect(typeof result.totalRub).toBe("number");
    expect(result.totalRub).toBe(3600); // 1200 + (6000−1200)×(2−1)/2
  });

  it("multi-day string tier (rent_2_4d \"9000\" × 3) stays numeric", () => {
    // Mon 2026-08-31 → Thu 2026-09-03: 3 weekdays, no weekend blend
    const result = calculatePrice(YAMAHA_R7_STRING_SPECS, "2026-08-31", "2026-09-03", "10:00", "10:00", 0);
    expect(typeof result.totalRub).toBe("number");
    expect(result.totalRub).toBe(27000);
    expect(result.tier).toBe("multi-day-2-4");
  });

  it("weekend-start single day uses string rent_weekend numerically", () => {
    // 2026-08-29 is a Saturday
    const result = calculatePrice(YAMAHA_R7_STRING_SPECS, "2026-08-29", "2026-08-30", "10:00", "10:00", 0);
    expect(typeof result.totalRub).toBe("number");
    expect(result.totalRub).toBe(12000);
  });

  it("multi-day weekend blend with string weekday/weekend rates is numeric", () => {
    // Fri 2026-08-28 → Sun 2026-08-30: 3 calendar days? differenceInDays=2
    // blend only applies when days > 1 AND weekend days in range
    const result = calculatePrice(YAMAHA_R7_STRING_SPECS, "2026-08-28", "2026-08-31", "10:00", "10:00", 0);
    expect(typeof result.totalRub).toBe("number");
    // 2026-08-28..31: Sat+Sun counted (2 weekend days), days=3
    // blend = 2×12000 + 1×10000 = 34000
    expect(result.totalRub).toBe(34000);
  });

  it("string deposit_rub returns as number", () => {
    const result = calculatePrice(YAMAHA_R7_STRING_SPECS, "2026-08-28", "2026-08-29", "10:00", "10:00", 0);
    expect(result.depositRub).toBe(20000);
    expect(typeof result.depositRub).toBe("number");
  });

  it("numeric specs (kawasaki) keep exact legacy behaviour", () => {
    const result = calculatePrice(KAWASAKI_NUMERIC_SPECS, "2026-08-27", "2026-08-28", "10:00", "10:00", 2);
    expect(result.totalRub).toBe(12000);
    expect(result.basePriceRub).toBe(10000);
    expect(result.depositRub).toBe(20000);
  });

  it("validateBikePricing accepts string specs", () => {
    expect(validateBikePricing(YAMAHA_R7_STRING_SPECS).valid).toBe(true);
    expect(validateBikePricing({}).valid).toBe(false);
  });
});

describe("HOTFIX helmet count — space-tolerant perk parsing", () => {
  it("parses the modal's actual output \"Шлем ×2\" (space before ×)", () => {
    expect(parseHelmetCount("Шлем ×2")).toBe(2);
  });

  it("parses legacy compact form \"шлем×2\" and x-multiplier", () => {
    expect(parseHelmetCount("шлем×2")).toBe(2);
    expect(parseHelmetCount("Шлем x 2")).toBe(2);
    expect(parseHelmetCount("Шлем ×1")).toBe(1);
  });

  it("returns 0 for non-helmet perks", () => {
    expect(parseHelmetCount("стандарт")).toBe(0);
    expect(parseHelmetCount("Перчатки, Куртка")).toBe(0);
    expect(parseHelmetCount("")).toBe(0);
  });

  it("caps at 2 helmets (mirror of the modal max)", () => {
    expect(parseHelmetCount("Шлем ×9")).toBe(2);
  });

  it("server-side parser agrees with the cart parser for ×-forms", () => {
    for (const perk of ["Шлем ×2", "шлем×2", "Шлем x 2", "Шлем ×1", "стандарт", "Перчатки"]) {
      expect(parseHelmetCountFromPerk(perk)).toBe(parseHelmetCount(perk));
    }
  });

  it("server-side parser defaults a bare шлем mention to 1 (equipment parity)", () => {
    expect(parseHelmetCountFromPerk("шлем")).toBe(1);
  });
});

describe("HOTFIX server sanitize — sanitizeFranchizeOrderMoneyFields", () => {
  const warn = vi.fn();
  beforeEach(() => warn.mockClear());

  type TestLine = {
    itemId: string;
    qty?: number;
    pricePerDay?: number | string;
    lineTotal?: number | string;
    options: {
      package?: string;
      duration?: string;
      perk?: string;
      auction?: string;
      action?: string;
      buyConfigId?: string;
      buyPriceDelta?: number;
      rentStartDate?: string;
      rentEndDate?: string;
      rentStartTime?: string;
      rentEndTime?: string;
    };
    priceBreakdown?: Record<string, unknown>;
  };

  type TestPayload = {
    orderId: string;
    subtotal?: number | string;
    extrasTotal?: number | string;
    promoDiscount?: number | string;
    totalAmount?: number | string;
    extras?: Array<{ id?: string; label?: string; amount?: number | string }>;
    cartLines: TestLine[];
  };

  function makeById(specs: Record<string, unknown>, type = "bike") {
    return new Map([["yamaha-r7", { id: "yamaha-r7", type, specs }]]);
  }

  function makePayload(overrides: Record<string, unknown> = {}): TestPayload {
    const base: TestPayload = {
      orderId: "order-hotfix-test",
      subtotal: 0,
      extrasTotal: 0,
      promoDiscount: 0,
      totalAmount: 0,
      extras: [],
      cartLines: [
        {
          itemId: "yamaha-r7",
          qty: 1,
          pricePerDay: "10000",
          lineTotal: 100002000, // stale-frontend string-sum garbage (coerced to number)
          options: {
            package: "Базовый",
            duration: "1 день",
            perk: "Шлем ×2",
            auction: "Без аукциона",
            rentStartDate: "2026-08-28",
            rentEndDate: "2026-08-29",
            rentStartTime: "10:00",
            rentEndTime: "10:00",
          },
          priceBreakdown: {
            totalRub: "100002000", // raw string from the old calculator
            basePriceRub: "10000",
            helmetRub: 2000,
            depositRub: "20000",
          },
        },
      ],
    };
    return Object.assign(base, overrides) as TestPayload;
  }

  it("heals a stale-frontend garbage line total to the recomputed 12000", () => {
    const payload = makePayload();
    const result = sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(result.healedLines).toBe(1);
    expect(payload.cartLines[0].lineTotal).toBe(12000);
    expect(payload.subtotal).toBe(12000);
    expect(payload.totalAmount).toBe(12000);
    expect(result.totalsRewritten).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("drops a non-numeric priceBreakdown so the contract recomputes from specs", () => {
    const payload = makePayload();
    sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(payload.cartLines[0].priceBreakdown).toBeUndefined();
  });

  it("keeps a fully numeric priceBreakdown (coerced)", () => {
    const payload = makePayload();
    payload.cartLines[0].priceBreakdown = { totalRub: 12000, basePriceRub: 10000, helmetRub: 2000, depositRub: 20000 };
    payload.cartLines[0].lineTotal = 12000;
    sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(payload.cartLines[0].priceBreakdown).toMatchObject({ totalRub: 12000, helmetRub: 2000 });
  });

  it("does not touch a correct client value (fixed frontend)", () => {
    const payload = makePayload();
    payload.cartLines[0].lineTotal = 12000;
    payload.cartLines[0].priceBreakdown = { totalRub: 12000, basePriceRub: 10000, helmetRub: 2000, depositRub: 20000 };
    payload.subtotal = 12000;
    payload.totalAmount = 12000;
    const result = sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(result.healedLines).toBe(0);
    expect(payload.cartLines[0].lineTotal).toBe(12000);
    expect(payload.totalAmount).toBe(12000);
  });

  it("coerces a string-typed lineTotal (\"12000\") to the number 12000", () => {
    const payload = makePayload();
    payload.cartLines[0].lineTotal = "12000";
    const result = sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(payload.cartLines[0].lineTotal).toBe(12000);
    expect(typeof payload.cartLines[0].lineTotal).toBe("number");
    expect(result.healedLines).toBe(0);
  });

  it("never recomputes testdrive, sale or service lines", () => {
    const payload = makePayload();
    payload.cartLines = [
      { itemId: "yamaha-r7", qty: 1, lineTotal: 0, pricePerDay: 0, options: { action: "testdrive", duration: "10 минут", perk: "стандарт", rentStartDate: "2026-08-28", rentEndDate: "2026-08-28" } },
      { itemId: "yamaha-r7", qty: 1, lineTotal: 800000, pricePerDay: 800000, options: { action: "buy", duration: "покупка", perk: "стандарт", rentStartDate: "2026-08-28", rentEndDate: "2026-08-29" } },
      { itemId: "yamaha-r7", qty: 1, lineTotal: 2500, pricePerDay: 2500, options: { action: "service", perk: "стандарт" } },
    ];
    const result = sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(result.healedLines).toBe(0);
    expect(payload.cartLines.map((l) => l.lineTotal)).toEqual([0, 800000, 2500]);
  });

  it("skips recompute for non-bike items (equipment)", () => {
    const payload = makePayload();
    payload.cartLines[0].lineTotal = 500;
    const result = sanitizeFranchizeOrderMoneyFields(payload, makeById({ dailyPrice: "500" }, "equipment"), warn);
    expect(result.healedLines).toBe(0);
    expect(payload.cartLines[0].lineTotal).toBe(500);
  });

  it("skips recompute when the line has no picked dates", () => {
    const payload = makePayload();
    payload.cartLines[0].options.rentStartDate = undefined;
    payload.cartLines[0].lineTotal = 9000;
    const result = sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(result.healedLines).toBe(0);
    expect(payload.cartLines[0].lineTotal).toBe(9000);
  });

  it("recomputes with qty > 1 (2 bikes × 12000)", () => {
    const payload = makePayload();
    payload.cartLines[0].qty = 2;
    sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(payload.cartLines[0].lineTotal).toBe(24000);
    expect(payload.totalAmount).toBe(24000);
  });

  it("applies promo math: totalAmount = subtotal + extras − promoDiscount", () => {
    const payload = makePayload({
      promoDiscount: 1500,
      extras: [{ id: "priority-prep", label: "Приоритетная подготовка", amount: "1200" }],
    });
    sanitizeFranchizeOrderMoneyFields(payload, makeById(YAMAHA_R7_STRING_SPECS), warn);
    expect(payload.extrasTotal).toBe(1200);
    expect(payload.totalAmount).toBe(12000 + 1200 - 1500);
  });

  it("toFiniteNumber coerces, tolerates spaces/commas, falls back safely", () => {
    expect(toFiniteNumber("100002000")).toBe(100002000);
    expect(toFiniteNumber("10 000")).toBe(10000);
    expect(toFiniteNumber("12000,50")).toBe(12000.5);
    expect(toFiniteNumber(undefined, 77)).toBe(77);
    expect(toFiniteNumber("garbage", 77)).toBe(77);
    expect(toFiniteNumber(null)).toBe(0);
  });
});

describe("HOTFIX franchize-local calculator — calculatePriceForDuration string safety", () => {
  it("returns NUMBERS for string specs at every tier", () => {
    const cases: Array<{ hours: number; expected: number }> = [
      { hours: 1, expected: 1200 },
      { hours: 2, expected: 3600 }, // interpolation 1200 + (6000−1200)/2
      { hours: 3, expected: 6000 },
      { hours: 6, expected: 8000 },
      { hours: 12, expected: 9000 },
      { hours: 24, expected: 10000 },
    ];
    for (const { hours, expected } of cases) {
      const r = calculatePriceForDuration(YAMAHA_R7_STRING_SPECS, hours);
      expect(typeof r.price).toBe("number");
      expect(r.price).toBe(expected);
      expect(typeof r.rate).toBe("number");
    }
  });

  it("multi-day string tiers multiply numerically", () => {
    const r = calculatePriceForDuration(YAMAHA_R7_STRING_SPECS, 24 * 3);
    expect(r.price).toBe(27000); // rent_2_4d "9000" × 3
  });

  it("no NaN when price_per_hour is set but price_per_3h is missing (precedence fix)", () => {
    const r = calculatePriceForDuration({ price_per_hour: "1200" }, 2);
    expect(Number.isFinite(r.price)).toBe(true);
    expect(r.price).toBe(2400);
  });
});

describe("HOTFIX contract builder — string priceBreakdown is not trusted", () => {
  const CREW_SECRETS = {
    organizationName: "Мотосалон ВипБайкЭлектро",
    organizationShort: "ИП Воробьев Р.В.",
    organizationRepresentative: "ИП Воробьев Р.В.",
    issuerRepresentative: "Сидоров Илья Олегович",
    ogrnip: "326527500025145",
    inn: "525813643035",
    bankAccount: "40802810942710013083",
    bankName: "Волго-Вятский Банк ПАО Сбербанк",
    bankCity: "г. Нижний Новгород",
    bankCorrAccount: "30101810900000000603",
    email: "vip_bike@mail.ru",
    legalAddress: "г. Нижний Новгород, пл. Комсомольская 2",
    issuerName: "Воробьев Р.В.",
    signatoryRole: "Менеджер Мотосалона",
    returnAddress: "г. Нижний Новгород, пл. Комсомольская 2",
    contractDefaults: {} as Record<string, string>,
  };

  function buildVars(priceBreakdown?: Record<string, unknown>) {
    return buildRentalContractVariables({
      renter: {
        fullName: "Иванов Иван Иванович",
        phone: "+7 900 000-00-00",
      },
      bike: {
        id: "yamaha-r7",
        make: "Yamaha",
        model: "R7",
        type: "bike",
        specs: YAMAHA_R7_STRING_SPECS as Record<string, unknown>,
      },
      period: {
        startDate: "2026-08-28",
        startTime: "10:00",
        endDate: "2026-08-29",
        endTime: "10:00",
        dailyPrice: 10000,
      },
      crewSecrets: CREW_SECRETS,
      equipment: { helmets: 2 },
      ...(priceBreakdown ? { priceBreakdown } : {}),
    });
  }

  it("recomputes rent from STRING specs when no breakdown is given: 10000 + 2000 helmets + 20000 deposit", () => {
    const vars = buildVars();
    // rent (from specs, string-safe tier pricing) + equipment + deposit
    expect(vars.subtotal_rub).toBe("32000");
    expect(vars.deposit_rub).toBe("20000");
  });

  it("ignores a STRING-typed breakdown total (\"100002000\") and recomputes", () => {
    const vars = buildVars({ totalRub: "100002000", basePriceRub: "10000", helmetRub: 2000, depositRub: "20000" });
    expect(vars.subtotal_rub).toBe("32000");
  });

  it("trusts a numeric breakdown total (pre-existing override semantics)", () => {
    // NOTE: documented pre-existing semantics — the breakdown total is the
    // rent INCLUDING helmets, and equipment cost is added on top, so
    // 12000 + 2×1000 + 20000 = 34000. Only numeric totals are trusted.
    const vars = buildVars({ totalRub: 12000, basePriceRub: 10000, helmetRub: 2000, depositRub: 20000 });
    expect(vars.subtotal_rub).toBe("34000");
  });
});
