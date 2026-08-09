#!/usr/bin/env bash
# catalog-add.sh — Add bikes/services/sale-items to VIP Bike catalog (public.cars)
# Usage: see SKILL.md. Commands: add-bike | add-service | add-sale-item | list-catalog | get-reference | find-reference
set -euo pipefail

# --- resolve env ---
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  for cand in /opt/claudeclaw/vip-bike/.env /opt/vip-bike-rental/.env; do
    if [ -f "$cand" ]; then set -a; . "$cand"; set +a; break; fi
  done
fi
[ -z "${SUPABASE_URL:-}" ] && { echo "ERR: SUPABASE_URL missing" >&2; exit 1; }
[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && { echo "ERR: SUPABASE_SERVICE_ROLE_KEY missing" >&2; exit 1; }

CREW_ID="${CREW_ID:-2d5fde70-1dd3-4f0d-8d72-66ccf6908746}"
CREW_SLUG="${CREW_SLUG:-vip-bike}"
STORAGE_BUCKET="${STORAGE_BUCKET:-carpix}"
DEFAULT_OWNER="${DEFAULT_OWNER:-356282674}"  # I_O_S_NN

HDR=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json")

# --- helpers ---
die() { echo "ERR: $*" >&2; exit 1; }

round100() { # round to nearest 100
  local n=$1
  echo $(( (n + 50) / 100 * 100 ))
}

calc_tiers() { # base price → JSON fragment with all 11 tiers + dailyPrice
  local base=$1
  local h2h h3h h6h h12h wd wh we weh r24 r510 r1130
  h2h=$(round100 $((base * 60 / 100)))
  h3h=$(round100 $((base * 75 / 100)))
  h6h=$(round100 $((base * 80 / 100)))
  h12h=$(round100 $((base * 90 / 100)))
  wd=$base
  wh=$(round100 $((base * 40 / 100)))
  we=$(round100 $((base * 125 / 100)))
  weh=$(round100 $((base * 50 / 100)))
  r24=$(round100 $((base * 80 / 100)))
  r510=$(round100 $((base * 65 / 100)))
  r1130=$(round100 $((base * 60 / 100)))

  jq -nc --arg base "$base" --arg h2h "$h2h" --arg h3h "$h3h" --arg h6h "$h6h" --arg h12h "$h12h" \
    --arg wd "$wd" --arg wh "$wh" --arg we "$we" --arg weh "$weh" \
    --arg r24 "$r24" --arg r510 "$r510" --arg r1130 "$r1130" '{
      dailyPrice: ($base|tonumber),
      price_per_hour: ($wh|tonumber),
      price_per_2h: ($h2h|tonumber),
      price_per_3h: ($h3h|tonumber),
      price_per_6h: ($h6h|tonumber),
      price_per_12h: ($h12h|tonumber),
      rent_weekday: ($wd|tonumber),
      rent_weekday_hour: ($wh|tonumber),
      rent_weekend: ($we|tonumber),
      rent_weekend_hour: ($weh|tonumber),
      rent_2_4d: ($r24|tonumber),
      rent_5_10d: ($r510|tonumber),
      rent_11_30d: ($r1130|tonumber)
    }'
}

