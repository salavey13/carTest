# Franchize Rental Contract Alignment Implementation Plan v2

> **Revised Architecture:** Users submit contract drafts → Crew owner approves → Contract generated/uploaded with crew permissions. Clean separation of concerns, proper auth model (chat_id), no security smell.

**Goal:** Enable franchize web app rental flow to generate rental contracts with identical output to bot/skill flow, using crew-owner-mediated approval flow.

**Architecture:** User fills contract form → saves to `rental.metadata.contract_draft` → sends Telegram approval request to crew owner → crew owner approves/declines → if approved, server generates DOCX (with crew permissions), uploads to Storage, saves to `rental_contract_artifacts`, sends to both parties.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres + Storage), TypeScript, docx (npm), HTML template rendering, Telegram Bot API (inline buttons with callbacks)

---

## File Structure

```
app/franchize/
├── server-actions/
│   ├── submit-contract-draft.ts           # NEW - User submits draft for approval
│   ├── approve-contract.ts               # NEW - Crew owner approves (generates DOCX)
│   ├── decline-contract.ts               # NEW - Crew owner declines
│   ├── finalize-rental-return.ts         # NEW - Return-time contract update
│   └── rentals.ts                         # MODIFY - Export new actions
├── lib/
│   ├── docx-capability.ts                 # MODIFY - Add DOCX storage + Telegram send
│   ├── rental-contract-types.ts           # NEW - Shared types for contract flow
│   └── rental-contract-vars.ts            # NEW - Template variable builder
├── components/
│   ├── FranchizeRentalDocumentsPanel.tsx  # MODIFY - Add contract draft UI
│   ├── ContractApprovalPanel.tsx          # NEW - For crew owner to approve/decline
│   └── RentalReturnPanel.tsx              # NEW - Post-rental editing (crew only)
├── api/
│   └── webhooks/
│       └── telegram-contract-callback.ts   # NEW - Handle approve/decline callbacks
└── actions.ts                              # MODIFY - Re-export new actions
```

Supabase:
- Storage bucket: `rental-contracts` (create if missing)
- RLS policies using `auth.jwt() ->> 'chat_id'` pattern
- `rental.metadata.contract_draft` for staging user data

---

## Task 1: Setup Supabase Storage Bucket (Fixed for chat_id auth)

**Files:**
- Create: `supabase/migrations/20260618000001_rental_contracts_storage.sql`

**Step 1: Create storage bucket SQL (FIXED)**

```sql
-- /supabase/migrations/20260618000001_rental_contracts_storage.sql

-- Create storage bucket for rental contracts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rental-contracts', 'rental-contracts', false, 10485760, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Note: RLS is already enabled on storage.objects by Supabase

-- Policy: Crew members can view own rental contracts
CREATE POLICY "Crew members can view own rental contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rental-contracts'
  AND (
    -- Crew owner can read all contracts for their crew
    EXISTS (
      SELECT 1 FROM public.crew_members cm
      JOIN public.users u ON u.user_id = cm.user_id
      WHERE cm.crew_id = (storage.objects.metadata->>'crew_id')::uuid
      AND u.user_id = (auth.jwt() ->> 'chat_id')
      AND cm.role = 'owner'
    )
    OR
    -- Renter can read their own contracts
    EXISTS (
      SELECT 1 FROM private.rental_contract_artifacts rca
      JOIN public.users u ON u.user_id = rca.telegram_chat_id
      WHERE rca.contract_key = storage.foldername(storage.name)
      AND u.user_id = (auth.jwt() ->> 'chat_id')
    )
  )
);

-- Policy: Crew owners can upload rental contracts
CREATE POLICY "Crew owners can upload rental contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rental-contracts'
  AND EXISTS (
    SELECT 1 FROM public.crew_members cm
    JOIN public.users u ON u.user_id = cm.user_id
    WHERE cm.crew_id = (storage.objects.metadata->>'crew_id')::text
    AND u.user_id = (auth.jwt() ->> 'chat_id')
    AND cm.role = 'owner'
  )
);

-- Policy: Crew owners can delete rental contracts
CREATE POLICY "Crew owners can delete rental contracts"
ON storage.objects FOR DELETE
WITH CHECK (
  bucket_id = 'rental-contracts'
  AND EXISTS (
    SELECT 1 FROM public.crew_members cm
    JOIN public.users u ON u.user_id = cm.user_id
    WHERE cm.crew_id = (storage.objects.metadata->>'crew_id')::text
    AND u.user_id = (auth.jwt() ->> 'chat_id')
    AND cm.role = 'owner'
  )
);
```

**Step 2: Apply migration**

Run via Supabase dashboard SQL Editor or CLI

**Step 3: Verify bucket created**

