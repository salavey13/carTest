#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task144 full-house (boss: «doublecheck that dudes from rentals are added to leads, operator is
djorudjov, verifications, commissions, full house — everything needed for full season stats
and salaries»).

Step A — operator attribution: every retro walk-in rental row (user_id=owner_id=356282674,
status completed, bike, no operator yet) gets created_by_operator_chat_id=7813830016 (djorudjov,
active crew admin). This is the #1 source in resolveRentalOperator() → salaries/credit the
season to the operator. Idempotent via metadata.specs.operator_attribution_djorudjov.

Step B — leads: for every retro rental row with renter_name, upsert a franchize_intents row
(slug=vip-bike, intent_type=rent, stage=contract_generated, telegram_user_id=7813830016 so the
leads builder treats it as operator-origin → keys the lead by NAME/PHONE, never exposing the
operator's TG as contact; metadata.operatorId preserved; metadata.dedupeKey makes re-runs merge).
This is exactly how /doc-manual creates leads (app/franchize/lib/leads.ts upsertFranchizeLead).

Usage: python3 task144-fullhouse.py [--apply]
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone

URL = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sb_key")).read().strip()
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
OWNER = "356282674"
OPERATOR = "7813830016"
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
APPLY = "--apply" in sys.argv


def rest(table, params, method="GET", body=None, prefer=None):
    items = params.items() if isinstance(params, dict) else params
    qs = "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(v, safe='')}"
                  for k, v in items) if params else ""
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?{qs}")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Content-Type", "application/json")
    if method != "GET":
        req.get_method = lambda: method
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def norm_phone(p):
    if not p:
        return None
    s = "".join(ch for ch in str(p) if ch.isdigit())
    if len(s) == 11 and s[0] in "87":
        return "+7" + s[1:]
    if len(s) == 10:
        return "+7" + s
    return None


def bike_title(vehicles, vid):
    v = vehicles.get(vid)
    if not v:
        return None
    return f"{v.get('make') or ''} {v.get('model') or ''}".strip() or None


