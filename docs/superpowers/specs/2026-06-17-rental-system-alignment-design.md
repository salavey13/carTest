# Rental System Alignment Design

**Date:** 2026-06-17
**Status:** Approved
**Next:** Implementation planning

---

## Overview

Unify bot-generated rental contracts (`private.rental_contract_artifacts`) with web-app rentals (`public.rentals`) into a single coherent system. Enable QR code linking for user reclamation, and provide crew analytics for daily rental tracking.

---

## Problem Statement

**Current state:**
- Two separate rental systems operating independently:
  - `private.rental_contract_artifacts` — bot-generated contracts via `/doc` command or skill script
  - `public.rentals` — web-app checkout flow
- `CatalogClient` only queries `rentals` for availability, missing bot contracts
- Multi-day bot contracts aren't tracked in availability system
- No unified view of "currently rented" bikes
- User rental data saved in `user_rental_secrets` but not linked to active rentals

**Goals:**
1. Unify rental tracking in `rentals` table
2. Enable one-click next rent via QR code
3. Provide crew analytics for daily rentals
4. Maintain compatibility with existing flows

---

## Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BOT CREATES CONTRACT                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Skill or /doc command receives rental request                  │
│     ├─ Extract dates: TEXT DD.MM.YYYY + HH:MM                       │
│     ├─ Resolve bike from catalog                                   │
│     └─ Resolve crew owner from bike.crew_id                        │
│                                                                      │
│  2. Create rentals row FIRST (get UUID)                            │
│     ├─ user_id = crew_owner_chat_id (placeholder)                   │
│     ├─ owner_id = crew_owner_chat_id                                │
│     ├─ vehicle_id = bike.id                                         │
│     ├─ requested_start_date = TEXT → TIMESTAMPTZ                    │
│     ├─ requested_end_date = TEXT → TIMESTAMPTZ                      │
│     ├─ status = 'active'                                            │
│     ├─ payment_status = 'fully_paid'                                │
│     └─ total_cost = calculated from daily_price × days             │
│                                                                      │
│  3. Insert rental_contract_artifacts with rental_id                  │
│     ├─ rental_id = UUID from step 2 (FK reference)                 │
│     ├─ telegram_chat_id = crew_owner_chat_id (placeholder)          │
│     └─ All contract metadata, SHA256, etc.                         │
│                                                                      │
│  4. Insert user_rental_secrets (chat_id = NULL until claim)        │
│     └─ All renter identity data for future 1-click reuse           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      USER SCANS QR CODE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. QR URL: rent_{bikeId}_{docSha256}                             │
│     └─ User opens WebApp, Telegram auth auto-creates user row      │
│                                                                      │
│  2. Lookup rental_contract_artifacts by SHA256                      │
│                                                                      │
│  3. Security check: telegram_chat_id == crew_owner? (unclaimed)    │
│     ├─ If YES → allow claim                                          │
│     └─ If NO → deny (already claimed)                               │
│                                                                      │
│  4. Swap user in all three tables:                                   │
│     ├─ rentals.user_id = real_user_chat_id                         │
│     ├─ rental_contract_artifacts.telegram_chat_id = real_user      │
│     └─ user_rental_secrets.chat_id = real_user (claim secret)      │
│                                                                      │
│  5. Redirect to success/rental detail page                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      AVAILABILITY & ANALYTICS                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CatalogClient availability check                                    │
│  └─ Queries rentals table (already works, no changes needed)       │
│                                                                      │
│  Analytics page                                                      │
│  └─ Query rentals where requested_start_date = today               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Rentals first, then artifact** — Create `rentals` row, get UUID, then create artifact with FK
2. **Crew owner as placeholder** — Uses existing crew_members table, gives owner visibility
3. **One-time QR claim** — After claiming, `telegram_chat_id` is set, prevents re-claiming
4. **Open claiming** — Any user can claim (no crew membership required for QR)
5. **Date conversion at source** — TEXT DD.MM.YYYY → TIMESTAMPTZ happens in skill/doc-manual
6. **Fallback-safe** — If artifact creation fails, rentals row remains (bike shows busy, which is correct)

---

## Database Schema

### New Column

