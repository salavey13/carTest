#!/bin/bash
# gen-moto-selection-missing.sh — generate photos for the 2 moto-selection services
# that have no photo on the landing (svc-03 эвакуация, svc-04 выездной осмотр).
# Photorealistic to blend with the crew's real photos; brand orange #ff7522 accents.
set -u
OUT="/home/z/my-project/download/moto-selection-services"
mkdir -p "$OUT"

BASE='Professional photograph for a motorcycle service company website. Photorealistic, natural daylight, sharp focus, shallow depth of field, subtle orange (#FF7522) accent details, modern clean composition. Absolutely no text, no letters, no numbers, no logos, no watermarks, no signage with writing. High quality, realistic.'

declare -A SUBJECTS=(
  [moto-selection-svc-03]="a flatbed rollback tow truck with a sport touring motorcycle properly secured with orange ratchet straps on the deck, parked on a clean city roadside at golden hour, rear three-quarter view"
  [moto-selection-svc-04]="a thorough pre-purchase inspection scene: a person in a black leather jacket crouching beside a sport motorcycle on a parking lot, carefully examining the front brake disc with a bright flashlight, motorcycle documentation folder lying open nearby"
)

IDS=(moto-selection-svc-03 moto-selection-svc-04)

gen() { # id variant size
  local id="$1" variant="$2" size="$3"
  local dir="$OUT/$id"; mkdir -p "$dir"
  local out="$dir/$variant.png"
  if [ -s "$out" ]; then echo "SKIP $id/$variant (exists)"; return 0; fi
  local prompt="$BASE Subject: ${SUBJECTS[$id]}."
  for attempt in 1 2 3; do
    echo "GEN $id/$variant ($size) attempt $attempt ..."
    if z-ai image -p "$prompt" -o "$out" -s "$size" >/dev/null 2>&1 && [ -s "$out" ]; then
      echo "OK  $id/$variant ($(stat -c%s "$out") bytes)"; return 0
    fi
    sleep $((attempt * 3))
  done
  echo "FAIL $id/$variant"; return 1
}

FAILED=0
for id in "${IDS[@]}"; do
  gen "$id" landscape 1152x864 || FAILED=$((FAILED+1))
done
echo "DONE failed=$FAILED"
exit $FAILED
