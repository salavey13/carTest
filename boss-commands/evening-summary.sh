#!/usr/bin/env bash
# /home/z/my-project/boss-commands/evening-summary.sh
#
# Boss command: evening-summary
# Sends an end-of-day KPI digest with per-bike breakdown, equipment extraction,
# service detail, salary, хозрасходы, deposits, and shift status.
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

# Use +03:00 for MSK (no DST in Russia since 2014)
START_UTC="${TODAY}T00:00:00+03:00"
END_UTC="${TODAY}T23:59:59+03:00"
START_ENC="${START_UTC//+/%2B}"
END_ENC="${END_UTC//+/%2B}"

# ─── Fetch bike names (id → "make model") ────────────────────────────────────
BIKES_DATA=$(supabase_query "cars" "select=id,make,model&crew_id=eq.${CREW_ID}&type=eq.bike")
BIKES_MAP=$(echo "$BIKES_DATA" | jq -r '[.[] | "\(.id)=\(.make // "") \(.model // "")"] | join("\n")')

# Helper: resolve bike name by id
bike_name() {
  vid="$1"
  name
  bname=$(echo "$BIKES_MAP" | grep "^${vid}=" | head -1 | cut -d= -f2-)
  if [[ -z "$bname" ]]; then echo "$vid"; else echo "$bname"; fi
}

# ─── Rentals ──────────────────────────────────────────────────────────────────
RENTALS_DATA=$(supabase_query "rentals" \
  "select=rental_id,status,total_cost,vehicle_id,metadata&crew_id=eq.${CREW_ID}&or=(and(created_at.gte.${START_ENC},created_at.lte.${END_ENC}),and(agreed_start_date.lte.${END_ENC},agreed_end_date.gte.${START_ENC}))&vehicle_id=not.like.vip-bike-svc-*")

# Per-bike rental breakdown
RENTAL_LINES=""
RENTAL_COUNT=0
RENTAL_REVENUE=0

while IFS=$'\t' read -r rid status cost vid; do
  [[ -z "$rid" ]] && continue
  # Only count active + completed for revenue
  if [[ "$status" == "active" || "$status" == "completed" ]]; then
    RENTAL_COUNT=$((RENTAL_COUNT + 1))
    RENTAL_REVENUE=$((RENTAL_REVENUE + cost))

    bbname= "$vid")

    # Check for special status
    special=""
    if [[ "$cost" -eq 0 ]]; then
      special=" [бесплатно]"
    fi

    RENTAL_LINES="${RENTAL_LINES}• ${name} — ${cost} ₽${special}
"
  fi
done < <(echo "$RENTALS_DATA" | jq -r '.[] | [.rental_id, .status, (.total_cost // 0), (.vehicle_id // "?")] | @tsv')

if [[ -z "$RENTAL_LINES" ]]; then
  RENTAL_LINES="  (нет аренд)"
fi

