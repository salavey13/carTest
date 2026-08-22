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
#
# BUG FIX (user-reported): Previously the script used `.agreed_end_date[11:16]`
# to extract the time — this gets the RAW UTC time (e.g. "18:00" for a 21:00 MSK
# return). Operator reading "до 18:00 UTC" mentally parsed it as MSK 18:00,
# which happens to be the START time of the rental — so they thought the script
# was showing start times instead of end times.
#
# FIX: Now we extract the full ISO string and convert it to Moscow time via
# moscow_hhmm() before display. So "2026-08-10T18:00:00+00:00" → "21:00" (MSK).
# The display label is also changed from "до 18:00 UTC" to "до 21:00 МСК" —
# explicit timezone removes all ambiguity.
NEW_RETURNS=$(echo "$RETURNS_DATA" | jq -r '
  .[] |
  "RENTAL|\(.rental_id)|\(.agreed_end_date)|\(.total_cost // 0)"
' | while IFS=| read -r prefix rid end_iso cost; do
  if ! already_alerted "returns" "$rid" 43200; then
    rlink=$(rental_link "$rid")
    end_msk=$(moscow_hhmm "$end_iso")
    # Use printf so \n becomes a real newline (echo "...\n..." in bash doesn't
    # interpret escapes unless using echo -e or $'...'). Real newlines are
    # needed so the message renders correctly in Telegram.
    printf '• Аренда #%s — до %s МСК | %s ₽\n  📋 <a href="%s">Открыть</a>\n' \
      "${rid:0:8}" "$end_msk" "$cost" "$rlink"
    record_alert "returns" "$rid"
  fi
done)

NEW_COUNT=$(echo "$NEW_RETURNS" | grep -c "^•" || echo 0)
if [[ "$NEW_COUNT" == "0" ]]; then
  log "All $RETURNS_COUNT returns already alerted — staying silent"
  exit 0
fi

# BUG FIX (was BUG D in code review): previously this script OVERWROTE the
# `RETURNS_LIST` variable with a plain jq filter that had NO deep links,
# silently discarding the per-rental "📋 Открыть" links built above by
# rental_link(). Operators got the count but no way to tap into a rental.
# Now we use `NEW_RETURNS` directly so each rental has its tappable link.
RETURNS_LIST="$NEW_RETURNS"
RETURNS_COUNT="$NEW_COUNT"

# ─── Format the reminder ─────────────────────────────────────────────────────
# (per-rental lines already built above with deep links — no reformat here)

DASHBOARD_LINK="$(analytics_link "rentals" "$TODAY")"
MESSAGE="⏰ <b>Скоро возвраты (в ближайшие 3 часа)</b> — ${RETURNS_COUNT} шт.

${RETURNS_LIST}

🔔 Проверено в ${NOW_DISPLAY} МСК

📊 Дашборд: <a href=\"${DASHBOARD_LINK}\">Открыть</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent returns-reminder ($RETURNS_COUNT returns due in 3h) to chat $ADMIN_CHAT_ID"
fi