Check in Supabase dashboard: Storage → Buckets → `rental-contracts` exists

**Step 4: Commit**

```bash
git add supabase/migrations/20260618000001_rental_contracts_storage.sql
git commit -m "feat(storage): add rental-contracts bucket with RLS policies (chat_id auth)"
```

---

## Task 2: Define Shared Types

**Files:**
- Create: `app/franchize/lib/rental-contract-types.ts`

**Step 1: Write the type definitions file**

```typescript
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
  price_per_hour?: number;
  deposit_rub?: number;
  sale_price?: number;
  price_rub?: number;
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/lib/rental-contract-types.ts
```

**Step 3: Commit**

```bash
git add app/franchize/lib/rental-contract-types.ts
git commit -m "feat(types): define rental contract types with approval flow"
```

---

## Task 3: Create Template Variable Builder

**Files:**
- Create: `app/franchize/lib/rental-contract-vars.ts`

**Step 1: Write the template vars builder**

(Same as original plan - no changes needed)

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/lib/rental-contract-vars.ts
```

**Step 3: Commit**

```bash
git add app/franchize/lib/rental-contract-vars.ts
git commit -m "feat(lib): add template variable builder for rental contracts"
```

---

## Task 4: Extend DOCX Capability with Storage and Telegram Send

**Files:**
- Modify/Create: `app/franchize/lib/docx-capability.ts`

**Step 1: Create or extend docx-capability.ts**

(Same as original plan, but ensure it works with service role for crew owner actions)

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/lib/docx-capability.ts
```

**Step 3: Commit**

```bash
git add app/franchize/lib/docx-capability.ts
git commit -m "feat(lib): add DOCX storage upload and Telegram send utilities"
```

---

## Task 5: Create Submit Contract Draft Server Action

**Files:**
- Create: `app/franchize/server-actions/submit-contract-draft.ts`

**Step 1: Write the submit draft action**

```typescript
// /app/franchize/server-actions/submit-contract-draft.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  SubmitContractDraftInput,
  SubmitContractDraftResult,
  ContractDraftData,
} from '../lib/rental-contract-types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Submit contract draft for crew owner approval
 *
 * 1. Validate user is the renter
 * 2. Save draft to rental.metadata
 * 3. Send Telegram message to crew owner with approve/decline buttons
 */
export async function submitContractDraft(
  input: SubmitContractDraftInput
): Promise<SubmitContractDraftResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const draftId = `draft-${input.rentalId}-${Date.now()}`;

  try {
    // 1. Fetch rental and verify user is the renter
    const { data: rental } = await supabase
      .from('rentals')
      .select('*, crew:crews(id, owner_id, slug)')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    if (rental.user_id !== input.actorTelegramUserId) {
      return { success: false, error: 'Only the renter can submit contract drafts' };
    }

    // 2. Save draft to rental.metadata
    const contractDraft: ContractDraftData = {
      status: 'pending',
      submitted_at: new Date().toISOString(),
      submitted_by: input.actorTelegramUserId,
      renterData: input.renterData,
      equipmentData: input.equipmentData,
      pickupData: input.pickupData,
    };

    const { error: updateError } = await supabase
      .from('rentals')
      .update({
        metadata: {
          ...(rental.metadata || {}),
          contract_draft: contractDraft,
        },
      })
      .eq('rental_id', input.rentalId);

    if (updateError) {
      return { success: false, error: `Failed to save draft: ${updateError.message}` };
    }

    // 3. Send Telegram approval request to crew owner
    const crewOwnerChatId = rental.crew.owner_id;

    if (crewOwnerChatId) {
      // Draft details link for web UI review
      const draftDetailsUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/franchize/${input.crewSlug}/contract-draft/${input.rentalId}`;

      const message = `
📄 <b>Запрос на утверждение договора аренды</b>

<b>Арендатор:</b> ${input.renterData.full_name}
<b>Паспорт:</b> ${input.renterData.passport}
<b>Дата начала:</b> ${rental.requested_start_date || rental.agreed_start_date}
<b>Дата окончания:</b> ${rental.requested_end_date || rental.agreed_end_date}

<b>Оборудование:</b>
• Ключи: ${input.equipmentData.keys_count} шт.
• Шлемы: ${input.equipmentData.helmets_count} шт.
${input.equipmentData.charger ? '• Зарядка\n' : ''}${input.equipmentData.lock ? '• Замок\n' : ''}

<b>Примечания при выдаче:</b>
${input.pickupData.damage_notes_at_delivery}

—
Откройте в браузере для подробностей:
${draftDetailsUrl}
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📄 Открыть в браузере', url: draftDetailsUrl },
          ],
          [
            { text: '✓ Утвердить', callback_data: `approve_contract:${input.rentalId}:${draftId}` },
            { text: '✗ Отклонить', callback_data: `decline_contract:${input.rentalId}:${draftId}` },
          ],
        ],
      };

      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: crewOwnerChatId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }),
      });

      if (!response.ok) {
        console.error('[submitContractDraft] Failed to send Telegram message');
      }
    }

    return {
      success: true,
      draftId,
      approvalRequestSent: Boolean(crewOwnerChatId),
    };

  } catch (error) {
    console.error('[submitContractDraft] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/server-actions/submit-contract-draft.ts
```

