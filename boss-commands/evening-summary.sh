#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/evening-summary.sh
#
# Boss command: evening-summary
# Sends an end-of-day KPI digest: rentals/sales/services + shifts/equipment.
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
# Mirrors the web dashboard (rentals-analytics v2, F7 + iter14):
# a rental belongs to the day it STARTS (Moscow calendar date). Multi-day
# rentals are NOT recounted on every day they stay active, and rentals merely
# RETURNING today no longer inflate today's revenue — they were counted on
# their start day. The old query (created_at OR period-overlapping) produced
# inflated numbers: e.g. 2026-08-29 showed 12/92553₽ instead of 7/53553₽.
#
# Fetch window = exact MSK day in UTC (via date -d, see CLAUDE.md): rows whose
# start OR end falls inside it (4 branches: requested/agreed start, agreed/
# requested end — legacy rows may have either pair null). The precise
# MSK-calendar split (started-today vs returns-today) happens in jq below.
# Equipment rows are excluded implicitly: they carry crew_id=NULL in rentals
# (migration 20260815000001) while this query filters crew_id=eq.
START_UTC="$(moscow_today_start_utc)"
END_UTC="$(moscow_today_end_utc)"

RENTALS_DATA=$(supabase_query "rentals" \
  "select=rental_id,status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,vehicle_id&crew_id=eq.${CREW_ID}&or=(and(requested_start_date.gte.${START_UTC},requested_start_date.lte.${END_UTC}),and(requested_start_date.is.null,agreed_start_date.gte.${START_UTC},agreed_start_date.lte.${END_UTC}),and(agreed_end_date.gte.${START_UTC},agreed_end_date.lte.${END_UTC}),and(agreed_end_date.is.null,requested_end_date.gte.${START_UTC},requested_end_date.lte.${END_UTC})))&vehicle_id=not.like.vip-bike-svc-*")

