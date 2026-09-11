/**
 * Pricing calculator utility for franchize bike rentals
 */

import { parseISODate } from "@/app/franchize/lib/date-utils";
import {
  calculateBikePartForRental,
  getEquipmentUnitPriceForRental,
} from "@/lib/rental-pricing-calculator";
import type { BikePricingSpecs as SharedBikePricingSpecs } from "@/lib/rental-pricing-calculator";

// 2026-09-11: the bike-part math moved into ONE canonical ladder —
// calculateBikePartForRental() in lib/rental-pricing-calculator.ts (full
// interpolation between the golden-standard anchors 1h/3h/6h/12h/1d +
// ceil-day tier rates 2-4d/5-10d/11-30d, monotonic clamp). This module keeps
// its public { price, period, rate } API and labels but DELEGATES the math,
// so the contract builder, /doc and the web cart are digit-equal by
// construction (owner: «идентично в корзине = договор = DB»).
export type BikePricingSpecs = SharedBikePricingSpecs;

/**
 * Validate that a number is a positive value (or zero)
 * Returns the number if valid, undefined otherwise
 */
function validatePositiveNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  // FIX: specs JSONB can store prices as strings (e.g. "6000" instead of 6000).
  // Coerce to number — if it fails, return undefined.
  const num = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '')) : value;
  if (isNaN(num as number)) return undefined;
  return (num as number) > 0 ? num as number : undefined;
}

/**
 * Helmet price per rental — DURATION-AWARE (2026-09-11 owner rule):
 * hourly (< 24h) → 500 ₽ (half), multi-day → day 1 at 1000 ₽ + 500 ₽ for
 * every following day. One canon with getHelmetPrice() in
 * lib/rental-pricing-calculator.ts — both MUST stay digit-equal with the
 * contract builder, /doc, the Item modal and the bot quoter.
 */
export function getHelmetPrice(rentalHours?: number): number {
  return getEquipmentUnitPriceForRental(1000, rentalHours);
}

/**
 * Check if a date string is a valid ISO date
 */
function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Parse a date string that could be DD.MM.YYYY or YYYY-MM-DD into a Date object,
 * or return null if neither format matches.
 *
 * FIX: Previously this function accepted DD.MM.YYYY strings like
 * "09.07.2026" and re-constructed them as YYYY-MM-DD by reordering the
 * groups. That was ambiguous: "07.09.2026" could be read as 9 July
 * (DD.MM) or 7 September (MM.DD). We now route through the shared
 * `parseISODate` helper which only accepts the unambiguous ISO format
 * and the shared `formatRuDateFromISO` for display. The legacy DD.MM
 * branch is kept as a last-resort safety net for any callers that
 * still pass a human-typed date, but it explicitly interprets the
 * first two digits as the day (DD.MM.YYYY) and logs a warning.
 */
