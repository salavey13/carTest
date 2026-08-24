#!/usr/bin/env bash
# /home/z/my-project/boss-commands/evening-summary.sh
#
# Boss command: evening-summary
# Sends an end-of-day KPI digest with equipment extraction, service detail,
# salary, хозрасходы, deposits, and shift status.
#
# Per-bike rental breakdown is NOT included — the dashboard link at the bottom
# opens the analytics page for today's date where all rentals are visible.
# This keeps the digest concise.
#
# Cron schedule: every day at 22:00 Moscow = 19:00 UTC = "0 19 * * *"
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

# MSK timezone boundaries (Russia = UTC+3, no DST since 2014)
START_UTC="${TODAY}T00:00:00+03:00"
END_UTC="${TODAY}T23:59:59+03:00"
START_ENC="${START_UTC//+/%2B}"
END_ENC="${END_UTC//+/%2B}"

# ─── Rentals (totals only — per-bike detail is in the dashboard link) ────────
RENTALS_DATA=$(supabase_query "rentals" \
  "select=rental_id,status,total_cost,metadata&crew_id=eq.${CREW_ID}&or=(and(created_at.gte.${START_ENC},created_at.lte.${END_ENC}),and(agreed_start_date.lte.${END_ENC},agreed_end_date.gte.${START_ENC}))&vehicle_id=not.like.vip-bike-svc-*")

RENTAL_COUNT=$(echo "$RENTALS_DATA" | jq '[.[] | select(.status == "active" or .status == "completed")] | length' 2>/dev/null || echo 0)
RENTAL_REVENUE=$(echo "$RENTALS_DATA" | jq '[.[] | select(.status == "active" or .status == "completed") | (.total_cost // 0)] | add // 0' 2>/dev/null || echo 0)
RENTAL_ACTIVE=$(echo "$RENTALS_DATA" | jq '[.[] | select(.status == "active")] | length' 2>/dev/null || echo 0)

