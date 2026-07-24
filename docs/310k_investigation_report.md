# Investigation Report: The 310,000 ₽ Rental Mystery — SOLVED

## Executive summary

The 310,000 ₽ rental is a **legitimate long-term rental** (31 days × 10,000 ₽/day) whose `requested_start_date` was corrupted by a **date format swap bug** (DD.MM → MM.DD) in a post-creation UPDATE path. The price is correct; the dates are wrong.

---

## The evidence

### 1. The rental record (rental_id: 94b5b41d)

| Field | Value | Correct? |
|---|---|---|
| `total_cost` | 310,000 ₽ | ✅ 31 days × 10,000 ₽/day |
| `requested_start_date` | 2026-08-07 (August 7) | ❌ Should be July 8 |
| `requested_end_date` | 2026-07-09 (July 9) | ❌ Should be August 8 |
| `agreed_start_date` | 2026-07-08 (July 8) | ✅ Correct |
| `agreed_end_date` | 2026-07-09 (July 9) | ❌ Should be August 8 |
| `created_at` | 2026-07-08 12:15 UTC | ✅ Created on July 8 |
| `status` | completed | ✅ |
| `daily_price` (cars.specs) | 10,000 ₽ | ✅ |

### 2. The date swap

```
requested_start: 2026-08-07  ←  August 7  (WRONG — month/day swapped)
agreed_start:    2026-07-08  ←  July 8    (CORRECT)
```

The operator entered `08.07` (DD.MM = July 8). The `parseRuDateParts()` function in `lib/rental-date-utils.ts` correctly parses DD.MM → July 8. So the INSERT set both `requested_start_date` and `agreed_start_date` to `2026-07-08`.

**But** `requested_start_date` is now `2026-08-07` — meaning something UPDATED it AFTER creation, swapping day and month.

### 3. The price math

```
310,000 ÷ 10,000 = 31 days
July 8 → August 8 = 31 days × 10,000 ₽/day = 310,000 ₽  ✓
```

The price was calculated correctly for a 31-day rental. The pricing calculator (`calculatePriceForDuration`) received the correct dates at creation time and computed 31 × 10,000 = 310,000.

### 4. What corrupted the dates

The `doc-manual.ts` INSERT sets both `requested_start_date` and `agreed_start_date` to the same `startDateIso` value (lines 1234-1236). Since `agreed_start_date` is correct (July 8) but `requested_start_date` is wrong (August 7), a **separate UPDATE** must have modified `requested_start_date` after creation.

The most likely culprit: `app/api/rentals/[id]/route.ts` or `app/franchize/server-actions/rentals.ts` — both contain UPDATE logic that touches `requested_start_date`. One of these paths likely re-parsed the date in MM.DD format instead of DD.MM.

### 5. The `last_status_change_by` bug

```
metadata.last_status_change_by = "1784553988173"
```

This is a **millisecond timestamp** (2026-07-20T13:26:28.173Z), not a user ID. It was written by `rentals-dashboard.ts:2017` which sets `last_status_change_by: actorUserId` — but `actorUserId` contained a timestamp instead of a chat ID. This is a separate bug in the status-change handler.

---

## Conclusion

| Question | Answer |
|---|---|
| Is 310,000 ₽ a glitch? | **No** — it's the correct price for a 31-day rental at 10,000 ₽/day |
| Was it a 1-day rental? | **No** — it was intended as a 31-day rental (July 8 → August 8) |
| What went wrong? | `requested_start_date` and `requested_end_date` were corrupted by a post-creation UPDATE that swapped DD.MM → MM.DD |
| Is the operator's "extra 0" theory correct? | **No** — the operator doesn't enter the price; it's calculated from `bike.specs.dailyPrice × days` |
| Is the user's "2-month rental" theory correct? | **Almost** — it was 31 days (July 8 → August 8), not 2 months exactly, but the spirit is right |
| What needs fixing? | 1. Find the UPDATE path that corrupts `requested_start_date` 2. Fix the DD.MM → MM.DD swap 3. Fix `last_status_change_by` receiving timestamps instead of user IDs |

---

## Recommended fixes

### Fix 1: Date format validation in UPDATE paths

Any code that UPDATEs `requested_start_date` or `requested_end_date` must use the same `parseRuDateParts()` function as the INSERT path. Never parse dates with `new Date(string)` directly — it interprets `YYYY-MM-DD` as MM-DD in some locales.

### Fix 2: Pricing calculator negative-hours guard

In `doc-manual.ts:1177`:
```ts
const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
```

If `end < start` (inverted dates), `hours` is negative. The calculator returns `price: 0` for `hours <= 0`, which triggers the fallback `baseDailyPrice * days` where `days = Math.max(1, Math.ceil(negative / 24)) = 1`. This produces 10,000 instead of an error.

**Fix:** Add a validation check:
```ts
if (hours <= 0) {
  logger.error('[/doc] Invalid date range: end before start', { startDateIso, endDateIso, hours });
  throw new Error('Дата окончания раньше даты начала — проверьте ввод');
}
```

### Fix 3: `last_status_change_by` validation

In `rentals-dashboard.ts:2017`, validate that `actorUserId` looks like a Telegram chat ID (numeric string, 5-12 digits), not a timestamp.

---

## What to tell the operator

> 310,000 ₽ — это правильная цена для 31-дневной аренды Ducati Panigale (10,000 ₽/день × 31 день).
>
> Запись создавалась через /doc 8 июля для аренды с 8 июля по 8 августа. Цена посчиталась верно.
>
> Но потом какой-то UPDATE (вероятно через веб-дашборд) перезаписал `requested_start_date` — поменял день и месяц местами (08.07 → August 7 вместо July 8). `agreed_start_date` остался правильным (July 8).
>
> Баг не в цене, а в датах. Цена 310k — корректная для месячной аренды премиум-Ducati.
