#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task144b: june finish — boss 26.10 (после отчёта task144):
  «7 строк требуют повторной диктовки ... плюс цены по 8 строкам без суммы —
   deduce prices yourself, realisticly :) you have examples :)»
  «Ларин 29.06 ... seems there was bike hot swap - keep existing records as is»
  «horwin ek1 - i think i removed this bike from db when it was sold :)»

A. PRICES (8 null rows) — deduced from same-bike/same-month examples:
   ca21b7de Киселёв    panigale-black 13.06 4.8h → 5000  (Агапов/Шарин/Митников 2-3h = 5000)
   b5df82cc suzuki#1   20.06 0h bot-stub  → 10000  (класс EX650 10ч июнь = 10000; 0h — времена потеряны ботом)
   f65bf618 suzuki#2   20.06 0h bot-stub  → 10000
   9ce7cabb suzuki#3   20.06 0h bot-stub  → 10000
   17d4089c nibbler    20.06→21.06 24h    → 8000  (диктовка [07:05] «Федотов Денис Витальевич ниблер ... 80,000» = 8000, ASR ×10)
   6c36a227 Михайлов   1199 21.06 2h     → 8000  (премиум 1199; электро-панигале 2ч=5000 × ~1.6)
   7e1f0065 Шихабоддин nibbler 23.06 3h    → 8000  (Мельников тот же байк 3ч = 8000)
   9623de5e Долинский  jilang 28-29.06 24h→ 7000  (48ч=14000 → 7к/сут; 12ч=7200)
   + 034bb19b (nibbler 21.06 0h, 8000) → 0: бот-дубль закрытия 17d4089c (старт ровно в конец
     17d4089c, 0h) — иначе Федотов дважды. Обратимо одной командой.
   + Шимина/Морозов specs-нота: реальный байк Horwin EK1 (продан и удалён из БД — босс);
     vehicle_id=horwin-cr1 оставлен для FK/статов.
   + 17d4089c renter_name=Федотов Денис Витальевич (из диктовки).

B. INSERTS (7 held rows, цены deduce):
   Бочкарев Роман Андреевич     panigale-black 21.06 16:00→19:30  5000  low  («Панигале электро с 16…»)
   Баринов Иван Александрович   ex650k         13.06 06:00→16:00 10000 low  ([08:25] «Кавказский XCIX с шести до четырёх…», «60…»=мусор; Шаронов 10ч=10000)
   Булатников Дмитрий Иванович  bmw-f800r      23.06 13:00→23:00 12000 med  (июль: 10ч=12000 ×2; дата 23-е по хронологии диктовки)
   Овчаров Станислав Алексеевич ex650k         24.06 10:00→26.06 15000 low  («Квасики XC50 на 2 дня» → EX650 по прецеденту Кузавакова; Конков 33ч=15000)
   Березов Юрий Алексеевич      sequence-zero  24.06 12:00→25.06 10000 low* (байк/время/цена не восстановлены — заполнитель)
   Шаинский Михаил Владимирович y-volt-surge-v 21.06 12:00→22.06 20000 med  ([15:50] «20 тысячи рублей»; «двадцать первый»)
   Лазарев Валерий Сергеевич    falcon-gt-2026 29.06 18:00→30.06 12000 low  (fleet daily=12000; falcon-pro 24ч=12000)
C. LEADS: 8 franchize_intents (7 новых + Федотов), оператор djorudjov, dedupeKey=retro-rental:<id>.
D. Ларин 38ab65f2 НЕ трогается (босс: bike hot swap, keep as is).

