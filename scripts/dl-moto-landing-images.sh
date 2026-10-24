#!/bin/bash
# dl-moto-landing-images.sh — fetch moto-selection landing photos from tildacdn
set -u
SRC=/home/z/my-project/download/moto-selection-services/src
mkdir -p "$SRC"
cd "$SRC"
T="https://static.tildacdn.com"
declare -A IMGS=(
  [training.jpg]="$T/tild3634-3538-4336-b032-613630643439/xmoto-182-1-scaled-1.jpg"
  [pickup.png]="$T/tild6632-3031-4331-b566-363037363236/noroot.png"
  [gear.jpg]="$T/tild3436-3834-4462-a663-323333316239/9-Dainese-.jpg"
  [service.jpg]="$T/tild6333-3465-4166-b631-343964626165/6896136953128360_e1f.jpg"
  [storage.jpg]="$T/tild3231-6330-4761-a364-613338663132/8920463051_d0244dce5.jpg"
  [detailing.jpg]="$T/tild3662-6533-4431-a132-646161323463/4362862179014284_4d4.jpg"
  [hero.jpg]="$T/tild3739-3737-4761-a335-353163363963/harley-davidson-ride.jpg"
)
for f in "${!IMGS[@]}"; do
  if [ -s "$f" ]; then echo "SKIP $f"; continue; fi
  curl -sL --max-time 60 -o "$f" "${IMGS[$f]}"
  echo "GET $f -> $(stat -c%s "$f" 2>/dev/null || echo 0) bytes"
done
file * | sed 's/, [0-9]* x /, /;s/ x [0-9]* /x/'
