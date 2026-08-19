---
name: shift-tracker-text
description: |
  Text-based shift tracker for VIP Bike crew. Shows active shifts, completed shifts,
  salary calculation on the fly (hourly_rate × elapsed hours), and crew live status.
  Designed for evening digests via Telegram bot or cron job.
  Trigger phrases (RU): "смены", "кто на смене", "активные смены", "статистика смен",
  "зарплата за смены", "вечерний отчёт смен", "сколько отработано".
  Trigger phrases (EN): "shifts", "who is on shift", "active shifts", "shift stats",
  "shift salary", "evening shift report", "hours worked".
---

# Shift Tracker (Text)

Text-based shift tracking for VIP Bike crew. Generates evening digest reports with
active shifts, completed shifts, and salary calculation on the fly.

## What it does

1. Queries Supabase `crew_member_shifts` table for all shifts (active + completed)
2. Queries `crew_members` + `users` for member names and live status
3. Calculates salary on the fly: `hourly_rate × elapsed_hours`
4. Generates a text report suitable for Telegram bot messages or evening digests

## Supabase Access

- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: `SUPABASE_SERVICE_ROLE_KEY` из `<repo>/.env.local` (или env) — НЕ из /home/z
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

> ⚠️ **Единый источник истины об активной смене** = запись в `crew_member_shifts`
> с `clock_out_time IS NULL`. Поле `crew_members.live_status` — вторичное «присутствие»
> и может «залипнуть» в online после ручного закрытия смены в БД. Бот `/shift`
> и страница `/franchize/{slug}/crew/shifts` оба опираются на `crew_member_shifts`
> (clock_out IS NULL) — держи их в тандеме, не доверяй одному `live_status`.

> ⏰ **Таймзоны (UTC vs МСК):** все `clock_in_time`/`clock_out_time` хранятся в **UTC**
> (ISO-8601 `+00:00`). Москва = UTC+3: **18:00 UTC == 21:00 МСК** (9pm). При ручном
> закрытии смены ставь `new Date().toISOString()` (UTC) либо конвертируй МСК → UTC
> (отнимай 3 часа). Клиент-страница рендерит в локальной таймзоне браузера, поэтому
> двойного сдвига делать НЕ нужно.

## ⚠️ Как закрыть смену ВРУЧНУЮ (ретроспективно) — всегда синхронно!

Если смена была закрыта не через бота/API (например, бот-команда не успела или
сотрудник ушёл без `clock_out`), закрывай ОБА поля за один проход — иначе бот
покажет «активную смену», которой нет:

```bash
# 1. Закрыть активную смену в crew_member_shifts (clock_out_time IS NULL)
#    NOTE: time — UTC ISO-8601. 18:00 UTC == 21:00 MSK. Если хочешь «9pm по Москве»,
#    это 18:00 UTC, НЕ 21:00 UTC.
curl -s -X PATCH "$URL/rest/v1/crew_member_shifts?member_id=eq.$OP_ID&crew_id=eq.$CREW_ID&clock_out_time=is.null" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"clock_out_time": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"}'

# 2. СБРОСИТЬ live_status в offline (иначе бот покажет «активную» смену!)
curl -s -X PATCH "$URL/rest/v1/crew_members?user_id=eq.$OP_ID&crew_id=eq.$CREW_ID" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"live_status": "offline"}'
```

Проверка после закрытия:
```bash
# Активных смен быть не должно:
curl -s "$URL/rest/v1/crew_member_shifts?select=id&member_id=eq.$OP_ID&clock_out_time=is.null" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"   # → []
# live_status должен быть offline:
curl -s "$URL/rest/v1/crew_members?select=live_status&user_id=eq.$OP_ID&crew_id=eq.$CREW_ID" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"   # → offline
```

## Existing infrastructure

The crew already has shift tracking via:
- **Bot command**: `/shift` in Telegram (handled by `app/webhook-handlers/commands/shift.ts`)
- **Table**: `crew_member_shifts` (id, member_id, crew_id, clock_in_time, clock_out_time, duration_minutes, shift_type, checkpoint, actions)
- **Live status**: `crew_members.live_status` (offline → online → riding → offline)
- **Web page**: `/franchize/{slug}/crew` → `CrewShiftsClient.tsx` (live timer, check-in/out buttons)
- **API**: `/api/crew/shifts` (POST=start, DELETE=end)
- **Edge function**: `supabase/functions/handle-shift-command/index.ts` — ⚠️ LEGACY, не используется (не вызывается из кода, использует несуществующую колонку `status`, не пишет в `crew_member_shifts`). НЕ ссылаться на него как на актуальную логику.

## When to use

- Evening digests (cron job at ~22:00)
- "Who is on shift right now?" queries
- "How much did we earn today?" queries
- Before/after shift handoff

## Commands

### 1. shift-status [--date YYYY-MM-DD]
Who's on shift today — reads active crew_member_shifts (source of truth) + live_status.

