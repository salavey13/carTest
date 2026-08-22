# vip-bike-ops — Boss Commands & Cron Schedule

> **What this is**: 6 high-level "boss commands" — composite runbooks that
> run multiple skill queries in parallel, synthesize the result, and push a
> notification to the admin's Telegram.
>
> **Testing target**: All notifications are hardcoded to chat_id `413553377`
> (salavey13, admin). When the bot-to-chat-reply flow is built, this will
> change — but for now, this is the testing pipeline.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Cron daemon (VPS or wherever)                              │
│  └─► triggers boss-commands/<script>.sh at scheduled times  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  boss-commands/<script>.sh                                  │
│  ├─ source _lib.sh                                          │
│  ├─ supabase_query "table" "select=..." | jq '...'         │
│  ├─ (maybe 2-3 parallel queries)                            │
│  ├─ compose HTML message                                    │
│  └─ send_telegram "$MESSAGE" "HTML"                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Telegram Bot API                                           │
│  POST https://api.telegram.org/bot<TOKEN>/sendMessage       │
│  { chat_id: "413553377", text: "...", parse_mode: "HTML" }  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                📱 salavey13's Telegram
                  (the admin's phone)
```

**Key principle**: cron runs the script → script sends a notification. The
bot does NOT listen for replies yet (that's the future "interactive bot"
phase). For now this is a one-way notification pipeline.

---

## 2. Files

```
boss-commands/
├── _lib.sh                    # shared library (env vars, send_telegram, helpers)
├── morning-standup.sh         # 09:00 daily — hot leads + returns + overdue + todos
├── evening-summary.sh         # 21:00 daily — KPIs across all 3 tabs
├── returns-reminder.sh        # every hour — returns due in next 3h
├── overdue-alert.sh           # every 2h 09-21 — overdue rentals (silent if none)
├── qr-claim-watchdog.sh       # every 4h 09-21 — unclaimed QRs > 17h old
└── weekly-revenue.sh          # Monday 10:00 — weekly revenue report
```

All scripts support `--dry-run` to print to stdout instead of sending Telegram
(useful for debugging without spamming the admin).

---

## 3. Cron schedule table

Times are in Europe/Moscow (UTC+3). Cron expressions are in UTC (the typical
server timezone). The mapping is `UTC_time = Moscow_time − 3 hours`.

| Script | Moscow schedule | UTC cron | Silent? | Purpose |
|---|---|---|---|---|
| `morning-standup.sh` | 09:00 daily | `0 6 * * *` | No | Morning standup: hot leads + returns + overdue + todos |
| `evening-summary.sh` | 21:00 daily | `0 18 * * *` | No | End-of-day KPI digest (rentals + sales + services) |
| `returns-reminder.sh` | every hour, 09-21 | `0 6,7,8,...,18 * * *` → `0 6-18 * * *` | Yes (if none) | Returns due in next 3 hours |
| `overdue-alert.sh` | every 2h, 09-21 | `0 5,7,9,11,13,15,17,19 * * *` | Yes (if none) | Active rentals past agreed_end_date |
| `qr-claim-watchdog.sh` | every 4h, 09-21 | `0 5,9,13,17 * * *` | Yes (if none) | Unclaimed QR codes > 17h old |
| `weekly-revenue.sh` | Monday 10:00 | `0 7 * * 1` | No | Weekly revenue report (last 7 days) |

**"Silent?"** — scripts marked "Yes" only send a Telegram message if there's
something to report (e.g. overdue-alert stays quiet when there are 0 overdue
rentals). Scripts marked "No" always send — even if the answer is "0 hot leads".

### Cron install commands

Add these to the admin user's crontab on the VPS (or wherever the cron runs):

```cron
# vip-bike-ops boss commands
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# 09:00 Moscow daily — morning standup
0 6 * * * /home/z/my-project/analytics/boss-commands/morning-standup.sh >> /var/log/vip-bike-ops.log 2>&1

# 21:00 Moscow daily — evening summary
0 18 * * * /home/z/my-project/analytics/boss-commands/evening-summary.sh >> /var/log/vip-bike-ops.log 2>&1

# Every hour 09-21 Moscow — returns reminder (silent if none)
0 6-18 * * * /home/z/my-project/analytics/boss-commands/returns-reminder.sh >> /var/log/vip-bike-ops.log 2>&1

# Every 2h 09-21 Moscow — overdue alert (silent if none)
0 5,7,9,11,13,15,17,19 * * * /home/z/my-project/analytics/boss-commands/overdue-alert.sh >> /var/log/vip-bike-ops.log 2>&1

# Every 4h 09-21 Moscow — QR claim watchdog (silent if none)
0 5,9,13,17 * * * /home/z/my-project/analytics/boss-commands/qr-claim-watchdog.sh >> /var/log/vip-bike-ops.log 2>&1

# Monday 10:00 Moscow — weekly revenue report
0 7 * * 1 /home/z/my-project/analytics/boss-commands/weekly-revenue.sh >> /var/log/vip-bike-ops.log 2>&1
```

Logs go to `/var/log/vip-bike-ops.log` — rotate with logrotate or truncate manually.

---

## 4. Per-command detail

### 4.1 morning-standup.sh — 🌅 Утренняя сводка

**Schedule**: 09:00 Moscow daily (`0 6 * * *` UTC)
**Silent**: No — always sends (even if all sections are "0")
**Audience**: All operators (currently just salavey13 for testing)

**What it sends** (4 sections):

```
🔥 Утренняя сводка — 2026-07-24, 09:00 МСК

📍 Горячие лиды (3):
• Рудометов Михаил — срочность 95 — telegram_bot — 2026-07-23
• Алимов Станислав — срочность 90 — telegram_bot — 2026-07-23
• Киргинцев Михаил — срочность 90 — telegram_bot — 2026-07-11

📍 Возвраты сегодня (2):
• falcon-pro-2025 → клиент 35628267… — до 18:00 — 7000 ₽
• yamaha-r7 → клиент 73638759… — до 20:00 — 45000 ₽

📍 Просроченные аренды (5):
• falcon-pro-2025 → клиент 35628267… — просрочен с 2026-07-11
• suzuki-gsx-s1000f → клиент 66290069… — просрочен с 2026-07-12
...

📍 Задачи с просрочкой (10):
• 🟡 Подтвердить начальный одометр — срок 2026-06-18
• 🟡 Подтвердить даты аренды — срок 2026-06-18
...

🌐 Открыть дашборд
```

**Queries** (4 parallel):
1. `franchize_intents?urgency_score=gte.70&stage=neq.dismissed` → top 5 hot leads
2. `rentals?status=eq.active&agreed_end_date=gte.<today>T00:00:00+03:00&agreed_end_date=lte.<today>T23:59:59+03:00` → returns due today
3. `rentals?status=eq.active&agreed_end_date=lt.<now_utc>` → overdue
4. `crew_todos?status=neq.done&due_date=lte.<today>T23:59:59Z` → overdue todos

**PII masking**: user_id shown as `XXXXXXXX…` (first 8 chars). Phone never shown.
**Fail-safe**: if any query fails, that section shows "Нет данных" instead of crashing.

---

### 4.2 evening-summary.sh — 📊 Итоги дня

**Schedule**: 21:00 Moscow daily (`0 18 * * *` UTC)
**Silent**: No — always sends
**Audience**: All operators

**What it sends** (3 KPI blocks + total):

```
📊 Итоги дня — 2026-07-24, 21:00 МСК

🏍 Аренды
Аренд сегодня: 5
Выручка: 85000 ₽
Активных: 22
Завершено: 3

💰 Продажи
Продаж сегодня: 2
Выручка: 550000 ₽

🔧 Сервис
Сервисов сегодня: 3
Выручка: 6500 ₽
Активных: 1
Завершено: 2

━━━━━━━━━━━━━━━━━━
Итого выручка за день: 641500 ₽

🌐 Открыть дашборд
```

**Queries** (3 parallel):
1. Rentals for today (created OR period-overlapping) — KPIs: total / revenue (active+completed) / active / completed
2. Sales for today (created today) — KPIs: total / revenue (`total_sum ?? sale_price`)
3. Service rentals for today (vehicle_id IN cars.type='service') — KPIs: total / revenue / active / completed

**Defensive parsing**: `sale_price` can be a string with spaces ("420 000") — the jq filter strips spaces and uses `tonumber? // 0` fallback.

---

### 4.3 returns-reminder.sh — ⏰ Returns reminder

**Schedule**: every hour 09-21 Moscow (`0 6-18 * * *` UTC)
**Silent**: YES — only sends if there are returns due in the next 3 hours
**Audience**: All operators

**What it sends** (only when there are imminent returns):

```
⏰ Возвраты в ближайшие 3 часа — 2 шт.

• falcon-pro-2025 → клиент 35628267… | до 18:00 МСК | 7000 ₽
• yamaha-r7 → клиент 73638759… | до 20:00 МСК | 45000 ₽

🔔 Проверено в 15:00 МСК

🌐 Открыть дашборд
```

**Queries** (1):
1. `rentals?status=eq.active&agreed_end_date=gte.<now_utc>&agreed_end_date=lte.<now+3h_utc>` → returns in 3h window

**Why silent**: this runs 13 times a day (every hour 09-21). If it always sent, the admin would get 13 messages/day even on days with zero returns. Silent mode = signal, not noise.

---

### 4.4 overdue-alert.sh — 🔴 Overdue alert

**Schedule**: every 2h 09-21 Moscow (`0 5,7,9,11,13,15,17,19 * * *` UTC)
**Silent**: YES — only sends if there are overdue rentals
**Audience**: All operators

**What it sends** (only when there are overdue):

```
🔴🔴 Просроченные аренды — 5 шт.

• falcon-pro-2025 → клиент 35628267… | просрочен с 2026-07-11 18:00 | 7000 ₽
• suzuki-gsx-s1000f → клиент 66290069… | просрочен с 2026-07-12 09:00 | 13008 ₽
...

🔔 Проверено в 13:00 МСК

🌐 Открыть дашборд
```

**Severity emojis**:
- 🟠 = 1 overdue
- 🔴 = 2-4 overdue
- 🔴🔴 = 5+ overdue (critical)

**Queries** (1):
1. `rentals?status=eq.active&agreed_end_date=lt.<now_utc>` → all overdue active rentals

---

### 4.5 qr-claim-watchdog.sh — 🔴 QR claim watchdog

**Schedule**: every 4h 09-21 Moscow (`0 5,9,13,17 * * *` UTC)
**Silent**: YES — only sends if there are stale unclaimed QRs
**Audience**: All operators

**What it sends**:

```
🔴 QR не принят > 17 часов — 1 шт.

• Комков Алексей Сергеевич → аренда 1a8a1ffd… | QR отправлен 2026-07-18 18:27

🔔 Проверено в 13:00 МСК

💬 Действия:
1. Отправить клиенту напоминание в Telegram
2. Проверить правильность телефона/email
3. Сгенерировать новый QR если истёк

🌐 Открыть лиды
```

**Queries** (1):
1. `user_rental_secrets?qr_claimed_at=is.null&qr_generated_at=lt.<17h_ago_utc>` (private schema)

**17h threshold**: matches the leads page's `unclaimed_qr_age` SLA signal threshold (yellow > 17h, red > 48h).

---

### 4.6 weekly-revenue.sh — 📅 Weekly revenue

**Schedule**: Monday 10:00 Moscow (`0 7 * * 1` UTC)
**Silent**: No — always sends (even if revenue is 0)
**Audience**: All operators + owner (356282674)

**What it sends**:

```
📅 Недельный отчёт — 16.07 — 23.07

💰 Итого выручка: 1185000 ₽

Разбивка по потокам:
• 🏍 Аренды: 0 ₽ (0 сделок)
• 💰 Продажи: 1185000 ₽ (2 сделок)
• 🔧 Сервис: 0 ₽ (0 заказов)

Топ-3 байка по выручке:
• falcon-pro-2025 — 0 аренд — 0 ₽
...

🌐 Открыть дашборд
```

**Queries** (3 parallel for the 7-day window):
1. Rentals in last 7 days (status=active or completed)
2. Sales in last 7 days
3. Service rentals in last 7 days

Plus a `group_by(.vehicle_id)` jq aggregation for top-3 bikes by rental revenue.

---

## 5. _lib.sh — shared library API

Every boss script sources `_lib.sh` at the top. The library provides:

### Env vars (exported)
- `URL` — Supabase URL
- `KEY` — Supabase service role key (NEVER echo this)
- `CREW_ID` — `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`
- `CREW_SLUG` — `vip-bike`
- `BOT_TOKEN` — Telegram bot token
- `ADMIN_CHAT_ID` — `413553377` (salavey13, hardcoded for testing)

### Functions (exported with `export -f`)

| Function | Usage | Returns |
|---|---|---|
| `moscow_today` | `TODAY=$(moscow_today)` | `2026-07-24` |
| `moscow_now` | `echo $(moscow_now)` | `2026-07-24 09:00 MSK` |
| `moscow_now_iso` | `ISO=$(moscow_now_iso)` | `2026-07-24T06:00:00Z` (UTC) |
| `mask_phone "+79991234567"` | — | `+7XXXXXXXX67` |
| `mask_email "ivan@x.ru"` | — | `i…@x.ru` |
| `mask_passport "1234567890"` | — | `XXXX…7890` |
| `send_telegram "msg" "HTML"` | — | exit 0 on success, 1 on failure |
| `log "msg"` | — | writes to stderr |
| `supabase_query "table" "select=..."` | — | JSON to stdout |
| `html_escape "<b>text</b>"` | — | `&lt;b&gt;text&lt;/b&gt;` |

### Key implementation notes

1. **`+03:00` URL-encoding**: `supabase_query` rewrites `+` to `%2B` so timezone offsets like `+03:00` survive curl. Without this, `+03:00` becomes ` 03:00` (space) and PostgREST returns `"invalid input syntax for type timestamp with time zone"`.

2. **`send_telegram` failure isolation**: a Telegram API error does NOT crash the script — it logs and returns 1. This is intentional: if the admin's chat is unreachable, we still want the script to exit cleanly so cron doesn't keep retrying.

3. **`log` writes to stderr only**: stdout is reserved for command output (when `--dry-run` is used). This lets you pipe the script's output to other tools without log noise.

4. **PII masking is built-in**: `mask_phone` / `mask_email` / `mask_passport` are available to every script. Use them whenever you'd otherwise emit raw PII.

5. **Secrets parsing**: `_lib.sh` reads `SECRETS_FILE` (default `/home/z/my-project/upload/secrets.txt`) and parses `key=value` lines. The bot token is on line 3 as a bare string (no key=) — `_lib.sh` extracts it explicitly via `sed -n '3p'`.

---

## 6. Testing workflow

### Smoke test (no Telegram)

Every script supports `--dry-run`:

```bash
cd /home/z/my-project/analytics/boss-commands

./morning-standup.sh --dry-run
./evening-summary.sh --dry-run
./returns-reminder.sh --dry-run
./overdue-alert.sh --dry-run
./qr-claim-watchdog.sh --dry-run
./weekly-revenue.sh --dry-run
```

This prints the message (HTML stripped) to stdout. The script logs to stderr
(so you see "Running X for Y" prefixed with timestamp). No Telegram message
is sent.

### Real send test (sends to ADMIN_CHAT_ID = 413553377)

```bash
./morning-standup.sh        # sends a real Telegram notification
```

Check salavey13's Telegram — should arrive within 1-2 seconds.

### Cron test

To verify the cron schedule works without waiting:

```bash
# Temporarily run all 6 scripts at once
for script in morning-standup evening-summary returns-reminder overdue-alert qr-claim-watchdog weekly-revenue; do
  ./${script}.sh
  sleep 2  # avoid Telegram rate limit
done
```

### Debug a failing script

```bash
# Run with bash -x to see every command
bash -x ./morning-standup.sh --dry-run 2>&1 | less
```

---

## 7. Future: bot-to-chat-reply flow

The current pipeline is **one-way** (cron → script → Telegram). The next phase
is **two-way** (operator sends message to bot → bot routes to vip-bike-ops
skill → skill responds in chat).

### What changes

```
NOW (one-way notifications):
  cron ─► script ─► send_telegram ─► admin's phone

FUTURE (two-way chat):
  admin ─► /morning      ─► bot ─► morning-standup.sh    ─► reply in chat
  admin ─► "лиды"        ─► bot ─► vip-bike-ops umbrella ─► reply in chat
  admin ─► "аренда ABC"  ─► bot ─► rental-card-text      ─► reply in chat
```

### Migration plan

1. **Phase 1 (current)**: hardcoded `ADMIN_CHAT_ID`. All notifications go to salavey13.
2. **Phase 2 (next)**: bot listens for messages in a private chat. When admin sends a slash command or natural-language request, bot runs the matching boss-command script (or routes to vip-bike-ops umbrella) and replies with the script's stdout.
3. **Phase 3 (final)**: per-operator routing. Notifications go to the operator who owns the rental/lead, not just salavey13.

### What stays the same

- `_lib.sh` is reusable — `send_telegram` will accept a `chat_id` parameter.
- All 6 boss-command scripts will work as both cron-triggered AND bot-triggered.
- The cron schedule stays — even when the bot is live, cron still pushes morning-standup at 09:00.

---

## 8. Adding a new boss command

To add a 7th scheduled notification:

1. **Copy an existing script** as a template (e.g. `cp overdue-alert.sh my-new-command.sh`).
2. **Edit the header comment** with: schedule, silent?, purpose.
3. **Replace the queries** in the body — use `supabase_query` (parallel calls if needed).
4. **Replace the jq filters** — keep output Russian, mask PII.
5. **Compose the message** as HTML (Telegram parse_mode=HTML supports `<b>`, `<i>`, `<a href="">`, `<code>`, `<pre>`).
6. **Test with `--dry-run`** until output looks right.
7. **Test with real send** (remove `--dry-run`).
8. **Add a cron entry** to this doc's table + crontab snippet.
9. **Push to GitHub** under `boss-commands/`.

### Template

```bash
#!/usr/bin/env bash
# boss-commands/my-new-command.sh
#
# Boss command: my-new-command
# <Purpose in one line>
#
# Schedule: <Moscow time> daily/weekly = <UTC cron>
# Silent: Yes/No
#
# Usage:
#   ./my-new-command.sh              # sends Telegram
#   ./my-new-command.sh --dry-run    # prints to stdout

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

log "Running my-new-command at $NOW_DISPLAY МСК"

# ─── Query ───────────────────────────────────────────────────────────────────
DATA=$(supabase_query "table" "select=col1,col2&crew_id=eq.${CREW_ID}&filter=eq.value")
COUNT=$(echo "$DATA" | jq 'length')

# Silent if empty (optional)
if [[ "$COUNT" == "0" ]]; then
  log "Nothing to report — staying silent"
  exit 0
fi

# ─── Format ──────────────────────────────────────────────────────────────────
LIST=$(echo "$DATA" | jq -r 'map("• \(.col1) — \(.col2)") | join("\n")')

MESSAGE="🔔 <b>My new command</b> — ${COUNT} шт.

${LIST}

🔔 Проверено в ${NOW_DISPLAY} МСК

🌐 <a href=\"https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2\">Открыть дашборд</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent my-new-command ($COUNT items) to chat $ADMIN_CHAT_ID"
fi
```

---

## 9. Anti-hallucination reminders for cron authors

When writing a new boss command:

1. **Verify table + column names** with `curl -s "$URL/rest/v1/<table>?select=*&limit=1" -H "apikey: $KEY"` before writing the query. Don't guess.
2. **Verify the private-schema header** — `user_rental_secrets`, `sale_contract_artifacts`, `rental_handoffs` all need `-H "Accept-Profile: private"`. Use the 3rd arg of `supabase_query`: `supabase_query "user_rental_secrets" "..." "private"`.
3. **Use `TZ=Europe/Moscow date`** for "today" — never `date -u` (UTC would be wrong 00:00-03:00 Moscow).
4. **Use `+03:00` offset bounds** for date-range queries on timestamptz columns — `supabase_query` auto-encodes the `+` to `%2B`.
5. **Defensive number parsing** — `total_sum` may be NULL, `sale_price` may be a string with spaces. Use `tonumber? // 0` in jq.
6. **Always mask PII** — `mask_phone`, `mask_email`, `mask_passport` are exported from `_lib.sh`.
7. **Always include the web link** at the end — gives the admin a one-tap deep-link to the dashboard.
8. **Test with `--dry-run` first** — never push a real Telegram message during development.
9. **Don't fail loudly** — if a query errors, log it and continue. The admin should still get the other sections of the digest.
10. **Don't spam** — silent scripts should stay silent when there's nothing to report. A daily "0 overdue rentals" message is noise.

---

## 10. Operations runbook

### How to disable all cron notifications (emergency mute)

Add to the top of `_lib.sh`:

```bash
# EMERGENCY MUTE — uncomment to disable all send_telegram calls
send_telegram() { log "MUTED: would send $1"; return 0; }
```

Or simpler — touch `/home/z/my-project/analytics/boss-commands/.mute` and add a check at the top of `_lib.sh`:

```bash
if [[ -f "$(dirname "${BASH_SOURCE[0]}")/.mute" ]]; then
  send_telegram() { log "MUTED via .mute file"; return 0; }
fi
```

### How to change the target chat_id (when bot goes live)

Edit `_lib.sh`, find `ADMIN_CHAT_ID="${ADMIN_CHAT_ID:-413553377}"`, change the default. Or set `ADMIN_CHAT_ID` in the environment before sourcing:

```bash
export ADMIN_CHAT_ID=244736261  # Roman
./morning-standup.sh
```

### How to add a new admin to all notifications

For testing this is hardcoded. When the bot is live, the admin list will come
from the `crew_members` table. Until then, to send to 2 chats, modify
`send_telegram` to loop:

```bash
send_telegram() {
  local text="$1"
  local parse_mode="${2:-HTML}"
  for chat_id in 413553377 356282674; do  # salavey13 + I_O_S_NN
    # ... existing send logic, but use $chat_id instead of $ADMIN_CHAT_ID
  done
}
```

### How to debug a script that's failing silently

```bash
# 1. Check the log
tail -50 /var/log/vip-bike-ops.log

# 2. Re-run with bash -x
bash -x ./morning-standup.sh --dry-run 2>&1 | less

# 3. Check the raw Supabase response
source _lib.sh
supabase_query "table" "select=..." | jq .

# 4. Check the Telegram API directly
source _lib.sh
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | jq .
```
