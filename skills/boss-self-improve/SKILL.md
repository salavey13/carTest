---
name: boss-self-improve
description: >
  The boss improves itself on every run. Reads error logs, identifies patterns,
  suggests fixes, learns from past mistakes. No silent deaths — always notifies
  admin on retry needed and retries on next cron.
  Trigger phrases: "boss debug", "boss errors", "self improve", "что сломалось",
  "boss health", "retry failed", "boss self-heal".
---

# boss-self-improve

Триггер-фразы: **`boss debug`**, **`boss errors`**, **`self improve`**, **`что сломалось`**, **`boss health`**, **`retry failed`**

## Philosophy

The boss is not a static tool — it's a **living system** that gets better with every interaction. This skill:

1. **Never dies silently** — every error sends a Telegram notification to admin (413553377)
2. **Learns from mistakes** — reads error patterns, suggests fixes
3. **Self-heals** — retries failed operations on the next cron run
4. **Self-documents** — every enhancement is logged
5. **Reads its own source code** — the repo is right there, use it

## Architecture

```
boss-commands/
├── _lib.sh              # Shared library (env, helpers, dedup, links)
├── _error_handler.sh    # Error trap + notification + self-debug (source this!)
├── morning-standup.sh   # 09:00 daily
├── evening-summary.sh   # 21:00 daily
├── ... (9 total)
```

Every boss script should start with:
```bash
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
source "$(dirname "$0")/_error_handler.sh"
```

The `_error_handler.sh` provides:
- `trap ERR` → sends Telegram notification on any unhandled error
- `trap EXIT` → logs execution time
- `_boss_retry_check` → detects if this is a retry after a previous retry needed
- `boss_self_debug` → analyzes error patterns and suggests fixes

## Commands

### 1. boss-health
Check the health of all boss commands — last run time, success/retry needed, error count.

```bash
# Check error log
cat /tmp/boss-errors/error-log.txt 2>/dev/null | tail -20

# Check which scripts ran recently
for script in morning-standup evening-summary return-alert returns-reminder; do
  last_run=$(stat -c %Y "/tmp/boss-errors/last-run-${script}" 2>/dev/null || echo 0)
  if [[ $last_run -gt 0 ]]; then
    age=$(( $(date +%s) - last_run ))
    echo "  $script: last ran ${age}s ago"
  else
    echo "  $script: never ran"
  fi
done
```

### 2. boss-self-debug
Analyze error patterns, suggest fixes.

```bash
source _error_handler.sh
boss_self_debug
```

Output:
```
=== Boss Self-Debug Report ===

Errors by script:
  12 return-alert.sh
  3 evening-summary.sh
  1 morning-standup.sh

Error patterns:
  Supabase 525 SSL: 8
  jq parse errors: 2
  curl timeouts: 5

Suggested fixes:
  ⚠️ Multiple Supabase SSL errors — consider adding retry logic
  ⚠️ jq parse errors — Supabase returning HTML error pages instead of JSON
```

### 3. boss-self-heal
Attempt to fix common issues automatically.

```bash
# 1. Check if _lib.sh secrets are valid
source _lib.sh
curl -s "$URL/rest/v1/crews?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -e '.[0].id' >/dev/null 2>&1 || {
  echo "❌ Supabase connection failed — check SUPABASE_SERVICE_ROLE_KEY"
  send_telegram "🚨 Boss can't connect to Supabase — check secrets.txt" "HTML"
}

# 2. Check if Telegram bot is working
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | jq -e '.ok' >/dev/null 2>&1 || {
  echo "❌ Telegram bot not responding — check BOT_TOKEN"
}

# 3. Clear stale state files (older than 48h)
find /tmp/boss-* -mtime +2 -delete 2>/dev/null || true

# 4. Verify all scripts are executable
for script in boss-commands/*.sh; do
  [[ -x "$script" ]] || chmod +x "$script"
done

echo "✅ Self-heal complete"
```

### 4. boss-learn
Read the repo source code, find interesting patterns, suggest improvements.

```bash
# Read the actual rental pricing calculator to understand price computation
curl -s "https://raw.githubusercontent.com/salavey13/carTest/main/lib/rental-pricing-calculator.ts" | head -50

# Read doc-manual.ts to understand how rentals are created
curl -s "https://raw.githubusercontent.com/salavey13/carTest/main/app/webhook-handlers/commands/doc-manual.ts" | grep -A5 'createRentalFromDocContract'

# Check for new migrations
curl -s "https://api.github.com/repos/salavey13/carTest/contents/supabase/migrations?ref=main" | jq -r '.[].name' | tail -5

# Check for new skills
curl -s "https://api.github.com/repos/salavey13/carTest/contents/skills?ref=main" | jq -r '.[].name' | wc -l
```

### 5. boss-experiment
Try something new — pick a random table, query it, see if there's useful data.

```bash
# Get list of all tables
TABLES=$(curl -s "$URL/rest/v1/" -H "apikey: $KEY" | jq -r '.definitions | keys[]' | sort -R | head -3)

for table in $TABLES; do
  echo "=== $table ==="
  curl -s "$URL/rest/v1/$table?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq 'if type == "array" and length > 0 then (.[0] | keys) else "empty" end'
done
```

## No silent deaths — error notification protocol

When ANY boss command fails:

1. **Trap fires** → `_boss_error_handler` sends Telegram notification:
   ```
   🚨 Boss error — return-alert.sh
   Script: return-alert.sh
   Function: main
   Line: 28
   Exit code: 1
   Error: curl failed to connect to Supabase

   🤖 I'll retry on the next cron run.
   ```

2. **Error logged** → `/tmp/boss-errors/error-log.txt` gets a line

3. **Retry marker** → `/tmp/boss-errors/last-fail-{script}` is created

4. **Next cron run** → `_boss_retry_check` detects the retry marker, logs "RETRY after retry needed", removes the marker

5. **If retry succeeds** → normal operation resumes, admin gets no further notifications

6. **If retry fails 3× in a row** → boss-self-heal runs automatically, checks connectivity, clears stale state, notifies admin with "🚨 3 consecutive retry neededs — needs manual intervention"

## Self-improvement loop

Every week (Monday 10:00, before weekly-revenue):

1. **boss-self-debug** runs — analyzes error patterns
2. **boss-learn** runs — reads repo, finds new tables/columns/skills
3. **Suggestions sent to admin**:
   ```
   🤖 Weekly self-improvement report:

   📊 Last week: 42 runs, 3 errors (7% retry rate)
   ⚠️ Pattern: Supabase 525 SSL errors spiking on weekends

   📚 I learned:
   • New table: crew_shifts (shift tracking) — I can now track work hours
   • New column: rentals.deposit_amount — I can now track deposits
   • New skill: deposit-tracker-text — I can query deposit status

   💡 Suggestions:
   1. Add deposit-outstanding to morning-standup
   2. Add shift-check-in button to morning-standup
   3. Reduce return-alert frequency on weekends (less traffic)

   Shall I implement any of these? Reply with numbers.
   ```

## 🔗 Deep Links
- Analytics: `analytics_link "rentals"`
- Leads: `lead_segment_link "hot"`

## Related Files
- `boss-commands/_error_handler.sh` — the error handler itself
- `boss-commands/_lib.sh` — shared library
- `/tmp/boss-errors/error-log.txt` — error log
- `/tmp/boss-alerts-state.json` — dedup state
