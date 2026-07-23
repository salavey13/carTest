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
  "select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost,created_by_operator_chat_id&crew_id=eq.${CREW_ID}&status=eq.active&agreed_end_date=lt.${NOW_UTC}&order=agreed_end_date.asc")

OVERDUE_COUNT=$(echo "$OVERDUE_DATA" | jq 'length')

# Silent if no overdue rentals — don't spam the chat
if [[ "$OVERDUE_COUNT" == "0" ]]; then
  log "No overdue rentals — staying silent"
  exit 0
fi

# ─── Format the alert ────────────────────────────────────────────────────────
OVERDUE_LIST=$(echo "$OVERDUE_DATA" | jq -r '
  map(
    "• \(.vehicle_id) → клиент \(.user_id[0:8])… | просрочен с \(.agreed_end_date[0:10]) \(.agreed_end_date[11:16]) | \(.total_cost // 0) ₽"
  ) | join("\n")
')

# Severity emoji
if [[ "$OVERDUE_COUNT" -ge 5 ]]; then
  SEVERITY="🔴🔴"
elif [[ "$OVERDUE_COUNT" -ge 2 ]]; then
  SEVERITY="🔴"
else
  SEVERITY="🟠"
fi

MESSAGE="${SEVERITY} <b>Просроченные аренды</b> — ${OVERDUE_COUNT} шт.

${OVERDUE_LIST}

🔔 Проверено в ${NOW_DISPLAY} МСК

🌐 <a href=\"https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2\">Открыть дашборд</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent overdue-alert ($OVERDUE_COUNT overdue rentals) to chat $ADMIN_CHAT_ID"
fi