**Step 3: Commit**

```bash
git add app/franchize/server-actions/submit-contract-draft.ts
git commit -m "feat(server): add submit contract draft action"
```

---

## Task 6: Create Approve Contract Server Action

**Files:**
- Create: `app/franchize/server-actions/approve-contract.ts`

**Step 1: Write the approve contract action**

```typescript
// /app/franchize/server-actions/approve-contract.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  ApproveContractInput,
  ApproveContractResult,
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
 * Approve contract draft and generate DOCX
 *
 * 1. Verify actor is crew owner
 * 2. Fetch draft from rental.metadata
 * 3. Fetch crew secrets, bike specs
 * 4. Build template vars, render to DOCX
 * 5. Upload to storage (with crew owner's permissions)
 * 6. Save to rental_contract_artifacts
 * 7. Send to both parties via Telegram
 * 8. Update draft status
 */
export async function approveContract(
  input: ApproveContractInput
): Promise<ApproveContractResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const contractKey = `rental-${input.bikeId || input.rentalId}-${Date.now()}`;

  try {
    // 1. Verify actor is crew owner
    const { data: crewMember } = await supabase
      .from('crew_members')
      .select('user_id, role, crew_id')
      .eq('user_id', input.actorTelegramUserId)
      .eq('crew_id', (await supabase.from('crews').select('id').eq('slug', input.crewSlug).single()).data?.id)
      .single();

    if (!crewMember || crewMember.role !== 'owner') {
      return { success: false, error: 'Only crew owner can approve contracts' };
    }

    // 2. Fetch rental with draft
    const { data: rental } = await supabase
      .from('rentals')
      .select('*, vehicle:cars(*)')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    const draft = rental.metadata?.contract_draft;
    if (!draft || draft.status !== 'pending') {
      return { success: false, error: 'No pending contract draft found' };
    }

    // 3. Fetch crew secrets
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

    // 4. Build template vars
    const bike = rental.vehicle;
    const dates = {
      start: formatDateRu(new Date(rental.agreed_start_date || rental.requested_start_date)),
      startTime: formatTimeRu(new Date(rental.agreed_start_date || rental.requested_start_date)),
      end: formatDateRu(new Date(rental.agreed_end_date || rental.requested_end_date)),
      endTime: formatTimeRu(new Date(rental.agreed_end_date || rental.requested_end_date)),
    };

    const contractDefaults = {
      includedMileage: 200,
      overageRate: 35,
      lateReturnPenaltyRub: 10000,
    };

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
      renterData: draft.renterData,
      equipmentData: draft.equipmentData,
      pickupData: draft.pickupData,
    });

    // 5. Render to DOCX
    const { buffer, sha256 } = await renderTemplateToDocx(templateVars);

    // 6. Upload to storage
    const { storagePath, downloadUrl } = await uploadDocxToStorage({
      crewSlug: input.crewSlug,
      contractKey,
      buffer,
      metadata: { crew_id: crewMember.crew_id },
    });

    // 7. Save to rental_contract_artifacts
    await supabase
      .from('rental_contract_artifacts')
      .insert({
        contract_key: contractKey,
        requested_bike_id: rental.vehicle_id,
        resolved_bike_id: bike.id,
        telegram_chat_id: draft.submitted_by,
        renter_full_name: draft.renterData.full_name,
        rent_start_date: dates.start,
        rent_end_date: dates.end,
        original_sha256: sha256,
        rental_id: input.rentalId,
        storage_path: storagePath,
        crew_id: crewMember.crew_id,
      });

    // 8. Send to Telegram (renter + crew owner)
    const filename = `rental-contract-${bike.make}-${bike.model}-${dates.start}.docx`;
    const caption = `✅ <b>Договор аренды утвержден</b>\n${bike.make} ${bike.model}\n${dates.start} — ${dates.end}\n\nСкачать: ${downloadUrl}`;

    await sendDocxViaTelegram({
      buffer,
      filename,
      chatIds: [draft.submitted_by, input.actorTelegramUserId],
      caption,
    });

    // 9. Update draft status
    await supabase
      .from('rentals')
      .update({
        metadata: {
          ...rental.metadata,
          contract_draft: { ...draft, status: 'approved' },
          contract_key,
          contract_sha256: sha256,
        },
      })
      .eq('rental_id', input.rentalId);

    return {
      success: true,
      downloadUrl,
      storagePath,
      contractKey,
      sha256,
    };

  } catch (error) {
    console.error('[approveContract] Error:', error);
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

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/server-actions/approve-contract.ts
```

