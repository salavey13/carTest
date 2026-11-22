#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Preliminary investigation of current state of `rentals` in Supabase.
Goal: when were the first ones, totals, timeline, statuses, crews, sources.
Read-only. Uses PostgREST with service role key.
"""
import json
import os
import sys
import urllib.request
import urllib.parse
import urllib.error
from collections import Counter
from datetime import datetime

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

FIELDS = (
    "rental_id,user_id,vehicle_id,owner_id,status,payment_status,total_cost,"
    "requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,"
    "created_at,updated_at,crew_id,created_by_operator_chat_id,deposit_amount,metadata"
)


def q(params):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{URL}/rest/v1/rentals?{qs}")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Accept-Profile", "public")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def count_of(params):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{URL}/rest/v1/rentals?{qs}")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Prefer", "count=exact")
    req.add_header("Range-Unit", "items")
    req.add_header("Range", "0-0")
    try:
        with urllib.request.urlopen(req) as r:
            cr = r.headers.get("Content-Range", "")
            return int(cr.split("/")[-1]) if "/" in cr else None
    except urllib.error.HTTPError as e:
        print("count error:", e.code, e.read().decode()[:200])
        return None


def fetch_all():
    rows = []
    off = 0
    while True:
        batch = q(
            {
                "select": FIELDS,
                "order": "created_at.asc.nullslast,rental_id.asc",
                "limit": "1000",
                "offset": str(off),
            }
        )
        rows.extend(batch)
        if len(batch) < 1000:
            break
        off += 1000
    return rows


def crews_map():
    req = urllib.request.Request(f"{URL}/rest/v1/crews?select=id,name,slug")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    try:
        with urllib.request.urlopen(req) as r:
            return {c["id"]: c for c in json.loads(r.read().decode())}
    except Exception:
        return {}


def users_map(user_ids):
    out = {}
    ids = list(user_ids)[:900]  # in() limit safety
    if not ids:
        return out
    idlist = ",".join(f'"{i}"' for i in ids)
    req = urllib.request.Request(
        f"{URL}/rest/v1/users?select=id,first_name,last_name,username,telegram_chat_id&id=in.({idlist})"
    )
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    try:
        with urllib.request.urlopen(req) as r:
            for u in json.loads(r.read().decode()):
                out[u["id"]] = u
    except Exception as e:
        print("  users map error:", e)
    return out


def vehicles_map(vehicle_ids):
    out = {}
    ids = list(vehicle_ids)[:900]
    if not ids:
        return out
    idlist = ",".join(f'"{i}"' for i in ids)
    req = urllib.request.Request(
        f"{URL}/rest/v1/cars?select=id,name,brand,model,plate_number,crew_id&id=in.({idlist})"
    )
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    try:
        with urllib.request.urlopen(req) as r:
            for c in json.loads(r.read().decode()):
                out[c["id"]] = c
    except Exception as e:
        print("  cars map error:", e)
    return out


def month_of(ts):
    if not ts:
        return None
    return ts[:7]


def main():
    print("=" * 78)
    print("RENTALS RETROSPECTIVE INVESTIGATION —", datetime.now().isoformat(timespec="seconds"))
    print("=" * 78)

    total = count_of({"select": "rental_id"})
    print(f"\nTOTAL rentals rows: {total}")

    rows = fetch_all()
    print(f"Fetched rows: {len(rows)}")

    # ---------- timeline by created_at month ----------
    by_month = Counter(month_of(r.get("created_at")) for r in rows)
    print("\n--- created_at by month (oldest → newest) ---")
    for m in sorted(k for k in by_month if k):
        print(f"  {m}: {by_month[m]:4d}  {'#' * min(by_month[m], 70)}")
    null_created = by_month.get(None, 0)
    if null_created:
        print(f"  (null created_at): {null_created}")

    # ---------- earliest 25 ----------
    print("\n--- EARLIEST 25 RENTALS (by created_at) ---")
    for r in rows[:25]:
        print(
            f"  {r.get('created_at')}  id={str(r.get('rental_id'))[:8]}  vehicle={str(r.get('vehicle_id'))[:8]}"
            f"  status={r.get('status')}  total={r.get('total_cost')}"
            f"  agreed={r.get('agreed_start_date')}..{r.get('agreed_end_date')}"
            f"  crew={str(r.get('crew_id'))[:8]}"
        )

    # ---------- status ----------
    print("\n--- status distribution ---")
    for s, n in Counter(r.get("status") for r in rows).most_common():
        print(f"  {s}: {n}")

    print("\n--- payment_status distribution ---")
    for s, n in Counter(r.get("payment_status") for r in rows).most_common():
        print(f"  {s}: {n}")

    # ---------- crews ----------
    crews = crews_map()
    print("\n--- crew distribution ---")
    for cid, n in Counter(r.get("crew_id") for r in rows).most_common():
        c = crews.get(cid, {})
        label = f"{c.get('name')} ({c.get('slug')})" if c else str(cid)
        print(f"  {label}: {n}")

    # ---------- actual rental periods ----------
    print("\n--- agreed_start_date by month (actual rental periods) ---")
    by_amonth = Counter(
        (r.get("agreed_start_date") or "")[:7] or None for r in rows
    )
    for m in sorted(k for k in by_amonth if k):
        print(f"  {m}: {by_amonth[m]:4d}")
    if by_amonth.get(None):
        print(f"  (null agreed_start_date): {by_amonth[None]}")

    earliest_period = sorted(
        (r for r in rows if r.get("agreed_start_date")),
        key=lambda r: r["agreed_start_date"],
    )
    print("\n--- EARLIEST 10 by agreed_start_date (actual earliest rental periods) ---")
    for r in earliest_period[:10]:
        print(
            f"  agreed_start={r.get('agreed_start_date')}  created_at={r.get('created_at')}"
            f"  id={str(r.get('rental_id'))[:8]}  vehicle={str(r.get('vehicle_id'))[:8]}"
            f"  status={r.get('status')}  total={r.get('total_cost')}"
        )

    # ---------- metadata source analysis ----------
    print("\n--- metadata keys frequency (top 40) ---")
    key_freq = Counter()
    for r in rows:
        m = r.get("metadata") or {}
        if isinstance(m, dict):
            for k in m.keys():
                key_freq[k] += 1
    for k, n in key_freq.most_common(40):
        print(f"  {k}: {n}")

    print("\n--- source-ish metadata values ---")
    src_counter = Counter()
    for r in rows:
        m = r.get("metadata") or {}
        if not isinstance(m, dict):
            src_counter["<metadata not dict>"] += 1
            continue
        src = m.get("source") or m.get("created_via") or m.get("attribution") or None
        src_counter[str(src)] += 1
    for s, n in src_counter.most_common(20):
        print(f"  {s}: {n}")

    # ---------- operators (created_by_operator_chat_id) ----------
    print("\n--- created_by_operator_chat_id distribution (top 15) ---")
    for op, n in Counter(r.get("created_by_operator_chat_id") for r in rows).most_common(15):
        print(f"  {op}: {n}")

    # ---------- users ----------
    print("\n--- distinct renters/users ---")
    users = users_map({r.get("user_id") for r in rows if r.get("user_id")})
    print(f"  distinct user_id values: {len({r.get('user_id') for r in rows})}")
    top_users = Counter(r.get("user_id") for r in rows).most_common(10)
    for uid, n in top_users:
        u = users.get(uid, {})
        nm = " ".join(x for x in [u.get("first_name"), u.get("last_name")] if x)
        print(f"  {nm or uid} (chat={u.get('telegram_chat_id')}): {n} rentals")

    # ---------- vehicles ----------
    print("\n--- vehicles involved ---")
    vehicles = vehicles_map({r.get("vehicle_id") for r in rows if r.get("vehicle_id")})
    print(f"  distinct vehicle_id values: {len({r.get('vehicle_id') for r in rows})}")
    top_v = Counter(r.get("vehicle_id") for r in rows).most_common(15)
    for vid, n in top_v:
        v = vehicles.get(vid, {})
        nm = v.get("name") or " ".join(x for x in [v.get("brand"), v.get("model")] if x) or vid
        print(f"  {nm} ({str(vid)[:8]}): {n} rentals")

    # ---------- deposit ----------
    with_dep = [r for r in rows if r.get("deposit_amount")]
    print(f"\n--- deposits: {len(with_dep)} rentals with deposit_amount set ---")

    # ---------- active now ----------
    active_statuses = {"active", "ongoing", "in_progress", "rented", "issued", "confirmed"}
    active = [r for r in rows if (r.get("status") or "").lower() in active_statuses]
    print(f"--- likely ACTIVE rentals (status in {sorted(active_statuses)}): {len(active)}")
    for r in active[:20]:
        print(
            f"  {r.get('status')}: id={str(r.get('rental_id'))[:8]} vehicle={str(r.get('vehicle_id'))[:8]}"
            f" agreed={r.get('agreed_start_date')}..{r.get('agreed_end_date')} created={r.get('created_at')}"
        )

    print("\nDONE.")


if __name__ == "__main__":
    main()
