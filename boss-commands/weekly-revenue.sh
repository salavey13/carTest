#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/weekly-revenue.sh
#
# Boss command: weekly-revenue
# Sends a Monday morning weekly revenue report: total revenue + breakdown by
# stream (rentals/sales/services) + top 3 bikes by revenue.
#
# Output: Telegram message to ADMIN_CHAT_ID
# Cron schedule: every Monday at 10:00 Moscow = 07:00 UTC = "0 7 * * 1"
#
# Usage:
#   ./weekly-revenue.sh
#   ./weekly-revenue.sh --dry-run

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"

# Last 7 days (Monday 00:00 to Sunday 23:59)
FROM_UTC=$(TZ=Europe/Moscow date -d '7 days ago' +"%Y-%m-%dT00:00:00Z")
TO_UTC=$(TZ=Europe/Moscow date +"%Y-%m-%dT23:59:59Z")
WEEK_DISPLAY="$(TZ=Europe/Moscow date -d '7 days ago' +%d.%m) — $(TZ=Europe/Moscow date +%d.%m)"

log "Running weekly-revenue for $WEEK_DISPLAY"

# ─── Rentals ─────────────────────────────────────────────────────────────────
RENTALS_DATA=$(supabase_query "rentals" \
  "select=rental_id,vehicle_id,total_cost,status,created_at&crew_id=eq.${CREW_ID}&created_at=gte.${FROM_UTC}&created_at=lte.${TO_UTC}&status=in.(active,completed)&vehicle_id=not.like.vip-bike-svc-*")

RENTAL_REVENUE=$(echo "$RENTALS_DATA" | jq 'map(.total_cost // 0) | add // 0')
RENTAL_COUNT=$(echo "$RENTALS_DATA" | jq 'length')

# ─── Sales ───────────────────────────────────────────────────────────────────
SALES_DATA=$(supabase_query "sale_contract_artifacts" \
  "select=id,total_sum,sale_price,created_at&crew_slug=eq.${CREW_SLUG}&created_at=gte.${FROM_UTC}&created_at=lte.${TO_UTC}" \
  "private")

SALE_REVENUE=$(echo "$SALES_DATA" | jq 'map(.total_sum // (.sale_price | tonumber) // 0) | add // 0')
SALE_COUNT=$(echo "$SALES_DATA" | jq 'length')

# ─── Services ────────────────────────────────────────────────────────────────
SVC_IDS=$(supabase_query "cars" "select=id&crew_id=eq.${CREW_ID}&type=eq.service" | jq -r '[.[].id] | join(",")')

SERVICES_DATA=$(supabase_query "rentals" \
  "select=rental_id,vehicle_id,total_cost,status,created_at&crew_id=eq.${CREW_ID}&vehicle_id=in.(${SVC_IDS})&created_at=gte.${FROM_UTC}&created_at=lte.${TO_UTC}&status=in.(active,completed)")

SERVICE_REVENUE=$(echo "$SERVICES_DATA" | jq 'map(.total_cost // 0) | add // 0')
SERVICE_COUNT=$(echo "$SERVICES_DATA" | jq 'length')

# ─── Top 3 bikes by revenue ──────────────────────────────────────────────────
TOP_BIKES=$(echo "$RENTALS_DATA" | jq -r '
  group_by(.vehicle_id) |
  map({bike: .[0].vehicle_id, count: length, revenue: (map(.total_cost // 0) | add // 0)}) |
  sort_by(-.revenue) |
  .[0:3] |
  map("• \(.bike) — \(.count) аренд — \(.revenue) ₽") |
  join("\n")
')

# ─── Total revenue ───────────────────────────────────────────────────────────
TOTAL_REVENUE=$(( RENTAL_REVENUE + SALE_REVENUE + SERVICE_REVENUE ))

# ─── Compose message ─────────────────────────────────────────────────────────
MESSAGE="📅 <b>Недельный отчёт</b> — ${WEEK_DISPLAY}

<b>💰 Итого выручка: ${TOTAL_REVENUE} ₽</b>

<b>Разбивка по потокам:</b>
• 🏍 Аренды: ${RENTAL_REVENUE} ₽ (${RENTAL_COUNT} сделок)
• 💰 Продажи: ${SALE_REVENUE} ₽ (${SALE_COUNT} сделок)
• 🔧 Сервис: ${SERVICE_REVENUE} ₽ (${SERVICE_COUNT} заказов)

<b>Топ-3 байка по выручке:</b>
${TOP_BIKES}

🌐 <a href=\"https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2\">Открыть дашборд</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent weekly-revenue notification to chat $ADMIN_CHAT_ID"
fi
