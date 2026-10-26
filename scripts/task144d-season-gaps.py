#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task144d: season gaps — boss standing instruction «deduce prices yourself, realisticly,
you have examples». Five retro_backfill_v2 rows (contract archive «все договора.zip»,
sum not fixed in docx) still null → deduce + specs note. Also flags the 3 July walk-in
rows that lack verifications (handled by task144b-verify.mjs with env prefixes).

  229a6953 Мирошников horwin-cr1   20.05 10h →  6000 (июнь horwin: 3ч=6000/2ч=6500; CR1 лёгкий электро)
  3bfbe2a0 Воронцов   ex650k       26.05 10h → 10000 (Шаронов 05.06 тот же байк те же 10ч = 10000)
  46a0a4cf Шкитин     panigale-bl  20.05 10h → 10000 (Коняхин 04.05 10ч=10000; Дурандин 10ч=12000)
  ddfe2ae5 Кузовлев   suzuki-s1000 03.07 10h → 12000 (июль: f800r 10ч=12000; suzuki сутки=14000)
  7da7230b Алиев      nibbler      11.07 10h →  8000 (06.07 тот же байк те же 10ч = 8000)

Usage: python3 task144d-season-gaps.py [--apply]
"""
import json, os, sys, urllib.request, urllib.parse
from datetime import datetime, timezone

URL = "https://inmctohsodgdohamhzag.supabase.co"
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.join(HERE, ".sb_key")).read().strip()
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
APPLY = "--apply" in sys.argv

def rest(table, params, method="GET", body=None):
    items = params.items() if isinstance(params, dict) else params
    qs = "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(v, safe='')}"
                  for k, v in items) if params else ""
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?{qs}")
    req.add_header("apikey", KEY); req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Content-Type", "application/json")
    if method != "GET":
        req.get_method = lambda: method
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None

PRICES = [
    ("229a6953", 6000, "Мирошников Horwin CR1 20.05 10ч: июнь horwin 3ч=6000/2ч=6500; CR1 — лёгкий городской электро, дневная плоская ставка 6000"),
    ("3bfbe2a0", 10000, "Воронцов EX650K 26.05 10ч: Шаронов 05.06 тот же байк те же 10ч = 10000 (прямой пример)"),
    ("46a0a4cf", 10000, "Шкитин Panigale S Electro Black 20.05 10ч: Коняхин 04.05 10ч=10000; Дурандин 07.06 10ч=12000"),
    ("ddfe2ae5", 12000, "Кузовлев Suzuki GSX-S1000F 03.07 10ч: июль f800r 10ч=12000 (класс), suzuki сутки=14000"),
    ("7da7230b", 8000, "Алиев nibbler 11.07 10ч: 06.07 тот же байк те же 10ч = 8000 (прямой пример)"),
]

def main():
    rows = rest("rentals", [("select", "rental_id,vehicle_id,total_cost,agreed_start_date,metadata"),
                            ("crew_id", f"eq.{CREW}"), ("limit", "2000")])
    byid = {}
    for r in rows:
        byid[r["rental_id"]] = r
    targets = []
    for pref, cost, note in PRICES:
        hit = next((r for rid, r in byid.items() if rid.startswith(pref)), None)
        if not hit:
            raise SystemExit(f"ABORT: {pref} not found")
        targets.append((hit, cost, note))
        print(f"  {pref} {hit['vehicle_id'][:28]:28} {(hit.get('agreed_start_date') or '')[:10]} "
              f"{str(hit.get('total_cost')):>5} -> {cost}")
    if not APPLY:
        print("\nDRY RUN ONLY — run with --apply"); return
    for hit, cost, note in targets:
        md = dict(hit.get("metadata") or {})
        specs = md.setdefault("specs", {})
        if "retro_price_backfill_v4" in specs:
            print(f"  skip (priced): {hit['rental_id'][:8]}"); continue
        specs["retro_price_backfill_v4"] = {
            "origin": "босс 26.10: «deduce prices yourself, realisticly — you have examples» "
                      "(договор суммы не содержит / сумма не зафиксирована в docx)",
            "mapped_from": note, "confidence": "deduce", "backfilled_at": NOW,
            "backfilled_by": "task144d (agent)"}
        hist = md.setdefault("history", [])
        hist.append({"at": NOW, "by": "task144d-season-gaps", "status": "price_backfill",
                     "note": f"total_cost {hit.get('total_cost')} -> {cost}: {note}"})
        rest("rentals", [("rental_id", f"eq.{hit['rental_id']}")], method="PATCH",
             body={"total_cost": cost, "metadata": md, "updated_at": NOW})
        print(f"  PATCHED {hit['rental_id'][:8]} -> {cost}")
    print("DONE (теперь: VERIFY_NEW_IDS/VERIFY_REPRICED_IDS → task144b-verify.mjs для 8 верификаций)")

if __name__ == "__main__":
    main()