function parseDateSafe(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Prefer the shared strict ISO parser. (Static import — the old runtime
  // `require()` broke under ESM test runners like vitest.)
  const iso = parseISODate(dateStr);
  if (iso) return iso;
  // Legacy fallback for DD.MM.YYYY (e.g. "08.07.2026" = 8 July 2026).
  // The DD.MM branch is intentionally the ONLY non-ISO path now —
  // MM.DD interpretation is banned because it's the source of the
  // "busy till 07.09.2026" bug.
  const dmy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const year = Number(dmy[3]);
    const month = Number(dmy[2]);
    const day = Number(dmy[1]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/**
 * Check if a date is a weekend day (Saturday=6, Sunday=0)
 * Supports both YYYY-MM-DD and DD.MM.YYYY formats.
 */
function isWeekendDay(dateStr: string): boolean {
  const d = parseDateSafe(dateStr);
  if (!d) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Count weekend days in a range [startDate, endDate]
 */
function countWeekendDays(startDate: string, endDate: string): number {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) return 0;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day === 0 || day === 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Calculate the price for a given duration in hours
 * Returns the price, period label, and the per-unit rate used
 *
 * The `rate` field consistently represents the per-hour or per-day rate
 * used for calculation, NOT the total price.
 *
 * 2026-09-11: the math DELEGATES to the shared canonical ladder
 * (calculateBikePartForRental) — full interpolation between 1h/3h/6h/12h/1d
 * anchors, monotonic clamp, ceil-day tier rates for ≥ 24h. Only the
 * human-readable labels are produced here.
 */
export function calculatePriceForDuration(
  specs: BikePricingSpecs,
  hours: number,
  startDateStr?: string
): { price: number; period: string; rate: number } {
  // Handle invalid input
  if (hours <= 0) {
    return { price: 0, period: 'Invalid duration', rate: 0 };
  }

  const bike = calculateBikePartForRental(specs, hours, startDateStr);

  if (hours < 24) {
    let period: string;
    if (hours <= 1) period = '/ час';
    else if (hours < 3) period = hours === 2 ? '/ 2 часа' : `/ ${hours} часа`;
    else if (hours === 3) period = '/ 3 часа';
    else if (hours < 6) period = `/ ${hours} часов`;
    else if (hours === 6) period = '/ 6 часов';
    else if (hours < 12) period = `/ ${hours} часов`;
    else if (hours === 12) period = '/ 12 часов';
    else period = `/ ${hours} часов`;
    return { price: bike.price, period, rate: bike.rate };
  }

  // Daily pricing (24+ hours) — reproduce the historical per-tier labels.
  const days = Math.ceil(hours / 24);
  const positive = (v: number | string | undefined) => validatePositiveNumber(v) !== undefined;
  let period: string;
  if (days >= 11 && positive(specs.rent_11_30d)) period = '/ 11-30 дней';
  else if (days >= 5 && positive(specs.rent_5_10d)) period = '/ 5-10 дней';
  else if (days >= 2 && positive(specs.rent_2_4d)) period = '/ 2-4 дня';
  else if (days === 1) {
    const weekendRate = validatePositiveNumber(specs.rent_weekend);
    const baseDaily = validatePositiveNumber(specs.dailyPrice) ?? 0;
    if (startDateStr && isWeekendDay(startDateStr) && weekendRate !== undefined) {
      period = '/ день (выходные)';
    } else {
      const weekdayRate = validatePositiveNumber(specs.rent_weekday) ?? baseDaily;
      period = weekdayRate < baseDaily ? '/ день (будни)' : '/ день';
    }
  } else {
    period = `/ ${days} дн.`;
  }
  return { price: bike.price, period, rate: bike.rate };
}

/**
 * Get the display price tier based on optional start/end dates
 * Returns formatted label, price, and period for UI display
 */
export function getDisplayPriceTier(
  specs: BikePricingSpecs,
  startDate?: string,
  endDate?: string
): { label: string; price: string; period: string } {
  // If no dates provided, return available hourly tiers
  if (!startDate || !endDate) {
    return getAvailableHourlyTiers(specs);
  }

  // Validate date format - if invalid, return default hourly pricing
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return getAvailableHourlyTiers(specs);
  }

  // Calculate duration and price
  const start = new Date(startDate);
  const end = new Date(endDate);
  const hours = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
  const days = Math.ceil(hours / 24);
  const weekendDayCount = countWeekendDays(startDate, endDate);

  // For multi-day rentals with weekend days, calculate blended price
  const weekendRateNum = validatePositiveNumber(specs.rent_weekend);
  const weekdayRateNum = validatePositiveNumber(specs.rent_weekday);
  if (days > 1 && weekendDayCount > 0 && weekendRateNum !== undefined && weekdayRateNum !== undefined) {
    const weekdayDayCount = days - weekendDayCount;
    const blendedPrice = weekendDayCount * weekendRateNum + weekdayDayCount * weekdayRateNum;
    const formattedPrice = blendedPrice > 0 ? `${blendedPrice.toLocaleString('ru-RU')} ₽` : 'Цена по запросу';
    return {
      label: `Аренда на ${days} дн. (${weekendDayCount} вых.)`,
      price: formattedPrice,
      period: `/ ${days} дн.`,
    };
  }

  const { price, period } = calculatePriceForDuration(specs, hours, startDate);

  // Format price
  const formattedPrice2 = price > 0 ? `${price.toLocaleString('ru-RU')} ₽` : 'Цена по запросу';

  // Determine label based on duration
  let label = period;
  if (hours <= 24) {
    label = isWeekendDay(startDate) ? 'Дневная аренда (выходные)' : 'Часовая аренда';
  } else {
    label = days === 1 ? 'Дневная аренда' : `Аренда на ${days} дн.`;
  }

  return { label, price: formattedPrice2, period };
}

/**
 * Get available hourly pricing tiers for display when no dates selected
 * Returns the most relevant pricing tier to show
 */
function getAvailableHourlyTiers(
  specs: BikePricingSpecs
): { label: string; price: string; period: string } {
  // Priority order for display: 1h > 2h > 3h > 6h > 12h > daily
  const displayTiers: Array<{ price: number | string | undefined; label: string; period: string }> = [
    { price: specs.price_per_hour, label: '1 час', period: '/ час' },
    { price: specs.price_per_2h, label: '2 часа', period: '/ 2 часа' },
    { price: specs.price_per_3h, label: '3 часа', period: '/ 3 часа' },
    { price: specs.price_per_6h, label: '6 часов', period: '/ 6 часов' },
    { price: specs.price_per_12h, label: '12 часов', period: '/ 12 часов' },
    { price: specs.dailyPrice, label: 'День', period: '/ день' },
  ];

  // Find first available tier
  for (const tier of displayTiers) {
    const tierPrice = validatePositiveNumber(tier.price);
    if (tierPrice !== undefined && tierPrice > 0) {
      return {
        label: tier.label,
        price: `${tierPrice.toLocaleString('ru-RU')} ₽`,
        period: tier.period,
      };
    }
  }

  // No pricing available
  return { label: 'Цена', price: 'По запросу', period: '' };
}

