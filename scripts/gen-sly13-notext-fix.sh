#!/bin/bash
# gen-sly13-notext-fix.sh — regenerate the sly13 service images that came out with
# Chinese hieroglyphs (edu-002 both variants, mnt-001 landscape). Same subjects as
# task 112, but a text-hostile base: no "service card" phrasing (it triggers
# rendered CJK titles), explicit abstract-dash HUD panels only.
set -u
OUT="/home/z/my-project/download/sly13-services"
mkdir -p "$OUT"

BASE='Dark cyberpunk tech illustration. Deep midnight navy background, neon cyan and violet glow accents, subtle holographic UI panels showing ONLY abstract dash marks and thin circuit lines, clean centered composition, soft volumetric light, premium futuristic mood. Purely pictorial: strictly no text, no letters, no numbers, no words, no characters of any language, no hieroglyphs, no typography, no logos, no watermark. Empty silent panels, not documents.'

declare -A SUBJECTS=(
  [sly13-edu-002:portrait]="an ascending staircase of five glowing holographic glass cubes rising toward a floating neon graduation cap, symbolizing an extended five-hour deep training course"
  [sly13-edu-002:landscape]="an ascending staircase of five glowing holographic glass cubes rising toward a floating neon graduation cap, symbolizing an extended five-hour deep training course"
  [sly13-mnt-001:landscape]="a neon shield with a pulsing heartbeat line encircled by a slow orbital ring and a subtle calendar halo, symbolizing ongoing monthly support and care"
)

gen() { # id variant size
  local id="$1" variant="$2" size="$3"
  local dir="$OUT/$id"; mkdir -p "$dir"
  local out="$dir/$variant.png"
  if [ -s "$out" ]; then echo "SKIP $id/$variant (exists)"; return 0; fi
  local prompt="$BASE Subject: ${SUBJECTS[$id:$variant]}."
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
gen sly13-edu-002 portrait 768x1344 || FAILED=$((FAILED+1))
gen sly13-edu-002 landscape 1152x864 || FAILED=$((FAILED+1))
gen sly13-mnt-001 landscape 1152x864 || FAILED=$((FAILED+1))
echo "DONE failed=$FAILED"
exit $FAILED
