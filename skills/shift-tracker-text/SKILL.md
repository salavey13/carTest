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

## When to use

- Evening digests (cron job at ~22:00)
- "Who is on shift right now?" queries
- "How much did we earn today?" queries
- Before/after shift handoff

## How to run

```bash
# Today's report (default)
python3 /home/z/my-project/scripts/export_shift_info.py

# Specific date
python3 /home/z/my-project/scripts/export_shift_info.py --date 2026-08-17

# JSON format (for programmatic use)
python3 /home/z/my-project/scripts/export_shift_info.py --format json
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
0 22 * * * /usr/bin/python3 /home/z/my-project/scripts/export_shift_info.py > /tmp/shift_digest.txt && /path/to/send_telegram_message.sh "@channel_or_chat_id" "$(cat /tmp/shift_digest.txt)"
```

## Related files

- Script: `/home/z/my-project/scripts/export_shift_info.py`
- Related skills: `shift-tracker-text` (this), `catalog-csv-exporter`, `rentals-csv-exporter`
