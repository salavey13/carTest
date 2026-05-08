import type { CatalogItemVM } from "../actions";

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

export function hasCatalogAvailabilitySignal(item: CatalogItemVM) {
  return ["available", "busy"].includes(item.availabilityStatus) && item.availabilityLabel.trim().length > 0;
}

export function buildCatalogRentalStrip(
  item: CatalogItemVM,
  crew: { contacts: { address?: string; workingHours?: string }; hqLocation?: string },
) {
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
  const availabilityLabel = item.availabilityLabel.trim();

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
  };
}