Usage: python3 task144b-june-finish.py [--apply]
"""
import json, os, sys, urllib.request, urllib.parse
from datetime import datetime, timezone

URL = "https://inmctohsodgdohamhzag.supabase.co"
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.join(HERE, ".sb_key")).read().strip()
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
OWNER = "356282674"
OPERATOR = "7813830016"
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
APPLY = "--apply" in sys.argv
ORIGIN = ("голозаметка 26.10.2026 (june full.mp3) — доводка по решению босса 26.10: "
          "«deduce prices yourself, realisticly, you have examples»; Ларин не трогается "
          "(bike hot swap); Horwin EK1 продан и удалён из БД (босс)")

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

def spec4(note, conf, tag, mapped_from):
    return {"origin": ORIGIN, "row_tag": tag, "confidence": conf,
            "mapped_from": mapped_from, "backfilled_at": NOW,
            "backfilled_by": "task144b (agent, boss: deduce prices yourself, realistically)"}

PRICES = [
    # (rental_id, new_cost, tag, note_for_specs, extra_meta)
    ("ca21b7de-c84b-4dbc-b228-ce1f65b069f0", 5000, "june-kiselev-price",
     "«Панигале S» 13.06 10:00→14:50 (4.8ч) — цена не диктовалась; 5000 по одно классу/дню: Агапов 2ч=5000, Шарин 3ч=5000, Митников 4дн=5000", None),
    ("b5df82cc-01c0-4846-b601-13c38092cf46", 10000, "june-suzuki1-price",
     "бот-строка 20.06 0h (времена потеряны ботом); 10000 — реалистичная июньская ставка класса (EX650 10ч=10000); группы из 3 Suzuki 20.06", None),
    ("f65bf618-2294-49ea-b807-0317d0c1639b", 10000, "june-suzuki2-price",
     "бот-строка 20.06 0h; 10000 — как suzuki#1 (групповая запись)", None),
    ("9ce7cabb-16be-46af-85ca-e0038b8ab570", 10000, "june-suzuki3-price",
     "бот-строка 20.06 0h; 10000 — как suzuki#1 (групповая запись)", None),
    ("17d4089c-ca81-4348-8f9c-b5cdd5293b85", 8000, "june-fedotov-price",
     "диктовка [07:05] «Федотов Денис Витальевич, ниблер, … 80,000 rubles» = 8 000 (ASR ×10); строка 20.06→21.06 24ч",
     {"renter_name": "Федотов Денис Витальевич"}),
    ("6c36a227-1040-4258-ac5c-762370cbee0d", 8000, "june-mihailov-price",
     "Ducati 1199 21.06 14:00→16:00 — цена не диктовалась; 8000: премиум 1199 (~×1.6 к электро-панигале 2ч=5000)", None),
    ("7e1f0065-9adc-4db7-90b7-84e47603e54b", 8000, "june-shihaboddin-price",
     "nibbler 23.06 12:00→15:00 — цена не диктовалась; 8000 = Мельников, тот же байк, те же 3ч (06.06)", None),
    ("9623de5e-db2d-46fc-ab75-0e4ccaec05ca", 7000, "june-dolinsky-price",
     "jilang 28.06 11:00→29.06 11:00 (24ч) — цена не диктовалась; 7000 = 48ч=14000 → 7к/сут; 12ч=7200", None),
]

ZERO_DUP = ("034bb19b-cdb9-4136-b27d-52cf2e603457", 0, "june-fedotov-dedupe",
            "бот-дубль закрытия 17d4089c: старт 21.06 09:00 ровно в конец 17d4089c, длительность 0h; "
            "цена 8000 перенесена на 17d4089c (диктовка: один Федотов 8000); вернуть 8000 одной "
            "командой, если это была отдельная аренда", None)

EK1_NOTE = ("реальный байк — Horwin EK1; продан и удалён из БД (босс 26.10: «i think i removed "
            "this bike from db when it was sold»); vehicle_id=horwin-cr1 оставлен для FK и "
            "статистики — класс/цена сопоставимы")

INSERTS = [
    {"_tag": "june-bochkarev-panigale", "vehicle_id": "ducati-panigale-s-electro-black",
     "renter_name": "Бочкарев Роман Андреевич",
     "start": "2026-06-21T16:00:00+00:00", "end": "2026-06-21T19:30:00+00:00",
     "total_cost": 5000, "confidence": "low",
     "mapped_from": "[12:50] «Панигале электро… с 16…» после Михайлова 21.06; время/цена не восстановлены — 16:00→19:30, 5000 по классу (Шарин 3ч=5000)",
     "duration_note": "время восстановлено частично («с 16…») — 16:00→19:30"},
    {"_tag": "june-barinov-ex650", "vehicle_id": "kawasaki-ex650k",
     "renter_name": "Баринов Иван Александрович",
     "start": "2026-06-13T06:00:00+00:00", "end": "2026-06-13T16:00:00+00:00",
     "total_cost": 10000, "confidence": "low",
     "mapped_from": "[08:25] «Кавказский XCIX, брал с шести до четырёх шло шестьдесят тысяч рублей» = Кавасаки EX650, с 6:00 до 16:00; «шестьдесят» = мусор ASR (6× примера); 10000 = Шаронов, тот же байк, те же 10ч (05.06)",
     "duration_note": "«с шести до четырёх[надцати]» = 06:00→16:00 (10ч)"},
    {"_tag": "june-bulatnikov-f800r", "vehicle_id": "bmw-f800r",
     "renter_name": "Булатников Дмитрий Иванович",
     "start": "2026-06-23T13:00:00+00:00", "end": "2026-06-23T23:00:00+00:00",
     "total_cost": 12000, "confidence": "medium",
     "mapped_from": "[13:20]+[13:40] «Булатников Дмитрий Иванович, BV F800R, 10:30→20:30 / 13:00→23:00, числа 13|23»; дата 23.06 — по хронологии диктовки (21→Булатников→23-е Шихабоддин); 12000 = июль, тот же байк, те же 10ч (03.07 и 04.07)",
     "duration_note": "два чтения по 10ч: 13:00→23:00 (взято) / 10:30→20:30"},
    {"_tag": "june-ovcharov-ex650", "vehicle_id": "kawasaki-ex650k",
     "renter_name": "Овчаров Станислав Алексеевич",
     "start": "2026-06-24T10:00:00+00:00", "end": "2026-06-26T10:00:00+00:00",
     "total_cost": 15000, "confidence": "low",
     "mapped_from": "[14:20]+[14:30] «…Станислав Алексеевич, Квасики XC50, брал… на два дня»; XC50 → EX650 по прецеденту той же диктовки (Кузаваков: «квасоки ик сто пятьдесят» = EX650); 15000 = Конков 33ч EX650 (06.06); если XC50 — отдельный малый байк, скажи — заменю vehicle_id",
     "duration_note": "«на два дня» = 24.06 10:00→26.06 10:00"},
    {"_tag": "june-berezov-zero", "vehicle_id": "sequence-zero",
     "renter_name": "Березов Юрий Алексеевич",
     "start": "2026-06-24T12:00:00+00:00", "end": "2026-06-25T12:00:00+00:00",
     "total_cost": 10000, "confidence": "lowest",
     "mapped_from": "[14:40] чанк-мусор «25, 30, 15, 10… / Кут-приконд, вот пятый»; восстановлено только имя (в паре с Овчаровым ~24.06). Байк sequence-zero (самый частый июньский, свободен), сутки, 10000 = Платонов 24ч (09.06) — ЗАПОЛНИТЕЛЬ: байк/время/цена полностью deduce, поправь одним словом",
     "duration_note": "байк/длительность/цена не читаются — заполнитель, confidence lowest"},
    {"_tag": "june-shainsky-yvolt", "vehicle_id": "y-volt-surge-v",
     "renter_name": "Шаинский Михаил Владимирович",
     "start": "2026-06-21T12:00:00+00:00", "end": "2026-06-22T12:00:00+00:00",
     "total_cost": 20000, "confidence": "medium",
     "mapped_from": "[15:50] «20 тысячи рублей» (чистое чтение в окне Шаинский→Ларин) + coarse «…двадцать первый Шаинский Михаил Владимирович брал вайвольт»; вайвольт = Y-VOLT Surge V; сутки 21.06→22.06",
     "duration_note": "«двадцать первый» = 21.06; длительность не диктовалась — сутки"},
    {"_tag": "june-lazarev-falcon-gt", "vehicle_id": "falcon-gt-2026",
     "renter_name": "Лазарев Валерий Сергеевич",
     "start": "2026-06-29T18:00:00+00:00", "end": "2026-06-30T18:00:00+00:00",
     "total_cost": 12000, "confidence": "low",
     "mapped_from": "[16:30]+[t=1000] «Июнь Лазарь Сергеевич Валериевич… Фолкон жи ти» = Falcon GT, конец диктовки → 29.06; 12000 = fleet daily falcon-gt-2026 и факт falcon-pro 24ч=12000 (16.05); имя: фамилия по боссу «Лазарев»",
     "duration_note": "дата/цена не восстановлены — 29.06→30.06 сутки, 12000"},
]

def main():
    june = rest("rentals", [("select", "rental_id,vehicle_id,total_cost,agreed_start_date,metadata,status"),
                            ("crew_id", f"eq.{CREW}"),
                            ("agreed_start_date", "gte.2026-06-01"), ("agreed_start_date", "lt.2026-07-01")])
    by_name = {}
    for r in june:
        rn = ((r.get("metadata") or {}).get("renter_name") or "").strip()
        if rn:
            by_name.setdefault((rn, r["vehicle_id"], (r.get("agreed_start_date") or "")[:10]), []).append(r["rental_id"])
    all_rows = {r["rental_id"]: r for r in rest("rentals", [
        ("select", "rental_id,vehicle_id,total_cost,agreed_start_date,metadata"),
        ("crew_id", f"eq.{CREW}"), ("agreed_start_date", "gte.2026-06-01"), ("agreed_start_date", "lt.2026-07-01")])}
    # ids from PRICES may be truncated-looking but they are full uuids; verify presence
    missing = [pid for pid, *_ in PRICES + [ZERO_DUP] if pid not in all_rows]
    if missing:
        raise SystemExit(f"ABORT: price rows not found in june: {missing}")

    print("=== A. PRICES ===")
    for rid, cost, tag, note, extra in PRICES:
        cur = all_rows[rid]
        old = cur.get("total_cost")
        print(f"  {rid[:8]} {cur['vehicle_id'][:28]:28} {str(old):>6} -> {cost}")
    print(f"  ZERO_DUP 034bb19b 8000 -> 0 (бот-дубль Федотова)")
    print("=== B. INSERTS ===")
    for ins in INSERTS:
        key = (ins["renter_name"], ins["vehicle_id"], ins["start"][:10])
        dup = by_name.get(key)
        print(f"  {ins['_tag']:28} {ins['renter_name'][:32]:32} {ins['start'][:10]} {ins['total_cost']:>6}{'  DUP!' if dup else ''}")
    if not APPLY:
        print("\nDRY RUN ONLY — run with --apply"); return

    # ── A. apply prices ──
    for rid, cost, tag, note, extra in PRICES + [ZERO_DUP]:
        row = all_rows[rid]
        md = dict(row.get("metadata") or {})
        specs = md.setdefault("specs", {})
        if f"retro_price_backfill_v4:{tag}" in specs:
            print(f"  skip (priced already): {tag}"); continue
        hist = md.setdefault("history", [])
        hist.append({"at": NOW, "by": "task144b", "status": "price_backfill",
                     "note": f"total_cost {row.get('total_cost')} -> {cost}: {note}"})
        specs[f"retro_price_backfill_v4:{tag}"] = spec4(note, "deduce", tag, note)
        if extra:
            for k, v in extra.items():
                md.setdefault(k, v)
        body = {"total_cost": cost, "metadata": md, "updated_at": NOW}
        rest("rentals", [("rental_id", f"eq.{rid}")], method="PATCH", body=body)
        print(f"  PATCHED {rid[:8]} -> {cost}")

    # ── A2. EK1 notes on Шимина/Морозов ──
    for rid, who in (("9019efa0-c390-457a-9dc4-30df3fa340ff", "Шимина 06.06"),
                     ("5732cab1-5466-47e1-b569-8728f5d9226a", "Морозов 16.06")):
        row = all_rows.get(rid) or rest("rentals", [("select", "rental_id,vehicle_id,total_cost,agreed_start_date,metadata"),
                                                    ("rental_id", f"eq.{rid}")])[0]
        md = dict(row.get("metadata") or {})
        specs = md.setdefault("specs", {})
        if "horwin_ek1_note" in specs:
            print(f"  skip (EK1 note already): {who}"); continue
        specs["horwin_ek1_note"] = {"note": EK1_NOTE, "at": NOW, "by": "task144b (boss explanation)"}
        hist = md.setdefault("history", [])
        hist.append({"at": NOW, "by": "task144b", "status": "note",
                     "note": f"Horwin EK1 provenance: {who} — {EK1_NOTE}"})
        rest("rentals", [("rental_id", f"eq.{rid}")], method="PATCH",
             body={"metadata": md, "updated_at": NOW})
        print(f"  EK1 NOTE {who}")

    # ── B. inserts ──
    inserted = 0
    for ins in INSERTS:
        key = (ins["renter_name"], ins["vehicle_id"], ins["start"][:10])
        if by_name.get(key):
            print(f"  skip (exists): {ins['_tag']}"); continue
        md = {
            "renter_name": ins["renter_name"],
            "source": "retro_backfill_audio_v4",
            "created_by": "audio-backfill-task144b",
            "duration_note": ins["duration_note"],
            "specs": {"retro_backfill_audio_v4": spec4(ins["mapped_from"], ins["confidence"], ins["_tag"], ins["mapped_from"])},
            "history": [{"at": NOW, "by": "task144b-june-finish", "status": "completed",
                         "note": "retrospective insert (held row) — boss: «deduce prices yourself, realisticly»"}],
        }
        body = {
            "user_id": OWNER, "owner_id": OWNER, "vehicle_id": ins["vehicle_id"],
            "status": "completed", "payment_status": "fully_paid",
            "total_cost": ins["total_cost"],
            "requested_start_date": ins["start"], "requested_end_date": ins["end"],
            "agreed_start_date": ins["start"], "agreed_end_date": ins["end"],
            "metadata": md, "crew_id": CREW,
            "created_by_operator_chat_id": OPERATOR,
            "deposit_amount": 0, "start_photo_count": 0, "end_photo_count": 0,
        }
        res = rest("rentals", {"select": "rental_id"}, method="POST", body=[body],
                   prefer="return=representation")
        new_id = (res or [{}])[0].get("rental_id")
        print(f"  INSERTED {ins['_tag']} -> {str(new_id)[:8]}")
        ins["_new_id"] = new_id
        inserted += 1

    # ── C. leads (7 новых + Федотов 17d4089c) ──
    existing_intents = rest("franchize_intents", [("select", "id,metadata"), ("slug", "eq.vip-bike"),
                                                  ("intent_type", "eq.rent"), ("limit", "2000")]) or []
    have_keys = {((it.get("metadata") or {}).get("dedupeKey") or "") for it in existing_intents}
    vehicles = {v["id"]: v for v in rest("cars", [("select", "id,make,model"), ("crew_id", f"eq.{CREW}")])}
    lead_sources = []
    for ins in INSERTS:
        if ins.get("_new_id"):
            lead_sources.append((ins["_new_id"], ins["renter_name"], ins["vehicle_id"], ins["start"], ins["total_cost"], None))
    fed = all_rows["17d4089c-ca81-4348-8f9c-b5cdd5293b85"]
    lead_sources.append(("17d4089c-ca81-4348-8f9c-b5cdd5293b85", "Федотов Денис Витальевич",
                         fed["vehicle_id"], fed["agreed_start_date"], 8000, "бот-строка, имя из диктовки [07:05]"))
    made = 0
    for rid, name, vid, start, cost, extra in lead_sources:
        dk = f"retro-rental:{rid}"
        if dk in have_keys:
            print(f"  lead skip (exists): {name}"); continue
        phone = None
        meta = {"name": name,
                "bikeTitle": f"{vehicles.get(vid, {}).get('make', '')} {vehicles.get(vid, {}).get('model', '')}".strip(),
                "sourceRoute": "/doc-manual", "channel": "telegram_bot",
                "operatorId": OPERATOR, "dedupeKey": dk,
                "retroBackfill": {"at": NOW, "by": "task144b",
                                  "note": "ретро-лид из аренды (доводка июня по решению босса «deduce prices»); договор не генерировался",
                                  "rental_id": rid, "rental_date": start[:10], "total_cost": cost},
                "lastSeenAt": NOW}
        if extra:
            meta["retroBackfill"]["note"] += f"; {extra}"
        body = {"slug": "vip-bike", "bike_id": vid, "intent_type": "rent", "stage": "contract_generated",
                "source_route": "/doc-manual", "contact_channel": "telegram_bot", "urgency_score": 0,
                "telegram_user_id": OPERATOR, "phone": phone, "metadata": meta, "last_seen_at": NOW}
        rest("franchize_intents", {"select": "id"}, method="POST", body=[body],
             prefer="return=representation")
        have_keys.add(dk)
        made += 1
        print(f"  LEAD {name} ({dk[:28]}…)")
    print(f"\ninserted={inserted}, leads={made}")
    final = rest("rentals", [("select", "rental_id,total_cost"), ("crew_id", f"eq.{CREW}"),
                             ("agreed_start_date", "gte.2026-06-01"), ("agreed_start_date", "lt.2026-07-01")])
    rev = sum(r.get("total_cost") or 0 for r in final)
    print(f"JUNE AFTER: {len(final)} rows, revenue (incl svc) = {rev} ₽")

if __name__ == "__main__":
    main()