upload_images() { # bikeId, imageDir → returns gallery URLs (JSON array); also returns image_1 URL on fd 3
  local bikeId=$1 imgdir=$2
  [ -d "$imgdir" ] || die "image-dir not found: $imgdir"
  local tmp; tmp=$(mktemp -d)
  local i=0
  shopt -s nullglob nocaseglob
  for f in "$imgdir"/*.jpg "$imgdir"/*.jpeg "$imgdir"/*.png "$imgdir"/*.webp; do
    i=$((i+1))
    cp "$f" "$tmp/image_${i}.jpg"
  done
  shopt -u nullglob nocaseglob
  [ "$i" -gt 0 ] || die "no images in $imgdir"

  # image_1_4x3.jpg (Avito cover) — ImageMagick first, then Python/Pillow fallback, then skip
  if command -v convert >/dev/null 2>&1; then
    convert "$tmp/image_1.jpg" -resize 1200x900^ -gravity center -extent 1200x900 "$tmp/image_1_4x3.jpg" 2>/dev/null || true
  elif command -v python3 >/dev/null 2>&1 && python3 -c "import PIL" 2>/dev/null; then
    python3 - "$tmp/image_1.jpg" "$tmp/image_1_4x3.jpg" <<'PYEOF' 2>/dev/null || true
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im = im.resize((1200, 900), Image.LANCZOS)  # naive squash; for proper crop use ImageOps.fit
left = max(0, (im.width - 1200) // 2)
top  = max(0, (im.height - 900) // 2)
im.crop((left, top, left + 1200, top + 900)).save(dst, "JPEG", quality=88)
PYEOF
  fi

  # upload each
  local gallery_urls="[]"
  for img in "$tmp"/*.jpg; do
    local name; name=$(basename "$img")
    local mime="image/jpeg"
    local upstatus
    upstatus=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$SUPABASE_URL/storage/v1/object/$STORAGE_BUCKET/$bikeId/$name" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: $mime" \
      --data-binary "@$img") || true
    if [ "$upstatus" != "200" ]; then
      echo "WARN: upload $name → HTTP $upstatus" >&2
    fi
    if [[ "$name" != *_4x3.jpg ]]; then
      local url="$SUPABASE_URL/storage/v1/object/public/$STORAGE_BUCKET/$bikeId/$name"
      gallery_urls=$(echo "$gallery_urls" | jq --arg u "$url" '. + [$u]')
    fi
  done
  rm -rf "$tmp"
  echo "$gallery_urls"
}

slugify() { # make+model+year → kebab-case id
  local s="$1"
  echo "$s" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-g; s/^-//; s/-$//'
}

# --- commands ---
cmd_add_bike() {
  local id="" make="" model="" price="" sale=0 sale_only=0 sale_price=""
  local year="" color="" owner="$DEFAULT_OWNER" imgdir="" features=""
  local description="" source_url="" specs_file=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --id) id="$2"; shift 2;;
      --make) make="$2"; shift 2;;
      --model) model="$2"; shift 2;;
      --price) price="$2"; shift 2;;
      --sale) sale=1; shift;;
      --sale-only) sale_only=1; sale=1; shift;;
      --sale-price) sale_price="$2"; sale=1; shift 2;;
      --year) year="$2"; shift 2;;
      --color) color="$2"; shift 2;;
      --owner) owner="$2"; shift 2;;
      --image-dir) imgdir="$2"; shift 2;;
      --features) features="$2"; shift 2;;
      --description) description="$2"; shift 2;;
      --source-url) source_url="$2"; shift 2;;
      --specs-file) specs_file="$2"; shift 2;;
      *) die "unknown arg: $1";;
    esac
  done

  [ -n "$make" ] && [ -n "$model" ] || die "--make --model required"
  if [ "$sale_only" = 1 ]; then
    # sale-only bikes have no rent tiers; daily_price = 0
    price="${price:-0}"
  else
    [ -n "$price" ] || die "--price required (or use --sale-only for sale-only bike)"
  fi
  [ -n "$id" ] || id=$(slugify "${make}-${model}${year:+-$year}")
  [[ "$price" =~ ^[0-9]+$ ]] || die "--price must be integer"

  # if --sale-only without explicit --sale-price, error out (need sale price)
  if [ "$sale_only" = 1 ] && [ -z "$sale_price" ]; then
    die "--sale-only requires --sale-price <rub>"
  fi

  # check duplicates
  local exists; exists=$(curl -s "$SUPABASE_URL/rest/v1/cars?select=id&id=eq.$id" "${HDR[@]}" | jq '. | length')
  [ "$exists" -gt 0 ] && die "bikeId '$id' already exists — choose another --id"

  # image upload (optional)
  local gallery="[]" image_url="null"
  if [ -n "$imgdir" ]; then
    echo "→ uploading images from $imgdir..." >&2
    gallery=$(upload_images "$id" "$imgdir")
    image_url=$(echo "$gallery" | jq -r '.[0] // empty')
  fi

  # build specs — start from defaults, then optionally merge --specs-file
  local features_json="[]"
  [ -n "$features" ] && features_json=$(echo "$features" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; ""))')

  local effective_sale_price
  if [ -n "$sale_price" ]; then effective_sale_price="$sale_price"; else effective_sale_price="$price"; fi

  local specs
  specs=$(jq -nc --arg make "$make" --arg model "$model" --arg year "$year" --arg color "$color" \
    --argjson features "$features_json" --argjson gallery "$gallery" \
    --argjson sale_flag "$([ $sale = 1 ] && echo true || echo false)" \
    --argjson rent_flag "$([ $sale_only = 1 ] && echo 0 || echo 1)" \
    --arg source_url "$source_url" \
    --argjson sale_price_num "${effective_sale_price:-0}" \
    '{
      make: $make, model: $model, year: $year, color: $color,
      rent: $rent_flag,
      sale: $sale_flag,
      sale_price: (if $sale_price_num > 0 then $sale_price_num else null end),
      features: $features,
      gallery: $gallery,
      hidden: false
    } + (if $source_url != "" then {source: $source_url} else {} end)')

  # if --specs-file provided, deep-merge it on top (rich electrobike specs: spec_labels, buy_colors, etc.)
  if [ -n "$specs_file" ]; then
    [ -f "$specs_file" ] || die "--specs-file not found: $specs_file"
    specs=$(jq -Ss '.[0] * .[1]' <(echo "$specs") "$specs_file")
  fi

  # add price tiers unless sale-only
  if [ "$sale_only" != 1 ] && [ "$price" -gt 0 ]; then
    local tiers; tiers=$(calc_tiers "$price")
    specs=$(jq -Ss '.[0] * .[1]' <(echo "$specs") <(echo "$tiers"))
  fi

  local row
  row=$(jq -nc --arg id "$id" --arg make "$make" --arg model "$model" --argjson price "$price" \
    --arg image_url "$image_url" --arg owner "$owner" --arg crew "$CREW_ID" \
    --arg description "$description" --argjson specs "$specs" '{
      id: $id, make: $make, model: $model,
      description: (if $description == "" then null else $description end),
      daily_price: $price,
      image_url: (if $image_url == "null" or $image_url == "" then null else $image_url end),
      specs: $specs,
      owner_id: $owner,
      crew_id: $crew,
      type: "bike",
      is_test_result: false,
      quantity: 1,
      availability_rules: {}
    }')

  echo "→ inserting $id..." >&2
  local result
  result=$(curl -s -X POST "$SUPABASE_URL/rest/v1/cars" \
    "${HDR[@]}" -H "Prefer: return=representation" \
    --data "$row") || die "REST insert failed"
  local inserted_id; inserted_id=$(echo "$result" | jq -r '.[0].id // empty')
  if [ -z "$inserted_id" ]; then
    echo "ERR: insert failed. Response:" >&2
    echo "$result" | jq '.' >&2
    exit 1
  fi
  echo "✅ bike added: $inserted_id"
  echo "   make=$make model=$model"
  echo "   rent=$([ $sale_only = 1 ] && echo NO || echo "yes ${price}₽/day")  sale=$([ $sale = 1 ] && echo "yes ${effective_sale_price}₽" || echo no)"
  echo "   images: $(echo "$gallery" | jq 'length')"
  if [ -n "$image_url" ] && [ "$image_url" != "null" ]; then
    echo "   cover: $image_url"
  fi
}

cmd_add_service() {
  local id="" name="" price="" desc=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --id) id="$2"; shift 2;;
      --name) name="$2"; shift 2;;
      --price) price="$2"; shift 2;;
      --description) desc="$2"; shift 2;;
      *) die "unknown arg: $1";;
    esac
  done
  [ -n "$id" ] && [ -n "$name" ] && [ -n "$price" ] || die "--id --name --price required"
  [[ "$price" =~ ^[0-9]+$ ]] || die "--price must be integer"

  local row
  row=$(jq -nc --arg id "$id" --arg name "$name" --argjson price "$price" \
    --arg desc "$desc" --arg crew "$CREW_ID" --arg owner "$DEFAULT_OWNER" '{
      id: $id, make: "—", model: $name,
      daily_price: $price,
      description: $desc,
      specs: {type: "service", rent: false, sale: false, name: $name, price: $price},
      owner_id: $owner,
      crew_id: $crew,
      type: "service",
      is_test_result: false,
      quantity: 1,
      availability_rules: {}
    }')
  local result
  result=$(curl -s -X POST "$SUPABASE_URL/rest/v1/cars" \
    "${HDR[@]}" -H "Prefer: return=representation" --data "$row") || die "REST insert failed"
  local inserted_id; inserted_id=$(echo "$result" | jq -r '.[0].id // empty')
  [ -z "$inserted_id" ] && { echo "ERR: $result" >&2; exit 1; }
  echo "✅ service added: $inserted_id ($name, ${price}₽)"
}

cmd_add_sale_item() {
  local id="" make="" model="" price="" year="" color="" imgdir=""
  local description="" source_url="" specs_file=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --id) id="$2"; shift 2;;
      --make) make="$2"; shift 2;;
      --model) model="$2"; shift 2;;
      --price) price="$2"; shift 2;;
      --year) year="$2"; shift 2;;
      --color) color="$2"; shift 2;;
      --image-dir) imgdir="$2"; shift 2;;
      --description) description="$2"; shift 2;;
      --source-url) source_url="$2"; shift 2;;
      --specs-file) specs_file="$2"; shift 2;;
      *) die "unknown arg: $1";;
    esac
  done
  [ -n "$make" ] && [ -n "$model" ] && [ -n "$price" ] || die "--make --model --price required"
  [ -n "$id" ] || id=$(slugify "${make}-${model}${year:+-$year}-sale")
  [[ "$price" =~ ^[0-9]+$ ]] || die "--price must be integer"

  local gallery="[]" image_url="null"
  if [ -n "$imgdir" ]; then
    gallery=$(upload_images "$id" "$imgdir")
    image_url=$(echo "$gallery" | jq -r '.[0] // empty')
  fi
  local specs
  specs=$(jq -nc --arg make "$make" --arg model "$model" --arg year "$year" --arg color "$color" \
    --argjson price "$price" --argjson gallery "$gallery" --arg source_url "$source_url" '{
      make: $make, model: $model, year: $year, color: $color,
      rent: 0, sale: true, sale_price: $price, price_rub: $price,
      gallery: $gallery, hidden: false
    } + (if $source_url != "" then {source: $source_url} else {} end)')

  if [ -n "$specs_file" ]; then
    [ -f "$specs_file" ] || die "--specs-file not found: $specs_file"
    specs=$(jq -Ss '.[0] * .[1]' <(echo "$specs") "$specs_file")
  fi

  local row
  row=$(jq -nc --arg id "$id" --arg make "$make" --arg model "$model" --argjson price "$price" \
    --arg image_url "$image_url" --arg crew "$CREW_ID" --arg description "$description" \
    --argjson specs "$specs" '{
      id: $id, make: $make, model: $model,
      description: (if $description == "" then null else $description end),
      daily_price: $price,
      image_url: (if $image_url == "null" or $image_url == "" then null else $image_url end),
      specs: $specs,
      owner_id: "'"$DEFAULT_OWNER"'",
      crew_id: $crew,
      type: "sale_item",
      is_test_result: false,
      quantity: 1,
      availability_rules: {}
    }')
  local result
  result=$(curl -s -X POST "$SUPABASE_URL/rest/v1/cars" \
    "${HDR[@]}" -H "Prefer: return=representation" --data "$row") || die "REST insert failed"
  local inserted_id; inserted_id=$(echo "$result" | jq -r '.[0].id // empty')
  [ -z "$inserted_id" ] && { echo "ERR: $result" >&2; exit 1; }
  echo "✅ sale item added: $inserted_id ($make $model, ${price}₽)"
}

cmd_list_catalog() {
  local type_filter="all"
  while [ $# -gt 0 ]; do
    case "$1" in
      --type) type_filter="$2"; shift 2;;
      *) die "unknown arg: $1";;
    esac
  done
  local q="$SUPABASE_URL/rest/v1/cars?select=id,make,model,type,daily_price,quantity,specs&crew_id=eq.$CREW_ID&is_test_result=eq.false&order=type.asc,make.asc"
  if [ "$type_filter" != "all" ]; then
    q="$q&type=eq.$type_filter"
  fi
  echo "=== Catalog ($type_filter) — vip-bike ==="
  curl -s "$q" "${HDR[@]}" | jq -r '.[] | "- [\(.type)] \(.id) | \(.make) \(.model) | day=\(.daily_price)₽ | rent=\(.specs.rent // "n/a") sale=\(.specs.sale // false) | qty=\(.quantity)"'
}

cmd_get_reference() {
  local bikeId="${1:-}"
  [ -n "$bikeId" ] || die "usage: get-reference <bikeId>"
  curl -s "$SUPABASE_URL/rest/v1/cars?select=id,make,model,daily_price,description,specs&type=eq.bike&crew_id=eq.$CREW_ID&id=eq.$bikeId" "${HDR[@]}" | jq '.[0]'
}

cmd_find_reference() {
  # search by partial id, make, or model (case-insensitive)
  local query=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --query|-q) query="$2"; shift 2;;
      *) query="$1"; shift;;
    esac
  done
  [ -n "$query" ] || die "usage: find-reference <partial-id-or-make-or-model>"
  local pat; pat=$(echo "$query" | sed 's/[^a-zA-Z0-9_-]//g')
  echo "=== searching bikes matching '$query' (type=bike, crew=vip-bike) ==="
  curl -s "$SUPABASE_URL/rest/v1/cars?select=id,make,model,daily_price,specs&id=ilike.*${pat}*&type=eq.bike&crew_id=eq.$CREW_ID" "${HDR[@]}" | jq -r '.[] | "- \(.id) | \(.make) \(.model) | day=\(.daily_price)₽ | rent=\(.specs.rent) sale=\(.specs.sale // false)"'
  echo ""
  echo "=== also by make/model ilike ==="
  curl -s "$SUPABASE_URL/rest/v1/cars?select=id,make,model,daily_price&make=ilike.*${pat}*&type=eq.bike&crew_id=eq.$CREW_ID" "${HDR[@]}" | jq -r '.[] | "- \(.id) | \(.make) \(.model)"'
}

# --- main ---
cmd="${1:-help}"; shift || true
case "$cmd" in
  add-bike) cmd_add_bike "$@";;
  add-service) cmd_add_service "$@";;
  add-sale-item) cmd_add_sale_item "$@";;
  list-catalog) cmd_list_catalog "$@";;
  get-reference) cmd_get_reference "$@";;
  find-reference) cmd_find_reference "$@";;
  help|--help|-h|"")
    sed -n '1,30p' "$0"
    echo ""
    echo "Commands: add-bike | add-service | add-sale-item | list-catalog | get-reference | find-reference"
    echo "See SKILL.md for full options."
    ;;
  *) die "unknown command: $cmd (try: help)";;
esac
