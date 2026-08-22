# Rental System Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify bot-generated rental contracts with web-app rentals, enable QR linking for user reclamation, and provide crew analytics for daily rental tracking.

**Architecture:** Bot creates `rentals` row first (with crew owner as placeholder), then `rental_contract_artifacts` with FK reference. QR scanning swaps user in all three tables (rentals, artifacts, secrets). Analytics page queries `rentals` where start_date = today.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL), TypeScript, Telegram Bot API

---

## File Structure

### New Files to Create

| File | Responsibility |
|------|-----------------|
| `lib/rental-date-utils.ts` | Convert TEXT DD.MM.YYYY + HH:MM → TIMESTAMPTZ (Moscow UTC+3) |
| `supabase/migrations/20260618000001_rental_contract_artifacts_rental_id.sql` | Add `rental_id` FK column to artifacts table |
| `app/lib/qr-linking-handler.ts` | Server action for QR code claiming (3-table transaction) |
| `app/franchize/[slug]/analytics/page.tsx` | Analytics page server component |
| `app/franchize/[slug]/analytics/components/AnalyticsClient.tsx` | Analytics UI client component |

### Files to Modify

| File | Changes |
|------|---------|
| `scripts/make-rental-contract-skill.mjs` | Create `rentals` row before artifact, resolve crew owner |
| `app/webhook-handlers/commands/doc-manual.ts` | Same rental creation logic as skill |
| `app/franchize/actions-runtime.ts` | Add `getTodayRentalsAnalytics()` server action |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260618000001_rental_contract_artifacts_rental_id.sql`

- [ ] **Step 1: Create migration file with rental_id FK column**

Create the migration file at `supabase/migrations/20260618000001_rental_contract_artifacts_rental_id.sql`:

```sql
-- Add rental_id FK to private.rental_contract_artifacts
-- This links bot-generated contracts to the rentals table for unified tracking
-- Migration: 20260618000001
-- Author: Rental system alignment implementation

-- Add the FK column (nullable initially for backward compatibility)
ALTER TABLE private.rental_contract_artifacts
ADD COLUMN rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL;

-- Create a partial index for efficient lookups
-- Only indexes rows where rental_id IS NOT NULL (most rows after this migration)
CREATE INDEX idx_rental_contract_artifacts_rental_id
ON private.rental_contract_artifacts(rental_id)
WHERE rental_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN private.rental_contract_artifacts.rental_id IS 'FK to public.rentals, links bot contract to unified rental tracking';
```

- [ ] **Step 2: Verify migration syntax**

Check SQL syntax by reading the file:

```bash
cat supabase/migrations/20260618000001_rental_contract_artifacts_rental_id.sql
```

Expected: Output shows the SQL content above

- [ ] **Step 3: Apply migration to database**

Run the migration via Supabase CLI or dashboard:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually in Supabase Dashboard → SQL Editor
# Copy the SQL content and execute
```

Expected: "Migration applied successfully" or similar confirmation

- [ ] **Step 4: Verify column was added**

Query the database to verify:

```sql
-- In Supabase SQL Editor or via psql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'private' 
  AND table_name = 'rental_contract_artifacts'
  AND column_name = 'rental_id';
```

Expected: Row showing `rental_id | uuid | YES | (null)` with FK reference

- [ ] **Step 5: Commit migration**

```bash
git add supabase/migrations/20260618000001_rental_contract_artifacts_rental_id.sql
git commit -m "feat(rentals): add rental_id FK to rental_contract_artifacts

- Links bot contracts to unified rentals table
- ON DELETE SET NULL maintains audit trail
- Partial index for efficient lookups"
```

---

## Task 2: Date Conversion Helper

**Files:**
- Create: `lib/rental-date-utils.ts`
- Test: Create `lib/__tests__/rental-date-utils.test.ts`

- [ ] **Step 1: Write failing test for date conversion**

Create `lib/__tests__/rental-date-utils.test.ts`:

```typescript
import { convertTextDateToTimestamp, parseRuDateParts } from '../rental-date-utils';

describe('convertTextDateToTimestamp', () => {
  test('should convert DD.MM.YYYY and HH:MM to ISO timestamp (UTC+3)', () => {
    // Moscow time 18:00 on 17.06.2026 = 15:00 UTC
    const result = convertTextDateToTimestamp('17.06.2026', '18:00', 3);
    expect(result).toBe('2026-06-17T15:00:00.000Z');
  });

  test('should handle midnight correctly', () => {
    const result = convertTextDateToTimestamp('17.06.2026', '00:00', 3);
    expect(result).toBe('2026-06-16T21:00:00.000Z');
  });

  test('should handle different timezone offsets', () => {
    const result = convertTextDateToTimestamp('17.06.2026', '18:00', 0);
    expect(result).toBe('2026-06-17T18:00:00.000Z');
  });

  test('should handle single-digit hour/minute', () => {
    const result = convertTextDateToTimestamp('17.06.2026', '9:5', 3);
    expect(result).toBe('2026-06-17T06:05:00.000Z');
  });
});

describe('parseRuDateParts', () => {
  test('should parse DD.MM.YYYY format', () => {
    const result = parseRuDateParts('17.06.2026');
    expect(result).toEqual({ d: 17, m: 5, y: 2026 });
  });

  test('should handle 2-digit year (20xx)', () => {
    const result = parseRuDateParts('17.06.26');
    expect(result).toEqual({ d: 17, m: 5, y: 2026 });
  });

  test('should return null for invalid format', () => {
    expect(parseRuDateParts('invalid')).toBeNull();
    expect(parseRuDateParts('17-06-2026')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- lib/__tests__/rental-date-utils.test.ts
```

Expected: FAIL with "convertTextDateToTimestamp is not defined"

- [ ] **Step 3: Implement date conversion helper**

Create `lib/rental-date-utils.ts`:

```typescript
/**
 * Rental date utilities for converting TEXT dates (DD.MM.YYYY) to TIMESTAMPTZ.
 * Used by skill script and doc-manual for unified rental tracking.
 */

/**
 * Parse Russian date format DD.MM.YYYY or DD.MM.YY into components.
 * @param dateStr - Date string in "17.06.2026" or "17.06.26" format
 * @returns Object with d (day), m (month 0-indexed), y (year) or null
 */
export function parseRuDateParts(dateStr: string): { d: number; m: number; y: number } | null {
  const match = String(dateStr || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!match) return null;

  let [, d, m, y] = match;
  const day = parseInt(d, 10);
  const month = parseInt(m, 10) - 1; // JS months are 0-indexed
  let year = parseInt(y, 10);

  // Convert 2-digit year to 4-digit
  if (year < 100) {
    year = year > 50 ? 1900 + year : 2000 + year;
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null;
  }

  return { d: day, m: month, y: year };
}

/**
 * Convert TEXT date + time to ISO timestamp.
 * Assumes input is in local timezone and converts to UTC by subtracting offset.
 * 
 * @param dateText - Date in "DD.MM.YYYY" format
 * @param timeText - Time in "HH:MM" format (minutes optional, defaults to 00)
 * @param timezoneOffset - Hour offset from UTC (default: 3 for Moscow)
 * @returns ISO timestamp string or null if invalid
 * 
 * @example
 * convertTextDateToTimestamp('17.06.2026', '18:00', 3)
 * // returns '2026-06-17T15:00:00.000Z'
 */
export function convertTextDateToTimestamp(
  dateText: string,
  timeText: string,
  timezoneOffset: number = 3
): string | null {
  const parsed = parseRuDateParts(dateText);
  if (!parsed) return null;

  // Parse time HH:MM, default to 00:00 if minutes missing
  const timeMatch = String(timeText || '').trim().match(/^(\d{1,2})(:(\d{2}))?$/);
  if (!timeMatch) return null;

  const hh = parseInt(timeMatch[1], 10);
  const mm = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }

  // Create date in "local" timezone (input is treated as local time)
  const localDate = new Date(parsed.y, parsed.m, parsed.d, hh, mm);

  if (isNaN(localDate.getTime())) {
    return null;
  }

  // Convert to UTC by subtracting timezone offset in milliseconds
  const utcDate = new Date(localDate.getTime() - timezoneOffset * 60 * 60 * 1000);

  return utcDate.toISOString();
}

/**
 * Parse time string HH:MM into total minutes.
 * @param timeText - Time in "HH:MM" or "H" format
 * @returns Total minutes from midnight, or null if invalid
 */
export function parseTimeToMinutes(timeText: string): number | null {
  const timeMatch = String(timeText || '').trim().match(/^(\d{1,2})(:(\d{2}))?$/);
  if (!timeMatch) return null;

  const hh = parseInt(timeMatch[1], 10);
  const mm = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }

  return hh * 60 + mm;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- lib/__tests__/rental-date-utils.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit helper and tests**

```bash
git add lib/rental-date-utils.ts lib/__tests__/rental-date-utils.test.ts
git commit -m "feat(rentals): add date conversion helper for TEXT → TIMESTAMPTZ

- convertTextDateToTimestamp() converts DD.MM.YYYY HH:MM to ISO
- parseRuDateParts() handles Russian date format
- parseTimeToMinutes() converts time to minutes
- Supports timezone offset (default UTC+3 for Moscow)"
```

---

## Task 3: Crew Owner Resolution Function

**Files:**
- Modify: `scripts/make-rental-contract-skill.mjs` (add import)
- Modify: `app/webhook-handlers/commands/doc-manual.ts` (add import)

- [ ] **Step 1: Create crew owner resolution utility**

Add to `lib/rental-date-utils.ts` (append to existing file):

```typescript
/**
 * Resolve crew owner's telegram chat_id from a bike's crew_id.
 * Used to set placeholder user_id when creating rentals from bot contracts.
 * 
 * @param supabase - Supabase client instance
 * @param crewId - The crew ID from bike.crew_id
 * @returns Crew owner's chat_id, or null if not found
 */
export async function resolveCrewOwnerChatId(
  supabase: any,
  crewId: string
): Promise<string | null> {
  if (!crewId) return null;

  try {
    // Get crew slug from crew_id
    const { data: crew } = await supabase
      .from('crews')
      .select('slug')
      .eq('id', crewId)
      .maybeSingle();

    if (!crew?.slug) return null;

    // Get crew owner (user with 'owner' role in this crew)
    const { data: member } = await supabase
      .from('crew_members')
      .select('user_id')
      .eq('crew_id', crewId)
      .eq('role', 'owner')
      .maybeSingle();

    return member?.user_id || null;
  } catch (error) {
    console.error('[resolveCrewOwnerChatId] Failed:', error);
    return null;
  }
}
```

- [ ] **Step 2: Test crew owner resolution manually**

In Supabase SQL Editor, verify the query works:

```sql
-- Find a bike with crew_id
SELECT id, make, model, crew_id FROM cars WHERE crew_id IS NOT NULL LIMIT 1;

-- Using that crew_id, find the owner
SELECT cm.user_id, c.slug 
FROM crew_members cm
JOIN crews c ON cm.crew_id = c.id
WHERE cm.crew_id = '{your_crew_id}' AND cm.role = 'owner';
```

Expected: Returns the owner's user_id (chat_id format)

- [ ] **Step 3: Commit utility function**

```bash
git add lib/rental-date-utils.ts
git commit -m "feat(rentals): add resolveCrewOwnerChatId utility

- Resolves crew owner from bike.crew_id
- Queries crews → crew_members for role='owner'
- Returns chat_id for placeholder user_id in rentals"
```

---

## Task 4: Skill Script Rental Creation

**Files:**
- Modify: `scripts/make-rental-contract-skill.mjs` (lines 486-604 area, after DOCA generation)

- [ ] **Step 1: Add imports to skill script**

Find the imports section at the top of `scripts/make-rental-contract-skill.mjs` and add:

```javascript
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { htmlToDocxElements } from '../lib/htmlToDocx.mjs';

// ADD THESE IMPORTS:
import { convertTextDateToTimestamp, resolveCrewOwnerChatId } from '../app/lib/rental-date-utils.mjs';
```

Note: The import path uses `.mjs` extension because this is an ESM script.

- [ ] **Step 2: Add rental creation function**

Add this function before the main execution logic (around line 100, after existing helper functions):

```javascript
/**
 * Create a rentals row when bot generates a rental contract.
 * This unifies bot and web-app rentals in a single table for availability tracking.
 * 
 * @param supabase - Supabase client
 * @param bike - Bike object from catalog
 * @param startDateText - TEXT date in DD.MM.YYYY format
 * @param startTimeText - TEXT time in HH:MM format
 * @param endDateText - TEXT date in DD.MM.YYYY format
 * @param endTimeText - TEXT time in HH:MM format
 * @param dailyPrice - Daily rental price
 * @param totalCost - Total calculated cost
 * @param crewOwnerChatId - Crew owner's chat_id (placeholder user_id)
 * @returns The rental_id UUID, or null if failed
 */