```sql
-- Add rental_id FK to private.rental_contract_artifacts
ALTER TABLE private.rental_contract_artifacts
ADD COLUMN rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL;

-- Index for lookups (partial index for efficiency)
CREATE INDEX idx_rental_contract_artifacts_rental_id
ON private.rental_contract_artifacts(rental_id)
WHERE rental_id IS NOT NULL;
```

**Why `ON DELETE SET NULL`:**
- If `rentals` row is deleted, keep artifact record but nullify the FK
- Maintains audit trail even if rental is removed

**Why partial index:**
- Only rows with `rental_id` need indexing
- NULL values are rare/unused

### No Other Schema Changes Needed

- `rentals` table already has all required columns
- `user_rental_secrets` already has `chat_id` (NULLable by design)
- `rental_contract_artifacts` already has `telegram_chat_id` (TEXT, no FK)

---

## Date Handling

### Challenge

Three systems with different date formats:

| System | Start Date | End Date | Format |
|--------|-----------|----------|--------|
| Skill | `rent_start_date` (TEXT) | `rent_end_date` (TEXT) | DD.MM.YYYY |
| Doc-manual | `context.rentStartDate` (TEXT) | `context.rentEndDate` (TEXT) | DD.MM.YYYY |
| Web-app | `requested_start_date` (TIMESTAMPTZ) | `requested_end_date` (TIMESTAMPTZ) | ISO timestamp |

### Solution

**All three use TEXT DD.MM.YYYY!** The conversion is identical for skill + doc-manual.

**Helper function:**
```typescript
function convertTextDateToTimestamp(
  dateText: string,    // "17.06.2026"
  timeText: string,    // "18:00"
  timezoneOffset: number = 3  // Moscow UTC+3
): string {
  // Parse DD.MM.YYYY
  const [d, m, y] = dateText.split('.');
  const [hh, mm] = timeText.split(':');
  
  // Create date in local timezone
  const localDate = new Date(
    parseInt(y), 
    parseInt(m) - 1, 
    parseInt(d), 
    parseInt(hh), 
    parseInt(mm)
  );
  
  // Convert to ISO (assumes input is Moscow time UTC+3)
  const utcDate = new Date(localDate.getTime() - timezoneOffset * 60 * 60 * 1000);
  
  return utcDate.toISOString();
}
```

**Example:**
- Input: `date = "17.06.2026"`, `time = "18:00"`
- Output: `"2026-06-17T15:00:00.000Z"`

**Timezone assumption:** Local time = Moscow time (UTC+3)

---

## QR Code Linking Flow

### QR URL Format

```
https://t.me/oneBikePlsBot/app?startapp=rent_{bikeId}_{docSha256}
```

**Example:**
```
https://t.me/oneBikePlsBot/app?startapp=rent_kawasaki-ex650k_abc123def456...
```

### Linking Steps

```
1. User scans QR → WebApp opens with startParam
   └─ Telegram auth happens automatically
   └─ User row created if doesn't exist (users table)

2. Parse startParam: rent_{bikeId}_{docSha256}
   └─ Extract bikeId and SHA256 hash

3. Lookup rental_contract_artifacts by original_sha256
   └─ SELECT * FROM private.rental_contract_artifacts 
      WHERE original_sha256 = {docSha256}

4. Security check: Is this artifact still unclaimed?
   └─ IF telegram_chat_id == crew_owner_chat_id
         THEN allow claim
         ELSE deny (already claimed by another user)

5. Swap user in all three tables (atomic transaction):
   └─ UPDATE public.rentals 
      SET user_id = {realUserChatId}
      WHERE rental_id = {artifact.rental_id}
   
   └─ UPDATE private.rental_contract_artifacts
      SET telegram_chat_id = {realUserChatId}
      WHERE original_sha256 = {docSha256}
   
   └─ UPDATE private.user_rental_secrets
      SET chat_id = {realUserChatId}
      WHERE doc_sha256 = {docSha256}

6. Redirect to rental confirmation / success page
```

### Security Rules

- QR can be claimed **only once** (telegram_chat_id changes permanently)
- **No crew membership required** for claiming (open to all users)
- User is auto-created on first web app open via Telegram auth
- After claim, the rental is permanently linked to that user

### Error States

