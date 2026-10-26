#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task144c: leads catch-up — audit found 28 June v3 renters WITHOUT franchize_intents leads
(task144-fullhouse selected candidates by created_by_operator_chat_id IS NULL, but v3 rows
were inserted WITH operator already set → they never became lead candidates).
Boss asked: «doublecheck that dudes from rentals are added to leads» — this closes the gap.
Idempotent: skips dedupeKeys that already exist. Pattern = task144-fullhouse Step B.
Usage: python3 task144c-leads-catchup.py [--apply]
"""
import json, os, sys, urllib.request, urllib.parse
from datetime import datetime, timezone

URL = "https://inmctohsodgdohamhzag.supabase.co"
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.join(HERE, ".sb_key")).read().strip()
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
OPERATOR = "7813830016"
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
APPLY = "--apply" in sys.argv

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

def main():
    months = [("2026-04-01", "2026-05-01"), ("2026-05-01", "2026-06-01"),
              ("2026-06-01", "2026-07-01"), ("2026-07-01", "2026-08-01")]
    cars = {c["id"]: c for c in rest("cars", [("select", "id,make,model,type"), ("crew_id", f"eq.{CREW}"), ("limit", "300")])}
    rentals = []
    for a, b in months:
        rentals += rest("rentals", [
            ("select", "rental_id,vehicle_id,total_cost,agreed_start_date,metadata,status"),
            ("crew_id", f"eq.{CREW}"), ("agreed_start_date", "gte." + a),
            ("agreed_start_date", "lt." + b), ("limit", "500")])
    have = set()
    for a, b in months:
        for it in rest("franchize_intents", [
                ("select", "metadata"), ("slug", "eq.vip-bike"),
                ("metadata->>dedupeKey", "like.retro-rental:*"), ("limit", "500")]):
            pass  # single query below is enough
        break
    its = rest("franchize_intents", [
        ("select", "metadata"), ("slug", "eq.vip-bike"),
        ("metadata->>dedupeKey", "like.retro-rental:*"), ("limit", "500")])
    for it in its:
        dk = ((it.get("metadata") or {}).get("dedupeKey") or "")
        if dk.startswith("retro-rental:"):
            have.add(dk.split(":", 1)[1])
    missing = []
    for r in rentals:
        v = cars.get(r.get("vehicle_id"))
        if not v or v.get("type") not in ("bike", None):
            continue
        if r.get("status") != "completed":
            continue
        name = ((r.get("metadata") or {}).get("renter_name") or "").strip()
        if not name:
            continue
        if r["rental_id"] in have:
            continue
        missing.append((r, name, v))
    print(f"retro leads existing: {len(have)} | bike rentals w/o lead: {len(missing)}")
    for r, name, v in missing:
        print(f"  {(r.get('agreed_start_date') or '')[:10]} {name[:32]:32} {r['vehicle_id'][:24]:24} {str(r.get('total_cost')):>6}")
    if not APPLY:
        print("\nDRY RUN ONLY — run with --apply"); return
    made = 0
    for r, name, v in missing:
        rid = r["rental_id"]
        day = (r.get("agreed_start_date") or "")[:10]
        meta = {
            "name": name,
            "bikeTitle": f"{v.get('make') or ''} {v.get('model') or ''}".strip(),
            "sourceRoute": "/doc-manual", "channel": "telegram_bot",
            "operatorId": OPERATOR, "dedupeKey": f"retro-rental:{rid}",
            "retroBackfill": {"at": NOW, "by": "task144c-leads-catchup",
                              "note": ("ретро-лид из аренды — закрытие дыры: v3-строки вставлялись с "
                                       "оператором и не попали в кандидаты task144-fullhouse; "
                                       "договор не генерировался"),
                              "rental_id": rid, "rental_date": day,
                              "total_cost": r.get("total_cost")},
            "lastSeenAt": NOW,
        }
        body = {"slug": "vip-bike", "bike_id": r.get("vehicle_id"), "intent_type": "rent",
                "stage": "contract_generated", "source_route": "/doc-manual",
                "contact_channel": "telegram_bot", "urgency_score": 0,
                "telegram_user_id": OPERATOR, "phone": None, "metadata": meta,
                "last_seen_at": NOW}
        rest("franchize_intents", {"select": "id"}, method="POST", body=[body],
             prefer="return=representation")
        made += 1
        print(f"  LEAD {name} ({day})")
    print(f"\nleads created: {made}")
    left = rest("franchize_intents", [("select", "metadata"), ("slug", "eq.vip-bike"),
                                      ("metadata->>dedupeKey", "like.retro-rental:*"), ("limit", "500")])
    print(f"retro leads now: {len(left)}")

if __name__ == "__main__":
    main()