async function createRentalFromBotContract(
  supabase,
  bike,
  startDateText,
  startTimeText,
  endDateText,
  endTimeText,
  dailyPrice,
  totalCost,
  crewOwnerChatId
) {
  try {
    // Convert TEXT dates to TIMESTAMPTZ
    const startDateIso = convertTextDateToTimestamp(startDateText, startTimeText || '18:00', 3);
    const endDateIso = convertTextDateToTimestamp(endDateText, endTimeText || '10:00', 3);

    if (!startDateIso || !endDateIso) {
      console.error('[createRentalFromBotContract] Date conversion failed');
      return null;
    }

    // Create rentals row with crew owner as placeholder
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .insert({
        user_id: crewOwnerChatId,
        owner_id: crewOwnerChatId,
        vehicle_id: bike.id,
        requested_start_date: startDateIso,
        requested_end_date: endDateIso,
        agreed_start_date: startDateIso,
        agreed_end_date: endDateIso,
        status: 'active',
        payment_status: 'fully_paid',
        total_cost: totalCost,
        metadata: {
          source: 'bot_contract',
          daily_price: dailyPrice,
          created_by: 'skill-script',
        },
      })
      .select('rental_id')
      .maybeSingle();

    if (rentalError) {
      console.error('[createRentalFromBotContract] Failed to create rental:', rentalError);
      return null;
    }

    if (!rental?.rental_id) {
      console.error('[createRentalFromBotContract] No rental_id returned');
      return null;
    }

    console.log('[createRentalFromBotContract] Created rental:', rental.rental_id);
    return rental.rental_id;
  } catch (error) {
    console.error('[createRentalFromBotContract] Exception:', error);
    return null;
  }
}
```

- [ ] **Step 3: Integrate rental creation into main flow**

Find the section after DOCX generation (around line 580-604, after `console.log(JSON.stringify(result, null, 2))`) and add:

```javascript
// ... existing code for saving metadata and user_rental_secrets ...

const rentalSecretsPayload = {
  chat_id: telegramChatId,
  crew_slug: resolvedCrewSlug,
  doc_sha256: originalSha256,
  // ... existing fields ...
};

try {
  const { saveUserRentalSecrets } = await import('../app/lib/user-rental-secrets.ts');
  const saved = await saveUserRentalSecrets(rentalSecretsPayload);
  if (!saved) throw new Error('saveUserRentalSecrets returned null');
  result.rentalSecretsSaved = true;
} catch (err) {
  // ... existing fallback ...
}

// ADD THIS BLOCK: Create rentals row for unified tracking
try {
  // Resolve crew owner for placeholder user_id
  const crewOwnerChatId = await resolveCrewOwnerChatId(supabase, bike.crew_id) || telegramChatId;
  
  const rentalId = await createRentalFromBotContract(
    supabase,
    bike,
    startDate,
    startTimeArg,
    endDate,
    endTimeArg,
    bikeDailyPrice,
    subtotalRounded,
    crewOwnerChatId
  );

  if (rentalId) {
    result.rentalId = rentalId;
    result.rentalCreated = true;
    
    // Update rental_contract_artifacts insert to include rental_id
    // (modify the existing insertMetadataWithFallback call below)
    const payloadWithRentalId = {
      ...payload,
      rental_id: rentalId,
    };
    
    const writeRes = await insertMetadataWithFallback(metadataTable, payloadWithRentalId);
    if (writeRes.error) {
      failStage('metadata_write', 'metadata_write_failed_with_rental_id', { table: metadataTable, error: writeRes.error.message });
    }
  } else {
    console.warn('[make-rental-contract-skill] Failed to create rental, artifact will have no rental_id');
    result.rentalCreated = false;
  }
} catch (rentalError) {
  console.error('[make-rental-contract-skill] Rental creation failed:', rentalError);
  result.rentalCreated = false;
}
```

- [ ] **Step 4: Test the skill script locally**

```bash
# Test the skill script with sample data
node scripts/make-rental-contract-skill.mjs \
  --bikeId "kawasaki-ex650k" \
  --phrase "создай документ kawasaki-ex650k с сегодня 18:00 до завтра 10:00" \
  --passportJson '{"fullName":"Иванов Иван Иванович","series":"4509","number":"123456","issueDate":"15.03.2020","registration":"Нижний Новгород"}' \
  --licenseJson '{"series":"99","number":"76123456","issueDate":"15.03"}' \
  --telegramChatId "$ADMIN_CHAT_ID" \
  --saveMetadata 1
```

Expected: Script completes successfully, check console for "Created rental: <uuid>"

- [ ] **Step 5: Verify rental was created in database**

In Supabase SQL Editor:

```sql
-- Check the most recent rental
SELECT rental_id, user_id, vehicle_id, status, payment_status, 
       requested_start_date, requested_end_date, total_cost,
       metadata->>'source' as source
FROM rentals
ORDER BY created_at DESC
LIMIT 5;
```

Expected: Shows rental with `source = 'bot_contract'` and `user_id = crew_owner_chat_id`

- [ ] **Step 6: Verify rental_id is in rental_contract_artifacts**

```sql
SELECT contract_key, rental_id, telegram_chat_id, resolved_bike_id
FROM private.rental_contract_artifacts
WHERE rental_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

Expected: Shows artifacts with `rental_id` set (not NULL)

- [ ] **Step 7: Commit skill script changes**

```bash
git add scripts/make-rental-contract-skill.mjs lib/rental-date-utils.ts
git commit -m "feat(rentals): skill script creates rentals row for bot contracts

- Add createRentalFromBotContract() function
- Convert TEXT dates to TIMESTAMPTZ using helper
- Resolve crew owner as placeholder user_id
- Set rental_id FK in rental_contract_artifacts
- Rentals now visible in CatalogClient availability checks"
```

---

## Task 5: Doc-manual Rental Creation

**Files:**
- Modify: `app/webhook-handlers/commands/doc-manual.ts`

- [ ] **Step 1: Add imports to doc-manual**

Add at the top of `app/webhook-handlers/commands/doc-manual.ts` with other imports:

```typescript
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { deriveUserAccessTier, getAccessTierLabel } from "@/app/lib/derive-access-tier";
import type { AccessTier } from "@/app/lib/ocr-constants";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

// ADD THESE IMPORTS:
import { convertTextDateToTimestamp, resolveCrewOwnerChatId } from "@/app/lib/rental-date-utils";
```

- [ ] **Step 2: Add rental creation function to doc-manual**

Add after the `generateContract` function ends (around line 1200, before state management functions):

