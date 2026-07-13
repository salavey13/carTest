# Rental Auto-Activation System

**Date:** 2026-07-13  
**Status:** Implemented  
**Commit:** `b5f06e02`

---

## Overview

Automatic rental activation when all verification todos are completed. Eliminates manual status updates and ensures rentals are activated immediately after all documents are verified.

---

## Architecture

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Operator verifies documents in LEADS page                  │
│  (passport, license, equipment, odometer, dates, payment)   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/verify-rental-checklist                          │
│  - Updates metadata.checklist                               │
│  - Auto-completes verification todos                        │
│  - Fire-and-forget: activateRentalIfReady()                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  activateRentalIfReady(rentalId)                            │
│  1. Check rental.status === "pending"                       │
│  2. Fetch all crew_todos with:                              │
│     - category = "verification"                             │
│     - lead_id = rentalId                                    │
│  3. Check if all todos.status === "done"                    │
│  4. If yes:                                                 │
│     - Update rentals.status = "active"                      │
│     - Set metadata.activated_at = NOW()                     │
│     - Send Telegram notifications                           │
│  5. If no: do nothing (wait for more todos)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Telegram Notifications                                     │
│  - Renter: "Ваша аренда активирована! Приятной поездки 🏍️" │
│  - Owner: "Аренда #{rentalId} активирована"                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Server Action: `activateRentalIfReady`

**File:** `app/franchize/server-actions/rental-activation.ts`

**Function signature:**
```typescript
export async function activateRentalIfReady(
  rentalId: string
): Promise<ActivateRentalIfReadyResult>
```

**Returns:**
```typescript
interface ActivateRentalIfReadyResult {
  success: boolean;
  activated: boolean;
  rentalId: string;
  message?: string;
  error?: string;
}
```

**Key features:**
- **Idempotent:** Safe to call multiple times
- **Status check:** Only activates from `pending` status
- **Todo validation:** Checks all verification todos are `done`
- **Metadata tracking:** Stores `activated_at` timestamp
- **Notifications:** Sends Telegram messages to renter and owner
- **Error handling:** Logs errors but doesn't throw (fire-and-forget)

### 2. API Endpoint: `/api/verify-rental-checklist`

**File:** `app/api/verify-rental-checklist/route.ts`

