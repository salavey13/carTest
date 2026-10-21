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
  /** ₽ per equipment unit rented alongside a bike (charged for the FIRST day) */
  equipmentRentalUnit: number;
  /** Task 118 (boss 2026-10-21): ₽ per equipment unit for each FOLLOWING day
   *  of a multi-day rental (1st day pays equipmentRentalUnit). Boss's rule:
   *  «1st day full 500₽ (commission 200₽), following days 250₽ — commission 100₽».
   *  Hourly (<24h) rentals bill gear as ONE day. */
  equipmentRentalUnitFollowup: number;
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
  // Task 118: 200 ₽/ед за 1-е сутки, 100 ₽/ед за каждые следующие (босс 2026-10-21:
  // «1st day full 500rub (comission 200rub) following days 250rub and comission is 100rub»).
  equipmentRentalUnitFollowup: 100,
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

/**
 * Task 117 — STANDARD GEAR PRICE LINES (pure, client-safe).
 * Per-unit «эталонная» price lines for the verification DM formula block.
 * MUST stay digit-equal with equipmentStandardCost (lib/salary-coefficients.ts):
 * helmets 1000, gloves 500, everything else 500, charger free/absent.
 * Each line = one merged group (e.g. «2 шлема — 2 000 ₽»).
 */
export interface EquipmentStandardLine {
  label: string;
  units: number;
  sum: number;
}

const GEAR_STD_PRICE: Record<string, number> = {
  helmets: 1000,
  gloves: 500,
  jacket: 500,
  pants: 500,
  boots: 500,
  net: 500,
  backpack: 500,
};

const GEAR_STD_LABEL_ONE: Record<string, string> = {
  helmets: "шлем",
  gloves: "пара перчаток",
  jacket: "куртка",
  pants: "пара штанов",
  boots: "бот",
  net: "сетка",
  backpack: "рюкзак",
};

/** ru plural: 1 шлем / 2 шлема / 5 шлемов (gloves get their own label shape). */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function equipmentStandardLines(eq: RentalEquipment | null | undefined): EquipmentStandardLine[] {
  if (!eq) return [];
  const lines: EquipmentStandardLine[] = [];
  const push = (key: string, units: number) => {
    const n = Math.max(0, Number(units) || 0);
    if (!n) return;
    const price = GEAR_STD_PRICE[key];
    const one = GEAR_STD_LABEL_ONE[key];
    // «пара …» labels are already plural-shaped — pluralize only the numeral
    // word (пара/пары/пар) for them; everything else uses noun plurals.
    if (one.startsWith("пара ")) {
      const noun = one.slice("пара ".length);
      const label = `${n} ${pluralRu(n, "пара", "пары", "пар")} ${noun}`;
      lines.push({ label, units: n, sum: n * price });
      return;
    }
    const label = `${n} ${pluralRu(n, one, `${one}а`, `${one}ов`)}`;
    lines.push({ label, units: n, sum: n * price });
  };
  push("helmets", Number(eq.helmets) || 0);
  push("gloves", Number(eq.gloves) || 0);
  if (eq.jacket) push("jacket", 1);
  if (eq.pants) push("pants", 1);
  if (eq.boots) push("boots", 1);
  if (eq.net) push("net", 1);
  if (eq.backpack) push("backpack", 1);
  return lines;
}

/** ru plural for days: 1 сутки / 2 суток / 21 сутки (нет единственного числа). */
export function daysLabelRu(n: number): string {
  const d = Math.max(0, Math.floor(Number(n) || 0));
  const mod10 = d % 10;
  const mod100 = d % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "сутки" : "суток";
  return `${d} ${word}`;
}