> Консистентность: «на смене» = есть запись `crew_member_shifts` с
> `clock_out_time IS NULL`. `live_status` в crew_members может «залипнуть» online
> после ручного закрытия — не показывай его как активную смену, сверяй с shifts.

```bash
# Today's report (default)
python3 scripts/export_shift_info.py

# Specific date
python3 scripts/export_shift_info.py --date 2026-08-17

# JSON format (for programmatic use)
python3 scripts/export_shift_info.py --format json

# Active shifts (source of truth) — clock_out IS NULL
curl -s "$URL/rest/v1/crew_member_shifts?select=id,member_id,clock_in_time,shift_type&crew_id=eq.$CREW_ID&clock_out_time=is.null&order=clock_in_time.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Get crew members with their live status (secondary)
curl -s "$URL/rest/v1/crew_members?select=user_id,role,live_status&crew_id=eq.$CREW_ID&membership_status=eq.active" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Get today's shifts (completed) — NOTE timezone: dates are UTC; Т 00:00:00Z is
# midnight UTC, which is 03:00 MSK. Use TZ=Europe/Moscow for the label but keep
# the query bound in UTC.
curl -s "$URL/rest/v1/crew_member_shifts?select=id,member_id,clock_in_time,clock_out_time,shift_type,duration_minutes,salary_amount&crew_id=eq.$CREW_ID&clock_in_time=gte.${TODAY}T00:00:00Z&order=clock_in_time.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 2. shift-set-rate <operatorChatId> --rate <rub>
Set hourly rate for an operator (admin only). Updates future shifts.

```bash
# Update the operator's default rate on crew_members
curl -s -X PATCH "$URL/rest/v1/crew_members?crew_id=eq.$CREW_ID&user_id=eq.$OP_ID" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"metadata": {"default_hourly_rate": '${RATE}'}}'
```

### 3. shift-close <operatorChatId> [--at "YYYY-MM-DD HH:MM MSK"]
Close a shift that was left open (manual / retrospective close).
**Allways closes BOTH**: `crew_member_shifts.clock_out_time` AND
`crew_members.live_status='offline'` — otherwise the bot shows a ghost active shift.

```bash
# Default: now in UTC. For a specific Moscow time, convert: MSK - 3h = UTC
# (e.g. "2026-08-17 21:00 MSK" == "2026-08-17T18:00:00.000Z").
CLOSE_UTC="${1:-$(date -u +%Y-%m-%dT%H:%M:%S.000Z)}"

curl -s -X PATCH "$URL/rest/v1/crew_member_shifts?member_id=eq.$OP_ID&crew_id=eq.$CREW_ID&clock_out_time=is.null" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"clock_out_time\": \"$CLOSE_UTC\"}"

curl -s -X PATCH "$URL/rest/v1/crew_members?user_id=eq.$OP_ID&crew_id=eq.$CREW_ID" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"live_status": "offline"}'
```

Verify: `clock_out_time=is.null` for the member returns `[]` AND `live_status` = offline.

### 4. shift-weekly-report
Monday morning salary summary — sent by boss command.

```bash
FROM=$(TZ=Europe/Moscow date -d '7 days ago' +%Y-%m-%d)
TO=$(TZ=Europe/Moscow date -d '1 day ago' +%Y-%m-%d)