**Step 3: Commit**

```bash
git add app/franchize/server-actions/approve-contract.ts
git commit -m "feat(server): add approve contract action"
```

---

## Task 7: Create Decline Contract Server Action

**Files:**
- Create: `app/franchize/server-actions/decline-contract.ts`

**Step 1: Write the decline contract action**

```typescript
// /app/franchize/server-actions/decline-contract.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  DeclineContractInput,
  DeclineContractResult,
} from '../lib/rental-contract-types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Decline contract draft
 *
 * 1. Verify actor is crew owner
 * 2. Update draft status to declined
 * 3. Notify renter via Telegram
 */
export async function declineContract(
  input: DeclineContractInput
): Promise<DeclineContractResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  try {
    // 1. Verify actor is crew owner
    const { data: crewMember } = await supabase
      .from('crew_members')
      .select('user_id, role')
      .eq('user_id', input.actorTelegramUserId)
      .eq('role', 'owner')
      .single();

    if (!crewMember) {
      return { success: false, error: 'Only crew owner can decline contracts' };
    }

    // 2. Fetch rental with draft
    const { data: rental } = await supabase
      .from('rentals')
      .select('metadata, user_id')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    const draft = rental.metadata?.contract_draft;
    if (!draft || draft.status !== 'pending') {
      return { success: false, error: 'No pending contract draft found' };
    }

    // 3. Update draft status
    await supabase
      .from('rentals')
      .update({
        metadata: {
          ...rental.metadata,
          contract_draft: { ...draft, status: 'declined' },
        },
      })
      .eq('rental_id', input.rentalId);

    // 4. Notify renter
    const message = `
❌ <b>Запрос на договор отклонен</b>

${input.reason ? `<b>Причина:</b> ${input.reason}` : ''}

Пожалуйста, свяжитесь с владельцем техники для уточнения деталей.
`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: rental.user_id,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    return { success: true };

  } catch (error) {
    console.error('[declineContract] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/server-actions/decline-contract.ts
```

**Step 3: Commit**

```bash
git add app/franchize/server-actions/decline-contract.ts
git commit -m "feat(server): add decline contract action"
```

---

## Task 8: Create Telegram Callback Handler

**Files:**
- Create: `app/api/webhooks/telegram-contract-callback/route.ts`

**Step 1: Write the callback handler**

```typescript
// /app/api/webhooks/telegram-contract-callback/route.ts
import { createClient } from '@supabase/supabase-js';
import { approveContract } from '@/app/franchize/server-actions/approve-contract';
import { declineContract } from '@/app/franchize/server-actions/decline-contract';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { callback_query, message } = body;

    // Handle callback query (button press)
    if (callback_query) {
      const { data, id, from, message: msg } = callback_query;
      const [action, rentalId, draftId] = data.split(':');

      // Acknowledge the callback
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: id }),
      });

      if (action === 'approve_contract') {
        // Get rental details
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
        const { data: rental } = await supabase
          .from('rentals')
          .select('crew_slug, vehicle_id')
          .eq('rental_id', rentalId)
          .single();

        if (!rental) {
          await sendErrorMessage(msg.chat.id, 'Аренда не найдена');
          return Response.json({ ok: true });
        }

        const result = await approveContract({
          rentalId,
          crewSlug: rental.crew_slug,
          bikeId: rental.vehicle_id,
          contractDraftId: draftId,
          actorTelegramUserId: String(from.id),
        });

        if (result.success) {
          await sendMessage(msg.chat.id, `✅ Договор утвержден и отправлен!\n\nСкачать: ${result.downloadUrl}`);
        } else {
          await sendErrorMessage(msg.chat.id, result.error || 'Ошибка при утверждении');
        }

      } else if (action === 'decline_contract') {
        const result = await declineContract({
          rentalId,
          contractDraftId: draftId,
          actorTelegramUserId: String(from.id),
        });

        if (result.success) {
          await sendMessage(msg.chat.id, '✗ Запрос на договор отклонен. Арендатор уведомлен.');
        } else {
          await sendErrorMessage(msg.chat.id, result.error || 'Ошибка при отклонении');
        }
      }

      return Response.json({ ok: true });
    }

    return Response.json({ ok: true });

  } catch (error) {
    console.error('[telegram-contract-callback] Error:', error);
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

async function sendMessage(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
}

async function sendErrorMessage(chatId: number | string, error: string) {
  await sendMessage(chatId, `❌ Ошибка: ${error}`);
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/api/webhooks/telegram-contract-callback/route.ts
```

