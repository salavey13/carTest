#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task143 verify: re-check all task143 rows in DB, rebuild complete manifest, print season stats."""
import json
import os
import urllib.parse

import importlib.util
spec = importlib.util.spec_from_file_location(
    "t143", os.path.join(os.path.dirname(os.path.abspath(__file__)), "task143-audio-backfill.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

rows = m.rest("rentals", [
    ("select", "rental_id,vehicle_id,total_cost,requested_start_date,requested_end_date,status,metadata"),
    ("crew_id", f"eq.{m.CREW_VIP_BIKE}"),
    ("requested_start_date", "gte.2026-04-01T00:00:00+00:00"),
    ("requested_start_date", "lt.2026-11-01T00:00:00+00:00"),
    ("order", "requested_start_date.asc"),
])

mine = [x for x in rows if "retro_backfill_audio_v2" in ((x.get("metadata") or {}).get("specs") or {})]
print(f"task143 rows in DB: {len(mine)} (expected 34 + 1 update-tagged)")
for x in mine:
    md = x["metadata"]
    tag = md["specs"]["retro_backfill_audio_v2"].get("row_tag")
    who = md.get("renter_name") or md.get("client") or ""
    print(f"  {tag:<36} {x['rental_id'][:8]} {x['vehicle_id']:<32} {x['requested_start_date'][:10]} "
          f"{str(x['total_cost']):>7} {who[:28]:<28} {md['specs']['retro_backfill_audio_v2'].get('confidence')}")

# Стерлягов row integrity
st = next(x for x in rows if x["rental_id"] == m.UPDATE_ROW["rental_id"])
md = st["metadata"]
print("\n=== Стерлягов 9.05 after update ===")
print(f"  total_cost={st['total_cost']}")
print(f"  history entries: {len(md['history'])}, last: {json.dumps(md['history'][-1], ensure_ascii=False)[:160]}")
print(f"  specs.retro_backfill_audio_v2 present: {'retro_backfill_audio_v2' in md['specs']}")
print(f"  deposit spec intact: {md['specs']['retro_backfill_v2'].get('deposit_rub')}")

# rebuild complete manifest
manifest = {
    "applied_at": m.NOW,
    "source": "boss voice notes 24.10+26.10.2026 (service final.mp3, popki.mp3, may.mp3 — ASR)",
    "note": "rentals.vehicle_id FK → cars.id: 29 vip-bike-svc-049..077 placeholders ensured in cars",
    "inserted": [
        {"tag": x["metadata"]["specs"]["retro_backfill_audio_v2"].get("row_tag"),
         "rental_id": x["rental_id"],
         "vehicle_id": x["vehicle_id"],
         "total_cost": x["total_cost"],
         "kind": "rental" if not x["vehicle_id"].startswith("vip-bike-svc") else "service"}
        for x in mine
    ] + [{"tag": "may9-sterlyakov-popravka", "rental_id": m.UPDATE_ROW["rental_id"],
          "total_cost": 9000, "kind": "update"}],
    "flags_not_inserted": [
        "Богданов Дмитрий Михайлович — аренда 17 мая: байк и цена не разобраны (ASR «650/600»?), телефон неполный (8-962-556-53-9?)",
        "Коронников Александр Викторович — аренда 25 мая: босс оборвал («я забыл последнее»), нет байка/цены/полного телефона",
        "«??? зажигания — 2000₽» (~17 сент): байк и тип работы не распознаны",
        "«Протирка — 100₽» (5-6 сент): объект неясен",
        "«мой аккумулятор — 2000» (20 сент): личная пометка босса, не сервисная строка",
        "«Дьябаев… взял наш штраф» (popki): контекст неясен",
        "«замена колёс с натяжкой цепи — 500» (5-6 сент): похоже на ре-диктовку уже существующих svc-046/047",
    ],
}
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "task143-audio-backfill-manifest.json")
with open(path, "w") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print(f"\nmanifest rebuilt → {path} ({len(manifest['inserted'])} entries)")

print("\n=== FULL SEASON (Apr–Oct 2026, vip-bike) ===")
m.print_totals()
months = m.season_totals()
tr = sum(d["rentals"] for d in months.values()); trr = sum(d["rental_rub"] for d in months.values())
ts = sum(d["service"] for d in months.values()); tsr = sum(d["service_rub"] for d in months.values())
print(f"  TOTAL: rentals={tr} ({trr:,} ₽)  service={ts} ({tsr:,.2f} ₽)")
