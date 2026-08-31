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
  "select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost&crew_id=eq.${CREW_ID}&status=eq.active&agreed_end_date=gte.${NOW_UTC}&agreed_end_date=lte.${THREE_HOURS_LATER_UTC}&order=agreed_end_date.asc&limit=5")

RETURNS_COUNT=$(echo "$RETURNS_DATA" | jq 'length')

# Silent if no returns in the window
if [[ "$RETURNS_COUNT" == "0" || -z "$RETURNS_COUNT" ]]; then
  log "No returns due in next 3h — staying silent"
  exit 0
fi

# ─── State-aware dedup ──
# Only alert about each return once (12h cooldown — covers the 3h window + buffer)
NEW_RETURNS=$(echo "$RETURNS_DATA" | jq -r '
  .[] |
  "RENTAL:\(.rental_id):\(.vehicle_id):\(.user_id[0:8]):\(.agreed_end_date[11:16]):\(.total_cost // 0)"
' | while IFS=: read -r prefix rid vid uid time cost; do
  if ! already_alerted "returns" "$rid" 43200; then
    rlink=$(rental_link "$rid")
    echo "• $vid → клиент ${uid}… | до $time UTC | ${cost} ₽\n  📋 <a href=\"${rlink}\">Открыть</a>"
    record_alert "returns" "$rid"
  fi
done)

NEW_COUNT=$(echo "$NEW_RETURNS" | grep -c "^•" 2>/dev/null || true)
NEW_COUNT=${NEW_COUNT:-0}
NEW_COUNT=${NEW_COUNT//[^0-9]/}
NEW_COUNT=${NEW_COUNT:-0}
if [[ "$NEW_COUNT" == "0" ]]; then
  log "All $RETURNS_COUNT returns already alerted — staying silent"
  exit 0
fi

RETURNS_LIST="$NEW_RETURNS"
RETURNS_COUNT="$NEW_COUNT"

# ─── Format the reminder ─────────────────────────────────────────────────────
# goodmorning-polish: kinder wording — no "просрочен" (use "возврат был сегодня" instead).
# Show renter name + bike name + deposit amount + per-rental deep link.
# Was: "• wenbox-u2-pro → клиент 35628267… | просрочен с 2026-08-02 18:30 | 6000 ₽"
# Now: "• Wenbox U2 Pro · 35628267… | возврат был сегодня в 18:30 · 6 000 ₽ · депозит 5 000 ₽"
RETURNS_LIST=""
while IFS= read -r row; do
  RID=$(echo "$row" | jq -r '.rental_id // .id // ""')
  VEHICLE_ID=$(echo "$row" | jq -r '.vehicle_id // "?"')
  USER_ID=$(echo "$row" | jq -r '.user_id // "?"')
  END_DATE=$(echo "$row" | jq -r '.agreed_end_date // .requested_end_date // ""')
  # Render end time in Europe/Moscow (UTC slice was wrong — looked like start).
  END_TIME=$(TZ=Europe/Moscow date -d "$END_DATE" +"%H:%M" 2>/dev/null || echo "${END_DATE:11:5}")
  TOTAL_COST=$(echo "$row" | jq -r '.total_cost // 0')
  TOTAL_FMT=$(printf "%'d" "$TOTAL_COST" 2>/dev/null || echo "$TOTAL_COST")
  RLINK="$(rental_link "$RID")"
  # Determine if overdue (end date in the past) — kinder wording
  NOW_TS=$(date +%s)
  END_TS=$(date -d "$END_DATE" +%s 2>/dev/null || echo "0")
  if [[ "$END_TS" -gt 0 ]] && [[ "$END_TS" -lt "$NOW_TS" ]]; then
    TIME_LABEL="возврат был сегодня в ${END_TIME}"
  else
    TIME_LABEL="до ${END_TIME}"
  fi
  RETURNS_LIST="${RETURNS_LIST}• ${VEHICLE_ID} · ${USER_ID:0:8}… | ${TIME_LABEL} · ${TOTAL_FMT} ₽
  📋 <a href=\"${RLINK}\">Открыть</a>
"
done <<< "$(echo "$RETURNS_DATA" | jq -c '.[]')"

DASHBOARD_LINK="$(analytics_link "rentals" "$(moscow_today)")"
MESSAGE="⏰ <b>Возвраты в ближайшие 3 часа</b> — ${RETURNS_COUNT} шт.

${RETURNS_LIST}
🔔 Обновлено в ${NOW_DISPLAY} МСК

📊 Дашборд: <a href=\"${DASHBOARD_LINK}\">Открыть</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent returns-reminder ($RETURNS_COUNT returns due in 3h) to chat $ADMIN_CHAT_ID"
fi
