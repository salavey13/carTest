#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/revenue-anomaly.sh
#
# Boss command: revenue-anomaly
# Compares today's revenue so far against the 7-day rolling average for the
# same time-of-day. Triggers an alert if today is > 40% below average (unusual
# dip — possibly missed rentals or failed checkouts).
#
# Output: Telegram message ONLY if today's revenue is significantly below average
# Cron schedule: every 2h 13-21 Moscow = "0 10,12,14,16,18 * * *"
#   (afternoon onwards — morning is too early for meaningful comparison)
#
# Usage:
#   ./revenue-anomaly.sh
#   ./revenue-anomaly.sh --dry-run

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")
TODAY=$(moscow_today)

log "Running revenue-anomaly at $NOW_DISPLAY МСК"

# ─── Today's revenue so far (active + completed rentals created today) ──────
TODAY_START_UTC="${TODAY}T00:00:00Z"
NOW_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

TODAY_RENTALS=$(supabase_query "rentals" \
  "select=total_cost,status,created_at&crew_id=eq.${CREW_ID}&created_at=gte.${TODAY_START_UTC}&created_at=lte.${NOW_UTC}&status=in.(active,completed)&vehicle_id=not.like.vip-bike-svc-*")

TODAY_REVENUE=$(echo "$TODAY_RENTALS" | jq 'map(.total_cost // 0) | add // 0')
TODAY_COUNT=$(echo "$TODAY_RENTALS" | jq 'length')

# ─── 7-day average for the same time window (each day, 00:00 to now) ────────
SEVEN_DAYS_AGO=$(date -u -d '7 days ago' +"%Y-%m-%dT00:00:00Z")
YESTERDAY_START=$(date -u -d '1 day ago' +"%Y-%m-%dT00:00:00Z")

# Get all rentals in the last 7 days, then filter by time-of-day in jq
HISTORICAL_RENTALS=$(supabase_query "rentals" \
  "select=total_cost,status,created_at&crew_id=eq.${CREW_ID}&created_at=gte.${SEVEN_DAYS_AGO}&created_at=lt.${TODAY_START_UTC}&status=in.(active,completed)&vehicle_id=not.like.vip-bike-svc-*")

# For each of the past 7 days, compute revenue from 00:00 to current time-of-day
CURRENT_HOUR_MIN=$(date -u +"%H:%M")

AVG_DATA=$(echo "$HISTORICAL_RENTALS" | jq -r --arg timewindow "$CURRENT_HOUR_MIN" '
  # Normalize ISO 8601 timestamps from Postgres timestamptz format
  def norm_iso(iso):
    if iso == null then null
    else iso | gsub("\\+00:00$"; "Z") end;
  def day_of(iso): (iso | .[0:10]);
  def time_of(iso): (iso | .[11:16]);

  group_by(.created_at | day_of(.))
  | map({
      day: .[0].created_at | day_of(.),
      revenue: (map(select(time_of(.created_at) <= $timewindow) | .total_cost // 0) | add // 0),
      count: (map(select(time_of(.created_at) <= $timewindow)) | length)
    })
  | {
      avg_revenue: (if length == 0 then 0 else (map(.revenue) | add // 0) / length end),
      avg_count: (if length == 0 then 0 else (map(.count) | add // 0) / length end),
      days: length,
      per_day: .
    }
')

AVG_REVENUE=$(echo "$AVG_DATA" | jq -r '.avg_revenue | floor')
AVG_COUNT=$(echo "$AVG_DATA" | jq -r '.avg_count | floor')
DAYS=$(echo "$AVG_DATA" | jq -r '.days')

# ─── Anomaly detection ──────────────────────────────────────────────────────
# Need at least 3 days of history to make a meaningful comparison
if [[ "$DAYS" -lt 3 ]]; then
  log "Only $DAYS days of history (need ≥3) — staying silent"
  exit 0
fi

# Trigger if today's revenue is < 60% of average (40%+ below)
THRESHOLD_PCT=60
if [[ "$AVG_REVENUE" -eq 0 ]]; then
  log "Average revenue is 0 — not enough rental activity — staying silent"
  exit 0
fi

PCT_TODAY=$(( (TODAY_REVENUE * 100) / AVG_REVENUE ))

if [[ "$PCT_TODAY" -ge "$THRESHOLD_PCT" ]]; then
  log "Today's revenue is ${PCT_TODAY}% of average (threshold ${THRESHOLD_PCT}%) — normal — staying silent"
  exit 0
fi

# Anomaly detected
DIFF_PCT=$(( 100 - PCT_TODAY ))

# ─── Build per-day breakdown for context ────────────────────────────────────
PER_DAY_LIST=$(echo "$AVG_DATA" | jq -r '
  .per_day
  | map("• \(.day) — \(.revenue) ₽ (\(.count) сделок)")
  | join("\n")
')

MESSAGE="📉 <b>Аномалия выручки</b> — ${NOW_DISPLAY} МСК

Сегодня: <b>${TODAY_REVENUE} ₽</b> (${TODAY_COUNT} сделок)
Среднее за ${DAYS} дней (тот же промежуток времени): <b>${AVG_REVENUE} ₽</b> (${AVG_COUNT} сделок)

⚠️ Сегодня на <b>${DIFF_PCT}% ниже</b> среднего (порог: ${THRESHOLD_PCT}%)

<b>История за 7 дней (до текущего времени):</b>
${PER_DAY_LIST}

💬 Возможные причины:
1. Плохая погода → меньше аренд
2. Техническая проблема (чек-аут упал?)
3. Конкуренты запустили акцию
4. Нет новых лидов (проверить воронку)

🌐 <a href=\"https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2\">Открыть дашборд</a>"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent revenue-anomaly (today ${PCT_TODAY}% of avg) to chat $ADMIN_CHAT_ID"
fi
