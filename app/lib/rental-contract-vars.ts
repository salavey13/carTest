// /app/lib/rental-contract-vars.ts
/**
 * Shared rental contract variable builder
 * ================================================================
 *
 * Canonical builder for DOCX template variables used across:
 * - /doc flow (app/webhook-handlers/commands/doc-manual.ts)
 * - OCR skill (scripts/make-deal-contract-skill.mjs)
 * - Web app (app/franchize/actions-runtime.ts)
 *
 * All three flows MUST use this builder to ensure identical DOCX output
 * for the same bike/renter/dates.
 */

import { readPath } from "@/lib/readPath";
import { calculatePriceForDuration } from "@/app/franchize/lib/pricing-calculator";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/**
 * Renter personal data from any source (manual input, OCR, web-app, user secrets)
 */
export type RenterData = {
  fullName: string;
  birthDate: string;
  phone?: string;
  email?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportIssuedBy?: string;
  registration?: string;
  address?: string;
  driverLicenseSeries?: string;
  driverLicenseNumber?: string;
};

/**
 * Bike specifications from any source (Supabase cars table, cart, etc.)
 */
export type BikeSpecs = {
  id?: string | number;
  make?: string;
  model?: string;
  type?: string; // "ebike" or "bike"
  specs?: {
    plate?: string;
    vin?: string;
    frame?: string;
    vin_number?: string;
    category?: string;
    tp_category?: string;
    color?: string;
    year?: number;
    production_year?: number;
    engine_cc?: number;
    displacement_cc?: number;
    power_hp?: number;
    max_power_hp?: number;
    power_kw?: number;
    max_speed?: number;
    top_speed_kmh?: number;
    battery?: string;
    bike_subtype?: string;
    fuel_type?: string;
    type?: string; // Can also be at specs level for some data sources
    mileage?: number;
    dailyPrice?: number;
    rent_weekday?: number;
    rent_weekend?: number;
    price_per_hour?: number;
    price_per_3h?: number;
    price_per_6h?: number;
    price_per_12h?: number;
    rent_2_4d?: number;
    rent_5_10d?: number;
    rent_11_30d?: number;
    deposit_rub?: number;
    sale_price?: number;
    price_rub?: number;
    // Pre-computed engine spec lines (optional, will be computed if missing)
    bike_engine_spec_line_1?: string;
    bike_engine_spec_line_2?: string;
    bike_engine_spec_line_3?: string;
  };
};

/**
 * СТС pledge data (optional, only when using СТС as deposit instead of cash)
 */
export type StsPledgeData = {
  used: boolean;
  series?: string;
  number?: string;
  issueDate?: string;
  vehiclePlate?: string;
  vehicleVin?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  ownerFullName?: string;
  ownerRegistration?: string;
  ownerRelation?: string; // "сам арендатор", "жена", "доверенность", etc.
  pledgeReturnDays?: number;
};

/**
 * Rental period and pricing
 */
export type RentalPeriod = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  dailyPrice?: number;
  hourlyPrice?: number;
  depositOverride?: number;
};

/**
 * Crew/organization secrets (from crew_secrets table, CLI args, or defaults)
 */
export type CrewSecrets = {
  legalAddress: string;
  returnAddress?: string;
  issuerName: string;
  issuerRepresentative?: string;
  signatoryRole?: string;
  organizationRepresentative?: string;
  organizationName: string;
  organizationShort: string;
  ogrnip: string;
  inn: string;
  bankAccount: string;
  bankName: string;
  bankCity: string;
  bankCorrAccount: string;
  email: string;
  // Optional: contract defaults override
  contractDefaults?: Record<string, unknown>;
};

/**
 * Document metadata
 */
export type DocumentMeta = {
  contractNumber?: string;
  signatureTimestamp?: string;
  signatureFingerprint?: string;
  renterSignature?: string;
  documentKey?: string;
  // Optional: additional dates for appendix
  appendixDate?: string;
  contractDate?: string;
  // Web app specific
  slug?: string;
  orderId?: string;
  verifiedAt?: string;
};

// ─────────────────────────────────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────────────────────────────────

export type RentalContractVariables = Record<string, string>;

// ─────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_DEPOSIT = 20000;
const DEFAULT_INCLUDED_KM_PER_DAY = 200;
const DEFAULT_EXTRA_KM_FEE = 35;
const DEFAULT_LATE_RETURN_PENALTY = 10000;
const DEFAULT_LATE_RETURN_PENALTY_MAX_DAYS = 90;
const DEFAULT_BIKE_VALUE = 850000;
const DEFAULT_EQUIPMENT = "ключ(и) 1 шт.; шлем 1";

