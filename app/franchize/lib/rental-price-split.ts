// app/franchize/lib/rental-price-split.ts
// ──────────────────────────────────────────────────────────────────────────
// ONE source of truth for the money split of a rental (iter25).
//
// Client wish (VIP Bike owner, 2026-08-30):
//   «чтоб в отчёте тоже стояла стоимость мота и экипа отдельно. И чтоб
//    партнёрские моты сразу разделялись по стоимости. И была видна прибыль
//    компании и партнёра. Это пригодится для лк владельцев и для общего
//    верного отчёта.»
//
// Three money questions, answered per rental:
//   1. How much of `rentals.total_cost` is the BIKE and how much is GEAR?
//   2. Is the bike a PARTNER bike (cars.specs.subrenter_chat_id)?
//   3. For a partner bike — what is the partner's cut and the crew's part?
//
// Split rule (mirrors the subrent contract practice, subrenter-economics.ts):
//   partner gets  owner_pct% × BIKE part   (gear is crew property — never split)
//   crew keeps    gear + (100−owner_pct)% × bike part
//
// PERSISTED SPLIT: rentals created since iter25 carry the ACTUAL charged
// amounts in metadata:
//   equipment_price  — gear part actually charged (₽)
//   bike_price       — bike part actually charged (₽)
//   subrenter_chat_id— partner-owner chat id snapshot at deal time
// Older rows fall back to the gift-aware ESTIMATE from metadata.equipment
// quantities × the unit price table below (previous behaviour).
//
// Zero dependencies — safe from client components AND server actions.

/** Equipment unit prices (₽ per unit per rental). ONE table for the whole
 *  app: analytics KPIs, CSV export, partner payouts, salary estimates.
 *  Charger is a freebie bundled with the bike. */
export const EQUIPMENT_UNIT_PRICES_RUB: Record<string, number> = {
  helmets: 1000,
  gloves: 500,
  jacket: 500,
  pants: 500,
  boots: 500,
  net: 500,
  bag: 500,
  backpack: 500,
  charger: 0,
};

/** Fallback unit price for unknown equipment keys (new gear types). */
export const EQUIPMENT_UNIT_PRICE_FALLBACK_RUB = 500;

/** Default partner share of the bike part (subrent contract §5.5). */
export const DEFAULT_OWNER_PCT = 50;

/** metadata keys — keep in sync with writers in doc-manual.ts / franchize-order.ts */
export const META_EQUIPMENT_PRICE = "equipment_price";
export const META_BIKE_PRICE = "bike_price";
export const META_SUBRENTER_CHAT_ID = "subrenter_chat_id";

type Metadata = Record<string, unknown> | null | undefined;

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Equipment part of a rental as it was ACTUALLY CHARGED (₽), when the rental
 * row carries the persisted split (`metadata.equipment_price`, iter25+).
 * Returns null for legacy rows (pre-iter25) and rows whose writers had no
 * gear price basis (e.g. price-overridden deals without itemisation).
 */
