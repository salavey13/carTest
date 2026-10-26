#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task144b: recon v2 — public schema (post-migration): june baseline + price examples + fleet."""
import json, os, urllib.request
from collections import defaultdict
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.join(HERE, ".sb_key")).read().strip()
URL = "https://inmctohsodgdohamhzag.supabase.co/rest/v1"
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

def get(table, params):
    req = urllib.request.Request(f"{URL}/{table}?{params}", headers=HDRS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def spec_tag(meta):
    sp = (meta or {}).get("specs") or {}
    for k in ("retro_backfill_audio_v3", "retro_backfill_audio_v2", "retro_backfill_audio_v1"):
        if isinstance(sp.get(k), dict):
            return sp[k].get("tag", "")
    return sp.get("tag", "")

def main():
    june = get("rentals",
        f"select=rental_id,vehicle_id,total_cost,agreed_start_date,agreed_end_date,status,metadata,created_by_operator_chat_id"
        f"&agreed_start_date=gte.2026-06-01&agreed_start_date=lt.2026-07-01&crew_id=eq.{CREW}&order=agreed_start_date.asc")
    print(f"=== JUNE RENTALS ({len(june)}) ===")
    for r in june:
        st = r.get("agreed_start_date") or ""
        en = r.get("agreed_end_date") or ""
        dur = ""
        if st and en:
            hrs = round((datetime.fromisoformat(en.replace("Z","+00:00")) - datetime.fromisoformat(st.replace("Z","+00:00"))).total_seconds()/3600, 1)
            dur = f"{hrs}h"
        print(f"{st[:16]} -> {en[:16]:16} {dur:>6} | {r['vehicle_id'][:30]:30} | {str(r['total_cost']):>6} | {r['status'][:10]:10} | op={r.get('created_by_operator_chat_id') or '-':10} | {spec_tag(r.get('metadata'))[:42]}")

    ex = get("rentals",
        f"select=vehicle_id,total_cost,agreed_start_date,agreed_end_date"
        f"&agreed_start_date=gte.2026-04-01&agreed_start_date=lt.2026-08-01&crew_id=eq.{CREW}&total_cost=not.is.null&status=eq.completed&order=agreed_start_date.asc")
    per = defaultdict(list)
    for r in ex:
        hrs = None
        if r.get("agreed_start_date") and r.get("agreed_end_date"):
            s = datetime.fromisoformat(r["agreed_start_date"].replace("Z","+00:00"))
            e = datetime.fromisoformat(r["agreed_end_date"].replace("Z","+00:00"))
            hrs = round((e-s).total_seconds()/3600, 1)
        per[r["vehicle_id"]].append((r["agreed_start_date"][:10], r["total_cost"], hrs))
    print(f"\n=== PRICE EXAMPLES APR-JUL (per vehicle, completed) ===")
    for v in sorted(per):
        rows = per[v]
        costs = [c for _, c, _ in rows]
        print(f"{v[:36]:36} n={len(rows):3} range={min(costs)}-{max(costs)} | {rows[:12]}")

    print(f"\n=== FLEET: candidate vehicles for held rows ===")
    rows = get("cars", "select=id,make,model,daily_price,specs&crew_id=eq." + CREW + "&order=id.asc&limit=200")
    for c in rows:
        sp = c.get("specs") or {}
        dp = c.get("daily_price") or sp.get("dailyPrice")
        print(f"{c['id'][:36]:36} | {(c.get('make') or '')} {(c.get('model') or '')}[:24] | daily={dp} | type={c.get('type')}")

if __name__ == "__main__":
    main()
