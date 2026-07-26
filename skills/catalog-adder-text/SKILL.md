---
name: catalog-adder-text
description: >
  Add new bikes, services, and sale items to the VIP Bike catalog (public.cars table).
  Automates: image upload to Supabase Storage, CSV generation with correct specs,
  price tier calculation, gallery paths, and database insert.
  Trigger phrases: "добавь байк", "новый байк", "добавь услугу", "новый сервис",
  "add bike", "add service", "new bike", "new service", "catalog add",
  "добавь в каталог", "sale item", "продажа байка".
---

# catalog-adder-text

Триггер-фразы: **`добавь байк`**, **`новый байк`**, **`добавь услугу`**, **`новый сервис`**, **`add bike`**, **`add service`**, **`new bike`**, **`catalog add`**, **`sale item`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746
- Owner: 356282674 (I_O_S_NN)
- Storage bucket: `carpix`

## What this skill does

Adds new entries to the `public.cars` table — bikes (type=bike), services (type=service), or sale items (type=bike with specs.sale=true).

## Prerequisites

You need:
1. **Bike name** (e.g. "y-volt-surge-v") — used as the `id` and storage folder name
2. **Images** — renamed to `image_1.jpg` (cover), `image_2.jpg`...`image_N.jpg` (gallery), `image_1_4x3.jpg` (4:3 aspect for Avito)
3. **Daily rent price** (e.g. 10000) — the base daily price; all other price tiers are calculated from this
4. **Bike specs** — make, model, year, color, battery, power, range, etc. (googled from official website)

## Commands

### 1. add-bike <bikeId> --make <make> --model <model> --price <dailyPrice> [--sale]

Full workflow to add a new bike:

```bash
BIKE_ID="$1"        # e.g. "y-volt-surge-v"
MAKE="$2"           # e.g. "Y-Volt"
MODEL="$3"          # e.g. "Surge V"
DAILY_PRICE="$4"    # e.g. 10000
IS_SALE="${5:-false}" # set to "true" for sale items

# ─── Step 1: Upload images to Supabase Storage ───
# Upload each image to carpix/{bikeId}/image_N.jpg
for img in image_1.jpg image_2.jpg image_3.jpg image_4.jpg image_5.jpg image_6.jpg image_7.jpg image_8.jpg image_9.jpg image_1_4x3.jpg; do
  if [[ -f "$img" ]]; then
    curl -s -X POST \
      "${SUPABASE_URL}/storage/v1/object/public/carpix/${BIKE_ID}/${img}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: image/jpeg" \
      --data-binary @"$img"
    echo "  ✅ Uploaded $img"
  fi
done

# ─── Step 2: Calculate price tiers ───
# Price tiers are derived from daily_price:
# price_per_hour = daily * 0.4
# price_per_2h   = daily * 0.6
# price_per_3h   = daily * 0.75
# price_per_6h   = daily * 0.8
# price_per_12h  = daily * 0.9
# rent_2_4d      = daily * 0.8  (per day for 2-4 days)
# rent_5_10d     = daily * 0.65 (per day for 5-10 days)
# rent_11_30d    = daily * 0.6  (per day for 11-30 days)
# rent_weekday   = daily
# rent_weekend   = daily * 1.25
# rent_weekday_hour  = daily * 0.4
# rent_weekend_hour  = daily * 0.5

# ─── Step 3: Build specs JSON ───
# Specs include: make, model, year, color, type, drive, battery, power_kw,
# motor_hp, range_city_km, range_combined_km, range_highway_km,
# acceleration_0_96_km_h_s, top_speed_kmh, weight_kg, seat_height_cm,
# features[], gallery[], dailyPrice, price_per_hour, ... (all tiers),
# rent=true, sale=false (or true for sale items)

# ─── Step 4: Build gallery array ───
GALLERY="["
for i in 1 2 3 4 5 6 7 8 9; do
  GALLERY="${GALLERY}\"https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/${BIKE_ID}/image_${i}.jpg\","
done
GALLERY="${GALLERY%,}]"  # remove trailing comma

# ─── Step 5: Insert into public.cars ───
# Use the CSV format (same as the reference CSVs in docs/crewDocs/)
# Or use direct REST API insert:
curl -s -X POST "${SUPABASE_URL}/rest/v1/cars" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"${BIKE_ID}\",
    \"make\": \"${MAKE}\",
    \"model\": \"${MODEL}\",
    \"description\": \"<bike description in Russian>\",
    \"daily_price\": ${DAILY_PRICE},
    \"image_url\": \"https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/${BIKE_ID}/image_1.jpg\",
    \"rent_link\": \"/rent/${BIKE_ID}\",
    \"is_test_result\": false,
    \"specs\": {
      \"make\": \"${MAKE}\",
      \"model\": \"${MODEL}\",
      \"rent\": true,
      \"sale\": ${IS_SALE},
      \"type\": \"Electric\",
      \"year\": \"2026\",
      \"color\": \"<color>\",
      \"drive\": \"<drive type>\",
      \"rating\": 5.0,
      \"battery\": \"<battery spec>\",
      \"gallery\": ${GALLERY},
      \"features\": [\"<feature 1>\", \"<feature 2>\"],
      \"power_kw\": <power>,
      \"motor_hp\": <hp>,
      \"range_city_km\": <range>,
      \"dailyPrice\": ${DAILY_PRICE},
      \"price_per_hour\": $(( DAILY_PRICE * 40 / 100 )),
      \"price_per_2h\": $(( DAILY_PRICE * 60 / 100 )),
      \"price_per_3h\": $(( DAILY_PRICE * 75 / 100 )),
      \"price_per_6h\": $(( DAILY_PRICE * 80 / 100 )),
      \"price_per_12h\": $(( DAILY_PRICE * 90 / 100 )),
      \"rent_2_4d\": $(( DAILY_PRICE * 80 / 100 )),
      \"rent_5_10d\": $(( DAILY_PRICE * 65 / 100 )),
      \"rent_11_30d\": $(( DAILY_PRICE * 60 / 100 )),
      \"rent_weekday\": ${DAILY_PRICE},
      \"rent_weekend\": $(( DAILY_PRICE * 125 / 100 )),
      \"rent_weekday_hour\": $(( DAILY_PRICE * 40 / 100 )),
      \"rent_weekend_hour\": $(( DAILY_PRICE * 50 / 100 ))
    },
    \"owner_id\": \"356282674\",
    \"type\": \"bike\",
    \"crew_id\": \"2d5fde70-1dd3-4f0d-8d72-66ccf6908746\",
    \"availability_rules\": {},
    \"quantity\": 1
  }"
```

