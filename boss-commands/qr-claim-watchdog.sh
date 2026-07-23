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
  "select=id,source_rental_id,renter_full_name,qr_generated_at,chat_id&crew_slug=eq.${CREW_SLUG}&qr_claimed_at=is.null&qr_generated_at=lt.${SEVENTEEN_HOURS_AGO_UTC}&order=qr_generated_at.asc" \
  "private")

STALE_COUNT=$(echo "$STALE_QRS" | jq 'length')

# Silent if no stale QRs
if [[ "$STALE_COUNT" == "0" ]]; then
  log "No stale unclaimed QRs — staying silent"
  exit 0
fi

# ─── Format the alert ────────────────────────────────────────────────────────
STALE_LIST=$(echo "$STALE_QRS" | jq -r '
  map(
    "• \(.renter_full_name // "Без имени") → аренда \(.source_rental_id[0:8])… | QR отправлен \(.qr_generated_at[0:10]) \(.qr_generated_at[11:16])"
  ) | join("\n")
')

# Severity emoji based on how stale
if [[ "$STALE_COUNT" -ge 3 ]]; then
  SEVERITY="🔴🔴"
elif [[ "$STALE_COUNT" -ge 1 ]]; then
  SEVERITY="🔴"
else
  SEVERITY="🟠"
fi

MESSAGE="${SEVERITY} <b>QR не принят > 17 часов</b> — ${STALE_COUNT} шт.

${STALE_LIST}

🔔 Проверено в ${NOW_DISPLAY} МСК

💬 Действия:
1. Отправить клиенту напоминание в Telegram
2. Проверить правильность телефона/email
3. Сгенерировать новый QR если истёк

🌐 <a href=\"https://vip-bike.ru/franchize/vip-bike/leads\">Открыть лиды</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent qr-claim-watchdog ($STALE_COUNT stale QRs) to chat $ADMIN_CHAT_ID"
fi
