#!/bin/bash
# Daily catalog CSV sync: Supabase -> rental repo public/docs/autoreply/ (via git).
# Uses repo's own scripts (export_vip_bike_csv.py + push_catalog_csvs.py) from rental-repo/ clone.
# Logs: /opt/claudeclaw/vip-bike/logs/catalog-csv.log
set -u
BASE=/opt/claudeclaw/vip-bike
REPO=$BASE/rental-repo

set -a; source "$BASE/.env"; set +a

echo "=== $(date -u "+%Y-%m-%d %H:%M UTC") catalog sync ==="

cd "$REPO" || exit 1
# Self-heal: drop any failed local commits, follow origin/main
git fetch origin main -q && git reset --hard origin/main -q || true

if python3 "$REPO/scripts/export_vip_bike_csv.py"; then
  if python3 "$REPO/scripts/push_catalog_csvs.py"; then
    echo "OK"
  else
    echo "PUSH FAILED (git push in $REPO)"
    "$BASE/scripts/notify.sh" "Каталог-синк: пуш в GitHub не прошёл. Смотри logs/catalog-csv.log" || true
    exit 1
  fi
else
  echo "EXPORT FAILED (check Supabase creds)"
  "$BASE/scripts/notify.sh" "Каталог-синк: экспорт CSV из Supabase упал. Смотри logs/catalog-csv.log" || true
  exit 1
fi
