#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task144: insert rental_verifications rows for retro walk-in rentals (bikes) using the
canon snapshots computed by task144-verify-snapshots.mjs (real computeRentalVerificationSnapshot).
Status="verified" (operator djorudjov + owner Paul both confirm — boss dictation = owner sign-off;
operator attribution per boss: «operator is djorudjov»). payout stays null (unpaid).
Idempotent: skips rental_ids that already have a verification row.
"""
import json, os, sys, urllib.request, urllib.parse
from datetime import datetime, timezone

URL = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sb_key")).read().strip()
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
OWNER = "356282674"
OPERATOR = "7813830016"
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
APPLY = "--apply" in sys.argv

SNAP = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "task144-verify-snapshots.json")))

def rest(table, params, method="GET", body=None, prefer=None):
    items = params.items() if isinstance(params, dict) else params
    qs = "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(v, safe='')}"
                  for k, v in items) if params else ""
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?{qs}")
    req.add_header("apikey", KEY); req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Content-Type", "application/json")
    if method != "GET":
        req.get_method = lambda: method
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None

existing = {x["rental_id"] for x in rest("rental_verifications",
            [("select", "rental_id"), ("crew_id", f"eq.{CREW}")]) or []}
print(f"snapshots: {len(SNAP)}, existing verifications: {len(existing)}")

rows = []
for rid, rec in SNAP.items():
    if "error" in rec:
        print("skip (snapshot error):", rid[:8], rec["error"][:60]); continue
    if rid in existing:
        continue
    snap = rec["snapshot"]
    ts = rec.get("requestedAtIso") or NOW
    rows.append({
        "rental_id": rid, "crew_id": CREW, "crew_slug": "vip-bike",
        "operator_chat_id": OPERATOR, "owner_chat_id": OWNER,
        "requested_by": OPERATOR, "requested_at": ts,
        "status": "verified",
        "operator_confirmed_at": ts, "owner_confirmed_at": ts, "verified_at": NOW,
        "source": "retro_backfill",
        "snapshot": snap,
        "created_at": NOW, "updated_at": NOW,
    })
print(f"rows to insert: {len(rows)}")
tot_commission = sum((r["snapshot"].get("total") or 0) for r in rows)
print(f"canon commission total across rows: {tot_commission:,.0f} ₽")
for r in rows[:6]:
    s = r["snapshot"]
    print(f"  {r['rental_id'][:8]} total={s.get('total')} base={s.get('base')} equip={s.get('equipment')} over={s.get('overprice')} cost={s.get('totalCost')}")
if not APPLY:
    print("DRY RUN ONLY — run with --apply"); raise SystemExit(0)

import urllib.error
inserted = 0
for chunk_start in range(0, len(rows), 20):
    chunk = rows[chunk_start:chunk_start + 20]
    rest("rental_verifications", {"select": "id"}, method="POST", body=chunk,
         prefer="return=representation")
    inserted += len(chunk)
    print(f"  inserted {inserted}/{len(rows)}")
print("DONE")
