#!/usr/bin/env python3
"""Monthly rentals summary May-October 2026, grouped by status/crew/era.
Read-only. Reuses rentals_full.json if fresh, else fetches from Supabase."""
import json, os, sys
from collections import defaultdict
from datetime import datetime, timezone

BASE = "/home/z/my-project"
CACHE = f"{BASE}/scripts/rentals_full.json"


def _load_key():
    k = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if k:
        return k
    with open(f"{BASE}/scripts/.sb_key") as f:
        return f.read().strip()


def fetch_all(table, select="*", order=None):
    import urllib.request, urllib.parse
    key = _load_key()
    url_base = "https://inmctohsodgdohamhzag.supabase.co/rest/v1"
    rows, off = [], 0
    while True:
        params = {"select": select, "limit": "1000", "offset": str(off)}
        if order:
            params["order"] = order
        url = f"{url_base}/{table}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Range-Unit": "items",
        })
        with urllib.request.urlopen(req, timeout=30) as r:
            chunk = json.loads(r.read().decode())
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        off += 1000
    return rows


def month_of(ts):
    if not ts:
        return None
    return ts[:7]  # YYYY-MM (UTC)


def main():
    refetch = "--refetch" in sys.argv
    rows = None
    if not refetch and os.path.exists(CACHE):
        with open(CACHE) as f:
            payload = json.load(f)
        rows = payload if isinstance(payload, list) else payload.get("rows")
        # cache is from Oct 18 — refetch anyway for freshness if flag given
    if rows is None or refetch:
        rows = fetch_all("rentals", select="rental_id,user_id,vehicle_id,crew_id,status,payment_status,total_cost,deposit_amount,created_at,agreed_start_date,agreed_end_date,metadata")
        with open(CACHE, "w") as f:
            json.dump(rows, f, ensure_ascii=False)
        print(f"fetched {len(rows)} rentals → cache refreshed", file=sys.stderr)

    crews = {}
    try:
        for c in fetch_all("crews", select="id,slug,name"):
            crews[c["id"]] = c.get("slug") or c.get("name")
    except Exception as e:
        print(f"crews lookup failed: {e}", file=sys.stderr)

    months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
    by_month = defaultdict(list)
    for r in rows:
        # Use agreed_start_date (contract start) primarily; fall back to created_at
        start = r.get("agreed_start_date") or r.get("created_at")
        m = month_of(start)
        by_month[m].append(r)

    print("\n=== RENTALS PER MONTH (by agreed_start_date, fallback created_at) ===")
    print(f"{'month':8} {'count':>5} {'total_cost RUB':>15} {'completed':>9} {'active/other':>12}")
    for m in months:
        lst = by_month.get(m, [])
        tot = sum(x.get("total_cost") or 0 for x in lst)
        done = sum(1 for x in lst if x.get("status") == "completed")
        other = len(lst) - done
        print(f"{m:8} {len(lst):>5} {tot:>15,.0f} {done:>9} {other:>12}")

    print("\n=== SAME, by crew ===")
    for m in months:
        lst = by_month.get(m, [])
        per = defaultdict(int)
        for x in lst:
            per[crews.get(x.get("crew_id"), str(x.get("crew_id"))[:8] if x.get("crew_id") else "no-crew")] += 1
        print(f"{m}: {dict(per)}")

    print("\n=== status breakdown per month ===")
    for m in months:
        lst = by_month.get(m, [])
        st = defaultdict(int)
        for x in lst:
            st[x.get("status")] += 1
        print(f"{m}: {dict(st)}")

    # May/June deep dive: list every rental with dates+vehicle+cost
    for m in ["2026-05", "2026-06"]:
        lst = sorted(by_month.get(m, []), key=lambda x: x.get("agreed_start_date") or x.get("created_at") or "")
        print(f"\n=== {m} DETAIL ({len(lst)} rows) ===")
        for x in lst:
            md = x.get("metadata") or {}
            print(f"  start={x.get('agreed_start_date')} created={x.get('created_at')} "
                  f"cost={x.get('total_cost')} status={x.get('status')} crew={crews.get(x.get('crew_id'))} "
                  f"src={md.get('source')} renter={(md.get('renter_name') or '')[:25]}")

    # Distribution by created_at month (era check)
    print("\n=== by created_at month (when row appeared in DB) ===")
    cr = defaultdict(int)
    for r in rows:
        cr[month_of(r.get("created_at"))] += 1
    for m in sorted(cr):
        print(f"{m}: {cr[m]}")


if __name__ == "__main__":
    main()
