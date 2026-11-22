#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Round 4: milestones (first rental per source), doc linkage samples, weekly cadence."""
import json
import os
import urllib.request
import urllib.parse
from collections import Counter, defaultdict

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
        "rental_id,user_id,vehicle_id,status,total_cost,created_at,crew_id,"
        "created_by_operator_chat_id,metadata",
        "created_at.asc.nullslast,rental_id.asc",
    )
    users = {}
    uids = sorted({r.get("user_id") for r in rows if r.get("user_id")})
    for chunk in [uids[i:i + 100] for i in range(0, len(uids), 100)]:
        idlist = ",".join(f'"{u}"' for u in chunk)
        for u in rest("users", {"select": "user_id,username,full_name", "user_id": f"in.({idlist})"}):
            users[u["user_id"]] = u

    # ---- first rental per source ----
    print("=== FIRST RENTAL PER SOURCE (milestones) ===")
    seen = {}
    for r in rows:
        src = (r.get("metadata") or {}).get("source") or "<no-source>"
        if src not in seen:
            seen[src] = r
    for src, r in sorted(seen.items(), key=lambda kv: kv[1].get("created_at") or ""):
        m = r.get("metadata") or {}
        u = users.get(r.get("user_id"), {})
        print(f"  {r.get('created_at')}  source={src}")
        print(f"      id={r['rental_id'][:8]} vehicle={r.get('vehicle_id')} status={r.get('status')} total={r.get('total_cost')}")
        print(f"      renter_user={r.get('user_id')} ({u.get('full_name') or u.get('username')}) renter_name={m.get('renter_name')!r} op={r.get('created_by_operator_chat_id')}")

    # ---- doc linkage samples ----
    print("\n=== doc linkage samples (for future .doc matching pipeline) ===")
    withsha = [r for r in rows if (r.get("metadata") or {}).get("doc_sha256")]
    print(f"rentals with doc_sha256: {len(withsha)}")
    for r in withsha[:3]:
        m = r.get("metadata") or {}
        print(f"  {r.get('created_at')[:16]} id={r['rental_id'][:8]}")
        print(f"    doc_sha256 = {str(m.get('doc_sha256'))[:70]}")
        print(f"    document_key = {str(m.get('document_key'))[:80]}")
        print(f"    order_id = {m.get('order_id')!r} flow_type = {m.get('flow_type')!r} bike_name = {m.get('bike_name')!r}")

    # ---- doc_command rentals by month ----
    print("\n=== doc_command rentals by month ===")
    cnt = Counter(((r.get("created_at") or "")[:7]) for r in rows if (r.get("metadata") or {}).get("source") == "doc_command")
    for m in sorted(cnt):
        print(f"  {m}: {cnt[m]}")

    # ---- first doc_command rental ----
    doc_rents = [r for r in rows if (r.get("metadata") or {}).get("source") == "doc_command"]
    if doc_rents:
        r = doc_rents[0]
        m = r.get("metadata") or {}
        print(f"\nFIRST doc_command rental: {r.get('created_at')} id={r['rental_id'][:8]} vehicle={r.get('vehicle_id')} total={r.get('total_cost')} renter_name={m.get('renter_name')!r}")

    # ---- weekly cadence Jul-Oct 2026 ----
    print("\n=== rentals per ISO week (2026-06 .. now) ===")
    wk = defaultdict(int)
    for r in rows:
        c = r.get("created_at") or ""
        if c >= "2026-06":
            iso = json.dumps(c)  # placeholder
            from datetime import datetime
            d = datetime.fromisoformat(c.replace("+00:00", "+00:00"))
            wk[f"{d.isocalendar().year}-W{d.isocalendar().week:02d}"] += 1
    for w in sorted(wk):
        print(f"  {w}: {wk[w]:3d} {'#' * wk[w]}")

    # ---- deposit stats ----
    deps = [r for r in rows if r.get("deposit_amount")]
    print(f"\n=== deposits: {len(deps)} rentals, sum={sum(r['deposit_amount'] for r in deps):,.0f} ₽ ===")

    # ---- how many have BOTH user_id=356282674 AND renter_name (i.e. real walk-in renters) ----
    ios = [r for r in rows if r.get("user_id") == "356282674"]
    named = [r for r in ios if (r.get("metadata") or {}).get("renter_name")]
    sw = [r for r in ios if (r.get("metadata") or {}).get("source") == "service_work"]
    print(f"\nuser_id=I_O_S_NN total={len(ios)}; with renter_name={len(named)}; service_work={len(sw)}")

    print("\nDONE R4.")


if __name__ == "__main__":
    main()
