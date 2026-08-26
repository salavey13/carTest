// lib/salary-coefficients-shared.ts
//
// PURE, client-safe part of the salary coefficients engine (official bonus
// scheme, 2026-08-26 document). No server imports — safe to use in client
// components. DB resolution lives in lib/salary-coefficients.ts.
//
// PRD: docs/PRD_SALARY_COEFFICIENTS.md
//
// REWORK (iter6, owner feedback):
//   • Bike "coolness" (budget / regular / premium) is judged BY PRICE,
//     not by hardcoded model lists.
//   • Subrented (partner) bikes are exactly three: Ducati Aero, Yamaha R7,
//     Suzuki GSX-S1000F. Partner category = subrented + price tier.
//   • Per-bike classification is stored in cars.specs.salary (jsonb) —
//     NO new tables. Crew-level ₽ rates live in
//     crews.metadata.franchize.salaryCoefficients (jsonb).
//     The iter5 migration (new tables) was removed.

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RentalCategory =
  | "budget"
  | "regular"
  | "partner_regular"
  | "premium"
  | "partner_premium";

export type SaleCategory = "enduro_moped" | "regular" | "premium";

export type EquipmentSaleCategory =
  | "helmet"
  | "balaclava"
  | "jacket"
  | "pants"
  | "gloves";

/** Price tier — the "coolness" of a bike, judged purely by its daily price. */
export type PriceTier = "budget" | "regular" | "premium";

export interface SalaryConfig {
  /** ₽ per closed rental by bike category */
  rental: Record<RentalCategory, number>;
  /** ₽ per equipment unit rented alongside a bike */
  equipmentRentalUnit: number;
  /** ₽ per closed sale by bike category */
  sale: Record<SaleCategory, number>;
  /** ₽ per equipment unit sold */
  equipmentSale: Record<EquipmentSaleCategory, number>;
  /** % of the overprice markup paid to the operator */
  overpricePercent: number;
}

export interface BikeSalaryCategories {
  rental: RentalCategory;
  sale: SaleCategory;
  /** Where the classification came from (UI diagnostics). */
  source?: "specs" | "price" | "fallback";
  /** Daily rental price used to derive the tier (UI diagnostics). */
  dailyPrice?: number;
  /** True when the bike is subrented from a partner (Ducati Aero / R7 / Suzuki). */
  subrented?: boolean;
  /** Price tier before the partner prefix (UI diagnostics). */
  tier?: PriceTier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Official defaults (the document)
// ─────────────────────────────────────────────────────────────────────────────

export const OFFICIAL_SALARY_CONFIG: SalaryConfig = {
  rental: {
    budget: 750,
    regular: 1000,
    partner_regular: 500,
    premium: 1500,
    partner_premium: 750,
  },
  equipmentRentalUnit: 200,
  sale: {
    enduro_moped: 5000,
    regular: 10000,
    premium: 15000,
  },
  equipmentSale: {
    helmet: 500,
    balaclava: 100,
    jacket: 500,
    pants: 500,
    gloves: 200,
  },
  overpricePercent: 10,
};

export const RENTAL_CATEGORY_LABELS: Record<RentalCategory, string> = {
  budget: "Бюджетные",
  regular: "Обычные",
  partner_regular: "Партнерские обычные",
  premium: "Премиум",
  partner_premium: "Партнерские премиум",
};

export const RENTAL_CATEGORY_DESCRIPTIONS: Record<RentalCategory, string> = {
  budget: "Цена аренды до 7 000 ₽/сутки (мопеды, питбайки, скутеры)",
  regular: "Цена аренды 7 000–13 999 ₽/сутки",
  partner_regular: "Субаренда (Дукати Аэро, Ямаха R7) при цене 7 000–13 999 ₽/сутки",
  premium: "Цена аренды от 14 000 ₽/сутки",
  partner_premium: "Субаренда (Сузуки 1000) при цене от 14 000 ₽/сутки",
};

export const SALE_CATEGORY_LABELS: Record<SaleCategory, string> = {
  enduro_moped: "Эндуро, мопеды",
  regular: "Обычные",
  premium: "Премиум",
};

export const EQUIPMENT_SALE_LABELS: Record<EquipmentSaleCategory, string> = {
  helmet: "Шлем",
  balaclava: "Балаклава",
  jacket: "Куртка",
  pants: "Штаны",
  gloves: "Перчатки",
};

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  budget: "Бюджет",
  regular: "Обычный",
  premium: "Премиум",
};