| Scenario | Behavior |
|----------|----------|
| SHA256 not found | "Документ не найден" → offer catalog |
| Already claimed | "Этот договор уже привязан к другому пользователю" |
| Bike not found | "Мотоцикл больше не в каталоге" |
| Invalid QR format | "Неверный формат QR-кода" |

---

## Analytics Page

### Route

`/franchize/{slug}/analytics`

### Access Control

**Only active crew members can view:**
```sql
SELECT * FROM crew_members
WHERE crew_id = {crew.id}
  AND user_id = {chat_id}
  AND active = true
```

**Non-members see:** "Доступ только для членов команды"

### Layout Design

Theme-friendly UI following existing franchize patterns:

```
┌─────────────────────────────────────────┐
│ 📊 Аналитика аренд на сегодня          │
│ 17.06.2026                              │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────┐  ┌───────────────┐ │
│ │ Аренд сегодня   │  │ 💰 Выручка    │ │
│ │      12         │  │   145 000 ₽   │ │
│ └─────────────────┘  └───────────────┘ │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ Список аренд на сегодня           │  │
│ ├───────────────────────────────────┤  │
│ │ 🏍 Kawasaki EX650K                 │  │
│ │    Иванов И.И.                     │  │
│ │    17.06 18:00 → 18.06 10:00      │  │
│ │    16 000 ₽                        │  │
│ ├───────────────────────────────────┤  │
│ │ 🏍 HORWIN SK3 Plus                 │  │
│ │    Петров П.П.                     │  │
│ │    17.06 14:00 → 18.06 12:00      │  │
│ │    12 000 ₽                        │  │
│ └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Data Query

```sql
SELECT 
  r.rental_id,
  r.user_id,
  r.vehicle_id,
  r.requested_start_date,
  r.requested_end_date,
  r.total_cost,
  c.make,
  c.model,
  COALESCE(
    u.metadata->>'fullName', 
    u.metadata->>'display_name',
    u.username, 
    'Пользователь #' || SUBSTRING(u.user_id, 1, 8)
  ) as renter_name
FROM rentals r
JOIN cars c ON r.vehicle_id = c.id
LEFT JOIN users u ON r.user_id = u.user_id
WHERE DATE(r.requested_start_date) = CURRENT_DATE
  AND c.crew_id = {crew_id}
ORDER BY r.requested_start_date DESC;
```

### Features

- Summary cards at top (rental count + total revenue)
- Rental cards with bike, renter, dates, amount
- Theme-aware (uses crew palette CSS variables)
- Empty state: "Сегодня аренд пока нет"
- Responsive design (mobile-first)

---

## Implementation Breakdown

### Phase 1: Database Migration
1. Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_rental_contract_artifacts_rental_id.sql`
2. Add `rental_id` column with FK constraint
3. Create partial index
4. Run migration

### Phase 2: Helper Functions
1. Create `lib/rental-date-utils.ts`:
   - `convertTextDateToTimestamp(date, time, timezoneOffset?)`
   - Handle edge cases (invalid dates, missing times)
   - Export for use in skill and doc-manual

### Phase 3: Skill Script Updates
1. Modify `scripts/make-rental-contract-skill.mjs`:
   - Import `supabaseAdmin` and helper function
   - Resolve crew owner from `bike.crew_id` → `crews` table
   - Get owner's `telegram_chat_id` from `crew_members` or fallback
   - **Create rentals row first:**
     - Convert TEXT dates to TIMESTAMPTZ
     - Calculate `total_cost` from duration × daily price
     - Insert and get returned `rental_id`
   - Insert `rental_contract_artifacts` with `rental_id`
   - Handle failures gracefully (if rentals created but artifact fails, log warning)

### Phase 4: Doc-manual Updates
1. Modify `app/webhook-handlers/commands/doc-manual.ts`:
   - Import helper function
   - Add same rental creation logic after contract generation
   - Use same crew owner resolution
   - Ensure consistent date handling
   - Update `generateContract()` function

### Phase 5: QR Linking Handler
1. Extend or create startapp handler for `rent_{bikeId}_{docSha256}` format
2. Implement linking logic:
   - Parse startapp parameter
   - Lookup `rental_contract_artifacts` by SHA256
   - Check if still owned by crew owner (unclaimed)
   - Perform 3-table update in transaction
   - Handle error states gracefully
