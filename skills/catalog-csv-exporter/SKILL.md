---
name: catalog-csv-exporter
description: |
  Export VIP Bike catalog from Supabase to clean compact CSV files (rent + sale split by condition).
  Deterministic script — no AI needed. Generates 3 CSVs: vip-bike-rent.csv, vip-bike-sale-new.csv, vip-bike-sale-used.csv.
  Pushes updated CSVs to repo at docs/autoreply/. Designed for cron job regeneration.
  Trigger phrases (RU): "экспорт каталога csv", "обновить csv аренды", "обновить csv продажи",
  "регенерировать каталог", "csv байков", "выгрузить байки в csv".
  Trigger phrases (EN): "export catalog csv", "update rent csv", "update sale csv",
  "regenerate catalog", "bikes csv", "export bikes to csv".
---

# Catalog CSV Exporter

Export VIP Bike catalog from Supabase `public.cars` to clean, compact CSV files for agent use.

## What it does

1. Queries Supabase for all vip-bike crew bikes (`type=bike`, `crew_id` = vip-bike, `make != VipBike`)
2. Splits into 3 CSVs based on `specs.rent` / `specs.sale` flags and `specs.condition`:
   - `vip-bike-rent.csv` — bikes available for rent
   - `vip-bike-sale-new.csv` — for sale AND `specs.condition = new`
   - `vip-bike-sale-used.csv` — for sale AND condition used/empty (вторичка — дефолт)
3. Normalizes all fields to prevent CSV corruption:
   - `features` → semicolon-separated string (not comma — avoids CSV separator conflicts)
   - `gallery` → pipe-separated URLs
   - Nested objects (`buy_colors`, `buy_options`, `spec_labels`) → clean JSON strings
   - All fields properly CSV-quoted (`csv.QUOTE_ALL`)
4. Pushes updated CSVs to repo at `docs/autoreply/`

## When to use

- When user asks to "update catalog CSVs" or "regenerate bike list"
- After bike specs are updated in Supabase (price, license_class, features, etc.)
- Via cron job (nightly) to keep CSVs in sync with Supabase
- When user wants to upload to VK Market (CSVs are the source of truth for VK bulk upload)

## How to run

### Step 1: Run the export script

```bash
python3 /home/z/my-project/scripts/export_vip_bike_csv.py
```

This generates 3 files in `/home/z/my-project/download/`:
- `vip-bike-rent.csv`
- `vip-bike-sale-new.csv` (for sale, condition = new)
- `vip-bike-sale-used.csv` (for sale, condition used or not set)

### Step 2: Push CSVs to repo

Use the GitHub Contents API to push both CSVs to `docs/autoreply/`:

```bash
python3 /home/z/my-project/scripts/push_catalog_csvs.py
```

Or manually push via the standard push_file pattern (see push script).

### Step 3: Verify

- Check that all CSVs appear at:
  - `https://github.com/salavey13/carTest/blob/main/docs/autoreply/vip-bike-rent.csv`
  - `https://github.com/salavey13/carTest/blob/main/docs/autoreply/vip-bike-sale-new.csv`
  - `https://github.com/salavey13/carTest/blob/main/docs/autoreply/vip-bike-sale-used.csv`
- Download and open in a spreadsheet to verify no corruption (no 1-letter-per-line, no `[object Object]`)

## CSV schema

### vip-bike-rent.csv columns

```
id, make, model, bike_subtype, type, year, condition, license_class, description,
daily_price, price_per_hour, price_per_3h, price_per_6h, price_per_12h,
rent_weekday, rent_weekend, rent_2_4d, rent_5_10d, rent_11_30d, deposit_rub,
image_url, gallery, features,
power_kw, motor_peak_kw, motor_nominal_kw, power_hp, torque_nm, top_speed_kmh,
range_km, battery, voltage_v, weight_kg, seat_height_mm,
brake_type, suspension_type, frame_type, drive, color, charge_time_h,
engine_cc, fuel_type, fuel_capacity_l, transmission, cooling,
rent_link, webapp_link, vk_url
```

- `condition`: `new` | `used` (from `specs.condition`; empty = not set)
- `webapp_link`: direct Telegram WebApp link to rent this bike
  (`https://t.me/oneBikePlsBot/app?startapp=rent_{bike_id}`)
- `vk_url`: VK Market product URL (from `specs.vk_url` — empty if not set yet)

