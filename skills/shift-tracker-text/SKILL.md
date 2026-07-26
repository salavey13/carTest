---
name: shift-tracker-text
description: >
  Crew shift tracking: check-in/check-out, hours worked, salary calculation,
  daily/weekly reports. Morning check-in via Telegram button.
  Trigger phrases: "смена", "смены", "кто на смене", "зарплата", "часы работы",
  "check in", "shift", "salary", "hours worked", "кто онлайн".
---

# shift-tracker-text

Триггер-фразы: **`смена`**, **`смены`**, **`кто на смене`**, **`зарплата`**, **`часы работы`**, **`кто онлайн`**, **`check in`**, **`shift`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## What this tracks

The `crew_shifts` table tracks operator work time:
- `checked_in_at` — when the operator started their shift
- `checked_out_at` — when they ended
- `hours_worked` — auto-calculated (stored generated column)
- `hourly_rate` — configurable per shift (default 500 ₽/hour)
- `salary_amount` — auto-calculated (hours × rate)
- `status` — pending → active → completed (or absent/cancelled)

## Commands

### 1. shift-check-in <operatorChatId>
Check in for today's shift. Creates a shift record if none exists.

```bash
TODAY=$(TZ=Europe/Moscow date +%Y-%m-%d)
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Upsert: create or activate shift
curl -s -X POST "$URL/rest/v1/crew_shifts" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation,resolution=merge-duplicates" \
  -d "{\"crew_id\":\"$CREW_ID\",\"operator_chat_id\":\"$OP_ID\",\"shift_date\":\"$TODAY\",\"checked_in_at\":\"$NOW\",\"status\":\"active\"}"
```

Output: "✅ Checked in at 09:15 МСК. Have a productive day!"

### 2. shift-check-out <operatorChatId>
Check out — ends the shift, calculates hours + salary.

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TODAY=$(TZ=Europe/Moscow date +%Y-%m-%d)

curl -s -X PATCH "$URL/rest/v1/crew_shifts?crew_id=eq.$CREW_ID&operator_chat_id=eq.$OP_ID&shift_date=eq.$TODAY&status=eq.active" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"checked_out_at\":\"$NOW\",\"status\":\"completed\"}"
```

Output: "✅ Shift completed: 8.5h × 500₽/h = 4,250₽. Great work!"

### 3. shift-status [--date YYYY-MM-DD]
Who's on shift today.

```bash
TODAY="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
curl -s "$URL/rest/v1/crew_shifts?select=operator_chat_id,status,checked_in_at,checked_out_at,hours_worked,salary_amount&crew_id=eq.$CREW_ID&shift_date=eq.$TODAY&order=checked_in_at.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output:
```
📅 Смены за 26.07.2026:

🟢 Активны:
  • Илья (356282674) — с 09:15 (5ч 12м)
  • Роман (244736261) — с 10:00 (4ч 27м)

⚪ Не отмечались:
  • salavey13 (413553377)
  • DJORUDJOV (7813830016)

📊 Сегодня: 2 на смене, 0 завершено
```

### 4. shift-salary [--from YYYY-MM-DD] [--to YYYY-MM-DD]
Salary report for a period.

```bash
FROM="${1:-$(TZ=Europe/Moscow date -d '7 days ago' +%Y-%m-%d)}"
TO="${2:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"

curl -s "$URL/rest/v1/crew_shifts?select=operator_chat_id,shift_date,hours_worked,hourly_rate,salary_amount,status&crew_id=eq.$CREW_ID&shift_date=gte.$FROM&shift_date=lte.$TO&status=eq.completed&order=shift_date.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output:
```
💰 Зарплата за 19.07 — 26.07:

Operator          | Hours  | Rate  | Salary
Илья (356282674)  | 42.5h  | 500₽  | 21,250₽
Роман (244736261) | 38.0h  | 500₽  | 19,000₽

Total: 80.5h · 40,250₽
```

### 5. shift-weekly-report
Monday morning summary: last week's shifts + salary.

## Morning check-in integration

The `morning-standup.sh` boss command should include an inline keyboard:
```json
{
  "reply_markup": {
    "inline_keyboard": [[
      {"text": "✅ Я на смене", "callback_data": "shift_checkin"},
      {"text": "🔴 Не работаю", "callback_data": "shift_absent"}
    ]]
  }
}
```

When the operator taps "✅ Я на смене":
1. Bot calls `shift-check-in` with their chat_id
2. Records check-in time
3. Replies "✅ Отлично! Вот твоя сводка: [morning standup data]"

When the operator taps "🔴 Не работаю":
1. Records `status=absent`
2. Replies "Понял. Хорошего выходного!"

## Auto-features

- **Auto check-out reminder**: At 21:00, if an operator is still `active`, send "Не забудь отметиться!"
- **Salary accrual**: Daily at 22:00, calculate each operator's accumulated salary for the month
- **Weekly salary report**: Every Monday at 10:00, send salary summary to admin

## 🔗 Deep Links
- Dashboard: `analytics_link "rentals"`

## Related Files
- Migration: `supabase/migrations/20260726000001_deposit_and_shift_tracking.sql`
- Sibling skills: `deposit-tracker-text`, `crew-management-text`
