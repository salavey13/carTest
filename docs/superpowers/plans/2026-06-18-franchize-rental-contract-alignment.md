# Franchize Rental Contract Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable franchize web app rental flow to generate rental contracts with identical output to bot/skill flow, using data from Supabase (crew secrets, bike specs, user rental secrets) and UI input.

**Architecture:** Server action fetches organization/bank details from `private.crew_secrets`, bike specs from `public.cars.specs`, and renter prefill from `private.user_rental_secrets`. Merges with UI-captured equipment/condition data, renders HTML template to DOCX, stores in Supabase Storage, saves metadata to `rental_contract_artifacts`, and sends to Telegram (renter + crew owner). Post-rental, crew fills return fields and regenerates contract with `_finished` suffix.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres + Storage), TypeScript, docx (npm), HTML template rendering, Telegram Bot API

---

## File Structure

```
app/franchize/
├── server-actions/
│   ├── generate-rental-contract.ts       # NEW - Main contract generation
│   ├── finalize-rental-return.ts         # NEW - Return-time contract update
│   └── rentals.ts                         # MODIFY - Export new actions
├── lib/
│   ├── docx-capability.ts                 # MODIFY - Add DOCX storage + Telegram send
│   ├── rental-contract-types.ts           # NEW - Shared types for contract flow
│   └── rental-contract-vars.ts            # NEW - Template variable builder
├── components/
│   ├── FranchizeRentalDocumentsPanel.tsx  # MODIFY - Add contract generation UI
│   └── RentalReturnPanel.tsx              # NEW - Post-rental editing (crew only)
└── actions.ts                             # MODIFY - Re-export new actions
```

Supabase:
- Storage bucket: `rental-contracts` (create if missing)
- RLS policies for crew-scoped access

---

## Task 1: Setup Supabase Storage Bucket

**Files:**
- Run: SQL migration (via Supabase dashboard or `supabase migration`)

- [ ] **Step 1: Create storage bucket SQL**

```sql
-- /supabase/migrations/20260618000001_rental_contracts_storage.sql

-- Create storage bucket for rental contracts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rental-contracts', 'rental-contracts', false, 10485760, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- RLS: Crew members can read/write their own contracts
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members can view own rental contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rental-contracts'
  AND (
    -- Crew owner can read all contracts for their crew
    EXISTS (
      SELECT 1 FROM public.crews
      WHERE crews.id = (metadata->>'crew_id')::uuid
      AND crews.owner_id = auth.uid()
    )
    OR
    -- Renter can read their own contracts
    EXISTS (
      SELECT 1 FROM private.rental_contract_artifacts
      WHERE rental_contract_artifacts.contract_key = storage.foldername(storage.name)
      AND rental_contract_artifacts.telegram_chat_id::text = (SELECT user_id FROM private.user_secrets WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

CREATE POLICY "Crew members can upload rental contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rental-contracts'
  AND EXISTS (
    SELECT 1 FROM public.crews
    WHERE crews.id = (metadata->>'crew_id')::uuid
    AND (crews.owner_id = auth.uid() OR crews.metadata->'crew'->>'owner_id' = auth.uid()::text)
  )
);
```

- [ ] **Step 2: Apply migration**

Run via Supabase dashboard: SQL Editor → Paste → Run
Or via CLI: `supabase migration up`

- [ ] **Step 3: Verify bucket created**

Check in Supabase dashboard: Storage → Buckets → `rental-contracts` exists
Expected: Bucket with 10MB limit, .docx mime type only

- [ ] **Step 4: Commit migration**

```bash
git add supabase/migrations/20260618000001_rental_contracts_storage.sql
git commit -m "feat(storage): add rental-contracts bucket with RLS policies"
```

---

## Task 2: Define Shared Types

**Files:**
- Create: `app/franchize/lib/rental-contract-types.ts`

- [ ] **Step 1: Write the type definitions file**

```typescript
// /app/franchize/lib/rental-contract-types.ts

/**
 * Contract generation input from web app
 */
export interface GenerateRentalContractInput {
  crewSlug: string;
  bikeId: string;
  rentalId: string;
  dates: {
    start: string;      // "15.06.2026"
    startTime: string;  // "18:00"
    end: string;        // "16.06.2026"
    endTime: string;    // "10:00"
  };
  renterData: {
    full_name: string;
    passport: string;           // "1234 567890"
    passport_issue_date?: string;  // "15.03.2020"
    registration?: string;      // "г. Нижний Новгород, ул. Примерная, д. 1"
    birth_date?: string;       // "01.01.1990"
    driver_license?: string;   // "1234 123456"
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
    fuel_level?: string;        // For ICE bikes, e.g., "4/5"
    battery_start?: string;     // For electric bikes, e.g., "100"
    damage_notes_at_delivery: string;
    checklist?: string[];
  };
  actorTelegramUserId?: string; // For auth/permissions
}

/**
 * Contract generation result
 */
export interface GenerateRentalContractResult {
  success: boolean;
  downloadUrl?: string;
  storagePath?: string;
  telegramFileId?: string;
  contractKey?: string;
  sha256?: string;
  rentalId?: string;
  error?: string;
}

/**
 * Return-time contract update input
 */
export interface FinalizeRentalReturnInput {
  crewSlug: string;
  rentalId: string;
  contractKey: string; // From original generation
  returnData: {
    damage_notes_at_return: string;
    battery_level_end?: string; // For electric bikes
    odometer_end_km?: number;
    fuel_level_end?: string;    // For ICE bikes
  };
  actorTelegramUserId?: string;
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
  bike_vehicle_type_label: string;      // "МОТОЦИКЛА" or "ЭЛЕКТРОМОТОЦИКЛА"
  bike_vehicle_type_accusative: string; // "мотоцикл" or "электромотоцикл"
  bike_vehicle_type_genitive: string;   // "мотоцикла" or "электромотоцикла"

  // Dynamic engine spec lines (3 lines, content depends on ICE vs electric)
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

  // Organization/Legal (from private.crew_secrets)
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

  // Computed fields
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
 * Bike spec mapping from public.cars.specs to template vars
 */
export interface BikeSpecs {
  type?: string;           // 'bike' or 'ebike'
  year?: string;
  color?: string;
  vin?: string;
  frame?: string;
  category?: string;       // license_class
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
  price_per_hour?: number;
  deposit_rub?: number;
  sale_price?: number;
  price_rub?: number;
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/lib/rental-contract-types.ts
```

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add app/franchize/lib/rental-contract-types.ts
git commit -m "feat(types): define rental contract generation types"
```

---

## Task 3: Create Template Variable Builder

**Files:**
- Create: `app/franchize/lib/rental-contract-vars.ts`

- [ ] **Step 1: Write the template vars builder**

```typescript
// /app/franchize/lib/rental-contract-vars.ts
import type { RentalContractTemplateVars, BikeSpecs, CrewContractSecrets } from './rental-contract-types';

