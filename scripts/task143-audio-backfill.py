#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task143: continuation of the audio backfill (boss voice notes 24.10 + 26.10.2026):
  1) may rentals missing in DB (popki.mp3 + may.mp3) — 5 inserts + 1 UPDATE (поправка 9000₽)
  2) service records from «24 окт. service final.mp3» — the Sep 6→30 tail that the
     bot-era service-work rows (svc-001..048, stop at 09-04) never received.

Pipeline identical to task142: ASR (mp3→ffmpeg 16k mono wav→25s+10s chunks, 429 backoff)
→ decode via DB dictionaries (fleet vehicle_ids, renter names, svc row patterns)
→ walk-in payload (user_id=owner_id=356282674, completed/fully_paid, full provenance).
Idempotent: re-run detects its own rows via metadata.specs.retro_backfill_audio_v2.

Usage: python3 task143-audio-backfill.py [--apply]
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
ORIGIN_RENT = ("голозаметки 26.10.2026 (26 окт. 17.48 popki.mp3 + 26 окт. 17.51 may.mp3, ASR) "
               "— продолжение диктовки майских аренд")
ORIGIN_SVC = ("голозаметка 24.10.2026 (24 окт. 15.05 service final.mp3, ASR) — финальная диктовка "
              "сервисных работ; в БД ботовые строки source=service_work остановились на 09-04")


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


# ----------------------------------------------------------------------------
# RENTALS (popki.mp3 + may.mp3) — new May rows not present in DB/task108/xlsx
# ----------------------------------------------------------------------------
RENTALS = [
    {
        "_tag": "may-rental-ryzhov-nibbler",
        "vehicle_id": "nibbler-regumoto-4v",
        "renter_name": "Рыжов Александр Алексеевич",
        "renter_phone": None,
        "start": "2026-05-15T08:00:00+00:00",
        "end": "2026-05-16T08:00:00+00:00",
        "total_cost": 10000,
        "duration_note": "сутки: «с пятнадцатого по шестнадцатое мая, с 8 до 8» (popki, чисто)",
        "confidence": "high",
        "note": ("popki.mp3 первый ряд: «Рыжов Александр Алексеевич, Орегон Мото, Книбер, брал на сутки "
                 "10 тысяч с 15-го по 16-е мая с 8 до 8». Декод: «Орегон Мото» = РегульМото (парковый "
                 "nibbler-regumoto-4v, x14 аренд в сезоне), «Книбер» = Ниббер. 10 000 за сутки согласуется "
                 "с сезонными ценами Ниббера (июль-сентябрь: 2 250–15 000)."),
    },
    {
        "_tag": "may-rental-platonov-falcon-pro",
        "vehicle_id": "falcon-pro-2026",
        "renter_name": "Платонов Даниил Александрович",
        "renter_phone": None,
        "start": "2026-05-16T09:00:00+00:00",
        "end": "2026-05-17T09:00:00+00:00",
        "total_cost": 12000,
        "duration_note": "сутки 16-го мая («с 5 до 5» в обоих файлах; may.mp3 ещё слышит «с 8» — часы ретро, "
                         "в статистику идёт дата 16.05",
        "confidence": "high",
        "note": ("ОБА файла согласуются: popki («вторая… Платонов Даниил Александрович, Фалкон Про, "
                 "с 5 до 5 — 12 000») + may («шестнадцатого мая на сутки… Falcon Pro двенадцать тысяч "
                 "рублей Платонов Данил Александрович»). В БД на 16.05 есть только Калинин falcon-pro 0₽ "
                 "(ботовая строка) — другой клиент, не дубль. Клиент уже в БД (april: Zero 14-16.04 30 000)."),
    },
    {
        "_tag": "may-rental-kirdzintsev-zero",
        "vehicle_id": "sequence-zero",
        "renter_name": "Кирдзинцев",
        "renter_phone": None,
        "start": "2026-05-17T08:30:00+00:00",
        "end": "2026-05-17T20:30:00+00:00",
        "total_cost": 6000,
        "duration_note": "с 8:30 до 20:30 (12 часов, «на секунзеру»)",
        "confidence": "high",
        "note": ("may.mp3: «семнадцатого мая Кирдзинцев с 8:30 до 20:30 на секунзеру. Цена шесть тысяч» "
                 "(цена в начале следующего чанка). Имя/отчество не продиктованы — только фамилия "
                 "(ASR: «Киргинцев»/«Кирдзинцев»). 6 000 за длинный день Zero согласуется с 10 000 сутки."),
    },
    {
        "_tag": "may-rental-mitrofanov-falcon-gt",
        "vehicle_id": "falcon-gt-2026",
        "renter_name": "Митрофанов Руслан Владимирович",
        "renter_phone": "89203373780",
        "start": "2026-05-18T18:30:00+00:00",
        "end": "2026-05-18T19:30:00+00:00",
        "total_cost": 0,
        "duration_note": "1 час: с 18:30 до 19:30 («на один час»); при добавлении телефона босс сказал "
                         "«Надимович» — оставлено отчество из основной диктовки",
        "confidence": "high",
        "note": ("may.mp3: «восемнадцатого мая Митрофанов Руслан Владимирович Фалкон GT с 18:30 до 19:30 "
                 "на один час. Цена — бесплатно» (тест-райд). Телефон из той же диктовки: 8-920-337-37-80. "
                 "Falcon GT в мае в БД вообще нет — первая строка."),
    },
    {
        "_tag": "may-rental-germavaev-zero",
        "vehicle_id": "sequence-zero",
        "renter_name": "Гермаваев Артем Олегович",
        "renter_phone": "89209048804",
        "start": "2026-05-23T14:00:00+00:00",
        "end": "2026-05-23T17:00:00+00:00",
        "total_cost": 2000,
        "duration_note": "с 2 до 5 (14:00–17:00, 3 часа)",
        "confidence": "medium",
        "note": ("may.mp3: «23 мая Гермаваев Артем Олегович, секунзера, с 2 до 5, цена 2 000» + телефон. "
                 "ASR разошёлся по ФИО (25с: «Гермаваев Артем Олегович», 10с: «Гермава Игорь Артемович») — "
                 "взято чтение 25с-чанка. Телефон: 10с-нарезка «+89209 04 88 04» → 8-920-904-88-04 "
                 "(25с-нарезка слышала «…904 68 84» — последняя пара цифр спорна)."),
    },
]

