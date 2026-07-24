#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/skill-orchestrator.sh
#
# Boss command: skill-orchestrator
# Reads the skill activation manifest, activates the best skills for the
# current context, and reports which skills are now available to the agent.
#
# This is the "self-enhancement" entry point — the boss can activate new
# skills at runtime by adding them to the manifest and re-running this script.
#
# Output: Telegram message with activated skills + KPIs
# Cron schedule: on demand (not scheduled — runs when agent starts or when
#                operator asks "what skills do you have?")
#
# Usage:
#   ./skill-orchestrator.sh                    # activate + report
#   ./skill-orchestrator.sh --list             # list available skills
#   ./skill-orchestrator.sh --activate <name>  # activate a specific skill
#   ./skill-orchestrator.sh --kpi              # show agent KPIs

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

MANIFEST_FILE="${MANIFEST_FILE:-$(dirname "$0")/../skills/vip-bike-ops/skill_manifest.json}"
KPI_FILE="${KPI_FILE:-/tmp/boss-agent-kpis.json}"
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

MODE="${1:---report}"
SKILL_NAME="${2:-}"

# ─── Load or initialize manifest ────────────────────────────────────────────
load_manifest() {
  if [[ ! -f "$MANIFEST_FILE" ]]; then
    # Create default manifest
    mkdir -p "$(dirname "$MANIFEST_FILE")"
    cat > "$MANIFEST_FILE" << 'MANIFEST'
{
  "version": "1.0.0",
  "updated_at": "2026-07-24T01:00:00Z",
  "active_skills": [
    "leads-crm-text",
    "rental-analytics-text",
    "sale-analytics-text",
    "service-analytics-text",
    "franchize-catalog-text",
    "rental-card-text",
    "crew-management-text",
    "rider-profile-text",
    "reviews-text",
    "contract-draft-text",
    "orders-checkout-text",
    "crew-admin-text",
    "leaderboard-text",
    "crew-info-text"
  ],
  "factory_skills_available": [
    "fk-pasha-admin",
    "fk-contract",
    "fk-site-admin",
    "fk-video-gen",
    "rental-catalog-kb",
    "avito-seller",
    "avito-profile",
    "factory-global-rules"
  ],
  "boss_commands": [
    "morning-standup",
    "evening-summary",
    "returns-reminder",
    "overdue-alert",
    "qr-claim-watchdog",
    "weekly-revenue",
    "supaplan-runner",
    "lead-stuck-watchdog",
    "revenue-anomaly"
  ],
  "self_enhancement": {
    "enabled": true,
    "can_create_skills": true,
    "can_modify_skills": true,
    "can_activate_factory_skills": true,
    "manifest_path": "skills/vip-bike-ops/skill_manifest.json",
    "skills_dir": "skills/",
    "factory_skills_dir": "docs/skills/"
  }
}
MANIFEST
    log "Created default manifest at $MANIFEST_FILE"
  fi
  cat "$MANIFEST_FILE"
}

# ─── List available skills ──────────────────────────────────────────────────
list_skills() {
  local manifest
  manifest=$(load_manifest)

  echo "📋 Available Skills"
  echo "=================="
  echo
  echo "Active leaf skills ($(echo "$manifest" | jq '.active_skills | length')):"
  echo "$manifest" | jq -r '.active_skills[]' | sed 's/^/  • /'
  echo
  echo "Factory skills available ($(echo "$manifest" | jq '.factory_skills_available | length')):"
  echo "$manifest" | jq -r '.factory_skills_available[]' | sed 's/^/  • /'
  echo
  echo "Boss commands ($(echo "$manifest" | jq '.boss_commands | length')):"
  echo "$manifest" | jq -r '.boss_commands[]' | sed 's/^/  • /'
}