// ─────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Normalize time string - replace dots with colons for "18.00" -> "18:00"
 */
function normalizeTime(timeStr: string): string {
  return timeStr.replace(".", ":");
}

/**
 * Check if bike is electric based on type field
 */
function isElectricBike(bike: BikeSpecs): boolean {
  const typeStr = String(bike.type || "").toLowerCase();
  const specsType = String(bike.specs?.type || bike.specs?.fuel_type || "").toLowerCase();
  return typeStr === "ebike" || /электро|electric|e-bike|ebike/i.test(typeStr + specsType);
}

/**
 * Build vehicle type labels based on electric vs ICE
 */
function buildVehicleTypeLabels(isElectric: boolean) {
  return {
    label: isElectric ? "ЭЛЕКТРОМОТОЦИКЛА" : "МОТОЦИКЛА",
    accusative: isElectric ? "электромотоцикл" : "мотоцикл",
    genitive: isElectric ? "электромотоцикла" : "мотоцикла",
  };
}

/**
 * Build engine spec lines based on bike specs
 */
function buildEngineSpecLines(bike: BikeSpecs, isElectric: boolean): {
  line1: string;
  line2: string;
  line3: string;
} {
  const specs = bike.specs || {};

  // Use pre-computed lines if available (from seed data)
  // Check for non-empty string to avoid falling through on empty seed data
  if (specs.bike_engine_spec_line_1 && specs.bike_engine_spec_line_1.trim().length > 0) {
    return {
      line1: String(specs.bike_engine_spec_line_1),
      line2: String(specs.bike_engine_spec_line_2 || ""),
      line3: String(specs.bike_engine_spec_line_3 || ""),
    };
  }

  if (isElectric) {
    const line1 = specs.power_kw
      ? `мощность двигателя (номинальная) ${specs.power_kw} кВт`
      : "";
    const line2 = specs.max_speed || specs.top_speed_kmh
      ? `максимальная конструктивная скорость ${specs.max_speed || specs.top_speed_kmh} км/ч`
      : "";
    const line3 = specs.battery
      ? `аккумулятор: тип/ёмкость ${specs.battery}`
      : "";
    return { line1, line2, line3 };
  }

  // ICE bike
  const ccPart = specs.engine_cc || specs.displacement_cc
    ? `рабочий объем ${specs.engine_cc || specs.displacement_cc} куб. см`
    : "";
  const hpPart = specs.power_hp || specs.max_power_hp
    ? `мощность ${specs.power_hp || specs.max_power_hp} л.с.`
    : "";
  const line1 = [ccPart, hpPart].filter(Boolean).join(", ") || "";
  const line2 = specs.max_speed || specs.top_speed_kmh
    ? `максимальная конструктивная скорость ${specs.max_speed || specs.top_speed_kmh} км/ч`
    : "";
  const line3 = ""; // No battery line for ICE

  return { line1, line2, line3 };
}

/**
 * Resolve deposit value: explicit override > bike.specs.deposit_rub > default
 */
function resolveDeposit(rentalPeriod: RentalPeriod, bikeSpecs: BikeSpecs["specs"]): string {
  // Validate depositOverride: must be positive finite number
  if (
    rentalPeriod.depositOverride != null &&
    typeof rentalPeriod.depositOverride === "number" &&
    isFinite(rentalPeriod.depositOverride) &&
    rentalPeriod.depositOverride > 0
  ) {
    return String(rentalPeriod.depositOverride);
  }
  if (bikeSpecs?.deposit_rub && isFinite(bikeSpecs.deposit_rub) && bikeSpecs.deposit_rub > 0) {
    return String(bikeSpecs.deposit_rub);
  }
  return String(DEFAULT_DEPOSIT);
}

/**
 * Resolve bike value: sale_price > price_rub > default
 */
function resolveBikeValue(bikeSpecs: BikeSpecs["specs"]): string {
  if (bikeSpecs?.sale_price) {
    return String(bikeSpecs.sale_price);
  }
  if (bikeSpecs?.price_rub) {
    return String(bikeSpecs.price_rub);
  }
  return String(DEFAULT_BIKE_VALUE);
}

/**
 * Resolve daily price: rentalPeriod.dailyPrice > bike.specs.dailyPrice > bike.specs.rent_weekday > default
 */
