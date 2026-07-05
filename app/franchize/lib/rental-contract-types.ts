// /app/franchize/lib/rental-contract-types.ts

/**
 * Contract draft data stored in rental.metadata.contract_draft
 * Submitted by user, pending crew owner approval
 */
export interface ContractDraftData {
  status: 'pending' | 'approved' | 'declined';
  submitted_at: string;
  submitted_by: string; // chat_id
  renterData: {
    full_name: string;
    passport: string;
    passport_issue_date?: string;
    registration?: string;
    birth_date?: string;
    driver_license?: string;
    phone?: string;
    email?: string;
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
    checklist?: string[];
  };
}

/**
 * Submit contract draft input
 */
export interface SubmitContractDraftInput {
  rentalId: string;
  crewSlug: string;
  bikeId: string;
  renterData: ContractDraftData['renterData'];
  equipmentData: ContractDraftData['equipmentData'];
  pickupData: ContractDraftData['pickupData'];
  actorTelegramUserId: string;
}

/**
 * Submit contract draft result
 */
export interface SubmitContractDraftResult {
  success: boolean;
  draftId?: string;
  approvalRequestSent?: boolean;
  error?: string;
}

/**
 * Approve contract input (crew owner)
 */
export interface ApproveContractInput {
  rentalId: string;
  crewSlug: string;
  bikeId: string;
  contractDraftId: string;
  actorTelegramUserId: string; // Crew owner's chat_id
}

/**
 * Approve contract result
 */
export interface ApproveContractResult {
  success: boolean;
  downloadUrl?: string;
  storagePath?: string;
  contractKey?: string;
  sha256?: string;
  error?: string;
}

/**
 * Decline contract input
 */
export interface DeclineContractInput {
  rentalId: string;
  contractDraftId: string;
  reason?: string;
  actorTelegramUserId: string;
}

/**
 * Decline contract result
 */
export interface DeclineContractResult {
  success: boolean;
  error?: string;
}

/**
 * Return-time contract update input
 */
export interface FinalizeRentalReturnInput {
  crewSlug: string;
  rentalId: string;
  contractKey: string;
  returnData: {
    damage_notes_at_return: string;
    battery_level_end?: string;
    odometer_end_km?: number;
    fuel_level_end?: string;
  };
  actorTelegramUserId: string;
}

/**
 * Return-time contract update result
 */
export interface FinalizeRentalReturnResult {
  success: boolean;
  finishedDownloadUrl?: string;
  finishedStoragePath?: string;
  finishedSha256?: string;
  originalSha256?: string;
  error?: string;
}

/**
 * Template variables matching RENTAL_DEAL_TEMPLATE.html placeholders
 */
export interface RentalContractTemplateVars {
  // Basic
  contract_number: string;
  day: string;
  month: string;
  month_num: string;
  year: string;

  // Renter
  renter_full_name: string;
  renter_birth_date?: string;
  renter_phone?: string;
  renter_email?: string;
  renter_address?: string;
  renter_driver_license?: string;
  renter_passport: string;
  renter_passport_issue_date?: string;
  renter_registration?: string;

  // Bike
  bike_make: string;
  bike_model: string;
  bike_plate?: string;
  bike_vin: string;
  bike_category: string;
  bike_color: string;
  bike_year: string;
  bike_engine_cc: string;
  bike_power_hp: string;
  bike_power_kw: string;
  bike_max_speed: string;
  bike_battery?: string;

  // Dynamic vehicle type (computed)
  bike_vehicle_type_label: string;
  bike_vehicle_type_accusative: string;
  bike_vehicle_type_genitive: string;

  // Dynamic engine spec lines
  bike_engine_spec_line_1: string;
  bike_engine_spec_line_2: string;
  bike_engine_spec_line_3: string;

  // Dates
  rent_start_date: string;
  rent_start_time: string;
  rent_end_date: string;
  rent_end_time: string;

  // Pricing
  hourly_price_rub: string;
  daily_price_rub: string;
  subtotal_rub: string;
  deposit_rub: string;
  included_km_per_day: string;
  extra_km_fee_rub: string;
  late_return_penalty_rub: string;
  late_return_penalty_max_days: string;
  bike_value_rub: string;
  bike_value_words?: string;

  // Organization/Legal
  organization_short: string;
  legal_address: string;
  ogrnip: string;
  inn: string;
  bank_account: string;
  bank_name: string;
  bank_city: string;
  bank_corr_account: string;
  issuer_signatory: string;
  lessor_address: string;
  email?: string;

  // Equipment/Condition
  equipment: string;
  damage_notes_at_delivery: string;
  damage_notes_at_return?: string;
  battery_level_start: string;
  battery_level_end?: string;
  bike_mileage: string;
  media_links: string;

  // Computed
  signature_timestamp: string;
  signature_fingerprint: string;
  renter_signature: string;
  document_key: string;
}

/**
 * Crew contract secrets from private.crew_secrets
 */
export interface CrewContractSecrets {
  organizationName?: string;
  organizationShort?: string;
  organizationRepresentative?: string;
  ogrnip?: string;
  inn?: string;
  bankAccount?: string;
  bankName?: string;
  bankCorrAccount?: string;
  bankCity?: string;
  email?: string;
  legalAddress?: string;
}

/**
 * Bike spec mapping from public.cars.specs
 */
export interface BikeSpecs {
  type?: string;
  year?: string;
  color?: string;
  vin?: string;
  frame?: string;
  category?: string;
  power_kw?: string;
  motor_nominal_kw?: string;
  motor_peak_kw?: string;
  motor_hp?: string;
  top_speed_kmh?: string;
  battery?: string;
  engine_cc?: string;
  displacement_cc?: string;
  max_power_hp?: string;
  dailyPrice?: number;
  rent_weekday?: number;
  rent_weekend?: number;
  price_per_hour?: number;
  deposit_rub?: number;
  sale_price?: number;
  price_rub?: number;
}
