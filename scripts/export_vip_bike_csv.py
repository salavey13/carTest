#!/usr/bin/env python3
"""
Export VIP Bike catalog to clean, compact CSV files for agent use.

Generates 2 CSV files:
  - <repo>/public/docs/autoreply/vip-bike-rent.csv  (bikes with specs.rent = truthy)
  - <repo>/public/docs/autoreply/vip-bike-sale.csv  (bikes with specs.sale = truthy)

Source: Supabase public.cars table
  - type = 'bike'
  - crew_id = vip-bike crew (2d5fde70-1dd3-4f0d-8d72-66ccf6908746)
  - make != 'VipBike' (exclude internal placeholder bikes)

This script is DETERMINISTIC — no AI, no intelligence. Just selective extraction.
Designed to be run by cron job or skill. Output is compact and clean:
  - No "[object Object]" corruption
  - features always normalized to semicolon-separated string (not comma — avoids CSV issues)
  - gallery joined with | (pipe)
  - Nested objects (buy_colors, buy_options, spec_labels) serialized as clean JSON
  - All fields properly CSV-quoted
  - Image URLs swapped to public mirror (rental.vip-bike.ru/supabase-mirror/carpix/)

Usage:
  python3 export_vip_bike_csv.py

Output files are also pushed to repo at docs/autoreply/ by the companion skill.
"""
import json, csv, os, sys, urllib.request, datetime
from pathlib import Path

# Fix Unicode encoding on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ════════════════════════════════════════════════════════════
# CONFIG
# ════════════════════════════════════════════════════════════
SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co"

# Service key: prefer env, fall back to the repo's .env.local (never hardcode).
def _load_service_key() -> str:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if key:
        return key
    env_local = Path(__file__).resolve().parent.parent / ".env.local"
    if env_local.exists():
        for line in env_local.read_text().splitlines():
            if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("SUPABASE_SERVICE_ROLE_KEY not found (set env or .env.local)")

SERVICE_KEY = _load_service_key()
VIP_BIKE_CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "docs" / "autoreply"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════

def is_truthy(v):
    """Normalize various truthy representations (bool, str, int)."""
    return v in (True, "true", "True", "TRUE", 1, "1")


def normalize_features(features):
    """
    Normalize features to a semicolon-separated string.
    Handles: list, comma-separated string, already-semicolon string.
    Uses semicolons (not commas) to avoid CSV field separator conflicts.
    """
    if not features:
        return ""
    if isinstance(features, list):
        return "; ".join(str(f) for f in features if f)
    if isinstance(features, str):
        # Could be comma-separated or already semicolon-separated
        if ";" in features:
            return features
        if "," in features:
            # Split by comma, strip whitespace, rejoin with semicolons
            parts = [p.strip() for p in features.split(",") if p.strip()]
            return "; ".join(parts)
        return features
    return str(features)


def normalize_gallery(gallery):
    """Join gallery URLs with pipe (|) — safe for CSV."""
    if not gallery:
        return ""
    if isinstance(gallery, list):
        # Swap URLs in each gallery item
        swapped = [swap_supabase_url(g) for g in gallery if g]
        return "|".join(swapped)
    if isinstance(gallery, str):
        # Swap URLs in string (pipe-separated)
        return "|".join(swap_supabase_url(g) for g in gallery.split("|") if g)
    return ""


def swap_supabase_url(url):
    """
    Swap Supabase storage URL to public mirror URL.
    From: https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/...
    To:   https://rental.vip-bike.ru/supabase-mirror/carpix/...
    """
    if not url or not isinstance(url, str):
        return url
    # Match the exact Supabase storage prefix
    old_prefix = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/"
    new_prefix = "https://rental.vip-bike.ru/supabase-mirror/carpix/"
    if url.startswith(old_prefix):
        return url.replace(old_prefix, new_prefix, 1)
    return url


def serialize_nested(obj):
    """
    Serialize nested objects (buy_colors, buy_options, spec_labels) as clean JSON.
    Handles the "[object Object]" corruption by re-serializing from dict/list.
    """
    if obj is None:
        return ""
    if isinstance(obj, str):
        # Check for corruption
        if "[object Object]" in obj:
            return ""  # Corrupted, can't recover — return empty
        return obj
    try:
        return json.dumps(obj, ensure_ascii=False)
    except (TypeError, ValueError):
        return ""