3. Create success page or redirect flow
4. Test claiming flow end-to-end

### Phase 6: Analytics Page
1. Create `/franchize/[slug]/analytics/page.tsx`
2. Add server action `getTodayRentals(slug)`:
   - Query today's rentals with crew filter
   - Calculate totals (count + sum)
   - Check crew membership
3. Build theme-aware component:
   - Use crew palette CSS variables
   - Summary cards layout
   - Rental list with cards
   - Empty state handling
4. Test with sample data

### Phase 7: CatalogClient Integration (Optional/Bonus)
1. Optional: Dim bikes based on user access tier (`vip-access.ts` integration)
2. Optional: Show "in use" badge for rentals currently active
3. Optional: Quick "rent again" button for previous rentals

---

## Complexity Estimates

| Phase | Complexity | Reason |
|-------|------------|---------|
| Phase 1 | Simple | Single migration, well-defined FK |
| Phase 2 | Simple | Pure utility function, no side effects |
| Phase 3 | Medium | Core integration, need to handle failures |
| Phase 4 | Medium | Similar to Phase 3, copy pattern |
| Phase 5 | Medium | Transaction logic, error handling |
| Phase 6 | Simple | Read-only page, no mutations |
| Phase 7 | Medium | Optional UI enhancement |

---

## Success Criteria

1. ✅ Bot-generated contracts create `rentals` rows with crew owner as placeholder
2. ✅ QR codes link contracts to real users (one-time claim)
3. ✅ CatalogClient shows accurate availability (includes bot contracts)
4. ✅ Analytics page displays today's rentals for crew members
5. ✅ Date conversion works correctly across all systems
6. ✅ No data loss if artifact creation fails (fallback-safe)
7. ✅ Theme consistency across new pages

---

## Open Questions & Decisions Made

| Question | Decision | Rationale |
|----------|----------|-----------|
| Rental or artifact first? | **Rental first** | Fewer DB ops, safer fallback |
| Placeholder user? | **Crew owner** | Existing pattern, gives visibility |
| QR claiming access? | **Open to all** | No crew check, auto-create user |
| Timezone for dates? | **UTC+3 (Moscow)** | Consistent with business ops |
| Analytics visibility? | **Active crew members only** | Crew.members.active = true |
| What if artifact fails? | **Keep rentals row** | Bike shows busy = safe default |

---

## Files to Modify/Create

### Modify
- `scripts/make-rental-contract-skill.mjs` — Add rental creation logic
- `app/webhook-handlers/commands/doc-manual.ts` — Add rental creation logic
- `app/lib/startapp-handler.ts` (or create) — QR linking logic
- `app/franchize/actions-runtime.ts` — Analytics server action (if needed)

### Create
- `lib/rental-date-utils.ts` — Date conversion helper
- `supabase/migrations/YYYYMMDDHHMMSS_rental_contract_artifacts_rental_id.sql` — Schema change
- `app/franchize/[slug]/analytics/page.tsx` — Analytics page
- `app/franchize/[slug]/analytics/components/AnalyticsClient.tsx` — UI component

---

## Testing Checklist

- [ ] Skill creates rentals row with correct dates (TEXT → TIMESTAMPTZ)
- [ ] Doc-manual creates rentals row with correct dates
- [ ] Crew owner is set as placeholder user_id
- [ ] rental_id FK is set in rental_contract_artifacts
- [ ] QR code parsing handles all format variations
- [ ] QR claiming works for new users (auto-created)
- [ ] QR claiming denied if already claimed
- [ ] User swap updates all three tables correctly
- [ ] Analytics page shows today's rentals
- [ ] Analytics page denies non-crew-members
- [ ] CatalogClient shows bot contracts as "busy"
- [ ] Empty states render correctly
- [ ] Theme consistency across all new UI

---

## Next Steps

1. ✅ Design approved
2. ⏭️ Write implementation plan (using writing-plans skill)
3. ⏭️ Execute implementation (can be split across sessions)
4. ⏭️ Test end-to-end flows
5. ⏭️ Deploy and monitor

---

**Session context:** This spec was created through a brainstorming session on 2026-06-17. All key decisions were reviewed and approved by the user. The spec can be used as a reference for implementation across multiple sessions.
