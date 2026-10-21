#!/usr/bin/env python3
"""Fetch all rentals (with metadata) + introspect schema incl. sales table; save to JSON."""
import os, json, urllib.request, urllib.parse

import os as _os
KEY = _os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or (open(".sb_key").read().strip() if _os.path.exists(".sb_key") else None)
if not KEY:
    raise SystemExit("Set SUPABASE_SERVICE_ROLE_KEY env or drop .sb_key in cwd")
BASE = "https://inmctohsodgdohamhzag.supabase.co/rest/v1"
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

def get(path, params=None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HDRS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def fetch_all(table, select="*", order=None):
    out, off = [], 0
    while True:
        params = {"select": select, "limit": 1000, "offset": off}
        if order:
            params["order"] = order
        batch = get(f"/{table}", params)
        if not batch:
            break
        out += batch
        off += 1000
        if len(batch) < 1000:
            break
    return out

# 1. OpenAPI introspection: list tables
openapi = get("/")
tables = sorted(openapi.get("definitions", {}).keys())
print("TABLES:", tables)

# 2. sales table schema
for t in tables:
    if "sale" in t.lower():
        cols = openapi["definitions"][t]
        print(f"\n== {t} columns ==")
        for c, spec in cols.items():
            print(" ", c, spec.get("format") or spec.get("type"), "(nullable)" if spec.get("nullable") else "")

# 3. fetch sales
for t in tables:
    if "sale" in t.lower():
        try:
            sales = fetch_all(t)
            print(f"\n{t}: {len(sales)} rows")
            json.dump(sales, open(f"/home/z/my-project/scripts/{t}.json", "w"), ensure_ascii=False, indent=1)
            for s in sales[:3]:
                print(json.dumps(s, ensure_ascii=False)[:300])
        except Exception as e:
            print(t, "FETCH ERROR:", e)

# 4. fetch rentals with metadata
rentals = fetch_all("rentals", order="created_at.asc")
print(f"\nrentals: {len(rentals)} rows")
json.dump(rentals, open("/home/z/my-project/scripts/rentals_full.json", "w"), ensure_ascii=False, indent=1)

# quick: how many have doc hashes
with_hash = [r for r in rentals if (r.get("metadata") or {}).get("doc_sha256") or (r.get("metadata") or {}).get("original_sha256")]
print("rentals with doc_sha256/original_sha256:", len(with_hash))
ock = [r for r in rentals if (r.get("metadata") or {}).get("original_contract_key")]
print("rentals with original_contract_key:", len(ock))
