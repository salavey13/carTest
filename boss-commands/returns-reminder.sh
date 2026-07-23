#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/returns-reminder.sh
#
# Boss command: returns-reminder
# Sends a reminder 3 hours before each rental is due for return.
# Designed to run every hour on the hour.
#
# Output: Telegram message ONLY if there are returns due in the next 3 hours
#         (silent otherwise)
# Cron schedule: every hour at :00 Moscow = "0 * * * *" (UTC)
#
# Usage:
#   ./returns-reminder.sh
#   ./returns-reminder.sh --dry-run

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

log "Running returns-reminder check at $NOW_DISPLAY МСК"

# ─── Active rentals due for return in the next 3 hours ──────────────────────
# Compute the window in UTC (the comparison happens in Postgres).
NOW_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
THREE_HOURS_LATER_UTC=$(date -u -d '+3 hours' +"%Y-%m-%dT%H:%M:%SZ")

RETURNS_DATA=$(supabase_query "rentals" \
  "select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost&crew_id=eq.${CREW_ID}&status=eq.active&agreed_end_date=gte.${NOW_UTC}&agreed_end_date=lte.${THREE_HOURS_LATER_UTC}&order=agreed_end_date.asc")

RETURNS_COUNT=$(echo "$RETURNS_DATA" | jq 'length')

# Silent if no returns in the window
if [[ "$RETURNS_COUNT" == "0" ]]; then
  log "No returns due in next 3h — staying silent"
  exit 0
fi

# ─── Format the reminder ─────────────────────────────────────────────────────
RETURNS_LIST=$(echo "$RETURNS_DATA" | jq -r '
  map(
    "• \(.vehicle_id) → клиент \(.user_id[0:8])… | до \(.agreed_end_date[11:16]) МСК | \(.total_cost // 0) ₽"
  ) | join("\n")
')

MESSAGE="⏰ <b>Возвраты в ближайшие 3 часа</b> — ${RETURNS_COUNT} шт.

${RETURNS_LIST}

🔔 Проверено в ${NOW_DISPLAY} МСК

🌐 <a href=\"https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2\">Открыть дашборд</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent returns-reminder ($RETURNS_COUNT returns due in 3h) to chat $ADMIN_CHAT_ID"
fi
