import { differenceInHours, differenceInDays } from "date-fns";

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
  | "6-hours"
  | "12-hours"
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
const HELMET_PRICE_HOURLY_RUB = 500;
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

/** Sum the priced extras (charger = 0). A truthy value counts as selected. */
export function calculateExtrasRub(extras?: RentalExtrasSelection): number {
  if (!extras) return 0;
  let sum = 0;
  for (const key of Object.keys(RENTAL_EXTRAS_PRICES_RUB) as RentalExtraKey[]) {
    const val = extras[key];
    if (val === true || (typeof val === "number" && val > 0)) {
      sum += RENTAL_EXTRAS_PRICES_RUB[key];
    }
  }
  return sum;
}

/**
 * Get helmet price based on rental tier.
 * Pure hourly rentals (< 3h): 500 ₽ per helmet
 * Tiered rentals (3h+, 6h, 12h, daily+): 1000 ₽ per helmet
 *
 * FIX (code review 2026-07-30): previously used `rentalHours < 24` which
 * charged 500 ₽ for 3-hour tiered rentals. The test expected 1000 ₽
 * because tiered rentals (3h, 6h) are effectively "half-day" or better
 * and should use the daily helmet price. Now we use the tier: if the
 * rental qualified for a 3h+ tier, charge the daily helmet price.
 */
export function getHelmetPrice(rentalHours: number): number {
  return rentalHours < 3 ? HELMET_PRICE_HOURLY_RUB : HELMET_PRICE_DAILY_RUB;
}

function normalizeHourlyRental(hours: number): {
  tier: PricingTier;
  rounded: boolean;
  displayHours: number;
} {
  if (hours <= 2) {
    return { tier: "hourly", rounded: false, displayHours: hours };
  }

  if (hours === 3) {
    return { tier: "3-hours", rounded: false, displayHours: 3 };
  }

  if (hours <= 5) {
    return { tier: "6-hours", rounded: true, displayHours: 6 };
  }

  if (hours === 6) {
    return { tier: "6-hours", rounded: false, displayHours: 6 };
  }

  if (hours <= 11) {
    return { tier: "12-hours", rounded: true, displayHours: 12 };
  }

  if (hours === 12) {
    return { tier: "12-hours", rounded: false, displayHours: 12 };
  }

  // > 12 hours = daily mode
  const days = Math.ceil(hours / 24);
  return { tier: "daily", rounded: false, displayHours: days * 24 };
}

function getHourlyPrice(specs: BikePricingSpecs, hours: number): number {
  // Exact tier matches (num() coerces string specs — see HOTFIX note above)
  if (hours === 2 && num(specs.price_per_2h)) return num(specs.price_per_2h)!;
  if (hours === 3 && num(specs.price_per_3h)) return num(specs.price_per_3h)!;
  if (hours === 6 && num(specs.price_per_6h)) return num(specs.price_per_6h)!;
  if (hours === 12 && num(specs.price_per_12h)) return num(specs.price_per_12h)!;

  const baseHourly = num(specs.price_per_hour) ?? DEFAULT_HOURLY_PRICE;

  // Interpolation for non-exact hours between tiers
  if (hours <= 1) return baseHourly * hours;
  if (hours < 3) {
    // Interpolate between price_per_hour and price_per_3h
    const perHour = num(specs.price_per_hour);
    const per3h = num(specs.price_per_3h);
    if (per3h && perHour) {
      return Math.round(perHour + (per3h - perHour) * (hours - 1) / 2);
    }
    return baseHourly * hours;
  }
  if (hours < 6) {
    // Interpolate between price_per_3h and price_per_6h
    const per3h = num(specs.price_per_3h);
    const per6h = num(specs.price_per_6h);
    if (per3h && per6h) {
      return Math.round(per3h + (per6h - per3h) * (hours - 3) / 3);
    }
    return num(specs.price_per_6h) ?? baseHourly * hours;
  }
  if (hours < 12) {
    // Interpolate between price_per_6h and price_per_12h
    const per6h = num(specs.price_per_6h);
    const per12h = num(specs.price_per_12h);
    if (per6h && per12h) {
      return Math.round(per6h + (per12h - per6h) * (hours - 6) / 6);
    }
    return num(specs.price_per_12h) ?? baseHourly * hours;
  }

  return baseHourly * hours;
}

function getDailyPrice(
  specs: BikePricingSpecs,
  days: number,
  weekendDayCount: number = 0,
  startDateStr?: string,
): number {
  if (days === 1) {
    // For single-day rentals: check if the START day is a weekend,
    // NOT whether any day in [start, end] is a weekend.
    // A rental from Friday 10am → Saturday 10am is a Friday rental
    // (the bike is returned Saturday morning, the weekend hasn't started
    // for rental purposes). The old logic used weekendDayCount which
    // counts inclusively and would see Saturday in the range → wrong.
    if (startDateStr) {
      const startDay = new Date(startDateStr + "T00:00:00").getDay();
      const isStartWeekend = startDay === 0 || startDay === 6;
      const weekendRate = num(specs.rent_weekend);
      if (isStartWeekend && weekendRate) {
        return weekendRate;
      }
    }
    return num(specs.dailyPrice) ?? num(specs.rent_weekday) ?? DEFAULT_DAILY_PRICE;
  }

  if (days >= 2 && days <= 4) {
    return (num(specs.rent_2_4d) ?? num(specs.dailyPrice) ?? DEFAULT_DAILY_PRICE) * days;
  }

  if (days >= 5 && days <= 10) {
    return (num(specs.rent_5_10d) ?? num(specs.dailyPrice) ?? DEFAULT_DAILY_PRICE) * days;
  }

  if (days >= 11 && days <= 30) {
    return (num(specs.rent_11_30d) ?? num(specs.dailyPrice) ?? DEFAULT_DAILY_PRICE) * days;
  }

  return (num(specs.dailyPrice) ?? DEFAULT_DAILY_PRICE) * days;
}

