#!/usr/bin/env python3
"""
Export VIP Bike active rentals to CSV for agent use.

Generates 1 CSV file:
  - <repo>/public/docs/autoreply/vip-bike-rentals.csv  (active + upcoming rents)

Source: Supabase public.rentals table
  - crew_id = vip-bike crew (2d5fde70-1dd3-4f0d-8d72-66ccf6908746)
  - Includes: rents overlapping today + upcoming rents (next 30 days)
  - Excludes: completed/cancelled rents (historical)

This script is DETERMINISTIC — no AI, just selective extraction.
Designed to be run by cron job or skill. Output is compact and clean.

Usage:
  python3 export_vip_bike_rentals.py

Output files are also pushed to repo at docs/autoreply/ by the companion skill.
"""
import json, csv, os, sys, urllib.request, datetime
from pathlib import Path

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

# How far ahead to look for upcoming rents (days)
UPCOMING_DAYS = 30

# ════════════════════════════════════════════════════════════
# CSV COLUMNS
# ════════════════════════════════════════════════════════════

RENTALS_CSV_COLUMNS = [
    "rental_id",
    "vehicle_id",
    "bike_make",
    "bike_model",
    "user_id",
    "status",
    "payment_status",
    "start_date",
    "end_date",
    "duration_days",
    "total_cost",
    "deposit_amount",
    "deposit_method",
    "deposit_collected_at",
    "deposit_returned",
    "delivery_address",
    "is_active_today",
    "is_upcoming",
    "created_at",
    "crew_id",
]

# ════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════

def parse_dt(s):
    """Parse ISO datetime string, return timezone-aware datetime or None."""
    if not s:
        return None
    try:
        return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def format_date(dt):
    """Format datetime as YYYY-MM-DD HH:MM (UTC)."""
    if not dt:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M")


def safe_str(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)


# ════════════════════════════════════════════════════════════
# SUPABASE QUERIES
# ════════════════════════════════════════════════════════════