**Step 3: Commit**

```bash
git add app/api/webhooks/telegram-contract-callback/route.ts
git commit -m "feat(api): add telegram contract callback handler"
```

---

## Task 9: Export New Actions from Module

**Files:**
- Modify: `app/franchize/server-actions/rentals.ts`

**Step 1: Add exports to rentals.ts**

```typescript
// Contract generation actions
export {
  submitContractDraft,
} from './submit-contract-draft';
export {
  approveContract,
} from './approve-contract';
export {
  declineContract,
} from './decline-contract';

// Export types
export type {
  SubmitContractDraftInput,
  SubmitContractDraftResult,
  ApproveContractInput,
  ApproveContractResult,
  DeclineContractInput,
  DeclineContractResult,
  ContractDraftData,
} from '../../lib/rental-contract-types';
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/server-actions/rentals.ts
```

**Step 3: Commit**

```bash
git add app/franchize/server-actions/rentals.ts
git commit -m "feat(server): export contract actions from rentals module"
```

---

## Task 10: Update Main Actions Export

**Files:**
- Modify: `app/franchize/actions-runtime.ts` and `app/franchize/actions.ts`

**Step 1: Add types to actions-runtime.ts**

```typescript
// Contract generation types
export type {
  SubmitContractDraftInput,
  SubmitContractDraftResult,
  ApproveContractInput,
  ApproveContractResult,
  DeclineContractInput,
  DeclineContractResult,
  ContractDraftData,
  FinalizeRentalReturnInput,
  FinalizeRentalReturnResult,
  RentalContractTemplateVars,
  CrewContractSecrets,
  BikeSpecs,
} from '../lib/rental-contract-types';
```

**Step 2: Add action wrappers to actions.ts**

```typescript
// Contract generation actions
import {
  submitContractDraft as submitContractDraftAction,
  approveContract as approveContractAction,
  declineContract as declineContractAction,
} from "@/app/franchize/server-actions/rentals";

export async function submitContractDraft(
  ...args: Parameters<typeof submitContractDraftAction>
) {
  return submitContractDraftAction(...args);
}

export async function approveContract(
  ...args: Parameters<typeof approveContractAction>
) {
  return approveContractAction(...args);
}

export async function declineContract(
  ...args: Parameters<typeof declineContractAction>
) {
  return declineContractAction(...args);
}
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/actions.ts app/franchize/actions-runtime.ts
```

**Step 4: Commit**

```bash
git add app/franchize/actions.ts app/franchize/actions-runtime.ts
git commit -m "feat(actions): export contract generation from main actions module"
```

---

## Task 11: Create Contract Draft UI Component

**Files:**
- Create: `app/franchize/components/ContractDraftPanel.tsx`

**Step 1: Write the ContractDraftPanel component**

