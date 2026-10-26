#!/bin/bash
# gen-vipbike-services.sh — generate "talking" images for all 48 vip-bike service items.
# Each image must be readable at a glance (what the service is) without any text.
# Style: dark premium workshop, cinematic photoreal, neon orange #FF7522 rim light
# + subtle violet secondary glow. Text-hostile base (no CJK/letters/numbers).
# One landscape 1152x864 per item -> later attention-cropped to square + 4:3.
set -u
OUT="/home/z/my-project/download/vipbike-services"
mkdir -p "$OUT"

BASE='Dark premium motorcycle workshop scene, cinematic photorealistic, deep midnight shadows with dramatic neon orange rim lighting and a subtle violet secondary glow, clean centered composition, shallow depth of field, premium futuristic mood. Purely pictorial: strictly no text, no letters, no numbers, no characters of any language, no logos, no brand marks, no labels, no watermarks, no signage. Silent equipment.'

declare -A SUBJ=(
  [vip-bike-svc-001]="a large glowing orange workshop wall clock with a blank face marked only by plain tick marks and glowing hands, above a tool workbench with a wrench, symbolizing billable standard work hours"
  [vip-bike-svc-002]="a mechanic in gloves cleaning and oiling a motorcycle chain with a spray can and brush, rear sprocket visible"
  [vip-bike-svc-003]="fresh engine oil being poured from a bottle into a motorcycle engine through a funnel, dark oil drain pan below"
  [vip-bike-svc-004]="a hand holding a new cylindrical oil filter next to an opened motorcycle engine casing"
  [vip-bike-svc-005]="a single glowing spark plug held in a mechanic glove near a spark plug socket wrench"
  [vip-bike-svc-006]="a diagnostic laptop on a stool connected by a cable to a motorcycle, screen glowing with abstract orange graphs, no readable characters"
  [vip-bike-svc-007]="a motorcycle front wheel clamped in a professional tire changer machine, tire irons and a new tire nearby"
  [vip-bike-svc-008]="an opened brake caliper on a motorcycle disc with new brake pads being inserted by gloved fingers"
  [vip-bike-svc-009]="a motorcycle front fork with a spanner adjusting the suspension preload collars, clicker knobs glowing orange"
  [vip-bike-svc-010]="a new pleated air filter element held above an opened motorcycle airbox"
  [vip-bike-svc-011]="a partially assembled motorcycle frame on a workshop lift, components and tools arranged around it"
  [vip-bike-svc-012]="a mechanic checking the side kickstand sensor of a motorcycle with a multimeter, removed lower fairing panels leaning nearby"
  [vip-bike-svc-013]="a close-up of gloved hands holding small electrical limit switches and connectors over a workbench"
  [vip-bike-svc-014]="a removed throttle grip and exposed handlebar with a disconnected wiring connector, tools beside"
  [vip-bike-svc-015]="a new right motorcycle footpeg being bolted onto the footrest mount"
  [vip-bike-svc-016]="a brake bleeder kit on a motorcycle caliper, a transparent tube with amber brake fluid flowing into a bottle"
  [vip-bike-svc-017]="a spray gun painting a small motorcycle fairing panel in orange inside a paint booth"
  [vip-bike-svc-018]="a motorcycle side fairing panel being spray painted orange in a paint booth, the bare bike behind"
  [vip-bike-svc-019]="a motorcycle chain being lubricated with a spray and wiped with a cloth by a gloved hand"
  [vip-bike-svc-020]="a motorcycle on a rear stand with its front wheel removed, the brake caliper hanging on a wire, axle tool nearby"
  [vip-bike-svc-021]="a wrench loosening the chain tensioner bolts on a motorcycle rear axle"
  [vip-bike-svc-022]="a new rubber handlebar grip being slid onto a motorcycle handlebar end"
  [vip-bike-svc-023]="a chain tension checking tool pressed against a motorcycle chain while a gloved hand tensions the axle nut"
  [vip-bike-svc-024]="sparks flying from welding repair of a motorcycle crash bar plow mount bracket"
  [vip-bike-svc-025]="a motorcycle seat being fastened with an Allen key, a painted handlebar piece and a disassembled switch pod on the bench"
  [vip-bike-svc-026]="a motorcycle swingarm and brake disc being cleaned with a detailing brush"
  [vip-bike-svc-027]="soldering iron repairing the sensor wire of a motorcycle footpeg assembly"
  [vip-bike-svc-028]="a motorcycle wheel spinning in a truing stand while a mechanic aligns the brake caliper clearance"
  [vip-bike-svc-029]="new bushings being pressed into a motorcycle mounting point, mirrors being installed on the handlebar"
  [vip-bike-svc-030]="a torque wrench tightening a motorcycle rear axle nut to tension the chain"
  [vip-bike-svc-031]="a drop of oil from a small applicator bottle lubricating a motorcycle front brake lever pivot"
  [vip-bike-svc-032]="a removed motorcycle fairing panel resting on the bench while an electrical relay unit is bolted to the frame"
  [vip-bike-svc-033]="a multimeter with probes testing a motorcycle wiring harness, glowing connectors"
  [vip-bike-svc-034]="a mechanic straightening a motorcycle handlebar, front wheel clamped, sight line down the bar"
  [vip-bike-svc-035]="a motorcycle front wheel in a truing stand with side panels removed, spoke wrench adjusting the rim"
  [vip-bike-svc-036]="a right motorcycle mirror being repaired, adhesive and a screwdriver on the workbench"
  [vip-bike-svc-037]="a removed gear shift lever and a motorcycle footpeg with a new bolt being installed"
  [vip-bike-svc-038]="a motorcycle rear wheel removed, new brake pads sliding into the rear caliper, brake parts on the bench"
  [vip-bike-svc-039]="a new front brake caliper and disc assembly being mounted on a motorcycle fork"
  [vip-bike-svc-040]="gloved hands swapping an electrical relay breaker unit on a motorcycle frame, connectors exposed"
  [vip-bike-svc-041]="a glowing battery pack being slid into a motorcycle battery compartment, the seat ready to mount"
  [vip-bike-svc-042]="an assembled motorcycle side panel and crash plow with freshly painted orange mirrors drying"
  [vip-bike-svc-043]="a row of motorcycles in a dark garage being audited with a glowing tablet in hand, orange scan light sweeping"
  [vip-bike-svc-044]="a motorcycle dashboard disassembled with the handlebar removed, wires and gauges on the bench"
  [vip-bike-svc-045]="frame protection sliders and guards being installed on a motorcycle body"
  [vip-bike-svc-046]="a rear sprocket and front and rear brake discs being bolted onto a motorcycle wheel hub"
  [vip-bike-svc-047]="a supermoto motorcycle with both wheels off the ground being refitted with wheels, chain tensioning tool in view"
  [vip-bike-svc-048]="a neatly coiled hose being measured and routed along a motorcycle frame with cable ties"
)

IDS=$(printf '%s\n' "${!SUBJ[@]}" | sort)
# optional slice filter: gen-vipbike-services.sh 0 3  -> every 3rd id starting at 0
if [ $# -ge 2 ]; then
  IDS=$(printf '%s\n' "$IDS" | awk -v s="$1" -v n="$2" 'NR % n == s')
fi

gen() { # id
  local id="$1"
  local dir="$OUT/$id"; mkdir -p "$dir"
  local out="$dir/landscape.png"
  if [ -s "$out" ]; then echo "SKIP $id (exists)"; return 0; fi
  local prompt="$BASE Subject: ${SUBJ[$id]}."
  for attempt in 1 2 3; do
    echo "GEN $id attempt $attempt ..."
    if z-ai image -p "$prompt" -o "$out" -s 1152x864 >/dev/null 2>&1 && [ -s "$out" ]; then
      echo "OK  $id ($(stat -c%s "$out") bytes)"; return 0
    fi
    sleep $((attempt * 3))
  done
  echo "FAIL $id"; return 1
}

FAILED=0
for id in $IDS; do
  gen "$id" || FAILED=$((FAILED+1))
done
echo "DONE failed=$FAILED"
exit $FAILED