// ─────────────────────────────────────────────────────────────────────────────
// Price-based classification (iter6 — "judge coolness of bike by price")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily-price thresholds for the price tiers. Calibrated against the official
 * bonus document + the actual vip-bike fleet prices (2026-08):
 *
 *   premium  ≥ 14 000 ₽/сутки — LiveWire ONE (20k), Ducati 1199 (18k),
 *                                Sequence Zero (15k), Suzuki GSX-S1000F (14k)
 *   regular  7 000–13 999 ₽   — BMWs, Ducati электро-реплики, Kawasaki,
 *                                Honda CBR, Aprilia, Falcons, Rerode, Y-Volt
 *   budget   < 7 000 ₽        — U2, Kayo, Ниблер, Мотолэнд, Джиланг, HMD,
 *                                Leopard, Sotion EM01
 *
 * Configurable per-crew via metadata.franchize.salaryCoefficients.priceThresholds
 * (falls back to these constants when not set).
 */
export const DEFAULT_PRICE_TIERS = {
  /** daily price ≥ premiumThreshold → premium */
  premiumThreshold: 14000,
  /** daily price ≥ regularThreshold (and < premiumThreshold) → regular */
  regularThreshold: 7000,
} as const;

/**
 * Subrented (partner) bikes — the complete list per the owner (2026-08-26):
 * Ducati Aero, Yamaha R7, Suzuki GSX-S1000F. Everything else is owned.
 */
export const SUBRENTED_BIKE_IDS: readonly string[] = [
  "ducati-panigale-s-electro-black-aero",
  "yamaha-r7",
  "suzuki-gsx-s1000f",
];

export function isSubrentedBike(bikeId: string): boolean {
  return SUBRENTED_BIKE_IDS.includes(bikeId);
}

/** Price → tier. Unpriced / zero-price bikes fall back to "budget". */
export function deriveTierFromPrice(
  dailyPrice: number | null | undefined,
  tiers: { premiumThreshold: number; regularThreshold: number } = DEFAULT_PRICE_TIERS,
): PriceTier {
  const price = Number(dailyPrice);
  if (!Number.isFinite(price) || price <= 0) return "budget";
  if (price >= tiers.premiumThreshold) return "premium";
  if (price >= tiers.regularThreshold) return "regular";
  return "budget";
}

/** Sale category for a price tier (official document mapping). */
export function saleCategoryForTier(tier: PriceTier): SaleCategory {
  switch (tier) {
    case "premium":
      return "premium";
    case "regular":
      return "regular";
    default:
      return "enduro_moped";
  }
}

/** Result of deriveCategoriesFromPrice — tier is always set here. */
export interface DerivedBikeCategories extends BikeSalaryCategories {
  tier: PriceTier;
  source: "price";
}

/**
 * Full classification from price + subrented flag:
 *   tier = price → budget | regular | premium
 *   rental category = subrented ? `partner_${tier}` : tier
 *   sale category = tier mapping (partner flag does not change sale bonuses)
 */
