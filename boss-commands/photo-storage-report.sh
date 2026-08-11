#!/usr/bin/env bash
# /home/z/my-project/boss-commands/photo-storage-report.sh
#
# I4 — Weekly photo storage growth report.
# Queries rental_photos for the last 7 days, sums file_size_bytes per day,
# and alerts if weekly growth > 100 MB (configurable).
#
# Cron schedule: every Monday at 11:00 Moscow = 08:00 UTC = "0 8 * * 1"
#
# Usage:
#   ./photo-storage-report.sh              # sends Telegram notification
#   ./photo-storage-report.sh --dry-run    # prints to stdout
#
# PRD: docs/RENTAL_PHOTO_UPLOAD_PRD.md v1.3 §6 (Phase 4)
# Meta: docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md I4

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")

log "Running photo-storage-report at $NOW_DISPLAY МСК"

# ─── Configuration ──────────────────────────────────────────────────────────
ALERT_THRESHOLD_MB="${PHOTO_STORAGE_ALERT_MB:-100}"

# Date range: last 7 days (Moscow TZ)
WEEK_AGO=$(TZ=Europe/Moscow date -d '7 days ago' +"%Y-%m-%dT00:00:00+03:00")
WEEK_END=$(TZ=Europe/Moscow date +"%Y-%m-%dT23:59:59+03:00")

log "Window: $WEEK_AGO → $WEEK_END (7 days, Moscow TZ)"
log "Alert threshold: ${ALERT_THRESHOLD_MB} MB/week"

# ─── Fetch photos uploaded in the last 7 days ───────────────────────────────
PHOTOS_DATA=$(supabase_query "rental_photos" \
  "select=file_size_bytes,created_at,photo_type,rental_id&created_at=gte.${WEEK_AGO}&created_at=lte.${WEEK_END}&order=created_at.asc" \
  "public")

PHOTO_COUNT=$(echo "$PHOTOS_DATA" | jq 'length')
TOTAL_BYTES=$(echo "$PHOTOS_DATA" | jq '[.[].file_size_bytes // 0] | add // 0')
TOTAL_MB=$(echo "scale=2; $TOTAL_BYTES / 1048576" | bc)

log "Photos this week: $PHOTO_COUNT"
log "Total size: $TOTAL_BYTES bytes ($TOTAL_MB MB)"

# ─── Per-day breakdown ──────────────────────────────────────────────────────
DAILY_BREAKDOWN=$(echo "$PHOTOS_DATA" | jq -r '
  group_by(.created_at[0:10]) | map({
    day: .[0].created_at[0:10],
    count: length,
    bytes: ([.[].file_size_bytes // 0] | add // 0)
  }) | .[] |
  "  \(.day): \(.count) photos, \((.bytes / 1048576 * 100 | floor) / 100) MB"
')

# ─── Per-rental top 5 (by photo count) ──────────────────────────────────────
TOP_RENTALS=$(echo "$PHOTOS_DATA" | jq -r '
  group_by(.rental_id) | map({
    rental: .[0].rental_id,
    count: length,
    bytes: ([.[].file_size_bytes // 0] | add // 0)
  }) | sort_by(-.count) | .[0:5] | .[] |
  "  #\(.rental[0:8]): \(.count) photos, \((.bytes / 1048576 * 100 | floor) / 100) MB"
')

# ─── Total storage used (all-time) ──────────────────────────────────────────
ALL_TIME_DATA=$(supabase_query "rental_photos" \
  "select=file_size_bytes&archived_at=is.null&deleted_at=is.null" \
  "public")

ALL_TIME_COUNT=$(echo "$ALL_TIME_DATA" | jq 'length')
ALL_TIME_BYTES=$(echo "$ALL_TIME_DATA" | jq '[.[].file_size_bytes // 0] | add // 0')
ALL_TIME_MB=$(echo "scale=2; $ALL_TIME_BYTES / 1048576" | bc)
FREE_TIER_LIMIT_MB=1024
PCT_USED=$(echo "scale=1; $ALL_TIME_MB * 100 / $FREE_TIER_LIMIT_MB" | bc)

log "All-time active storage: $ALL_TIME_COUNT photos, $ALL_TIME_MB MB ($PCT_USED% of 1GB free tier)"

# ─── Compose message ────────────────────────────────────────────────────────
ALERT_EMOJI=""
ALERT_NOTE=""
ALERT_THRESHOLD_BYTES=$((ALERT_THRESHOLD_MB * 1048576))
if [[ "$TOTAL_BYTES" -gt "$ALERT_THRESHOLD_BYTES" ]]; then
  ALERT_EMOJI="🔴 "
  ALERT_NOTE="
⚠️ Weekly growth (${TOTAL_MB} MB) exceeds ${ALERT_THRESHOLD_MB} MB threshold.
Consider: increase compression, shorten retention, or upgrade to paid tier."
else
  ALERT_EMOJI="✅ "
fi

# Format dates for header
WEEK_START_DISPLAY=$(TZ=Europe/Moscow date -d '7 days ago' +"%d.%m")
WEEK_END_DISPLAY=$(TZ=Europe/Moscow date +"%d.%m")

MESSAGE="${ALERT_EMOJI}<b>Фото-отчёт за неделю</b> — ${WEEK_START_DISPLAY}–${WEEK_END_DISPLAY}, ${NOW_DISPLAY} МСК

📊 <b>За неделю:</b>
Фотографий: ${PHOTO_COUNT}
Объём: ${TOTAL_MB} МБ${ALERT_NOTE}

📅 <b>По дням:</b>
${DAILY_BREAKDOWN:-  нет данных}

🏆 <b>Топ-5 аренд (по кол-ву фото):</b>
${TOP_RENTALS:-  нет данных}

💽 <b>Всего на хранении (активные):</b>
${ALL_TIME_COUNT} фото, ${ALL_TIME_MB} МБ
${PCT_USED}% от 1 ГБ free-tier

📊 Дашборд: <a href=\"$(analytics_link "rentals")\">Открыть</a>"

# ─── Send ───────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent photo-storage-report to chat $ADMIN_CHAT_ID"
fi
