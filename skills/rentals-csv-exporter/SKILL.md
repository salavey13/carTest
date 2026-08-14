---
name: rentals-csv-exporter
description: |
  Export VIP Bike active rentals from Supabase to compact CSV file.
  Shows which bikes are unavailable today + upcoming rents (next 30 days).
  Deterministic script — no AI needed. Generates vip-bike-rentals.csv.
  Pushes updated CSV to repo at docs/autoreply/. Designed for cron job regeneration.
  Trigger phrases (RU): "экспорт аренд csv", "обновить csv аренд", "какие байки заняты сегодня",
  "активные аренды", "регенерировать аренды", "недоступные байки".
  Trigger phrases (EN): "export rentals csv", "update rentals csv", "which bikes are unavailable today",
  "active rentals", "regenerate rentals", "unavailable bikes".
---

# Rentals CSV Exporter

Export VIP Bike active rentals from Supabase `public.rentals` to a compact CSV file for agent use.

## What it does

1. Queries Supabase for all vip-bike crew rentals
2. Filters to **active today** + **upcoming** (next 30 days)
3. Enriches with bike make/model names from `public.cars`
4. Generates `vip-bike-rentals.csv` with 20 columns
5. Pushes to repo at `docs/autoreply/`

## When to use

- When user asks "which bikes are unavailable today?"
- When user wants to check active rentals
- When planning bike availability for a specific date
- Via cron job (nightly or hourly) to keep rental status current
- Before suggesting a bike for rent — check if it's available

## How to run

### Step 1: Run the export script

```bash
python3 scripts/export_vip_bike_rentals.py
```

Generates: `<repo>/download/vip-bike-rentals.csv` (`<repo>` = repo root, e.g. `/opt/vip-bike-electro-factory/rental-repo`)

### Step 2: Push CSV to repo

```bash
python3 scripts/push_rentals_csv.py
```

### Step 3: Verify

Check the CSV at:
`https://github.com/salavey13/carTest/blob/main/docs/autoreply/vip-bike-rentals.csv`

## CSV schema (20 columns)

```
rental_id          — UUID of the rental
vehicle_id         — bike ID (matches vip-bike-rent.csv id column)
bike_make          — enriched from cars table (e.g. "Y-VOLT")
bike_model         — enriched from cars table (e.g. "Surge V")
user_id            — Telegram user ID of renter
status             — rental status (pending_confirmation, active, completed, etc.)
payment_status     — payment status (fully_paid, pending, etc.)
start_date         — rental start (YYYY-MM-DD HH:MM UTC)
end_date           — rental end (YYYY-MM-DD HH:MM UTC)
duration_days      — duration in days (decimal)
total_cost         — total rental cost in rubles
deposit_amount     — deposit amount in rubles
deposit_method     — deposit collection method (cash, transfer, etc.)
deposit_collected_at — when deposit was collected
deposit_returned   — whether deposit was returned (true/false)
delivery_address   — delivery address if applicable
is_active_today    — "true" if rental overlaps today's date
is_upcoming        — "true" if rental starts in next 30 days (after today)
created_at         — when rental was created
crew_id            — crew ID (always vip-bike for this export)
```

## Filtering logic

The script includes rentals that match ANY of:
1. **Active today**: `start_date <= tomorrow AND end_date >= today` (overlaps today)
2. **Upcoming**: `start_date` is within the next 30 days (after today)
3. **Active status**: status is `pending_confirmation`, `active`, `ongoing`, `confirmed`, `started`, or `pending`

Excludes: `completed` and `cancelled` rentals that don't overlap today (historical).

## Quick reference: unavailable bikes today

The script prints a summary at the end showing which bike IDs are unavailable today. This is the key info for agents — when suggesting a bike for rent, check this list first.

## Source data

- **Table**: `public.rentals`
- **Filter**: `crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'` (vip-bike)
- **Enrichment**: joined with `public.cars` for bike make/model names

## Cron job setup (future)

```cron
0 * * * * cd /opt/vip-bike-electro-factory/rental-repo && /usr/bin/python3 scripts/export_vip_bike_rentals.py && /usr/bin/python3 scripts/push_rentals_csv.py
```

Hourly regeneration keeps the rental status current. More frequent than catalog CSVs since rentals change throughout the day.

## Related files

- Script: `scripts/export_vip_bike_rentals.py`
- Push script: `scripts/push_rentals_csv.py`
- Output (local): `<repo>/download/vip-bike-rentals.csv`
- Output (repo): `docs/autoreply/vip-bike-rentals.csv`
- Companion skill: `skills/catalog-csv-exporter/SKILL.md` (bike catalog CSVs)