### vip-bike-sale-new.csv / vip-bike-sale-used.csv columns (identical schema)

```
id, make, model, bike_subtype, type, year, condition, license_class, description,
sale_price, original_price_rub, discount_percent, sold_count, recommend_percent, rating,
image_url, gallery, features,
power_kw, motor_peak_kw, power_hp, torque_nm, top_speed_kmh,
range_km, battery, voltage_v, weight_kg, seat_height_mm,
brake_type, suspension_type, frame_type, drive, color, charge_time_h,
engine_cc, fuel_type, fuel_capacity_l, transmission, cooling,
buy_colors_json, buy_options_json, rent_link, webapp_link, vk_url
```

- Разница только в содержимом: NEW-файл = `specs.condition = new`,
  USED-файл = used/пусто (дефолт вторички; пустые перечисляются в WARNING при экспорте)
- `condition`: `new` | `used` (from `specs.condition`)
- `webapp_link`: direct Telegram WebApp link to buy this bike
  (`https://t.me/oneBikePlsBot/app?startapp=buy_{bike_id}`)
- `vk_url`: VK Market product URL (from `specs.vk_url` — empty if not set yet)

## Corruption prevention

The script fixes 3 types of CSV corruption that occurred in previous exports:

1. **"1 letter per line" glitch**: Caused by iterating over a comma-separated string as if it were a list. The script always normalizes `features` to a semicolon-separated string before writing.

2. **`[object Object]` in fields**: Caused by JavaScript's default object-to-string conversion. The script re-serializes nested objects (`buy_colors`, `buy_options`, `spec_labels`) as proper JSON strings. Corrupted strings are replaced with empty string.

3. **Inconsistent types**: `rent` and `sale` fields had mixed types (bool, int, string). The script normalizes all truthy values (`True`, `"true"`, `1`, `"1"`) consistently.

## Source data

- **Table**: `public.cars`
- **Filters**: `type = 'bike'`, `crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'` (vip-bike), `make != 'VipBike'`
- **Gold-standard spec schemas**:
  - `docs/gold-standard-ice-bike-spec-schema.md`
  - `docs/gold-standard-electro-bike-spec-schema.md`

## Bike ID lists (as of 2026-08-14)

### Rent bikes (21)

```
falcon-gt-2026, falcon-pro-2026, aprilia-shiver, bmw-f800r,
ducati-panigale-s-electro-black-chain, ducati-panigale-s-electro-black-aero,
ducati-panigale-s-electro-black, ducati-panigale-s-electro-gold,
hmd-m02, jilang-max-pro, kawasaki-ex650k, kayo-tsd110,
livewire-one, motoland-breakout, nibbler-regumoto-4v, rerode-r1-plus,
sequence-zero, suzuki-gsx-s1000f, wenbox-u2-pro, y-volt-surge-v, yamaha-r7
```

### Sale bikes (19)

```
falcon-gt-2026, falcon-lite-2026, falcon-lynx-purple, falcon-pro-2026,
bmw-f800r, ducati-panigale-s-electro-black-chain, ducati-panigale-s-electro-black-aero,
ducati-panigale-s-electro-black, ducati-panigale-s-electro-gold,
hmd-m02, jilang-max-pro, kayo-tsd110, motoland-breakout, nibbler-regumoto-4v,
rerode-r1-plus, sequence-zero, sotion-em01, wenbox-u2-pro, y-volt-surge-v
```

## Cron job setup (future)

To regenerate CSVs nightly:

```cron
0 3 * * * /usr/bin/python3 /home/z/my-project/scripts/export_vip_bike_csv.py && /usr/bin/python3 /home/z/my-project/scripts/push_catalog_csvs.py
```

## Related files

- Script: `/home/z/my-project/scripts/export_vip_bike_csv.py`
- Push script: `/home/z/my-project/scripts/push_catalog_csvs.py`
- Output (local): `/home/z/my-project/download/vip-bike-rent.csv`, `vip-bike-sale-new.csv`, `vip-bike-sale-used.csv`
- Output (repo): `docs/autoreply/vip-bike-rent.csv`, `docs/autoreply/vip-bike-sale-new.csv`, `docs/autoreply/vip-bike-sale-used.csv`
- Supabase gold-standard schemas: `docs/gold-standard-ice-bike-spec-schema.md`, `docs/gold-standard-electro-bike-spec-schema.md`
