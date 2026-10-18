#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deep dive: pre-/doc-era rentals in detail, artifacts, revenue, users/cars lookup fixed."""
import json
import os
import urllib.request
import urllib.parse
from collections import Counter, defaultdict
from datetime import datetime, timezone

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


def short(v, n=60):
    s = json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v
    return s[:n] + ("…" if len(s) > n else "")


def main():
    rows = fetch_all(
        "rentals",
        "rental_id,user_id,vehicle_id,owner_id,status,payment_status,total_cost,"
        "requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,"
        "created_at,updated_at,crew_id,created_by_operator_chat_id,deposit_amount,metadata",
        "created_at.asc.nullslast,rental_id.asc",
    )

    # ================= 1. PRE-DOC ERA DETAIL (created < 2026-06-01) =================
    pre = [r for r in rows if (r.get("created_at") or "9999") < "2026-06-01"]
    print(f"=== PRE-/doc ERA: {len(pre)} rentals created before 2026-06-01 ===")
    for r in pre:
        m = r.get("metadata") or {}
        print(f"\n--- rental {r['rental_id']} ---")
        print("  created_at      :", r.get("created_at"))
        print("  status/payment  :", r.get("status"), "/", r.get("payment_status"))
        print("  total_cost      :", r.get("total_cost"), " deposit:", r.get("deposit_amount"))
        print("  vehicle_id      :", r.get("vehicle_id"))
        print("  user_id         :", r.get("user_id"), " owner:", r.get("owner_id"))
        print("  crew_id         :", r.get("crew_id"))
        print("  requested       :", r.get("requested_start_date"), "..", r.get("requested_end_date"))
        print("  agreed          :", r.get("agreed_start_date"), "..", r.get("agreed_end_date"))
        print("  operator        :", r.get("created_by_operator_chat_id"))
        print("  metadata.source :", m.get("source"))
        for k in ("renter_name", "renter_phone", "bike_name", "service_name", "item_type",
                  "created_by", "history", "order_id", "document_key", "doc_sha256"):
            if k in m:
                print(f"  meta.{k:12s}:", short(m[k], 140))

    # ================= 2. JUNE 2026 (first /doc month) =================
    jun = [r for r in rows if (r.get("created_at") or "9999")[:7] == "2026-06"]
    print(f"\n=== JUNE 2026: {len(jun)} rentals ===")
    for r in jun:
        m = r.get("metadata") or {}
        print(
            f"\n  {r.get('created_at')[:16]}  id={r['rental_id'][:8]} vehicle={r.get('vehicle_id')}"
            f" status={r.get('status')} total={r.get('total_cost')}"
        )
        print(f"    renter: user_id={r.get('user_id')}  meta.renter_name={m.get('renter_name')!r}"
              f"  phone={m.get('renter_phone')!r}")
        print(f"    source={m.get('source')!r} doc_sha256={'YES' if m.get('doc_sha256') else 'no'}"
              f" operator={r.get('created_by_operator_chat_id')}")
        print(f"    agreed: {r.get('agreed_start_date')} .. {r.get('agreed_end_date')}")

    # ================= 3. users lookup (telegram ids) =================
    uids = sorted({r.get("user_id") for r in rows if r.get("user_id")})
    print(f"\n=== users table: {len(uids)} distinct rental user_ids ===")
    users = {}
    try:
        idlist = ",".join(f'"{u}"' for u in uids)
        users = {u["id"]: u for u in rest("users", {"select": "id,first_name,last_name,username,telegram_chat_id", "id": f"in.({idlist})"})}
    except Exception as e:
        print("  users in() failed:", e)
        # fallback: fetch all users
        try:
            allu = fetch_all("users", "id,first_name,last_name,username,telegram_chat_id", "id.asc")
            users = {u["id"]: u for u in allu}
            print(f"  fetched all users: {len(users)}")
        except Exception as e2:
            print("  all-users failed:", e2)
    for uid, n in Counter(r.get("user_id") for r in rows).most_common(12):
        u = users.get(uid, {})
        nm = " ".join(x for x in [u.get("first_name"), u.get("last_name")] if x) or u.get("username") or "?"
        print(f"  {uid} → {nm} (chat={u.get('telegram_chat_id')}): {n} rentals")

    # ================= 4. cars lookup (URL-encoded) =================
    vids = sorted({r.get("vehicle_id") for r in rows if r.get("vehicle_id")})
    print(f"\n=== cars table: {len(vids)} distinct vehicle_ids ===")
    cars = {}
    for chunk in [vids[i:i+100] for i in range(0, len(vids), 100)]:
        try:
            idlist = ",".join(f'"{v}"' for v in chunk)
            for c in rest("cars", {"select": "id,name,brand,model,plate_number,crew_id", "id": f"in.({idlist})"}):
                cars[c["id"]] = c
        except Exception as e:
            print("  chunk failed:", str(e)[:80])
    print(f"  matched in cars: {len(cars)} / {len(vids)}")
    unm = [v for v in vids if v not in cars]
    if unm:
        print("  NOT in cars:", unm[:25])

    # ================= 5. revenue by month =================
    print("\n=== revenue (sum total_cost) by created_at month ===")
    rev = defaultdict(lambda: [0, 0])
    for r in rows:
        mth = (r.get("created_at") or "")[:7] or "?"
        tc = r.get("total_cost") or 0
        rev[mth][0] += tc
        rev[mth][1] += 1
    for mth in sorted(rev):
        s, n = rev[mth]
        print(f"  {mth}: {n:4d} rentals, {s:10,.0f} ₽")

    print("\n=== revenue by agreed_start month (actual rental period) ===")
    rev2 = defaultdict(lambda: [0, 0])
    for r in rows:
        mth = (r.get("agreed_start_date") or "")[:7] or "?"
        tc = r.get("total_cost") or 0
        rev2[mth][0] += tc
        rev2[mth][1] += 1
    for mth in sorted(rev2):
        s, n = rev2[mth]
        print(f"  {mth}: {n:4d} rentals, {s:10,.0f} ₽")

    # ================= 6. contract artifacts =================
    print("\n=== rental_contract_artifacts ===")
    try:
        arts = fetch_all("rental_contract_artifacts", "id,rental_id,crew_slug,created_at", "created_at.asc")
        print(f"  total artifacts: {len(arts)}")
        for a in arts[:5]:
            print("   earliest:", a.get("created_at"), a.get("crew_slug"), "rental:", str(a.get("rental_id"))[:8])
        no_rental = [a for a in arts if not a.get("rental_id")]
        print(f"  artifacts without rental_id link: {len(no_rental)}")
    except Exception as e:
        print("  artifacts error:", str(e)[:120])

    # ================= 7. doc_sha256 usage =================
    withsha = [r for r in rows if (r.get("metadata") or {}).get("doc_sha256")]
    print(f"\n=== doc_sha256 present: {len(withsha)} rentals ===")

    # ================= 8. history traces =================
    print("\n=== rentals with metadata.history: sample pre-doc-era history ===")
    for r in pre:
        m = r.get("metadata") or {}
        h = m.get("history")
        if h:
            print(f"  rental {r['rental_id'][:8]} created {r.get('created_at')[:16]}:")
            print("   ", short(h, 300))

    # ================= 9. rentals per user_id anomaly (operator as renter) =================
    print("\n=== user_id == operator chat_id pattern ===")
    same = [r for r in rows if r.get("user_id") and r.get("user_id") == str(r.get("created_by_operator_chat_id"))]
    print(f"  rentals where user_id == operator chat_id: {len(same)}")
    srcs = Counter((r.get("metadata") or {}).get("source") for r in same)
    print("  their sources:", dict(srcs))
    onrent = Counter(r.get("user_id") for r in same).most_common(5)
    print("  top user_ids there:", onrent)

    print("\nDONE DEEP DIVE.")


if __name__ == "__main__":
    main()
