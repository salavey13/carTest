#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/qr-claim-watchdog.sh
#
# Boss command: qr-claim-watchdog
# Sends an alert when there are rentals with unclaimed QR codes older than 17h.
# This is the same SLA signal the leads page uses for the "QR не принят" red flag.
#
# Output: Telegram message ONLY if there are stale unclaimed QRs (silent otherwise)
# Cron schedule: every 4 hours from 09:00-21:00 Moscow = "0 5,9,13,17 * * *"
#
# Usage:
#   ./qr-claim-watchdog.sh
#   ./qr-claim-watchdog.sh --dry-run

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
NOW_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SEVENTEEN_HOURS_AGO_UTC=$(date -u -d '17 hours ago' +"%Y-%m-%dT%H:%M:%SZ")
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

log "Running qr-claim-watchdog at $NOW_DISPLAY МСК (threshold: 17h)"

# ─── Get all unclaimed QRs older than 17h ───────────────────────────────────
# `user_rental_secrets` (private schema) has columns: id, source_rental_id,
# renter_full_name, qr_generated_at, qr_claimed_at, chat_id, etc.
STALE_QRS=$(supabase_query "user_rental_secrets" \
  "select=id,source_rental_id,renter_full_name,qr_generated_at,chat_id&crew_slug=eq.${CREW_SLUG}&qr_claimed_at=is.null&qr_generated_at=lt.${SEVENTEEN_HOURS_AGO_UTC}&order=qr_generated_at.asc&limit=5" \
  "private")

STALE_COUNT=$(echo "$STALE_QRS" | jq 'length')

# Silent if no stale QRs
if [[ "$STALE_COUNT" == "0" || -z "$STALE_COUNT" ]]; then
  log "No stale unclaimed QRs — staying silent"
  exit 0
fi

# ─── State-aware dedup ──
# Only alert about each stale QR once per 12h
NEW_STALE=$(echo "$STALE_QRS" | jq -r '
  .[] |
  "QR:\(.source_rental_id):\(.renter_full_name // "Без имени"):\(.qr_generated_at[0:10]):\(.qr_generated_at[11:16])"
' | while IFS=: read -r prefix rid name date time; do
  if ! already_alerted "qr_stale" "$rid" 43200; then
    echo "• $name → аренда ${rid:0:8}… | QR отправлен $date $time"
    record_alert "qr_stale" "$rid"
  fi
done)

NEW_COUNT=$(echo "$NEW_STALE" | grep -c "^•" 2>/dev/null || true)
NEW_COUNT=${NEW_COUNT:-0}
NEW_COUNT=${NEW_COUNT//[^0-9]/}
NEW_COUNT=${NEW_COUNT:-0}
if [[ "$NEW_COUNT" == "0" ]]; then
  log "All $STALE_COUNT stale QRs already alerted — staying silent"
  exit 0
fi

STALE_LIST="$NEW_STALE"
STALE_COUNT="$NEW_COUNT"

# ─── Format the alert ────────────────────────────────────────────────────────
# goodmorning-polish: per-rental deep links + kinder wording.
STALE_LIST=""
while IFS= read -r row; do
  RID=$(echo "$row" | jq -r '.source_rental_id // ""')
  RNAME=$(echo "$row" | jq -r '.renter_full_name // "Без имени"')
  QR_SENT=$(echo "$row" | jq -r '.qr_generated_at // ""')
  QR_DATE="${QR_SENT:0:10}"
  QR_TIME="${QR_SENT:11:5}"
  RLINK="$(rental_link "$RID")"
  STALE_LIST="${STALE_LIST}• ${RNAME} → аренда ${RID:0:8}… | QR отправлен ${QR_DATE} ${QR_TIME}
  📋 <a href=\"${RLINK}\">Открыть аренду</a>
"
done <<< "$(echo "$STALE_QRS" | jq -c '.[]')"

# Severity emoji based on how stale
if [[ "$STALE_COUNT" -ge 3 ]]; then
  SEVERITY="🔴🔴"
elif [[ "$STALE_COUNT" -ge 1 ]]; then
  SEVERITY="🔴"
else
  SEVERITY="🟠"
fi

DASHBOARD_LINK="$(analytics_link "rentals")"
MESSAGE="${SEVERITY} <b>QR ещё не принят</b> — ${STALE_COUNT} шт.

${STALE_LIST}
🔔 Обновлено в ${NOW_DISPLAY} МСК

💬 Что можно сделать:
1. Напомните клиенту в Telegram — возможно, не заметил уведомление
2. Проверьте правильность телефона в карточке аренды
3. Перешлите QR повторно — откройте карточку аренды и покажите код

📊 Дашборд: <a href=\"${DASHBOARD_LINK}\">Открыть</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent qr-claim-watchdog ($STALE_COUNT stale QRs) to chat $ADMIN_CHAT_ID"
fi
