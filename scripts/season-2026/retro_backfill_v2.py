#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
retro_backfill_v2 — finish importing zip-doc rentals into Supabase (boss request 2026-10-19).

Phases:
  cache   — one-time fetch of cars + May–Aug rentals (saved to _db_cache.json)
  plan    — full-parse candidate docs, extract totals, build import plan (dry run)
  apply   — insert rentals (source=retro_backfill_v2), upload docs to storage
            (rental-contracts bucket, vip-bike/retro/), create artifact rows
  verify  — post-import month totals vs expected

Usage: python3 retro_backfill_v2.py cache|plan|apply|verify [--only=idx,...]
"""
import json
import os
import re
import sys
import zipfile
import hashlib
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open("/home/z/my-project/scripts/.sb_key").read().strip()
CREW_VIP_BIKE = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
WALKIN_USER = "356282674"
DOCS_DIR = "/home/z/my-project/docs_extract"
CACHE = os.path.join(HERE, "_db_cache.json")
BUCKET = "rental-contracts"
STORAGE_PREFIX = "vip-bike/retro/"
NOW = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
APPLY = "--apply" in sys.argv
ONLY = None
for a in sys.argv[1:]:
    if a.startswith("--only="):
        ONLY = set(int(x) for x in a.split("=", 1)[1].split(",") if x.strip().isdigit())


def rest(table, params, method="GET", body=None, prefer=None, profile=None):
    qs = urllib.parse.urlencode(params, quote_via=urllib.parse.quote) if params else ""
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?{qs}")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Content-Type", "application/json")
    if profile:
        # PostgREST: Accept-Profile for reads, Content-Profile for writes
        if method == "GET":
            req.add_header("Accept-Profile", profile)
        else:
            req.add_header("Content-Profile", profile)
    if method != "GET":
        req.get_method = lambda: method
    if prefer:
        req.add_header("Prefer", prefer)
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def rest_count(table, params, profile=None):
    req = urllib.request.Request(f"{URL}/rest/v1/{table}?{urllib.parse.urlencode(params, quote_via=urllib.parse.quote)}")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    if profile:
        req.add_header("Accept-Profile", profile)
    req.add_header("Prefer", "count=exact")
    req.get_method = lambda: "HEAD"
    try:
        with urllib.request.urlopen(req) as r:
            cr = r.headers.get("content-range", "")
            return int(cr.split("/")[1]) if "/" in cr else None
    except Exception as e:
        print("  count failed:", e)
        return None


# storage object keys must be ASCII (Supabase InvalidKey on Cyrillic) —
# transliterate the original filename, keep the mapping in the manifest
TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya",
}


def ascii_key(filename: str) -> str:
    name, ext = os.path.splitext(filename)
    out = []
    for ch in name.lower():
        if ch in TRANSLIT:
            out.append(TRANSLIT[ch])
        elif ch.isascii() and (ch.isalnum() or ch in " -_."):
            out.append(ch)
        else:
            out.append("_")
    slug = re.sub(r"_+", "_", "".join(out)).strip("_")[:120] or "doc"
    return slug + (ext.lower() if ext else "")


def storage_upload(path, data: bytes):
    q = f"{URL}/storage/v1/object/{BUCKET}/{urllib.parse.quote(path)}"
    req = urllib.request.Request(q, data=data, method="POST")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    req.add_header("x-upsert", "true")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code} {e.read().decode()[:200]}")


# ─────────────────────────────────────────────────────────── docx full parse
def docx_text(path):
    try:
        z = zipfile.ZipFile(path)
        xml = z.read("word/document.xml").decode("utf-8", "ignore")
    except Exception:
        return ""
    xml = re.sub(r"</w:p>", "\n", xml)
    text = re.sub(r"<[^>]+>", " ", xml)
    return re.sub(r"[ \t]+", " ", text)


def parse_money_near(patterns, text):
    last = len(patterns) - 1
    for i, pat in enumerate(patterns):
        m = re.search(pat, text)
        if m:
            digits = re.sub(r"[^\d]", "", m.group(1))
            if not digits:
                continue
            if i == last:
                # «Размер арендной платы» fallback: reject the tariff-list shape
                # («1250 руб. за час / 10000 руб. за сутки») — keep only a single fee
                tail = text[m.end():m.end() + 14]
                if re.match(r"\s*[./]?\s*за\b", tail):
                    continue
            return int(digits), pat[:30]
    return None, None


TOTAL_PATS = [
    r"[Ии]того к оплате[:\s]*([\d\s\u00a0.,]{1,15})\s*(?:руб|₽)",
    r"[Ии]того[:\s]*([\d\s\u00a0.,]{1,15})\s*(?:руб|₽)",
    r"[Оо]бщая (?:стоимость|сумма) (?:аренды|по договору|составляет)[:\s]*([\d\s\u00a0.,]{1,15})\s*(?:руб|₽)",
    r"[Оо]плата[:\s]*([\d\s\u00a0.,]{1,15})\s*(?:руб|₽)",
    # doc-era fallback: «4.1. Размер арендной платы: 8500 руб.» — only when the
    # fee is a single number (not the «1250 руб. за час / 10000 руб. за сутки» tariff list)
    r"Размер арендной платы:\s*([\d\s\u00a0.,]{2,15})\s*руб",
]
DEPOSIT_PATS = [
    r"обеспечительный платеж \(депозит\):?\s*([\d\s\u00a0.,]{1,15})\s*(?:руб|₽)",
    r"депозит[:\s]*([\d\s\u00a0.,]{1,15})\s*(?:руб|₽)",
    r"залог[:\s]*([\d\s\u00a0.,]{1,15})\s*(?:руб|₽)",
]


def parse_doc(fname):
    """Full parse of one docx from docs_extract; returns dict with totals/period/vehicle."""
    p = os.path.join(DOCS_DIR, fname)
    text = docx_text(p)
    sha = hashlib.sha256(open(p, "rb").read()).hexdigest()
    out = {"file": fname, "sha256": sha, "size": os.path.getsize(p), "text_len": len(text)}
    out["total"], out["total_pat"] = parse_money_near(TOTAL_PATS, text)
    out["deposit"], out["deposit_pat"] = parse_money_near(DEPOSIT_PATS, text)
    # contract no from header
    m = re.search(r"ДОГОВОР\s*(?:аренды)?\s*№\s*([^\n«]{1,40})", text)
    out["contract_no"] = m.group(1).strip() if m else None
    # renter: after «и ... именуемый в дальнейшем «Арендатор»»
    m = re.search(r"с одной стороны, и\s+(.{5,80}?),?\s+именуемый в дальнейшем\s+«Арендатор»", text)
    out["renter_body"] = m.group(1).strip() if m else None
    if not out["renter_body"]:
        m = re.search(r"и\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){0,2}),\s*именуемого\s*в\s*дальнейшем\s*«Арендатор»", text)
        out["renter_body"] = m.group(1).strip() if m else None
    # vehicle марка/модель
    m = re.search(r"марка/мodel|марка/модель\s+(.{3,80}?)(?:,|\n)", text)
    out["vehicle_body"] = m.group(1).strip() if m else None
    if not out["vehicle_body"]:
        m = re.search(r"(?:марка|модель)[:\s]*([A-Za-zА-ЯЁ][A-Za-zА-ЯЁа-яё\-\s\d.]{2,60}?)(?:,\s*(?:серийный|цвет|год|VIN)|\n)", text)
        out["vehicle_body"] = m.group(1).strip() if m else None
    # phone
    m = re.search(r"(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}", text)
    out["phone"] = re.sub(r"[^\d+]", "", m.group(0)) if m else None
    # period: «Аренда ... с DD.MM.YYYY по DD.MM.YYYY» or act dates
    m = re.search(r"с\s*(\d{2}\.\d{2}\.\d{4}).{0,40}?(?:по|до)\s*(\d{2}\.\d{2}\.\d{4})", text)
    out["period"] = (m.group(1), m.group(2)) if m else None
    # hours/day tariffs mention
    out["has_4_1"] = "4.1." in text
    return out


# ─────────────────────────────────────────────────────────── phase: cache
def phase_cache():
    print("Fetching cars…")
    cars = rest("cars", {"select": "id,make,model,type,crew_id,daily_price", "limit": "2000"})
    print(f"  cars: {len(cars or [])}")
    print("Fetching rentals May–Jul 2026 (agreed + requested ranges, merged)…")
    sel = ("rental_id,vehicle_id,user_id,crew_id,status,payment_status,total_cost,"
           "requested_start_date,agreed_start_date,deposit_amount,metadata")
    by_agreed = rest("rentals", {
        "select": sel, "limit": "2000",
        "and": "(agreed_start_date.gte.2026-05-01T00:00:00+00:00,agreed_start_date.lt.2026-08-01T00:00:00+00:00)"})
    by_req = rest("rentals", {
        "select": sel, "limit": "2000",
        "and": "(requested_start_date.gte.2026-05-01T00:00:00+00:00,requested_start_date.lt.2026-08-01T00:00:00+00:00)"})
    seen, rentals = set(), []
    for r in (by_agreed or []) + (by_req or []):
        if r["rental_id"] not in seen:
            seen.add(r["rental_id"])
            rentals.append(r)
    print(f"  rentals May-Jul: {len(rentals)}")
    print("artifact sha index…")
    art = rest("rental_contract_artifacts", {
        "select": "id,contract_key,original_sha256,rental_id,resolved_bike_id,storage_path",
        "original_sha256": "not.is.null", "limit": "2000",
    }, profile="private")
    print(f"  artifacts with sha: {len(art or [])}")
    json.dump({"cars": cars, "rentals": rentals, "artifacts": art}, open(CACHE, "w"), ensure_ascii=False)
    print(f"cache → {CACHE}")


# ─────────────────────────────────────────────────────────── vehicle mapping
def load_extraction():
    return json.load(open(os.path.join(HERE, "extraction_v1.json")))


VEHICLE_RULES = [
    # (regex on doc text/file name, vehicle_id)
    (r"panigale s electro.*red|ducati.*red", "ducati-panigale-s-electro-red"),
    (r"panigale s electro.*black|ducati-panigale-s-electro-black", "ducati-panigale-s-electro-black"),
    (r"panigale s electro.*gold", "ducati-panigale-s-electro-gold"),
    (r"panigale s electro", "ducati-panigale-s-electro-black"),
    (r"jilang|max pro", "jilang-max-pro"),
    (r"nibbler|regumoto|regulmoto", "nibbler-regumoto-4v"),
    (r"rerode", "rerode-r1"),
    (r"falcon gt \+ pro|falcon.*pro", "falcon-pro-2026"),
    (r"falcon gt", "falcon-gt-2026"),
    (r"horwin\s*cr1|horwin", "horwin-cr1"),
    (r"kawasaki\s*ex650|kawasaki.*ninja|кава", "kawasaki-ex650k"),
    (r"zero", "sequence-zero"),
    (r"bmw\s*f800|f800r", "bmw-f800r"),
    (r"suzuki\s*gsxs|gsxs\s*1000", "suzuki-gsxs1000f"),
    (r"aprilia\s*shiver|shiver", "aprilia-shiver-750"),
    (r"yamaha\s*r7|r7", "yamaha-r7"),
]


def resolve_vehicle(doc, cars):
    hay = f"{doc['file']} {doc.get('vehicle_body') or ''}".lower()
    for pat, vid in VEHICLE_RULES:
        if re.search(pat, hay):
            row = next((c for c in cars if c["id"] == vid), None)
            if row:
                return vid, row, "rule"
    return None, None, "unresolved"


# ─────────────────────────────────────────────────────────── phase: plan
def phase_plan():
    ex = load_extraction()
    cache = json.load(open(CACHE))
    cars = cache["cars"]
    rentals = cache["rentals"]
    art_shas = {a["original_sha256"]: a for a in (cache["artifacts"] or [])}
    meta_shas = {}
    for r in rentals:
        md = r.get("metadata") or {}
        for k in ("original_sha256", "doc_sha256"):
            if md.get(k):
                meta_shas.setdefault(md[k], []).append(r["rental_id"])

    cands = []
    for grp, status_tag in (("retro_missing", "missing"), ("retro_needs_review", "review")):
        for r in ex.get(grp, []):
            cands.append({**r, "_tag": status_tag})

    plan = []
    for i, c in enumerate(cands):
        doc = parse_doc(c["file"])
        doc["_tag"] = c["_tag"]
        doc["_v2_kind"] = c.get("v2_kind")
        doc["_ext_total"] = c.get("doc_total")
        doc["_ext_deposit"] = c.get("deposit")
        doc["_ext_renter"] = c.get("renter")
        doc["_ext_date"] = c.get("doc_date")
        doc["_ext_contract_no"] = c.get("contract_no")
        doc["_ext_phone"] = c.get("phone")
        # total: prefer body «Итого к оплате», fallback extraction
        doc["final_total"] = doc["total"] or doc["_ext_total"]
        doc["final_deposit"] = doc["deposit"] or doc["_ext_deposit"]
        doc["renter"] = doc["_ext_renter"] or doc["renter_body"]
        doc["doc_date"] = doc["_ext_date"]
        vid, car, how = resolve_vehicle(doc, cars)
        doc["vehicle_id"] = vid
        doc["vehicle_how"] = how
        doc["car"] = car
        # idempotency: sha already in DB?
        doc["dup_artifact"] = bool(doc["sha256"] in art_shas)
        doc["dup_meta"] = bool(doc["sha256"] in meta_shas)
        # near-dup check: same vehicle same day in DB
        near = []
        if vid and doc["doc_date"]:
            day = doc["doc_date"]
            for r in rentals:
                if r.get("vehicle_id") != vid:
                    continue
                for k in ("agreed_start_date", "requested_start_date"):
                    if (r.get(k) or "")[:10] == day:
                        near.append({"rental_id": r["rental_id"], "total": r.get("total_cost"),
                                     "status": r.get("status"), "src": (r.get("metadata") or {}).get("source"),
                                     "renter": (r.get("metadata") or {}).get("renter_name")})
                        break
        doc["db_same_day"] = near
        plan.append(doc)

    out = os.path.join(HERE, "backfill_v2_plan.json")
    for d_ in plan:
        d_.pop("car", None)
    json.dump(plan, open(out, "w"), ensure_ascii=False, indent=1)

    print(f"{'#':>2} {'tag':7} {'date':10} {'total':>7} {'dep':>6} {'vehicle':32} {'renter':28} flags")
    for i, d_ in enumerate(plan):
        flags = []
        if d_["dup_artifact"]: flags.append("sha-in-artifacts")
        if d_["dup_meta"]: flags.append("sha-in-metadata")
        if d_["db_same_day"]: flags.append(f"same-day-db({len(d_['db_same_day'])})")
        if not d_["vehicle_id"]: flags.append("NO-VEHICLE")
        if d_["final_total"] is None: flags.append("NO-TOTAL")
        if ONLY and i not in ONLY: flags.append("SKIP(--only)")
        print(f"{i:>2} {d_['_tag']:7} {d_['doc_date'] or '????-??-??':10} "
              f"{str(d_['final_total']):>7} {str(d_['final_deposit']):>6} "
              f"{(d_['vehicle_id'] or '?'):32} {(d_['renter'] or '?')[:28]:28} {' '.join(flags)}")
        print(f"     file: {d_['file'][:90]}")
    print(f"\nplan → {out}")


# ─────────────────────────────────────────────────────────── decisions
# index → action, finalized 2026-10-19 against _db_cache.json + doc bodies.
#   import: vehicle override / total override / flags
#   skip:   reason
DECISIONS = {
    0:  {"action": "import"},  # Заваленский 04.07 panigale-black 3750
    1:  {"action": "import", "vehicle": "ducati-panigale-s-electro-black",
         "note": "в договоре Panigale S Electro RED — красной вариации нет в cars, прикреплено к базовой Panigale для корректной сезонной статистики"},
    2:  {"action": "import"},  # Сухарев 03.07 jilang 5000
    3:  {"action": "import"},  # Новиков 04.07 nibbler 2250
    4:  {"action": "import"},  # Шевчук 06.07 nibbler 8000
    5:  {"action": "import", "vehicle": "rerode-r1-plus"},  # Ворожейкин 10.07 32500
    6:  {"action": "import", "total_unknown": True},  # Алиев 11.07 nibbler, суммы в договоре нет
    7:  {"action": "skip", "reason": "шаблон субаренды (франшиза) — не аренда парка, суммы/ТС/дат нет"},
    8:  {"action": "import", "total_unknown": True},  # Калинин 16.05 falcon-pro
    9:  {"action": "import", "total_unknown": True},  # Могучев 18.05 falcon-pro
    10: {"action": "skip", "reason": "Horwin CR1 отсутствует в парке базы (cars) — партнёрский байк, как в retro_backfill_v1"},
    11: {"action": "import", "total_unknown": True},  # Воронцов 26.05 kawasaki
    12: {"action": "import"},  # Фимин 03.07 bmw 12000
    13: {"action": "import"},  # Локтев 04.07 bmw 12000
    14: {"action": "import"},  # Павликов 10.07 bmw 28000
    15: {"action": "import", "vehicle": "ducati-panigale-s-electro-black",
         "note": "арендная плата 8500 из п.4.1 договора (Итого не заполнено)"},  # Сидоров А.Д. 03.07
    16: {"action": "import", "vehicle": "ducati-panigale-s-electro-black-chain",
         "note": "второй чёрный Panigale в этот же день (договор 3.7_2); арендная плата 8500 из п.4.1"},  # Томашевский 03.07
    17: {"action": "import", "vehicle": "ducati-panigale-s-electro-black-chain",
         "note": "в договоре цвет Чёрный; black Z занят Заваленским 04.07 — прикреплено к black-chain вариации"},  # Гречковский 04.07 10000
    18: {"action": "import"},  # Галанов 02.07 kawasaki 20000
    19: {"action": "import", "vehicle": "aprilia-shiver",
         "note": "в договоре №05.08/APRILIA Aprilia Shiver; дата в имени файла (29.06) — от старого шаблона"},  # Ларин 05.08
    20: {"action": "import", "total_unknown": True},  # Стерлягов 09.05 sequence-zero
    21: {"action": "skip", "reason": "в теле договора марка/модель DK400-S — байка нет в парке базы (cars)"},
    22: {"action": "skip", "reason": "в теле договора марка/модель DK400-S — байка нет в парке базы (cars)"},
    23: {"action": "skip", "reason": ".txt копия шаблона Kawasaki — не импортируем, файл уходит в хранилище"},
}
# manual additions (dedup artifacts): Кузовлев Suzuki №888 03.07; Чуфыркин 05.07 Red (rep of dup pair)
MANUAL_IMPORTS = [
    {"file": "Договор аренды мотоцикла Suzuki GSXS 1000F чистый .docx не чистый.docx",
     "doc_date": "2026-07-03", "vehicle": "suzuki-gsx-s1000f", "renter": "Кузовлев Иван Александрович",
     "contract_no": "888", "total_unknown": True, "deposit": None, "phone": None,
     "note": "дата из тела договора «03» 07 2026 (пробельные цифры); суммы в договоре нет"},
    {"file": "rent-Ducati-Panigale-S-Electro-Red-05.07.2026_Чуфыркин.docx",
     "doc_date": "2026-07-05", "vehicle": "ducati-panigale-s-electro-black", "renter": "Чуфыркин Михаил Сергеевич",
     "contract_no": None, "total": 12000, "deposit": None, "phone": None,
     "note": "в договоре Panigale S Electro RED — прикреплено к базовой Panigale; представитель пары дубликатов «...Чуфыркин.docx»"},
]


def build_rows():
    """Final import rows (rentals payload + artifact payload + file path)."""
    plan = json.load(open(os.path.join(HERE, "backfill_v2_plan.json")))
    cache = json.load(open(CACHE))
    cars = {c["id"]: c for c in cache["cars"]}
    rows = []
    for i, d_ in enumerate(plan):
        dec = DECISIONS.get(i, {"action": "skip", "reason": "нет решения"})
        if dec["action"] != "import":
            continue
        vid = dec.get("vehicle") or d_.get("vehicle_id")
        car = cars.get(vid)
        if not car:
            print(f"  !! no car row for {vid} (#{i}) — skipped")
            continue
        total_unknown = dec.get("total_unknown") or d_.get("final_total") is None
        rows.append({
            "idx": i,
            "file": d_["file"],
            "sha256": d_["sha256"],
            "doc_date": d_["doc_date"],
            "vehicle_id": vid,
            "car": car,
            "renter": d_.get("renter"),
            "phone": d_.get("phone") or d_.get("_ext_phone"),
            "contract_no": d_.get("_ext_contract_no"),
            "total": None if total_unknown else (d_.get("final_total") or 0),
            "total_unknown": total_unknown,
            "deposit": d_.get("final_deposit") or 0,
            "note": dec.get("note"),
        })
    for m in MANUAL_IMPORTS:
        vid = m["vehicle"]
        car = cars.get(vid)
        if not car:
            print(f"  !! no car row for manual {vid} — skipped")
            continue
        p = os.path.join(DOCS_DIR, m["file"])
        rows.append({
            "idx": None,
            "file": m["file"],
            "sha256": hashlib.sha256(open(p, "rb").read()).hexdigest(),
            "doc_date": m["doc_date"],
            "vehicle_id": vid,
            "car": car,
            "renter": m["renter"],
            "phone": m.get("phone"),
            "contract_no": m.get("contract_no"),
            "total": m.get("total"),
            "total_unknown": bool(m.get("total_unknown")),
            "deposit": m.get("deposit") or 0,
            "note": m.get("note"),
        })
    return rows


def rental_payload(r):
    day = r["doc_date"]
    start = f"{day}T09:00:00+00:00"
    end = f"{day}T19:00:00+00:00"
    md = {
        "source": "retro_backfill_v2",
        "renter_name": r["renter"],
        "renter_phone": r["phone"],
        "contract_no": r["contract_no"],
        "duration_note": "1 сутки (по договору; точные часы ретро-импортом не фиксируются)",
        "history": [
            {"at": NOW, "by": "retro_backfill_v2", "status": "completed",
             "note": "retrospective insert from «все договора.zip» (doc archive), boss request for season stats"},
        ],
        "specs": {
            "retro_backfill_v2": {
                "origin": "все договора.zip (145 docx, boss archive)",
                "doc_file": r["file"],
                "doc_sha256": r["sha256"],
                "doc_total_rub": r["total"],
                "total_unknown": r["total_unknown"] or None,
                "deposit_rub": r["deposit"] or None,
                "vehicle_note": r.get("note"),
                "confidence": "medium" if r["total_unknown"] else "high",
                "backfilled_at": NOW,
                "backfilled_by": "retro_backfill_v2.py (agent, boss request: finish zip-doc retroimport)",
            }
        },
    }
    md["specs"]["retro_backfill_v2"] = {k: v for k, v in md["specs"]["retro_backfill_v2"].items() if v not in (None, False)}
    return {
        "user_id": WALKIN_USER,
        "vehicle_id": r["vehicle_id"],
        "owner_id": WALKIN_USER,
        "status": "completed",
        "payment_status": "fully_paid",  # column NOT NULL; total_unknown flagged in metadata
        "total_cost": r["total"] or 0,
        "requested_start_date": start,
        "requested_end_date": end,
        "agreed_start_date": start,
        "agreed_end_date": end,
        "created_at": start,
        "updated_at": NOW,
        "crew_id": CREW_VIP_BIKE,
        "deposit_amount": r["deposit"] or 0,
        "deposit_returned": bool(r["deposit"]),
        "metadata": md,
    }


def artifact_payload(r, rental_id, storage_path):
    dd, mm, yy = r["doc_date"].split("-")
    return {
        "contract_key": f"retro-{r['doc_date']}-{r['vehicle_id']}-{r['sha256'][:8]}",
        "requested_bike_id": r["vehicle_id"],
        "resolved_bike_id": r["vehicle_id"],
        "renter_full_name": r["renter"],
        "renter_phone": r["phone"],
        "rent_start_date": f"{dd}.{mm}.{yy}",
        "rent_end_date": f"{dd}.{mm}.{yy}",
        "total_sum": r["total"] or 0,
        "deposit_rub": str(r["deposit"]) if r["deposit"] else None,
        "original_sha256": r["sha256"],
        "rental_id": rental_id,
        "storage_path": storage_path,
        "crew_slug": "vip-bike",
    }


def phase_apply():
    rows = build_rows()
    print(f"Import rows: {len(rows)}")
    for r in rows:
        print(f"  {r['doc_date']} {r['vehicle_id']:34} {str(r['total']):>6} "
              f"{'UNKNOWN' if r['total_unknown'] else '':8} {r['file'][:55]}")

    # idempotency: sha already imported?
    cache = json.load(open(CACHE))
    known_shas = {a["original_sha256"] for a in (cache["artifacts"] or [])}
    for r in cache["rentals"]:
        md = r.get("metadata") or {}
        for k in ("original_sha256", "doc_sha256"):
            if md.get(k):
                known_shas.add(md[k])
    rows = [r for r in rows if r["sha256"] not in known_shas]
    print(f"After sha idempotency: {len(rows)} rows")
    if not rows:
        print("nothing to import")
        return

    if not APPLY:
        print("\nDRY RUN ONLY — rerun with --apply")
        return

    manifest = {"applied_at": NOW, "source": "все договора.zip via extraction_v1.json",
                "imported": [], "linked": [], "skipped": [], "uploaded": [], "upload_failed": []}
    done = set()

    for r in rows:
        day = r["doc_date"]
        # idempotency: already imported by sha? (metadata.specs.retro_backfill_v2.doc_sha256)
        found = rest("rentals", {
            "select": "rental_id",
            "metadata->specs->retro_backfill_v2->>doc_sha256": f"eq.{r['sha256']}"})
        if found:
            rid = found[0]["rental_id"]
            print(f"  found existing rental {rid[:8]} for sha {r['sha256'][:10]} — linking only")
            manifest["linked"].append({"file": r["file"], "rental_id": rid})
        else:
            # live same-vehicle-same-day guard
            clash = rest("rentals", {"select": "rental_id", "vehicle_id": f"eq.{r['vehicle_id']}",
                                     "and": f"(agreed_start_date.gte.{day}T00:00:00+00:00,agreed_start_date.lte.{day}T23:59:59+00:00)"})
            if clash:
                print(f"  SKIP (db has same vehicle+day {day} {r['vehicle_id']}): {r['file'][:60]}")
                manifest["skipped"].append({"file": r["file"], "reason": "same vehicle+day already in DB"})
                continue
            payload = rental_payload(r)
            try:
                res = rest("rentals", {"select": "rental_id,vehicle_id"}, method="POST", body=[payload],
                           prefer="return=representation")
                rid = res[0]["rental_id"] if isinstance(res, list) and res else None
            except urllib.error.HTTPError as e:
                rid = None
                print(f"  INSERT FAILED {r['file'][:50]}: {e.code} {e.read().decode()[:200]}")
            if not rid:
                manifest["skipped"].append({"file": r["file"], "reason": "insert failed"})
                continue
            print(f"  rental {rid[:8]} ← {r['file'][:60]}")
            manifest["imported"].append({
                "file": r["file"], "sha256": r["sha256"], "rental_id": rid,
                "vehicle_id": r["vehicle_id"], "doc_date": r["doc_date"],
                "total_cost": r["total"] or 0, "total_unknown": r["total_unknown"],
                "deposit": r["deposit"] or None,
                "note": r.get("note"),
            })

        # storage upload (ASCII slug key, original name kept in manifest)
        spath = STORAGE_PREFIX + ascii_key(r["file"])
        try:
            storage_upload(spath, open(os.path.join(DOCS_DIR, r["file"]), "rb").read())
            done.add(r["file"])
            for m in manifest["imported"] + manifest["linked"]:
                if m["file"] == r["file"]:
                    m["storage_path"] = spath
                    m["original_filename"] = r["file"]
        except Exception as e:
            print(f"  STORAGE FAILED {spath}: {e}")
            manifest["upload_failed"].append({"file": r["file"], "error": str(e)[:200]})

        # artifact row (private schema, Content-Profile)
        if rid:
            try:
                rest("rental_contract_artifacts", {}, method="POST",
                     body=[artifact_payload(r, rid, spath)], prefer="return=representation", profile="private")
            except urllib.error.HTTPError as e:
                if e.code != 409:  # duplicate contract_key is fine (re-run)
                    print(f"  ARTIFACT FAILED for {rid[:8]}: {e.code} {e.read().decode()[:150]}")

    # upload ALL remaining docs (archive → storage), one by one
    all_files = sorted(os.listdir(DOCS_DIR))
    print(f"\nUploading remaining archive docs (of {len(all_files)})…")
    for f in all_files:
        if f in done:
            continue
        spath = STORAGE_PREFIX + ascii_key(f)
        try:
            storage_upload(spath, open(os.path.join(DOCS_DIR, f), "rb").read())
            manifest["uploaded"].append({"file": f, "storage_path": spath})
        except Exception as e:
            print(f"  STORAGE FAILED {spath}: {str(e)[:120]}")
            manifest["upload_failed"].append({"file": f, "error": str(e)[:200]})
        if len(manifest["uploaded"]) % 25 == 0 and manifest["uploaded"]:
            print(f"  … {len(manifest['uploaded'])} uploaded")

    mpath = os.path.join(HERE, "backfill_v2_manifest.json")
    json.dump(manifest, open(mpath, "w"), ensure_ascii=False, indent=1)
    money = sum(m["total_cost"] for m in manifest["imported"])
    print(f"\nImported {len(manifest['imported'])} rentals, known money {money:,} ₽")
    print(f"Uploaded total {len(manifest['imported']) + len(manifest['uploaded'])} files, "
          f"failed {len(manifest['upload_failed'])}")
    print(f"manifest → {mpath}")


def phase_verify():
    """Post-import month counters — HEAD count=exact only (cheap)."""
    print("Month counters (crew non-cancelled rentals, HEAD count=exact):")
    for month in ("2026-05", "2026-06", "2026-07", "2026-08"):
        frm, to = f"{month}-01", (datetime(2026, int(month[5:7]) + 1, 1)).strftime("%Y-%m-%d")
        n = rest_count("rentals", {
            "select": "rental_id", "crew_id": f"eq.{CREW_VIP_BIKE}", "status": "neq.cancelled",
            "and": f"(agreed_start_date.gte.{frm}T00:00:00+00:00,agreed_start_date.lt.{to}T00:00:00+00:00)"})
        print(f"  {month}: {n}")
    n_retro = rest_count("rentals", {"select": "rental_id", "metadata->>source": "eq.retro_backfill_v2"})
    n_art = rest_count("rental_contract_artifacts", {"select": "id", "contract_key": "like.retro-*"}, profile="private")
    print(f"retro_backfill_v2 rentals: {n_retro}")
    print(f"retro artifacts: {n_art}")


def main():
    phase = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if phase == "cache":
        phase_cache()
    elif phase == "plan":
        phase_plan()
    elif phase == "apply":
        phase_apply()
    elif phase == "verify":
        phase_verify()
    else:
        print("phases: cache | plan | apply | verify")


if __name__ == "__main__":
    main()
