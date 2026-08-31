#!/usr/bin/env bash
# broadcast.sh — разослать одно сообщение всем chat_id из ALLOWED_CHAT_ID.
# Используется cron-джобами (boss-mode) для доставки сводок всей команде.
#
# Usage:
#   bash scripts/broadcast.sh "текст сообщения"
#   echo "текст" | bash scripts/broadcast.sh -
#
# Env (читает из ближайшего .env вверх по дереву):
#   TELEGRAM_BOT_TOKEN  — bot token
#   ALLOWED_CHAT_ID     — CSV chat_id (6266482385,356282674,...)
#   BROADCAST_SILENT=1  — подавить вывод
#
# Best-effort: каждая отправка изолирована, ошибка на одном chat_id не валит остальные.

set -u

# --- resolve env ---
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${ALLOWED_CHAT_ID:-}" ]; then
  dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/.env" ]; then
      set -a; . "$dir/.env" 2>/dev/null; set +a
      break
    fi
    dir="$(dirname "$dir")"
  done
fi

[ -z "${TELEGRAM_BOT_TOKEN:-}" ] && { echo "[broadcast] TELEGRAM_BOT_TOKEN missing" >&2; exit 1; }
[ -z "${ALLOWED_CHAT_ID:-}" ]    && { echo "[broadcast] ALLOWED_CHAT_ID missing" >&2; exit 1; }

# --- text ---
text=""
if [ $# -eq 0 ]; then
  text="$(cat)"
elif [ "$1" = "-" ]; then
  text="$(cat)"
else
  text="$*"
fi

[ -z "$text" ] && { echo "[broadcast] empty text" >&2; exit 1; }

# --- iterate chat_ids ---
IFS=',' read -ra IDS <<< "$ALLOWED_CHAT_ID"
ok=0; fail=0
for cid in "${IDS[@]}"; do
  cid="$(echo "$cid" | tr -d '[:space:]')"
  [ -z "$cid" ] && continue
  resp=$(curl -s -m 15 -o /dev/null -w "%{http_code}" \
    --data-urlencode "chat_id=${cid}" \
    --data-urlencode "text=${text}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "disable_web_page_preview=true" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" 2>/dev/null)
  if [ "${BROADCAST_SILENT:-0}" != "1" ]; then
    if [ "$resp" = "200" ]; then
      echo "[broadcast] ok   ${cid}"
    else
      echo "[broadcast] FAIL ${cid} (HTTP ${resp})" >&2
    fi
  fi
  [ "$resp" = "200" ] && ok=$((ok+1)) || fail=$((fail+1))
done

[ "${BROADCAST_SILENT:-0}" != "1" ] && echo "[broadcast] sent: ok=${ok} fail=${fail}"
exit 0