function resolveDailyPrice(rentalPeriod: RentalPeriod, bikeSpecs: BikeSpecs["specs"]): string {
  if (rentalPeriod.dailyPrice && rentalPeriod.dailyPrice > 0) {
    return String(rentalPeriod.dailyPrice);
  }
  if (bikeSpecs?.dailyPrice) {
    return String(bikeSpecs.dailyPrice);
  }
  if (bikeSpecs?.rent_weekday) {
    return String(bikeSpecs.rent_weekday);
  }
  return "10000";
}

/**
 * Resolve hourly price: rentalPeriod.hourlyPrice > bike.specs.price_per_hour > daily/8 > default
 */
function resolveHourlyPrice(rentalPeriod: RentalPeriod, bikeSpecs: BikeSpecs["specs"], dailyPrice: string): string {
  if (rentalPeriod.hourlyPrice && rentalPeriod.hourlyPrice > 0) {
    return String(rentalPeriod.hourlyPrice);
  }
  if (bikeSpecs?.price_per_hour) {
    return String(bikeSpecs.price_per_hour);
  }
  // Fallback: calculate from daily price with default safety net
  const DEFAULT_HOURLY_PRICE = 1250; // ~1/8 of default daily price
  const dailyNum = Number(dailyPrice);
  if (dailyNum > 0) {
    return String(Math.round(dailyNum / 8));
  }
  return String(DEFAULT_HOURLY_PRICE);
}

/**
 * Get contract defaults from crew secrets
 */
function getContractDefault(
  crewSecrets: CrewSecrets,
  key: string,
  defaultValue: string | number
): string {
  if (crewSecrets.contractDefaults) {
    const value = readPath(crewSecrets.contractDefaults, [key], defaultValue);
    return String(value ?? defaultValue);
  }
  return String(defaultValue);
}

/**
 * Calculate rental duration in hours from start/end dates and times
 * Handles both DD.MM.YYYY and YYYY-MM-DD date formats
 *
 * NOTE: Dates and times are treated as local to the user (no timezone conversion).
 * All timestamps are computed in UTC to ensure consistent arithmetic regardless
 * of server timezone. This works because we're computing differences, not absolute times.
 */
function calculateRentalHours(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): number {
  const parseDate = (dateStr: string) => {
    // Try DD.MM.YYYY format first (supports single or double digit day/month)
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      // Validate ranges
      if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
      return { y, m: m - 1, d };
    }
    // Try YYYY-MM-DD format
    const isoParts = dateStr.split('-');
    if (isoParts.length === 3) {
      const [y, m, d] = isoParts.map(Number);
      if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
      return { y, m: m - 1, d };
    }
    return null;
  };

  const parseTime = (timeStr: string) => {
    // Support HH:MM or H:M format (also HH.MM due to normalizeTime)
    const parts = String(timeStr || '').replace('.', ':').split(':');
    if (parts.length !== 2) return { hours: 0, minutes: 0 };
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return { hours: 0, minutes: 0 };
    }
    return { hours: h, minutes: m };
  };

  const startParts = parseDate(startDate);
  const endParts = parseDate(endDate);
  if (!startParts || !endParts) return 0;

  const startHourMin = parseTime(startTime);
  const endHourMin = parseTime(endTime);

  // Create UTC timestamps representing local datetime
  // Date.UTC(y, month, day, hours, minutes, seconds, ms)
  const startMs = Date.UTC(startParts.y, startParts.m, startParts.d, startHourMin.hours, startHourMin.minutes, 0, 0);
  const endMs = Date.UTC(endParts.y, endParts.m, endParts.d, endHourMin.hours, endHourMin.minutes, 0, 0);

  // Calculate hours difference (rounded to 0.1 for precision)
  return Math.max(0, Math.round((endMs - startMs) / (1000 * 60 * 60) * 10) / 10);
}

// ─────────────────────────────────────────────────────────────────────────
// Main builder function
// ─────────────────────────────────────────────────────────────────────────

export interface BuildRentalContractVariablesOptions {
  renter: RenterData;
  bike: BikeSpecs;
  period: RentalPeriod;
  crewSecrets: CrewSecrets;
  stsPledge?: StsPledgeData;
  meta?: DocumentMeta;
  // Web app specific: extras info (optional)
  extrasRows?: string;
  extrasTotalRub?: string;
  // Cart-provided price breakdown (optional, skips recalculation)
  priceBreakdown?: {
    totalRub: number;
    basePriceRub: number;
    helmetRub: number;
    depositRub: number;
    savingsRub: number;
    savingsPercent: number;
    tier: string;
  };
  // Equipment selection (from /doc flow)
  equipment?: {
    helmets?: number;
    gloves?: number;
    net?: boolean;
    backpack?: boolean;
    bag?: boolean;
    charger?: boolean;
  };
  // Odometer reading before rental
  odometerBefore?: number;
  // Payment split (cash vs bank transfer)
  paymentSplit?: {
    cashAmount: number;
    bankAmount: number;
  };
}