```typescript
// /app/franchize/components/ContractDraftPanel.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { submitContractDraft, type FranchizeTheme } from "../../actions";

interface ContractDraftPanelProps {
  rentalId: string;
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
  userId: string;
  isRenter: boolean;
  theme: FranchizeTheme;
}

export function ContractDraftPanel({
  rentalId,
  crewSlug,
  bikeId,
  bikeTitle,
  bikeType,
  dates,
  userId,
  isRenter,
  theme,
}: ContractDraftPanelProps) {
  const { dbUser } = useAppContext();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    renterData: {
      full_name: '',
      passport: '',
      passport_issue_date: '',
      registration: '',
      birth_date: '',
      driver_license: '',
      phone: '',
      email: '',
    },
    equipmentData: {
      keys_count: 1,
      helmets_count: 1,
      charger: bikeType === 'ebike',
      lock: true,
      other_equipment: '',
    },
    pickupData: {
      odometer_km: '',
      fuel_level: bikeType === 'bike' ? '' : undefined,
      battery_start: bikeType === 'ebike' ? '100' : undefined,
      damage_notes_at_delivery: '',
    },
  });

  const canSubmit = isRenter && !isPending;

  const handleSubmit = () => {
    if (!dbUser?.user_id) {
      toast.error('Требуется авторизация');
      return;
    }

    // Validate required fields
    if (!formData.renterData.full_name || !formData.renterData.passport) {
      toast.error('Заполните ФИО и паспортные данные');
      return;
    }

    if (!formData.pickupData.odometer_km) {
      toast.error('Укажите пробег');
      return;
    }

    startTransition(async () => {
      const result = await submitContractDraft({
        rentalId,
        crewSlug,
        bikeId,
        renterData: formData.renterData,
        equipmentData: formData.equipmentData,
        pickupData: {
          ...formData.pickupData,
          odometer_km: Number(formData.pickupData.odometer_km),
        },
        actorTelegramUserId: dbUser.user_id,
      });

      if (!result.success) {
        toast.error(result.error || 'Не удалось отправить запрос');
        return;
      }

      toast.success('Запрос на договор отправлен владельцу техники!');
    });
  };

  if (!isRenter) return null;

  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{
        borderColor: theme.palette.borderSoft,
        backgroundColor: `${theme.palette.bgCard}CC`,
      }}
    >
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: theme.palette.textSecondary }}>
        Договор аренды
      </p>
      <h3 className="mt-1 text-base font-semibold" style={{ color: theme.palette.textPrimary }}>
        Заполните данные для договора
      </h3>
      <p className="mt-1 text-sm" style={{ color: theme.palette.textSecondary }}>
        {bikeTitle} • {dates?.start} — {dates?.end}
      </p>

      <div className="mt-3 space-y-3 text-sm">
        {/* Renter Data Section */}
        <div className="space-y-2">
          <p className="font-medium">Данные арендатора</p>
          <input
            type="text"
            placeholder="ФИО полностью"
            value={formData.renterData.full_name}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              renterData: { ...prev.renterData, full_name: e.target.value }
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
          <input
            type="text"
            placeholder="Паспорт (серия номер)"
            value={formData.renterData.passport}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              renterData: { ...prev.renterData, passport: e.target.value }
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
        </div>

        {/* Equipment Section */}
        <div className="space-y-2">
          <p className="font-medium">Оборудование</p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.equipmentData.charger}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                equipmentData: { ...prev.equipmentData, charger: e.target.checked }
              }))}
            />
            <span>Зарядка</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.equipmentData.lock}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                equipmentData: { ...prev.equipmentData, lock: e.target.checked }
              }))}
            />
            <span>Замок</span>
          </label>
        </div>

        {/* Pickup Data Section */}
        <div className="space-y-2">
          <p className="font-medium">Данные при выдаче</p>
          <input
            type="number"
            placeholder="Пробег (км)"
            value={formData.pickupData.odometer_km}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              pickupData: { ...prev.pickupData, odometer_km: e.target.value }
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
          {bikeType === 'ebike' && (
            <input
              type="text"
              placeholder="Заряд батареи при выдаче (%)"
              value={formData.pickupData.battery_start}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                pickupData: { ...prev.pickupData, battery_start: e.target.value }
              }))}
              className="w-full rounded-lg border px-2 py-1.5"
              style={{ borderColor: theme.palette.borderSoft }}
            />
          )}
          <textarea
            placeholder="Примечания при выдаче (повреждения, состояние)"
            value={formData.pickupData.damage_notes_at_delivery}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              pickupData: { ...prev.pickupData, damage_notes_at_delivery: e.target.value }
            }))}
            rows={3}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
        </div>

        <button
          type="button"
          disabled={isPending || !canSubmit}
          onClick={handleSubmit}
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{
            backgroundColor: theme.palette.accentMain,
            color: '#16130A',
          }}
        >
          {isPending ? 'Отправляем...' : '📄 Отправить на утверждение'}
        </button>
      </div>
    </section>
  );
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/components/ContractDraftPanel.tsx
```

**Step 3: Commit**

```bash
git add app/franchize/components/ContractDraftPanel.tsx
git commit -m "feat(component): add ContractDraftPanel for user form"
```

---

## Task 12: Create Contract Draft Details Page

**Files:**
- Create: `app/franchize/[slug]/contract-draft/[rentalId]/page.tsx`

**Step 1: Write the contract draft details page**

```typescript
// /app/franchize/[slug]/contract-draft/[rentalId]/page.tsx
import { notFound } from "next/navigation";
import { approveContract, declineContract, type FranchizeTheme } from "@/app/franchize/actions";
import ContractDraftReview from "@/app/franchize/components/ContractDraftReview";

interface ContractDraftPageProps {
  params: {
    slug: string;
    rentalId: string;
  };
}

export default async function ContractDraftPage({ params }: ContractDraftPageProps) {
  const { slug, rentalId } = params;
  const resolvedSlug = await Promise.resolve(slug);
  const resolvedRentalId = await Promise.resolve(rentalId);

  // Fetch rental with draft
  const supabase = createClient(/* ... */);
  const { data: rental } = await supabase
    .from('rentals')
    .select('*, vehicle:cars(*), crew:crews(*)')
    .eq('rental_id', resolvedRentalId)
    .single();

  if (!rental || rental.crew?.slug !== resolvedSlug) {
    notFound();
  }

  const draft = rental.metadata?.contract_draft;
  if (!draft || draft.status !== 'pending') {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold">Договор не найден или уже обработан</h1>
      </div>
    );
  }

  // Fetch crew secrets for preview
  const { data: crewSecrets } = await supabase
    .schema('private')
    .from('crew_secrets')
    .select('contract_defaults')
    .eq('crew_slug', resolvedSlug)
    .single();

  const orgSecrets = crewSecrets?.contract_defaults
    ? (typeof crewSecrets.contract_defaults === 'string'
        ? JSON.parse(crewSecrets.contract_defaults)
        : crewSecrets.contract_defaults)
    : {};

  const theme: FranchizeTheme = rental.crew?.theme || DEFAULT_FRANCHIZE_THEME;

  return (
    <ContractDraftReview
      rental={rental}
      draft={draft}
      bike={rental.vehicle}
      crewSlug={resolvedSlug}
      orgSecrets={orgSecrets}
      theme={theme}
    />
  );
}
```

