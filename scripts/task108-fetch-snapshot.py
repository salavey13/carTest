#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fetch full cars list + fresh rentals snapshot for backfill mapping & summary data."""
import json
import os
import urllib.request
import urllib.parse

URL = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sb_key")).read().strip()


def rest(table, params):
    qs = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?{qs}")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def fetch_all(table, select, order):
    rows, off = [], 0
    while True:
        batch = rest(table, {"select": select, "order": order, "limit": "1000", "offset": str(off)})
        rows.extend(batch)
        if len(batch) < 1000:
            break
        off += 1000
    return rows


cars = fetch_all("cars", "id,make,model,description,daily_price,type,crew_id", "id.asc")
print(f"CARS: {len(cars)}")
for c in cars:
    print(f"  {c['id']:45s} | {str(c.get('make'))[:18]:18s} | {str(c.get('model'))[:28]:28s} | {str(c.get('daily_price')):>8s} | {c.get('type')}")

print("\n=== owner_id distribution among vip-bike rentals ===")
rentals = fetch_all(
    "rentals",
    "rental_id,user_id,vehicle_id,owner_id,status,payment_status,total_cost,"
    "requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,"
    "created_at,crew_id,deposit_amount,metadata",
    "created_at.asc.nullslast,rental_id.asc",
)
from collections import Counter
vb = [r for r in rentals if r.get("crew_id") == "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"]
print("vip-bike rentals:", len(vb))
for oid, n in Counter(r.get("owner_id") for r in vb).most_common():
    print(f"  owner_id={oid}: {n}")

print("\n=== sample recent completed vip-bike rental (insert template reference) ===")
for r in reversed([r for r in vb if r.get("status") == "completed" and (r.get("metadata") or {}).get("source") == "doc_command"][-1:]):
    print(json.dumps(r, ensure_ascii=False, indent=1)[:1500])

print("\n=== any rentals with agreed_start < 2026-06-17? ===")
early = [r for r in rentals if (r.get("agreed_start_date") or "9") < "2026-06-17"]
print(len(early), [ (r["rental_id"][:8], r.get("agreed_start_date"), r.get("vehicle_id")) for r in early ][:10])

# save snapshot for the summary builder
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rentals_snapshot.json"), "w") as f:
    json.dump(rentals, f, ensure_ascii=False)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cars_snapshot.json"), "w") as f:
    json.dump(cars, f, ensure_ascii=False)
print("\nsnapshots saved.")
