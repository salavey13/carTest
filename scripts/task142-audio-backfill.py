#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task142: audio-backfill of the two April rentals that task108 SKIPPED for lack of dates
(xlsx «Все движения по ВипБайкЭлектро 2026.xlsx», лист «Аренда», rows 1-2).
Boss recorded a voice note on 26.10.2026 (april2renttest.mp3 + 4tgmay2rent.mp3):
april file dates row1 (14 апреля) and row2 (20 апреля); may file re-dictates rows 3-4
which task108 ALREADY inserted (dedupe check, no inserts needed here).

  arrenda-row1: «Zero» — Платонов Даниил Александрович — 14 апреля, 2 дня — 30 000 ₽
                (xlsx: «2 дн + дефект + экип — 30 000» — money cross-confirmed by ASR «30,000 rubles»)
  arrenda-row2: Зелёный Хорвин — Коля «наш Бог» — 20 апреля, 2 часа — 2 000 ₽
                (ASR heard «арендатор Колясок»; xlsx calls him Коля «наш Бог».
                 Recorded as a SERVICE record (vip-bike-svc-001 «Нормо-час», ровно 2 000 ₽)
                 per boss's explicit «add service records from respective audio»; the green
                 Horwin is not in the rental fleet (sold, hidden). If it was actually a
                 rental/trial — one UPDATE vehicle_id → horwin-cr1 converts it.)

source=retro_backfill_audio_v1, full provenance in metadata.specs. Walk-in pattern:
user_id=owner_id=356282674 (same as task108). Idempotent: re-run detects its own rows.

Usage: python3 task142-audio-backfill.py [--apply]
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

URL = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sb_key")).read().strip()
CREW_VIP_BIKE = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
WALKIN_USER = "356282674"
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")

APPLY = "--apply" in sys.argv


def rest(table, params, method="GET", body=None, prefer=None):
    # params: list of (k, v) tuples — PostgREST often needs the same key twice (gte+lt);
    # plain dict also accepted (single-key cases like {"select": ...})
    import urllib.parse
    items = params.items() if isinstance(params, dict) else params
    qs = "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(v, safe='')}" for k, v in items) if params else ""
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


ROWS = [
    {
        "_tag": "arrenda-row1-dated",
        "kind": "rental",
        "vehicle_id": "sequence-zero",
        "renter_name": "Платонов Даниил Александрович",
        "start": "2026-04-14T09:00:00+00:00",
        "end": "2026-04-16T09:00:00+00:00",
        "total_cost": 30000,
        "duration_note": "2 дня + дефект + экип (xlsx); в голосовой заметке «на два дня»",
        "confidence": "high",
        "note": (
            "task108 SKIPPED arrenda-row1 («Zero» — Платонов Данил — 2 дн + дефект + экип — 30 000 ₽) "
            "из-за отсутствия даты. Голозаметка 26.10.2026 даёт дату 14 апреля и подтверждает сумму "
            "(ASR: «30,000 rubles»; xlsx: 30 000). Sequence Zero — единственный Zero в арендном парке; "
            "30 000 ₽ за 2 дня согласуется с ранней сезонной ценой (в мае Zero уже 10 000 за полдня)."
        ),
    },
    {
        "_tag": "arrenda-row2-dated",
        "kind": "service",
        "vehicle_id": "vip-bike-svc-001",
        "service_name": "Нормо-час",
        "client": "Коля «наш Бог»",
        "start": "2026-04-20T09:00:00+00:00",
        "end": "2026-04-20T11:00:00+00:00",
        "total_cost": 2000,
        "duration_note": "2 часа",
        "confidence": "medium",
        "note": (
            "task108 SKIPPED arrenda-row2 («Зелёный Хорвин — Коля «наш Бог» — 2 часа — 2 000 ₽») — "
            "нет даты, Хорвина нет в арендном парке. Голозаметка 26.10.2026 даёт дату 20 апреля "
            "(ASR: «арендатор Колясок взял зелёный хорвен две тысячи рублей на два часа»). "
            "Записано как СЕРВИС (Нормо-час 2 000 ₽ ровно) по прямому указанию босса «add service records "
            "from respective audio»; зелёный Horwin — не из арендного парка (продан/скрыт). "
            "Если это была аренда/тест-райд — конвертация одним UPDATE: vehicle_id → horwin-cr1."
        ),
    },
]


