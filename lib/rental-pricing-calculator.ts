import { differenceInHours } from "date-fns";

export interface BikePricingSpecs {
  price_per_hour?: number | string;
  price_per_2h?: number | string;
  price_per_3h?: number | string;
  price_per_6h?: number | string;
  price_per_12h?: number | string;
  dailyPrice?: number | string;
  rent_weekday?: number | string;
  rent_weekend?: number | string;
  rent_2_4d?: number | string;
  rent_5_10d?: number | string;
  rent_11_30d?: number | string;
  deposit_rub?: number | string;
}

/**
 * HOTFIX (2026-08-28, "prices summed as strings"): specs JSONB in Supabase
 * stores price fields as TEXT for many bikes (e.g. yamaha-r7 has
 * dailyPrice: "10000", not 10000). Every arithmetic read of a spec value
 * MUST go through `num()` — a raw `specs.dailyPrice + helmetRub` on a string
 * spec concatenates ("10000" + 2000 → "100002000") instead of adding.
 * Returns undefined when the value is missing / not finite / <= 0 so the
 * existing `?? fallback` chains keep working unchanged.
 */
export function num(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const raw = typeof value === "string"
    ? Number(value.replace(/\s/g, "").replace(",", "."))
    : Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return raw;
}

export type PricingTier =
  | "hourly"
  | "3-hours"
  /** 3–6h and 6–12h windows: interpolated between the surrounding tier
   * anchors (owner 2026-09-11: «more complex interpolation is needed between
   * prices of 3h, 6h, 12h, 1d, 2-4d, 5-13d and 14-30d» — see
   * docs/gold-standard-ice-bike-spec-schema.md §1.8/§8.1 for the ladder). */
  | "3-6-hours"
  | "6-hours"
  | "6-12-hours"
  | "12-hours"
  /** 13–23h window: interpolated between the 12h tier and the daily rate. */
  | "extended-hours"
  | "daily"
  | "multi-day-2-4"
  | "multi-day-5-10"
  | "multi-day-11-30";

export interface PricingResult {
  totalRub: number;
  basePriceRub: number;
  helmetRub: number;
  /** Non-helmet extras (gloves, jacket, pants, boots, net, backpack, bag). Charger is free (0). */
  extrasRub: number;
  depositRub: number;
  savingsRub: number;
  savingsPercent: number;
  tier: PricingTier;
  breakdown: {
    period: string;
    ratePerPeriod: string;
    periods: number;
  };
  rounded?: boolean;
  displayHours?: number;
}

const HELMET_PRICE_DAILY_RUB = 1000;
/** Kept for backward-compatible imports; the hourly helmet price is retired
 *  (2026-09-10) — getHelmetPrice() now always returns HELMET_PRICE_DAILY_RUB. */
export const HELMET_PRICE_HOURLY_RUB = HELMET_PRICE_DAILY_RUB;
const DEFAULT_DEPOSIT_RUB = 20000;
const DEFAULT_DAILY_PRICE = 10000;
const DEFAULT_HOURLY_PRICE = 1000; // v2 formula: 10% of daily

/**
 * FIX (2026-08-29, "gloves not priced"): the calculator used to price ONLY
 * helmets — gloves/jacket/pants/boots/net/backpack/bag were silently FREE
 * in the cart and order (the Item modal added them locally, so modal and
 * cart disagreed: modal 13 500 ₽, cart 13 000 ₽). Single source of truth for
 * extra-equipment pricing — must stay in sync with the contract builder
 * (app/lib/rental-contract-vars.ts equipmentCostTotal) and the Item modal's
 * ADDITIONAL_ITEMS table.
 */
export const RENTAL_EXTRAS_PRICES_RUB: Record<RentalExtraKey, number> = {
  gloves: 500,
  jacket: 500,
  pants: 500,
  boots: 500,
  net: 500,
  backpack: 500,
  bag: 500,
  charger: 0, // free — tracked for return only
};