# UPDATE: поправка из may.mp3 («поправка: там двадцать за сутки, а вот это на самом деле — 9000»)
# к ретро-строке 3f24ff4b (Стерлягов, Sequence Zero, 09.05, договор 9-05/1, 1 сутки, залог 20 000
# уже в specs; total_cost был null — сумма в договоре не зафиксирована).
UPDATE_ROW = {
    "rental_id": "3f24ff4b-4422-4e5a-80e2-18266ed66f4e",
    "total_cost": 9000,
    "history_note": ("total_cost null→9000: поправка босса из голозаметки 26.10.2026 (may.mp3) — "
                     "«поправка: там двадцать [залог] за сутки, а вот это на самом деле 9 000 рублей»"),
}

# ----------------------------------------------------------------------------
# SERVICES («24 окт. 15.05 service final.mp3») — Sep 6→30 tail, NOT in DB.
# vehicle_id continues the vip-bike-svc-NNN pseudo-series (max existing = 048).
# ----------------------------------------------------------------------------
SERVICES = [
    # -- 5-6 сентября (между 04.09 y-volt/мотард и «седьмого сентября») --
    {"tag": "svc-049", "date": "2026-09-06", "vehicle": "nibbler-regumoto-4v", "price": 1250,
     "name": "Чистка, смазка и подтяжка цепи", "conf": "medium",
     "note": "«ниблер прокатный: чистка, смазка, подтяжка цепи — 1250»; дата 5–6.09 (диктовка до «седьмого сентября»)"},
    {"tag": "svc-050", "date": "2026-09-06", "vehicle": "yamaha-r6-2007", "price": 250,
     "name": "Мойка", "conf": "low",
     "note": "«имаха шесть прокатная: мойка — 250 и 100 за мойку»; отдельно упомянута «протирка 100» — объект неясен, в сумму не включено"},
    # -- 7 сентября --
    {"tag": "svc-051", "date": "2026-09-07", "vehicle": "ducati-panigale-s-electro-red", "price": 1250,
     "name": "Сборка байка", "conf": "high",
     "note": "«седьмого сентября: сборка дукати электрик — 1250, красный»"},
    # -- 8 сентября --
    {"tag": "svc-052", "date": "2026-09-08", "vehicle": "kawasaki-ex650k", "price": 250,
     "name": "Мойка", "conf": "high",
     "note": "«восьмого сентября: кавасаки ниндзя 650 прокатная: мойка — 250»"},
    {"tag": "svc-053", "date": "2026-09-08", "vehicle": "kawasaki-ex650k", "price": 600,
     "name": "Правка ножки тормоза", "conf": "medium",
     "note": "«…правка ножки тормоза — 600 рублей» (тот же кавасаки)"},
    {"tag": "svc-054", "date": "2026-09-08", "vehicle": "yamaha-r6-2007", "price": 500,
     "name": "Замена задних колодок", "conf": "medium",
     "note": "«има[ха] шесть прокатные: замена задних колодок — 500»; 8–9.09"},
    {"tag": "svc-055", "date": "2026-09-08", "vehicle": "yamaha-r6-2007", "price": 2000,
     "name": "Замена свечей (с чисткой и смазкой)", "conf": "medium",
     "note": "«замену свечей — 2000 с чисткой и смазкой»; 8–9.09"},
    # -- 9 сентября: клиентский байк --
    {"tag": "svc-056", "date": "2026-09-09", "vehicle": "клиентский байк (марка не распознана, ASR: «АЦЕКС»)",
     "price": 6000,
     "name": "Замена сальников помпы (снятие крышки, перепрессовка): перепрессовка 1000 + работа 5000",
     "conf": "medium", "client": "Алексей", "client_phone": "8909872203",
     "note": "«девятого сентября: клиентский байк…, Алексей, тел 8-909-872-20-3?; замена сальников помпы, "
             "снятие крышки, перепрессовка — 1000; стоимость работ — 5000». Телефон по 25с-чанку (10с-нарезка "
             "слышала «890 12 884 22 03» — возможно 8-901-288-42-203?)."},
    # -- 10 сентября --
    {"tag": "svc-057", "date": "2026-09-10", "vehicle": "ducati-panigale-s-electro-gold", "price": 1000,
     "name": "Подтяжка цепи с регулировкой суппорта", "conf": "high",
     "note": "«десятого сентября: дукати чёрно-золотой, который у нас в базе: подтяжка цепи с регулировкой суппорта — 1000»"},
    # -- 13 сентября --
    {"tag": "svc-058", "date": "2026-09-13", "vehicle": "bmw-s1000rr-electro-silver", "price": 300,
     "name": "Замена аккумулятора", "conf": "low",
     "note": "«…серебристый [S1000]RR прокатный: замена аккумулятора — 300»; дата 11–13.09 (между 10-м и "
             "«четырнадцатого»); байк спорен — 25с-нарезка слышала «…Racer Red» (альтернатива: ducati-panigale-s-electro-red)"},
    # -- 14 сентября --
    {"tag": "svc-059", "date": "2026-09-14", "vehicle": "ducati-panigale-s-electro-black", "price": 500,
     "name": "Диагностика", "conf": "high",
     "note": "«четырнадцатого сентября: дукати чёрный прокатный: диагностика — 500»"},
    # -- 16 сентября --
    {"tag": "svc-060", "date": "2026-09-16", "vehicle": "leopard-asaka", "price": 200,
     "name": "Установка аккумулятора с разборкой сиденья", "conf": "high",
     "note": "«шестнадцатого сентября: Аска Леопард прокатный: установка аккумулятора с разборкой сиденья — 200»"},
    {"tag": "svc-061", "date": "2026-09-16", "vehicle": "jilang-max-pro", "price": 500,
     "name": "Установка аккумулятора, диагностика переднего и заднего колеса", "conf": "medium",
     "note": "«Гайлинг прокатный: установка аккумулятора, диагностика переднего/заднего колеса — 500»"},
    {"tag": "svc-062", "date": "2026-09-16", "vehicle": "falcon-gt-2026", "price": 500,
     "name": "Замена сиденья, установка крыла", "conf": "high",
     "note": "«Фалкон GT прокатный: замена сиденья, установка крыла — 500»"},
    # -- 17 сентября --
    {"tag": "svc-063", "date": "2026-09-17", "vehicle": "yamaha-r6-2007", "price": 1000,
     "name": "Замена масла с разбором бака", "conf": "medium",
     "note": "«17-го: имаха — замена масла с разбором бака — 1000 за замену»; байк по контексту серии «Имаха R6»"},
    # -- 18 сентября --
    {"tag": "svc-064", "date": "2026-09-18", "vehicle": "yamaha-r6-2007", "price": 300,
     "name": "Правка хвоста", "conf": "high",
     "note": "«восемнадцатого сентября: имаха шесть прокатная: правка хвоста — 300»"},
    {"tag": "svc-065", "date": "2026-09-18", "vehicle": "ducati-panigale-s-electro-black", "price": 700,
     "name": "Правка руля", "conf": "high",
     "note": "«дукати панегале прокатный: правка руля — 700»"},
    # -- 19 сентября --
    {"tag": "svc-066", "date": "2026-09-19", "vehicle": "yamaha-r6-2007", "price": 500,
     "name": "Покраска люльки", "conf": "medium",
     "note": "«девятнадцатого сентября: имаха шесть прокатная: покраска люльки — 500» (ASR: «лужка/кружка»)"},
    # -- 20 сентября --
    {"tag": "svc-067", "date": "2026-09-20", "vehicle": "sequence-zero", "price": 200,
     "name": "Ремонт грипс", "conf": "high",
     "note": "«[20-е] секвенс зеро прокатный: ремонт грипс — 200»"},
    {"tag": "svc-068", "date": "2026-09-20", "vehicle": "ducati-panigale-s-electro-black", "price": 500,
     "name": "Замена задних колодок", "conf": "high",
     "note": "«дукати панегале прокатные: замена задних колодок — 500»"},
    {"tag": "svc-069", "date": "2026-09-20", "vehicle": "leopard-asaka", "price": 200,
     "name": "Замена аккумулятора", "conf": "high",
     "note": "«Аска Леопард прокатные: замена аккумулятора — 200»"},
    # -- 21 сентября --
    {"tag": "svc-070", "date": "2026-09-21", "vehicle": "jilang-max-pro", "price": 1200,
     "name": "Диагностика, замена реле стартера с разбором", "conf": "medium",
     "note": "«двадцать первого сентября: гайланг прокатный: диагностика, замена [реле] стартера с разбором — 1200»"},
    {"tag": "svc-071", "date": "2026-09-21", "vehicle": "ducati-panigale-s-electro-gold", "price": 1000,
     "name": "Сборка, замена автоматов", "conf": "medium",
     "note": "«дукатти чёрный золотой прокатный: сборка, замена автоматов — 1000»; 21–22.09 (до явного «22-го: Aprilia»)"},
    # -- 22 сентября --
    {"tag": "svc-072", "date": "2026-09-22", "vehicle": "aprilia-shiver", "price": 250,
     "name": "Замена замка зажигания", "conf": "high",
     "note": "«двадцать второго сентября: Aprilia Shiver прокатная: замок зажигания — 250»"},
    # -- 27 сентября --
    {"tag": "svc-073", "date": "2026-09-27", "vehicle": "клиентский электро-байк", "price": 3000,
     "name": "Замена поворотника (работа 2000) + зарплата сервисмена (1000)", "conf": "medium",
     "note": "«двадцать седьмого сентября: электро-байк клиентский: замена поворотника — 2000 и 1000 за зарплату "
             "сервисмену» (svco-036: «27 сенября» явно; 25с-нарезка ошибочно слышала «7th of October»)"},
    {"tag": "svc-074", "date": "2026-09-27", "vehicle": "ducati-panigale-s-electro-black", "price": 1000,
     "name": "Сборка пластика", "conf": "medium",
     "note": "«дукати чёрный прокатный: сборка пластика — 1000»; стоит между 27-м и «двадцать девятого» — датировано 27.09"},
    # -- 29 сентября --
    {"tag": "svc-075", "date": "2026-09-29", "vehicle": "yamaha-r6-2007", "price": 1000,
     "name": "Замена топливной трубки", "conf": "high",
     "note": "«двадцать девятого сентября: имаха шесть прокатные: замена топливной трубки — 1000»"},
    {"tag": "svc-076", "date": "2026-09-29", "vehicle": "yamaha-r6-2007", "price": 200,
     "name": "Замена зеркала", "conf": "high",
     "note": "«…и замена зеркала — 200»"},
    # -- 30 сентября --
    {"tag": "svc-077", "date": "2026-09-30", "vehicle": "falcon-gt-2026", "price": 1000,
     "name": "Тест-драйв, смазка цепи", "conf": "high",
     "note": "«тридцатого числа: фалкон GT прокатный: тест-драйв, смазка цепи — 1000» (конец диктовки)"},
]


