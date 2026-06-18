// /app/franchize/lib/rental-contract-vars.ts
import type { RentalContractTemplateVars, BikeSpecs, CrewContractSecrets } from './rental-contract-types';

const TEMPLATE_BASE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';
const TEMPLATE_MD_PATH = 'docs/RENTAL_DEAL_TEMPLATE.md';

/**
 * Determine if bike is electric based on type and specs
 */
export function isElectricBike(bike: BikeSpecs, type: string): boolean {
  const specs = bike as any; // Allow access to additional spec properties
  return type === 'ebike'
    || /electric/i.test(bike.type || '')
    || /электро|electric|e-bike|ebike/i.test(specs.fuel_type || '')
    || (bike.power_kw && Number(bike.power_kw) > 0 && !bike.engine_cc)
    || (bike.battery && !bike.engine_cc);
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
  const dailyPrice = params.bike.specs.dailyPrice || params.bike.specs.rent_weekday || 10000;
  const hourlyPrice = params.bike.specs.price_per_hour || Math.round(dailyPrice / 8);
  const deposit = params.bike.specs.deposit_rub || 20000;
  const bikeValue = params.bike.specs.sale_price || params.bike.specs.price_rub || 850000;

  let subtotal: number;
  if (isHourly) {
    subtotal = Number(hourlyPrice) * rentalHours;
  } else {
    subtotal = Number(dailyPrice) * rentalDays;
  }
  const subtotalRounded = Math.round(subtotal);

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
    included_km_per_day: String(params.contractDefaults.includedMileage || 200),
    extra_km_fee_rub: String(params.contractDefaults.overageRate || 35),
    late_return_penalty_rub: String(params.contractDefaults.lateReturnPenaltyRub || 10000),
    late_return_penalty_max_days: '90',
    bike_value_rub: String(bikeValue),
    bike_value_words: '', // Optional: could use number-to-words lib

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
