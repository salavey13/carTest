import { differenceInHours, differenceInDays } from "date-fns";

export interface BikePricingSpecs {
  price_per_hour?: number;
  price_per_3h?: number;
  price_per_6h?: number;
  price_per_12h?: number;
  dailyPrice?: number;
  rent_weekday?: number;
  rent_2_4d?: number;
  rent_5_10d?: number;
  rent_11_30d?: number;
  deposit_rub?: number;
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

const HELMET_PRICE_RUB = 1000;
const DEFAULT_DEPOSIT_RUB = 20000;
const DEFAULT_DAILY_PRICE = 10000;
const DEFAULT_HOURLY_PRICE = 2000;

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
  if (hours === 3 && specs.price_per_3h) return specs.price_per_3h;
  if (hours === 6 && specs.price_per_6h) return specs.price_per_6h;
  if (hours === 12 && specs.price_per_12h) return specs.price_per_12h;

  const baseHourly = specs.price_per_hour ?? DEFAULT_HOURLY_PRICE;
  if (hours <= 2) return baseHourly * hours;
  if (hours <= 6) return specs.price_per_6h ?? baseHourly * 6;
  if (hours <= 12) return specs.price_per_12h ?? baseHourly * 12;

  return baseHourly * hours;
}

function getDailyPrice(specs: BikePricingSpecs, days: number): number {
  if (days === 1) {
    return specs.dailyPrice ?? specs.rent_weekday ?? DEFAULT_DAILY_PRICE;
  }

  if (days >= 2 && days <= 4) {
    return (specs.rent_2_4d ?? specs.dailyPrice ?? DEFAULT_DAILY_PRICE) * days;
  }

  if (days >= 5 && days <= 10) {
    return (specs.rent_5_10d ?? specs.dailyPrice ?? DEFAULT_DAILY_PRICE) * days;
  }

  if (days >= 11 && days <= 30) {
    return (specs.rent_11_30d ?? specs.dailyPrice ?? DEFAULT_DAILY_PRICE) * days;
  }

  return (specs.dailyPrice ?? DEFAULT_DAILY_PRICE) * days;
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

function calculateBasePrice(specs: BikePricingSpecs, hours: number, days: number): {
  price: number;
  tier: PricingTier;
  baseDailyRate: number;
} {
  if (hours < 24) {
    const normalized = normalizeHourlyRental(hours);
    const price = getHourlyPrice(specs, normalized.displayHours);
    return { price, tier: normalized.tier, baseDailyRate: price / normalized.displayHours };
  }

  const price = getDailyPrice(specs, days);
  const tier = getPricingTier(hours, days);
  const baseDailyRate = specs.dailyPrice ?? specs.rent_weekday ?? DEFAULT_DAILY_PRICE;

  return { price, tier, baseDailyRate };
}

export function calculatePrice(
  specs: BikePricingSpecs,
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  helmetCount: number
): PricingResult {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);

  const hours = differenceInHours(end, start);
  const days = differenceInDays(end, start);

  const normalized = normalizeHourlyRental(hours);
  const { price, tier, baseDailyRate } = calculateBasePrice(specs, normalized.displayHours, days);

  const helmetRub = helmetCount * HELMET_PRICE_RUB;
  const depositRub = specs.deposit_rub ?? DEFAULT_DEPOSIT_RUB;
  const totalRub = price + helmetRub;

  let savingsRub = 0;
  let savingsPercent = 0;

  if (hours < 24) {
    // Hourly: compare vs hourly rate
    const baseHourly = specs.price_per_hour ?? DEFAULT_HOURLY_PRICE;
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
    specs.dailyPrice ||
    specs.price_per_hour ||
    specs.rent_weekday ||
    specs.rent_2_4d ||
    specs.rent_5_10d ||
    specs.rent_11_30d
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
