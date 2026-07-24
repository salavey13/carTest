#!/usr/bin/env bash
# /boss-commands/supaplan-runner.sh
#
# Boss command: supaplan-runner
#
# ⚠️  AUTOMATIC TASK PICKUP IS DISABLED (2026-07-24).
# The script now defaults to "report-only" mode — it lists available SupaPlan
# tasks but does NOT auto-claim them. Old tasks autopicking was overkill
# for the current testing phase.
#
# To actually pick + claim a task, pass --force:
#   ./supaplan-runner.sh --force                    # pick oldest open task
#   ./supaplan-runner.sh --force --task-id <uuid>   # pick a specific task
#
# To just list available tasks (default, safe):
#   ./supaplan-runner.sh                             # list + notify if any
#   ./supaplan-runner.sh --dry-run                   # list to stdout, no Telegram
#
# Cron schedule: DISABLED. Re-enable when SupaPlan queue is stable.
# (Previously: every 30min 09-21 Moscow. Commented out in boss_commands_cron.md.)
#
# Output: Telegram notification ONLY if there are open tasks (silent otherwise)

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

# ─── Parse args ──────────────────────────────────────────────────────────────
FORCE=false
DRY_RUN=false
TASK_ID=""
CAPABILITY="franchize.gamification"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)     FORCE=true; shift ;;
    --dry-run)   DRY_RUN=true; shift ;;
    --task-id)   TASK_ID="$2"; shift 2 ;;
    --capability) CAPABILITY="$2"; shift 2 ;;
    *)           shift ;;
  esac
done

AGENT_ID="vip-bike-ops-boss"
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

if [[ "$FORCE" == "true" ]]; then
  log "Running supaplan-runner in FORCE mode (will pick + claim task) at $NOW_DISPLAY МСК"
else
  log "Running supaplan-runner in REPORT-ONLY mode (auto-pickup disabled) at $NOW_DISPLAY МСК"
fi

# ─── Step 1: List open tasks (always) ───────────────────────────────────────
QUERY_FILTER=""
if [[ -n "$TASK_ID" ]]; then
  QUERY_FILTER="&id=eq.${TASK_ID}"
fi

OPEN_TASKS=$(supabase_query "supaplan_tasks" \
  "select=id,title,body,todo_path,status,created_at,metadata&capability=eq.${CAPABILITY}&status=eq.open${QUERY_FILTER}&order=created_at.asc&limit=5")

OPEN_COUNT=$(echo "$OPEN_TASKS" | jq 'length' 2>/dev/null || echo 0)

if [[ "$OPEN_COUNT" == "0" ]]; then
  log "No open SupaPlan tasks for capability=$CAPABILITY — staying silent"
  exit 0
fi

# ─── Report-only mode: just notify about available tasks ────────────────────
if [[ "$FORCE" != "true" ]]; then
  TASK_LIST=$(echo "$OPEN_TASKS" | jq -r '
    map("• \(.title) — создан \(.created_at[0:10]) — id: \(.id[0:8])…")
    | join("\n")
  ')

  MESSAGE="📋 <b>SupaPlan задачи доступны</b> — ${OPEN_COUNT} шт.

${TASK_LIST}

⏸️ Авто-pickup отключён. Чтобы взять задачу:
<code>./supaplan-runner.sh --force</code> (старейшая)
<code>./supaplan-runner.sh --force --task-id &lt;uuid&gt;</code> (конкретная)

🔔 Проверено в ${NOW_DISPLAY} МСК"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "$MESSAGE" | sed 's/<[^>]*>//g'
  else
    send_telegram "$MESSAGE" "HTML"
    log "Sent supaplan report ($OPEN_COUNT tasks available) to chat $ADMIN_CHAT_ID"
  fi
  exit 0
fi

# ─── Force mode: pick + claim the oldest open task ──────────────────────────
# (This is the original behavior — only runs when --force is passed)
TASK_TO_CLAIM=$(echo "$OPEN_TASKS" | jq -r '.[0]')
CLAIM_ID=$(echo "$TASK_TO_CLAIM" | jq -r '.id')

log "Force mode: claiming task $CLAIM_ID"

# Atomically claim it (only if still open — race-safe)
curl -s -X PATCH "${URL}/rest/v1/supaplan_tasks?id=eq.${CLAIM_ID}&status=eq.open" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"status\":\"running\",\"updated_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >/dev/null

# Extract task details
TASK_TITLE=$(echo "$TASK_TO_CLAIM" | jq -r '.title // "Untitled task"')
TASK_BODY=$(echo "$TASK_TO_CLAIM" | jq -r '.body // ""' | head -c 500)
TASK_TODO_PATH=$(echo "$TASK_TO_CLAIM" | jq -r '.todo_path // ""')
TASK_METADATA=$(echo "$TASK_TO_CLAIM" | jq -r '.metadata // {}')

NOTIFICATION_INTRO=$(echo "$TASK_METADATA" | jq -r '.notification_part1 // empty' | head -c 300)

# Log execution event
curl -s -X POST "${URL}/rest/v1/supaplan_events" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n \
    --arg task_id "$CLAIM_ID" \
    --arg agent "$AGENT_ID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{task_id: $task_id, event_type: "task_claimed", agent_id: $agent, payload: {step: "picked_by_boss_force", at: $ts}}')" >/dev/null || true

# Compose notification
TASK_BODY_SHORT=$(echo "$TASK_BODY" | head -c 400)
[[ ${#TASK_BODY} -gt 400 ]] && TASK_BODY_SHORT="${TASK_BODY_SHORT}…"

MESSAGE="📋 <b>SupaPlan задача взята (force mode)</b> — ${NOW_DISPLAY} МСК

<b>${TASK_TITLE}</b>

${NOTIFICATION_INTRO}

<b>Описание:</b>
<pre>${TASK_BODY_SHORT}</pre>

🆔 Task ID: <code>${CLAIM_ID}</code>
📦 Capability: <code>${CAPABILITY}</code>
📂 Todo path: <code>${TASK_TODO_PATH:-—}</code>

💬 Действия:
1. Прочитать полное описание в <code>${TASK_TODO_PATH}</code>
2. Выполнить патч
3. Отправить callback: <code>codex-notify callback-auto --status completed --taskPath "${TASK_TODO_PATH}"</code>"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent supaplan-runner force notification (task=$CLAIM_ID) to chat $ADMIN_CHAT_ID"
fi