def payload(r):
    if r["kind"] == "service":
        md = {
            "source": "service_work",
            "created_by": "audio-backfill",
            "bike": "зелёный Horwin (не из арендного парка базы)",
            "client": r["client"],
            "service_name": r["service_name"],
            "performed_at": r["end"],
            "history": [
                {"at": NOW, "by": "task142-audio-backfill", "status": "completed",
                 "note": "retrospective service record from xlsx row2 + boss voice note (26.10.2026)"}
            ],
            "specs": {
                "retro_backfill_audio_v1": {
                    "origin": "xlsx лист «Аренда» arrenda-row2 + голозаметка 26.10.2026 (april2renttest.mp3, ASR)",
                    "row_tag": r["_tag"],
                    "mapped_from": r["note"],
                    "confidence": r["confidence"],
                    "backfilled_at": NOW,
                    "backfilled_by": "task142 (agent, boss request: date the task108-skipped rows for season stats)",
                }
            },
        }
        return {
            "user_id": WALKIN_USER,
            "vehicle_id": r["vehicle_id"],
            "owner_id": WALKIN_USER,
            "status": "completed",
            "payment_status": "fully_paid",
            "total_cost": r["total_cost"],
            "requested_start_date": r["start"],
            "requested_end_date": r["end"],
            "agreed_start_date": r["start"],
            "agreed_end_date": r["end"],
            "created_at": r["start"],
            "updated_at": NOW,
            "crew_id": CREW_VIP_BIKE,
            "deposit_amount": 0,
            "deposit_returned": False,
            "metadata": md,
        }
    md = {
        "source": "retro_backfill_audio_v1",
        "renter_name": r["renter_name"],
        "duration_note": r["duration_note"],
        "history": [
            {"at": NOW, "by": "task142-audio-backfill", "status": "completed",
             "note": "retrospective insert: xlsx row1 dated by boss voice note 26.10.2026 (pre-bot era)"}
        ],
        "specs": {
            "retro_backfill_audio_v1": {
                "origin": "xlsx лист «Аренда» arrenda-row1 + голозаметка 26.10.2026 (april2renttest.mp3, ASR)",
                "row_tag": r["_tag"],
                "mapped_from": r["note"],
                "confidence": r["confidence"],
                "backfilled_at": NOW,
                "backfilled_by": "task142 (agent, boss request: date the task108-skipped rows for season stats)",
            }
        },
    }
    return {
        "user_id": WALKIN_USER,
        "vehicle_id": r["vehicle_id"],
        "owner_id": WALKIN_USER,
        "status": "completed",
        "payment_status": "fully_paid",
        "total_cost": r["total_cost"],
        "requested_start_date": r["start"],
        "requested_end_date": r["end"],
        "agreed_start_date": r["start"],
        "agreed_end_date": r["end"],
        "created_at": r["start"],
        "updated_at": NOW,
        "crew_id": CREW_VIP_BIKE,
        "deposit_amount": 0,
        "deposit_returned": False,
        "metadata": md,
    }


def month_totals():
    rows = rest("rentals", [
        ("select", "vehicle_id,total_cost,requested_start_date"),
        ("crew_id", f"eq.{CREW_VIP_BIKE}"),
        ("requested_start_date", "gte.2026-04-01T00:00:00+00:00"),
        ("requested_start_date", "lt.2026-11-01T00:00:00+00:00"),
    ])
    months = {}
    for x in rows:
        m = (x.get("requested_start_date") or "")[:7]
        if not m:
            continue
        svc = (x.get("vehicle_id") or "").startswith("vip-bike-svc")
        d = months.setdefault(m, {"rentals": 0, "service": 0, "rental_rub": 0, "service_rub": 0})
        if svc:
            d["service"] += 1
            d["service_rub"] += x.get("total_cost") or 0
        else:
            d["rentals"] += 1
            d["rental_rub"] += x.get("total_cost") or 0
    return months