### 2. add-service <serviceId> --name <name> --price <price>

Services are `type=service` in the same `public.cars` table. Example reference: `vip-bike-svc-001` (Нормо-час, 2000₽).

```bash
# Same flow as add-bike but:
# - type = "service" (not "bike")
# - specs.rent = false, specs.sale = false
# - specs.service = true
# - No gallery needed (single image or none)
# - No price tiers (just daily_price = flat service price)
# - rent_link = null
# - specs.service_name = "<service name>"
```

Service examples (already in catalog):
- vip-bike-svc-001: Нормо-час — 2,000 ₽
- vip-bike-svc-002: Замена масла — 2,000 ₽
- vip-bike-svc-003: Замена колодок — 3,000 ₽
- vip-bike-svc-004: Диагностика — 1,500 ₽
- vip-bike-svc-005: Шиномонтаж — 2,500 ₽

### 3. add-sale-item <bikeId> --make <make> --model <model> --price <salePrice>

Sale items are `type=bike` with `specs.sale=true` and `specs.rent=false`. They appear in the "Buy" section instead of "Rent".

```bash
# Same as add-bike but:
# - specs.rent = false
# - specs.sale = true
# - specs.sale_price = <sale price>
# - specs.price_rub = <sale price>
# - rent_link = null (not rentable)
```

### 4. list-catalog [--type bike|service|all]

List all catalog items for the crew.

```bash
curl -s "$URL/rest/v1/cars?select=id,make,model,daily_price,type,specs&crew_id=eq.$CREW_ID&order=type.asc,make.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### 5. get-reference <bikeId>

Get the full specs of an existing bike as a reference template (for creating similar bikes).

```bash
curl -s "$URL/rest/v1/cars?select=*&id=eq.${BIKE_ID}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq '.[0].specs'
```

## Price tier calculation formula

| Tier | Formula | Example (10,000 ₽ base) |
|---|---|---|
| price_per_hour | base × 0.4 | 4,000 ₽ |
| price_per_2h | base × 0.6 | 6,000 ₽ |
| price_per_3h | base × 0.75 | 7,500 ₽ |
| price_per_6h | base × 0.8 | 8,000 ₽ |
| price_per_12h | base × 0.9 | 9,000 ₽ |
| rent_2_4d | base × 0.8 | 8,000 ₽/day |
| rent_5_10d | base × 0.65 | 6,500 ₽/day |
| rent_11_30d | base × 0.6 | 6,000 ₽/day |
| rent_weekday | base | 10,000 ₽ |
| rent_weekend | base × 1.25 | 12,500 ₽ |

## Image upload rules

1. Cover image: `image_1.jpg` (9:16 portrait, for mobile + Avito)
2. Gallery images: `image_2.jpg` through `image_N.jpg` (any aspect)
3. Avito cover: `image_1_4x3.jpg` (4:3 landscape, generated from image_1)
4. Upload path: `carpix/{bikeId}/{filename}`
5. Public URL: `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/{bikeId}/{filename}`
6. All images in `specs.gallery[]` array

## 🔗 Deep Links
- Catalog: `https://vip-bike.ru/franchize/vip-bike`
- Specific bike: `https://vip-bike.ru/rent/{bikeId}`

## Anti-hallucination
- NEVER invent specs — google the bike, get real data
- NEVER invent prices — the operator provides the daily price, all tiers are calculated
- ALWAYS upload images before inserting the DB row (gallery URLs must work)
- ALWAYS use the crew_id and owner_id from the reference bike

## Related Files
- Reference CSV: `docs/crewDocs/livewire-one-updated.csv` (bike example)
- Reference CSV: `docs/crewDocs/vip-bike-service-items.csv` (service examples)
- Hydration SQL: `docs/crewDocs/vip-bike-franchize-hydration.sql`
- Pricing calculator: `lib/rental-pricing-calculator.ts`
- Catalog page: `app/franchize/[slug]/page.tsx`
- Sibling skills: `franchize-catalog-text`, `crew-admin-text`