export type RentalExtraKey = "gloves" | "jacket" | "pants" | "boots" | "net" | "backpack" | "bag" | "charger";

/** Extras selection passed to calculatePrice — booleans, mirrors the modal's toggles. */
export type RentalExtrasSelection = Partial<Record<RentalExtraKey, boolean | number>>;

/** Sum the priced extras (charger = 0). A truthy value counts as selected.
 *  2026-09-11 canon: gear pro-rates with the rental duration — hourly (< 24h)
 *  is half price, multi-day charges day 1 full + every following day half.
 *  Without a duration the full single-day price applies. */
export function calculateExtrasRub(extras?: RentalExtrasSelection, rentalHours?: number): number {
  if (!extras) return 0;
  let sum = 0;
  for (const key of Object.keys(RENTAL_EXTRAS_PRICES_RUB) as RentalExtraKey[]) {
    const val = extras[key];
    if (val === true || (typeof val === "number" && val > 0)) {
      sum += getEquipmentUnitPriceForRental(RENTAL_EXTRAS_PRICES_RUB[key], rentalHours);
    }
  }
  return sum;
}

/**
 * Get helmet price per rental — DURATION-AWARE (2026-09-11 owner rule).
 *
 * Base (fixed) prices per tariff: helmet 1000 ₽, other gear 500 ₽ per unit.
 * Pro-rating:
 *   • rental shorter than a day (hourly, < 24h) → HALF price (helmet 500,
 *     other gear 250) — the bike is back the same day, the gear is used once;
 *   • multi-day → day 1 at FULL price, every following day HALF
 *     (helmet 1000 + 500 × (days − 1), other gear 500 + 250 × (days − 1)).
 *
 * HISTORY: the original rule was `rentalHours < 3 ? 500 : 1000`; on
 * 2026-09-10 the owner asked for FLAT 1000 everywhere to stop the split
 * drift; on 2026-09-11 the canon was finalized as the pro-rating above —
 * «проверь, что при почасовой аренде снаряжение всё ещё в половину цены
 * (шлем 500 вместо 1000, остальное 250 вместо 500), а при нескольких сутках
 * цена снаряжения уменьшается вдвое со 2-х суток». This function and
 * getOtherGearUnitPrice() are the ONE canon — the contract builder, /doc,
 * the Item modal and the bot quoter must all match it digit-for-digit.
 */
export function getHelmetPrice(rentalHours?: number): number {
  return getEquipmentUnitPriceForRental(HELMET_PRICE_DAILY_RUB, rentalHours);
}

/**
 * Per-unit price of a piece of gear for a WHOLE rental (2026-09-11 canon):
 *   hourly (< 24h) → base / 2;  multi-day → base + base/2 × (days − 1).
 * Missing/invalid duration falls back to a single full-price day (standalone
 * gear rentals without a bike window).
 */
export function getEquipmentUnitPriceForRental(baseRub: number, rentalHours?: number): number {
  const hours = Number(rentalHours);
  if (!Number.isFinite(hours) || hours <= 0) return baseRub;
  if (hours < 24) return Math.round(baseRub / 2);
  const days = Math.max(1, Math.ceil(hours / 24));
  return baseRub + Math.round(baseRub / 2) * (days - 1);
}