# ─── Equipment extraction from rental metadata ───────────────────────────────
EQUIPMENT_SECTION=$(echo "$RENTALS_DATA" | jq -r '
  def num: if type == "number" then . elif type == "string" then (tonumber? // 0) else 0 end;
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
  "select=id,total_sum,sale_price&crew_slug=eq.${CREW_SLUG}&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}" \
  "private")

SALE_COUNT=$(echo "$SALES_DATA" | jq 'length' 2>/dev/null || echo 0)
SALE_REVENUE=$(echo "$SALES_DATA" | jq -r '
  def to_num: if type == "number" then . elif type == "string" then (gsub(" "; "") | tonumber? // 0) else 0 end;
  ([.[] | (.total_sum // (.sale_price | to_num) // 0)] | add // 0)
' 2>/dev/null || echo 0)

# ─── Service ─────────────────────────────────────────────────────────────────
SVC_IDS=$(supabase_query "cars" "select=id&crew_id=eq.${CREW_ID}&type=eq.service" | jq -r '[.[].id] | join(",")' 2>/dev/null || echo "")

SERVICE_DETAIL=""
SERVICE_REVENUE=0

if [[ -n "$SVC_IDS" ]]; then
  SERVICES_DATA=$(supabase_query "rentals" \
    "select=rental_id,status,total_cost,vehicle_id,metadata&crew_id=eq.${CREW_ID}&vehicle_id=in.(${SVC_IDS})&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}")

  SERVICE_REVENUE=$(echo "$SERVICES_DATA" | jq '[.[] | select(.status == "active" or .status == "completed") | (.total_cost // 0)] | add // 0' 2>/dev/null || echo 0)

  SERVICE_DETAIL=$(echo "$SERVICES_DATA" | jq -r '
    [ .[] | select(.status == "active" or .status == "completed") ] |
    if length == 0 then ""
    else
      map(
        "• \(.vehicle_id) — \(.total_cost // 0) ₽\n  ├── 50% мастеру: \((.total_cost // 0) / 2 | floor) ₽\n  └── 50% компания: \((.total_cost // 0) / 2 | floor) ₽"
      ) | join("\n")
    end
  ' 2>/dev/null || echo "")
fi

# ─── Testdrives ──────────────────────────────────────────────────────────────
TESTDRIVE_COUNT=$(supabase_query "testdrive_contract_artifacts" \
  "select=id&crew_slug=eq.${CREW_SLUG}&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}" \
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
  "select=amount,description&crew_slug=eq.${CREW_SLUG}&transaction_type=eq.expense_salary&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}")

SALARY_SECTION=$(echo "$SALARY_DATA" | jq -r '
  if length == 0 then "  (нет выплат)"
  else [ .[] | "• \(.description // "выплата") — \(.amount) ₽" ] | join("\n") end
' 2>/dev/null || echo "  (ошибка)")

# ─── Household expenses (хозрасходы) ─────────────────────────────────────────
HOUSEHOLD_DATA=$(supabase_query "cash_transactions" \
  "select=amount,description&crew_slug=eq.${CREW_SLUG}&transaction_type=eq.expense_other&created_at=gte.${START_ENC}&created_at=lte.${END_ENC}")

# Monthly total for limit tracking
MONTH_START=$(TZ=Europe/Moscow date +"%Y-%m-01T00:00:00+03:00" | sed 's/+/%2B/g')
HOUSEHOLD_MONTH=$(supabase_query "cash_transactions" \
  "select=amount&crew_slug=eq.${CREW_SLUG}&transaction_type=eq.expense_other&created_at=gte.${MONTH_START}" | jq '[.[].amount] | add // 0' 2>/dev/null || echo 0)

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

# Fetch user names for shift members
SHIFT_USER_IDS=$(echo "$SHIFTS_DATA" | jq -r '[.[].member_id] | unique | join(",")' 2>/dev/null)
if [[ -n "$SHIFT_USER_IDS" && "$SHIFT_USER_IDS" != "null" ]]; then
  USERS_DATA=$(supabase_query "users" "select=user_id,full_name&user_id=in.(${SHIFT_USER_IDS}")
  USERS_MAP=$(echo "$USERS_DATA" | jq -r '[.[] | "\(.user_id)=\(.full_name // .user_id)"] | join("\n")')
else
  USERS_MAP=""
fi

shift_user_name() {
  uid="$1"
  name
  bname=$(echo "$USERS_MAP" | grep "^${uid}=" | head -1 | cut -d= -f2-)
  if [[ -z "$bname" ]]; then echo "$uid"; else echo "$bname"; fi
}

SHIFT_SECTION=""
while IFS=$'\t' read -r uid cin cout dur; do
  [[ -z "$uid" ]] && continue
  bbname= "$uid")

  # Convert times to MSK (UTC + 3h)
  cin_msk cout_msk
  cin_msk=$(moscow_hhmm "$cin")
  if [[ -z "$cout" || "$cout" == "null" ]]; then
    cout_msk="open"
  else
    cout_msk=$(moscow_hhmm "$cout")
  fi

  if [[ -z "$dur" || "$dur" == "null" ]]; then
    shift_hours="open"
  else
    shift_hours=$(echo "scale=1; $dur / 60" | bc 2>/dev/null || echo "?")" ч"
  fi

  SHIFT_SECTION="${SHIFT_SECTION}• ${name}: ${cin_msk} → ${cout_msk} (${shift_hours})
"
done < <(echo "$SHIFTS_DATA" | jq -r '.[] | [.member_id, .clock_in_time, (.clock_out_time // "null"), (.duration_minutes // "null")] | @tsv' 2>/dev/null)

if [[ -z "$SHIFT_SECTION" ]]; then
  SHIFT_SECTION="  (нет смен)"
fi

# ─── Active rentals with deep links ──────────────────────────────────────────
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

<b>🔑 АРЕНДЫ ТЕХНИКИ (${RENTAL_COUNT}):</b>
${RENTAL_LINES}"

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
