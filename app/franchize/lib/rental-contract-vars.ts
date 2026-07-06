// /app/franchize/lib/rental-contract-vars.ts
import type { RentalContractTemplateVars, BikeSpecs, CrewContractSecrets } from './rental-contract-types';
import { calculatePriceForDuration } from './pricing-calculator';

const TEMPLATE_BASE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';
const TEMPLATE_MD_PATH = 'docs/RENTAL_DEAL_TEMPLATE.md';

/**
 * Count weekend days (Sat=6, Sun=0) in a date range [startDate, endDate].
 * Dates can be in DD.MM.YYYY or YYYY-MM-DD format.
 */
function countWeekendDaysInRange(startDate: string, endDate: string): number {
  try {
    // Parse dates — handle both DD.MM.YYYY and YYYY-MM-DD
    const parseDate = (s: string): Date | null => {
      if (!s) return null;
      // DD.MM.YYYY format
      const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}T00:00:00`);
      // YYYY-MM-DD format
      const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (ymd) return new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00`);
      return null;
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) return 0;

    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      const day = d.getDay(); // 0=Sun, 6=Sat
      if (day === 0 || day === 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Determine if bike is electric based on type and specs
 */
export function isElectricBike(bike: BikeSpecs, type?: string): boolean {
  const specs = bike as any; // Allow access to additional spec properties
  return Boolean(type === 'ebike'
    || /electric/i.test(bike.type || '')
    || /электро|electric|e-bike|ebike/i.test(specs.fuel_type || '')
    || (bike.power_kw && Number(bike.power_kw) > 0 && !bike.engine_cc)
    || (bike.battery && !bike.engine_cc));
}

/**
 * Build vehicle type labels based on ICE vs electric
 */
export function getVehicleTypeLabels(isElectric: boolean) {
  return {
    label: isElectric ? 'ЭЛЕКТРОМОТОЦИКЛА' : 'МОТОЦИКЛА',
    accusative: isElectric ? 'электромотоцикл' : 'мотоцикл',
    genitive: isElectric ? 'электромотоцикла' : 'мотоцикла',
  };
}

/**
 * Build 3 engine spec lines based on ICE vs electric
 */
export function getEngineSpecLines(isElectric: boolean, bike: BikeSpecs) {
  const specs = bike as any; // Allow access to additional spec properties
  const powerKw = bike.power_kw || specs.nominal_power_kw || specs.motor_nominal_kw || '';
  const powerHp = bike.motor_hp || specs.max_power_hp || '';
  const engineCc = bike.engine_cc || bike.displacement_cc || '';
  const maxSpeed = bike.top_speed_kmh || specs.top_speed_kmh || '';
  const battery = bike.battery || specs.battery_type_capacity || '';

  if (isElectric) {
    return {
      line1: powerKw ? `мощность двигателя (номинальная) ${powerKw} кВт` : '',
      line2: maxSpeed ? `максимальная конструктивная скорость ${maxSpeed} км/ч` : '',
      line3: battery ? `аккумулятор: тип/ёмкость ${battery}` : '',
    };
  } else {
    // ICE: displacement + power on line 1, max speed on line 2, blank line 3
    const ccPart = engineCc ? `рабочий объем ${engineCc} куб. см` : '';
    const hpPart = powerHp ? `мощность ${powerHp} л.с.` : '';
    return {
      line1: [ccPart, hpPart].filter(Boolean).join(', ') || '',
      line2: maxSpeed ? `максимальная конструктивная скорость ${maxSpeed} км/ч` : '',
      line3: '', // No battery for ICE
    };
  }
}

/**
 * Build complete template vars object from all data sources
 */
export async function buildTemplateVars(params: {
  crewSlug: string;
  bike: { id: string; make: string; model: string; specs: BikeSpecs; type: string };
  crewSecrets: CrewContractSecrets;
  contractDefaults: {
    issuerRepresentative?: string;
    returnAddress?: string;
    includedMileage?: number;
    overageRate?: number;
    lateReturnPenaltyRub?: number;
  };
  dates: { start: string; startTime: string; end: string; endTime: string };
  renterData: {
    full_name: string;
    passport: string;
    passport_issue_date?: string;
    registration?: string;
    birth_date?: string;
    driver_license?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  equipmentData: {
    keys_count: number;
    helmets_count: number;
    gloves_count?: number;
    net?: boolean;
    backpack?: boolean;
    bag?: boolean;
    charger: boolean;
    lock: boolean;
    other_equipment?: string;
  };
  pickupData: {
    odometer_km: number;
    fuel_level?: string;
    battery_start?: string;
    damage_notes_at_delivery: string;
  };
  returnData?: {
    damage_notes_at_return?: string;
    battery_level_end?: string;
  };
  // Payment split (cash vs bank transfer)
  paymentSplit?: {
    cashAmount: number;
    bankAmount: number;
  };
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
}): Promise<RentalContractTemplateVars> {
  const now = new Date();
  const isElectric = isElectricBike(params.bike.specs, params.bike.type);
  const vehicleLabels = getVehicleTypeLabels(isElectric);
  const engineLines = getEngineSpecLines(isElectric, params.bike.specs);

  // Calculate rental duration and pricing
  const rentalHours = calculateRentalHours(
    params.dates.start,
    params.dates.startTime,
    params.dates.end,
    params.dates.endTime
  );
  const rentalDays = Math.max(1, Math.ceil(rentalHours / 24));
  const isHourly = rentalHours > 0 && rentalHours < 24;

  // Pricing: use bike specs or fallback
  const baseDailyPrice = params.bike.specs.dailyPrice || params.bike.specs.rent_weekday || 10000;
  const rentWeekend = params.bike.specs.rent_weekend;
  const hourlyPrice = params.bike.specs.price_per_hour || Math.round(baseDailyPrice / 8);
  const deposit = params.bike.specs.deposit_rub || 20000;
  const bikeValue = params.bike.specs.sale_price || params.bike.specs.price_rub || 850000;

  // Weekend-aware pricing: count weekend days in the rental period
  const weekendDayCount = countWeekendDaysInRange(params.dates.start, params.dates.end);
  const weekdayCount = Math.max(0, rentalDays - weekendDayCount);
  const isSingleWeekendDay = rentalDays === 1 && weekendDayCount > 0;

  // Determine the effective daily rate for display in the contract
  // For single day: use weekend rate if it's a weekend
  // For multi-day: show the blended rate
  let dailyPrice: number;
  if (isSingleWeekendDay && rentWeekend) {
    dailyPrice = rentWeekend;
  } else if (rentalDays > 1 && weekendDayCount > 0 && rentWeekend) {
    // Blended rate across weekday + weekend days
    const weekdayRate = params.bike.specs.rent_weekday || baseDailyPrice;
    dailyPrice = Math.round((weekdayCount * weekdayRate + weekendDayCount * rentWeekend) / rentalDays);
  } else {
    dailyPrice = baseDailyPrice;
  }

  // ── Tier-aware pricing using calculatePriceForDuration ──
  // This properly uses price_per_3h, price_per_6h, price_per_12h for hourly rentals
  // and rent_weekday/rent_weekend for daily rentals, plus multi-day tier rates.
  const specsForPricing = {
    price_per_hour: params.bike.specs.price_per_hour,
    price_per_3h: params.bike.specs.price_per_3h,
    price_per_6h: params.bike.specs.price_per_6h,
    price_per_12h: params.bike.specs.price_per_12h,
    dailyPrice: params.bike.specs.dailyPrice,
    rent_weekday: params.bike.specs.rent_weekday,
    rent_weekend: params.bike.specs.rent_weekend,
    rent_2_4d: params.bike.specs.rent_2_4d,
    rent_5_10d: params.bike.specs.rent_5_10d,
    rent_11_30d: params.bike.specs.rent_11_30d,
  };

  // Convert DD.MM.YYYY start date to YYYY-MM-DD for the calculator
  const startDateForCalc = (() => {
    const s = params.dates.start;
    if (!s) return undefined;
    const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    return s; // already YYYY-MM-DD
  })();

  const tierResult = calculatePriceForDuration(specsForPricing, rentalHours, startDateForCalc);

  // Use cart-provided priceBreakdown if available, otherwise use tier-aware pricing
  let subtotal: number;
  if (params.priceBreakdown) {
    subtotal = params.priceBreakdown.totalRub;
  } else {
    // Use the tier-aware price from calculatePriceForDuration
    subtotal = tierResult.price > 0 ? tierResult.price : Number(dailyPrice) * rentalDays;
  }
  const subtotalRounded = Math.round(subtotal);

  // Build tier label and unit from the period string (e.g., "/ 3 часа" → "3 часа", "за 3 часа")
  const tierPeriod = tierResult.period || '';
  const tierLabel = tierPeriod.replace(/^\//, '').trim() || 'сутки';
  const tierUnit = tierPeriod ? `за ${tierLabel}` : 'за сутки';
  const tierPrice = tierResult.price > 0 ? tierResult.price : subtotal;

  // Build equipment string
  const equipmentParts = [
    `ключ(и) ${params.equipmentData.keys_count} шт.`,
    `шлем ${params.equipmentData.helmets_count}`,
  ];
  if (params.equipmentData.charger) equipmentParts.push('зарядка');
  if (params.equipmentData.lock) equipmentParts.push('замок');
  if (params.equipmentData.other_equipment) equipmentParts.push(params.equipmentData.other_equipment);
  const equipmentStr = equipmentParts.join('; ');

  const specs = params.bike.specs as any; // Allow access to additional spec properties

  return {
    // Basic
    contract_number: `${now.getDate()}.${now.getMonth() + 1}/${params.bike.id}`,
    day: String(now.getDate()).padStart(2, '0'),
    month: now.toLocaleString('ru-RU', { month: 'long' }),
    month_num: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),

    // Renter
    renter_full_name: params.renterData.full_name,
    renter_birth_date: params.renterData.birth_date || '',
    renter_phone: params.renterData.phone || '',
    renter_email: params.renterData.email || '',
    renter_address: params.renterData.address || params.renterData.registration || '',
    renter_driver_license: params.renterData.driver_license || '',
    renter_passport: params.renterData.passport,
    renter_passport_issue_date: params.renterData.passport_issue_date || '',
    renter_registration: params.renterData.registration || '',

    // Bike
    bike_make: params.bike.make || 'уточняется',
    bike_model: params.bike.model || 'уточняется',
    bike_plate: specs.plate || 'уточняется',
    bike_vin: params.bike.specs.vin || params.bike.specs.frame || 'уточняется',
    bike_category: params.bike.specs.category || specs.license_class || 'A/L3',
    bike_color: params.bike.specs.color || 'уточняется',
    bike_year: params.bike.specs.year || specs.production_year || 'уточняется',
    bike_engine_cc: params.bike.specs.engine_cc || '0',
    bike_power_hp: params.bike.specs.motor_hp || specs.max_power_hp || '0',
    bike_power_kw: params.bike.specs.power_kw || specs.motor_nominal_kw || '0',
    bike_max_speed: params.bike.specs.top_speed_kmh || specs.top_speed_kmh || 'уточняется',
    bike_battery: isElectric ? (params.bike.specs.battery || 'уточняется') : '',

    // Dynamic vehicle type
    bike_vehicle_type_label: vehicleLabels.label,
    bike_vehicle_type_accusative: vehicleLabels.accusative,
    bike_vehicle_type_genitive: vehicleLabels.genitive,

    // Engine spec lines
    bike_engine_spec_line_1: engineLines.line1,
    bike_engine_spec_line_2: engineLines.line2,
    bike_engine_spec_line_3: engineLines.line3,

    // Dates
    rent_start_date: params.dates.start,
    rent_start_time: params.dates.startTime,
    rent_end_date: params.dates.end,
    rent_end_time: params.dates.endTime,

    // Pricing
    hourly_price_rub: String(hourlyPrice),
    daily_price_rub: String(dailyPrice),
    subtotal_rub: String(subtotalRounded),
    deposit_rub: String(deposit),
    // Tier-aware pricing (for quick-info and section 4.1)
    pricing_tier_label: tierLabel,
    pricing_tier_price_rub: String(Math.round(tierPrice)),
    pricing_tier_unit: tierUnit,
    // Equipment
    equipment_helmets: String(params.equipmentData.helmets_count || 0),
    equipment_gloves: String(params.equipmentData.gloves_count || 0),
    equipment_net: params.equipmentData.net ? 'да' : 'нет',
    equipment_backpack: params.equipmentData.backpack ? 'да' : 'нет',
    equipment_bag: params.equipmentData.bag ? 'да' : 'нет',
    equipment_charger: params.equipmentData.charger ? 'да' : 'нет',
    equipment_total_cost: String(
      (params.equipmentData.helmets_count || 0) * 1000 +
      (params.equipmentData.gloves_count || 0) * 500 +
      (params.equipmentData.net ? 500 : 0) +
      (params.equipmentData.backpack ? 500 : 0) +
      (params.equipmentData.bag ? 500 : 0)
    ),
    // Payment split
    payment_cash_rub: String(params.paymentSplit?.cashAmount || 0),
    payment_bank_rub: String(params.paymentSplit?.bankAmount || 0),
    // Odometer
    odometer_before: String(params.pickupData.odometer_km || 0),
    included_km_per_day: String(params.contractDefaults.includedMileage || 200),
    extra_km_fee_rub: String(params.contractDefaults.overageRate || 35),
    late_return_penalty_rub: String(params.contractDefaults.lateReturnPenaltyRub || 10000),
    late_return_penalty_max_days: '90',
    bike_value_rub: String(bikeValue),
    bike_value_words: '', // Not used in rental contracts (sale-only field)

    // Organization/Legal
    organization_short: params.crewSecrets.organizationShort || 'ИП Воробьева Р.В.',
    legal_address: params.crewSecrets.legalAddress || 'г. Нижний Новгород',
    ogrnip: params.crewSecrets.ogrnip || '326527500025145',
    inn: params.crewSecrets.inn || '525813643035',
    bank_account: params.crewSecrets.bankAccount || '40802810942710013083',
    bank_name: params.crewSecrets.bankName || 'Волго-Вятский Банк ПАО Сбербанк',
    bank_city: params.crewSecrets.bankCity || 'г. Нижний Новгород',
    bank_corr_account: params.crewSecrets.bankCorrAccount || '30101810900000000603',
    issuer_signatory: params.contractDefaults.issuerRepresentative || 'Менеджер Мотосалона',
    lessor_address: params.contractDefaults.returnAddress || 'г. Нижний Новгород, пл. Комсомольская 2',
    email: params.crewSecrets.email || '',

    // Equipment/Condition
    equipment: equipmentStr,
    damage_notes_at_delivery: params.pickupData.damage_notes_at_delivery,
    damage_notes_at_return: params.returnData?.damage_notes_at_return || '____________________',
    battery_level_start: params.pickupData.battery_start || (isElectric ? '100' : ''),
    battery_level_end: params.returnData?.battery_level_end || '____',
    bike_mileage: String(params.pickupData.odometer_km || ''),
    media_links: 'телефон',

    // Computed
    signature_timestamp: now.toLocaleString('ru-RU'),
    signature_fingerprint: 'web-app-generated',
    renter_signature: 'согласие через WebApp',
    document_key: `rental-${params.bike.id}-${Date.now()}`,
  };
}

/**
 * Calculate rental hours between two date-time strings
 */
function calculateRentalHours(startDate: string, startTime: string, endDate: string, endTime: string): number {
  // Parse Russian date format: DD.MM.YYYY
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    return new Date(y, m - 1, d);
  };

  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    const [h, m] = parts.map(Number);
    return h * 60 + m;
  };

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;

  const startMinutes = start.getTime() / 60000 + parseTime(startTime);
  const endMinutes = end.getTime() / 60000 + parseTime(endTime);

  return Math.max(0, Math.round((endMinutes - startMinutes) / 60 * 10) / 10);
}
