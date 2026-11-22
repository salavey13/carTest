#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Round 3: corrected lookups (users.user_id, cars.make/model, artefacts, renter attribution)."""
import json
import os
import urllib.request
import urllib.parse
import urllib.error
from collections import Counter

URL = "https://inmctohsodgdohamhzag.supabase.co"
def _load_key():
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env:
        return env
    kf = os.path.join(os.getcwd(), ".sb_key")
    if os.path.exists(kf):
        return open(kf).read().strip()
    raise SystemExit("Set SUPABASE_SERVICE_ROLE_KEY env var (or drop .sb_key file in cwd)")


KEY = _load_key()


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


def main():
    rows = fetch_all(
        "rentals",
        "rental_id,user_id,vehicle_id,owner_id,status,payment_status,total_cost,"
        "created_at,crew_id,created_by_operator_chat_id,metadata",
        "created_at.asc.nullslast,rental_id.asc",
    )

    # ---- users lookup (user_id col) ----
    uids = sorted({r.get("user_id") for r in rows if r.get("user_id")})
    users = {}
    for chunk in [uids[i:i + 100] for i in range(0, len(uids), 100)]:
        idlist = ",".join(f'"{u}"' for u in chunk)
        try:
            for u in rest("users", {"select": "user_id,username,full_name", "user_id": f"in.({idlist})"}):
                users[u["user_id"]] = u
        except urllib.error.HTTPError as e:
            print("users chunk 400:", e.read().decode()[:150])
    print(f"users matched: {len(users)}/{len(uids)}")
    for uid, n in Counter(r.get("user_id") for r in rows).most_common(15):
        u = users.get(uid, {})
        print(f"  {uid} → {u.get('full_name') or u.get('username') or '?'} ({u.get('username')}) : {n} rentals")

    # ---- cars lookup ----
    vids = sorted({r.get("vehicle_id") for r in rows if r.get("vehicle_id")})
    cars = {}
    for chunk in [vids[i:i + 100] for i in range(0, len(vids), 100)]:
        idlist = ",".join(f'"{v}"' for v in chunk)
        try:
            for c in rest("cars", {"select": "id,make,model,crew_id,daily_price", "id": f"in.({idlist})"}):
                cars[c["id"]] = c
        except urllib.error.HTTPError as e:
            print("cars chunk 400:", e.read().decode()[:150])
    print(f"\ncars matched: {len(cars)}/{len(vids)}")
    unm = [v for v in vids if v not in cars]
    print("NOT in cars:", unm)
    top_v = Counter(r.get("vehicle_id") for r in rows).most_common(20)
    print("\ntop vehicles:")
    for vid, n in top_v:
        c = cars.get(vid, {})
        nm = f"{c.get('make') or ''} {c.get('model') or ''}".strip() or "?"
        print(f"  {nm} ({vid}) : {n} rentals")

    # ---- artefacts ----
    print("\n=== rental_contract_artefacts ===")
    try:
        arts = fetch_all("rental_contract_artefacts", "id,rental_id,crew_slug,created_at", "created_at.asc")
        print(f"total: {len(arts)}")
        for a in arts[:6]:
            print("  earliest:", a.get("created_at"), a.get("crew_slug"), "rental:", str(a.get("rental_id"))[:8])
        linked = sum(1 for a in arts if a.get("rental_id"))
        print(f"linked to rentals: {linked}, unlinked: {len(arts) - linked}")
        cnt = Counter((a.get("created_at") or "")[:7] for a in arts)
        print("by month:", dict(sorted(cnt.items())))
    except Exception as e:
        print("error:", str(e)[:200])

    # ---- renter attribution for user 356282674 ----
    print("\n=== rentals with user_id=356282674 (180) — sample renter_name/phone from metadata ===")
    sample = [r for r in rows if r.get("user_id") == "356282674"]
    named = [r for r in sample if (r.get("metadata") or {}).get("renter_name")]
    print(f"  with renter_name in metadata: {len(named)}/{len(sample)}")
    srcs = Counter((r.get("metadata") or {}).get("source") for r in sample)
    print("  sources:", dict(srcs))
    st = Counter(r.get("status") for r in sample)
    print("  statuses:", dict(st))
    for r in named[:8]:
        m = r.get("metadata") or {}
        print(f"    {r.get('created_at')[:16]} {m.get('renter_name')!r} {m.get('renter_phone')!r} total={r.get('total_cost')}")
    noname = [r for r in sample if not (r.get("metadata") or {}).get("renter_name")]
    print(f"  WITHOUT renter_name: {len(noname)} — sample:")
    for r in noname[:8]:
        m = r.get("metadata") or {}
        print(f"    {r.get('created_at')[:16]} src={m.get('source')!r} status={r.get('status')} total={r.get('total_cost')} keys={list(m.keys())[:10]}")

    # ---- all rentals without any renter_name & with None source (potential backfill candidates) ----
    print("\n=== rentals missing renter_name (all sources) ===")
    noname_all = [r for r in rows if not (r.get("metadata") or {}).get("renter_name")]
    print(f"total missing renter_name: {len(noname_all)}/{len(rows)}")
    cnt = Counter(((r.get("created_at") or "?")[:7], (r.get("metadata") or {}).get("source")) for r in noname_all)
    for (mth, src), n in sorted(cnt.items(), key=lambda kv: (str(kv[0][0]), str(kv[0][1]))):
        print(f"  {mth} src={src}: {n}")

    print("\nDONE R3.")


if __name__ == "__main__":
    main()
