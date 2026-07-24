#!/usr/bin/env bash
# /scripts/notify.sh
#
# Notification library for long-running tasks. Sends progress updates to
# Telegram so the operator knows the script hasn't died silently.
#
# Usage:
#   source scripts/notify.sh
#   notify "🚀 Started: importing 50 bikes..."
#   # ... long work ...
#   notify "✅ Done: imported 50 bikes in 12s"
#
# Or standalone:
#   ./scripts/notify.sh "🔔 Test message"
#
# Environment variables (read from .env or exported):
#   TELEGRAM_BOT_TOKEN  — bot token for sending messages
#   ADMIN_CHAT_ID       — default chat_id to send to (default: 413553377 = salavey13)
#   NOTIFY_SILENT       — if set to "1", suppress all notifications (for testing)
#
# If TELEGRAM_BOT_TOKEN is not set, notifications are silently skipped
# (the script continues without failing — notifications are best-effort).

set -euo pipefail

# ─── Load .env if present ────────────────────────────────────────────────────
# Walk up the directory tree looking for .env (covers monorepo layouts).
_load_notify_env() {
  local dir="${NOTIFY_SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)}"
  for _ in 1 2 3 4 5; do
    if [[ -f "$dir/.env" ]]; then
      # shellcheck disable=SC1090
      set -a; source "$dir/.env" 2>/dev/null || true; set +a
      return 0
    fi
    dir=$(dirname "$dir")
    [[ "$dir" == "/" ]] && break
  done
  return 0
}
_load_notify_env

# ─── Defaults ────────────────────────────────────────────────────────────────
: "${ADMIN_CHAT_ID:=413553377}"  # salavey13 (hardcoded for testing per user request)
: "${NOTIFY_SILENT:=}"

# ─── notify() — send a Telegram notification ────────────────────────────────
# Usage: notify "message text" [parse_mode]
# parse_mode: "HTML" (default), "MarkdownV2", or "" (plain)
notify() {
  local text="$1"
  local parse_mode="${2:-HTML}"

  # Silent mode — skip entirely (for testing)
  if [[ "$NOTIFY_SILENT" == "1" ]]; then
    return 0
  fi

  # No bot token — can't send, but don't fail the calling script
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
    return 0
  fi

  local api_url="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
  local payload

  if [[ -n "$parse_mode" ]]; then
    payload=$(printf '{"chat_id":"%s","text":"%s","parse_mode":"%s","disable_web_page_preview":true}' \
      "$ADMIN_CHAT_ID" \
      "$(echo "$text" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')" \
      "$parse_mode")
  else
    payload=$(printf '{"chat_id":"%s","text":"%s","disable_web_page_preview":true}' \
      "$ADMIN_CHAT_ID" \
      "$(echo "$text" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')")
  fi

  # Send (best-effort — don't fail the script if Telegram is down)
  curl -s -X POST "$api_url" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null 2>&1 || true
}

# ─── notify_progress() — send a progress update with percentage ─────────────
# Usage: notify_progress 50 100 "Importing bikes..."
notify_progress() {
  local current="$1"
  local total="$2"
  local label="${3:-Progress}"
  local pct=0
  if [[ "$total" -gt 0 ]]; then
    pct=$(( current * 100 / total ))
  fi
  notify "⏳ ${label}: ${current}/${total} (${pct}%)"
}

# ─── notify_error() — send an error notification ────────────────────────────
# Usage: notify_error "Failed to import bikes" "Connection timeout"
notify_error() {
  local title="$1"
  local detail="${2:-}"
  local msg="❌ <b>${title}</b>"
  if [[ -n "$detail" ]]; then
    msg="${msg}

<code>$(echo "$detail" | head -c 500)</code>"
  fi
  notify "$msg" "HTML"
}

# ─── notify_success() — send a success notification ─────────────────────────
# Usage: notify_success "Imported 50 bikes" "Total time: 12s"
notify_success() {
  local title="$1"
  local detail="${2:-}"
  local msg="✅ <b>${title}</b>"
  if [[ -n "$detail" ]]; then
    msg="${msg}

${detail}"
  fi
  notify "$msg" "HTML"
}

# ─── If run standalone (not sourced), send the first arg as a message ───────
# This lets you do: ./scripts/notify.sh "🔔 Test message"
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -gt 0 ]]; then
    notify "$1"
  else
    echo "Usage: $0 \"message text\""
    echo "Or: source $0  # then call notify() in your script"
    exit 0
  fi
fi
