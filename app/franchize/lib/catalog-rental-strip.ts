import type { BikePricingSpecs } from "./pricing-calculator";

type CatalogRentalStripItem = {
  availabilityStatus?: string | null;
  availabilityLabel?: string | null;
  rawSpecs?: Record<string, unknown>;
  rentPriceLabel: string;
};

type PriceTier = {
  label: string;
  price: string;
};

type CatalogRentalStrip = {
  hasAvailability: boolean;
  isAvailable: boolean;
  todayLabel: string;
  availabilityLabel: string;
  nearestStartWindow: string;
  pickupHint: string;
  priceTeaser: string;
  priceTiers: PriceTier[];
};

const UNKNOWN_TELEGRAM_LABEL = "Уточним в Telegram";
const PICKUP_HINT_MAX = 42;

function firstTextSpec(specs: Record<string, unknown> | undefined, keys: string[]) {
  if (!specs) return "";
  for (const key of keys) {
    const value = specs[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return `${value.toLocaleString("ru-RU")} ₽`;
    }
  }
  return "";
}

function truncatePickupHint(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= PICKUP_HINT_MAX) return normalized;
  return `${normalized.slice(0, PICKUP_HINT_MAX - 1).trim()}…`;
}

function normalizeWorkingHours(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const timeRange = normalized.match(/(\d{1,2}[:.]\d{2})\s*[–—-]\s*(\d{1,2}[:.]\d{2})/);
  if (timeRange) {
    return `с ${timeRange[1].replace(".", ":")}`;
  }

  const firstTime = normalized.match(/\d{1,2}[:.]\d{2}/)?.[0];
  if (firstTime) {
    return `с ${firstTime.replace(".", ":")}`;
  }

  return normalized.length > 22 ? `${normalized.slice(0, 21).trim()}…` : normalized;
}

/**
 * Extract available pricing tiers from BikePricingSpecs
 * Returns an array of formatted price tier labels with prices
 */
function extractPriceTiers(rawSpecs: Record<string, unknown> | undefined): PriceTier[] {
  if (!rawSpecs) return [];

  const specs = rawSpecs as BikePricingSpecs;
  const tiers: PriceTier[] = [];

  // Hourly tiers
  if (specs.price_per_hour && specs.price_per_hour > 0) {
    tiers.push({ label: "Час", price: `${specs.price_per_hour.toLocaleString("ru-RU")} ₽` });
  }
  if (specs.price_per_3h && specs.price_per_3h > 0) {
    tiers.push({ label: "3 часа", price: `${specs.price_per_3h.toLocaleString("ru-RU")} ₽` });
  }
  if (specs.price_per_6h && specs.price_per_6h > 0) {
    tiers.push({ label: "6 часов", price: `${specs.price_per_6h.toLocaleString("ru-RU")} ₽` });
  }
  if (specs.price_per_12h && specs.price_per_12h > 0) {
    tiers.push({ label: "12 часов", price: `${specs.price_per_12h.toLocaleString("ru-RU")} ₽` });
  }

  // Daily tiers
  if (specs.dailyPrice && specs.dailyPrice > 0) {
    tiers.push({ label: "1 день", price: `${specs.dailyPrice.toLocaleString("ru-RU")} ₽` });
  }
  if (specs.rent_weekday && specs.rent_weekday > 0) {
    tiers.push({ label: "Будний день", price: `${specs.rent_weekday.toLocaleString("ru-RU")} ₽` });
  }

  // Multi-day tiers - these are PER-DAY rates, not total prices
  if (specs.rent_2_4d && specs.rent_2_4d > 0) {
    tiers.push({ label: "2-4 дня", price: `${specs.rent_2_4d.toLocaleString("ru-RU")} ₽/день` });
  }
  if (specs.rent_5_10d && specs.rent_5_10d > 0) {
    tiers.push({ label: "5-10 дней", price: `${specs.rent_5_10d.toLocaleString("ru-RU")} ₽/день` });
  }
  if (specs.rent_11_30d && specs.rent_11_30d > 0) {
    tiers.push({ label: "11-30 дней", price: `${specs.rent_11_30d.toLocaleString("ru-RU")} ₽/день` });
  }

  return tiers;
}

export function hasCatalogAvailabilitySignal(item: CatalogRentalStripItem) {
  return ["available", "busy"].includes(String(item.availabilityStatus ?? "")) && String(item.availabilityLabel ?? "").trim().length > 0;
}

export function buildCatalogRentalStrip(
  item: CatalogRentalStripItem,
  crew: { contacts: { address?: string; workingHours?: string }; hqLocation?: string },
): CatalogRentalStrip {
  const hasAvailability = hasCatalogAvailabilitySignal(item);
  const isAvailable = hasAvailability && item.availabilityStatus === "available";
  const pickupAddress = crew.contacts.address || crew.hqLocation || "адрес выдачи уточним";
  const depositLabel = firstTextSpec(item.rawSpecs, [
    "deposit_label",
    "deposit_rub",
    "deposit",
    "security_deposit",
    "security_deposit_rub",
    "pledge",
  ]);
  const startWindowSpec = firstTextSpec(item.rawSpecs, [
    "nearest_start_window",
    "start_window",
    "pickup_window",
    "handoff_window",
  ]);
  const workingWindow = normalizeWorkingHours(crew.contacts.workingHours ?? "");
  const availabilityLabel = String(item.availabilityLabel ?? "").trim();
  const priceTiers = extractPriceTiers(item.rawSpecs);

  return {
    hasAvailability,
    isAvailable,
    todayLabel: hasAvailability ? (isAvailable ? "доступен" : "занят") : UNKNOWN_TELEGRAM_LABEL,
    availabilityLabel: hasAvailability ? availabilityLabel : UNKNOWN_TELEGRAM_LABEL,
    nearestStartWindow: hasAvailability
      ? isAvailable
        ? startWindowSpec || (workingWindow ? `сегодня ${workingWindow}` : "сегодня по договорённости")
        : availabilityLabel || UNKNOWN_TELEGRAM_LABEL
      : UNKNOWN_TELEGRAM_LABEL,
    pickupHint: truncatePickupHint(pickupAddress),
    priceTeaser: depositLabel
      ? `Залог ${depositLabel} · ${item.rentPriceLabel}`
      : `Залог обсудим · ${item.rentPriceLabel}`,
    priceTiers,
  };
}
