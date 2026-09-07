#!/bin/bash
# Build with package.json flags + background peak-RSS monitor.
# Logs: build exit code, wall time, peak system-wide RSS (includes ~500MB sandbox baseline).
cd /home/z/cartest

LOG=/tmp/build-mem.log
PEAKFILE=/tmp/peak-rss.txt
echo 0 > "$PEAKFILE"

( while true; do
    SUM=$(ps -eo rss --no-headers 2>/dev/null | awk '{s+=$1} END {print s+0}')
    PREV=$(cat "$PEAKFILE" 2>/dev/null || echo 0)
    if [ "$SUM" -gt "$PREV" ]; then
      echo "$SUM" > "$PEAKFILE"
    fi
    sleep 1
  done ) &
MON_PID=$!

START=$(date +%s)
NEXT_TELEMETRY_DISABLED=1 npm run build > "$LOG" 2>&1
EXIT=$?
END=$(date +%s)

kill $MON_PID 2>/dev/null

PEAK=$(cat "$PEAKFILE" 2>/dev/null || echo 0)
echo "=== RESULT ==="
echo "exit=$EXIT  wall=$((END-START))s  peakRSS(all procs)=${PEAK}KB ($(( PEAK/1024 ))MB, baseline ~500MB)"
tail -14 "$LOG"