def rental_payload(r):
    md = {
        "source": "retro_backfill_audio_v2",
        "renter_name": r["renter_name"],
        "duration_note": r["duration_note"],
        "history": [
            {"at": NOW, "by": "task143-audio-backfill", "status": "completed",
             "note": "retrospective insert from boss voice notes 26.10.2026 (popki.mp3 + may.mp3), ASR"}
        ],
        "specs": {
            "retro_backfill_audio_v2": {
                "origin": ORIGIN_RENT,
                "row_tag": r["_tag"],
                "mapped_from": r["note"],
                "confidence": r["confidence"],
                "backfilled_at": NOW,
                "backfilled_by": "task143 (agent, boss request: continuation for may and recent services — add properly)",
            }
        },
    }
    if r.get("renter_phone"):
        md["renter_phone"] = r["renter_phone"]
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


def svc_payload(s):
    vehicle_id = f"vip-bike-svc-{s['tag'].split('-')[1]}"
    md = {
        "source": "service_work",
        "created_by": "audio-backfill-task143",
        "bike": s["vehicle"],
        "service_name": s["name"],
        "performed_at": f"{s['date']}T12:00:00Z",
        "history": [
            {"at": NOW, "by": "task143-audio-backfill", "status": "completed",
             "note": f"retrospective service row from boss voice note 24.10.2026 (service final.mp3, ASR)"}
        ],
        "specs": {
            "retro_backfill_audio_v2": {
                "origin": ORIGIN_SVC,
                "row_tag": s["tag"],
                "mapped_from": s["note"],
                "confidence": s["conf"],
                "backfilled_at": NOW,
                "backfilled_by": "task143 (agent, boss request: continuation for may and recent services — add properly)",
            }
        },
    }
    if s.get("client"):
        md["client"] = s["client"]
    if s.get("client_phone"):
        md["client_phone"] = s["client_phone"]
    return {
        "user_id": WALKIN_USER,
        "vehicle_id": vehicle_id,
        "owner_id": WALKIN_USER,
        "status": "completed",
        "payment_status": "fully_paid",
        "total_cost": s["price"],
        "requested_start_date": f"{s['date']}T09:00:00+00:00",
        "requested_end_date": f"{s['date']}T19:00:00+00:00",
        "agreed_start_date": f"{s['date']}T09:00:00+00:00",
        "agreed_end_date": f"{s['date']}T19:00:00+00:00",
        "created_at": f"{s['date']}T12:00:00+00:00",
        "updated_at": NOW,
        "crew_id": CREW_VIP_BIKE,
        "deposit_amount": 0,
        "deposit_returned": False,
        "metadata": md,
    }