/** ru plural for hours: 1 час / 2 часа / 5 часов. */
export function hoursLabelRu(n: number): string {
  const h = Math.round(Number(n) || 0);
  return `${h} ${pluralRu(h, "час", "часа", "часов")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 118 — MULTI-DAY GEAR MATH (boss 2026-10-21)
// «1st day full 500₽ (commission 200₽), following days 250₽ — commission 100₽».
// The same taper applies to BOTH the эталон (what the client should pay for
// gear: full price day 1, half price days 2+) and the operator's per-unit
// commission (equipmentRentalUnit day 1, equipmentRentalUnitFollowup days 2+).
// Bikes have NO taper: the client price is the tier ladder × days, the
// operator's bike bonus is a flat ₽/аренда regardless of duration.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Charged gear days for a rental window. Multi-day (≥24h) rentals bill gear
 * for every charged day; hourly windows (<24h) and unknown/fallback windows
 * bill gear as ONE day (the legacy flat behavior).
 */
export function effectiveGearDays(
  detail: { days?: number | null; hours?: number | null } | null | undefined,
): number {
  const d = Math.max(0, Math.floor(Number(detail?.days) || 0));
  if (d >= 1) return d;
  return 1;
}

/** Per-unit price multiplier over `days` days: 1st day full, each following day half. 3 days → 2.0. */
export function gearDayFactor(days: number): number {
  const d = Math.max(1, Math.floor(Number(days) || 1));
  return (d + 1) / 2;
}

/**
 * Standard equipment cost (matches the CSV «Экип» column: charger free).
 * Task 118: `days` — charged gear days; the эталон follows the client rule
 * «1-е сутки полная цена, дальше — половина» (3 units × 3 days @500 → 3 000 ₽).
 * Omitted/1 → the legacy flat single-day cost, so old callers keep numbers.
 * (Pure + client-safe: lives here so tests and the admin preview reuse ONE
 * canon; the server module re-exports it.)
 */
export function equipmentStandardCost(eq: RentalEquipment | null | undefined, days = 1): number {
  if (!eq) return 0;
  const factor = gearDayFactor(days);
  let c = 0;
  if (Number(eq.helmets) > 0) c += Number(eq.helmets) * 1000 * factor;
  if (Number(eq.gloves) > 0) c += Number(eq.gloves) * 500 * factor;
  if (eq.jacket) c += 500 * factor;
  if (eq.pants) c += 500 * factor;
  if (eq.boots) c += 500 * factor;
  if (eq.net) c += 500 * factor;
  if (eq.backpack) c += 500 * factor;
  return Math.round(c);
}

/** Compact ₽ formatter for the frozen formula strings (pure, ru-RU, no kopecks). */
function rubPlain(n: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n))} ₽`;
}

/**
 * «(500 + 250 + 250) × 3 ед. = 3 000 ₽» — the per-unit day ladder × units for
 * UNIFORM-price gear (the common case). Mixed-price gear degrades to the
 * total-only line. Null when there is nothing to break down (1 day / no gear).
 * Pure — frozen into the verification snapshot AND reused by the fix scripts.
 */
export function buildGearDaysLine(
  eq: RentalEquipment | null | undefined,
  days: number,
  total: number,
): string | null {
  const d = Math.max(1, Math.floor(Number(days) || 1));
  if (d <= 1 || !eq) return null;
  const lines = equipmentStandardLines(eq);
  if (lines.length === 0) return null;
  const unitPrices = new Set(lines.map((l) => Math.round(l.sum / Math.max(1, l.units))));
  if (unitPrices.size === 1) {
    const p = [...unitPrices][0];
    const units = lines.reduce((acc, l) => acc + l.units, 0);
    const parts = [String(p)];
    for (let i = 1; i < d; i += 1) parts.push(String(Math.round(p / 2)));
    return `(${parts.join(" + ")}) × ${units} ед. = ${rubPlain(total)}`;
  }
  return `${rubPlain(total)} за ${d} ${d % 10 === 1 && d % 100 !== 11 ? "сутки" : "суток"} (1-е сутки полная цена, дальше — половина)`;
}

/**
 * «(200 + 100 + 100) × 3 ед.» — the per-unit COMMISSION ladder over the
 * charged days. NO money in the string — the DM formatter appends the frozen
 * snapshot.equipment (one money source, never two). Null for 1-day rentals /
 * zero followup coef (nothing new vs the flat rule).
 */
export function buildEquipmentCommLine(
  units: number,
  first: number,
  followup: number,
  days: number,
): string | null {
  const d = Math.max(1, Math.floor(Number(days) || 1));
  const n = Math.max(0, Math.floor(Number(units) || 0));
  const fu = Math.max(0, Math.round(Number(followup) || 0));
  if (d <= 1 || n <= 0 || fu <= 0) return null;
  const parts = [String(Math.max(0, Math.round(Number(first) || 0)))];
  for (let i = 1; i < d; i += 1) parts.push(String(fu));
  return `(${parts.join(" + ")}) × ${n} ед.`;
}

