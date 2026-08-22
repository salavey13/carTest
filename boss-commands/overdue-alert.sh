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
# BUG FIX (user-reported): The script was using `.agreed_end_date[11:16]` which
# gives RAW UTC time. For example, rental with end=09:30 UTC (=12:30 MSK) was
# displayed as "возврат был 09.08 в 09:30" — operator reading this in MSK
# context interpreted "09:30" as the START time (which is 09:30 MSK = 06:30 UTC).
# The actual end time is 12:30 MSK but never showed.
#
# FIX: Pass the full ISO timestamp through the `moscow_fmt` helper which
# converts UTC → Moscow time. Display label now uses "МСК" suffix explicitly.
OVERDUE_LIST=$(echo "$OVERDUE_DATA" | jq -r '
  map(
    "\(.rental_id)\t\(.vehicle_id)\t\(.user_id[0:8])\t\(.agreed_end_date)\t\(.total_cost // 0)"
  ) | join("\n")
')

# Format with per-rental deep links
FORMATTED=""
while IFS=$'\t' read -r rid vid uid end_iso cost; do
  rl=$(rental_link "$rid")
  end_msk=$(moscow_fmt "$end_iso")
  FORMATTED="${FORMATTED}• ${vid} · ${uid}… | возврат был ${end_msk} | ${cost} ₽
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