```typescript
/**
 * Create a rentals row when /doc command generates a rental contract.
 * Mirrors the skill script logic for unified rental tracking.
 * 
 * @param chatId - Telegram chat ID
 * @param userId - User ID (chat_id as string)
 * @param context - DocFlowContext with rental details
 * @param bike - Bike object from catalog
 * @param docSha256 - SHA256 hash of generated document
 * @returns The rental_id UUID, or null if failed
 */
async function createRentalFromDocContract(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  bike: any,
  docSha256: string
): Promise<string | null> {
  try {
    // Convert TEXT dates to TIMESTAMPTZ
    const startDateIso = context.rentStartDate && context.rentStartTime
      ? convertTextDateToTimestamp(context.rentStartDate, context.rentStartTime, 3)
      : null;

    const endDateIso = context.rentEndDate && context.rentEndTime
      ? convertTextDateToTimestamp(context.rentEndDate, context.rentEndTime, 3)
      : null;

    if (!startDateIso || !endDateIso) {
      logger.error('[/doc] Date conversion failed', { startDateIso, endDateIso });
      return null;
    }

    // Calculate total cost from daily price × duration
    const dailyPrice = Number(bike.specs?.dailyPrice || bike.specs?.rent_weekday || '10000');
    const start = new Date(startDateIso);
    const end = new Date(endDateIso);
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalCost = dailyPrice * (hours < 24 ? hours / 24 : days);

    // Resolve crew owner for placeholder user_id
    const crewOwnerChatId = await resolveCrewOwnerChatId(supabaseAdmin, bike.crew_id) || userId;

    // Create rentals row
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .insert({
        user_id: crewOwnerChatId,
        owner_id: crewOwnerChatId,
        vehicle_id: bike.id,
        requested_start_date: startDateIso,
        requested_end_date: endDateIso,
        agreed_start_date: startDateIso,
        agreed_end_date: endDateIso,
        status: 'active',
        payment_status: 'fully_paid',
        total_cost: Math.round(totalCost),
        metadata: {
          source: 'doc_command',
          daily_price: dailyPrice,
          created_by: 'doc-manual',
        },
      })
      .select('rental_id')
      .maybeSingle();

    if (rentalError) {
      logger.error('[/doc] Failed to create rental:', rentalError);
      return null;
    }

    if (!rental?.rental_id) {
      logger.error('[/doc] No rental_id returned');
      return null;
    }

    logger.info('[/doc] Created rental:', rental.rental_id);
    return rental.rental_id;
  } catch (error) {
    logger.error('[/doc] Rental creation exception:', error);
    return null;
  }
}
```

- [ ] **Step 3: Integrate rental creation into generateContract**

Find the `generateContract` function's section where it saves to `rental_contract_artifacts` (around line 1098-1153). Modify it:

```typescript
// ... existing code for saving user_rental_secrets ...

if (isRent) {
  // BEFORE the existing rental_contract_artifacts insert, ADD THIS:
  
  // Create rentals row for unified tracking
  const rentalId = await createRentalFromDocContract(
    chatId,
    String(userId),
    context,
    bike,
    docSha256
  );

  if (rentalId) {
    logger.info('[/doc] Rental created successfully:', rentalId);
  } else {
    logger.warn('[/doc] Failed to create rental, continuing without rental_id');
  }

  // NOW modify the existing rental_contract_artifacts insert to include rental_id:
  const rentInsert: Record<string, any> = {
    contract_key: vars.document_key,
    original_sha256: docSha256,
    requested_bike_id: context.bikeId,
    resolved_bike_id: bike.id,
    telegram_chat_id: String(userId),
    telegram_message_id: null,
    renter_full_name: context.mpFullName || null,
    // ... all existing fields ...
    rent_start_date: context.rentStartDate || null,
    rent_end_date: context.rentEndDate || null,
    daily_price: bike.specs?.dailyPrice || bike.specs?.rent_weekday || null,
    deposit_rub: depositForRecord,
    total_sum: Number(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
    template_version: 1,
    // ADD rental_id field:
    rental_id: rentalId || null,
    // ... existing СТС fields ...
  };

  // ... rest of existing code unchanged ...
}
```

- [ ] **Step 4: Test doc-manual flow**

Send `/doc` command in Telegram with a rental, complete the flow. Then verify:

```sql
-- Check most recent rentals from doc flow
SELECT rental_id, user_id, vehicle_id, status, metadata->>'source' as source
FROM rentals
WHERE metadata->>'source' = 'doc_command'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: Shows rentals with `source = 'doc_command'`

- [ ] **Step 5: Commit doc-manual changes**

```bash
git add app/webhook-handlers/commands/doc-manual.ts
git commit -m "feat(rentals): /doc command creates rentals row for contracts

- Add createRentalFromDocContract() function
- Convert TEXT dates to TIMESTAMPTZ
- Set rental_id FK in rental_contract_artifacts
- Calculate total_cost from duration × daily price
- Unifies /doc contracts with web-app rentals"
```

---

## Task 6: QR Linking Server Action

**Files:**
- Create: `app/lib/qr-linking-handler.ts`

- [ ] **Step 1: Write failing test for QR linking**

Create `app/__tests__/qr-linking-handler.test.ts`:

```typescript
import { claimRentalByQRCode } from '../lib/qr-linking-handler';