export function deriveCategoriesFromPrice(
  dailyPrice: number | null | undefined,
  subrented: boolean,
  tiers?: { premiumThreshold: number; regularThreshold: number },
): DerivedBikeCategories {
  const tier = deriveTierFromPrice(dailyPrice, tiers);
  return {
    rental: (subrented ? `partner_${tier}` : tier) as RentalCategory,
    sale: saleCategoryForTier(tier),
    source: "price",
    dailyPrice: Number(dailyPrice) || 0,
    subrented,
    tier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// specs.salary jsonb contract (cars.specs.salary)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape stored in cars.specs.salary:
 *   { tier, subrented, rentalCategory, saleCategory, dailyPriceAtSet, setAt }
 *
 * Written by the salary-coefficients admin UI (server action) or by the
 * maintainer directly. Missing / malformed entries → price-derived fallback.
 */
export interface BikeSpecsSalary {
  tier?: PriceTier;
  subrented?: boolean;
  rentalCategory?: RentalCategory;
  saleCategory?: SaleCategory;
  dailyPriceAtSet?: number;
  setAt?: string;
}

const VALID_RENTAL: readonly string[] = [
  "budget", "regular", "partner_regular", "premium", "partner_premium",
];
const VALID_SALE: readonly string[] = ["enduro_moped", "regular", "premium"];
const VALID_TIERS: readonly string[] = ["budget", "regular", "premium"];

/** Safely read specs.salary from a car's specs jsonb. Returns null when absent. */
export function parseSpecsSalary(specs: unknown): BikeSpecsSalary | null {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return null;
  const salary = (specs as Record<string, unknown>).salary;
  if (!salary || typeof salary !== "object" || Array.isArray(salary)) return null;
  return salary as BikeSpecsSalary;
}

/**
 * Resolve a bike's categories from its specs + price:
 *   1. specs.salary.rentalCategory / saleCategory — explicit (admin-set) wins
 *   2. otherwise derive from price + subrented flag
 *   3. zero/unpriced bikes → budget + subrented flag from specs
 */
export function resolveCategoriesForBike(params: {
  bikeId: string;
  specs: unknown;
  dailyPrice: number | null | undefined;
  tiers?: { premiumThreshold: number; regularThreshold: number };
}): BikeSalaryCategories {
  const { bikeId, specs, dailyPrice, tiers } = params;
  const stored = parseSpecsSalary(specs);
  const subrented = stored?.subrented ?? isSubrentedBike(bikeId);
  const derived = deriveCategoriesFromPrice(dailyPrice, subrented, tiers);

  if (
    stored &&
    typeof stored.rentalCategory === "string" &&
    VALID_RENTAL.includes(stored.rentalCategory) &&
    typeof stored.saleCategory === "string" &&
    VALID_SALE.includes(stored.saleCategory)
  ) {
    return {
      rental: stored.rentalCategory as RentalCategory,
      sale: stored.saleCategory as SaleCategory,
      source: "specs",
      dailyPrice: Number(dailyPrice) || 0,
      subrented,
      tier:
        stored.tier && VALID_TIERS.includes(stored.tier)
          ? (stored.tier as PriceTier)
          : derived.tier,
    };
  }
  return derived;
}

/** Back-compat wrapper used by CSV builders / salary calculations. */
export function resolveBikeCategories(
  bikeId: string,
  overrides: Map<string, BikeSalaryCategories>,
): BikeSalaryCategories {
  const override = overrides.get(bikeId);
  if (override) return override;
  return { rental: "regular", sale: "regular", source: "fallback" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipment unit counting (mirrors the CSV «Экип» column logic)
// ─────────────────────────────────────────────────────────────────────────────

export interface RentalEquipment {
  helmets?: number;
  gloves?: number;
  jacket?: boolean;
  pants?: boolean;
  boots?: boolean;
  net?: boolean;
  backpack?: boolean;
  charger?: boolean;
}

/** Number of billable equipment units in a rental (charger is free → excluded). */
export function countEquipmentUnits(eq: RentalEquipment | null | undefined): number {
  if (!eq) return 0;
  let units = 0;
  units += Math.max(0, Number(eq.helmets) || 0);
  units += Math.max(0, Number(eq.gloves) || 0);
  if (eq.jacket) units += 1;
  if (eq.pants) units += 1;
  if (eq.boots) units += 1;
  if (eq.net) units += 1;
  if (eq.backpack) units += 1;
  // charger: бесплатно — не считается
  return units;
}

// ─────────────────────────────────────────────────────────────────────────────
// Salary calculators
// ─────────────────────────────────────────────────────────────────────────────

export interface RentalSalaryBreakdown {
  /** category bonus for the bike */
  base: number;
  /** equipment bonus (units × per-unit coefficient) */
  equipment: number;
  /** overprice bonus (percent × markup above standard price) */
  overprice: number;
  total: number;
}

/**
 * Salary for one closed rental.
 * `standardPrice` — canonical catalog price for the rental period + standard
 * equipment cost (see buildRentalsCsv); markup above it pays overprice%.
 */
export function computeRentalSalary(params: {
  config: SalaryConfig;
  rentalCategory: RentalCategory;
  equipmentUnits: number;
  totalCost: number;
  standardPrice: number;
}): RentalSalaryBreakdown {
  const { config, rentalCategory, equipmentUnits, totalCost, standardPrice } = params;
  const base = config.rental[rentalCategory] ?? 0;
  const equipment = equipmentUnits * config.equipmentRentalUnit;
  const markup = Math.max(0, (Number(totalCost) || 0) - (Number(standardPrice) || 0));
  const overprice = Math.round((markup * config.overpricePercent) / 100);
  return {
    base,
    equipment,
    overprice,
    total: base + equipment + overprice,
  };
}

/** Salary for one closed sale (bike). Markup baseline not tracked yet → 0. */
export function computeSaleSalary(params: {
  config: SalaryConfig;
  saleCategory: SaleCategory;
  salePrice?: number;
  askingPrice?: number;
}): { base: number; overprice: number; total: number } {
  const { config, saleCategory, salePrice, askingPrice } = params;
  const base = config.sale[saleCategory] ?? 0;
  let overprice = 0;
  if (
    typeof askingPrice === "number" &&
    askingPrice > 0 &&
    typeof salePrice === "number" &&
    salePrice > askingPrice
  ) {
    overprice = Math.round(((salePrice - askingPrice) * config.overpricePercent) / 100);
  }
  return { base, overprice, total: base + overprice };
}

/** Salary for selling equipment items (per-unit bonuses). */
export function computeEquipmentSaleSalary(
  config: SalaryConfig,
  items: Partial<Record<EquipmentSaleCategory, number>>,
): number {
  let total = 0;
  for (const [key, count] of Object.entries(items)) {
    const cat = key as EquipmentSaleCategory;
    const n = Math.max(0, Number(count) || 0);
    total += n * (config.equipmentSale[cat] ?? 0);
  }
  return total;
}
