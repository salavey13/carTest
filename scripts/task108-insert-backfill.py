#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task108: retro-backfill pre-mid-June 2026 rentals (from «Все движения по ВипБайкЭлектро 2026.xlsx», лист «Аренда»).
Inserts ONLY rows with a firm date and money; undated rows wait for the .zip contracts.
source=retro_backfill_v1, full provenance in metadata.specs. Walk-in pattern: user_id=owner_id=356282674.
Usage: python3 insert_backfill.py [--apply]
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone

URL = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sb_key")).read().strip()
CREW_VIP_BIKE = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
WALKIN_USER = "356282674"
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")

APPLY = "--apply" in sys.argv


def rest(table, params, method="GET", body=None, prefer=None):
    qs = urllib.parse.urlencode(params, quote_via=urllib.parse.quote) if params else ""
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


# ---------------------------------------------------------------- rows to insert
def d(month, day, sh=9, eh=None, smi=0):
    """2026 date in UTC: 09:00 UTC = 12:00 MSK default."""
    end = eh if eh is not None else sh
    return (
        f"2026-{month:02d}-{day:02d}T{sh:02d}:{smi:02d}:00+00:00",
        f"2026-{month:02d}-{day:02d}T{end:02d}:00:00+00:00",
    )


ROWS = []

# 1) 4 мая — Ducati (Panigale S Electro Black Z, «зубик») — Коняхин С.В. — 1 день+экип — 10 000
s, e = d(5, 4, 9, 19)
ROWS.append({
    "_tag": "arrenda-row3",
    "vehicle_id": "ducati-panigale-s-electro-black",
    "renter_name": "Коняхин С.В.",
    "start": s, "end": e,
    "total_cost": 10000,
    "duration_note": "1 день + экип",
    "confidence": "high",
    "note": "«Мотоцикл Ducati» листа Аренда = Panigale S Electro Black Z («зубик», закуп 350 000): суточная цена в базе 10 000 ₽ совпадает. Экип включён в цену.",
})

# 2) 4 мая — «Zero» — клиент не записан (ячейка продублирована длительностью) — 1 день+экип — 10 000
s, e = d(5, 4, 9, 19)
ROWS.append({
    "_tag": "arrenda-row4",
    "vehicle_id": "sequence-zero",
    "renter_name": None,
    "start": s, "end": e,
    "total_cost": 10000,
    "duration_note": "1 день + экип",
    "confidence": "medium",
    "note": "ФИО клиента в xlsx не заполнено (ячейка = «1 день+экип»). «Zero» → Sequence Zero (единственный Zero в арендном парке базы). Ранняя сезонная цена ниже текущей суточной (20 000) — сумма записана как в xlsx.",
})

# 3) 6 мая — «Zero» — Ульви Мамед — пол дня+экип — 10 000
s, e = d(5, 6, 9, 13)
ROWS.append({
    "_tag": "arrenda-row5",
    "vehicle_id": "sequence-zero",
    "renter_name": "Ульви Мамед",
    "start": s, "end": e,
    "total_cost": 10000,
    "duration_note": "пол дня + экип",
    "confidence": "medium",
    "note": "«пол дня» с суммой 10 000 ₽ — как записано в xlsx (возможно, с экипировкой/залогом); сумма сохранена дословно.",
})

# 4) 30 мая — Кава зелёная (Kawasaki Ninja 650) — Забалдин Артём — 3 часа — 6 000 — залог 20 000 нал
s, e = d(5, 30, 9, 12)
ROWS.append({
    "_tag": "arrenda-row12",
    "vehicle_id": "kawasaki-ex650k",
    "renter_name": "Забалдин Артём",
    "start": s, "end": e,
    "total_cost": 6000,
    "deposit_amount": 20000,
    "duration_note": "3 часа",
    "confidence": "high",
    "note": "«Кава зелёная» = Kawasaki EX650K (Ninja 650), зелёная. Оплата «Илья на карту», залог 20 000 нал, возврат залога — Илья.",
})

# 5) 5 июня — Кава зелёная — Шаронов — 1 сутки (+экип 4 000) — 10 000
s, e = d(6, 5, 9, 19)
ROWS.append({
    "_tag": "arrenda-row13",
    "vehicle_id": "kawasaki-ex650k",
    "renter_name": "Шаронов",
    "start": s, "end": e,
    "total_cost": 10000,
    "duration_note": "1 сутки + экип 4 000 ₽",
    "confidence": "high",
    "note": "Экип 4 000 ₽ учтён в metadata.ekip_rub (отдельной строки экипировки в xlsx нет).",
})