def ensure_svc_car(s):
    """rentals.vehicle_id has FK to cars.id — make sure the vip-bike-svc-NNN placeholder exists."""
    vehicle_id = f"vip-bike-svc-{s['tag'].split('-')[1]}"
    cur = rest("cars", [("select", "id"), ("id", f"eq.{vehicle_id}")])
    if cur:
        return vehicle_id, False
    img = (f"https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/"
           f"carpix/{vehicle_id}/image_1.jpg")
    body = {"id": vehicle_id, "make": "VIP_BIKE", "model": s["name"], "type": "service",
            "description": s["name"], "quantity": 1, "owner_id": None, "crew_id": CREW_VIP_BIKE,
            "image_url": img,
            "availability_rules": {},
            "specs": {"gallery": [img], "service": True, "subtype": "service",
                      "dailyPrice": s["price"]}}
    rest("cars", {"select": "id"}, method="POST", body=[body], prefer="return=representation")
    return vehicle_id, True


def season_totals():
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
        cost = x.get("total_cost") or 0
        if svc:
            d["service"] += 1
            d["service_rub"] += cost
        else:
            d["rentals"] += 1
            d["rental_rub"] += cost
    return months


def print_totals():
    for m, d in sorted(season_totals().items()):
        print(f"  {m}: rentals={d['rentals']:>3} ({d['rental_rub']:>9,} ₽)  "
              f"service={d['service']:>2} ({d['service_rub']:>9,.2f} ₽)")