# ─── Equipment extraction from rental metadata ───────────────────────────────
# Equipment is stored in rentals.metadata.equipment as:
#   { helmets: N, gloves: N, jacket: bool, pants: bool, boots: bool,
#     net: bool, backpack: bool, bag: bool, charger: bool }
# Prices: helmet = 1000₽/day (or 500₽ for <24h, but we use 1000 for simplicity
# in the digest — the exact per-rental calculation is in the dashboard).
# All other items = 500₽ flat.
#
# NOTE: the /doc flow stores equipment as COUNTS (helmets: 2, gloves: 1) and
# BOOLEANS (jacket: true). The digest sums all rentals' equipment into totals.
#
# KNOWN LIMITATION: specific jacket/pants items (e.g. "Ducati Racing Jacket"
# vs "KTM Textile Jacket") are NOT tracked per-rental — only the count/boolean.
# The cars table has 30 equipment items (type='equipment') with individual
# IDs, but rentals.metadata.equipment doesn't reference specific item IDs.
# Per-item tracking would require a new equipment_rental table (deferred).
EQUIPMENT_SECTION=$(echo "$RENTALS_DATA" | jq -r '
  [ .[] | select(.status == "active" or .status == "completed") | .metadata.equipment // empty ] as $all_eq |
  ($all_eq | map(.helmets // 0) | add // 0) as $h |
  ($all_eq | map(.gloves // 0) | add // 0) as $g |
  ($all_eq | map(if .jacket then 1 else 0 end) | add // 0) as $j |
  ($all_eq | map(if .pants then 1 else 0 end) | add // 0) as $p |
  ($all_eq | map(if .boots then 1 else 0 end) | add // 0) as $b |
  ($all_eq | map(if .net then 1 else 0 end) | add // 0) as $n |
  ($all_eq | map(if .backpack then 1 else 0 end) | add // 0) as $bp |
  ($all_eq | map(if .bag then 1 else 0 end) | add // 0) as $bg |
  ($h * 1000 + $g * 500 + $j * 500 + $p * 500 + $b * 500 + $n * 500 + $bp * 500 + $bg * 500) as $total |
  if $total > 0 then
    "🛡️ ЭКИПИРОВКА (из договоров):\n" +
    (if $h > 0 then "• Шлемы: \($h) шт — \($h * 1000) ₽\n" else "" end) +
    (if $g > 0 then "• Перчатки: \($g) шт — \($g * 500) ₽\n" else "" end) +
    (if $j > 0 then "• Куртки: \($j) шт — \($j * 500) ₽\n" else "" end) +
    (if $p > 0 then "• Штаны: \($p) шт — \($p * 500) ₽\n" else "" end) +
    (if $b > 0 then "• Боты: \($b) шт — \($b * 500) ₽\n" else "" end) +
    (if $n > 0 then "• Сетки: \($n) шт — \($n * 500) ₽\n" else "" end) +
    (if $bp > 0 then "• Рюкзаки: \($bp) шт — \($bp * 500) ₽\n" else "" end) +
    "── Итого: \($total) ₽"
  else "" end
' 2>/dev/null || echo "")

# ─── Sales ───────────────────────────────────────────────────────────────────
SALES_DATA=$(supabase_query "sale_contract_artifacts" \
  "select=id,total_sum,sale_price&crew_id=eq.${CREW_ID}&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}" \
  "private")

SALE_COUNT=$(echo "$SALES_DATA" | jq 'length' 2>/dev/null || echo 0)
SALE_REVENUE=$(echo "$SALES_DATA" | jq -r '
  def to_num: if type == "number" then . elif type == "string" then (gsub(" "; "") | tonumber? // 0) else 0 end;
  ([.[] | (.total_sum // (.sale_price | to_num) // 0)] | add // 0)
' 2>/dev/null || echo 0)

# ─── Service (with detail + 50/50 split display) ─────────────────────────────
# Service work is stored as rentals with vehicle_id pointing to cars.type='service'.
# Each service rental has metadata:
#   { bike: "ducati-black", service_name: "Замена подножки", source: "service_work",
#     created_by: "service-work-text", performed_at: ISO, client: "..." }
# The service_name comes from the cars table (cars.model = service description).
# There is NO mechanic_id field — the operator who ran the skill is in
# rentals.created_by_operator_chat_id (but for service-work-text skill entries,
# this field is typically null because the skill INSERTs directly via REST).
#
# 50/50 split: currently NOT auto-calculated. The digest shows the split
# as a display-only calculation (total_cost / 2). Auto-creating an
# expense_salary cash_transaction row would require knowing WHO the mechanic is —
# currently service work entries don't have a mechanic_id field.
SVC_IDS=$(supabase_query "cars" "select=id&crew_id=eq.${CREW_ID}&type=eq.service" | jq -r '[.[].id] | join(",")' 2>/dev/null || echo "")

SERVICE_DETAIL=""
SERVICE_REVENUE=0

if [[ -n "$SVC_IDS" ]]; then
  SERVICES_DATA=$(supabase_query "rentals" \
    "select=rental_id,status,total_cost,vehicle_id,metadata&crew_id=eq.${CREW_ID}&vehicle_id=in.(${SVC_IDS})&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}")

  SERVICE_REVENUE=$(echo "$SERVICES_DATA" | jq '[.[] | select(.status == "active" or .status == "completed") | (.total_cost // 0)] | add // 0' 2>/dev/null || echo 0)

  # Build per-service detail with 50/50 split display
  # Uses metadata.bike (which bike was serviced) + metadata.service_name (what was done)
  SERVICE_DETAIL=$(echo "$SERVICES_DATA" | jq -r '
    [ .[] | select(.status == "active" or .status == "completed") ] |
    if length == 0 then ""
    else
      map(
        .total_cost as $cost |
        (.metadata.bike // "—") as $bike |
        (.metadata.service_name // .vehicle_id // "сервис") as $svc |
        ($cost / 2 | floor) as $half |
        "• \($bike): \($svc) — \($cost) ₽\n  ├── 50% мастеру: \($half) ₽\n  └── 50% компания: \($half) ₽"
      ) | join("\n")
    end
  ' 2>/dev/null || echo "")
fi

# ─── Testdrives ──────────────────────────────────────────────────────────────
TESTDRIVE_COUNT=$(supabase_query "testdrive_contract_artifacts" \
  "select=id&crew_id=eq.${CREW_ID}&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}" \
  "private" | jq 'length' 2>/dev/null || echo 0)

# ─── Deposits (excluded from revenue) ────────────────────────────────────────
DEPOSIT_DATA=$(supabase_query "deposit_entries" \
  "select=destination,entry_type,amount&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}")

DEPOSIT_KPIS=$(echo "$DEPOSIT_DATA" | jq -r '
  group_by(.destination) | map({
    dest: .[0].destination,
    collected: ([.[] | select(.entry_type == "deposit_collected")] | map(.amount) | add // 0),
    returned: ([.[] | select(.entry_type == "deposit_returned")] | map(.amount) | add // 0)
  }) | .[] |
  "  " + (if .dest == "cash" then "💵" elif .dest == "tbank" then "💳Т" else "💳С" end) +
  ": +" + (.collected | tostring) + " / -" + (.returned | tostring)
' 2>/dev/null || echo "  (нет данных)")

# ─── Salary (ФОТ) ────────────────────────────────────────────────────────────
SALARY_DATA=$(supabase_query "cash_transactions" \
  "select=amount,description&crew_id=eq.${CREW_ID}&transaction_type=eq.expense_salary&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}")

SALARY_SECTION=$(echo "$SALARY_DATA" | jq -r '
  if length == 0 then "  (нет выплат)"
  else [ .[] | "• \(.description // "выплата") — \(.amount) ₽" ] | join("\n") end
' 2>/dev/null || echo "  (ошибка)")

# ─── Household expenses (хозрасходы, лимит 10 000 ₽/мес) ────────────────────
HOUSEHOLD_DATA=$(supabase_query "cash_transactions" \
  "select=amount,description&crew_id=eq.${CREW_ID}&transaction_type=eq.expense_other&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}")

MONTH_START=$(TZ=Europe/Moscow date +"%Y-%m-01T00:00:00+03:00" | sed 's/+/%2B/g')
HOUSEHOLD_MONTH=$(supabase_query "cash_transactions" \
  "select=amount&crew_id=eq.${CREW_ID}&transaction_type=eq.expense_other&created_at=gte.${MONTH_START}" | jq '[.[].amount] | add // 0' 2>/dev/null || echo 0)

HOUSEHOLD_REMAINING=$((10000 - HOUSEHOLD_MONTH))

HOUSEHOLD_SECTION=$(echo "$HOUSEHOLD_DATA" | jq -r --argjson m "$HOUSEHOLD_MONTH" --argjson r "$HOUSEHOLD_REMAINING" '
  if length == 0 then "  (нет закупок)"
  else
    [ .[] | "• \(.description // "закупка") — \(.amount) ₽" ] | join("\n") +
    "\n  ── За месяц: \($m) ₽ | Остаток: \($r) ₽"
  end
' 2>/dev/null || echo "  (ошибка)")

# ─── Shift status ────────────────────────────────────────────────────────────
SHIFTS_DATA=$(supabase_query "crew_member_shifts" \
  "select=member_id,clock_in_time,clock_out_time,duration_minutes&crew_id=eq.${CREW_ID}&clock_in_time=gte.${START_ENC}&clock_in_time=lte.${END_ENC}")

SHIFT_USER_IDS=$(echo "$SHIFTS_DATA" | jq -r '[.[].member_id] | unique | join(",")' 2>/dev/null)
if [[ -n "$SHIFT_USER_IDS" && "$SHIFT_USER_IDS" != "null" ]]; then
  SHIFT_OR_FILTER=$(echo "$SHIFT_USER_IDS" | sed 's/,/,user_id.eq./g; s/^/user_id.eq./')
  USERS_DATA=$(supabase_query "users" "select=user_id,full_name&or=(${SHIFT_OR_FILTER})")
fi

# Combine shifts + users into a single JSON for jq processing
SHIFT_SECTION=$(jq -rn --argjson shifts "$SHIFTS_DATA" --argjson users "$USERS_DATA" '
  ($users | map({(.user_id): (.full_name // .user_id)}) | add // {}) as $names |
  def fmt_time(ts):
    if ts == null then "open"
    else
      ts[11:16] as $hhmm |
      ($hhmm[0:2] | tonumber) as $h |
      $hhmm[2:] as $m |
      (($h + 3) % 24) as $msk |
      (if $msk < 10 then "0" else "" end) + ($msk | tostring) + $m
    end;
  def fmt_h(mins):
    if mins == null then "open"
    else ((mins / 10 | floor) / 10 | tostring) + " ч"
    end;
  if ($shifts | length) == 0 then "  (нет смен)"
  else
    [ $shifts[] |
      ($names[.member_id] // .member_id) as $n |
      "• \($n): \(fmt_time(.clock_in_time)) → \(fmt_time(.clock_out_time)) (\(fmt_h(.duration_minutes)))"
    ] | join("\n")
  end
' 2>/dev/null || echo "  (ошибка загрузки смен)")

# ─── Active rentals with deep links (keep — this is actionable) ──────────────
ACTIVE_LIST=$(echo "$RENTALS_DATA" | jq -r '
  [.[] | select(.status == "active")] | .[0:5] |
  map("RENTAL_ROW|\(.rental_id[0:8])|\(.agreed_end_date)|\(.total_cost // 0)") | join("\n")
' | while IFS='|' read -r prefix rid_short end_iso cost; do
  [[ "$prefix" != "RENTAL_ROW" ]] && continue
  end_msk=$(moscow_hhmm "$end_iso")
  printf '• #%s — до %s МСК — %s ₽' "$rid_short" "$end_msk" "$cost"
done | paste -sd'\n' -)

ACTIVE_SECTION=""
if [[ -n "$ACTIVE_LIST" ]]; then
  ACTIVE_LINKS=$(echo "$RENTALS_DATA" | jq -r '[.[] | select(.status == "active")] | .[0:5] | .[] | .rental_id' | while read -r rid; do
    rlink=$(rental_link "$rid")
    printf '  📋 <a href="%s">Открыть %s</a>\n' "$rlink" "${rid:0:8}"
  done)
  ACTIVE_SECTION="<b>📋 Активные аренды:</b>
${ACTIVE_LIST}

${ACTIVE_LINKS}

━━━━━━━━━━━━━━━━━━
"
fi

# ─── Total revenue (rentals + sales + services, NO deposits) ─────────────────
TOTAL_REVENUE=$(( RENTAL_REVENUE + SALE_REVENUE + SERVICE_REVENUE ))

# ─── Links ────────────────────────────────────────────────────────────────────
DASHBOARD_LINK="$(analytics_link "rentals" "$TODAY")"

# ─── Compose message ─────────────────────────────────────────────────────────
MESSAGE="📊 <b>ЕЖЕДНЕВНЫЙ ВЕЧЕРНИЙ ДАЙДЖЕСТ</b> — ${TODAY}, ${NOW_DISPLAY} МСК

<b>🔑 Аренды:</b> ${RENTAL_COUNT} (активных: ${RENTAL_ACTIVE})
Выручка: ${RENTAL_REVENUE} ₽"

if [[ -n "$EQUIPMENT_SECTION" ]]; then
  MESSAGE="${MESSAGE}

<b>${EQUIPMENT_SECTION}</b>"
fi

MESSAGE="${MESSAGE}
<b>💰 Продажи:</b> ${SALE_COUNT} — ${SALE_REVENUE} ₽"

if [[ -n "$SERVICE_DETAIL" ]]; then
  MESSAGE="${MESSAGE}

<b>🛠️ СЕРВИС:</b>
${SERVICE_DETAIL}
── Итого сервис: ${SERVICE_REVENUE} ₽"
else
  MESSAGE="${MESSAGE}

<b>🛠️ Сервис:</b> (нет работ)"
fi

MESSAGE="${MESSAGE}
<b>🛵 Тест-драйвы:</b> ${TESTDRIVE_COUNT}

<b>🛒 ХОЗРАСХОДЫ (лимит 10 000 ₽/мес):</b>
${HOUSEHOLD_SECTION}

<b>💸 ЗАРПЛАТЫ (ФОТ):</b>
${SALARY_SECTION}

<b>🔒 ЗАЛОГИ (не в выручке):</b>
${DEPOSIT_KPIS}

<b>⏱️ СМЕНЫ:</b>
${SHIFT_SECTION}

━━━━━━━━━━━━━━━━━━
${ACTIVE_SECTION}<b>Итого выручка: ${TOTAL_REVENUE} ₽</b>

📊 <a href=\"${DASHBOARD_LINK}\">Дашборд</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent evening-summary notification to chat $ADMIN_CHAT_ID"
fi