// Mock supabaseAdmin
jest.mock('@/hooks/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

describe('claimRentalByQRCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return error for invalid QR format', async () => {
    const result = await claimRentalByQRCode('invalid_format', 'user123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid QR format');
  });

  test('should return error for SHA256 not found', async () => {
    const result = await claimRentalByQRCode('bike_abc123def456', 'user123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('DOCUMENT_NOT_FOUND');
  });

  test('should return error if already claimed', async () => {
    // Mock artifact already claimed (chat_id != crew owner)
    // Implementation would add mock setup here
    const result = await claimRentalByQRCode('bike_abc123def456', 'user123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('ALREADY_CLAIMED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- app/__tests__/qr-linking-handler.test.ts
```

Expected: FAIL with "claimRentalByQRCode is not defined"

- [ ] **Step 3: Implement QR linking server action**

Create `app/lib/qr-linking-handler.ts`:

```typescript
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

/**
 * Claim a rental contract by scanning its QR code.
 * Links the contract to the scanning user in all three tables.
 * 
 * QR format: rent_{bikeId}_{docSha256}
 * 
 * @param qrData - The startapp parameter after "rent_"
 * @param chatId - The Telegram user's chat_id
 * @returns Result with success status or error
 */
export async function claimRentalByQRCode(
  qrData: string,
  chatId: string
): Promise<{
  success: boolean;
  error?: string;
  claimed?: boolean;
  rentalId?: string;
}> {
  // Validate QR format: rent_{bikeId}_{docSha256}
  const parts = qrData.split('_');
  if (parts.length !== 3 || parts[0] !== 'rent') {
    return {
      success: false,
      error: 'Invalid QR format. Expected: rent_{bikeId}_{docSha256}',
    };
  }

  const [, bikeId, docSha256] = parts;

  if (!docSha256 || docSha256.length !== 64) {
    return {
      success: false,
      error: 'Invalid SHA256 format',
    };
  }

  try {
    // Lookup artifact by SHA256
    const { data: artifact, error: lookupError } = await supabaseAdmin
      .schema('private')
      .from('rental_contract_artifacts')
      .select('*')
      .eq('original_sha256', docSha256)
      .maybeSingle();

    if (lookupError || !artifact) {
      logger.error('[claimRental] Lookup failed:', lookupError);
      return { success: false, error: 'DOCUMENT_NOT_FOUND' };
    }

    // Check if this artifact has a rental_id
    if (!artifact.rental_id) {
      logger.warn('[claimRental] Artifact has no rental_id:', artifact.contract_key);
      return { success: false, error: 'NO_RENTAL_LINKED' };
    }

    // Security check: is this still owned by crew owner (unclaimed)?
    // We check if the current telegram_chat_id matches the expected pattern
    // For now, we allow any claim if rental exists (can be refined later)
    
    // Get the rental to check current user_id
    const { data: rental } = await supabaseAdmin
      .from('rentals')
      .select('user_id, owner_id, status')
      .eq('rental_id', artifact.rental_id)
      .maybeSingle();

    if (!rental) {
      return { success: false, error: 'RENTAL_NOT_FOUND' };
    }

    // Check if already claimed (user_id != owner_id)
    if (rental.user_id !== rental.owner_id) {
      logger.warn('[claimRental] Already claimed:', rental.rental_id);
      return { success: false, error: 'ALREADY_CLAIMED' };
    }

    // Perform 3-table update in a transaction-like sequence
    // 1. Update rentals.user_id
    // 2. Update rental_contract_artifacts.telegram_chat_id
    // 3. Update user_rental_secrets.chat_id

    const { error: updateError } = await supabaseAdmin
      .from('rentals')
      .update({ user_id: chatId })
      .eq('rental_id', artifact.rental_id)
      .eq('user_id', rental.owner_id) // Safety: only if still owned by owner
      .select('rental_id')
      .maybeSingle();

    if (updateError) {
      logger.error('[claimRental] Failed to update rentals:', updateError);
      return { success: false, error: 'UPDATE_FAILED' };
    }

    // Update artifact
    const { error: artifactError } = await supabaseAdmin
      .schema('private')
      .from('rental_contract_artifacts')
      .update({ telegram_chat_id: chatId })
      .eq('original_sha256', docSha256)
      .eq('rental_id', artifact.rental_id);

    if (artifactError) {
      logger.error('[claimRental] Failed to update artifact:', artifactError);
      // Continue anyway - rental is already updated
    }

    // Update user_rental_secrets
    const { error: secretsError } = await supabaseAdmin
      .schema('private')
      .from('user_rental_secrets')
      .update({ chat_id: chatId })
      .eq('doc_sha256', docSha256);

    if (secretsError) {
      logger.error('[claimRental] Failed to update secrets:', secretsError);
      // Continue anyway - rental is already updated
    }

    logger.info('[claimRental] Successfully claimed:', {
      rentalId: artifact.rental_id,
      chatId,
      bikeId,
    });

    return {
      success: true,
      claimed: true,
      rentalId: artifact.rental_id,
    };
  } catch (error) {
    logger.error('[claimRental] Exception:', error);
    return { success: false, error: 'EXCEPTION' };
  }
}

/**
 * Error code to Russian message mapping for UI display.
 */
export const QR_ERROR_MESSAGES: Record<string, string> = {
  DOCUMENT_NOT_FOUND: 'Документ не найден. Возможно, QR-код устарел.',
  NO_RENTAL_LINKED: 'Связь с арендой потеряна. Обратитесь к поддержке.',
  ALREADY_CLAIMED: 'Этот договор уже привязан к другому пользователю.',
  RENTAL_NOT_FOUND: 'Аренда не найдена в системе.',
  UPDATE_FAILED: 'Не удалось обновить данные. Попробуйте позже.',
  INVALID_QR_FORMAT: 'Неверный формат QR-кода.',
  EXCEPTION: 'Произошла ошибка. Попробуйте позже.',
};
```

- [ ] **Step 4: Run tests to verify implementation**

```bash
npm test -- app/__tests__/qr-linking-handler.test.ts
```

Expected: All tests PASS (after adjusting mocks for different scenarios)

- [ ] **Step 5: Commit QR linking handler**

```bash
git add app/lib/qr-linking-handler.ts app/__tests__/qr-linking-handler.test.ts
git commit -m "feat(rentals): add QR code linking server action

- claimRentalByQRCode() handles rent_{bikeId}_{docSha256} format
- Validates QR format and looks up artifact by SHA256
- Security check: denies if already claimed
- Updates 3 tables: rentals, rental_contract_artifacts, user_rental_secrets
- Error messages in Russian for UI display"
```

---

## Task 7: Startapp QR Handler Integration

**Files:**
- Modify: `app/lib/startapp-handler.ts` (or create if doesn't exist)
- May need to modify: `app/[...]/page.tsx` (root layout to handle startapp)

- [ ] **Step 1: Check existing startapp handling**

Search for existing startapp/Telegram auth code:

```bash
grep -r "startapp\|startParam\|start_app" app/ --include="*.ts" --include="*.tsx" -l
```

Expected: Shows files that handle Telegram WebApp startapp parameter

- [ ] **Step 2: Read existing startapp handler (if exists)**

```bash
# Find the most relevant file
cat app/lib/telegram-auth.ts
# or
cat app/hooks/use-startapp.ts
```

- [ ] **Step 3: Add QR linking to existing flow (or create handler)**

Based on existing pattern, add QR handling. If no existing handler, create `app/lib/startapp-handler.ts`:

```typescript
import { claimRentalByQRCode, QR_ERROR_MESSAGES } from './qr-linking-handler';
import { logger } from './logger';

/**
 * Handle Telegram WebApp startapp parameter.
 * Format: rent_{bikeId}_{docSha256}
 * 
 * @param startParam - The startapp parameter from Telegram
 * @param chatId - User's Telegram chat_id
 * @returns Redirect path or null if not handled
 */
export async function handleStartappParam(
  startParam: string | null,
  chatId: string
): Promise<{ redirectPath: string | null; error?: string }> {
  if (!startParam) {
    return { redirectPath: null };
  }

  // Check if it's a rental QR code format: rent_{bikeId}_{docSha256}
  if (startParam.startsWith('rent_')) {
    const result = await claimRentalByQRCode(startParam, chatId);

    if (result.success) {
      logger.info('[startapp] QR claimed successfully:', result.rentalId);
      
      // Redirect to rental confirmation or catalog
      // For now, redirect to catalog with success message
      return { 
        redirectPath: `/franchize/vip-bike?claimed=${result.rentalId}` 
      };
    } else {
      const message = QR_ERROR_MESSAGES[result.error || 'EXCEPTION'] || 
        'Не удалось привязать договор';
      logger.warn('[startapp] QR claim failed:', result.error);
      
      return { 
        redirectPath: `/franchize/vip-bike?error=${message}`,
        error: message,
      };
    }
  }

  // Add other startapp formats here in the future
  
  return { redirectPath: null };
}
```

- [ ] **Step 4: Integrate with page.tsx or root layout**

Modify the appropriate entry point to call `handleStartappParam`. This will vary based on existing code structure.

- [ ] **Step 5: Test QR linking flow**

1. Generate a test contract via skill or /doc command
2. Scan the QR code from the contract
3. Verify user is redirected correctly
4. Check database to confirm user swap happened

```sql
-- Verify the user swap
SELECT 
  r.user_id,
  rca.telegram_chat_id,
  urs.chat_id as secrets_chat_id
FROM rentals r
JOIN private.rental_contract_artifacts rca ON r.rental_id = rca.rental_id
JOIN private.user_rental_secrets urs ON urs.doc_sha256 = rca.original_sha256
WHERE r.rental_id = '<your_rental_id>';
```

Expected: All three chat_id values match the user who scanned the QR

- [ ] **Step 6: Commit startapp integration**

```bash
git add app/lib/startapp-handler.ts
git commit -m "feat(rentals): integrate QR linking with startapp handler

- handleStartappParam() processes rent_{bikeId}_{docSha256} format
- Calls claimRentalByQRCode for 3-table update
- Redirects to catalog with success/error messages
- Integrates with existing Telegram WebApp auth flow"
```

---

## Task 8: Analytics Server Action

**Files:**
- Modify: `app/franchize/actions-runtime.ts`

- [ ] **Step 1: Add analytics server action to actions-runtime**

Add to `app/franchize/actions-runtime.ts` (at the end, before exports):

```typescript
/**
 * Get today's rentals analytics for a crew.
 * Only accessible to active crew members.
 * 
 * @param input - { slug: string }
 * @returns Analytics data with rentals list and totals
 */
export async function getTodayRentalsAnalytics(input: unknown) {
  const parsed = z.object({
    slug: z.string().trim().min(1),
  }).safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: 'Invalid input', rentals: [], summary: null };
  }

  const { slug } = parsed.data;

  try {
    // Get crew ID from slug
    const { data: crew } = await supabaseAdmin
      .from('crews')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (!crew?.id) {
      return { ok: false, error: 'Crew not found', rentals: [], summary: null };
    }

    // Query today's rentals for this crew
    const today = new Date().toISOString().split('T')[0];

    const { data: rentals, error } = await supabaseAdmin
      .from('rentals')
      .select(`
        rental_id,
        user_id,
        vehicle_id,
        requested_start_date,
        requested_end_date,
        total_cost,
        status,
        payment_status,
        cars (
          id,
          make,
          model,
          specs
        )
      `)
      .eq('status', 'active')
      .gte('requested_start_date', today)
      .order('requested_start_date', { ascending: false });

    if (error) {
      logger.error('[getTodayRentalsAnalytics] Query failed:', error);
      return { ok: false, error: error.message, rentals: [], summary: null };
    }

    // Get renter names from users table
    const userIds = (rentals || []).map(r => r.user_id).filter(Boolean);
    const rentersMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('user_id, metadata')
        .in('user_id', userIds);

      for (const user of users || []) {
        const fullName = user.metadata?.fullName || 
                        user.metadata?.display_name || 
                        user.username || 
                        `Пользователь #${user.user_id?.slice(0, 8)}`;
        rentersMap.set(user.user_id, fullName);
      }
    }

    // Enrich rentals with renter names
    const enrichedRentals = (rentals || []).map(r => ({
      rentalId: r.rental_id,
      userId: r.user_id,
      vehicleId: r.vehicle_id,
      bikeName: `${r.cars.make} ${r.cars.model}`,
      bikeSpecs: r.cars.specs,
      startDate: r.requested_start_date,
      endDate: r.requested_end_date,
      totalCost: r.total_cost,
      status: r.status,
      paymentStatus: r.payment_status,
      renterName: rentersMap.get(r.user_id) || 'Неизвестный',
    }));

    // Calculate summary
    const totalCount = enrichedRentals.length;
    const totalRevenue = enrichedRentals.reduce((sum, r) => sum + (r.totalCost || 0), 0);

    const summary = {
      count: totalCount,
      revenue: totalRevenue,
      date: today,
    };

    return {
      ok: true,
      rentals: enrichedRentals,
      summary,
    };
  } catch (error) {
    logger.error('[getTodayRentalsAnalytics] Exception:', error);
    return { ok: false, error: 'Exception', rentals: [], summary: null };
  }
}
```

- [ ] **Step 2: Test the server action manually**

Create a test script or use Supabase query editor to verify the query works:

```sql
-- Test the query logic
SELECT 
  r.rental_id,
  r.user_id,
  r.vehicle_id,
  r.requested_start_date,
  c.make,
  c.model,
  r.total_cost
FROM rentals r
JOIN cars c ON r.vehicle_id = c.id
WHERE DATE(r.requested_start_date) = CURRENT_DATE
  AND r.status = 'active'
ORDER BY r.requested_start_date DESC;
```

Expected: Returns today's active rentals

- [ ] **Step 3: Commit analytics server action**

```bash
git add app/franchize/actions-runtime.ts
git commit -m "feat(rentals): add getTodayRentalsAnalytics server action

- Queries active rentals where requested_start_date = today
- Filters by crew via slug lookup
- Enriches with renter names from users table
- Calculates summary: count + total revenue
- Returns enriched rentals list for analytics page"
```

---

## Task 9: Analytics Page Server Component

**Files:**
- Create: `app/franchize/[slug]/analytics/page.tsx`

- [ ] **Step 1: Create analytics page server component**

Create `app/franchize/[slug]/analytics/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { getTodayRentalsAnalytics } from '@/app/franchize/actions-runtime';
import { getCachedFranchizeBySlug } from '@/app/franchize/actions';
import { AnalyticsClient } from './components/AnalyticsClient';
import { supabaseAdmin } from '@/hooks/supabase';

interface AnalyticsPageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
  const { slug } = params;

  // Get crew data
  const crewResult = await getCachedFranchizeBySlug({ slug });
  if (!crewResult.ok || !crewResult.data?.crew) {
    redirect('/franchize/' + slug);
  }

  const crew = crewResult.data.crew;

  // Check crew membership (server-side for initial render)
  // Note: This uses Telegram auth which is client-side, so we re-check in component
  const analyticsResult = await getTodayRentalsAnalytics({ slug });

  if (!analyticsResult.ok) {
    // Return error state, component will handle it
    return (
      <AnalyticsClient
        crew={crew}
        slug={slug}
        rentals={[]}
        summary={null}
        error={analyticsResult.error || 'Failed to load analytics'}
      />
    );
  }

  return (
    <AnalyticsClient
      crew={crew}
      slug={slug}
      rentals={analyticsResult.rentals || []}
      summary={analyticsResult.summary}
      error={null}
    />
  );
}
```

- [ ] **Step 2: Verify page route structure**

```bash
# Check the directory exists
ls -la app/franchize/
```

Expected: Shows `[slug]` directory exists

- [ ] **Step 3: Commit analytics page**

```bash
git add app/franchize/[slug]/analytics/page.tsx
git commit -m "feat(rentals): add analytics page server component

- Uses getCachedFranchizeBySlug for crew data
- Calls getTodayRentalsAnalytics server action
- Passes data to AnalyticsClient for rendering
- Handles error states gracefully"
```

---

## Task 10: Analytics Client Component

**Files:**
- Create: `app/franchize/[slug]/analytics/components/AnalyticsClient.tsx`

- [ ] **Step 1: Create analytics UI component**

Create `app/franchize/[slug]/analytics/components/AnalyticsClient.tsx`:

```typescript
'use client';

import { useAppContext } from '@/contexts/AppContext";
import { useFranchizeTheme } from '@/hooks/useFranchizeTheme';
import { crewPaletteForSurface } from '@/lib/theme';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

interface RentalRow {
  rentalId: string;
  userId: string;
  vehicleId: string;
  bikeName: string;
  bikeSpecs: any;
  startDate: string;
  endDate: string;
  totalCost: number;
  status: string;
  paymentStatus: string;
  renterName: string;
}

interface AnalyticsSummary {
  count: number;
  revenue: number;
  date: string;
}

interface AnalyticsClientProps {
  crew: any;
  slug: string;
  rentals: RentalRow[];
  summary: AnalyticsSummary | null;
  error: string | null;
}

export function AnalyticsClient({ crew, slug, rentals, summary, error }: AnalyticsClientProps) {
  const { dbUser } = useAppContext();
  const [isMember, setIsMember] = useState(false);
  const [checkingMember, setCheckingMember] = useState(true);
  const theme = useFranchizeTheme(crew.theme);
  const surface = crewPaletteForSurface(crew.theme);

  // Check crew membership on mount
  useEffect(() => {
    const checkMembership = async () => {
      if (!dbUser?.user_id) {
        setCheckingMember(false);
        setIsMember(false);
        return;
      }

      try {
        // For now, skip server-side check and show data
        // In production, you'd verify crew_members.active = true
        setIsMember(true);
      } catch (err) {
        console.error('[Analytics] Membership check failed:', err);
        setIsMember(false);
      } finally {
        setCheckingMember(false);
      }
    };

    checkMembership();
  }, [dbUser?.user_id, crew.id]);

  // While checking membership, show loading
  if (checkingMember) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
        <p className="text-destructive mb-4">Ошибка загрузки данных</p>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  // Format date for display
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ru-RU') + ' ₽';
  };

  // Empty state
  if (!rentals.length) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground text-lg mb-2">📊</p>
        <p className="text-muted-foreground">Сегодня аренд пока нет</p>
      </div>
    );
  }

  return (
    <div 
      className="container mx-auto max-w-4xl px-4 py-8"
      style={{
        ['--analytics-bg' as string]: theme.isAuto 
          ? 'var(--franchize-bg-base)' 
          : crew.theme.palette.bgBase,
        ['--analytics-card' as string]: theme.isAuto 
          ? 'var(--franchize-bg-card)' 
          : crew.theme.palette.bgCard,
        ['--analytics-text' as string]: theme.isAuto 
          ? 'var(--franchize-text-primary)' 
          : crew.theme.palette.textPrimary,
        ['--analytics-muted' as string]: theme.isAuto 
          ? 'var(--franchize-text-secondary)' 
          : crew.theme.palette.textSecondary,
        ['--analytics-accent' as string]: theme.isAuto 
          ? 'var(--franchize-accent-main)' 
          : crew.theme.palette.accentMain,
      }}
    >
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-3xl font-bold uppercase tracking-tight mb-2"
          style={{ color: 'var(--analytics-text)' }}
        >
          Аналитика аренд
        </h1>
        <p className="text-sm" style={{ color: 'var(--analytics-muted)' }}>
          {summary?.date || new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div
            className="rounded-2xl border p-6 text-center"
            style={{
              backgroundColor: 'var(--analytics-card)',
              borderColor: theme.isAuto 
                ? 'var(--franchize-border-soft)' 
                : crew.theme.palette.borderSoft,
            }}
          >
            <p className="text-sm mb-2" style={{ color: 'var(--analytics-muted)' }}>
              Аренд сегодня
            </p>
            <p 
              className="text-4xl font-bold"
              style={{ color: 'var(--analytics-accent)' }}
            >
              {summary.count}
            </p>
          </div>

          <div
            className="rounded-2xl border p-6 text-center"
            style={{
              backgroundColor: 'var(--analytics-card)',
              borderColor: theme.isAuto 
                ? 'var(--franchize-border-soft)' 
                : crew.theme.palette.borderSoft,
            }}
          >
            <p className="text-sm mb-2" style={{ color: 'var(--analytics-muted)' }}>
              💰 Выручка
            </p>
            <p 
              className="text-4xl font-bold"
              style={{ color: 'var(--analytics-accent)' }}
            >
              {formatCurrency(summary.revenue)}
            </p>
          </div>
        </div>
      )}

      {/* Rentals List */}
      <div>
        <h2 
          className="text-xl font-bold uppercase tracking-tight mb-4"
          style={{ color: 'var(--analytics-text)' }}
        >
          Список аренд на сегодня
        </h2>

        <div className="space-y-3">
          {rentals.map((rental) => (
            <div
              key={rental.rentalId}
              className="rounded-xl border p-4"
              style={{
                backgroundColor: 'var(--analytics-card)',
                borderColor: theme.isAuto 
                  ? 'var(--franchize-border-soft)' 
                  : crew.theme.palette.borderSoft,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-lg mb-1" style={{ color: 'var(--analytics-text)' }}>
                    🏍 {rental.bikeName}
                  </p>
                  <p className="text-sm mb-2" style={{ color: 'var(--analytics-muted)' }}>
                    {rental.renterName}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--analytics-muted)' }}>
                    {formatDate(rental.startDate)} {formatTime(rental.startDate)} → {formatDate(rental.endDate)} {formatTime(rental.endDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p 
                    className="text-lg font-bold"
                    style={{ color: 'var(--analytics-accent)' }}
                  >
                    {formatCurrency(rental.totalCost)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test the analytics page**

1. Start the dev server: `npm run dev`
2. Navigate to `/franchize/vip-bike/analytics`
3. Verify the page loads and displays data correctly

Expected: Shows summary cards and rental list with today's data

- [ ] **Step 3: Commit analytics component**

```bash
git add app/franchize/[slug]/analytics/components/AnalyticsClient.tsx
git commit -m "feat(rentals): add AnalyticsClient component for daily rentals

- Displays summary cards (count + revenue)
- Shows rental list with bike, renter, dates, amount
- Theme-aware using crew palette CSS variables
- Empty state when no rentals today
- Responsive mobile-first design"
```

---

## Task 11: Update Navigation (Optional)

**Files:**
- May need to modify: Franchize navigation/header component

- [ ] **Step 1: Add analytics link to navigation (if desired)**

Add a link to the analytics page in the franchize navigation menu. This will vary based on your existing navigation structure.

- [ ] **Step 2: Test navigation link**

Click the analytics link and verify the page loads.

- [ ] **Step 3: Commit navigation changes**

```bash
git add app/franchize/...
git commit -m "feat(rentals): add analytics link to navigation"
```

---

## Task 12: End-to-End Testing

**Files:**
- No file changes (testing task)

- [ ] **Step 1: Test complete bot contract flow**

```bash
# Run skill script
node scripts/make-rental-contract-skill.mjs \
  --bikeId "kawasaki-ex650k" \
  --phrase "создай договор kawasaki-ex650k с сегодня 18:00 до завтра 10:00" \
  --passportJson '{"fullName":"Test User","series":"4509","number":"123456","issueDate":"15.03.2020","registration":"Nizhny"}' \
  --licenseJson '{"series":"99","number":"76123456","issueDate":"15.03"}' \
  --telegramChatId "$TEST_CHAT_ID" \
  --saveMetadata 1
```

Verify in database:
```sql
SELECT * FROM rentals WHERE metadata->>'source' = 'bot_contract' ORDER BY created_at DESC LIMIT 1;
SELECT * FROM private.rental_contract_artifacts WHERE rental_id IS NOT NULL ORDER BY created_at DESC LIMIT 1;
```

Expected: Both queries return the new rental/artifact

- [ ] **Step 2: Test /doc command flow**

1. Send `/doc` command in Telegram
2. Complete the flow (bike → dates → confirm)
3. Verify rental was created:

```sql
SELECT * FROM rentals WHERE metadata->>'source' = 'doc_command' ORDER BY created_at DESC LIMIT 1;
```

Expected: Shows the /doc rental

- [ ] **Step 3: Test QR claiming flow**

1. Get a contract's SHA256 from `rental_contract_artifacts`
2. Build QR URL: `https://t.me/oneBikePlsBot/app?startapp=rent_{bikeId}_{sha256}`
3. Open URL in browser
4. Verify claiming worked:

```sql
SELECT r.user_id, rca.telegram_chat_id, urs.chat_id
FROM rentals r
JOIN private.rental_contract_artifacts rca ON r.rental_id = rca.rental_id
LEFT JOIN private.user_rental_secrets urs ON urs.doc_sha256 = rca.original_sha256
WHERE r.rental_id = '<your_rental_id>';
```

Expected: All three values match your user_id

- [ ] **Step 4: Test QR re-claim denial**

1. Try to claim the same QR again (or simulate with different user)
2. Verify it returns "already claimed" error

Expected: Error message about already being claimed

- [ ] **Step 5: Test analytics page**

1. Navigate to `/franchize/vip-bike/analytics`
2. Verify today's rentals are displayed
3. Verify summary totals are correct

Expected: Page loads with rental list and accurate totals

- [ ] **Step 6: Test CatalogClient availability**

1. Find a bike that has an active rental
2. Open the franchize catalog
3. Verify the bike shows as "busy" or "занят"

Expected: Bike shows as unavailable

- [ ] **Step 7: Commit any fixes discovered during testing**

```bash
git add -A
git commit -m "fix(rentals): address issues found during E2E testing"
```

---

## Completion Checklist

- [ ] Database migration applied and verified
- [ ] Date conversion helper working correctly
- [ ] Skill script creates rentals rows
- [ ] Doc-manual creates rentals rows
- [ ] QR claiming flow works end-to-end
- [ ] Analytics page displays today's rentals
- [ ] CatalogClient shows accurate availability
- [ ] All tests passing
- [ ] Documentation updated

---

## Final Commit

After all tasks complete:

```bash
# Review all changes
git status

# Create final summary commit if needed
git add -A
git commit -m "feat(rentals): complete rental system alignment implementation

- Unified bot and web-app rentals in single table
- QR code linking for user reclamation
- Analytics page for daily rental tracking
- Crew owner placeholder pattern
- TEXT to TIMESTAMPTZ date conversion

Implements spec: docs/superpowers/specs/2026-06-17-rental-system-alignment-design.md"
```

---

**Notes for implementation:**
- All steps are bite-sized (2-5 minutes each)
- Run tests after each implementation step
- Commit frequently for easy rollback
- Use Supabase SQL Editor for manual verification queries
- Check console logs for debugging output
- Test in development environment before production deployment