SKIPPED = [
    ("arrenda-row1", "«Zero» — Платонов Данил — 2 дн + дефект + экип — 30 000 ₽", "нет даты в xlsx"),
    ("arrenda-row2", "Зелёный Хорвин — Коля «наш Бог» — 2 часа — 2 000 ₽", "нет даты; Хорвина нет в арендном парке базы (партнёрский?)"),
    ("arrenda-row10", "Кава зелёная — слава — 4 000 ₽ — «в счёт работ»", "бартер, нет даты"),
    ("arrenda-row11", "Кава зелёная — Борский — 2 суток — 19 000 ₽ — залог 20 000/возврат 18 500 (разбил Вайвольт)", "нет даты"),
    ("arrenda-row15", "Кава зелёная — 1.5 дня — без клиента и суммы", "нет данных"),
]

# ---------------------------------------------------------------- build payload
def payload(r):
    start, end = r["start"], r["end"]
    md = {
        "source": "retro_backfill_v1",
        "renter_name": r["renter_name"],
        "duration_note": r["duration_note"],
        "history": [
            {"at": NOW, "by": "task108-retro-backfill", "status": "completed",
             "note": "retrospective insert from xlsx (pre-bot era), boss request for season stats"}
        ],
        "specs": {
            "retro_backfill_v1": {
                "origin": "Все движения по ВипБайкЭлектро 2026.xlsx, лист «Аренда»",
                "row_tag": r["_tag"],
                "mapped_from": r.get("note", ""),
                "confidence": r["confidence"],
                "backfilled_at": NOW,
                "backfilled_by": "task108 (agent, boss request: add missing rentals prior to mid-June for season stats)",
            }
        },
    }
    if r.get("deposit_amount"):
        md["deposit_method"] = "cash"
        md["deposit_note"] = "залог 20 000 ₽ наличными (Илья на карту), возврат — Илья"
    if "экип 4 000" in r["duration_note"]:
        md["ekip_rub"] = 4000
    return {
        "user_id": WALKIN_USER,
        "vehicle_id": r["vehicle_id"],
        "owner_id": WALKIN_USER,
        "status": "completed",
        "payment_status": "fully_paid",
        "total_cost": r["total_cost"],
        "requested_start_date": start,
        "requested_end_date": end,
        "agreed_start_date": start,
        "agreed_end_date": end,
        "created_at": start,
        "updated_at": NOW,
        "crew_id": CREW_VIP_BIKE,
        "deposit_amount": r.get("deposit_amount") or 0,
        "deposit_returned": bool(r.get("deposit_amount")),
        "metadata": md,
    }


def main():
    print("=== DRY RUN — rows to insert ===")
    for r in ROWS:
        p = payload(r)
        print(f"\n[{r['_tag']}] {p['vehicle_id']} | {p['requested_start_date']} .. {p['requested_end_date']}")
        print(f"    renter={r['renter_name']!r:24s} total={p['total_cost']:>7}  deposit={p['deposit_amount']}  conf={r['confidence']}")
        print(f"    note: {r['note'][:100]}")

    print("\n=== SKIPPED (awaiting .zip contracts to date them) ===")
    for tag, desc, why in SKIPPED:
        print(f"  [{tag}] {desc} — {why}")

    totals = sum(r["total_cost"] for r in ROWS)
    print(f"\nInsert total: {len(ROWS)} rows, {totals:,} ₽ + 4 000 ₽ экип (metadata)")

    if not APPLY:
        print("\nDRY RUN ONLY — run with --apply to insert.")
        return

    # safety: ensure no existing rental overlaps same vehicle+day
    print("\nChecking overlaps…")
    for r in ROWS:
        day = r["start"][:10]
        existing = rest("rentals", {
            "select": "rental_id,vehicle_id,agreed_start_date",
            "vehicle_id": f"eq.{r['vehicle_id']}",
            "agreed_start_date": f"gte.{day}T00:00:00+00:00",
        })
        clash = [x for x in existing if (x.get("agreed_start_date") or "")[:10] == day]
        if clash:
            raise SystemExit(f"OVERLAP for {r['vehicle_id']} on {day}: {clash} — abort")
    print("no overlaps, inserting…")

    inserted = []
    for r in ROWS:
        p = payload(r)
        res = rest("rentals", {"select": "rental_id"}, method="POST", body=[p],
                   prefer="return=representation")
        rid = res[0]["rental_id"] if isinstance(res, list) and res else None
        inserted.append({"tag": r["_tag"], "rental_id": rid, "total_cost": r["total_cost"]})
        print(f"  inserted [{r['_tag']}] → {rid}")

    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backfill_manifest_2026-05-06.json")
    with open(manifest_path, "w") as f:
        json.dump({"applied_at": NOW, "source": "xlsx Аренда sheet v1", "inserted": inserted,
                   "skipped": [{"tag": t, "desc": dd, "why": ww} for t, dd, ww in SKIPPED]}, f, ensure_ascii=False, indent=1)
    print(f"\nmanifest → {manifest_path}")


if __name__ == "__main__":
    main()