/** Base (fixed) unit price for non-helmet gear — one table with RENTAL_EXTRAS_PRICES_RUB. */
export function getOtherGearUnitPrice(rentalHours?: number): number {
  return getEquipmentUnitPriceForRental(500, rentalHours);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CANONICAL BIKE-PART LADDER (2026-09-11, owner: «more complex interpolation
// is needed between prices of 3h, 6h, 12h, 1d, 2-4d, 5-13d and 14-30d»)
// ─────────────────────────────────────────────────────────────────────────────────
//
// ONE piecewise-linear ladder built on the golden-standard spec anchors
// (docs/gold-standard-ice-bike-spec-schema.md §1.8 + §8.1):
//
//   price_per_hour (1h) → price_per_3h → price_per_6h → price_per_12h
//   → dailyPrice (24h)  → rent_2_4d → rent_5_10d → rent_11_30d (per-day)
//
// Rules baked in here (cart == contract == DB, digit-for-digit):
//   • 0 < h < 24 — linear interpolation between the two surrounding HOURLY
//     anchors; missing anchors fall back to the contract builder's chains
//     (per-hour × h, per-3h/3 × h, …) and the result is CLAMPED to the
//     [prev-anchor, next-anchor] window so a fallback can never price a
//     shorter rental above the next tier (the golden ladder must stay
//     monotonic: per_hour < per_3h < per_6h < per_12h < daily).
//   • h ≥ 24 — days = Math.ceil(h / 24) (the contract builder's rule; the
//     old cart floored via differenceInDays, so a 30h rental was charged
//     1 day in the cart but 2 days in the contract), then the per-day tier
//     rate (rent_2_4d / rent_5_10d / rent_11_30d) × days; a single day
//     checks the weekend rate on the START date. No weekend blending for
//     multi-day — the contract charges tier rates as-is.

export interface BikePartCalculation {
  price: number;
  tier: PricingTier;
  /** Hourly: price/hours. Multi-day: the per-day tier rate that was charged. */
  rate: number;
  /** Charged days for h ≥ 24 (ceil), else 0. */
  days: number;
}

/** Keep the ladder monotonic: never above the next anchor, never below the
 *  previous one. Bad data (lower ≥ upper) skips the clamp instead of lying. */
function clampToLadder(price: number, lower?: number, upper?: number): number {
  if (lower !== undefined && upper !== undefined && lower >= upper) return price;
  if (upper !== undefined && price > upper) return upper;
  if (lower !== undefined && price < lower) return lower;
  return price;
}

function isWeekendStartDate(startDateStr?: string): boolean {
  if (!startDateStr) return false;
  const day = new Date(startDateStr + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

export function calculateBikePartForRental(
  specs: BikePricingSpecs,
  hours: number,
  startDateStr?: string,
): BikePartCalculation {
  if (!Number.isFinite(hours) || hours <= 0) {
    return { price: 0, tier: "hourly", rate: 0, days: 0 };
  }

  // num() coerces string specs — see the HOTFIX note above.
  const perHour = num(specs.price_per_hour);
  const per2h = num(specs.price_per_2h);
  const per3h = num(specs.price_per_3h);
  const per6h = num(specs.price_per_6h);
  const per12h = num(specs.price_per_12h);
  const daily = num(specs.dailyPrice) ?? num(specs.rent_weekday);
  const hourlyFallback = perHour ?? daily ?? DEFAULT_HOURLY_PRICE;

  if (hours < 24) {
    let price: number;
    let tier: PricingTier;
    let lower: number | undefined;
    let upper: number | undefined;

    if (hours <= 1) {
      price = Math.round(hourlyFallback * hours);
      tier = "hourly";
      upper = per3h;
    } else if (hours < 3) {
      if (hours === 2 && per2h) {
        price = per2h;
      } else if (perHour && per3h) {
        price = Math.round(perHour + (per3h - perHour) * (hours - 1) / 2);
      } else {
        // Contract fallback chain: per-hour → pro-rated 3h tier → daily.
        const rate = perHour ?? (per3h ? per3h / 3 : (daily ?? DEFAULT_HOURLY_PRICE));
        price = Math.round(rate * hours);
      }
      tier = "hourly";
      lower = perHour ?? (per3h ? per3h / 3 : undefined);
      upper = per3h;
    } else if (hours === 3) {
      price = per3h ?? Math.round(hourlyFallback * 3);
      tier = "3-hours";
      lower = perHour;
      upper = per6h;
    } else if (hours < 6) {
      if (per3h && per6h) {
        price = Math.round(per3h + (per6h - per3h) * (hours - 3) / 3);
      } else if (per3h) {
        price = Math.round(per3h / 3 * hours);
      } else {
        price = Math.round(hourlyFallback * hours);
      }
      tier = "3-6-hours";
      lower = per3h ?? perHour;
      upper = per6h;
    } else if (hours === 6) {
      price = per6h ?? (per3h ? Math.round(per3h / 3 * 6) : Math.round(hourlyFallback * 6));
      tier = "6-hours";
      lower = per3h;
      upper = per12h;
    } else if (hours < 12) {
      if (per6h && per12h) {
        price = Math.round(per6h + (per12h - per6h) * (hours - 6) / 6);
      } else if (per6h) {
        price = Math.round(per6h / 6 * hours);
      } else {
        price = Math.round(hourlyFallback * hours);
      }
      tier = "6-12-hours";
      lower = per6h ?? per3h ?? perHour;
      upper = per12h;
    } else if (hours === 12) {
      price = per12h ?? (per6h ? Math.round(per6h / 6 * 12) : Math.round(hourlyFallback * 12));
      tier = "12-hours";
      lower = per6h;
      upper = daily;
    } else {
      // 13–23h: interpolate 12h → daily (the aprilia-shiver 14h fix, now the
      // general rule shared with the contract builder).
      if (per12h && daily) {
        price = Math.round(per12h + (daily - per12h) * (hours - 12) / 12);
      } else if (daily) {
        price = daily;
      } else {
        price = Math.round(hourlyFallback * hours);
      }
      tier = "extended-hours";
      lower = per12h ?? per6h ?? perHour;
      upper = daily;
    }

    price = clampToLadder(price, lower, upper);
    return { price, tier, rate: price / hours, days: 0 };
  }

  // ≥ 24 hours — day tiers, ceil (contract parity; see the block comment).
  const days = Math.ceil(hours / 24);
  let rate: number;
  let tier: PricingTier;
  if (days >= 11 && num(specs.rent_11_30d) !== undefined) {
    rate = num(specs.rent_11_30d)!;
    tier = "multi-day-11-30";
  } else if (days >= 5 && num(specs.rent_5_10d) !== undefined) {
    rate = num(specs.rent_5_10d)!;
    tier = "multi-day-5-10";
  } else if (days >= 2 && num(specs.rent_2_4d) !== undefined) {
    rate = num(specs.rent_2_4d)!;
    tier = "multi-day-2-4";
  } else if (days === 1) {
    // Single charged day: the weekend rate applies when the START day is a
    // weekend (Fri 10am → Sat 10am is a Friday rental).
    const weekendRate = num(specs.rent_weekend);
    rate = isWeekendStartDate(startDateStr) && weekendRate
      ? weekendRate
      : num(specs.rent_weekday) ?? num(specs.dailyPrice) ?? DEFAULT_DAILY_PRICE;
    tier = "daily";
  } else {
    rate = num(specs.dailyPrice) ?? num(specs.rent_weekday) ?? DEFAULT_DAILY_PRICE;
    tier = days >= 11 ? "multi-day-11-30" : days >= 5 ? "multi-day-5-10" : days >= 2 ? "multi-day-2-4" : "daily";
  }
  return { price: Math.round(rate * days), tier, rate, days };
}

export function calculatePrice(
  specs: BikePricingSpecs,
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  helmetCount: number,
  /** FIX (2026-08-29): non-helmet extras (gloves, jacket, …) — priced flat
   *  per item, charger free. Optional so every existing caller keeps working. */
  extras?: RentalExtrasSelection,
): PricingResult {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);

  const hours = differenceInHours(end, start);

  // HOTFIX: helmetCount must be numeric too — a string count ("2") would
  // make helmetRub = "2" * 1000 = 2000 via coercion today, but any future
  // `+` usage would concatenate. Coerce once at entry.
  const helmets = num(helmetCount) ?? 0;

  // 2026-09-11: ONE canonical ladder for the bike part — full interpolation
  // between the golden-standard anchors for < 24h, ceil-day tier rates for
  // ≥ 24h. Identical math now lives in the contract builder
  // (calculatePriceForDuration delegates here), so cart == contract == DB.
  const bike = calculateBikePartForRental(specs, hours, startDate);

  const helmetRub = helmets * getHelmetPrice(hours);
  // 2026-09-11 canon: non-helmet gear pro-rates with the SAME duration rule
  // as the helmet (half price under 24h, day-1-full + half from day 2) so the
  // cart, the modal, /doc, the contract and the bot quoter stay digit-equal.
  const extrasRub = calculateExtrasRub(extras, hours);
  const depositRub = num(specs.deposit_rub) ?? DEFAULT_DEPOSIT_RUB;
  // HOTFIX: bike.price and helmetRub are guaranteed numbers now. Previously,
  // with string specs (dailyPrice: "10000") `price` was the raw string and
  // the sum produced "100002000" — the string-sum bug every consumer
  // (modal, cart, order page, contract) inherited.
  const totalRub = bike.price + helmetRub + extrasRub;

  let savingsRub = 0;
  let savingsPercent = 0;

  if (hours < 24) {
    // Hourly: compare vs straight hourly multiplication
    const baseHourly = num(specs.price_per_hour) ?? num(specs.dailyPrice) ?? DEFAULT_HOURLY_PRICE;
    const fullPrice = baseHourly * hours;
    savingsRub = Math.max(0, Math.round(fullPrice - bike.price));
    if (fullPrice > 0) {
      savingsPercent = Math.round((savingsRub / fullPrice) * 100);
    }
  } else {
    // Daily: compare vs base daily rate × charged days
    const baseDailyRate = num(specs.dailyPrice) ?? num(specs.rent_weekday) ?? DEFAULT_DAILY_PRICE;
    const fullPrice = baseDailyRate * bike.days;
    savingsRub = Math.max(0, fullPrice - bike.price);
    if (fullPrice > 0) {
      savingsPercent = Math.round((savingsRub / fullPrice) * 100);
    }
  }

  const period = hours < 24
    ? formatHoursLabel(hours)
    : `${bike.days} ${bike.days === 1 ? "день" : bike.days < 5 ? "дня" : "дней"}`;

  return {
    totalRub,
    basePriceRub: bike.price,
    helmetRub,
    extrasRub,
    depositRub,
    savingsRub,
    savingsPercent,
    tier: bike.tier,
    breakdown: {
      period,
      ratePerPeriod: hours < 24
        ? `${Math.round(bike.price / hours).toLocaleString("ru-RU")} ₽/час`
        : `${Math.round(bike.rate).toLocaleString("ru-RU")} ₽/день`,
      periods: hours < 24 ? hours : bike.days,
    },
    // Legacy fields: the ladder no longer rounds up (4–5h no longer bills the
    // 6h tier, 7–11h no longer bills the 12h tier) — `rounded` is always false
    // and displayHours carries the ACTUAL rental window.
    rounded: false,
    displayHours: hours < 24 ? hours : bike.days * 24,
  };
}

function formatHoursLabel(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString("ru-RU");
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  let unit = "часов";
  if (mod10 === 1 && mod100 !== 11) unit = "час";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) unit = "часа";
  return `${value} ${unit}`;
}

export function validateBikePricing(specs: BikePricingSpecs): {
  valid: boolean;
  reason?: string;
  needsAdminFix?: boolean;
} {
  const hasAnyPricing = !!(
    num(specs.dailyPrice) ||
    num(specs.price_per_hour) ||
    num(specs.rent_weekday) ||
    num(specs.rent_2_4d) ||
    num(specs.rent_5_10d) ||
    num(specs.rent_11_30d)
  );

  if (!hasAnyPricing) {
    return {
      valid: false,
      reason: "No pricing data",
      needsAdminFix: true,
    };
  }

  return { valid: true };
}
