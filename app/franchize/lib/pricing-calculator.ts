/**
 * Pricing calculator utility for franchize bike rentals
 */

export interface BikePricingSpecs {
  price_per_hour?: number;
  price_per_3h?: number;
  price_per_6h?: number;
  price_per_12h?: number;
  dailyPrice?: number;
  rent_weekday?: number;
  rent_weekend?: number;
  rent_2_4d?: number;
  rent_5_10d?: number;
  rent_11_30d?: number;
  deposit_rub?: number;
}

/**
 * Validate that a number is a positive value (or zero)
 * Returns the number if valid, undefined otherwise
 */
function validatePositiveNumber(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return value > 0 ? value : undefined;
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
 */
function parseDateSafe(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try YYYY-MM-DD first (ISO format)
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  // Try DD.MM.YYYY (Russian format)
  const dmy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
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

  // Hourly pricing tiers
  if (hours <= 1) {
    const perHourRate = validatePositiveNumber(specs.price_per_hour) ?? validatePositiveNumber(specs.dailyPrice) ?? 0;
    return { price: perHourRate * hours, period: '/ час', rate: perHourRate };
  }

  if (hours <= 3) {
    // Prefer 3h tier price, fallback to hourly × 3
    if (validatePositiveNumber(specs.price_per_3h) !== undefined) {
      const rate = specs.price_per_3h! / 3; // Per-hour rate from 3h tier
      return { price: specs.price_per_3h!, period: '/ 3 часа', rate };
    }
    const perHourRate = validatePositiveNumber(specs.price_per_hour) ?? validatePositiveNumber(specs.dailyPrice) ?? 0;
    return { price: perHourRate * 3, period: '/ 3 часа', rate: perHourRate };
  }

  if (hours <= 6) {
    // Prefer 6h tier price, fallback to 3h tier × 2, or hourly × 6
    if (validatePositiveNumber(specs.price_per_6h) !== undefined) {
      const rate = specs.price_per_6h! / 6; // Per-hour rate from 6h tier
      return { price: specs.price_per_6h!, period: '/ 6 часов', rate };
    }
    if (validatePositiveNumber(specs.price_per_3h) !== undefined) {
      const perHourRate = specs.price_per_3h! / 3;
      const price = perHourRate * 6;
      return { price, period: '/ 6 часов', rate: perHourRate };
    }
    const perHourRate = validatePositiveNumber(specs.price_per_hour) ?? validatePositiveNumber(specs.dailyPrice) ?? 0;
    return { price: perHourRate * 6, period: '/ 6 часов', rate: perHourRate };
  }

  if (hours <= 12) {
    // Prefer 12h tier price, fallback to 6h tier × 2, or hourly × 12
    if (validatePositiveNumber(specs.price_per_12h) !== undefined) {
      const rate = specs.price_per_12h! / 12; // Per-hour rate from 12h tier
      return { price: specs.price_per_12h!, period: '/ 12 часов', rate };
    }
    if (validatePositiveNumber(specs.price_per_6h) !== undefined) {
      const perHourRate = specs.price_per_6h! / 6;
      const price = perHourRate * 12;
      return { price, period: '/ 12 часов', rate: perHourRate };
    }
    const perHourRate = validatePositiveNumber(specs.price_per_hour) ?? validatePositiveNumber(specs.dailyPrice) ?? 0;
    return { price: perHourRate * 12, period: '/ 12 часов', rate: perHourRate };
  }

  // Daily pricing (more than 12 hours)
  const days = Math.ceil(hours / 24);
  // Compute weekend days if startDate is available
  return calculatePriceForDays(specs, days, startDateStr);
}

/**
 * Calculate price for a specific number of days
 * Internal helper for daily/multi-day pricing
 *
 * Multi-day tier prices (rent_2_4d, rent_5_10d, rent_11_30d) are treated as PER-DAY rates
 * and multiplied by the actual number of days.
 *
 * The `rate` field consistently represents the per-day rate used.
 */
function calculatePriceForDays(
  specs: BikePricingSpecs,
  days: number,
  startDateStr?: string
): { price: number; period: string; rate: number } {
  if (days <= 0) {
    return { price: 0, period: 'Invalid duration', rate: 0 };
  }

  // Determine the base per-day rate based on tier and weekday logic
  let perDayRate: number;
  let periodLabel: string;

  // Multi-day tiered pricing (per-day rates, multiplied by actual days)
  // Note: Weekday discount is NOT applied to multi-day rentals because:
  // - We don't have actual rental dates to count weekdays vs weekends
  // - Applying weekday rate to all days would incorrectly discount weekends
  // - Future enhancement: pass actual dates to calculate proper weekday/weekend mix
  if (days >= 11 && validatePositiveNumber(specs.rent_11_30d) !== undefined) {
    perDayRate = specs.rent_11_30d!;
    periodLabel = '/ 11-30 дней';
    return { price: perDayRate * days, period: periodLabel, rate: perDayRate };
  }

  if (days >= 5 && validatePositiveNumber(specs.rent_5_10d) !== undefined) {
    perDayRate = specs.rent_5_10d!;
    periodLabel = '/ 5-10 дней';
    return { price: perDayRate * days, period: periodLabel, rate: perDayRate };
  }

  if (days >= 2 && validatePositiveNumber(specs.rent_2_4d) !== undefined) {
    perDayRate = specs.rent_2_4d!;
    periodLabel = '/ 2-4 дня';
    return { price: perDayRate * days, period: periodLabel, rate: perDayRate };
  }

  // Single day or fallback to daily rate
  const baseDaily = validatePositiveNumber(specs.dailyPrice) ?? 0;

  if (days === 1) {
    // For single-day: use weekend rate if the rental day is a weekend
    if (isWeekendDay(startDateStr) && validatePositiveNumber(specs.rent_weekend) !== undefined) {
      perDayRate = specs.rent_weekend!;
      periodLabel = '/ день (выходные)';
      return { price: perDayRate, period: periodLabel, rate: perDayRate };
    }
    // Use weekday rate if available for single day
    perDayRate = validatePositiveNumber(specs.rent_weekday) ?? baseDaily;
    periodLabel = specs.rent_weekday && specs.rent_weekday < baseDaily ? '/ день (будни)' : '/ день';
    return { price: perDayRate, period: periodLabel, rate: perDayRate };
  }

  // Fallback: daily rate × days
  return { price: baseDaily * days, period: `/ ${days} дн.`, rate: baseDaily };
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
  if (days > 1 && weekendDayCount > 0 && specs.rent_weekend && specs.rent_weekday) {
    const weekdayDayCount = days - weekendDayCount;
    const blendedPrice = weekendDayCount * specs.rent_weekend + weekdayDayCount * specs.rent_weekday;
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
  // Priority order for display: 3h > 6h > 12h > daily > hourly
  const displayTiers: Array<{ price: number | undefined; label: string; period: string }> = [
    { price: specs.price_per_3h, label: '3 часа', period: '/ 3 часа' },
    { price: specs.price_per_6h, label: '6 часов', period: '/ 6 часов' },
    { price: specs.price_per_12h, label: '12 часов', period: '/ 12 часов' },
    { price: specs.dailyPrice, label: 'День', period: '/ день' },
    { price: specs.price_per_hour, label: 'Час', period: '/ час' },
  ];

  // Find first available tier
  for (const tier of displayTiers) {
    if (tier.price !== undefined && tier.price > 0) {
      return {
        label: tier.label,
        price: `${tier.price.toLocaleString('ru-RU')} ₽`,
        period: tier.period,
      };
    }
  }

  // No pricing available
  return { label: 'Цена', price: 'По запросу', period: '' };
}