const TEMPLATE_BASE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';
const TEMPLATE_MD_PATH = 'docs/RENTAL_DEAL_TEMPLATE.md';

/**
 * Determine if bike is electric based on type and specs
 */
export function isElectricBike(bike: BikeSpecs, type: string): boolean {
  return type === 'ebike'
    || /electric/i.test(bike.type || '')
    || /электро|electric|e-bike|ebike/i.test(bike.fuel_type || '')
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
  const powerKw = bike.power_kw || bike.nominal_power_kw || '';
  const powerHp = bike.motor_hp || bike.max_power_hp || '';
  const engineCc = bike.engine_cc || bike.displacement_cc || '';
  const maxSpeed = bike.top_speed_kmh || bike.top_speed_kmh || '';
  const battery = bike.battery || bike.battery_type_capacity || '';

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
    bike_plate: params.bike.specs.plate || 'уточняется',
    bike_vin: params.bike.specs.vin || params.bike.specs.frame || 'уточняется',
    bike_category: params.bike.specs.category || params.bike.specs.license_class || 'A/L3',
    bike_color: params.bike.specs.color || 'уточняется',
    bike_year: params.bike.specs.year || params.bike.specs.production_year || 'уточняется',
    bike_engine_cc: params.bike.specs.engine_cc || '0',
    bike_power_hp: params.bike.specs.motor_hp || params.bike.specs.max_power_hp || '0',
    bike_power_kw: params.bike.specs.power_kw || params.bike.specs.motor_nominal_kw || '0',
    bike_max_speed: params.bike.specs.top_speed_kmh || 'уточняется',
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
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/lib/rental-contract-vars.ts
```

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add app/franchize/lib/rental-contract-vars.ts
git commit -m "feat(lib): add template variable builder for rental contracts"
```

---

## Task 4: Extend DOCX Capability with Storage and Telegram Send

**Files:**
- Modify: `app/franchize/lib/docx-capability.ts` (check if exists first)

- [ ] **Step 1: Check if docx-capability exists**

```bash
ls -la app/franchize/lib/docx-capability.ts 2>/dev/null || echo "FILE_NOT_FOUND"
```

If FILE_NOT_FOUND, create the file. If exists, read it first.

- [ ] **Step 2: Create or extend docx-capability.ts**

```typescript
// /app/franchize/lib/docx-capability.ts
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { htmlToDocxElements } from '../lib/htmlToDocx.mjs';
import { Document, Packer } from 'docx';

const TEMPLATE_HTML_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const STORAGE_BUCKET = 'rental-contracts';

/**
 * Render template with vars and convert to DOCX buffer
 */
export async function renderTemplateToDocx(vars: Record<string, string>): Promise<{
  buffer: Buffer;
  sha256: string;
}> {
  // Read template
  const htmlTemplate = readFileSync(TEMPLATE_HTML_PATH, 'utf8');

  // Render template with vars (supports {{#if}} conditionals)
  const renderedHtml = renderTemplateWithVars(htmlTemplate, vars);

  // Convert to DOCX elements
  const children = htmlToDocxElements(renderedHtml);

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134,    // 2 cm
            right: 1134,
            bottom: 1134,
            left: 1701,   // 3 cm (Russian GOST)
          },
        },
      },
      children,
    }],
  });

  // Pack to buffer
  const buf = await Packer.toBuffer(doc);
  const sha256 = createHash('sha256').update(buf).digest('hex');

  return { buffer: buf, sha256 };
}

/**
 * Simple template renderer with {{var}} and {{#if}}...{{else}}...{{/if}} support
 */
function renderTemplateWithVars(template: string, vars: Record<string, any>): string {
  let result = template;

  // Process {{#if var}}...{{else}}...{{/if}} blocks (innermost-first, max 50 depth)
  let depth = 0;
  while (/(?<={{#if\s+([a-zA-Z0-9_]+)}})/.test(result) && depth < 50) {
    result = result.replace(/{{#if\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, (_, varName, ifBlock, elseBlock) => {
      const value = vars[varName];
      return value ? ifBlock : elseBlock;
    });
    depth++;
  }

  // Process simple {{var}} placeholders
  result = result.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => String(vars[key] ?? ''));

  return result;
}

/**
 * Upload DOCX to Supabase Storage
 */
export async function uploadDocxToStorage(params: {
  crewSlug: string;
  contractKey: string;
  buffer: Buffer;
  suffix?: string; // e.g., "_finished"
}): Promise<{
  storagePath: string;
  downloadUrl: string;
}> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  const filename = `${params.contractKey}${params.suffix || ''}.docx`;
  const storagePath = `${params.crewSlug}/${filename}`;

  const { data, error } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload DOCX: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    downloadUrl: publicUrl,
  };
}

/**
 * Send DOCX via Telegram to multiple recipients
 */
export async function sendDocxViaTelegram(params: {
  buffer: Buffer;
  filename: string;
  chatIds: string[]; // Multiple recipients: renter + crew owner
  caption?: string;
}): Promise<{
  success: boolean;
  messageIds: string[];
  errors: Array<{ chatId: string; error: string }>;
}> {
  const messageIds: string[] = [];
  const errors: Array<{ chatId: string; error: string }> = [];

  for (const chatId of params.chatIds) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
      const form = new FormData();

      form.append('chat_id', chatId);
      form.append('document', new Blob([params.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }), params.filename);
      if (params.caption) {
        form.append('caption', params.caption);
        form.append('parse_mode', 'HTML');
      }

      const response = await fetch(url, { method: 'POST', body: form });
      const body = await response.json();

      if (!body.ok) {
        errors.push({ chatId, error: body.description || 'Unknown error' });
      } else {
        messageIds.push(body.result.message_id);
      }
    } catch (error) {
      errors.push({ chatId, error: (error as Error).message });
    }
  }

  return {
    success: errors.length === 0,
    messageIds,
    errors,
  };
}

/**
 * Delete DOCX from Storage
 */
export async function deleteDocxFromStorage(storagePath: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  const { error } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(`Failed to delete DOCX ${storagePath}:`, error);
  }
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/lib/docx-capability.ts
```

Expected: No type errors (may have errors about htmlToDocxElements - that's expected to exist)

- [ ] **Step 4: Commit**

```bash
git add app/franchize/lib/docx-capability.ts
git commit -m "feat(lib): add DOCX storage upload and Telegram send utilities"
```

---

## Task 5: Create Contract Generation Server Action

**Files:**
- Create: `app/franchize/server-actions/generate-rental-contract.ts`

- [ ] **Step 1: Write the contract generation action**

```typescript
// /app/franchize/server-actions/generate-rental-contract.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  GenerateRentalContractInput,
  GenerateRentalContractResult,
} from '../lib/rental-contract-types';
import { buildTemplateVars } from '../lib/rental-contract-vars';
import {
  renderTemplateToDocx,
  uploadDocxToStorage,
  sendDocxViaTelegram,
} from '../lib/docx-capability';
import { resolveCrewOwnerChatId } from '@/lib/rental-date-utils';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Generate rental contract from web app flow
 *
 * 1. Fetch crew secrets, bike specs, renter prefill
 * 2. Build template vars
 * 3. Render to DOCX
 * 4. Upload to Supabase Storage
 * 5. Save metadata to rental_contract_artifacts
 * 6. Send to Telegram (renter + crew owner)
 */
export async function generateRentalContract(
  input: GenerateRentalContractInput
): Promise<GenerateRentalContractResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const contractKey = `rental-${input.bikeId}-${Date.now()}`;

  try {
    // 1. Fetch crew and crew secrets
    const { data: crew } = await supabase
      .from('crews')
      .select('id, owner_id, metadata')
      .eq('slug', input.crewSlug)
      .single();

    if (!crew) {
      return { success: false, error: `Crew not found: ${input.crewSlug}` };
    }

    const { data: crewSecrets } = await supabase
      .schema('private')
      .from('crew_secrets')
      .select('contract_defaults')
      .eq('crew_slug', input.crewSlug)
      .single();

    const orgSecrets = crewSecrets?.contract_defaults
      ? (typeof crewSecrets.contract_defaults === 'string'
          ? JSON.parse(crewSecrets.contract_defaults)
          : crewSecrets.contract_defaults)
      : {};

    // 2. Fetch bike with specs
    const { data: bike } = await supabase
      .from('cars')
      .select('*')
      .eq('id', input.bikeId)
      .single();

    if (!bike) {
      return { success: false, error: `Bike not found: ${input.bikeId}` };
    }

    // 3. Check for renter prefill (user_rental_secrets)
    const renterChatId = input.actorTelegramUserId;
    let renterPrefill: any = {};

    if (renterChatId) {
      const { data: renterSecrets } = await supabase
        .schema('private')
        .from('user_rental_secrets')
        .select('*')
        .eq('chat_id', renterChatId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (renterSecrets) {
        renterPrefill = {
          full_name: renterSecrets.renter_full_name || input.renterData.full_name,
          passport: renterSecrets.renter_passport || input.renterData.passport,
          passport_issue_date: renterSecrets.renter_passport_issue_date || input.renterData.passport_issue_date,
          registration: renterSecrets.renter_registration || input.renterData.registration,
          birth_date: renterSecrets.renter_birth_date || input.renterData.birth_date,
          driver_license: renterSecrets.renter_driver_license || input.renterData.driver_license,
          phone: renterSecrets.renter_phone || input.renterData.phone,
          email: renterSecrets.renter_email || input.renterData.email,
          address: renterSecrets.renter_address || input.renterData.address,
        };
      }
    }

    // Merge prefill with UI data (UI data takes precedence)
    const mergedRenterData = { ...renterPrefill, ...input.renterData };

    // 4. Get contract defaults from crew metadata
    const contractDefaults = crew.metadata?.franchize?.contractDefaults || {};

    // 5. Build template vars
    const templateVars = await buildTemplateVars({
      crewSlug: input.crewSlug,
      bike: {
        id: bike.id,
        make: bike.make,
        model: bike.model,
        specs: bike.specs || {},
        type: bike.type,
      },
      crewSecrets: orgSecrets,
      contractDefaults,
      dates: input.dates,
      renterData: mergedRenterData,
      equipmentData: input.equipmentData,
      pickupData: input.pickupData,
    });

    // 6. Render to DOCX
    const { buffer, sha256 } = await renderTemplateToDocx(templateVars);

    // 7. Upload to Supabase Storage
    const { storagePath, downloadUrl } = await uploadDocxToStorage({
      crewSlug: input.crewSlug,
      contractKey,
      buffer,
    });

    // 8. Save metadata to rental_contract_artifacts
    const { error: metadataError } = await supabase
      .from('rental_contract_artifacts')
      .insert({
        contract_key: contractKey,
        requested_bike_id: input.bikeId,
        resolved_bike_id: bike.id,
        telegram_chat_id: renterChatId || null,
        renter_full_name: mergedRenterData.full_name,
        rent_start_date: input.dates.start,
        rent_end_date: input.dates.end,
        original_sha256: sha256,
        rental_id: input.rentalId,
        storage_path: storagePath,
        crew_id: crew.id,
        source: 'web_app',
      });

    if (metadataError) {
      console.error('[generateRentalContract] Failed to save metadata:', metadataError);
      // Continue anyway - contract is already uploaded
    }

    // 9. Send to Telegram (renter + crew owner)
    const crewOwnerChatId = await resolveCrewOwnerChatId(supabase, crew.id);

    const telegramChatIds: string[] = [];
    if (renterChatId) telegramChatIds.push(renterChatId);
    if (crewOwnerChatId && crewOwnerChatId !== renterChatId) {
      telegramChatIds.push(crewOwnerChatId);
    }

    if (telegramChatIds.length > 0) {
      const filename = `rental-contract-${bike.make}-${bike.model}-${input.dates.start}.docx`;
      const caption = `📄 <b>Договор аренды</b>\n${bike.make} ${bike.model}\n${input.dates.start} — ${input.dates.end}\n\nСкачать: ${downloadUrl}`;

      await sendDocxViaTelegram({
        buffer,
        filename,
        chatIds: telegramChatIds,
        caption,
      });
    }

    return {
      success: true,
      downloadUrl,
      storagePath,
      contractKey,
      sha256,
      rentalId: input.rentalId,
    };

  } catch (error) {
    console.error('[generateRentalContract] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/server-actions/generate-rental-contract.ts
```

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add app/franchize/server-actions/generate-rental-contract.ts
git commit -m "feat(server): add rental contract generation action"
```

---

## Task 6: Create Return-Time Contract Update Action

**Files:**
- Create: `app/franchize/server-actions/finalize-rental-return.ts`

- [ ] **Step 1: Write the return finalization action**

```typescript
// /app/franchize/server-actions/finalize-rental-return.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  FinalizeRentalReturnInput,
  FinalizeRentalReturnResult,
} from '../lib/rental-contract-types';
import { buildTemplateVars } from '../lib/rental-contract-vars';
import {
  renderTemplateToDocx,
  uploadDocxToStorage,
  sendDocxViaTelegram,
} from '../lib/docx-capability';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Finalize rental return and regenerate contract with return fields filled
 *
 * 1. Fetch original rental and contract data
 * 2. Rebuild template vars with return data
 * 3. Render to DOCX
 * 4. Upload with "_finished" suffix
 * 5. Update rental_contract_artifacts with finished SHA256
 * 6. Send finished contract to Telegram
 */
export async function finalizeRentalReturn(
  input: FinalizeRentalReturnInput
): Promise<FinalizeRentalReturnResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  try {
    // 1. Fetch original contract metadata
    const { data: artifact } = await supabase
      .from('rental_contract_artifacts')
      .select('*')
      .eq('contract_key', input.contractKey)
      .single();

    if (!artifact) {
      return { success: false, error: `Contract artifact not found: ${input.contractKey}` };
    }

    // 2. Fetch rental data
    const { data: rental } = await supabase
      .from('rentals')
      .select('*')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    // 3. Fetch crew and bike
    const { data: crew } = await supabase
      .from('crews')
      .select('id, owner_id, metadata')
      .eq('slug', input.crewSlug)
      .single();

    const { data: bike } = await supabase
      .from('cars')
      .select('*')
      .eq('id', rental.vehicle_id)
      .single();

    if (!crew || !bike) {
      return { success: false, error: 'Crew or bike not found' };
    }

    // 4. Fetch crew secrets
    const { data: crewSecrets } = await supabase
      .schema('private')
      .from('crew_secrets')
      .select('contract_defaults')
      .eq('crew_slug', input.crewSlug)
      .single();

    const orgSecrets = crewSecrets?.contract_defaults
      ? (typeof crewSecrets.contract_defaults === 'string'
          ? JSON.parse(crewSecrets.contract_defaults)
          : crewSecrets.contract_defaults)
      : {};

    // 5. Rebuild template vars with return data
    // Note: We need to reconstruct the original input data
    // For now, we'll use the artifact data + rental metadata
    const returnData = {
      damage_notes_at_return: input.returnData.damage_notes_at_return || 'Без повреждений',
      battery_level_end: input.returnData.battery_level_end || '____',
    };

    // Parse rental dates
    const start = new Date(rental.agreed_start_date || rental.requested_start_date);
    const end = new Date(rental.agreed_end_date || rental.requested_end_date);

    const dates = {
      start: formatDateRu(start),
      startTime: formatTimeRu(start),
      end: formatDateRu(end),
      endTime: formatTimeRu(end),
    };

    const contractDefaults = crew.metadata?.franchize?.contractDefaults || {};

    // Build template vars with return data
    // Note: This assumes we can reconstruct the original data from artifact
    // In production, you might want to store the full template vars in artifact metadata
    const templateVars = await buildTemplateVars({
      crewSlug: input.crewSlug,
      bike: {
        id: bike.id,
        make: bike.make,
        model: bike.model,
        specs: bike.specs || {},
        type: bike.type,
      },
      crewSecrets: orgSecrets,
      contractDefaults,
      dates,
      renterData: {
        full_name: artifact.renter_full_name || 'Арендатор',
        passport: artifact.renter_passport || '______ ______',
        // ... other fields from artifact if stored
      },
      equipmentData: rental.metadata?.equipmentData || {
        keys_count: 1,
        helmets_count: 1,
        charger: false,
        lock: false,
      },
      pickupData: rental.metadata?.pickupData || {
        odometer_km: 0,
        damage_notes_at_delivery: '',
      },
      returnData,
    });

    // 6. Render to DOCX
    const { buffer, sha256: finishedSha256 } = await renderTemplateToDocx(templateVars);

    // 7. Upload with "_finished" suffix
    const { storagePath, downloadUrl } = await uploadDocxToStorage({
      crewSlug: input.crewSlug,
      contractKey: input.contractKey,
      buffer,
      suffix: '_finished',
    });

    // 8. Update rental_contract_artifacts with finished SHA256
    const { error: updateError } = await supabase
      .from('rental_contract_artifacts')
      .update({
        finished_sha256: finishedSha256,
        finished_storage_path: storagePath,
        finished_at: new Date().toISOString(),
      })
      .eq('contract_key', input.contractKey);

    if (updateError) {
      console.error('[finalizeRentalReturn] Failed to update artifact:', updateError);
    }

    // 9. Send finished contract to Telegram
    const telegramChatIds: string[] = [];
    if (artifact.telegram_chat_id) telegramChatIds.push(artifact.telegram_chat_id);
    if (crew.owner_id && crew.owner_id !== artifact.telegram_chat_id) {
      telegramChatIds.push(crew.owner_id);
    }

    if (telegramChatIds.length > 0) {
      const filename = `rental-contract-${bike.make}-${bike.model}-${dates.start}_finished.docx`;
      const caption = `✅ <b>Аренда завершена</b>\n${bike.make} ${bike.model}\nДоговор с заполненными полями возврата\n\nСкачать: ${downloadUrl}`;

      await sendDocxViaTelegram({
        buffer,
        filename,
        chatIds: telegramChatIds,
        caption,
      });
    }

    return {
      success: true,
      finishedDownloadUrl: downloadUrl,
      finishedStoragePath: storagePath,
      finishedSha256,
      originalSha256: artifact.original_sha256,
    };

  } catch (error) {
    console.error('[finalizeRentalReturn] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

function formatDateRu(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function formatTimeRu(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/server-actions/finalize-rental-return.ts
```

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add app/franchize/server-actions/finalize-rental-return.ts
git commit -m "feat(server): add rental return finalization action"
```

---

## Task 7: Export New Actions from Module

**Files:**
- Modify: `app/franchize/server-actions/rentals.ts`

- [ ] **Step 1: Add exports to rentals.ts**

Add these lines at the end of the file:

```typescript
import {
  generateRentalContract as generateRentalContractAction,
  finalizeRentalReturn as finalizeRentalReturnAction,
} from './generate-rental-contract';
import {
  finalizeRentalReturn as finalizeRentalReturnDirect,
} from './finalize-rental-return';

// Re-export
export async function generateRentalContract(
  ...args: Parameters<typeof generateRentalContractAction>
) {
  return generateRentalContractAction(...args);
}

export async function finalizeRentalReturn(
  ...args: Parameters<typeof finalizeRentalReturnDirect>
) {
  return finalizeRentalReturnDirect(...args);
}

// Also export types if needed
export type {
  GenerateRentalContractInput,
  GenerateRentalContractResult,
  FinalizeRentalReturnInput,
  FinalizeRentalReturnResult,
  RentalContractTemplateVars,
} from '../lib/rental-contract-types';
```

Actually, let's check the current structure first. The finalize function is in a separate file, so we need to import from both.

- [ ] **Step 2: Check current rentals.ts structure**

```bash
head -20 app/franchize/server-actions/rentals.ts
```

- [ ] **Step 3: Add proper imports**

Append to `app/franchize/server-actions/rentals.ts`:

```typescript
// Contract generation actions
export {
  generateRentalContract,
} from './generate-rental-contract';
export {
  finalizeRentalReturn,
} from './finalize-rental-return';

// Export types
export type {
  GenerateRentalContractInput,
  GenerateRentalContractResult,
  FinalizeRentalReturnInput,
  FinalizeRentalReturnResult,
} from '../lib/rental-contract-types';
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/server-actions/rentals.ts
```

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add app/franchize/server-actions/rentals.ts
git commit -m "feat(server): export contract generation actions from rentals module"
```

---

## Task 8: Update Main Actions Export

**Files:**
- Modify: `app/franchize/actions.ts`

- [ ] **Step 1: Add exports to main actions.ts**

Add to the import section and export section:

```typescript
// Add to imports (around line 4-16)
import type {
  CatalogItemVM,
  // ... existing types ...
  GenerateRentalContractInput,
  GenerateRentalContractResult,
  FinalizeRentalReturnInput,
  FinalizeRentalReturnResult,
} from "@/app/franchize/actions-runtime";

// Add to server-action imports (around line 43-54)
import {
  generateRentalContract as generateRentalContractAction,
  finalizeRentalReturn as finalizeRentalReturnAction,
} from "@/app/franchize/server-actions/generate-rental-contract";

// Add to exports (at end of file, before last line)
export async function generateRentalContract(
  ...args: Parameters<typeof generateRentalContractAction>
) {
  return generateRentalContractAction(...args);
}

export async function finalizeRentalReturn(
  ...args: Parameters<typeof finalizeRentalReturnAction>
) {
  return finalizeRentalReturnAction(...args);
}
```

Wait, I need to check the actual file structure first.

- [ ] **Step 2: Check actions-runtime.ts for type exports**

```bash
grep -n "export type" app/franchize/actions-runtime.ts | head -20
```

- [ ] **Step 3: Add types to actions-runtime.ts**

Add to `app/franchize/actions-runtime.ts`:

```typescript
// Add after existing type exports
export type {
  GenerateRentalContractInput,
  GenerateRentalContractResult,
  FinalizeRentalReturnInput,
  FinalizeRentalReturnResult,
  RentalContractTemplateVars,
} from './server-actions/generate-rental-contract';
```

Wait, types should be imported from `../lib/rental-contract-types`, not from the action file. Let me fix this.

Actually, the cleanest way is to export types from `lib/rental-contract-types.ts` directly in `actions-runtime.ts`.

- [ ] **Step 4: Correct type imports**

Add to `app/franchize/actions-runtime.ts`:

```typescript
// Contract generation types
export type {
  GenerateRentalContractInput,
  GenerateRentalContractResult,
  FinalizeRentalReturnInput,
  FinalizeRentalReturnResult,
  RentalContractTemplateVars,
  CrewContractSecrets,
  BikeSpecs,
} from '../lib/rental-contract-types';
```

Then add to `app/franchize/actions.ts`:

```typescript
// Contract generation actions
export async function generateRentalContract(
  ...args: Parameters<typeof generateRentalContractAction>
) {
  return generateRentalContractAction(...args);
}

export async function finalizeRentalReturn(
  ...args: Parameters<typeof finalizeRentalReturnAction>
) {
  return finalizeRentalReturnAction(...args);
}
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/actions.ts app/franchize/actions-runtime.ts
```

Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add app/franchize/actions.ts app/franchize/actions-runtime.ts
git commit -m "feat(actions): export contract generation from main actions module"
```

---

## Task 9: Create Rental Return Panel Component

**Files:**
- Create: `app/franchize/components/RentalReturnPanel.tsx`

- [ ] **Step 1: Write the RentalReturnPanel component**

```typescript
// /app/franchize/components/RentalReturnPanel.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { finalizeRentalReturn, type FranchizeTheme } from "../../actions";

interface RentalReturnPanelProps {
  slug: string;
  rentalId: string;
  contractKey: string;
  bikeTitle: string;
  status: string;
  ownerId: string;
  isElectric: boolean;
  theme: FranchizeTheme;
}

export function RentalReturnPanel({
  slug,
  rentalId,
  contractKey,
  bikeTitle,
  status,
  ownerId,
  isElectric,
  theme,
}: RentalReturnPanelProps) {
  const { dbUser } = useAppContext();
  const [isPending, startTransition] = useTransition();
  const [returnData, setReturnData] = useState({
    damage_notes_at_return: '',
    battery_level_end: '',
    odometer_end_km: '',
    fuel_level_end: '',
  });

  const isOwner = Boolean(dbUser?.user_id && dbUser.user_id === ownerId);
  const canFinalize = status === 'active' || status === 'completed';
  const showPanel = canFinalize && isOwner;

  const handleFinalize = () => {
    if (!dbUser?.user_id) {
      toast.error('Требуется авторизация');
      return;
    }

    if (!returnData.damage_notes_at_return.trim()) {
      toast.error('Опишите состояние при возврате');
      return;
    }

    startTransition(async () => {
      const result = await finalizeRentalReturn({
        crewSlug: slug,
        rentalId,
        contractKey,
        returnData: {
          damage_notes_at_return: returnData.damage_notes_at_return,
          battery_level_end: isElectric ? returnData.battery_level_end || '____' : undefined,
          odometer_end_km: returnData.odometer_end_km ? Number(returnData.odometer_end_km) : undefined,
          fuel_level_end: !isElectric ? returnData.fuel_level_end : undefined,
        },
        actorTelegramUserId: dbUser.user_id,
      });

      if (!result.success) {
        toast.error(result.error || 'Не удалось завершить аренду');
        return;
      }

      toast.success('Аренда завершена! Договор обновлен и отправлен в Telegram.');

      if (result.finishedDownloadUrl) {
        // Optionally open download link
        window.open(result.finishedDownloadUrl, '_blank');
      }
    });
  };

  if (!showPanel) return null;

  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{
        borderColor: theme.palette.borderSoft,
        backgroundColor: `${theme.palette.bgCard}CC`,
      }}
    >
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: theme.palette.textSecondary }}>
        Завершение аренды
      </p>
      <h3 className="mt-1 text-base font-semibold" style={{ color: theme.palette.textPrimary }}>
        Заполните данные возврата
      </h3>
      <p className="mt-1 text-sm" style={{ color: theme.palette.textSecondary }}>
        {bikeTitle}
      </p>

      <div className="mt-3 space-y-3 text-sm">
        <label className="block">
          <span className="font-medium">Повреждения при возврате</span>
          <textarea
            value={returnData.damage_notes_at_return}
            onChange={(e) => setReturnData(prev => ({ ...prev, damage_notes_at_return: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
            placeholder="Опишите состояние, повреждения, замечания при возврате"
          />
        </label>

        {isElectric && (
          <label className="block">
            <span className="font-medium">Уровень заряда при возврате (%)</span>
            <input
              type="text"
              value={returnData.battery_level_end}
              onChange={(e) => setReturnData(prev => ({ ...prev, battery_level_end: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-2 py-1.5"
              style={{ borderColor: theme.palette.borderSoft }}
              placeholder="100"
            />
          </label>
        )}

        <label className="block">
          <span className="font-medium">Пробег при возврате (км)</span>
          <input
            type="number"
            value={returnData.odometer_end_km}
            onChange={(e) => setReturnData(prev => ({ ...prev, odometer_end_km: e.target.value }))}
            className="mt-1 w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
            placeholder="45000"
          />
        </label>

        {!isElectric && (
          <label className="block">
            <span className="font-medium">Уровень топлива при возврате</span>
            <input
              type="text"
              value={returnData.fuel_level_end}
              onChange={(e) => setReturnData(prev => ({ ...prev, fuel_level_end: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-2 py-1.5"
              style={{ borderColor: theme.palette.borderSoft }}
              placeholder="4/5"
            />
          </label>
        )}

        <button
          type="button"
          disabled={isPending}
          onClick={handleFinalize}
          className="mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{
            backgroundColor: theme.palette.accentMain,
            color: '#16130A',
          }}
        >
          {isPending ? 'Сохраняем...' : '✓ Завершить аренду и обновить договор'}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/components/RentalReturnPanel.tsx
```

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add app/franchize/components/RentalReturnPanel.tsx
git commit -m "feat(component): add RentalReturnPanel for post-rental editing"
```

---

## Task 10: Extend FranchizeRentalDocumentsPanel

**Files:**
- Modify: `app/franchize/components/FranchizeRentalDocumentsPanel.tsx`

- [ ] **Step 1: Read current panel structure**

```bash
cat app/franchize/components/FranchizeRentalDocumentsPanel.tsx
```

- [ ] **Step 2: Add contract generation state and UI**

Add to the component:

```typescript
// Add to imports
import { generateRentalContract, type GenerateRentalContractInput } from "@/app/franchize/actions";
import { RentalReturnPanel } from "./RentalReturnPanel";

// Add to component props
interface ExtendedProps extends FranchizeRentalDocumentsPanelProps {
  crewSlug: string;
  bikeId: string;
  bikeTitle: string;
  bikeType: 'bike' | 'ebike';
  dates?: {
    start: string;
    startTime: string;
    end: string;
    endTime: string;
  };
  renterData?: {
    full_name: string;
    passport: string;
    // ... other fields
  };
  contractKey?: string;
}

// Add to component state
const [contractGeneration, setContractGeneration] = useState({
  generated: false,
  downloadUrl: '',
  contractKey: '',
  sha256: '',
});

// Add to component (after damage reports section):
{canGenerateContract && (
  <div className="mt-3 rounded-xl border p-3" style={{ borderColor: palette.borderSoft }}>
    <p className="text-sm font-medium">Генерация договора</p>
    {contractGeneration.generated ? (
      <div className="mt-2 space-y-1 text-xs" style={{ color: palette.textSecondary }}>
        <p>Договор сгенерирован: {contractGeneration.contractKey.slice(0, 12)}...</p>
        <a
          href={contractGeneration.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: palette.accentMain }}
        >
          Скачать DOCX
        </a>
      </div>
    ) : (
      <p className="mt-2 text-xs" style={{ color: palette.textSecondary }}>
        После фиксации выдачи можно сгенерировать договор аренды.
      </p>
    )}

    {canFreeze && pickupFreeze?.frozen_at && !contractGeneration.generated && (
      <button
        type="button"
        disabled={isPending}
        onClick={handleGenerateContract}
        className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold"
        style={{ backgroundColor: palette.accentMain, color: '#16130A' }}
      >
        {isPending ? 'Генерируем...' : '📄 Сгенерировать договор'}
      </button>
    )}
  </div>
)}

// Add RentalReturnPanel for crew when rental is completed
{status === 'completed' && contractGeneration.contractKey && (
  <RentalReturnPanel
    slug={crewSlug}
    rentalId={rentalId}
    contractKey={contractGeneration.contractKey}
    bikeTitle={bikeTitle}
    status={status}
    ownerId={ownerId}
    isElectric={bikeType === 'ebike'}
    theme={palette}
  />
)}

// Add handler function:
const handleGenerateContract = () => {
  if (!dbUser?.user_id || !crewSlug || !bikeId || !rentalId) {
    toast.error('Недостаточно данных для генерации договора');
    return;
  }

  const contractInput: GenerateRentalContractInput = {
    crewSlug,
    bikeId,
    rentalId,
    dates: dates || {
      start: new Date().toLocaleDateString('ru-RU'),
      startTime: '18:00',
      end: new Date().toLocaleDateString('ru-RU'),
      endTime: '10:00',
    },
    renterData: renterData || {
      full_name: 'Арендатор',
      passport: '______ ______',
    },
    equipmentData: {
      keys_count: 1,
      helmets_count: 1,
      charger: false,
      lock: false,
    },
    pickupData: {
      odometer_km: Number(odometerKm) || 0,
      fuel_level,
      battery_start: isElectric ? '100' : undefined,
      damage_notes_at_delivery: damageNotes,
    },
    actorTelegramUserId: dbUser.user_id,
  };

  startTransition(async () => {
    const result = await generateRentalContract(contractInput);

    if (!result.success) {
      toast.error(result.error || 'Не удалось сгенерировать договор');
      return;
    }

    setContractGeneration({
      generated: true,
      downloadUrl: result.downloadUrl || '',
      contractKey: result.contractKey || '',
      sha256: result.sha256 || '',
    });

    toast.success('Договор сгенерирован и отправлен в Telegram!');
  });
};

// Add condition for canGenerateContract:
const canGenerateContract = isOwner && pickupFreeze?.frozen_at && ['confirmed', 'active'].includes(status);
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/components/FranchizeRentalDocumentsPanel.tsx
```

Expected: No type errors (may need to adjust props interface)

- [ ] **Step 4: Commit**

```bash
git add app/franchize/components/FranchizeRentalDocumentsPanel.tsx
git commit -m "feat(component): add contract generation to DocumentsPanel"
```

---

## Task 11: Update Rental Page to Pass New Props

**Files:**
- Modify: `app/franchize/[slug]/rental/[id]/page.tsx`

- [ ] **Step 1: Check current rental page structure**

```bash
grep -n "FranchizeRentalDocumentsPanel" app/franchize/[slug]/rental/[id]/page.tsx
```

- [ ] **Step 2: Add missing props to DocumentsPanel**

Update the FranchizeRentalDocumentsPanel usage to include new props:

```typescript
// Find the FranchizeRentalDocumentsPanel component usage (around line 355-361)
// Update with additional props:

<FranchizeRentalDocumentsPanel
  rentalId={rental.rentalId}
  ownerId={rental.ownerId}
  status={rental.status}
  metadata={rental.metadata}
  palette={crew.theme.palette}
  crewSlug={resolvedSlug}
  bikeId={rental.vehicleId}
  bikeTitle={rental.vehicleTitle}
  bikeType={rental.vehicleType || 'bike'}
  dates={{
    start: rental.startDate || new Date().toLocaleDateString('ru-RU'),
    startTime: rental.startTime || '18:00',
    end: rental.endDate || new Date().toLocaleDateString('ru-RU'),
    endTime: rental.endTime || '10:00',
  }}
  renterData={{
    full_name: rental.renterName || 'Арендатор',
    passport: rental.renterPassport || '______ ______',
  }}
  contractKey={rental.contractKey}
/>
```

Note: Some of these fields (renterName, vehicleType, etc.) might not exist in the rental object yet. We may need to extend the rental query or derive them from other data.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/[slug]/rental/[id]/page.tsx
```

Expected: May have type errors if fields don't exist - we'll fix in next step

- [ ] **Step 4: Commit**

```bash
git add app/franchize/[slug]/rental/[id]/page.tsx
git commit -m "feat(page): pass contract props to DocumentsPanel"
```

---

## Task 12: Add Rental Metadata Fields to Database

**Files:**
- Run: SQL migration

- [ ] **Step 1: Create migration for rental metadata fields**

```sql
-- /supabase/migrations/20260618000002_rental_contract_metadata.sql

-- Add metadata columns to rentals table for contract generation data
ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS contract_key TEXT,
  ADD COLUMN IF NOT EXISTS contract_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS contract_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS contract_finished_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS contract_finished_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS contract_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_finished_at TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS rentals_contract_key_idx ON rentals(contract_key);
CREATE INDEX IF NOT EXISTS rentals_contract_sha256_idx ON rentals(contract_sha256);

-- Add comment
COMMENT ON COLUMN rentals.contract_key IS 'Contract identifier linking to rental_contract_artifacts';
COMMENT ON COLUMN rentals.contract_sha256 IS 'SHA256 hash of generated contract DOCX (original)';
COMMENT ON COLUMN rentals.contract_finished_sha256 IS 'SHA256 hash of finished contract DOCX (with return fields)';
```

- [ ] **Step 2: Apply migration**

Run via Supabase dashboard SQL Editor or CLI

- [ ] **Step 3: Verify columns added**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'rentals'
AND column_name LIKE 'contract_%';
```

Expected: 7 new columns

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260618000002_rental_contract_metadata.sql
git commit -m "feat(db): add contract metadata fields to rentals table"
```

---

## Task 13: End-to-End Integration Test

**Files:**
- Test: Manual browser test + Telegram verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to rental page**

Open: `http://localhost:3000/franchize/vip-bike/rental/{test_rental_id}`

- [ ] **Step 3: Verify DocumentsPanel loads**

Check for:
- Pickup freeze section visible
- Equipment checkboxes visible
- Damage report section visible
- Contract generation button (after pickup freeze)

- [ ] **Step 4: Fill pickup freeze data**

Enter:
- Odometer: 45000 km
- Fuel/Battery level
- Select checklist items
- Add damage notes

- [ ] **Step 5: Save pickup freeze**

Click "Сохранить выдачу"
Expected: Success toast, pickup freeze timestamp shows

- [ ] **Step 6: Generate contract**

Click "📄 Сгенерировать договор"
Expected:
- Loading state
- Success toast
- Download link appears
- Telegram message received (both renter + owner)

- [ ] **Step 7: Verify DOCX content**

Download and open the DOCX file. Check:
- Organization name, bank details filled
- Bike specs correct (make, model, VIN, etc.)
- Renter data present
- Pickup conditions filled
- Return fields have blanks/underscores

- [ ] **Step 8: Test return finalization**

Change rental status to `completed` (via SQL or admin panel)
Refresh page
Fill return data in RentalReturnPanel
Click "✓ Завершить аренду"
Expected:
- Success toast
- Finished DOCX generated
- Telegram message with finished contract

- [ ] **Step 9: Verify finished DOCX**

Open the `_finished.docx` file. Check:
- Return fields now filled
- Damage notes at return present
- Battery/fuel level at return present

- [ ] **Step 10: Cleanup test data**

```bash
# Delete test contracts from Supabase Storage
# Delete test rental rows if needed
```

---

## Task 14: Documentation

**Files:**
- Create: `docs/rental-contract-generation.md`

- [ ] **Step 1: Write documentation**

```markdown
# Rental Contract Generation

## Overview

The franchize web app can generate rental contracts that match the bot/skill flow exactly.

## Data Sources

- **Organization details:** `private.crew_secrets.contract_defaults`
- **Bike specifications:** `public.cars.specs` (see gold-standard-electro-bike-spec-schema.md)
- **Renter prefill:** `private.user_rental_secrets` (for returning renters)
- **UI input:** Equipment, pickup conditions, damage notes

## Flow

1. **Contract Generation (at pickup)**
   - Crew fills pickup freeze data in DocumentsPanel
   - Click "Generate Contract"
   - Server action fetches crew secrets + bike specs + renter data
   - Renders HTML template → DOCX
   - Uploads to Supabase Storage
   - Saves metadata to `rental_contract_artifacts`
   - Sends to Telegram (renter + crew owner)

2. **Return Finalization (after rental)**
   - Crew fills return data in RentalReturnPanel
   - Click "Finalize Return"
   - Regenerates DOCX with return fields filled
   - Uploads with `_finished` suffix
   - Updates `rental_contract_artifacts`
   - Sends finished contract to Telegram

## Template Placeholders

See RENTAL_DEAL_TEMPLATE.html for full list. Key placeholders:
- Organization: `organization_short`, `legal_address`, `ogrnip`, `inn`, `bank_*`
- Bike: `bike_make`, `bike_model`, `bike_vin`, `bike_category`, etc.
- Renter: `renter_full_name`, `renter_passport`, etc.
- Dynamic: `bike_vehicle_type_*`, `bike_engine_spec_line_*` (computed based on electric vs ICE)

## Storage

- **Bucket:** `rental-contracts`
- **Path pattern:** `{crewSlug}/{contractKey}.docx` and `{crewSlug}/{contractKey}_finished.docx`
- **RLS:** Crew members can read/write their own contracts

## API

### `generateRentalContract(input)`

Generates rental contract at pickup time.

### `finalizeRentalReturn(input)`

Regenerates contract with return fields filled.

## Troubleshooting

**Contract not generating:**
- Check pickup freeze is saved
- Verify crew secrets exist in `private.crew_secrets`
- Check bike specs have required fields

**Telegram not sending:**
- Verify `TELEGRAM_BOT_TOKEN` is set
- Check renter and crew owner `chat_id` values
- Check bot has permission to send documents

**Template placeholders not filled:**
- Check `private.crew_secrets.contract_defaults` has organization data
- Verify bike specs use correct schema (gold-standard-electro-bike-spec-schema.md)
```

- [ ] **Step 2: Commit**

```bash
git add docs/rental-contract-generation.md
git commit -m "docs: add rental contract generation documentation"
```

---

## Summary Checklist

**Before considering this plan complete:**

- [ ] All storage buckets created with RLS
- [ ] All types defined and exported correctly
- [ ] Template vars builder computes electric vs ICE correctly
- [ ] DOCX rendering, upload, and Telegram send work end-to-end
- [ ] Contract generation action integrates all data sources
- [ ] Return finalization action regenerates with `_finished` suffix
- [ ] UI components pass all required props
- [ ] Database schema updated with contract metadata fields
- [ ] End-to-end test passes (pickup → generate → return → finalize)
- [ ] Documentation complete

**Key files created:**
- `app/franchize/lib/rental-contract-types.ts`
- `app/franchize/lib/rental-contract-vars.ts`
- `app/franchize/server-actions/generate-rental-contract.ts`
- `app/franchize/server-actions/finalize-rental-return.ts`
- `app/franchize/components/RentalReturnPanel.tsx`

**Key files modified:**
- `app/franchize/lib/docx-capability.ts` (extended with storage + Telegram)
- `app/franchize/server-actions/rentals.ts` (exports)
- `app/franchize/actions.ts` (exports)
- `app/franchize/components/FranchizeRentalDocumentsPanel.tsx` (contract generation UI)
- `app/franchize/[slug]/rental/[id]/page.tsx` (props)
