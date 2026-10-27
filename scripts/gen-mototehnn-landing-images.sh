#!/bin/bash
# Task 148 — generate images for the /mototehnn landing (Мототех НН).
# Recipe: moto-selection/sly13 text-hostile style — realistic photographs,
# dark navy + blue (#3b82f6) ambience to match the crew palette
# (bgBase #0a0f1a / accent #3b82f6). Empty silent panels, NO text anywhere.
set -u
OUT="/home/z/my-project/download/mototehnn-services"
mkdir -p "$OUT"

gen() {
  local name="$1"; local size="$2"; local prompt="$3"
  local out="$OUT/$name.png"
  if [ -s "$out" ]; then echo "SKIP $name (exists)"; return 0; fi
  for i in 1 2 3; do
    echo "gen $name (try $i)…"
    z-ai image -p "$prompt" -o "$out" -s "$size" && [ -s "$out" ] && { echo "OK  $name"; return 0; }
    sleep $((i * 4))
  done
  echo "FAIL $name"; return 1
}

STYLE="realistic professional photograph, dark navy-blue showroom ambience with cool blue LED accent lighting, cinematic depth of field, high detail, empty silent panels with no text anywhere, no letters, no words, no signage, no logos, no labels, no numbers, unbranded vehicles"

gen hero.png 1344x768 "wide interior of a modern motorcycle showroom at dusk, row of brand-new unbranded motorcycles and scooters on glossy dark floor with reflections, floor-to-ceiling windows, $STYLE"

gen salon.png 1152x864 "customer examining a row of new unbranded street motorcycles in a premium modern moto salon, consultant silhouette pointing at a bike, $STYLE"

gen parts.png 1152x864 "organized wall of shelves with motorcycle spare parts: exhaust pipes, brake discs, mirrors, plastic fairings, helmets on a rack, shop storage backroom, $STYLE"

gen service-to.png 1152x864 "motorcycle mechanic in clean dark uniform servicing an unbranded motorcycle on a hydraulic lift in a modern service zone, tools on a cart, $STYLE"

gen service-storage.png 1152x864 "seasonal motorcycle storage room, neat rows of motorcycles covered with grey protective covers on marked spots, clean concrete floor, subtle blue night lighting, $STYLE"

gen service-evac.png 1152x864 "flatbed tow truck at blue hour city street securely carrying an unbranded sport motorcycle strapped to the platform, hazard lights glow, wet asphalt reflections, $STYLE"

gen dealer.png 1152x864 "brand-new unbranded road cruiser motorcycle, three-quarter front view, studio shot on dark background with cool blue rim lighting and soft floor reflection, $STYLE"

echo "---done---"; ls -la "$OUT"