def main():
    print("=== DRY RUN — rows to insert ===")
    for r in ROWS:
        p = payload(r)
        print(f"\n[{r['_tag']}] kind={r['kind']} | {p['vehicle_id']} | {p['requested_start_date']} .. {p['requested_end_date']}")
        who = r.get("renter_name") or r.get("client")
        print(f"    who={who!r}  total={p['total_cost']:>6}  conf={r['confidence']}")

    print("\n=== idempotency check (existing task142 rows?) ===")
    existing = rest("rentals", [
        ("select", "rental_id,vehicle_id,requested_start_date,metadata"),
        ("crew_id", f"eq.{CREW_VIP_BIKE}"),
        ("requested_start_date", "gte.2026-04-01T00:00:00+00:00"),
        ("requested_start_date", "lt.2026-05-01T00:00:00+00:00"),
    ])
    dupes = [x for x in existing
             if "retro_backfill_audio_v1" in (x.get("metadata") or {}).get("source", "")
             or "retro_backfill_audio_v1" in ((x.get("metadata") or {}).get("specs") or {})]
    if dupes:
        print(f"  ALREADY INSERTED ({len(dupes)} rows) — nothing to do:")
        for x in dupes:
            print(f"    {x['rental_id']} {x['vehicle_id']} {x['requested_start_date']}")
        return

    print("\n=== April before: ===")
    for m, d in sorted(month_totals().items()):
        print(f"  {m}: rentals={d['rentals']:>3} ({d['rental_rub']:>9,} ₽)  service={d['service']:>2} ({d['service_rub']:>7,} ₽)")

    if not APPLY:
        print("\nDRY RUN ONLY — run with --apply to insert.")
        return

    # safety: no overlapping same-vehicle rental on the same day
    print("\nChecking overlaps…")
    for r in ROWS:
        day = r["start"][:10]
        existing = rest("rentals", [
            ("select", "rental_id,vehicle_id,agreed_start_date"),
            ("vehicle_id", f"eq.{r['vehicle_id']}"),
            ("agreed_start_date", f"gte.{day}T00:00:00+00:00"),
            ("agreed_start_date", f"lte.{day}T23:59:59+00:00"),
        ])
        if existing:
            raise SystemExit(f"OVERLAP for {r['vehicle_id']} on {day}: {existing} — abort")
    print("no overlaps, inserting…")

    inserted = []
    for r in ROWS:
        p = payload(r)
        res = rest("rentals", {"select": "rental_id"}, method="POST", body=[p],
                   prefer="return=representation")
        rid = res[0]["rental_id"] if isinstance(res, list) and res else None
        inserted.append({"tag": r["_tag"], "rental_id": rid, "vehicle_id": r["vehicle_id"],
                         "total_cost": r["total_cost"]})
        print(f"  inserted [{r['_tag']}] → {rid}")

    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "task142-audio-backfill-manifest.json")
    with open(manifest_path, "w") as f:
        json.dump({"applied_at": NOW, "source": "boss voice note 26.10.2026 (april2renttest.mp3 + 4tgmay2rent.mp3, ASR)",
                   "inserted": inserted,
                   "dedupe_check": {"may4_ducati_konyakhin": "already in DB (task108 retro_backfill_v1)",
                                     "may4_sequence_zero": "already in DB (task108 retro_backfill_v1, renter unknown)"}},
                  f, ensure_ascii=False, indent=1)
    print(f"\nmanifest → {manifest_path}")

    print("\n=== April after: ===")
    for m, d in sorted(month_totals().items()):
        print(f"  {m}: rentals={d['rentals']:>3} ({d['rental_rub']:>9,} ₽)  service={d['service']:>2} ({d['service_rub']:>7,} ₽)")


if __name__ == "__main__":
    main()
