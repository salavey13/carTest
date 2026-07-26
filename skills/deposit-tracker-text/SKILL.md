---
name: deposit-tracker-text
description: >
  Track rental deposits: collected? returned? cash or transfer? Auto-flag
  unreturned deposits on completed rentals. Calculate total deposit liability.
  Trigger phrases: "депозит", "залог", "возврат депозита", "депозиты сегодня",
  "непreturned депозиты", "deposit tracker", "deposit returned", "залоги".
---

# deposit-tracker-text

Триггер-фразы: **`депозит`**, **`залог`**, **`возврат депозита`**, **`депозиты сегодня`**, **`непreturned депозиты`**, **`deposit tracker`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## What this tracks

Every rental has a returnable deposit. Before this skill, there was NO tracking:
- Was a deposit collected? ❌ Unknown
- How much? ❌ Not recorded
- Cash or bank transfer? ❌ Not recorded
- Was it returned? ❌ Not recorded

Now the `rentals` table has 7 new columns for deposit tracking:
- `deposit_amount` — how much (₽)
- `deposit_method` — 'cash' | 'bank_transfer' | 'telegram_stars' | 'none'
- `deposit_collected_at` — when collected
- `deposit_collected_by` — who collected (operator chat_id)
- `deposit_returned` — boolean, was it returned?
- `deposit_returned_at` — when returned
- `deposit_returned_by` — who returned

Plus `deposit_log` table for audit trail.

## Commands

### 1. deposits-status [--date YYYY-MM-DD]
All deposits for today's rentals — collected, returned, outstanding.

```bash
TODAY="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,user_id,status,deposit_amount,deposit_method,deposit_collected_at,deposit_returned,deposit_returned_at,total_cost&crew_id=eq.$CREW_ID&or=(and(created_at.gte.${TODAY}T00:00:00Z,created_at.lte.${TODAY}T23:59:59Z),and(agreed_start_date.lte.${TODAY}T23:59:59Z,agreed_end_date.gte.${TODAY}T00:00:00Z))&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output per rental:
- 🏍 Bike · renter · status
- 💰 Deposit: 20,000 ₽ · 💵 cash · ✅ returned (14:30)
- Or: 💰 Deposit: 20,000 ₽ · 🏦 transfer · ⚠️ NOT returned

### 2. deposits-outstanding
All rentals where deposit was collected but NOT returned (money owed to clients).

```bash
curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,user_id,status,deposit_amount,deposit_method,deposit_collected_at,agreed_end_date&crew_id=eq.$CREW_ID&deposit_collected_at=not.is.null&deposit_returned=eq.false&order=agreed_end_date.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output: total liability + list of clients owed money.

### 3. deposit-collect <rentalId> --amount <rub> --method <cash|bank_transfer|telegram_stars>
Record that a deposit was collected.

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"deposit_amount\":${AMOUNT},\"deposit_method\":\"${METHOD}\",\"deposit_collected_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"deposit_collected_by\":\"${OPERATOR_ID}\"}"

# Also log to deposit_log
curl -s -X POST "$URL/rest/v1/deposit_log" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"rental_id\":\"${rentalId}\",\"action\":\"collected\",\"amount\":${AMOUNT},\"method\":\"${METHOD}\",\"operator_chat_id\":\"${OPERATOR_ID}\"}"
```

### 4. deposit-return <rentalId>
Mark deposit as returned.

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"deposit_returned\":true,\"deposit_returned_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"deposit_returned_by\":\"${OPERATOR_ID}\"}"
```

### 5. deposits-summary [--from YYYY-MM-DD] [--to YYYY-MM-DD]
Aggregate: total collected, total returned, total outstanding, by method.

## Auto-features

- **Auto-return on completion**: When a rental status changes to `completed`, the trigger auto-sets `deposit_returned=true` and logs it. No forgotten deposits.
- **Morning standup integration**: The morning-standup boss command should include "💰 Депозитов не возвращено: N" in the summary.
- **Boss alert**: If a completed rental has `deposit_returned=false` for > 24h → alert.

## 🔗 Deep Links
- Rental detail: `rental_link $rental_id`
- Analytics: `analytics_link "rentals"`

## Security
- PII: mask renter phone/name
- Only crew members can read deposit data (RLS)

## Related Files
- Migration: `supabase/migrations/20260726000001_deposit_and_shift_tracking.sql`
- Sibling skills: `shift-tracker-text`, `rental-card-text`, `rental-analytics-text`