def main():
    # ── fetch retro walk-in candidates ──
    rentals = rest("rentals", [
        ("select", "rental_id,user_id,owner_id,vehicle_id,created_by_operator_chat_id,total_cost,"
                   "requested_start_date,status,metadata"),
        ("crew_id", f"eq.{CREW}"),
        ("user_id", f"eq.{OWNER}"),
        ("owner_id", f"eq.{OWNER}"),
        ("status", "eq.completed"),
        ("created_by_operator_chat_id", "is.null"),
    ])
    vehicles = {v["id"]: v for v in rest("cars", [("select", "id,make,model,type"), ("crew_id", f"eq.{CREW}")])}
    cands = []
    for x in rentals:
        v = vehicles.get(x.get("vehicle_id"))
        if not v or v.get("type") not in ("bike", None):
            continue  # services/equipment excluded — no rental bonus attribution
        if not (x.get("requested_start_date") or "").startswith(("2026-0", "2026-1")):
            continue
        cands.append(x)
    print(f"retro walk-in candidates (completed bikes, no operator): {len(cands)}")
    for x in cands:
        md = x.get("metadata") or {}
        print(f"  {x['rental_id'][:8]} | {(x.get('requested_start_date') or '')[:10]} | "
              f"{x.get('vehicle_id')} | {md.get('renter_name')!r} | {x.get('total_cost')}₽")

    if not APPLY:
        print("\nDRY RUN ONLY — run with --apply")
        return

    attributed = 0
    intents_created = 0
    intents_skipped = 0

    # existing retro intents (dedupe by metadata.dedupeKey)
    existing_intents = rest("franchize_intents", [
        ("select", "id,metadata"),
        ("slug", "eq.vip-bike"),
        ("intent_type", "eq.rent"),
        ("metadata", "not.eq.null"),
        ("limit", "2000"),
    ])
    have_keys = set()
    for it in existing_intents or []:
        dk = ((it.get("metadata") or {}).get("dedupeKey") or "")
        if dk.startswith("retro-rental:"):
            have_keys.add(dk)

    for x in cands:
        md = x.get("metadata") or {}
        specs = md.setdefault("specs", {})
        rid = x["rental_id"]
        # ── Step A: attribution ──
        if "operator_attribution_djorudjov" not in specs:
            hist = md.setdefault("history", [])
            hist.append({"at": NOW, "by": "task144-fullhouse", "status": "completed",
                         "note": ("operator attribution: created_by_operator_chat_id → djorudjov "
                                  "(7813830016) — босс 26.10.2026: «operator is djorudjov» для "
                                  "ретро-аренд; источник №1 в resolveRentalOperator → ЗП/бонусы")})
            specs["operator_attribution_djorudjov"] = {
                "operator_chat_id": OPERATOR,
                "attribution_source": "doc_command (resolveRentalOperator)",
                "set_at": NOW, "set_by": "task144-fullhouse (boss request)",
            }
            rest("rentals", [("rental_id", f"eq.{rid}")], method="PATCH",
                 body={"created_by_operator_chat_id": OPERATOR, "metadata": md, "updated_at": NOW})
            attributed += 1
        # ── Step B: lead intent ──
        name = (md.get("renter_name") or "").strip()
        if not name:
            continue
        day = (x.get("requested_start_date") or "")[:10]
        dedupe_key = f"retro-rental:{rid}"
        if dedupe_key in have_keys:
            intents_skipped += 1
            continue
        phone = norm_phone(md.get("renter_phone"))
        title = bike_title(vehicles, x.get("vehicle_id"))
        meta = {
            "name": name,
            "bikeTitle": title,
            "sourceRoute": "/doc-manual",
            "channel": "telegram_bot",
            "operatorId": OPERATOR,
            "dedupeKey": dedupe_key,
            "retroBackfill": {
                "at": NOW, "by": "task144-fullhouse",
                "note": ("ретро-лид из аренды (диктовки/xlsx-сверки апрель-июнь); цифровой договор "
                         "не генерировался — босс: «всё кроме генерации документов»"),
                "rental_id": rid, "rental_date": day,
                "total_cost": x.get("total_cost"),
            },
            "lastSeenAt": NOW,
        }
        if phone:
            meta["phone"] = phone
        body = {
            "slug": "vip-bike",
            "bike_id": x.get("vehicle_id"),
            "intent_type": "rent",
            "stage": "contract_generated",
            "source_route": "/doc-manual",
            "contact_channel": "telegram_bot",
            "urgency_score": 0,
            "telegram_user_id": OPERATOR,
            "phone": phone,
            "metadata": meta,
            "last_seen_at": NOW,
        }
        rest("franchize_intents", {"select": "id"}, method="POST", body=[body],
             prefer="return=representation")
        have_keys.add(dedupe_key)
        intents_created += 1

    print(f"\nattribution patched: {attributed}")
    print(f"intents created: {intents_created} (skipped existing: {intents_skipped})")

    # ── verify: no walk-in rental left unattributed ──
    left = rest("rentals", [
        ("select", "rental_id", ),
        ("crew_id", f"eq.{CREW}"),
        ("user_id", f"eq.{OWNER}"),
        ("status", "eq.completed"),
        ("created_by_operator_chat_id", "is.null"),
    ])
    n_left = sum(1 for x in (left or [])
                 if (vehicles.get(x["rental_id"]) or {}).get("type") != "bike")
    print(f"\nverify: walk-in rentals still without operator: {len(left or [])} "
          f"(из них bike-класс: {[x['rental_id'][:8] for x in (left or []) if x.get('vehicle_id') in vehicles and (vehicles[x['vehicle_id']].get('type') in ('bike', None))]})")


if __name__ == "__main__":
    main()
