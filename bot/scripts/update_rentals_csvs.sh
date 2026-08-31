#!/bin/bash
# Hourly rentals CSV sync: Supabase -> rental repo public/docs/autoreply/ (via git).
# Uses repo's own scripts (export_vip_bike_rentals.py + push_rentals_csv.py) from rental-repo/ clone.
# Logs: /opt/claudeclaw/vip-bike/logs/rentals-csv.log
set -u
BASE=/opt/claudeclaw/vip-bike
REPO=$BASE/rental-repo

set -a; source "$BASE/.env"; set +a

echo "=== $(date -u "+%Y-%m-%d %H:%M UTC") rentals sync ==="

cd "$REPO" || exit 1
# Self-heal: drop any failed local commits, follow origin/main
git fetch origin main -q && git reset --hard origin/main -q || true

if python3 "$REPO/scripts/export_vip_bike_rentals.py"; then
  if python3 "$REPO/scripts/push_rentals_csv.py"; then
    echo "OK"
  else
    echo "PUSH FAILED (git push in $REPO)"
    "$BASE/scripts/notify.sh" "Аренды-синк: пуш в GitHub не прошёл. Смотри logs/rentals-csv.log" || true
    exit 1
  fi
else
  echo "EXPORT FAILED (check Supabase creds)"
  "$BASE/scripts/notify.sh" "Аренды-синк: экспорт CSV из Supabase упал. Смотри logs/rentals-csv.log" || true
  exit 1
fi