export function getStoredEquipmentPrice(metadata: Metadata): number | null {
  const raw = metadata?.[META_EQUIPMENT_PRICE];
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Gift-aware ESTIMATE of the equipment part (₽) from metadata.equipment
 * quantities × unit prices. Values are quantities (helmets: 2) or booleans
 * (gloves: true). An item flagged `${key}_gift: true` («в подарок») brings
 * ZERO revenue — it was not charged, so it is neither crew money nor part of
 * the split.
 */
export function estimateEquipmentPrice(metadata: Metadata): number {
  const eq = metadata?.["equipment"];
  if (!eq || typeof eq !== "object" || Array.isArray(eq)) return 0;
  let total = 0;
  for (const [key, value] of Object.entries(eq as Record<string, unknown>)) {
    if (key.endsWith("_gift")) continue;
    const gifted = (eq as Record<string, unknown>)[`${key}_gift`] === true;
    if (gifted) continue;
    const unitPrice = EQUIPMENT_UNIT_PRICES_RUB[key] ?? EQUIPMENT_UNIT_PRICE_FALLBACK_RUB;
    let qty = 0;
    if (typeof value === "number" && value > 0) qty = value;
    else if (value === true) qty = 1;
    total += unitPrice * qty;
  }
  return total;
}

/**
 * Equipment part (₽) when the rental total is unknown/not needed: stored
 * price when present, estimate otherwise. Prefer splitRentalPrice() when the
 * total IS known — it additionally clamps the gear part to the total.
 */
export function getRentalEquipmentPart(metadata: Metadata): number {
  return getStoredEquipmentPrice(metadata) ?? estimateEquipmentPrice(metadata);
}

export type PriceSplitSource = "stored" | "estimated";

export interface RentalPriceSplit {
  totalRub: number;
  bikePartRub: number;
  equipmentPartRub: number;
  /** "stored" — exact amounts persisted at creation; "estimated" — unit-price
   *  estimate (legacy rows / price-overridden deals). */
  source: PriceSplitSource;
}

/**
 * Split a rental's total cost into BIKE and GEAR parts.
 * Stored split wins; the gear part is clamped into [0, total].
 */
export function splitRentalPrice(
  totalCost: number | string | null | undefined,
  metadata: Metadata,
): RentalPriceSplit {
  const totalRub = clampNonNegative(toFiniteNumber(totalCost));
  const stored = getStoredEquipmentPrice(metadata);
  if (stored != null) {
    const equipmentPartRub = Math.min(Math.round(stored), totalRub);
    return { totalRub, bikePartRub: totalRub - equipmentPartRub, equipmentPartRub, source: "stored" };
  }
  const equipmentPartRub = Math.min(estimateEquipmentPrice(metadata), totalRub);
  return { totalRub, bikePartRub: totalRub - equipmentPartRub, equipmentPartRub, source: "estimated" };
}

/** Clamp a partner share percentage into [1, 99]; default 50. */
export function resolveOwnerPct(explicit?: number | null): number {
  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return Math.min(99, Math.max(1, Math.round(explicit)));
  }
  return DEFAULT_OWNER_PCT;
}

/**
 * Partner-owner chat id for a rental: the metadata SNAPSHOT first (truth at
 * deal time — survives later bike re-assignment), then the passed current
 * value (cars.specs.subrenter_chat_id) for legacy rows.
 */
export function resolveRentalSubrenterChatId(
  metadata: Metadata,
  currentSpecsSubrenterChatId?: string | null,
): string | null {
  const snapRaw = metadata?.[META_SUBRENTER_CHAT_ID];
  const snap = typeof snapRaw === "string" ? snapRaw.trim() : typeof snapRaw === "number" ? String(snapRaw) : "";
  if (snap) return snap;
  const cur = typeof currentSpecsSubrenterChatId === "string" ? currentSpecsSubrenterChatId.trim() : "";
  return cur || null;
}

export interface PartnerSplit extends RentalPriceSplit {
  /** True when the bike belongs to a partner (subrented into the park). */
  isPartnerBike: boolean;
  /** Owner percentage applied (default 50). */
  ownerPct: number;
  /** Partner's cut: ownerPct% of the bike part (gear excluded). 0 for own bikes. */
  partnerRub: number;
  /** Crew's part: gear + (100−ownerPct)% of the bike part (= total for own bikes). */
  companyRub: number;
}

/**
 * Full company-vs-partner split of one rental.
 *   partner gets ownerPct% of the BIKE part only;
 *   the company keeps the gear part + the rest of the bike part.
 * Non-partner rentals: partnerRub = 0, companyRub = total.
 */
export function computePartnerSplit(input: {
  totalCost: number | string | null | undefined;
  metadata?: Metadata;
  subrenterChatId?: string | null;
  ownerPct?: number | null;
}): PartnerSplit {
  const split = splitRentalPrice(input.totalCost, input.metadata);
  const ownerPct = resolveOwnerPct(input.ownerPct);
  const isPartnerBike = typeof input.subrenterChatId === "string" && input.subrenterChatId.trim().length > 0;
  if (!isPartnerBike) {
    return { ...split, isPartnerBike: false, ownerPct, partnerRub: 0, companyRub: split.totalRub };
  }
  const partnerRub = Math.round((split.bikePartRub * ownerPct) / 100);
  return {
    ...split,
    isPartnerBike: true,
    ownerPct,
    partnerRub,
    companyRub: Math.max(0, split.totalRub - partnerRub),
  };
}