**Changes:**
- Added import: `activateRentalIfReady`
- Added fire-and-forget call after todo auto-completion (step 8)
- Uses `setImmediate()` to run activation asynchronously (doesn't block response)

**Flow:**
1. Operator clicks "Verify passport" / "Verify license"
2. Endpoint updates `metadata.checklist`
3. Auto-completes verification todos (existing logic)
4. **NEW:** Fire-and-forget call to `activateRentalIfReady()`
5. Returns response immediately (activation happens in background)

### 3. Verification Todos System

**File:** `app/franchize/server-actions/rental-verification-todos.ts` (created by another agent)

**Todo categories:**
- `passport_mainpage` — Passport main page verified
- `passport_registration` — Passport registration page verified
- `drivers_license` — Driver's license verified
- `odometer` — Odometer reading recorded
- `dates` — Rental dates confirmed
- `payment` — Payment verified (optional)

**Todo structure:**
```typescript
{
  id: string;
  crew_id: string;
  lead_id: string; // rentalId
  category: "verification";
  title: string;
  status: "pending" | "in_progress" | "done";
  // ...
}
```

---

## Database Schema

### Rentals Table

**New metadata fields:**
```json
{
  "metadata": {
    "checklist": {
      "passport_verified": true,
      "license_verified": true,
      "equipment_handover": { "keys": true, "helmet": true },
      "odometer_before": 1234,
      "dates_confirmed": true,
      "payment_verified": true
    },
    "activated_at": "2026-07-13T12:00:00.000Z",
    "activated_by": "system:auto-activation"
  }
}
```

**Status transitions:**
```
pending → active → completed
```

### Crew Todos Table

**Query for verification todos:**
```sql
SELECT * FROM crew_todos
WHERE lead_id = :rentalId
  AND category = 'verification';
```

**Expected todos per rental:** 5-6 (depending on configuration)

---

## Usage

### Manual Activation (if needed)

If auto-activation fails, you can manually trigger it:

```typescript
import { activateRentalIfReady } from "@/app/franchize/server-actions/rental-activation";

const result = await activateRentalIfReady("rental-uuid-here");
console.log(result);
// { success: true, activated: true, rentalId: "...", message: "..." }
```

### Check Activation Status

```sql
SELECT 
  rental_id,
  status,
  metadata->>'activated_at' AS activated_at,
  metadata->>'activated_by' AS activated_by
FROM rentals
WHERE rental_id = 'rental-uuid-here';
```

### View Verification Todos

```sql
SELECT 
  id,
  title,
  category,
  status,
  completed_at
FROM crew_todos
WHERE lead_id = 'rental-uuid-here'
  AND category = 'verification'
ORDER BY created_at;
```

---

## Testing

### Test Case 1: All Todos Completed

1. Create rental with status `pending`
2. Create 5 verification todos (all `pending`)
3. Complete all todos (status → `done`)
4. Call `activateRentalIfReady(rentalId)`
5. **Expected:** Rental status → `active`, notifications sent

### Test Case 2: Partial Completion

1. Create rental with status `pending`
2. Create 5 verification todos
3. Complete 3 todos
4. Call `activateRentalIfReady(rentalId)`
5. **Expected:** Rental stays `pending`, message: "Verification incomplete: 3/5 todos done"

### Test Case 3: Already Active

1. Create rental with status `active`
2. Call `activateRentalIfReady(rentalId)`
3. **Expected:** No changes, message: "Rental already active"

### Test Case 4: No Todos

1. Create rental with status `pending`
2. No verification todos exist
3. Call `activateRentalIfReady(rentalId)`
4. **Expected:** No activation, message: "No verification todos found, waiting for creation"

---

## Logging

All activation attempts are logged:

```
[activateRentalIfReady] Checking rental { rentalId }
[activateRentalIfReady] Todos status { rentalId, completedCount, totalCount, allDone }
[activateRentalIfReady] Activating rental { rentalId }
[activateRentalIfReady] Rental activated successfully { rentalId }
[sendActivationNotifications] Notifications sent { rentalId, renterChatId, ownerChatId }
```

**Error logs:**
```
[activateRentalIfReady] Rental not found { rentalId, error }
[activateRentalIfReady] Failed to fetch todos { rentalId, error }
[activateRentalIfReady] Failed to update rental { rentalId, error }
[sendActivationNotifications] Failed to send notifications { rentalId, error }
```

---

## Troubleshooting

### Rental Not Activating

**Check 1: Todos exist?**
```sql
SELECT COUNT(*) FROM crew_todos
WHERE lead_id = 'rental-uuid'
  AND category = 'verification';
```

**Check 2: All todos done?**
```sql
SELECT status, COUNT(*) FROM crew_todos
WHERE lead_id = 'rental-uuid'
  AND category = 'verification'
GROUP BY status;
```

**Check 3: Rental status?**
```sql
SELECT status FROM rentals WHERE rental_id = 'rental-uuid';
```

**Check 4: Logs?**
```bash
# On VPS
docker logs vip_bike_rental 2>&1 | grep "activateRentalIfReady" | tail -20
```

### Notifications Not Sent

**Check 1: TELEGRAM_BOT_TOKEN configured?**
```bash
# On VPS
grep TELEGRAM_BOT_TOKEN /opt/vip-bike-rental/.env.local
```

**Check 2: User IDs valid?**
```sql
SELECT user_id, crew_id FROM rentals WHERE rental_id = 'rental-uuid';
SELECT owner_id FROM crews WHERE id = 'crew-uuid';
```

---

## Future Enhancements

### 1. Supabase Trigger (Optional)

Create database trigger to auto-call `activateRentalIfReady` when todo status changes:

```sql
CREATE OR REPLACE FUNCTION check_rental_activation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category = 'verification' AND NEW.status = 'done' THEN
    -- Call activation check (via pg_net or edge function)
    PERFORM net.http_post(
      url := 'https://rental.vip-bike.ru/api/activate-rental-check',
      body := jsonb_build_object('rentalId', NEW.lead_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER todo_completed_trigger
AFTER UPDATE OF status ON crew_todos
FOR EACH ROW
WHEN (NEW.status = 'done')
EXECUTE FUNCTION check_rental_activation();
```

### 2. Batch Activation

Activate multiple rentals at once:

```typescript
export async function batchActivateRentals(rentalIds: string[]) {
  const results = await Promise.allSettled(
    rentalIds.map(id => activateRentalIfReady(id))
  );
  return results;
}
```

### 3. Activation Dashboard

Add UI to view activation status and manually trigger activation.

---

## Summary

**What was implemented:**
- ✅ Server action `activateRentalIfReady` with idempotency
- ✅ Integration with `verify-rental-checklist` (fire-and-forget)
- ✅ Telegram notifications to renter and owner
- ✅ Metadata tracking (`activated_at`, `activated_by`)
- ✅ Comprehensive logging
- ✅ Error handling (non-blocking)

**What was NOT implemented:**
- ❌ Supabase trigger (optional, can be added later)
- ❌ Batch activation endpoint
- ❌ Activation dashboard UI

**Status:** Ready for production use.
