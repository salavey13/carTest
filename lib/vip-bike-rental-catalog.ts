import type { CatalogItemVM } from "@/app/franchize/actions";

export type VipBikeRentalSegment = "electric" | "petrol";

// Spec keys that should NOT appear on the public rental landing page.
// These are internal-only fields (deposit amounts, delivery fees, helmet prices)
// that shouldn't be surfaced to the customer. But we do NOT strip the pricing
// tier fields (price_per_hour, price_per_2h, price_per_3h, price_per_6h,
// price_per_12h, rent_2_4d, rent_5_10d, rent_11_30d, rent_weekend) because
// the modal calculator needs them to show correct prices in the duration
// balloons and the PriceCard breakdown.
//
// Previously (v0.3-v0.4) we stripped ALL pricing tiers — this caused:
//   Bug 1: hourly balloons showed 0₽ (all price_per_Xh fields were missing)
//   Bug 2: 3-day weekend balloon showed 3 × rent_weekend instead of rent_2_4d × 3
// Fixed 2026-08-22: only strip deposit/delivery/helmet fields.
const UNCONFIRMED_PRICE_KEYS = [
  "deposit",
  "deposit_label",
  "deposit_rub",
  "security_deposit",
  "security_deposit_rub",
  "pledge",
  "delivery_price",
  "helmet_price",
] as const;

// Strip only deposit/delivery spec labels from the public spec list.
// Previously stripped hourly/daily/tariff/weekend labels too — but the modal
// calculator needs those to display correct prices in DurationShortcuts.
const PRIVATE_SPEC_LABEL_RE =
  /залог|депозит|достав/i;

function formatRub(value: number) {
  return value.toLocaleString("ru-RU");
}

// Derive propulsion segment from `specs.type` (set by catalog-adder skill).
// "Electric" → electric; everything else (Gas, ICE, Hybrid, Petrol) → petrol.
// If specs.type is missing, default to "petrol" (most bikes in the catalog
// are petrol — electric is the exception, not the rule).
function deriveSegment(rawSpecs: Record<string, unknown> | null | undefined): VipBikeRentalSegment {
  const t = rawSpecs?.type;
  if (typeof t === "string" && t.toLowerCase() === "electric") return "electric";
  return "petrol";
}

// Optional weekend price from specs.rent_weekend (catalog-adder writes it
// as one of the 11 tiers). Returns undefined if not set / not a number.
function readWeekendPrice(rawSpecs: Record<string, unknown> | null | undefined): number | undefined {
  const v = rawSpecs?.rent_weekend;
  if (typeof v === "number" && v > 0) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return undefined;
}

// Normalize a single rental item for the public vip-bike rental landing.
// No allowlist — relies on the server-side `specs.hidden` filter (see
// app/franchize/actions-runtime.ts:971-980) to drop hidden bikes.
// All canonical values come directly from the DB row (cars.daily_price,
// specs.rent_weekend, specs.type).
function normalizeRentalItem(item: CatalogItemVM): CatalogItemVM {
  const rawSpecs: Record<string, unknown> = { ...(item.rawSpecs ?? {}) };
  for (const key of UNCONFIRMED_PRICE_KEYS) delete rawSpecs[key];

  // Mark this item as "rental canonical" so downstream UI can detect that
  // we went through the normalizer (e.g. to show "Аренда" badge).
  rawSpecs.vipBikeRentalCanonical = true;

  const segment = deriveSegment(item.rawSpecs);
  rawSpecs.vipBikeRentalSegment = segment;

  // Don't override dailyPrice/rent_weekday from the DB — trust cars.daily_price.
  // (Previously the allowlist would override stale DB prices with "canonical"
  // ones, but the user trusts the DB to be correct after catalog-adder writes.)
  const pricePerDay = item.pricePerDay;
  const weekendPrice = readWeekendPrice(item.rawSpecs);
  if (weekendPrice) rawSpecs.rent_weekend = weekendPrice;

  // Strip private spec labels from the public spec list (deposit, hourly
  // prices, etc.) and add the canonical daily + weekend rows.
  const publicSpecs = item.specs.filter(
    (spec) => !PRIVATE_SPEC_LABEL_RE.test(spec.label),
  );
  publicSpecs.push({
    label: "Аренда",
    value: `${formatRub(pricePerDay)} ₽/сутки`,
  });
  if (weekendPrice) {
    publicSpecs.push({
      label: "Выходной день",
      value: `${formatRub(weekendPrice)} ₽/сутки`,
    });
  }

  return {
    ...item,
    subtitle: "Аренда в Нижнем Новгороде",
    rentPriceLabel: `${formatRub(pricePerDay)} ₽/сутки`,
    category:
      segment === "electric"
        ? "Электромотоциклы"
        : "Бензиновые мотоциклы",
    saleAvailable: false,
    salePrice: null,
    specs: publicSpecs,
    rawSpecs,
  };
}

// Build the public vip-bike rental catalog.
//
// No allowlist — every non-hidden bike in the crew is included.
// Optional `segment` filter narrows to electric or petrol (driven by
// specs.type — see deriveSegment).
//
// Hidden-bike filtering happens server-side (actions-runtime.ts:971-980),
// so by the time items reach this function, all hidden bikes are already
// gone. We just normalize + optionally filter by segment.
export function buildVipBikeRentalCatalog(
  items: CatalogItemVM[],
  segment?: VipBikeRentalSegment | null,
) {
  return items.flatMap((item) => {
    const itemSegment = deriveSegment(item.rawSpecs);
    if (segment && itemSegment !== segment) return [];
    return [normalizeRentalItem(item)];
  });
}

export function parseVipBikeRentalSegment(
  value: string | null | undefined,
): VipBikeRentalSegment | null {
  if (value === "electric" || value === "petrol") return value;
  return null;
}