/**
 * Build canonical DOCX template variables for rental contract
 *
 * This is the ONE TRUE SOURCE for all rental contract variable building.
 * All flows (/doc, OCR, web-app) MUST use this function.
 */
export function buildRentalContractVariables(
  options: BuildRentalContractVariablesOptions
): RentalContractVariables {
  const {
    renter,
    bike,
    period,
    crewSecrets,
    stsPledge = { used: false },
    meta = {},
  } = options;

  const now = new Date();
  const isElectric = isElectricBike(bike);
  const bikeSpecs = bike.specs || {};
  const vehicleTypes = buildVehicleTypeLabels(isElectric);
  const engineSpecs = buildEngineSpecLines(bike, isElectric);

  // Resolve prices and deposit
  const dailyPrice = resolveDailyPrice(period, bikeSpecs);
  const hourlyPrice = resolveHourlyPrice(period, bikeSpecs, dailyPrice);
  const deposit = resolveDeposit(period, bikeSpecs);
  const bikeValue = resolveBikeValue(bikeSpecs);

  // Calculate rental duration and subtotal
  const rentalHours = calculateRentalHours(
    period.startDate,
    period.startTime,
    period.endDate,
    period.endTime
  );
  const rentalDays = Math.max(1, Math.ceil(rentalHours / 24));
  const isHourlyRental = rentalHours > 0 && rentalHours < 24;

  // Use cart-provided priceBreakdown if available, otherwise use tier-aware pricing
  let subtotal: number;
  let tierLabel = '';
  let tierUnit = '';
  let tierPrice = 0;
  if (options.priceBreakdown) {
    subtotal = options.priceBreakdown.totalRub;
  } else {
    // Tier-aware pricing: uses price_per_3h, price_per_6h, price_per_12h, weekday/weekend, multi-day tiers
    const specsForPricing = {
      price_per_hour: bikeSpecs.price_per_hour,
      price_per_3h: bikeSpecs.price_per_3h,
      price_per_6h: bikeSpecs.price_per_6h,
      price_per_12h: bikeSpecs.price_per_12h,
      dailyPrice: bikeSpecs.dailyPrice,
      rent_weekday: bikeSpecs.rent_weekday,
      rent_weekend: bikeSpecs.rent_weekend,
      rent_2_4d: bikeSpecs.rent_2_4d,
      rent_5_10d: bikeSpecs.rent_5_10d,
      rent_11_30d: bikeSpecs.rent_11_30d,
    };
    // Convert DD.MM.YYYY to YYYY-MM-DD for the calculator
    const startDateForCalc = (() => {
      const s = period.startDate;
      if (!s) return undefined;
      const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
      return s;
    })();
    const tierResult = calculatePriceForDuration(specsForPricing, rentalHours, startDateForCalc);
    const tierPeriod = tierResult.period || '';
    tierLabel = tierPeriod.replace(/^\//, '').trim() || 'сутки';
    tierUnit = tierPeriod ? `за ${tierLabel}` : 'за сутки';
    tierPrice = tierResult.price > 0 ? tierResult.price : Number(dailyPrice) * rentalDays;
    subtotal = tierPrice;
  }
  const subtotalRounded = Math.round(subtotal);

  // Contract number - use meta or default format
  const contractNumber = meta.contractNumber || `${now.getDate()}.${now.getMonth() + 1}/${bike.id || "unknown"}`;

  // Passport string
  const passport = [renter.passportSeries, renter.passportNumber]
    .filter(Boolean)
    .join(" ")
    .trim();

  // Driver license string
  const driverLicense = [renter.driverLicenseSeries, renter.driverLicenseNumber]
    .filter(Boolean)
    .join(" ")
    .trim();

  // VIN resolution priority
  const vin = bikeSpecs.vin || bikeSpecs.frame || bikeSpecs.vin_number || "уточняется";

  // Year resolution
  const year = String(bikeSpecs.year || bikeSpecs.production_year || "уточняется");

  // Category resolution
  const category = bikeSpecs.category || bikeSpecs.tp_category || "A/L3";

  // Mileage
  const mileage = String(bikeSpecs.mileage || "");

  // Build base variables
  const vars: RentalContractVariables = {
    // Contract dates
    contract_number: contractNumber,
    day: String(now.getDate()).padStart(2, "0"),
    month: now.toLocaleString("ru-RU", { month: "long" }),
    month_num: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
    contract_day: String(now.getDate()),
    contract_month_genitive: now.toLocaleString("ru-RU", { month: "long" }),
    contract_year: String(now.getFullYear()),
    contract_date: meta.contractDate || now.toLocaleDateString("ru-RU"),
    appendix_date: meta.appendixDate || `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`,

    // Renter identity
    renter_full_name: renter.fullName || "",
    renter_birth_date: renter.birthDate || "",
    renter_phone: renter.phone || "",
    renter_email: renter.email || "",
    renter_driver_license: driverLicense,
    renter_passport: passport,
    renter_passport_issue_date: renter.passportIssueDate || "",
    renter_passport_issued_by: renter.passportIssuedBy || "",
    renter_registration: renter.registration || "",
    renter_address: renter.address || renter.registration || "",

    // Bike identity
    bike_make_model: `${bike.make || ""} ${bike.model || ""}`.trim(),
    bike_make: bike.make || "уточняется",
    bike_model: bike.model || "уточняется",
    bike_plate: bikeSpecs.plate || "уточняется",
    bike_vin: vin,
    bike_category: category,
    bike_color: bikeSpecs.color || "уточняется",
    bike_year: year,
    bike_mileage: mileage,

    // Engine specs
    bike_engine_cc: String(bikeSpecs.engine_cc || bikeSpecs.displacement_cc || "0"),
    bike_power_hp: String(bikeSpecs.power_hp || bikeSpecs.max_power_hp || "0"),
    bike_power_kw: String(bikeSpecs.power_kw || "0"),
    bike_max_speed: String(bikeSpecs.max_speed || bikeSpecs.top_speed_kmh || "уточняется"),
    bike_battery: String(bikeSpecs.battery || (isElectric ? "уточняется" : "")),

    // Vehicle type labels
    bike_vehicle_type_label: vehicleTypes.label,
    bike_vehicle_type_accusative: vehicleTypes.accusative,
    bike_vehicle_type_genitive: vehicleTypes.genitive,

    // Engine spec lines
    bike_engine_spec_line_1: engineSpecs.line1,
    bike_engine_spec_line_2: engineSpecs.line2,
    bike_engine_spec_line_3: engineSpecs.line3,

    // Rental period
    rent_start_date: period.startDate,
    rent_start_time: normalizeTime(period.startTime),
    rent_end_date: period.endDate,
    rent_end_time: normalizeTime(period.endTime),

    // Pricing
    daily_price_rub: dailyPrice,
    hourly_price_rub: hourlyPrice,
    deposit_rub: deposit,
    subtotal_rub: String(subtotalRounded), // Calculated from rental duration
    // Tier-aware pricing (for quick-info and section 4.1)
    pricing_tier_label: tierLabel || 'сутки',
    pricing_tier_price_rub: String(Math.round(tierPrice || subtotalRounded)),
    pricing_tier_unit: tierUnit || 'за сутки',
    // Equipment
    equipment_helmets: String(options.equipment?.helmets || 0),
    equipment_gloves: String(options.equipment?.gloves || 0),
    equipment_net: options.equipment?.net ? 'да' : 'нет',
    equipment_backpack: options.equipment?.backpack ? 'да' : 'нет',
    equipment_bag: options.equipment?.bag ? 'да' : 'нет',
    equipment_charger: options.equipment?.charger ? 'да' : 'нет',
    equipment_total_cost: String(
      (options.equipment?.helmets || 0) * 1000 +
      (options.equipment?.gloves || 0) * 500 +
      (options.equipment?.net ? 500 : 0) +
      (options.equipment?.backpack ? 500 : 0) +
      (options.equipment?.bag ? 500 : 0)
    ),
    equipment_summary: (() => {
      const parts: string[] = [];
      const h = options.equipment?.helmets || 0;
      const g = options.equipment?.gloves || 0;
      if (h > 0) parts.push(`Шлем ×${h}`);
      if (g > 0) parts.push(`Перчатки ×${g}`);
      if (options.equipment?.net) parts.push('Сетка');
      if (options.equipment?.backpack) parts.push('Рюкзак');
      if (options.equipment?.bag) parts.push('Сумка');
      if (options.equipment?.charger) parts.push('Зарядка');
      return parts.length > 0 ? parts.join(', ') : '—';
    })(),
    // Payment split
    payment_cash_rub: String(options.paymentSplit?.cashAmount || 0),
    payment_bank_rub: String(options.paymentSplit?.bankAmount || 0),
    // Odometer
    odometer_before: String(options.odometerBefore || 0),
    bike_value_rub: bikeValue,
    bike_value_words: "", // Not used in rental contracts (sale-only field)

    // Rental terms defaults
    included_km_per_day: getContractDefault(crewSecrets, "included_km_per_day", DEFAULT_INCLUDED_KM_PER_DAY),
    extra_km_fee_rub: getContractDefault(crewSecrets, "extra_km_fee_rub", DEFAULT_EXTRA_KM_FEE),
    late_return_penalty_rub: getContractDefault(crewSecrets, "late_return_penalty_rub", DEFAULT_LATE_RETURN_PENALTY),
    late_return_penalty_max_days: getContractDefault(crewSecrets, "late_return_penalty_max_days", DEFAULT_LATE_RETURN_PENALTY_MAX_DAYS),

    // Delivery/return defaults
    equipment: getContractDefault(crewSecrets, "equipment", DEFAULT_EQUIPMENT),
    damage_notes_at_delivery: "от даты начала аренды",
    damage_notes_at_return: "от даты возврата ТС",
    battery_level_start: "100 %",
    battery_level_end: "____ %",
    media_links: "телефон",
    damage_price_list: "мотоцикл в сборе / царапина на пластике / прочее по расчету",

    // Crew/Org info
    seller_address: crewSecrets.legalAddress,
    lessor_address: crewSecrets.legalAddress,
    return_address: crewSecrets.returnAddress || crewSecrets.legalAddress,
    issuer_name: crewSecrets.issuerName,
    issuer_signatory: crewSecrets.signatoryRole || "Менеджер Мотосалона",
    issuer_representative: crewSecrets.issuerRepresentative || crewSecrets.organizationRepresentative || crewSecrets.issuerName,
    organization_representative: crewSecrets.organizationRepresentative || crewSecrets.issuerName || crewSecrets.organizationShort || "ИП Воробьев Р.В.",
    organization_name: crewSecrets.organizationName,
    organization_short: crewSecrets.organizationShort,
    ogrnip: crewSecrets.ogrnip,
    inn: crewSecrets.inn,
    bank_account: crewSecrets.bankAccount,
    bank_name: crewSecrets.bankName,
    bank_city: crewSecrets.bankCity,
    bank_corr_account: crewSecrets.bankCorrAccount,
    email: crewSecrets.email,
    legal_address: crewSecrets.legalAddress,

    // Signatures
    signature_timestamp: meta.signatureTimestamp || now.toLocaleString("ru-RU"),
    signature_fingerprint: meta.signatureFingerprint || "manual",
    renter_signature: meta.renterSignature || "согласие через Telegram",

    // Document key
    document_key: meta.documentKey || `rental-${bike.id || "unknown"}-${Date.now()}`,

    // СТС pledge (only when used)
    sts_collateral: stsPledge.used ? "1" : "",
    sts_series: stsPledge.series || "",
    sts_number: stsPledge.number || "",
    sts_issue_date: stsPledge.issueDate || "",
    sts_vehicle_plate: stsPledge.vehiclePlate || "",
    sts_vehicle_vin: stsPledge.vehicleVin || "",
    sts_vehicle_model: stsPledge.vehicleModel || "",
    sts_vehicle_year: stsPledge.vehicleYear || "",
    sts_owner_full_name: stsPledge.ownerFullName || "",
    sts_owner_registration: stsPledge.ownerRegistration || "",
    sts_owner_relation: stsPledge.ownerRelation || "сам арендатор",
    sts_pledge_return_days: String(stsPledge.pledgeReturnDays || 3),
    // When СТС is used, record the cash deposit that was skipped (analytics)
    sts_deposit_amount_skipped: stsPledge.used ? deposit : "",
  };

  // Web app specific: verified_at, extras
  if (meta.verifiedAt) {
    vars.verified_at = meta.verifiedAt;
  }
  if (options.extrasRows) {
    vars.extras_rows = options.extrasRows;
  }
  if (options.extrasTotalRub) {
    vars.extras_total_rub = options.extrasTotalRub;
  }

  return vars;
}