/**
 * Count how many weekend days (Sat=6, Sun=0) fall within [startDate, endDate].
 * Used to apply rent_weekend rate proportionally for multi-day rentals.
 */
function countWeekendDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getPricingTier(hours: number, days: number): PricingTier {
  if (hours < 24) {
    const normalized = normalizeHourlyRental(hours);
    return normalized.tier;
  }

  if (days === 1) return "daily";
  if (days >= 2 && days <= 4) return "multi-day-2-4";
  if (days >= 5 && days <= 10) return "multi-day-5-10";
  if (days >= 11 && days <= 30) return "multi-day-11-30";

  return "daily";
}

function calculateBasePrice(
  specs: BikePricingSpecs,
  hours: number,
  days: number,
  weekendDayCount: number = 0,
  startDateStr?: string,
): {
  price: number;
  tier: PricingTier;
  baseDailyRate: number;
} {
  if (hours < 24) {
    const normalized = normalizeHourlyRental(hours);
    const price = getHourlyPrice(specs, normalized.displayHours);
    return { price, tier: normalized.tier, baseDailyRate: price / normalized.displayHours };
  }

  // Multi-day: blend weekend rate for weekend days + weekday rate for weekday days
  if (days > 1 && weekendDayCount > 0 && specs.rent_weekend && specs.rent_weekday) {
    const weekendRate = num(specs.rent_weekend)!;
    const weekdayRate = num(specs.rent_weekday)!;
    const weekdayDayCount = days - weekendDayCount;
    const price = weekendDayCount * weekendRate + weekdayDayCount * weekdayRate;
    const tier = getPricingTier(hours, days);
    const baseDailyRate = (weekendDayCount * weekendRate + weekdayDayCount * weekdayRate) / days;
    return { price, tier, baseDailyRate };
  }

  const price = getDailyPrice(specs, days, weekendDayCount, startDateStr);
  const tier = getPricingTier(hours, days);
  const baseDailyRate = num(specs.dailyPrice) ?? num(specs.rent_weekday) ?? DEFAULT_DAILY_PRICE;

  return { price, tier, baseDailyRate };
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
  const days = differenceInDays(end, start);

  // HOTFIX: helmetCount must be numeric too — a string count ("2") would
  // make helmetRub = "2" * 1000 = 2000 via coercion today, but any future
  // `+` usage would concatenate. Coerce once at entry.
  const helmets = num(helmetCount) ?? 0;

  const normalized = normalizeHourlyRental(hours);
  const weekendDayCount = countWeekendDays(startDate, endDate);
  const { price, tier, baseDailyRate } = calculateBasePrice(
    specs,
    normalized.displayHours,
    days,
    weekendDayCount,
    startDate,
  );

  const helmetRub = helmets * getHelmetPrice(hours);
  const extrasRub = calculateExtrasRub(extras);
  const depositRub = num(specs.deposit_rub) ?? DEFAULT_DEPOSIT_RUB;
  // HOTFIX: `price` and `helmetRub` are guaranteed numbers now. Previously,
  // with string specs (dailyPrice: "10000") `price` was the raw string and
  // this line produced "100002000" — the string-sum bug every consumer
  // (modal, cart, order page, contract) inherited.
  // FIX (2026-08-29): extrasRub joins the sum — gloves etc. are no longer free.
  const totalRub = price + helmetRub + extrasRub;

  let savingsRub = 0;
  let savingsPercent = 0;

  if (hours < 24) {
    // Hourly: compare vs hourly rate
    const baseHourly = num(specs.price_per_hour) ?? DEFAULT_HOURLY_PRICE;
    const fullPrice = baseHourly * hours;
    savingsRub = Math.max(0, fullPrice - price);
    if (fullPrice > 0) {
      savingsPercent = Math.round((savingsRub / fullPrice) * 100);
    }
  } else {
    // Daily: compare vs base daily rate
    const fullPrice = baseDailyRate * days;
    savingsRub = Math.max(0, fullPrice - price);
    if (fullPrice > 0) {
      savingsPercent = Math.round((savingsRub / fullPrice) * 100);
    }
  }

  let period = "";
  if (hours < 24) {
    period = `${normalized.displayHours} час${normalized.displayHours === 1 ? "" : "ов"}`;
  } else {
    period = `${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`;
  }

  return {
    totalRub,
    basePriceRub: price,
    helmetRub,
    extrasRub,
    depositRub,
    savingsRub,
    savingsPercent,
    tier,
    breakdown: {
      period,
      ratePerPeriod: `${Math.round(baseDailyRate).toLocaleString("ru-RU")} ₽/${hours < 24 ? "час" : "день"}`,
      periods: hours < 24 ? normalized.displayHours : days,
    },
    rounded: normalized.rounded,
    displayHours: normalized.displayHours,
  };
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