**Step 2: Create ContractDraftReview component**

```typescript
// /app/franchize/components/ContractDraftReview.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { approveContract, declineContract, type FranchizeTheme } from "../../actions";

interface ContractDraftReviewProps {
  rental: any;
  draft: any;
  bike: any;
  crewSlug: string;
  orgSecrets: any;
  theme: FranchizeTheme;
}

export function ContractDraftReview({
  rental,
  draft,
  bike,
  crewSlug,
  orgSecrets,
  theme,
}: ContractDraftReviewProps) {
  const { dbUser } = useAppContext();
  const [isPending, startTransition] = useTransition();

  const isOwner = Boolean(dbUser && /* check if crew owner */);

  const handleApprove = () => {
    if (!dbUser?.user_id || !isOwner) {
      toast.error('Только владелец экипажа может утвердить договор');
      return;
    }

    startTransition(async () => {
      const result = await approveContract({
        rentalId: rental.rental_id,
        crewSlug,
        bikeId: bike.id,
        contractDraftId: `draft-${rental.rental_id}-${new Date(draft.submitted_at).getTime()}`,
        actorTelegramUserId: dbUser.user_id,
      });

      if (result.success) {
        toast.success('Договор утвержден и отправлен!');
        // Optionally redirect or refresh
      } else {
        toast.error(result.error || 'Ошибка при утверждении');
      }
    });
  };

  const handleDecline = () => {
    if (!dbUser?.user_id || !isOwner) {
      toast.error('Только владелец экипажа может отклонить запрос');
      return;
    }

    const reason = prompt('Причина отклонения (опционально):');

    startTransition(async () => {
      const result = await declineContract({
        rentalId: rental.rental_id,
        contractDraftId: `draft-${rental.rental_id}-${new Date(draft.submitted_at).getTime()}`,
        reason,
        actorTelegramUserId: dbUser.user_id,
      });

      if (result.success) {
        toast.success('Запрос отклонен. Арендатор уведомлен.');
      } else {
        toast.error(result.error || 'Ошибка при отклонении');
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: theme.palette.textPrimary }}>
        Запрос на договор аренды
      </h1>

      {/* Renter Info */}
      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgCard }}
      >
        <h2 className="font-semibold mb-3">Данные арендатора</h2>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-gray-500">ФИО:</dt><dd>{draft.renterData.full_name}</dd></div>
          <div><dt className="text-gray-500">Паспорт:</dt><dd>{draft.renterData.passport}</dd></div>
          {draft.renterData.driver_license && (
            <div><dt className="text-gray-500">Водительское удостоверение:</dt><dd>{draft.renterData.driver_license}</dd></div>
          )}
          {draft.renterData.phone && (
            <div><dt className="text-gray-500">Телефон:</dt><dd>{draft.renterData.phone}</dd></div>
          )}
        </dl>
      </section>

      {/* Equipment */}
      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgCard }}
      >
        <h2 className="font-semibold mb-3">Выданное оборудование</h2>
        <ul className="text-sm space-y-1">
          <li>🔑 Ключи: {draft.equipmentData.keys_count} шт.</li>
          <li>⛑ Шлемы: {draft.equipmentData.helmets_count} шт.</li>
          {draft.equipmentData.charger && <li>🔌 Зарядка</li>}
          {draft.equipmentData.lock && <li>🔒 Замок</li>}
          {draft.equipmentData.other_equipment && <li>📦 {draft.equipmentData.other_equipment}</li>}
        </ul>
      </section>

      {/* Pickup Conditions */}
      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgCard }}
      >
        <h2 className="font-semibold mb-3">Состояние при выдаче</h2>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-gray-500">Пробег:</dt><dd>{draft.pickupData.odometer_km} км</dd></div>
          {draft.pickupData.fuel_level && (
            <div><dt className="text-gray-500">Уровень топлива:</dt><dd>{draft.pickupData.fuel_level}</dd></div>
          )}
          {draft.pickupData.battery_start && (
            <div><dt className="text-gray-500">Заряд батареи:</dt><dd>{draft.pickupData.battery_start}%</dd></div>
          )}
          {draft.pickupData.checklist && draft.pickupData.checklist.length > 0 && (
            <div><dt className="text-gray-500">Чеклист:</dt><dd>{draft.pickupData.checklist.join(', ')}</dd></div>
          )}
          <div><dt className="text-gray-500">Примечания:</dt><dd className="whitespace-pre-wrap">{draft.pickupData.damage_notes_at_delivery}</dd></div>
        </dl>
      </section>

      {/* Bike Info */}
      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgCard }}
      >
        <h2 className="font-semibold mb-3">Транспортное средство</h2>
        <p className="text-lg font-semibold">{bike.make} {bike.model}</p>
        <p className="text-sm text-gray-500">
          {rental.agreed_start_date || rental.requested_start_date} — {rental.agreed_end_date || rental.requested_end_date}
        </p>
      </section>

      {/* Actions */}
      {isOwner && (
        <div className="flex gap-3">
          <button
            disabled={isPending}
            onClick={handleApprove}
            className="flex-1 rounded-lg px-4 py-3 font-semibold"
            style={{ backgroundColor: '#22c55e', color: 'white' }}
          >
            {isPending ? 'Обработка...' : '✓ Утвердить и создать договор'}
          </button>
          <button
            disabled={isPending}
            onClick={handleDecline}
            className="flex-1 rounded-lg px-4 py-3 font-semibold"
            style={{ backgroundColor: '#ef4444', color: 'white' }}
          >
            ✗ Отклонить
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/[slug]/contract-draft/[rentalId]/page.tsx
npx tsc --noEmit --pretty app/franchize/components/ContractDraftReview.tsx
```

