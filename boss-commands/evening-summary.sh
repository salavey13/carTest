#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/evening-summary.sh
#
# Boss command: evening-summary
# Sends an end-of-day KPI digest across all 3 tabs (rentals/sales/services).
# Designed to run at 21:00 Moscow daily.
#
# Output: Telegram message to ADMIN_CHAT_ID
# Cron schedule: every day at 21:00 Moscow = 18:00 UTC = "0 18 * * *"
#
# Usage:
#   ./evening-summary.sh                 # sends Telegram notification
#   ./evening-summary.sh --dry-run       # prints to stdout instead

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
TODAY=$(moscow_today)
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

log "Running evening-summary for $TODAY"

# ─── Rentals KPIs ────────────────────────────────────────────────────────────
START_UTC="${TODAY}T00:00:00Z"
END_UTC="${TODAY}T23:59:59Z"

RENTALS_DATA=$(supabase_query "rentals" \
  "select=rental_id,status,total_cost,agreed_end_date&crew_id=eq.${CREW_ID}&or=(and(created_at.gte.${START_UTC},created_at.lte.${END_UTC}),and(agreed_start_date.lte.${END_UTC},agreed_end_date.gte.${START_UTC}))&vehicle_id=not.like.vip-bike-svc-*")

RENTAL_KPIS=$(echo "$RENTALS_DATA" | jq -r '
  {
    total: length,
    active: ([.[] | select(.status == "active")] | length),
    completed: ([.[] | select(.status == "completed")] | length),
    revenue: ([.[] | select(.status == "active" or .status == "completed") | (.total_cost // 0)] | add // 0)
  } |
  "Аренд сегодня: \(.total)\nВыручка: \(.revenue) ₽\nАктивных: \(.active)\nЗавершено: \(.completed)"
')

# ─── Sales KPIs ──────────────────────────────────────────────────────────────
SALES_DATA=$(supabase_query "sale_contract_artifacts" \
  "select=id,total_sum,sale_price,created_at&crew_slug=eq.${CREW_SLUG}&created_at=gte.${START_UTC}&created_at=lte.${END_UTC}" \
  "private")

SALE_KPIS=$(echo "$SALES_DATA" | jq -r '
  # Defensive number coercion: sale_price can be a string with spaces ("420 000"),
  # a clean number string ("390000"), or null. total_sum is a proper number.
  def to_num:
    if type == "number" then .
    elif type == "string" then (gsub(" "; "") | tonumber? // 0)
    else 0 end;
  {
    total: length,
    revenue: ([.[] | (.total_sum // (.sale_price | to_num) // 0)] | add // 0)
  } |
  "Продаж сегодня: \(.total)\nВыручка: \(.revenue) ₽"
')

# ─── Service KPIs ────────────────────────────────────────────────────────────
SVC_IDS=$(supabase_query "cars" "select=id&crew_id=eq.${CREW_ID}&type=eq.service" | jq -r '[.[].id] | join(",")')

SERVICES_DATA=$(supabase_query "rentals" \
  "select=rental_id,status,total_cost,created_at&crew_id=eq.${CREW_ID}&vehicle_id=in.(${SVC_IDS})&created_at=gte.${START_UTC}&created_at=lte.${END_UTC}")

SERVICE_KPIS=$(echo "$SERVICES_DATA" | jq -r '
  {
    total: length,
    active: ([.[] | select(.status == "active")] | length),
    completed: ([.[] | select(.status == "completed")] | length),
    revenue: ([.[] | select(.status == "active" or .status == "completed") | (.total_cost // 0)] | add // 0)
  } |
  "Сервисов сегодня: \(.total)\nВыручка: \(.revenue) ₽\nАктивных: \(.active)\nЗавершено: \(.completed)"
')

# ─── Total revenue ───────────────────────────────────────────────────────────
# Same defensive number coercion as above.
TOTAL_REVENUE=$(jq -s -r '
  def to_num:
    if type == "number" then .
    elif type == "string" then (gsub(" "; "") | tonumber? // 0)
    else 0 end;
  def revenue_of:
    if has("total_cost") then (.total_cost // 0)
    elif has("total_sum") then (.total_sum // (.sale_price | to_num) // 0)
    else 0 end;
  (.[0] + [.[1][] | {total_cost: revenue_of, status: "active"}] + .[2]) |
  ([.[] | select(.status == "active" or .status == "completed") | revenue_of] | add // 0)
' <<EOF
${RENTALS_DATA}
${SALES_DATA}
${SERVICES_DATA}
EOF
)

# ─── Compose message ─────────────────────────────────────────────────────────
MESSAGE="📊 <b>Итоги дня</b> — ${TODAY}, ${NOW_DISPLAY} МСК

<b>🏍 Аренды</b>
${RENTAL_KPIS}

<b>💰 Продажи</b>
${SALE_KPIS}

<b>🔧 Сервис</b>
${SERVICE_KPIS}

━━━━━━━━━━━━━━━━━━
<b>Итого выручка за день: ${TOTAL_REVENUE} ₽</b>

🌐 <a href=\"https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2\">Открыть дашборд</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent evening-summary notification to chat $ADMIN_CHAT_ID"
fi