# Query + format as Telegram message
SALARY_DATA=$(curl -s "$URL/rest/v1/crew_member_shifts?select=member_id,duration_minutes,salary_amount&crew_id=eq.$CREW_ID&clock_in_time=gte.${FROM}T00:00:00Z&clock_in_time=lte.${TO}T23:59:59Z&clock_out_time=not.is.null" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
```

## Report format (text)

```
📊 Смены экипажа VIP_BIKE за 2026-08-17
⏰ Отчёт сформирован: 22:00 UTC

📈 Итого за день:
  • Завершённых смен: 3
  • Активных смен: 1
  • Отработано часов: 24.5ч (завершено) + 4.2ч (активно)
  • Заработано: 4845₽ (по ставке 169₽/час)

🟢 АКТИВНЫЕ СМЕНЫ:
  • salavey13 (admin) — начало 18:00, длительность 4.2ч, ставка 169₽/ч, заработано 710₽

✅ ЗАВЕРШЁННЫЕ СМЕНЫ:
  • Roman (co_owner) — 09:00–17:30 (8.5ч), ставка 169₽/ч, заработано 1437₽
  • I_O_S_NN (owner) — 10:00–14:00 (4.0ч), ставка 169₽/ч, заработано 676₽
  • DJORUDJOV (member) — 12:00–19:00 (7.0ч), ставка 169₽/ч, заработано 1183₽

👥 СТАТУС ЭКИПАЖА:
  🟢 Онлайн: salavey13
  ⚫ Оффлайн: 7 участников
```

## Salary calculation

- Uses `hourly_rate` from the shift row (default 169₽/hour)
- For completed shifts: uses stored `salary_amount` if available, otherwise calculates from `duration_minutes`
- For active shifts: calculates on the fly from `clock_in_time` to current time
- Formula: `(elapsed_hours) × hourly_rate`

## Data source

- **Table**: `crew_member_shifts` (crew_id = vip-bike)
- **Enrichment**: `crew_members` (role, live_status) + `users` (username)
- **Filter**: shifts that started on the target date OR are still active (clock_out IS NULL)

## Cron job setup (evening digest)

```cron
0 22 * * * /usr/bin/python3 /opt/vip-bike-electro-factory/rental-repo/scripts/export_shift_info.py > /tmp/shift_digest.txt && /path/to/send_telegram_message.sh "@channel_or_chat_id" "$(cat /tmp/shift_digest.txt)"
```

## Existing /shift bot command integration

The `/shift` command in Telegram already handles:
- `clock_in` → creates `crew_member_shifts` row + sets live_status=online
  (start allowed only when no active shift row exists)
- `clock_out` → sets clock_out_time on the open row + live_status=offline
- `toggle_ride` → toggles between online/riding

Bot keyboard is driven by the SAME rule as the web page: active = row in
`crew_member_shifts` with `clock_out_time IS NULL`. If live_status drifted online
without an open shift row, the bot shows «Начать Смену» (not a ghost active shift),
and `clock_out` still flips live_status to offline to heal the drift.

## 🔗 Deep Links
- Crew shifts page: `https://vip-bike.ru/franchize/vip-bike/crew`
- Telegram `/shift` command: just type `/shift` in the bot

## ⚠️ Important: per-member earnings in digests (2026-08-19 review)

The user explicitly requested: when generating evening digests or shift
reports, ALWAYS show per-member earnings (a breakdown row per crew member
with their hours, rate, and earned amount), NOT just a crew total.

**Why**: The owner pays out per-member salaries on the 10th and 25th of
each month. A "Total: 4 845 ₽" line is useless for this purpose — the
owner needs to know "Paul earned 1 437 ₽, Rustam earned 1 183 ₽, etc."
to know how much to pay each person. A single total makes the digest
un-actionable.

**Required format** (mirror `scripts/export_shift_info.py`'s output):

```
📈 Итого за день:
  • Завершённых смен: 3
  • Активных смен: 1
  • Отработано часов: 24.5ч (завершено) + 4.2ч (активно)
  • Заработано: 4845₽ (по ставке 169₽/час)

🟢 АКТИВНЫЕ СМЕНЫ:
  • salavey13 (admin) — начало 18:00, длительность 4.2ч, ставка 169₽/ч, заработано 710₽

✅ ЗАВЕРШЁННЫЕ СМЕНЫ:
  • Roman (co_owner) — 09:00–17:30 (8.5ч), ставка 169₽/ч, заработано 1437₽
  • I_O_S_NN (owner) — 10:00–14:00 (4.0ч), ставка 169₽/ч, заработано 676₽
  • DJORUDJOV (member) — 12:00–19:00 (7.0ч), ставка 169₽/ч, заработано 1183₽
```

The `🟢 АКТИВНЫЕ СМЕНЫ` + `✅ ЗАВЕРШЁННЫЕ СМЕНЫ` sections give the per-member
breakdown the owner needs. The `📈 Итого за день` section is a summary
that includes the total — but the per-member rows MUST also be present.

When generating a digest from any source (Telegram bot, cron job, custom
skill), include BOTH:
- The total summary line (for "how much did we earn overall?")
- The per-member breakdown (for "how much to pay each person?")

Skipping the per-member rows makes the digest useless for salary payout.

The `/shift` command's clock_out reply (in `app/webhook-handlers/commands/shift.ts`)
similarly includes the per-shift earned amount:
```
✅ Смена завершена.
💰 Заработано: 1381 ₽ (8.2 ч × 169 ₽/ч)

Хорошего отдыха!
```

This is the user-facing equivalent — when the operator closes their shift,
they see how much they personally earned (not the crew total).

## Related Files
- **Bot command**: `app/webhook-handlers/commands/shift.ts`
- **Web page**: `app/franchize/[slug]/crew/CrewShiftsClient.tsx`
- **API**: `app/api/crew/shifts/route.ts`
- **Edge function**: `supabase/functions/handle-shift-command/index.ts` — ⚠️ LEGACY, не используется (см. выше).
- **Script**: `scripts/export_shift_info.py` (ключ из `<repo>/.env.local`, не из /home/z)
- **Migration**: `supabase/migrations/20260726000001_deposit_and_shift_tracking.sql`
- **Existing migration**: `supabase/migrations/20240728000000_crew_invites_and_shift_types.sql`
- **Sibling skills**: `deposit-tracker-text`, `crew-management-text`