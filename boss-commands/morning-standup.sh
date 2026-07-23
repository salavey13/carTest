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
        name: (.metadata.renterName // .metadata.name // .metadata.full_name // "Без имени"),
        score: .urgency_score,
        source: (.contact_channel // .source_route // "лид"),
        last_seen: (.last_seen_at // .created_at)
      }) |
      map("• \(.name) — срочность \(.score) — \(.source) — \(.last_seen[0:10])") |
      join("\n")
    end
  ')

HOT_LEADS_COUNT=$(echo "$HOT_LEADS" | head -1 | grep -q "^Нет" && echo 0 || echo "$HOT_LEADS" | wc -l)

# ─── 2. Returns due today (Moscow TZ) ───────────────────────────────────────
START_LOCAL="${TODAY}T00:00:00+03:00"
END_LOCAL="${TODAY}T23:59:59+03:00"

RETURNS_DUE=$(supabase_query "rentals" \
  "select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost&crew_id=eq.${CREW_ID}&status=eq.active&agreed_end_date=gte.${START_LOCAL}&agreed_end_date=lte.${END_LOCAL}&order=agreed_end_date.asc" \
  | jq -r '
    if length == 0 then "Нет возвратов сегодня"
    else
      map("• \(.vehicle_id) → клиент \(.user_id[0:8])… — до \(.agreed_end_date[11:16]) — \(.total_cost) ₽") | join("\n")
    end
  ')

RETURNS_COUNT=$(echo "$RETURNS_DUE" | head -1 | grep -q "^Нет" && echo 0 || echo "$RETURNS_DUE" | wc -l)

# ─── 3. Overdue rentals ─────────────────────────────────────────────────────
NOW_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

OVERDUE=$(supabase_query "rentals" \
  "select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost&crew_id=eq.${CREW_ID}&status=eq.active&agreed_end_date=lt.${NOW_UTC}&order=agreed_end_date.asc" \
  | jq -r '
    if length == 0 then "Нет просроченных аренд"
    else
      map("• \(.vehicle_id) → клиент \(.user_id[0:8])… — просрочен с \(.agreed_end_date[0:10])") | join("\n")
    end
  ')

OVERDUE_COUNT=$(echo "$OVERDUE" | head -1 | grep -q "^Нет" && echo 0 || echo "$OVERDUE" | wc -l)

# ─── 4. Pending todos (not done, with due_date today or earlier) ─────────────
TODAY_START_UTC="${TODAY}T23:59:59Z"
PENDING_TODOS=$(supabase_query "crew_todos" \
  "select=id,title,priority,due_date,assigned_to&crew_id=eq.${CREW_ID}&status=neq.done&due_date=lte.${TODAY_START_UTC}&order=due_date.asc&limit=10" \
  | jq -r '
    if length == 0 then "Нет просроченных задач"
    else
      map({
        title: .title,
        pri: (if .priority == "high" then "🔴" elif .priority == "medium" then "🟡" else "⚪" end),
        due: (.due_date[0:10])
      }) |
      map("• \(.pri) \(.title) — срок \(.due)") |
      join("\n")
    end
  ')

TODOS_COUNT=$(echo "$PENDING_TODOS" | head -1 | grep -q "^Нет" && echo 0 || echo "$PENDING_TODOS" | wc -l)

# ─── Compose message ─────────────────────────────────────────────────────────
MESSAGE="🔥 <b>Утренняя сводка</b> — ${TODAY}, ${NOW_DISPLAY} МСК

📍 <b>Горячие лиды (${HOT_LEADS_COUNT}):</b>
${HOT_LEADS}

📍 <b>Возвраты сегодня (${RETURNS_COUNT}):</b>
${RETURNS_DUE}

📍 <b>Просроченные аренды (${OVERDUE_COUNT}):</b>
${OVERDUE}

📍 <b>Задачи с просрочкой (${TODOS_COUNT}):</b>
${PENDING_TODOS}

🌐 <a href=\"https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2\">Открыть дашборд</a>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'  # strip HTML for terminal display
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent morning-standup notification to chat $ADMIN_CHAT_ID"
fi