**Step 3: Commit**

```bash
git add app/franchize/[slug]/contract-draft/[rentalId]/page.tsx
git add app/franchize/components/ContractDraftReview.tsx
git commit -m "feat(page): add contract draft details page for crew review"
```

---

## Task 13: Extend FranchizeRentalDocumentsPanel

**Files:**
- Modify: `app/franchize/components/FranchizeRentalDocumentsPanel.tsx`

**Step 1: Add ContractDraftPanel to DocumentsPanel**

Check current structure and add the ContractDraftPanel component after existing sections.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/components/FranchizeRentalDocumentsPanel.tsx
```

**Step 3: Commit**

```bash
git add app/franchize/components/FranchizeRentalDocumentsPanel.tsx
git commit -m "feat(component): integrate ContractDraftPanel into DocumentsPanel"
```

---

## Task 13: Create Rental Return Panel Component

**Files:**
- Create: `app/franchize/components/RentalReturnPanel.tsx`

**Step 1: Write the RentalReturnPanel component**

(Same as original plan)

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty app/franchize/components/RentalReturnPanel.tsx
```

**Step 3: Commit**

```bash
git add app/franchize/components/RentalReturnPanel.tsx
git commit -m "feat(component): add RentalReturnPanel for post-rental editing"
```

---

## Task 14: End-to-End Integration Test

**Files:**
- Manual browser test + Telegram verification

**Step 1-10:** Test the full flow:
1. User navigates to rental page
2. Fills contract draft form
3. Clicks "Send for Approval"
4. Crew owner receives Telegram message with buttons
5. Crew owner clicks "Approve"
6. Contract is generated and uploaded
7. Both parties receive DOCX via Telegram
8. Test "Decline" flow
9. Test return finalization

---

## Summary Checklist

**Before considering this plan complete:**
- [ ] Storage bucket created with correct RLS (chat_id auth)
- [ ] Contract draft action saves to rental.metadata
- [ ] Telegram approval flow works (approve/decline buttons)
- [ ] Contract generation runs with crew owner permissions
- [ ] End-to-end test passes (draft → approve → generate → send)
- [ ] Return finalization flow works
- [ ] Documentation updated

**Key files created:**
- `app/franchize/lib/rental-contract-types.ts`
- `app/franchize/lib/rental-contract-vars.ts`
- `app/franchize/lib/docx-capability.ts`
- `app/franchize/server-actions/submit-contract-draft.ts`
- `app/franchize/server-actions/approve-contract.ts`
- `app/franchize/server-actions/decline-contract.ts`
- `app/franchize/server-actions/finalize-rental-return.ts`
- `app/franchize/api/webhooks/telegram-contract-callback/route.ts`
- `app/franchize/components/ContractDraftPanel.tsx`
- `app/franchize/components/RentalReturnPanel.tsx`

**Key architectural improvements:**
- Users submit drafts, crew owners approve
- Storage upload happens with crew permissions
- Works with chat_id auth model
- Clean security boundary
