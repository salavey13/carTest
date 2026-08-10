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
  "select=rental_id,status,total_cost,agreed_end_date,vehicle_id&crew_id=eq.${CREW_ID}&or=(and(created_at.gte.${START_UTC},created_at.lte.${END_UTC}),and(agreed_start_date.lte.${END_UTC},agreed_end_date.gte.${START_UTC}))&vehicle_id=not.like.vip-bike-svc-*")

RENTAL_KPIS=$(echo "$RENTALS_DATA" | jq -r '
  {
    total: length,
    active: ([.[] | select(.status == "active")] | length),
    completed: ([.[] | select(.status == "completed")] | length),
    revenue: ([.[] | select(.status == "active" or .status == "completed") | (.total_cost // 0)] | add // 0)
  } |
  "Аренд сегодня: \(.total)\nВыручка: \(.revenue) ₽\nАктивных: \(.active)\nЗавершено: \(.completed)\(.completed == 0 ? " — день открыт" : "")"
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

# Guard: if no service vehicles, skip the services query
if [[ -z "$SVC_IDS" ]]; then
  log "No service vehicles found — skipping services KPI"
  SERVICES_DATA='[]'
else
  SERVICES_DATA=$(supabase_query "rentals" \
    "select=rental_id,status,total_cost,created_at&crew_id=eq.${CREW_ID}&vehicle_id=in.(${SVC_IDS})&created_at=gte.${START_UTC}&created_at=lte.${END_UTC}")
fi

SERVICE_KPIS=$(echo "$SERVICES_DATA" | jq -r '
  {
    total: length,
    active: ([.[] | select(.status == "active")] | length),
    completed: ([.[] | select(.status == "completed")] | length),
    revenue: ([.[] | select(.status == "active" or .status == "completed") | (.total_cost // 0)] | add // 0)
  } |
  "Сервисов сегодня: \(.total)\nВыручка: \(.revenue) ₽\nАктивных: \(.active)\nЗавершено: \(.completed)\(.completed == 0 ? " — день открыт" : "")"
')

# ─── Testdrive KPIs ──────────────────────────────────────────────────────────
# Testdrives are stored in private.testdrive_contract_artifacts (separate from
# rentals). They're free (total_sum=0) but tracking the count helps operators
# see how many people test-drove today and might convert to rentals.
TESTDRIVE_DATA=$(supabase_query "testdrive_contract_artifacts" \
  "select=id,customer_full_name,customer_phone,resolved_bike_id,created_at&crew_slug=eq.${CREW_SLUG}&created_at=gte.${START_UTC}&created_at=lte.${END_UTC}" \
  "private")

TESTDRIVE_KPIS=$(echo "$TESTDRIVE_DATA" | jq -r '
  {
    total: length
  } |
  "Тест-драйвов сегодня: \(.total)"
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
DASHBOARD_LINK="$(analytics_link "rentals" "$TODAY")"

# ─── Per-rental deep links for active rentals (BUG E fix) ────────────────────
# Build a "📋 Активные аренды" section so operators can tap straight into each
# open rental's detail page (where the closure UI lives). Without this, the
# digest only shows "Активных: N" with no way to drill into a specific rental.
ACTIVE_RENTALS_LIST=""
ACTIVE_RENTALS_LIST=$(echo "$RENTALS_DATA" | jq -r '
  [.[] | select(.status == "active")] | .[0:5] |
  map("• Аренда #\(.rental_id[0:8]) — до \(.agreed_end_date[11:16]) UTC — \(.total_cost // 0) ₽") | join("\n")
')
ACTIVE_RENTALS_LINKS=""
if [[ -n "$ACTIVE_RENTALS_LIST" ]]; then
  # Build per-rental "📋 Открыть" links using rental_link() from _lib.sh.
  # rental_link emits tg_deep_link "rental_<id>" which useStartParamRouter
  # routes to /franchize/<slug>/rental/<id> (the dedicated rental page
  # with closure UI).
  ACTIVE_RENTALS_LINKS=$(echo "$RENTALS_DATA" | jq -r '
    [.[] | select(.status == "active")] | .[0:5] | .[] | .rental_id
  ' | while read -r rid; do
    local rlink
    rlink=$(rental_link "$rid")
    printf '  📋 <a href="%s">Открыть %s</a>\n' "$rlink" "${rid:0:8}"
  done)
fi

ACTIVE_SECTION=""
if [[ -n "$ACTIVE_RENTALS_LIST" ]]; then
  ACTIVE_SECTION="<b>📋 Активные аренды (до 5):</b>
${ACTIVE_RENTALS_LIST}

${ACTIVE_RENTALS_LINKS}

━━━━━━━━━━━━━━━━━━
"
fi

RENTALS_LINK="$(analytics_link "rentals" "$TODAY")"
SALES_LINK="$(analytics_link "sales" "$TODAY")"
SERVICES_LINK="$(analytics_link "services" "$TODAY")"
LEADS_LINK="$(analytics_link "leads" "$TODAY")"

# ─── Deposit summary per destination (cash/tbank/sber) ───────────────────────
DEPOSIT_DATA=$(supabase_query "deposit_entries" \
  "select=destination,entry_type,direction,amount&created_at=gte.${START_UTC}&created_at=lte.${END_UTC}" \
  "public")

DEPOSIT_KPIS=$(echo "$DEPOSIT_DATA" | jq -r '
  group_by(.destination) | map({
    dest: .[0].destination,
    collected: ([.[] | select(.entry_type == "deposit_collected")] | map(.amount) | add // 0),
    returned: ([.[] | select(.entry_type == "deposit_returned")] | map(.amount) | add // 0),
    penalty: ([.[] | select(.entry_type == "penalty")] | map(.amount) | add // 0)
  }) |
  .[] |
  "  " + (
    if .dest == "cash" then "💵" elif .dest == "tbank" then "💳Т" else "💳С" end
  ) + ": +" + (.collected | tostring) + " collected, -" + (.returned | tostring) + " returned" +
  (if .penalty > 0 then ", -" + (.penalty | tostring) + " penalty" else "" end) +
  ", net: " + ((.collected - .returned - .penalty) | tostring)
')

MESSAGE="📊 <b>Итоги дня</b> — ${TODAY}, ${NOW_DISPLAY} МСК

<b>🏍 <a href=\"${RENTALS_LINK}\">Аренды</a></b>
${RENTAL_KPIS}

<b>💰 <a href=\"${SALES_LINK}\">Продажи</a></b>
${SALE_KPIS}

<b>🔧 <a href=\"${SERVICES_LINK}\">Сервис</a></b>
${SERVICE_KPIS}

<b>🛵 <a href=\"${LEADS_LINK}\">Тест-драйвы</a></b>
${TESTDRIVE_KPIS}

<b>🏦 Депозиты</b>
${DEPOSIT_KPIS}

━━━━━━━━━━━━━━━━━━
${ACTIVE_SECTION}<b>Итого выручка за день: ${TOTAL_REVENUE} ₽</b>

📊 Дашборд: <a href=\"${DASHBOARD_LINK}\">Открыть</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent evening-summary notification to chat $ADMIN_CHAT_ID"
fi
