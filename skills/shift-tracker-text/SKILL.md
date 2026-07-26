---
name: shift-tracker-text
description: >
  Crew shift tracking using existing crew_member_shifts table + /shift bot command.
  Check-in/check-out, hours worked, salary calculation, daily/weekly reports.
  Integrates with existing live_status (offline/online/riding) and shift_type.
  Trigger phrases: "смена", "смены", "кто на смене", "зарплата", "часы работы",
  "check in", "shift", "salary", "hours worked", "кто онлайн".
---

# shift-tracker-text

Триггер-фразы: **`смена`**, **`смены`**, **`кто на смене`**, **`зарплата`**, **`часы работы`**, **`кто онлайн`**, **`shift`**, **`salary`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Existing infrastructure

The crew already has shift tracking via:
- **Bot command**: `/shift` in Telegram (handled by `app/webhook-handlers/commands/shift.ts`)
- **Table**: `crew_member_shifts` (id, member_id, crew_id, clock_in_time, clock_out_time, duration_minutes, shift_type, checkpoint, actions)
- **Live status**: `crew_members.live_status` (offline → online → riding → offline)
- **Web page**: `/franchize/{slug}/crew` → `CrewShiftsClient.tsx` (live timer, check-in/out buttons)
- **API**: `/api/crew/shifts` (POST=start, DELETE=end)
- **Edge function**: `supabase/functions/handle-shift-command/index.ts`

This skill EXTENDS the existing system with:
- `hourly_rate` column (default 500₽) — added by migration 20260726000001
- `salary_amount` column — auto-calculated on clock_out by trigger
- `notes` column — for shift notes
- Salary reporting commands
- Boss command integration

## Commands

### 1. shift-status [--date YYYY-MM-DD]
Who's on shift today — reads crew_members.live_status + active crew_member_shifts.

```bash
TODAY="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"

# Get crew members with their live status
curl -s "$URL/rest/v1/crew_members?select=user_id,role,live_status,username&crew_id=eq.$CREW_ID&membership_status=eq.active" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Get today's shifts
curl -s "$URL/rest/v1/crew_member_shifts?select=id,member_id,clock_in_time,clock_out_time,shift_type,duration_minutes,salary_amount&crew_id=eq.$CREW_ID&clock_in_time=gte.${TODAY}T00:00:00Z&order=clock_in_time.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output:
```
📅 Смены за 26.07.2026:

🟢 На смене:
  • Илья (356282674) — riding с 09:15 (5ч 12м)
  • Роман (244736261) — online с 10:00 (4ч 27м)

⚪ Не на смене:
  • salavey13 (413553377) — offline
  • DJORUDJOV (7813830016) — offline

📊 Сегодня: 2 на смене, 0 завершено, 0₽ начислено
```

### 2. shift-salary [--from YYYY-MM-DD] [--to YYYY-MM-DD]
Salary report — reads crew_member_shifts with salary_amount (auto-calculated).

```bash
FROM="${1:-$(TZ=Europe/Moscow date -d '7 days ago' +%Y-%m-%d)}"
TO="${2:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"

curl -s "$URL/rest/v1/crew_member_shifts?select=member_id,clock_in_time,clock_out_time,duration_minutes,hourly_rate,salary_amount,shift_type&crew_id=eq.$CREW_ID&clock_in_time=gte.${FROM}T00:00:00Z&clock_in_time=lte.${TO}T23:59:59Z&clock_out_time=not.is.null&order=clock_in_time.asc" \
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

### 3. shift-set-rate <operatorChatId> --rate <rub>
Set hourly rate for an operator (admin only). Updates future shifts.

```bash
# Update the operator's default rate on crew_members
curl -s -X PATCH "$URL/rest/v1/crew_members?crew_id=eq.$CREW_ID&user_id=eq.$OP_ID" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"metadata": {"default_hourly_rate": '${RATE}'}}'
```

### 4. shift-weekly-report
Monday morning salary summary — sent by boss command.

```bash
FROM=$(TZ=Europe/Moscow date -d '7 days ago' +%Y-%m-%d)
TO=$(TZ=Europe/Moscow date -d '1 day ago' +%Y-%m-%d)

# Query + format as Telegram message
SALARY_DATA=$(curl -s "$URL/rest/v1/crew_member_shifts?select=member_id,duration_minutes,salary_amount&crew_id=eq.$CREW_ID&clock_in_time=gte.${FROM}T00:00:00Z&clock_in_time=lte.${TO}T23:59:59Z&clock_out_time=not.is.null" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
```

## Existing /shift bot command integration

The `/shift` command in Telegram already handles:
- `clock_in` → sets live_status=online, creates crew_member_shifts row
- `clock_out` → sets live_status=offline, updates clock_out_time
- `toggle_ride` → toggles between online/riding

The migration adds:
- **Auto-salary calculation**: when `clock_out_time` is set, the trigger calculates `salary_amount = (duration_minutes / 60) * hourly_rate`
- **hourly_rate**: defaults to 500₽, configurable per shift
- **Backfill**: existing completed shifts get salary_amount calculated retroactively

## Boss command integration

### Morning standup with check-in button

The morning-standup.sh can include a deep link to `/shift`:
```
✅ Начать смену: /shift
```

Or (Phase 2 with inline keyboards):
```json
{"text": "✅ Я на смене", "callback_data": "shift_checkin"}
```

### Weekly salary report (Monday 10:00)

A new boss command `weekly-salary.sh` (or add to `weekly-revenue.sh`):
```
💰 Зарплата за неделю (19.07 — 25.07):

Илья: 42.5h × 500₽ = 21,250₽
Роман: 38.0h × 500₽ = 19,000₽

Итого: 80.5h · 40,250₽
```

## 🔗 Deep Links
- Crew shifts page: `https://vip-bike.ru/franchize/vip-bike/crew`
- Telegram `/shift` command: just type `/shift` in the bot

## Related Files
- **Bot command**: `app/webhook-handlers/commands/shift.ts`
- **Web page**: `app/franchize/[slug]/crew/CrewShiftsClient.tsx`
- **API**: `app/api/crew/shifts/route.ts`
- **Edge function**: `supabase/functions/handle-shift-command/index.ts`
- **Migration**: `supabase/migrations/20260726000001_deposit_and_shift_tracking.sql`
- **Existing migration**: `supabase/migrations/20240728000000_crew_invites_and_shift_types.sql`
- **Sibling skills**: `deposit-tracker-text`, `crew-management-text`
