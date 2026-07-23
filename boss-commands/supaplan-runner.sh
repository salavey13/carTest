#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/supaplan-runner.sh
#
# Boss command: supaplan-runner
# Picks the next SupaPlan task for the vip-bike-ops capability, marks it
# running, sends a "task started" notification, then leaves it to the agent
# to execute the patch + send a callback when done.
#
# Designed to run every 30 minutes during business hours — picks up new
# SupaPlan tasks queued by the boss-quest system without manual intervention.
#
# Output: Telegram notification ONLY if a new task was picked (silent otherwise)
# Cron schedule: every 30min 09-21 Moscow = "*/30 5-18 * * *"
#
# Usage:
#   ./supaplan-runner.sh
#   ./supaplan-runner.sh --dry-run
#   ./supaplan-runner.sh --capability franchize.gamification  # override default

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
CAPABILITY="${2:-franchize.gamification}"
AGENT_ID="vip-bike-ops-boss"
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

log "Running supaplan-runner (capability=$CAPABILITY, agent=$AGENT_ID) at $NOW_DISPLAY МСК"

# ─── Step 1: Pick the next open task ────────────────────────────────────────
# Uses the SupaPlan claim RPC (or falls back to manual claim if RPC missing).
PICK_RESULT=$(curl -s -X POST "${URL}/rest/v1/rpc/supaplan_claim_task" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n --arg cap "$CAPABILITY" --arg agent "$AGENT_ID" \
    '{capability: $cap, agent_id: $agent}')" 2>&1 || echo '{"error":"rpc_failed"}')

# Fallback: if RPC missing, do a manual SELECT + UPDATE
if echo "$PICK_RESULT" | jq -e '.error == "rpc_failed" or .code == "PGRST202"' >/dev/null 2>&1; then
  log "supaplan_claim_task RPC missing — falling back to manual claim"

  # Find oldest open task for this capability
  TASK=$(supabase_query "supaplan_tasks" \
    "select=id,title,body,todo_path,metadata&capability=eq.${CAPABILITY}&status=eq.open&order=created_at.asc&limit=1")

  TASK_ID=$(echo "$TASK" | jq -r '.[0].id // empty')
  if [[ -z "$TASK_ID" ]]; then
    log "No open SupaPlan tasks for capability=$CAPABILITY — staying silent"
    exit 0
  fi

  # Atomically claim it (only if still open — race-safe)
  curl -s -X PATCH "${URL}/rest/v1/supaplan_tasks?id=eq.${TASK_ID}&status=eq.open" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"status\":\"running\",\"updated_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >/dev/null

  PICK_RESULT="$TASK"
else
  TASK_ID=$(echo "$PICK_RESULT" | jq -r '.[0].id // .id // empty')
  if [[ -z "$TASK_ID" ]]; then
    log "No open SupaPlan tasks for capability=$CAPABILITY — staying silent"
    exit 0
  fi
fi

# ─── Step 2: Extract task details ───────────────────────────────────────────
TASK_TITLE=$(echo "$PICK_RESULT" | jq -r '.[0].title // .title // "Untitled task"')
TASK_BODY=$(echo "$PICK_RESULT" | jq -r '.[0].body // .body // ""' | head -c 500)
TASK_TODO_PATH=$(echo "$PICK_RESULT" | jq -r '.[0].todo_path // .todo_path // ""')
TASK_METADATA=$(echo "$PICK_RESULT" | jq -r '.[0].metadata // .metadata // {}')

# Extract first notification_part1 from metadata (SupaPlan convention)
NOTIFICATION_INTRO=$(echo "$TASK_METADATA" | jq -r '.notification_part1 // empty' | head -c 300)

# ─── Step 3: Log execution event ────────────────────────────────────────────
curl -s -X POST "${URL}/rest/v1/supaplan_events" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n \
    --arg task_id "$TASK_ID" \
    --arg agent "$AGENT_ID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{task_id: $task_id, event_type: "task_claimed", agent_id: $agent, payload: {step: "picked_by_boss", at: $ts}}')" >/dev/null || true

# ─── Step 4: Compose notification ───────────────────────────────────────────
# Truncate body for Telegram readability
TASK_BODY_SHORT=$(echo "$TASK_BODY" | head -c 400)
[[ ${#TASK_BODY} -gt 400 ]] && TASK_BODY_SHORT="${TASK_BODY_SHORT}…"

MESSAGE="📋 <b>Новая SupaPlan задача</b> — ${NOW_DISPLAY} МСК

<b>${TASK_TITLE}</b>

${NOTIFICATION_INTRO}

<b>Описание:</b>
<pre>${TASK_BODY_SHORT}</pre>

🆔 Task ID: <code>${TASK_ID}</code>
📦 Capability: <code>${CAPABILITY}</code>
📂 Todo path: <code>${TASK_TODO_PATH:-—}</code>

💬 Действия:
1. Прочитать полное описание в <code>${TASK_TODO_PATH}</code>
2. Выполнить патч
3. Отправить callback: <code>codex-notify callback-auto --status completed --taskPath "${TASK_TODO_PATH}"</code>"

# ─── Send ────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent supaplan-runner notification (task=$TASK_ID) to chat $ADMIN_CHAT_ID"
fi
