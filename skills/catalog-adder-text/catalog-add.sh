#!/usr/bin/env bash
# catalog-add.sh — Add bikes/services/sale-items to VIP Bike catalog (public.cars)
# Usage: see SKILL.md. Commands: add-bike | add-service | add-sale-item | list-catalog | get-reference
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

calc_tiers() { # base price → JSON fragment with all 11 tiers + rent_price_label
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

upload_images() { # bikeId, imageDir → populates gallery + sets image_url
  local bikeId=$1 imgdir=$2
  [ -d "$imgdir" ] || die "image-dir not found: $imgdir"
  local tmp; tmp=$(mktemp -d)
  local i=0
  shopt -s nullglob nocaseglob
  for f in "$imgdir"/*.jpg "$imgdir"/*.jpeg "$imgdir"/*.png; do
    i=$((i+1))
    cp "$f" "$tmp/image_${i}.jpg"
  done
  shopt -u nullglob nocaseglob
  [ "$i" -gt 0 ] || die "no images in $imgdir"

  # image_1_4x3.jpg (Avito cover) — use ImageMagick if available
  if command -v convert >/dev/null 2>&1; then
    convert "$tmp/image_1.jpg" -resize 1200x900^ -gravity center -extent 1200x900 "$tmp/image_1_4x3.jpg" 2>/dev/null || true
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
  echo "$s" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-g; s/^-//; s/-$//'
}

# --- commands ---
cmd_add_bike() {
  local id="" make="" model="" price="" sale=0 year="" color="" owner="$DEFAULT_OWNER" imgdir="" features=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --id) id="$2"; shift 2;;
      --make) make="$2"; shift 2;;
      --model) model="$2"; shift 2;;
      --price) price="$2"; shift 2;;
      --sale) sale=1; shift;;
      --year) year="$2"; shift 2;;
      --color) color="$2"; shift 2;;
      --owner) owner="$2"; shift 2;;
      --image-dir) imgdir="$2"; shift 2;;
      --features) features="$2"; shift 2;;
      *) die "unknown arg: $1";;
    esac
  done

  [ -n "$make" ] && [ -n "$model" ] && [ -n "$price" ] || die "--make --model --price required"
  [ -n "$id" ] || id=$(slugify "${make}-${model}${year:+-$year}")
  [[ "$price" =~ ^[0-9]+$ ]] || die "--price must be integer"

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

  # build specs
  local tiers; tiers=$(calc_tiers "$price")
  local features_json="[]"
  [ -n "$features" ] && features_json=$(echo "$features" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; ""))')

  local specs
  specs=$(jq -nc --arg make "$make" --arg model "$model" --arg year "$year" --arg color "$color" \
    --argjson features "$features_json" --argjson gallery "$gallery" --argjson tiers "$tiers" \
    --arg sale_price $([ $sale = 1 ] && echo "$price" || echo "0") \
    '{
      make: $make, model: $model, year: $year, color: $color,
      rent: true,
      sale: (if $sale_price > 0 then true else false end),
      sale_price: (if $sale_price > 0 then $sale_price else null end),
      features: $features,
      gallery: $gallery,
      hidden: false
    } * $tiers')

  local row
  row=$(jq -nc --arg id "$id" --arg make "$make" --arg model "$model" --argjson price "$price" \
    --arg image_url "$image_url" --arg owner "$owner" --arg crew "$CREW_ID" \
    --argjson specs "$specs" '{
      id: $id, make: $make, model: $model,
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
  echo "   make=$make model=$model price=${price}₽/day sale=$([ $sale = 1 ] && echo yes || echo no)"
  echo "   images: $(echo "$gallery" | jq 'length')"
  echo "   URL: $SUPABASE_URL/storage/v1/object/public/$STORAGE_BUCKET/$id/image_1.jpg"
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
  while [ $# -gt 0 ]; do
    case "$1" in
      --id) id="$2"; shift 2;;
      --make) make="$2"; shift 2;;
      --model) model="$2"; shift 2;;
      --price) price="$2"; shift 2;;
      --year) year="$2"; shift 2;;
      --color) color="$2"; shift 2;;
      --image-dir) imgdir="$2"; shift 2;;
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
    --argjson price "$price" --argjson gallery "$gallery" '{
      make: $make, model: $model, year: $year, color: $color,
      rent: false, sale: true, sale_price: $price,
      gallery: $gallery, hidden: false
    }')
  local row
  row=$(jq -nc --arg id "$id" --arg make "$make" --arg model "$model" --argjson price "$price" \
    --arg image_url "$image_url" --arg crew "$CREW_ID" --argjson specs "$specs" '{
      id: $id, make: $make, model: $model,
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
  local q="$SUPABASE_URL/rest/v1/cars?select=id,make,model,type,daily_price,quantity&crew_id=eq.$CREW_ID&is_test_result=eq.false&order=type.asc,make.asc"
  if [ "$type_filter" != "all" ]; then
    q="$q&type=eq.$type_filter"
  fi
  echo "=== Catalog ($type_filter) — vip-bike ==="
  curl -s "$q" "${HDR[@]}" | jq -r '.[] | "- [\(.type)] \(.id) | \(.make) \(.model) | \(.daily_price)₽ | qty=\(.quantity)"'
}

cmd_get_reference() {
  local bikeId="${1:-}"
  [ -n "$bikeId" ] || die "usage: get-reference <bikeId>"
  curl -s "$SUPABASE_URL/rest/v1/cars?select=id,make,model,daily_price,specs&type=eq.bike&crew_id=eq.$CREW_ID&id=eq.$bikeId" "${HDR[@]}" | jq '.[0]'
}

# --- main ---
cmd="${1:-help}"; shift || true
case "$cmd" in
  add-bike) cmd_add_bike "$@";;
  add-service) cmd_add_service "$@";;
  add-sale-item) cmd_add_sale_item "$@";;
  list-catalog) cmd_list_catalog "$@";;
  get-reference) cmd_get_reference "$@";;
  help|--help|-h|"")
    sed -n '1,30p' "$0"
    echo ""
    echo "Commands: add-bike | add-service | add-sale-item | list-catalog | get-reference"
    echo "See SKILL.md for full options."
    ;;
  *) die "unknown command: $cmd (try: help)";;
esac
