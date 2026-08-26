// lib/salary-coefficients-shared.ts
//
// PURE, client-safe part of the salary coefficients engine (official bonus
// scheme, 2026-08-26 document). No server imports — safe to use in client
// components. DB resolution lives in lib/salary-coefficients.ts.
//
// PRD: docs/PRD_SALARY_COEFFICIENTS.md

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
  budget: "U2, Брейкаут 300, Ниблер 300, Скутеры, питбайки",
  regular: "БМВ, Дукати Зубик, Эндуро",
  partner_regular: "Ямаха, Кава, Априли, электро-реплики Дукати",
  premium: "Сиквенс, Харлей",
  partner_premium: "Сузуки",
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

// ─────────────────────────────────────────────────────────────────────────────
// Default bike → category mapping (official document, catalog IDs)
// Unlisted bikes fall back to regular/regular (flagged as unconfigured in UI).
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BIKE_CATEGORIES: Record<string, BikeSalaryCategories> = {
  // NOTE: keep in sync with the seed in
  // supabase/migrations/20260826000001_create_salary_coefficients.sql
  // budget (750 ₽)
  "wenbox-u2-pro": { rental: "budget", sale: "enduro_moped" },
  "motoland-breakout": { rental: "budget", sale: "enduro_moped" },
  "nibbler-regumoto-4v": { rental: "budget", sale: "enduro_moped" },
  "jilang-max-pro": { rental: "budget", sale: "enduro_moped" },
  "leopard-asaka": { rental: "budget", sale: "enduro_moped" },
  "kayo-tsd110": { rental: "budget", sale: "enduro_moped" },
  "hmd-m02": { rental: "budget", sale: "enduro_moped" },
  // regular (1000 ₽)
  "bmw-f800r": { rental: "regular", sale: "regular" },
  "bmw-s1000rr-electro-silver": { rental: "regular", sale: "regular" },
  "ducati-1199-panigale-2012": { rental: "regular", sale: "regular" },
  "falcon-gt-2026": { rental: "regular", sale: "enduro_moped" },
  "falcon-pro-2026": { rental: "regular", sale: "enduro_moped" },
  "rerode-r1-plus": { rental: "regular", sale: "enduro_moped" },
  "y-volt-surge-v": { rental: "regular", sale: "enduro_moped" },
  // partner_regular (500 ₽)
  "yamaha-r7": { rental: "partner_regular", sale: "regular" },
  "kawasaki-ex650k": { rental: "partner_regular", sale: "regular" },
  "aprilia-shiver": { rental: "partner_regular", sale: "regular" },
  "ducati-panigale-s-electro-black": { rental: "partner_regular", sale: "regular" },
  "ducati-panigale-s-electro-black-aero": { rental: "partner_regular", sale: "regular" },
  "ducati-panigale-s-electro-black-chain": { rental: "partner_regular", sale: "regular" },
  "ducati-panigale-s-electro-gold": { rental: "partner_regular", sale: "regular" },
  "ducati-panigale-s-electro-green": { rental: "partner_regular", sale: "regular" },
  // premium (1500 ₽)
  "sequence-zero": { rental: "premium", sale: "premium" },
  "livewire-one": { rental: "premium", sale: "premium" },
  // partner_premium (750 ₽)
  "suzuki-gsx-s1000f": { rental: "partner_premium", sale: "premium" },
};

export const DEFAULT_BIKE_CATEGORY_FALLBACK: BikeSalaryCategories = {
  rental: "regular",
  sale: "regular",
};

/** Default mapping used by the UI's "применить официальные категории" action. */
export function getDefaultBikeCategories(): Record<string, BikeSalaryCategories> {
  return { ...DEFAULT_BIKE_CATEGORIES };
}

/** Resolve a bike's categories: DB override → default mapping → regular/regular. */
export function resolveBikeCategories(
  bikeId: string,
  overrides: Map<string, BikeSalaryCategories>,
): BikeSalaryCategories {
  const override = overrides.get(bikeId);
  if (override) return override;
  return DEFAULT_BIKE_CATEGORIES[bikeId] || DEFAULT_BIKE_CATEGORY_FALLBACK;
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