# MSK calendar date of an ISO timestamp (UTC + 3h, no DST — same math as the
# web client's localDateOnly() in analytics-utils.ts).
RENTAL_KPIS=$(echo "$RENTALS_DATA" | jq -r --arg today "$TODAY" '
  def mskd:
    if . == null or . == "" then ""
    else
      sub("\\.[0-9]+"; "") | sub("Z$"; "") | sub("\\+00:00$"; "")
      | strptime("%Y-%m-%dT%H:%M:%S") | mktime + 10800 | strftime("%Y-%m-%d")
    end;
  def sd: (.requested_start_date // .agreed_start_date // "") | mskd;
  def ed: (.agreed_end_date // .requested_end_date // "") | mskd;
  (map(select(.status != "cancelled"))) as $rows
  | ($rows | map(select(sd == $today))) as $started
  | {
      total: ($started | length),
      active: ([$rows[] | select(.status == "active")] | length),
      returns: ([$rows[] | select(ed == $today)] | length),
      revenue: ([$started[]
        | select(.status == "active" or .status == "completed" or .status == "confirmed" or .status == "pending_confirmation")
        | (.total_cost // 0)] | add // 0)
    } | . as $x |
  (if $x.returns == 0 then " — день открыт" else "" end) as $suffix |
  "Аренд сегодня: \($x.total)\nВыручка: \($x.revenue) ₽\nАктивных: \($x.active)\nВозвратов: \($x.returns)\($suffix)"
')

# Started-today billable rows only — this is what feeds TOTAL_REVENUE, so the
# day total uses the same start-day semantics as the web dashboard.
RENTALS_TODAY=$(echo "$RENTALS_DATA" | jq -c --arg today "$TODAY" '
  def mskd:
    if . == null or . == "" then ""
    else
      sub("\\.[0-9]+"; "") | sub("Z$"; "") | sub("\\+00:00$"; "")
      | strptime("%Y-%m-%dT%H:%M:%S") | mktime + 10800 | strftime("%Y-%m-%d")
    end;
  [.[] | select(.status != "cancelled")
    | select(((.requested_start_date // .agreed_start_date // "") | mskd) == $today)
    | select(.status == "active" or .status == "completed" or .status == "confirmed" or .status == "pending_confirmation")]
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
    "select=rental_id,status,total_cost,metadata,created_at&crew_id=eq.${CREW_ID}&vehicle_id=in.(${SVC_IDS})&created_at=gte.${START_UTC}&created_at=lte.${END_UTC}")
fi

# Service sign rule (see skills/service-work-text):
#   metadata.client present  → client service (+ revenue, counts in day total)
#   metadata.client absent   → crew / internal work (− expense = mechanic salary,
#                              shown separately, NOT added to day total)
SERVICE_KPIS=$(echo "$SERVICES_DATA" | jq -r '
  def is_client: (((.metadata // {}).client // "") | length > 0);
  def billable: (.status == "active" or .status == "completed");
  {
    total: length,
    active: ([.[] | select(.status == "active")] | length),
    completed: ([.[] | select(.status == "completed")] | length),
    client_count: ([.[] | select(is_client)] | length),
    client_revenue: ([.[] | select(is_client and billable) | (.total_cost // 0)] | add // 0),
    crew_count: ([.[] | select(is_client | not)] | length),
    crew_expense: ([.[] | select((is_client | not) and billable) | (.total_cost // 0)] | add // 0)
  } | . as $x |
  (if $x.completed == 0 then " — день открыт" else "" end) as $suffix |
  "Сервисов сегодня: \($x.total)\nВыручка (клиентам): \($x.client_revenue) ₽ (\($x.client_count) ↗)\nВнутр. работы (зарплата): \($x.crew_expense) ₽ (\($x.crew_count) ↘)\nЗавершено: \($x.completed)\($suffix)"
')

# ─── Shifts KPIs (crew_member_shifts, see skills/shift-tracker-text) ─────────
# Completed today + currently open. Salary = stored salary_amount, else
# hours × hourly_rate (default 169₽). Open shifts started before today are
# flagged as forgotten (⚠ unclosed from previous days).
SHIFTS_DATA=$(supabase_query "crew_member_shifts" \
  "select=clock_in_time,clock_out_time,hourly_rate,duration_minutes,salary_amount,users(username,full_name)&crew_id=eq.${CREW_ID}&order=clock_in_time.asc&limit=500")

SHIFT_KPIS=$(echo "$SHIFTS_DATA" | jq -r --arg today "$TODAY" '
  def ts: sub("\\.[0-9]+";"") | sub("\\+00:00$";"Z") | fromdateiso8601;
  def h: ((if .clock_out_time then (.clock_out_time|ts) else now end) - (.clock_in_time|ts)) / 3600;
  def sal: (.salary_amount // (h * (.hourly_rate // 169)));
  def r1: ((.*10)|round)/10;
  def who: (.users.username // .users.full_name // "?");
  (map(select(.clock_out_time != null and ((.clock_in_time // "")|startswith($today))))) as $done
  | (map(select(.clock_out_time == null and ((.clock_in_time // "")|startswith($today))))) as $open
  | (map(select(.clock_out_time == null and (((.clock_in_time // "")|startswith($today))|not)))) as $stale
  | ($done + $open) as $day
  | if ($day|length) == 0 and ($stale|length) == 0 then
      "Сегодня смен не было"
    else
      [
        (if ($day|length) == 0 then "" else
          "Завершено смен: \($done|length) (\([$done[]|h]|add//0|r1) ч)\nОткрытых смен: \($open|length) (\([$open[]|h]|add//0|r1) ч)\nНа смене: \(if ($open|length)==0 then "—" else [$open[]|"\(who) с \((.clock_in_time|ts) + 10800 | strftime("%H:%M")) МСК"]|join(", ") end)\nЗарплата за день: \([$day[]|sal]|add//0|round) ₽"
        end),
        (if ($stale|length)>0 then "⚠️ Незакрытые с прошлых дней: \($stale|length) (\([$stale[]|"\(who) с \(.clock_in_time[0:10])"]|join(", ")))" else "" end)
      ] | map(select(length > 0)) | join("\n")
    end
')

# ─── Equipment KPIs (unified rentals, see skills/equipment-tracker-text) ─────
# Equipment rentals live in `rentals` with crew_id in metadata (the rentals
# column is NULL for equipment rows — migration 20260815000001). The bike query
# above excludes them via or=(metadata->>item_type...) so they are NOT double
# counted; their revenue is added to TOTAL_REVENUE below.
EQUIP_DATA=$(supabase_query "rentals" \
  "select=rental_id,status,total_cost,created_at,agreed_end_date,metadata&metadata->>item_type=eq.equipment&metadata->>crew_id=eq.${CREW_ID}&order=created_at.desc&limit=500")

EQUIP_STOCK=$(supabase_query "cars" "select=id&crew_id=eq.${CREW_ID}&type=eq.equipment" | jq 'length')

EQUIP_KPIS=$(echo "$EQUIP_DATA" | jq -r --arg today "$TODAY" --arg start "$START_UTC" --arg end "$END_UTC" --arg stock "$EQUIP_STOCK" '
  def cond: (.metadata.equipment_condition // "");
  (map(select((.created_at // "")|startswith($today)))) as $issued
  | (map(select(.status == "active"))) as $active
  | (map(select(.status == "active" and ((.agreed_end_date // "") >= $start) and ((.agreed_end_date // "") <= $end)))) as $due
  | (map(select(.status == "active" and ((.agreed_end_date // "") < $start)))) as $overdue
  | (map(select(
      .status == "disputed"
      or ((cond|length) > 0 and (cond != "Норм") and (cond != "Выдан"))
      or (((.metadata.damage_reports // [])|length) > 0)
    ))) as $problems
  | (($issued + $active) | unique_by(.rental_id) | map(select(.status == "active" or .status == "completed"))) as $rev
  | if (($issued + $active)|length) == 0 then
      "Выдач сегодня не было (склад: \($stock) предметов)"
    else
      "Выдач сегодня: \($issued|length) · активных: \($active|length)\nК возврату сегодня: \($due|length) · просрочено: \($overdue|length)\nВыручка: \([$rev[]|(.total_cost//0)]|add//0|round) ₽\(if ($problems|length)>0 then "\n⚠️ Проблемы (состояние/повреждения): \($problems|length)" else "" end)"
    end
')

# ─── Total revenue ───────────────────────────────────────────────────────────
# Day total = rentals (started-today, see RENTALS_TODAY) + sales + CLIENT
# services + equipment. Internal/crew services (no metadata.client) are a
# mechanic-salary expense, NOT revenue — they are reported separately in
# SERVICE_KPIS and excluded from TOTAL_REVENUE.
TOTAL_REVENUE=$(jq -s -r '
  def to_num:
    if type == "number" then .
    elif type == "string" then (gsub(" "; "") | tonumber? // 0)
    else 0 end;
  def revenue_of:
    if has("total_cost") then (.total_cost // 0)
    elif has("total_sum") then (.total_sum // (.sale_price | to_num) // 0)
    else 0 end;
  def is_client_service: (((.metadata // {}).client // "") | length > 0);
  ([.[0][] | {total_cost: revenue_of, status: "active"}]
    + [.[1][] | {total_cost: revenue_of, status: "active"}]
    + [.[2][] | select(is_client_service)]
    + [.[3][] | select(.status == "active" or .status == "completed")]
  ) |
  ([.[] | select(.status == "active" or .status == "completed") | revenue_of] | add // 0)
' <<EOF
${RENTALS_TODAY}
${SALES_DATA}
${SERVICES_DATA}
${EQUIP_DATA}
EOF
)

# ─── Compose message ─────────────────────────────────────────────────────────
DASHBOARD_LINK="$(analytics_link "rentals" "$TODAY")"

# ─── Per-rental deep links for active rentals (BUG E fix) ────────────────────
# Build a "📋 Активные аренды" section so operators can tap straight into each
# open rental's detail page (where the closure UI lives). Without this, the
# digest only shows "Активных: N" with no way to drill into a specific rental.
# NOTE: this lists ALL currently active rentals (a multi-day rental started
# days ago is not in RENTALS_DATA's day window but still needs a drill-in
# link), so it uses its own status=active query. Times shown in Moscow
# time (CLAUDE.md: digests always report MSK).
ACTIVE_DATA=$(supabase_query "rentals" \
  "select=rental_id,status,total_cost,agreed_end_date&crew_id=eq.${CREW_ID}&status=eq.active&vehicle_id=not.like.vip-bike-svc-*&order=agreed_end_date.asc&limit=50")

ACTIVE_RENTALS_LIST=""
ACTIVE_RENTALS_LIST=$(echo "$ACTIVE_DATA" | jq -r '
  [.[] | select(.status == "active")] | .[0:5] |
  map("RENTAL_ROW|\(.rental_id[0:8])|\(.agreed_end_date // "")|\(.total_cost // 0)") | join("\n")
' | while IFS='|' read -r prefix rid_short end_iso cost; do
  [[ "$prefix" != "RENTAL_ROW" ]] && continue
  end_msk=$(moscow_hhmm "$end_iso")
  printf '• Аренда #%s — до %s МСК — %s ₽\n' "$rid_short" "$end_msk" "$cost"
done)
ACTIVE_RENTALS_LINKS=""
if [[ -n "$ACTIVE_RENTALS_LIST" ]]; then
  # Build per-rental "📋 Открыть" links using rental_link() from _lib.sh.
  # rental_link emits tg_deep_link "rental_<id>" which useStartParamRouter
  # routes to /franchize/<slug>/rental/<id> (the dedicated rental page
  # with closure UI).
  ACTIVE_RENTALS_LINKS=$(echo "$ACTIVE_DATA" | jq -r '
    [.[] | select(.status == "active")] | .[0:5] | .[] | .rental_id
  ' | while read -r rid; do
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

MESSAGE="📊 <b>Итоги дня</b> — ${TODAY}, ${NOW_DISPLAY} МСК

<b>🏍 <a href=\"${RENTALS_LINK}\">Аренды</a></b>
${RENTAL_KPIS}

<b>💰 <a href=\"${SALES_LINK}\">Продажи</a></b>
${SALE_KPIS}

<b>🔧 <a href=\"${SERVICES_LINK}\">Сервис</a></b>
${SERVICE_KPIS}

<b>🕒 Смены</b>
${SHIFT_KPIS}

<b>🧥 Экипировка</b> — на складе ${EQUIP_STOCK}
${EQUIP_KPIS}

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
