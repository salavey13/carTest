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
  rent_2_4d?: number;
  rent_5_10d?: number;
  rent_11_30d?: number;
  deposit_rub?: number;
}

/**
 * Calculate the price for a given duration in hours
 * Returns the price, period label, and the rate used
 */
export function calculatePriceForDuration(
  specs: BikePricingSpecs,
  hours: number
): { price: number; period: string; rate: number } {
  // Handle invalid input
  if (hours <= 0) {
    return { price: 0, period: 'Invalid duration', rate: 0 };
  }

  // Hourly pricing tiers
  if (hours <= 1) {
    const rate = specs.price_per_hour ?? specs.dailyPrice ?? 0;
    return { price: rate, period: '/ час', rate };
  }

  if (hours <= 3) {
    // Prefer 3h tier, fallback to hourly × 3
    const rate = specs.price_per_3h ?? specs.price_per_hour ?? specs.dailyPrice ?? 0;
    const price = specs.price_per_3h ?? (specs.price_per_hour ?? 0) * 3 ?? 0;
    return { price, period: '/ 3 часа', rate };
  }

  if (hours <= 6) {
    // Prefer 6h tier, fallback to 3h tier × 2, or hourly × 6
    if (specs.price_per_6h !== undefined) {
      return { price: specs.price_per_6h, period: '/ 6 часов', rate: specs.price_per_6h };
    }
    if (specs.price_per_3h !== undefined) {
      return { price: specs.price_per_3h * 2, period: '/ 6 часов', rate: specs.price_per_3h * 2 };
    }
    const hourlyRate = specs.price_per_hour ?? specs.dailyPrice ?? 0;
    return { price: hourlyRate * 6, period: '/ 6 часов', rate: hourlyRate * 6 };
  }

  if (hours <= 12) {
    // Prefer 12h tier, fallback to 6h tier × 2, or hourly × 12
    if (specs.price_per_12h !== undefined) {
      return { price: specs.price_per_12h, period: '/ 12 часов', rate: specs.price_per_12h };
    }
    if (specs.price_per_6h !== undefined) {
      return { price: specs.price_per_6h * 2, period: '/ 12 часов', rate: specs.price_per_6h * 2 };
    }
    const hourlyRate = specs.price_per_hour ?? specs.dailyPrice ?? 0;
    return { price: hourlyRate * 12, period: '/ 12 часов', rate: hourlyRate * 12 };
  }

  // Daily pricing (more than 12 hours)
  const days = Math.ceil(hours / 24);
  return calculatePriceForDays(specs, days);
}

/**
 * Calculate price for a specific number of days
 * Internal helper for daily/multi-day pricing
 */
function calculatePriceForDays(
  specs: BikePricingSpecs,
  days: number
): { price: number; period: string; rate: number } {
  if (days <= 0) {
    return { price: 0, period: 'Invalid duration', rate: 0 };
  }

  const baseDaily = specs.dailyPrice ?? 0;

  // Multi-day tiered pricing
  if (days >= 11 && specs.rent_11_30d !== undefined) {
    return { price: specs.rent_11_30d, period: '/ 11-30 дней', rate: specs.rent_11_30d };
  }

  if (days >= 5 && specs.rent_5_10d !== undefined) {
    return { price: specs.rent_5_10d, period: '/ 5-10 дней', rate: specs.rent_5_10d };
  }

  if (days >= 2 && specs.rent_2_4d !== undefined) {
    return { price: specs.rent_2_4d, period: '/ 2-4 дня', rate: specs.rent_2_4d };
  }

  // Single day or fallback to daily rate
  if (days === 1) {
    // Use weekday rate if available for single day
    const rate = specs.rent_weekday ?? specs.dailyPrice ?? 0;
    const period = specs.rent_weekday ? '/ день (будни)' : '/ день';
    return { price: rate, period, rate };
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

  // Calculate duration and price
  const start = new Date(startDate);
  const end = new Date(endDate);
  const hours = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60));

  const { price, period } = calculatePriceForDuration(specs, hours);

  // Format price
  const formattedPrice = price > 0 ? `${price.toLocaleString('ru-RU')} ₽` : 'Цена по запросу';

  // Determine label based on duration
  let label = period;
  if (hours <= 24) {
    label = 'Часовая аренда';
  } else {
    const days = Math.ceil(hours / 24);
    label = days === 1 ? 'Дневная аренда' : `Аренда на ${days} дн.`;
  }

  return { label, price: formattedPrice, period };
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