def safe_str(v):
    """Convert any value to safe string, None → empty string."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return str(v)


def get_spec(specs, key, default=""):
    """Safely get a spec value, handling missing keys."""
    if not specs or not isinstance(specs, dict):
        return default
    return specs.get(key, default)


# ════════════════════════════════════════════════════════════
# SUPABASE QUERY
# ════════════════════════════════════════════════════════════

def fetch_bikes():
    """Fetch all vip-bike crew bikes from Supabase (type=bike, make!=VipBike)."""
    # Query: type=bike, crew_id=vip-bike, exclude VipBike make
    url = (
        f"{SUPABASE_URL}/rest/v1/cars?"
        f"type=eq.bike"
        f"&crew_id=eq.{VIP_BIKE_CREW_ID}"
        f"&select=id,make,model,description,daily_price,image_url,rent_link,specs"
        f"&order=make.asc"
    )
    req = urllib.request.Request(url, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    # Exclude VipBike make (case-insensitive)
    bikes = [b for b in data if b.get("make", "").lower() != "vipbike"]
    print(f"Fetched {len(data)} bikes from Supabase, {len(bikes)} after excluding VipBike make")
    return bikes


# ════════════════════════════════════════════════════════════
# CSV ROW BUILDERS
# ════════════════════════════════════════════════════════════

# Columns for RENT CSV — focused on rental-relevant info
RENT_CSV_COLUMNS = [
    "id",
    "make",
    "model",
    "bike_subtype",
    "type",              # ICE or Electric
    "year",
    "license_class",
    "description",
    "daily_price",
    "price_per_hour",
    "price_per_3h",
    "price_per_6h",
    "price_per_12h",
    "rent_weekday",
    "rent_weekend",
    "rent_2_4d",
    "rent_5_10d",
    "rent_11_30d",
    "deposit_rub",
    "image_url",
    "gallery",
    "features",
    "power_kw",
    "motor_peak_kw",
    "motor_nominal_kw",
    "power_hp",
    "torque_nm",
    "top_speed_kmh",
    "range_km",
    "battery",
    "voltage_v",
    "weight_kg",
    "seat_height_mm",
    "brake_type",
    "suspension_type",
    "frame_type",
    "drive",
    "color",
    "charge_time_h",
    "engine_cc",
    "fuel_type",
    "fuel_capacity_l",
    "transmission",
    "cooling",
    "rent_link",
    "webapp_link",         # https://t.me/oneBikePlsBot/app?startapp=rent_{bike_id}
    "vk_url",              # VK Market product URL (from specs.vk_url, empty if not set)
]

# Columns for SALE CSV — focused on sale-relevant info
SALE_CSV_COLUMNS = [
    "id",
    "make",
    "model",
    "bike_subtype",
    "type",
    "year",
    "license_class",
    "description",
    "sale_price",
    "original_price_rub",
    "discount_percent",
    "sold_count",
    "recommend_percent",
    "rating",
    "image_url",
    "gallery",
    "features",
    "power_kw",
    "motor_peak_kw",
    "power_hp",
    "torque_nm",
    "top_speed_kmh",
    "range_km",
    "battery",
    "voltage_v",
    "weight_kg",
    "seat_height_mm",
    "brake_type",
    "suspension_type",
    "frame_type",
    "drive",
    "color",
    "charge_time_h",
    "engine_cc",
    "fuel_type",
    "fuel_capacity_l",
    "transmission",
    "cooling",
    "buy_colors_json",
    "buy_options_json",
    "rent_link",
    "webapp_link",         # https://t.me/oneBikePlsBot/app?startapp=buy_{bike_id}
    "vk_url",              # VK Market product URL (from specs.vk_url, empty if not set)
]


def build_rent_row(bike):
    """Build a clean CSV row for rental CSV."""
    specs = bike.get("specs", {}) or {}
    row = {
        "id": bike.get("id", ""),
        "make": bike.get("make", ""),
        "model": bike.get("model", ""),
        "bike_subtype": get_spec(specs, "bike_subtype"),
        "type": get_spec(specs, "type"),
        "year": get_spec(specs, "year"),
        "license_class": get_spec(specs, "license_class"),
        "description": bike.get("description", ""),
        "daily_price": safe_str(bike.get("daily_price", 0)),
        "price_per_hour": safe_str(get_spec(specs, "price_per_hour")),
        "price_per_3h": safe_str(get_spec(specs, "price_per_3h")),
        "price_per_6h": safe_str(get_spec(specs, "price_per_6h")),
        "price_per_12h": safe_str(get_spec(specs, "price_per_12h")),
        "rent_weekday": safe_str(get_spec(specs, "rent_weekday")),
        "rent_weekend": safe_str(get_spec(specs, "rent_weekend")),
        "rent_2_4d": safe_str(get_spec(specs, "rent_2_4d")),
        "rent_5_10d": safe_str(get_spec(specs, "rent_5_10d")),
        "rent_11_30d": safe_str(get_spec(specs, "rent_11_30d")),
        "deposit_rub": safe_str(get_spec(specs, "deposit_rub")),
        "image_url": swap_supabase_url(bike.get("image_url", "")),
        "gallery": normalize_gallery(get_spec(specs, "gallery")),
        "features": normalize_features(get_spec(specs, "features")),
        "power_kw": safe_str(get_spec(specs, "power_kw")),
        "motor_peak_kw": safe_str(get_spec(specs, "motor_peak_kw")),
        "motor_nominal_kw": safe_str(get_spec(specs, "motor_nominal_kw")),
        "power_hp": safe_str(get_spec(specs, "power_hp")),
        "torque_nm": safe_str(get_spec(specs, "torque_nm")),
        "top_speed_kmh": safe_str(get_spec(specs, "top_speed_kmh")),
        "range_km": safe_str(get_spec(specs, "range_km")),
        "battery": safe_str(get_spec(specs, "battery")),
        "voltage_v": safe_str(get_spec(specs, "voltage_v")),
        "weight_kg": safe_str(get_spec(specs, "weight_kg")),
        "seat_height_mm": safe_str(get_spec(specs, "seat_height_mm")),
        "brake_type": safe_str(get_spec(specs, "brake_type")),
        "suspension_type": safe_str(get_spec(specs, "suspension_type")),
        "frame_type": safe_str(get_spec(specs, "frame_type")),
        "drive": safe_str(get_spec(specs, "drive")),
        "color": safe_str(get_spec(specs, "color")),
        "charge_time_h": safe_str(get_spec(specs, "charge_time_h")),
        "engine_cc": safe_str(get_spec(specs, "engine_cc")),
        "fuel_type": safe_str(get_spec(specs, "fuel_type")),
        "fuel_capacity_l": safe_str(get_spec(specs, "fuel_capacity_l")),
        "transmission": safe_str(get_spec(specs, "transmission")),
        "cooling": safe_str(get_spec(specs, "cooling")),
        "rent_link": bike.get("rent_link", ""),
        "webapp_link": f"https://t.me/oneBikePlsBot/app?startapp=rent_{bike.get('id', '')}",
        "vk_url": safe_str(get_spec(specs, "vk_url")),
    }
    return row


def build_sale_row(bike):
    """Build a clean CSV row for sale CSV."""
    specs = bike.get("specs", {}) or {}
    row = {
        "id": bike.get("id", ""),
        "make": bike.get("make", ""),
        "model": bike.get("model", ""),
        "bike_subtype": get_spec(specs, "bike_subtype"),
        "type": get_spec(specs, "type"),
        "year": get_spec(specs, "year"),
        "license_class": get_spec(specs, "license_class"),
        "description": bike.get("description", ""),
        "sale_price": safe_str(get_spec(specs, "sale_price")),
        "original_price_rub": safe_str(get_spec(specs, "original_price_rub")),
        "discount_percent": safe_str(get_spec(specs, "discount_percent")),
        "sold_count": safe_str(get_spec(specs, "sold_count")),
        "recommend_percent": safe_str(get_spec(specs, "recommend_percent")),
        "rating": safe_str(get_spec(specs, "rating")),
        "image_url": swap_supabase_url(bike.get("image_url", "")),
        "gallery": normalize_gallery(get_spec(specs, "gallery")),
        "features": normalize_features(get_spec(specs, "features")),
        "power_kw": safe_str(get_spec(specs, "power_kw")),
        "motor_peak_kw": safe_str(get_spec(specs, "motor_peak_kw")),
        "power_hp": safe_str(get_spec(specs, "power_hp")),
        "torque_nm": safe_str(get_spec(specs, "torque_nm")),
        "top_speed_kmh": safe_str(get_spec(specs, "top_speed_kmh")),
        "range_km": safe_str(get_spec(specs, "range_km")),
        "battery": safe_str(get_spec(specs, "battery")),
        "voltage_v": safe_str(get_spec(specs, "voltage_v")),
        "weight_kg": safe_str(get_spec(specs, "weight_kg")),
        "seat_height_mm": safe_str(get_spec(specs, "seat_height_mm")),
        "brake_type": safe_str(get_spec(specs, "brake_type")),
        "suspension_type": safe_str(get_spec(specs, "suspension_type")),
        "frame_type": safe_str(get_spec(specs, "frame_type")),
        "drive": safe_str(get_spec(specs, "drive")),
        "color": safe_str(get_spec(specs, "color")),
        "charge_time_h": safe_str(get_spec(specs, "charge_time_h")),
        "engine_cc": safe_str(get_spec(specs, "engine_cc")),
        "fuel_type": safe_str(get_spec(specs, "fuel_type")),
        "fuel_capacity_l": safe_str(get_spec(specs, "fuel_capacity_l")),
        "transmission": safe_str(get_spec(specs, "transmission")),
        "cooling": safe_str(get_spec(specs, "cooling")),
        "buy_colors_json": serialize_nested(get_spec(specs, "buy_colors")),
        "buy_options_json": serialize_nested(get_spec(specs, "buy_options")),
        "rent_link": bike.get("rent_link", ""),
        "webapp_link": f"https://t.me/oneBikePlsBot/app?startapp=buy_{bike.get('id', '')}",
        "vk_url": safe_str(get_spec(specs, "vk_url")),
    }
    return row


def write_csv(rows, columns, path):
    """Write rows to CSV with proper quoting."""
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, quoting=csv.QUOTE_ALL, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Wrote {path} ({len(rows)} rows)")


# ════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════

def main():
    print("=== VIP Bike Catalog CSV Export ===\n")

    # Fetch
    bikes = fetch_bikes()

    # Split into rent / sale
    rent_bikes = [b for b in bikes if is_truthy(b.get("specs", {}).get("rent"))]
    sale_bikes = [b for b in bikes if is_truthy(b.get("specs", {}).get("sale"))]

    print(f"\nSplit: {len(rent_bikes)} rent, {len(sale_bikes)} sale, {len(bikes)} total")

    # Check for missing license_class
    missing_lic = [b["id"] for b in bikes if not get_spec(b.get("specs", {}), "license_class")]
    if missing_lic:
        print(f"\n⚠️  WARNING: {len(missing_lic)} bikes missing license_class:")
        for bid in missing_lic:
            print(f"   - {bid}")
    else:
        print("\n✅ All bikes have license_class set")

    # Build rows
    rent_rows = [build_rent_row(b) for b in rent_bikes]
    sale_rows = [build_sale_row(b) for b in sale_bikes]

    # Sort by make, model
    rent_rows.sort(key=lambda r: (r["make"].lower(), r["model"].lower()))
    sale_rows.sort(key=lambda r: (r["make"].lower(), r["model"].lower()))

    # Write CSVs
    print(f"\n=== Writing CSVs to {OUTPUT_DIR} ===")
    rent_path = OUTPUT_DIR / "vip-bike-rent.csv"
    sale_path = OUTPUT_DIR / "vip-bike-sale.csv"
    write_csv(rent_rows, RENT_CSV_COLUMNS, rent_path)
    write_csv(sale_rows, SALE_CSV_COLUMNS, sale_path)

    # Summary
    print(f"\n=== Summary ===")
    print(f"  Rent CSV: {len(rent_rows)} bikes → {rent_path}")
    print(f"  Sale CSV: {len(sale_rows)} bikes → {sale_path}")
    print(f"  Generated: {datetime.datetime.now().isoformat()}")

    # Print bike ID lists for verification
    print(f"\n=== Rent bike IDs ({len(rent_rows)}) ===")
    for r in rent_rows:
        print(f"  - {r['id']}")

    print(f"\n=== Sale bike IDs ({len(sale_rows)}) ===")
    for r in sale_rows:
        print(f"  - {r['id']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