# ─── Activate a specific skill ──────────────────────────────────────────────
activate_skill() {
  local skill="$1"
  local manifest
  manifest=$(load_manifest)

  # Check if already active
  if echo "$manifest" | jq -e --arg s "$skill" '.active_skills | index($s)' >/dev/null 2>&1; then
    echo "✅ Skill '$skill' is already active"
    return 0
  fi

  # Check if it's a factory skill that can be activated
  if echo "$manifest" | jq -e --arg s "$skill" '.factory_skills_available | index($s)' >/dev/null 2>&1; then
    # Move from factory_skills_available to active_skills
    local updated
    updated=$(echo "$manifest" | jq --arg s "$skill" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
      .active_skills += [$s] |
      .factory_skills_available = (.factory_skills_available - [$s]) |
      .updated_at = $ts
    ')
    echo "$updated" > "$MANIFEST_FILE"
    echo "✅ Activated factory skill '$skill' — moved to active_skills"
    log "Activated factory skill: $skill"
  else
    echo "❌ Skill '$skill' not found in active_skills or factory_skills_available"
    echo
    echo "Available factory skills:"
    echo "$manifest" | jq -r '.factory_skills_available[]' | sed 's/^/  • /'
    return 1
  fi
}

# ─── Load/initialize KPIs ───────────────────────────────────────────────────
load_kpis() {
  if [[ ! -f "$KPI_FILE" ]]; then
    cat > "$KPI_FILE" << 'KPIS'
{
  "agent_started_at": null,
  "queries_total": 0,
  "queries_by_skill": {},
  "queries_by_type": {
    "list": 0,
    "detail": 0,
    "action": 0,
    "composite": 0
  },
  "avg_response_ms": 0,
  "cache_hits": 0,
  "cache_misses": 0,
  "telegram_sends_ok": 0,
  "telegram_sends_fail": 0,
  "errors": 0,
  "top_skills": []
}
KPIS
  fi
  cat "$KPI_FILE"
}

# ─── Report KPIs ────────────────────────────────────────────────────────────
report_kpis() {
  local kpis
  kpis=$(load_kpis)

  local total
  total=$(echo "$kpis" | jq -r '.queries_total')
  local cache_hits
  cache_hits=$(echo "$kpis" | jq -r '.cache_hits')
  local cache_misses
  cache_misses=$(echo "$kpis" | jq -r '.cache_misses')
  local cache_rate=0
  if [[ $((cache_hits + cache_misses)) -gt 0 ]]; then
    cache_rate=$(( cache_hits * 100 / (cache_hits + cache_misses) ))
  fi
  local tg_ok
  tg_ok=$(echo "$kpis" | jq -r '.telegram_sends_ok')
  local tg_fail
  tg_fail=$(echo "$kpis" | jq -r '.telegram_sends_fail')
  local errors
  errors=$(echo "$kpis" | jq -r '.errors')

  # Top 5 skills by usage
  local top_skills
  top_skills=$(echo "$kpis" | jq -r '
    .queries_by_skill | to_entries | sort_by(-.value) | .[0:5] |
    if length == 0 then "  (нет данных)"
    else map("  • \(.key): \(.value) запросов") | join("\n")
    end
  ')

  # Queries by type
  local by_type
  by_type=$(echo "$kpis" | jq -r '
    .queries_by_type | to_entries | map("  • \(.key): \(.value)") | join("\n")
  ')

  local manifest
  manifest=$(load_manifest)
  local active_count
  active_count=$(echo "$manifest" | jq -r '.active_skills | length')
  local factory_count
  factory_count=$(echo "$manifest" | jq -r '.factory_skills_available | length')
  local boss_count
  boss_count=$(echo "$manifest" | jq -r '.boss_commands | length')

  MESSAGE="📊 <b>Agent KPIs</b> — ${NOW_DISPLAY} МСК

<b>Навыки:</b>
• Активных leaf-навыков: ${active_count}
• Доступных factory-навыков: ${factory_count}
• Boss-команд: ${boss_count}

<b>Запросы:</b>
• Всего обработано: ${total}
${by_type}

<b>Топ-5 навыков по использованию:</b>
${top_skills}

<b>Производительность:</b>
• Cache hit rate: ${cache_rate}% (${cache_hits}/${cache_hits}+${cache_misses})
• Telegram отправок: ✅ ${tg_ok} / ❌ ${tg_fail}
• Ошибок: ${errors}

💬 Самоулучшение: agent может активировать factory-навыки через <code>skill-orchestrator.sh --activate &lt;name&gt;</code>"

  echo "$MESSAGE" | sed 's/<[^>]*>//g'
}

# ─── Main ───────────────────────────────────────────────────────────────────
case "$MODE" in
  --list)
    list_skills
    ;;
  --activate)
    if [[ -z "$SKILL_NAME" ]]; then
      echo "Usage: $0 --activate <skill-name>"
      exit 1
    fi
    activate_skill "$SKILL_NAME"
    ;;
  --kpi)
    report_kpis
    ;;
  --report|*)
    # Full report (default)
    list_skills
    echo
    echo "---"
    echo
    report_kpis
    ;;
esac