def fetch_rentals():
    """Fetch all vip-bike crew rentals from Supabase."""
    url = (
        f"{SUPABASE_URL}/rest/v1/rentals?"
        f"crew_id=eq.{VIP_BIKE_CREW_ID}"
        f"&select=rental_id,vehicle_id,user_id,status,payment_status,"
        f"requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,"
        f"total_cost,deposit_amount,deposit_method,deposit_collected_at,deposit_returned,"
        f"delivery_address,created_at,crew_id"
        f"&order=agreed_start_date.desc"
        f"&limit=500"
    )
    req = urllib.request.Request(url, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    print(f"Fetched {len(data)} rentals from Supabase (vip-bike crew)")
    return data


def fetch_bike_names():
    """Fetch bike id → make/model mapping for human-readable names."""
    url = (
        f"{SUPABASE_URL}/rest/v1/cars?"
        f"type=eq.bike"
        f"&crew_id=eq.{VIP_BIKE_CREW_ID}"
        f"&select=id,make,model"
    )
    req = urllib.request.Request(url, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    # Build lookup dict
    bikes = {b["id"]: b for b in data if b.get("make", "").lower() != "vipbike"}
    print(f"Fetched {len(bikes)} bike names for enrichment")
    return bikes


# ════════════════════════════════════════════════════════════
# ROW BUILDER
# ════════════════════════════════════════════════════════════

def build_rental_row(rental, bike_names, today_start, today_end, upcoming_end):
    """Build a clean CSV row for a rental."""
    # Use agreed dates if available, fall back to requested
    start = parse_dt(rental.get("agreed_start_date") or rental.get("requested_start_date"))
    end = parse_dt(rental.get("agreed_end_date") or rental.get("requested_end_date"))

    # Check if active today (overlaps today's date range)
    is_active_today = ""
    if start and end:
        if start <= today_end and end >= today_start:
            is_active_today = "true"

    # Check if upcoming (starts in the next N days, after today)
    is_upcoming = ""
    if start:
        if today_end < start <= upcoming_end:
            is_upcoming = "true"

    # Duration in days
    duration_days = ""
    if start and end:
        delta = end - start
        duration_days = f"{delta.total_seconds() / 86400:.1f}"

    # Bike name enrichment
    vehicle_id = rental.get("vehicle_id", "")
    bike = bike_names.get(vehicle_id, {})
    bike_make = bike.get("make", "")
    bike_model = bike.get("model", "")

    return {
        "rental_id": rental.get("rental_id", ""),
        "vehicle_id": vehicle_id,
        "bike_make": bike_make,
        "bike_model": bike_model,
        "user_id": safe_str(rental.get("user_id")),
        "status": rental.get("status", ""),
        "payment_status": rental.get("payment_status", ""),
        "start_date": format_date(start),
        "end_date": format_date(end),
        "duration_days": duration_days,
        "total_cost": safe_str(rental.get("total_cost")),
        "deposit_amount": safe_str(rental.get("deposit_amount")),
        "deposit_method": rental.get("deposit_method", "") or "",
        "deposit_collected_at": format_date(parse_dt(rental.get("deposit_collected_at"))),
        "deposit_returned": safe_str(rental.get("deposit_returned")),
        "delivery_address": rental.get("delivery_address", "") or "",
        "is_active_today": is_active_today,
        "is_upcoming": is_upcoming,
        "created_at": format_date(parse_dt(rental.get("created_at"))),
        "crew_id": rental.get("crew_id", ""),
    }


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
    print("=== VIP Bike Rentals CSV Export ===\n")

    # Fetch data
    rentals = fetch_rentals()
    bike_names = fetch_bike_names()

    # Date ranges (UTC)
    today = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today
    today_end = today + datetime.timedelta(days=1)
    upcoming_end = today + datetime.timedelta(days=UPCOMING_DAYS + 1)

    print(f"\nDate ranges:")
    print(f"  Today: {today_start.strftime('%Y-%m-%d')} to {today_end.strftime('%Y-%m-%d')}")
    print(f"  Upcoming window: next {UPCOMING_DAYS} days (until {upcoming_end.strftime('%Y-%m-%d')})")

    # Filter: active today OR upcoming (exclude completed/cancelled historical)
    # We include pending_confirmation, active, ongoing, confirmed, started statuses
    # PLUS any rental that overlaps today or starts within upcoming window
    active_statuses = {"active", "ongoing", "confirmed", "started", "pending_confirmation", "pending"}

    filtered = []
    for r in rentals:
        status = r.get("status", "")
        start = parse_dt(r.get("agreed_start_date") or r.get("requested_start_date"))
        end = parse_dt(r.get("agreed_end_date") or r.get("requested_end_date"))

        # Include if:
        # 1. Status is active-type AND dates overlap today or upcoming window
        # 2. OR dates overlap today (regardless of status — could be completed but bike still out)
        # 3. OR status is pending_confirmation and starts within upcoming window
        include = False

        if status in active_statuses:
            # Active status — include if overlapping today or upcoming
            if start and end:
                if start <= upcoming_end and end >= today_start:
                    include = True
            elif start and start <= upcoming_end:
                include = True
        elif start and end:
            # Non-active status — include only if overlapping today
            if start <= today_end and end >= today_start:
                include = True

        if include:
            filtered.append(r)

    print(f"\nFiltered: {len(filtered)} active/upcoming rentals (from {len(rentals)} total)")

    # Build rows
    rows = [build_rental_row(r, bike_names, today_start, today_end, upcoming_end) for r in filtered]

    # Sort by start_date ascending (soonest first)
    rows.sort(key=lambda r: r["start_date"] or "9999")

    # Write CSV
    print(f"\n=== Writing CSV to {OUTPUT_DIR} ===")
    csv_path = OUTPUT_DIR / "vip-bike-rentals.csv"
    write_csv(rows, RENTALS_CSV_COLUMNS, csv_path)

    # Summary
    print(f"\n=== Summary ===")
    print(f"  Rentals CSV: {len(rows)} rows → {csv_path}")
    print(f"  Generated: {datetime.datetime.now().isoformat()}")

    # Print active today + upcoming
    active_today = [r for r in rows if r["is_active_today"] == "true"]
    upcoming = [r for r in rows if r["is_upcoming"] == "true"]
    print(f"\n  Active TODAY: {len(active_today)} rents")
    for r in active_today:
        print(f"    - {r['vehicle_id']} ({r['bike_make']} {r['bike_model']}) — {r['start_date']} → {r['end_date']} — status: {r['status']}")

    print(f"\n  Upcoming (next {UPCOMING_DAYS} days): {len(upcoming)} rents")
    for r in upcoming[:10]:
        print(f"    - {r['vehicle_id']} ({r['bike_make']} {r['bike_model']}) — {r['start_date']} → {r['end_date']} — status: {r['status']}")
    if len(upcoming) > 10:
        print(f"    ... and {len(upcoming) - 10} more")

    # Unavailable bikes today (for quick reference)
    unavailable_today = set(r["vehicle_id"] for r in active_today)
    print(f"\n  Bikes UNAVAILABLE today: {len(unavailable_today)}")
    for bid in sorted(unavailable_today):
        print(f"    - {bid}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
