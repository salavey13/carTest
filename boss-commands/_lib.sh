#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/_lib.sh
#
# Shared library for all boss commands. Source it at the top of any script:
#   source "$(dirname "$0")/_lib.sh"
#
# Provides:
#   - $URL, $KEY, $CREW_ID, $BOT_TOKEN, $ADMIN_CHAT_ID env vars
#   - send_telegram(text, [parse_mode])  — sends a notification to ADMIN_CHAT_ID
#   - moscow_today() / moscow_now()      — TZ-safe date helpers
#   - mask_phone(phone) / mask_email()   — PII masking
#   - log(msg)                           — stderr logging (never stdout)

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
SECRETS_FILE="${SECRETS_FILE:-/home/z/my-project/upload/secrets.txt}"

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "ERROR: secrets file not found at $SECRETS_FILE" >&2
  exit 1
fi

# Parse key=value lines (skip non-key=value lines like "secrets:" or the bare
# bot token on line 3 of the file).
while IFS='=' read -r key value; do
  # Skip blank lines, comments, and lines without '='
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
  [[ -z "$value" ]] && continue
  # Export only the keys we know about
  case "$key" in
    ADMIN_CHAT_ID|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL)
      export "$key=$value"
      ;;
  esac
done < "$SECRETS_FILE"

# Bot token is on line 3 (bare, no key=). Read it explicitly.
BOT_TOKEN=$(sed -n '3p' "$SECRETS_FILE" | tr -d '[:space:]')
export BOT_TOKEN

# ─── Derived constants ───────────────────────────────────────────────────────
URL="${NEXT_PUBLIC_SUPABASE_URL}"
KEY="${SUPABASE_SERVICE_ROLE_KEY}"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
CREW_SLUG="vip-bike"
ADMIN_CHAT_ID="${ADMIN_CHAT_ID:-413553377}"  # salavey13 — hardcoded for testing

# ─── Date helpers (Moscow TZ) ────────────────────────────────────────────────
moscow_today() {
  TZ=Europe/Moscow date +%Y-%m-%d
}

moscow_now() {
  TZ=Europe/Moscow date +"%Y-%m-%d %H:%M %Z"
}

moscow_now_iso() {
  TZ=Europe/Moscow date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# ─── PII masking ─────────────────────────────────────────────────────────────
mask_phone() {
  local phone="$1"
  [[ -z "$phone" ]] && echo "—" && return
  # Keep last 2 digits, mask the rest: +7XXXXXXXX42
  local last2="${phone: -2}"
  local prefix="${phone:0:2}"
  echo "${prefix}XXXXXXXX${last2}"
}

mask_email() {
  local email="$1"
  [[ -z "$email" ]] && echo "—" && return
  local user="${email%%@}"
  local domain="${email##*@}"
  echo "${user:0:1}…@${domain}"
}

mask_passport() {
  local passport="$1"
  [[ -z "$passport" ]] && echo "—" && return
  local last4="${passport: -4}"
  echo "XXXX…${last4}"
}

# ─── Telegram notification ───────────────────────────────────────────────────
# Usage: send_telegram "message text" [parse_mode]
# parse_mode: "HTML" (default) or "MarkdownV2" or "" (plain)
send_telegram() {
  local text="$1"
  local parse_mode="${2:-HTML}"
  local api_url="https://api.telegram.org/bot${BOT_TOKEN}/sendMessage"

  local payload
  if [[ -n "$parse_mode" ]]; then
    payload=$(jq -n --arg chat_id "$ADMIN_CHAT_ID" --arg text "$text" --arg mode "$parse_mode" \
      '{chat_id: $chat_id, text: $text, parse_mode: $mode, disable_web_page_preview: true}')
  else
    payload=$(jq -n --arg chat_id "$ADMIN_CHAT_ID" --arg text "$text" \
      '{chat_id: $chat_id, text: $text, disable_web_page_preview: true}')
  fi

  local response
  response=$(curl -s -X POST "$api_url" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1) || true

  # Check for errors (don't fail the whole script on a Telegram error — log it)
  local ok
  ok=$(echo "$response" | jq -r '.ok // "false"' 2>/dev/null || echo "false")
  if [[ "$ok" != "true" ]]; then
    log "Telegram send failed: $response"
    return 1
  fi
  return 0
}

# ─── Logging (stderr only — stdout is reserved for command output) ───────────
log() {
  echo "[$(moscow_now)] $*" >&2
}

# ─── Supabase query helper ───────────────────────────────────────────────────
# Usage: supabase_query "rentals" "select=rental_id,status&crew_id=eq.$CREW_ID"
# Note: the query string is URL-encoded by curl's --data-urlencode would be
# cleaner, but PostgREST expects raw query params in the URL. We do a minimal
# encoding of `+` (which curl would interpret as a space) to %2B so timezone
# offsets like `+03:00` survive.
supabase_query() {
  local table="$1"
  local query_string="$2"
  local profile="${3:-public}"  # "public" or "private"

  # Encode `+` → %2B (for timezone offsets like +03:00). Leave other chars alone —
  # PostgREST handles them, and over-encoding would break the operators (=, &, etc.)
  query_string="${query_string//+/%2B}"

  local headers=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")
  if [[ "$profile" == "private" ]]; then
    headers+=(-H "Accept-Profile: private")
  fi

  curl -s "${URL}/rest/v1/${table}?${query_string}" "${headers[@]}"
}

# ─── HTML escape helper ──────────────────────────────────────────────────────
html_escape() {
  local s="$1"
  s="${s//&/&amp;}"
  s="${s//</&lt;}"
  s="${s//>/&gt;}"
  echo "$s"
}

# Export everything so subshells can use it
export URL KEY CREW_ID CREW_SLUG BOT_TOKEN ADMIN_CHAT_ID
export -f moscow_today moscow_now moscow_now_iso
export -f mask_phone mask_email mask_passport
export -f send_telegram log supabase_query html_escape
