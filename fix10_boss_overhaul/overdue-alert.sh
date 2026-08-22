#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/overdue-alert.sh
#
# Boss command: overdue-alert
# Sends an alert when there are NEW overdue rentals (active rentals past their
# agreed_end_date). Designed to run every 2 hours during business hours.
#
# Output: Telegram message ONLY if there are overdue rentals (silent otherwise)
# Cron schedule: every 2h from 09:00-21:00 Moscow = "0 5,7,9,11,13,15,17,19 * * *"
#
# Usage:
#   ./overdue-alert.sh
#   ./overdue-alert.sh --dry-run

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
NOW_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

log "Running overdue-alert check at $NOW_DISPLAY МСК"

# ─── Get all active rentals past their agreed_end_date ──────────────────────
OVERDUE_DATA=$(supabase_query "rentals" \
  "select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost,created_by_operator_chat_id&crew_id=eq.${CREW_ID}&status=eq.active&agreed_end_date=lt.${NOW_UTC}&order=agreed_end_date.asc&limit=5")

OVERDUE_COUNT=$(echo "$OVERDUE_DATA" | jq 'length')

# Silent if no overdue rentals — don't spam the chat
if [[ "$OVERDUE_COUNT" == "0" || -z "$OVERDUE_COUNT" ]]; then
  log "No overdue rentals — staying silent"
  exit 0
fi

# ─── State-aware dedup (script-level batch cooldown) ──
# Only fire once per 4h for overdue alerts (cron runs every 2h)
if already_alerted "overdue_batch" "all" 14400; then
  log "Overdue alerts already sent in last 4h — staying silent"
  exit 0
fi
record_alert "overdue_batch" "all"

# ─── Format the alert ────────────────────────────────────────────────────────
OVERDUE_LIST=$(echo "$OVERDUE_DATA" | jq -r '
  map(
    "\(.rental_id)\t\(.vehicle_id)\t\(.user_id[0:8])\t\(.agreed_end_date[0:10])\t\(.agreed_end_date[11:16])\t\(.total_cost // 0)"
  ) | join("\n")
')

# Format with per-rental deep links
FORMATTED=""
while IFS=$'\t' read -r rid vid uid date time cost; do
  rl=$(rental_link "$rid")
  # goodmorning-polish: kinder wording — "просрочен с" → "возврат был" + show hours overdue
  NOW_TS=$(date +%s)
  END_TS=$(date -d "${date} ${time}" +%s 2>/dev/null || echo "0")
  HOURS_OVERDUE=0
  if [[ "$END_TS" -gt 0 ]]; then
    HOURS_OVERDUE=$(( (NOW_TS - END_TS) / 3600 ))
  fi
  if [[ "$HOURS_OVERDUE" -gt 0 ]]; then
    TIME_LABEL="возврат был ${date:8:2}.${date:5:2} в ${time} (прошло ${HOURS_OVERDUE} ч)"
  else
    TIME_LABEL="возврат был ${date:8:2}.${date:5:2} в ${time}"
  fi
  FORMATTED="${FORMATTED}• ${vid} · ${uid}… | ${TIME_LABEL} | ${cost} ₽
  📋 <a href=\"${rl}\">Открыть</a>
"
done <<< "$OVERDUE_LIST"
OVERDUE_LIST="$FORMATTED"

# Severity emoji
if [[ "$OVERDUE_COUNT" -ge 5 ]]; then
  SEVERITY="🔴🔴"
elif [[ "$OVERDUE_COUNT" -ge 2 ]]; then
  SEVERITY="🔴"
else
  SEVERITY="🟠"
fi

DASHBOARD_LINK="$(analytics_link "rentals")"
MESSAGE="${SEVERITY} <b>Аренды ждут возврата</b> — ${OVERDUE_COUNT} шт.

${OVERDUE_LIST}

🔔 Обновлено в ${NOW_DISPLAY} МСК

📊 Дашборд: <a href=\"${DASHBOARD_LINK}\">Открыть</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent overdue-alert ($OVERDUE_COUNT overdue rentals) to chat $ADMIN_CHAT_ID"
fi