/**
 * Compact ru equipment flags — same idiom as the CSV «Экип» column
 * («1шл+1перч+курт»). Task 101: moved HERE from salary-category-bonuses.ts
 * (pure, zero deps) so the rental-verify lib can share it without a circular
 * import — salary-category-bonuses imports the verification helpers back.
 */
export function equipmentFlagsLabel(eq: RentalEquipment | null | undefined): string {
  if (!eq) return "";
  const parts: string[] = [];
  if (Number(eq.helmets) > 0) parts.push(`${eq.helmets}шл`);
  if (Number(eq.gloves) > 0) parts.push(`${eq.gloves}перч`);
  if (eq.jacket) parts.push("курт");
  if (eq.pants) parts.push("шт");
  if (eq.boots) parts.push("бот");
  if (eq.net) parts.push("сет");
  if (eq.backpack) parts.push("рюк");
  if (eq.charger) parts.push("заряд↔");
  return parts.join("+");
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
  /**
   * Task 120 — true when the rental window was shorter than 24h: the base AND
   * the per-unit equipment commission were halved (мот 1 000→500 · экип 200→100).
   */
  shortRental: boolean;
}

/**
 * Task 120 (boss 2026-10-21): a rental SHORTER than 24 hours halves the
 * operator's commission — «kinda in case rental is less then 24 hours then
 * comission for rental itself is not 1000 but 500 for mid bikes (750 instead
 * of 1500 for high-tier bikes, and 250 instead of 500 for low tier bikes),
 * and 100rub bonus instead of 200 for each equipment item». Applied to the
 * bike base AND the per-unit gear commission; the onценка (markup %) is NOT
 * halved (the boss enumerated only the flat parts). Unknown duration (hours
 * = 0) keeps the full commission — half only when we KNOW it was short.
 */
export function isShortRentalHours(hours: number | null | undefined): boolean {
  const h = Number(hours);
  return Number.isFinite(h) && h > 0 && h < 24;
}

/**
 * Salary for one closed rental.
 * `standardPrice` — canonical catalog price for the rental period + standard
 * equipment cost (see buildRentalsCsv); markup above it pays overprice%.
 * Task 118: `equipmentDays` — charged gear days (1st day pays the full unit
 * coefficient, each following day the followup coefficient). Omitted → 1 day
 * (the legacy flat per-unit behavior), so old callers keep their numbers.
 * Task 120: `rentalHours` — the rental window; when it is (0, 24) the base
 * and the per-unit equipment commission are halved. Omitted/unknown → full.
 */
export function computeRentalSalary(params: {
  config: SalaryConfig;
  rentalCategory: RentalCategory;
  equipmentUnits: number;
  totalCost: number;
  standardPrice: number;
  /** Charged gear days (≥1). Hourly/unknown windows bill gear as 1 day. */
  equipmentDays?: number;
  /** Rental window in hours (from standardRentalPriceDetailed). */
  rentalHours?: number | null;
}): RentalSalaryBreakdown {
  const { config, rentalCategory, equipmentUnits, totalCost, standardPrice } = params;
  const shortRental = isShortRentalHours(params.rentalHours);
  const half = (n: number) => Math.round(n / 2);
  const baseFull = config.rental[rentalCategory] ?? 0;
  const base = shortRental ? half(baseFull) : baseFull;
  const gearDays = Math.max(1, Math.floor(Number(params.equipmentDays) || 1));
  const followup = Math.max(0, Math.round(Number(config.equipmentRentalUnitFollowup) || 0));
  const perUnitFull = Math.round(Number(config.equipmentRentalUnit) || 0) + (gearDays - 1) * followup;
  const perUnit = shortRental ? half(perUnitFull) : perUnitFull;
  const equipment = equipmentUnits * perUnit;
  const markup = Math.max(0, (Number(totalCost) || 0) - (Number(standardPrice) || 0));
  const overprice = Math.round((markup * config.overpricePercent) / 100);
  return {
    base,
    equipment,
    overprice,
    total: base + equipment + overprice,
    shortRental,
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
