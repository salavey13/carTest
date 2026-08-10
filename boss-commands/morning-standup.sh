#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/morning-standup.sh
#
# Boss command: morning-standup
# Sends the operator a "what's hot today" digest: hot leads + returns due +
# overdue rentals + pending todos. Designed to run at 09:00 Moscow daily.
#
# Output: Telegram message to ADMIN_CHAT_ID (413553377 — salavey13, for testing)
# Cron schedule: every day at 09:00 Moscow = 06:00 UTC = "0 6 * * *"
#
# Usage:
#   ./morning-standup.sh                 # sends Telegram notification
#   ./morning-standup.sh --dry-run       # prints to stdout instead

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
TODAY=$(moscow_today)
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

log "Running morning-standup for $TODAY"

# ─── 1. Hot leads (urgency_score >= 70, not dismissed) ──────────────────────
# franchize_intents has columns: id, slug, intent_type, stage, source_route,
# contact_channel, urgency_score, metadata, telegram_user_id, phone,
# last_seen_at, created_at, updated_at. Renter name lives in metadata.renterName
# or metadata.name; phone in `phone` column or metadata.phone.
HOT_LEADS=$(supabase_query "franchize_intents" \
  "select=id,slug,intent_type,stage,urgency_score,source_route,contact_channel,phone,telegram_user_id,metadata,last_seen_at,created_at&slug=eq.${CREW_SLUG}&stage=neq.dismissed&urgency_score=gte.70&order=urgency_score.desc&limit=5" \
  | jq -r '
    if length == 0 then "Нет горячих лидов"
    else
      map({
        id: .id,
        name: (.metadata.renterName // .metadata.name // .metadata.full_name // .metadata.clientName // .metadata.firstName // .metadata.customer_name // .metadata.renter_name // "Без имени"),
        score: .urgency_score,
        source: (.contact_channel // .source_route // "лид"),
        last_seen: (.last_seen_at // .created_at)
      }) |
      map("\(.id)\t\(.name)\t\(.score)\t\(.source)\t\(.last_seen[0:10])") |
      join("\n")
    end
  ')

# Format hot leads with per-lead deep links
if echo "$HOT_LEADS" | head -1 | grep -q "^Нет"; then
  HOT_LEADS_COUNT=0
else
  HOT_LEADS_COUNT=$(echo "$HOT_LEADS" | grep -c . || echo 0)
  FORMATTED=""
  while IFS=$'\t' read -r lid name score source last_seen; do
    ll=$(lead_link "$lid")
    FORMATTED="${FORMATTED}• ${name} — приоритет ${score} — ${source} — ${last_seen}
  📋 <a href=\"${ll}\">Открыть</a>
"
  done <<< "$HOT_LEADS"
  HOT_LEADS="$FORMATTED"
fi

# ─── 2. Returns due today (Moscow TZ) ───────────────────────────────────────
START_LOCAL="${TODAY}T00:00:00+03:00"
END_LOCAL="${TODAY}T23:59:59+03:00"

RETURNS_DUE=$(supabase_query "rentals" \
  "select=rental_id,agreed_end_date,total_cost&crew_id=eq.${CREW_ID}&status=eq.active&agreed_end_date=gte.${START_LOCAL}&agreed_end_date=lte.${END_LOCAL}&order=agreed_end_date.asc&limit=5")

# BUG FIX (user-reported): Was using `.agreed_end_date[11:16]` which gives RAW
# UTC time. Operator reading "до 18:00" thought it was MSK (matching the START
# time) when actually 18:00 UTC = 21:00 MSK (END time). Now we convert each
# rental's end date to Moscow time via moscow_hhmm() and label as МСК.
RETURNS_DUE_TEXT=$(echo "$RETURNS_DUE" | jq -r '
    if length == 0 then "Нет возвратов сегодня"
    else
      map("RENTAL_ROW|\(.rental_id[0:8])|\(.agreed_end_date)|\(.total_cost // 0)") | join("\n")
    end
  ' | while IFS='|' read -r prefix rid_short end_iso cost; do
    [[ "$prefix" != "RENTAL_ROW" ]] && continue
    end_msk=$(moscow_hhmm "$end_iso")
    printf '• Аренда #%s — до %s МСК — %s ₽' "$rid_short" "$end_msk" "$cost"
  done | paste -sd'\n' -)
[[ -z "$RETURNS_DUE_TEXT" ]] && RETURNS_DUE_TEXT="Нет возвратов сегодня"

RETURNS_COUNT=$(echo "$RETURNS_DUE_TEXT" | head -1 | grep -q "^Нет" && echo 0 || echo "$RETURNS_DUE_TEXT" | grep -c "^•" || echo 0)

# Build per-rental deep links for returns due
RETURNS_LINKS=""
if [[ "$RETURNS_COUNT" -gt 0 ]]; then
  RETURNS_LINKS=$(echo "$RETURNS_DUE" | jq -r '.[].rental_id' 2>/dev/null | while read -r rid; do
    rlink=$(rental_link "$rid")
    printf '  📋 <a href="%s">Открыть %s</a>\n' "$rlink" "${rid:0:8}"
  done)
fi

# ─── 3. Overdue rentals ─────────────────────────────────────────────────────
NOW_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Same MSK conversion fix as above — show "с DD.MM HH:MM МСК" instead of raw UTC date slice.
OVERDUE_DATA=$(supabase_query "rentals" \
  "select=rental_id,agreed_end_date&crew_id=eq.${CREW_ID}&status=eq.active&agreed_end_date=lt.${NOW_UTC}&order=agreed_end_date.asc&limit=5")

OVERDUE=$(echo "$OVERDUE_DATA" | jq -r '
    if length == 0 then "Все аренды в графике ✓"
    else
      map("RENTAL_ROW|\(.rental_id[0:8])|\(.agreed_end_date)") | join("\n")
    end
  ' | while IFS='|' read -r prefix rid_short end_iso; do
    [[ "$prefix" != "RENTAL_ROW" ]] && continue
    end_msk=$(moscow_fmt "$end_iso")
    printf '• Аренда #%s — ждёт оформления с %s МСК' "$rid_short" "$end_msk"
  done | paste -sd'\n' -)
[[ -z "$OVERDUE" ]] && OVERDUE="Все аренды в графике ✓"

OVERDUE_COUNT=$(echo "$OVERDUE" | head -1 | grep -q "^Все" && echo 0 || echo "$OVERDUE" | grep -c "^•" || echo 0)

# ─── 4. Pending todos (not done, with due_date today or earlier) ─────────────
TODAY_START_UTC="$(moscow_today_end_utc)"
PENDING_TODOS=$(supabase_query "crew_todos" \
  "select=id,title,priority,due_date,assigned_to&crew_id=eq.${CREW_ID}&status=neq.done&due_date=lte.${TODAY_START_UTC}&order=due_date.asc&limit=10" \
  | jq -r '
    if length == 0 then "Все задачи в было ✓"
    else
      map({
        title: .title,
        pri: (if .priority == "high" then "🔴" elif .priority == "medium" then "🟡" else "⚪" end),
        due: (.due_date[0:10])
      }) |
      map("• \(.pri) \(.title) — было \(.due)") |
      join("\n")
    end
  ')

TODOS_COUNT=$(echo "$PENDING_TODOS" | head -1 | grep -q "^Нет" && echo 0 || echo "$PENDING_TODOS" | wc -l)

# ─── Compose message ─────────────────────────────────────────────────────────
DASHBOARD_LINK="$(analytics_link "rentals" "$TODAY")"
MESSAGE="🔥 <b>Утренняя сводка</b> — ${TODAY}, ${NOW_DISPLAY} МСК

📍 <b>Горячие лиды (${HOT_LEADS_COUNT}):</b>
${HOT_LEADS}

📍 <b>Возвраты сегодня (${RETURNS_COUNT}):</b>
${RETURNS_DUE_TEXT}

📍 <b>Аренды к возврату (${OVERDUE_COUNT}):</b>
${OVERDUE}

📍 <b>Задачи в фокусе (${TODOS_COUNT}):</b>
${PENDING_TODOS}

📊 Дашборд: <a href=\"${DASHBOARD_LINK}\">Открыть</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'  # strip HTML for terminal display
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent morning-standup notification to chat $ADMIN_CHAT_ID"
fi