def main():
    print("=== DRY RUN — May rentals to insert ===")
    for r in RENTALS:
        p = rental_payload(r)
        print(f"\n[{r['_tag']}] {p['vehicle_id']} | {p['requested_start_date']} .. {p['requested_end_date']}")
        print(f"    who={r['renter_name']!r}  total={p['total_cost']:>6}  conf={r['confidence']}")
    print(f"\n[update] {UPDATE_ROW['rental_id']} total_cost -> {UPDATE_ROW['total_cost']} (поправка)")

    print("\n=== DRY RUN — service rows to insert ===")
    for s in SERVICES:
        p = svc_payload(s)
        print(f"[{s['tag']}] {p['vehicle_id']} | {s['date']} | {s['price']:>5}₽ | {s['name'][:60]} | conf={s['conf']}")

    print("\n=== idempotency check (existing task143 rows?) ===")
    existing = rest("rentals", [
        ("select", "rental_id,vehicle_id,requested_start_date,metadata"),
        ("crew_id", f"eq.{CREW_VIP_BIKE}"),
        ("requested_start_date", "gte.2026-04-01T00:00:00+00:00"),
        ("requested_start_date", "lt.2026-11-01T00:00:00+00:00"),
    ])

    def row_has_spec(x):
        md = x.get("metadata") or {}
        return ("retro_backfill_audio_v2" in md.get("source", "")
                or "retro_backfill_audio_v2" in (md.get("specs") or {}))

    dupes_all = [x for x in existing if row_has_spec(x)]
    print(f"  rows already carrying retro_backfill_audio_v2: {len(dupes_all)}")
    for x in dupes_all:
        print(f"    {x['rental_id']} {x['vehicle_id']} {x['requested_start_date']}")
    print("  (per-row skip logic below — re-run finishes the job instead of bailing)\n")

    print("\n=== season before: ===")
    print_totals()

    if not APPLY:
        print("\nDRY RUN ONLY — run with --apply to insert.")
        return

    inserted = []

    print("rentals (per-row idempotent)…")
    for r in RENTALS:
        day = r["start"][:10]
        mine = [x for x in existing
                if x.get("vehicle_id") == r["vehicle_id"]
                and (x.get("requested_start_date") or "")[:10] == day
                and row_has_spec(x)]
        if mine:
            print(f"  skip [{r['_tag']}] — already inserted ({mine[0]['rental_id']})")
            continue
        others = [x for x in existing
                  if x.get("vehicle_id") == r["vehicle_id"]
                  and (x.get("requested_start_date") or "")[:10] == day]
        for x in others:
            other = (x.get("metadata") or {}).get("renter_name")
            if other == r["renter_name"]:
                raise SystemExit(f"DUPE risk: {r['vehicle_id']} {day} has renter {other!r} ({x['rental_id']}) — abort")
            print(f"  note: {r['vehicle_id']} {day} also has {x['rental_id'][:8]} ({other!r}) — distinct client, proceeding")
        p = rental_payload(r)
        res = rest("rentals", {"select": "rental_id"}, method="POST", body=[p],
                   prefer="return=representation")
        rid = res[0]["rental_id"] if isinstance(res, list) and res else None
        inserted.append({"tag": r["_tag"], "rental_id": rid, "vehicle_id": r["vehicle_id"],
                         "total_cost": r["total_cost"], "kind": "rental"})
        print(f"  inserted [{r['_tag']}] → {rid}")

    print("поправка Стерлягову (per-row idempotent)…")
    cur = rest("rentals", [("select", "metadata,total_cost"), ("rental_id", f"eq.{UPDATE_ROW['rental_id']}")])
    if not cur:
        raise SystemExit("UPDATE target not found — abort")
    md = cur[0].get("metadata") or {}
    if "retro_backfill_audio_v2" in (md.get("specs") or {}):
        print(f"  skip — поправка уже применена (total_cost={cur[0].get('total_cost')})")
    else:
        md.setdefault("history", []).append(
            {"at": NOW, "by": "task143-audio-backfill", "status": "completed", "note": UPDATE_ROW["history_note"]})
        md.setdefault("specs", {})["retro_backfill_audio_v2"] = {
            "origin": ORIGIN_RENT,
            "row_tag": "may9-sterlyakov-popravka",
            "confidence": "medium",
            "mapped_from": ("голозаметка may.mp3: «поправка: там двадцать [залог] за сутки, а вот это "
                            "на самом деле 9 000» — контракт 9-05/1, 1 сутки, залог 20 000 (уже в specs)"),
            "backfilled_at": NOW,
            "backfilled_by": "task143 (agent, boss request)",
        }
        rest("rentals", [("rental_id", f"eq.{UPDATE_ROW['rental_id']}")], method="PATCH",
             body={"total_cost": UPDATE_ROW["total_cost"], "metadata": md, "updated_at": NOW})
        inserted.append({"tag": "may9-sterlyakov-popravka", "rental_id": UPDATE_ROW["rental_id"],
                         "total_cost": UPDATE_ROW["total_cost"], "kind": "update"})
        print(f"  updated {UPDATE_ROW['rental_id']} → total_cost=9000")

    print("service rows (cars placeholders + per-row idempotent)…")
    for s in SERVICES:
        vehicle_id, created_car = ensure_svc_car(s)
        if created_car:
            print(f"  cars placeholder created: {vehicle_id}")
        mine = [x for x in existing
                if x.get("vehicle_id") == vehicle_id and row_has_spec(x)]
        if mine:
            print(f"  skip [{s['tag']}] — already inserted ({mine[0]['rental_id']})")
            continue
        p = svc_payload(s)
        res = rest("rentals", {"select": "rental_id"}, method="POST", body=[p],
                   prefer="return=representation")
        rid = res[0]["rental_id"] if isinstance(res, list) and res else None
        inserted.append({"tag": s["tag"], "rental_id": rid, "vehicle_id": vehicle_id,
                         "total_cost": s["price"], "kind": "service"})
        print(f"  inserted [{s['tag']}] → {rid}")

    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "task143-audio-backfill-manifest.json")
    with open(manifest_path, "w") as f:
        json.dump({"applied_at": NOW,
                   "source": "boss voice notes 24.10+26.10.2026 (service final.mp3, popki.mp3, may.mp3 — ASR)",
                   "note": "rentals_vehicle_id_fkey → cars.id: svc placeholders ensured in cars before rental POSTs",
                   "inserted": inserted,
                   "flags_not_inserted": [
                       "Богданов Дмитрий Михайлович — аренда 17 мая: байк и цена не разобраны (ASR «650/600»?), телефон неполный (8-962-556-53-9?)",
                       "Коронников Александр Викторович — аренда 25 мая: босс оборвал («я забыл последнее»), нет байка/цены/полного телефона",
                       "«??? зажигания — 2000₽» (~17 сент): байк и тип работы не распознаны",
                       "«Протирка — 100₽» (5-6 сент): объект неясен",
                       "«мой аккумулятор — 2000» (20 сент): личная пометка босса, не сервисная строка",
                       "«Дьябаев… взял наш штраф» (popki): контекст неясен",
                       "«замена колёс с натяжкой цепи — 500» (5-6 сент): похоже на ре-диктовку уже существующих svc-046/047",
                   ]}, f, ensure_ascii=False, indent=1)
    print(f"\nmanifest → {manifest_path}")

    print("\n=== season after: ===")
    print_totals()


if __name__ == "__main__":
    main()
