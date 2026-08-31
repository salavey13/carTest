#!/usr/bin/env bash
# notify.sh — best-effort Telegram notifications for long-running bot tasks.
# Referenced from CLAUDE.md: "Долгая задача (>=30с) → апдейт через notify.sh".
#
# Usage:
#   source scripts/notify.sh
#   notify "text"                          # plain message (HTML parse_mode)
#   notify_progress 50 100 "Importing..."  # progress with percent
#   notify_error   "Title" "detail"
#   notify_success "Title" "detail"
#   ./scripts/notify.sh "standalone text"  # run directly
#
# Env (read from nearest .env walking up the dir tree, or already-set env):
#   TELEGRAM_BOT_TOKEN  — bot token
#   ADMIN_CHAT_ID       — target chat id
#   NOTIFY_SILENT=1     — suppress all output (testing)
#
# Best-effort: never fails the calling script. Missing token / network down
# => silently return 0.

_notify_send() {
  [ "${NOTIFY_SILENT:-0}" = "1" ] && return 0
  local text="$1"; local parse="${2:-HTML}"

  # Resolve token + chat from env, or from nearest .env up the tree.
  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${ADMIN_CHAT_ID:-}" ]; then
    local dir="$PWD"
    while [ "$dir" != "/" ]; do
      if [ -f "$dir/.env" ]; then
        # shellcheck disable=SC1090
        set -a; . "$dir/.env" 2>/dev/null; set +a
        break
      fi
      dir="$(dirname "$dir")"
    done
  fi

  [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && return 0
  [ -z "${ADMIN_CHAT_ID:-}" ] && return 0

  curl -s -m 10 -o /dev/null \
    --data-urlencode "chat_id=${ADMIN_CHAT_ID}" \
    --data-urlencode "text=${text}" \
    --data-urlencode "parse_mode=${parse}" \
    --data-urlencode "disable_web_page_preview=true" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" 2>/dev/null
  return 0
}

# %b interprets \n / \t as real control chars, so HTML parse_mode renders line breaks.
_notify_fmt() { printf '%b' "$1"; }

notify()          { _notify_send "$(_notify_fmt "$1")"; }
notify_progress() {
  local cur="$1" total="$2" label="${3:-}"
  local pct=0
  [ "$total" -gt 0 ] 2>/dev/null && pct=$(( cur * 100 / total ))
  _notify_send "$(_notify_fmt "<b>${label}</b>\n${cur}/${total} (${pct}%)")"
}
notify_error()   { _notify_send "$(_notify_fmt "<b>⚠️ ${1}</b>${2:+\n${2}}")"; }
notify_success() { _notify_send "$(_notify_fmt "<b>✅ ${1}</b>${2:+\n${2}}")"; }

# Standalone: ./notify.sh "text"
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ] && [ $# -gt 0 ]; then
  notify "$*"
fi
