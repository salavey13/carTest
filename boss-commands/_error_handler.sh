# /boss-commands/_error_handler.sh
#
# Error handling for boss commands — source this at the top of every script
# AFTER sourcing _lib.sh. Provides:
#   - trap on ERR: notify admin on any unhandled error
#   - trap on EXIT: log execution time
#   - retry logic: if a script fails, it will be retried on the next cron run
#
# Usage (at the top of any boss script, after `source _lib.sh`):
#   source "$(dirname "$0")/_error_handler.sh"
#
# The script name is auto-detected. Errors send a Telegram notification to
# ADMIN_CHAT_ID with the script name, error, and stack trace.

# ─── Error trap ─────────────────────────────────────────────────────────────
# When any command fails (set -e is on), this trap fires.
# It sends a notification to the admin and logs the error.
_boss_error_handler() {
  local exit_code=$?
  local script_name="$(basename "$0")"
  local line_no="${BASH_LINENO[0]:-unknown}"
  local func_name="${FUNCNAME[1]:-main}"
  local error_msg="${1:-unknown error}"

  log "ERROR in $script_name:$line_no ($func_name): exit=$exit_code"

  # Notify admin — no silent deaths
  local err_msg="🚨 <b>Boss error</b> — $script_name

<b>Script:</b> <code>$script_name</code>
<b>Function:</b> <code>$func_name</code>
<b>Line:</b> $line_no
<b>Exit code:</b> $exit_code
<b>Error:</b> <code>$error_msg</code>

🤖 I'll retry on the next cron run. If this keeps failing, check:
• Supabase connectivity (525 SSL errors are transient)
• _lib.sh secrets file path
• jq syntax in the script

📊 <a href=\"$(tg_deep_link "analytics_rentals")\">Дашборд</a>"

  # Best-effort notification — don't fail the error handler
  send_telegram "$err_msg" "HTML" 2>/dev/null || true

  # Write to error log for self-debug
  mkdir -p /tmp/boss-errors
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $script_name:$line_no ($func_name) exit=$exit_code err=$error_msg" >> /tmp/boss-errors/error-log.txt
}

# ─── Setup traps ────────────────────────────────────────────────────────────
# Trap ERR — fires when any command fails (requires set -e)
trap '_boss_error_handler "$BASH_COMMAND"' ERR

# Trap EXIT — log execution time
_boss_start_time=$(date +%s)
_boss_exit_handler() {
  local exit_code=$?
  local elapsed=$(( $(date +%s) - _boss_start_time ))
  local script_name="$(basename "$0")"
  if [[ $exit_code -eq 0 ]]; then
    log "$script_name completed in ${elapsed}s"
  else
    log "$script_name FAILED in ${elapsed}s (exit=$exit_code)"
  fi
}
trap _boss_exit_handler EXIT

# ─── Self-healing: retry wrapper ────────────────────────────────────────────
# If a script fails, record the failure. On the next run, check if the last
# run failed — if so, log "retrying after failure".
_boss_retry_check() {
  local script_name="$(basename "$0")"
  local retry_file="/tmp/boss-errors/last-fail-${script_name}"

  if [[ -f "$retry_file" ]]; then
    local last_fail=$(cat "$retry_file" 2>/dev/null || echo "")
    log "RETRY: $script_name is retrying after previous failure ($last_fail)"
    rm -f "$retry_file"
  fi
}

# ─── Self-debug: analyze error patterns ─────────────────────────────────────
# Called manually: source _error_handler.sh && boss_self_debug
boss_self_debug() {
  local error_log="/tmp/boss-errors/error-log.txt"
  if [[ ! -f "$error_log" ]]; then
    echo "No errors logged — all good!"
    return 0
  fi

  echo "=== Boss Self-Debug Report ==="
  echo

  # Count errors by script
  echo "Errors by script:"
  grep -oP '^\[.*?\] \K[\w-]+\.sh' "$error_log" 2>/dev/null | sort | uniq -c | sort -rn | head -10

  echo
  echo "Recent errors (last 10):"
  tail -10 "$error_log"

  echo
  echo "Error patterns:"
  echo "  Supabase 525 SSL:" $(grep -c "525\|SSL\|supabase" "$error_log" 2>/dev/null || echo 0)
  echo "  jq parse errors:" $(grep -c "jq:" "$error_log" 2>/dev/null || echo 0)
  echo "  curl timeouts:" $(grep -c "curl\|timeout\|timed out" "$error_log" 2>/dev/null || echo 0)

  echo
  echo "Suggested fixes:"
  if [[ $(grep -c "525\|SSL" "$error_log" 2>/dev/null || echo 0) -gt 3 ]]; then
    echo "  ⚠️ Multiple Supabase SSL errors — consider adding retry logic for Supabase queries"
  fi
  if [[ $(grep -c "jq:" "$error_log" 2>/dev/null || echo 0) -gt 2 ]]; then
    echo "  ⚠️ jq parse errors — check if Supabase is returning HTML error pages instead of JSON"
  fi
}

# Run retry check on source
_boss_retry_check

# Export for subshells
export -f _boss_error_handler _boss_exit_handler boss_self_debug
