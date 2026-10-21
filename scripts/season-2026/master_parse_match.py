#!/usr/bin/env python3
"""Master parse: structured fields from every zip doc; match vs Supabase rentals.
Outputs: /home/z/my-project/scripts/zip_structured.json + match buckets."""
import json, zipfile, re, os
from datetime import datetime, timedelta

SRC = "/home/z/my-project/docs_extract"
inv = json.load(open("/home/z/my-project/scripts/doc_inventory.json"))
rentals = json.load(open("/home/z/my-project/scripts/rentals_full.json"))

def full_text(fn):
    p = os.path.join(SRC, fn)
    if fn.endswith(".pdf"):
        import subprocess
        try:
            return subprocess.run(["pdftotext", p, "-"], capture_output=True, text=True, timeout=30).stdout
        except Exception:
            return ""
    if fn.endswith(".txt"):
        return open(p, encoding="utf-8", errors="ignore").read()
    try:
        with zipfile.ZipFile(p) as z:
            xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    except Exception:
        return ""
    xml = re.sub(r"<w:p[ >]", "\n<w:p ", xml)
    t = re.sub(r"<[^>]+>", "", xml)
    return re.sub(r"[ \t]+", " ", t)

MON = {"01":1,"1":1,"02":2,"2":2,"03":3,"3":3,"04":4,"4":4,"05":5,"5":5,"06":6,"6":6,
       "07":7,"7":7,"08":8,"8":8,"09":9,"9":9,"10":10,"11":11,"12":12}
RUS_MON = {"январ":1,"феврал":2,"март":3,"апрел":4,"ма":5,"илюн":6,"июн":6,"июл":7,"август":8,"сентябр":9,"октябр":10,"ноябр":11,"декабр":12}

def parse_contract_no(t):
    m = re.search(r"ДОГОВОР\s*(?:№|N|#)?\s*([0-9]{1,2}\.[0-9]{1,2}(?:[_\-.]\d)?(?:/[A-Z0-9\-+]+)?|[0-9]{1,3}[-–][0-9]{2}/[0-9]+|[0-9]{3}|[0-9]+\.[0-9]+|[0-9]+-[0-9]+)\b", t)
    return m.group(1) if m else None

def parse_date_line(t):
    """«DD» MM YYYY or «DD» месяц YYYY or DD месяц YYYY"""
    m = re.search(r"«?\s*(\d{1,2})\s*»?\s*([0-9]{1,2}|январ\w*|феврал\w*|март\w*|апрел\w*|ма[йя]\w*|июн\w*|июл\w*|август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*)\.?\s*(20\d\d)", t)
    if not m:
        return None
    d = int(m.group(1))
    mm = m.group(2)
    if mm.isdigit():
        mon = MON.get(mm)
    else:
        mon = next((v for k, v in RUS_MON.items() if mm.lower().startswith(k)), None)
    if not mon:
        return None
    y = int(m.group(3))
    try:
        return datetime(y, mon, d).date().isoformat()
    except ValueError:
        return None

def parse_period(t):
    m = re.search(r"Период:\s*\n?\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})\s*([0-9]{2}:[0-9]{2})?\s*[—–-]\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})?\s*([0-9]{2}:[0-9]{2})?", t)
    if m:
        d1 = datetime.strptime(m.group(1), "%d.%m.%Y")
        d2 = datetime.strptime(m.group(3), "%d.%m.%Y") if m.group(3) else d1
        return d1.date().isoformat(), d2.date().isoformat()
    m = re.search(r"Срок аренды:\s*с\s*«?([0-9]{2}\.[0-9]{2}\.[0-9]{4})»?\s*([0-9]{1,2}:[0-9]{2})?\s*по\s*«?([0-9]{2}\.[0-9]{2}\.[0-9]{4})»?", t)
    if m:
        d1 = datetime.strptime(m.group(1), "%d.%m.%Y")
        d2 = datetime.strptime(m.group(3), "%d.%m.%Y")
        return d1.date().isoformat(), d2.date().isoformat()
    m = re.search(r"Срок аренды:\s*с\s*«?(\d{1,2})»?\s*(\w{1,10})\s*(\d{4})\s*г?\.?\s*([0-9]{1,2}:[0-9]{2})?\s*по\s*«?(\d{1,2})»?\s*(\w{1,10})\s*(\d{4})", t)
    if m:
        def mm(x):
            return int(x) if x.isdigit() else next((v for k, v in RUS_MON.items() if x.lower().startswith(k)), None)
        m1, m2 = mm(m.group(2)), mm(m.group(6))
        if m1 and m2:
            try:
                d1 = datetime(int(m.group(3)), m1, int(m.group(1)))
                d2 = datetime(int(m.group(7)), m2, int(m.group(5)))
                return d1.date().isoformat(), d2.date().isoformat()
            except ValueError:
                pass
    return None, None

def parse_ts(t):
    """ТС: line in КРАТКАЯ ИНФОРМАЦИЯ"""
    m = re.search(r"ТС:\s*\n?\s*([A-Za-z0-9\- ']+(?:\s+[A-Za-z0-9\- ']+)*)", t)
    if m:
        v = m.group(1).strip()
        return v if v.lower() not in ("vip", "м") else None
    return None

def parse_renter(t):
    m = re.search(r"Арендатор:\s*\n?\s*([А-ЯЁ][а-яё\-]+(?:\s+[А-ЯЁ][а-яё\-]+){0,2})\.?", t)
    if m:
        return m.group(1).strip(" .")
    m = re.search(r'и\s+([А-ЯЁ][а-яё\-]+(?:\s+[А-ЯЁ][а-яё\-]+){1,2}(?:\s+[А-ЯЁ]\.[А-ЯЁ]\.?)?)\s*,?\s*именуемый в дальнейшем\s+«?Арендатор', t)
    if m:
        return m.group(1).strip(" .")
    m = re.search(r'и\s+([А-ЯЁ][А-ЯЁа-яё\-]+(?:\s+[А-ЯЁ][а-яё\-]+){1,2})\s*,?\s*именуемый в дальнейшем', t)
    if m:
        return m.group(1).strip(" .")
    return None

def parse_total(t):
    m = re.search(r"Итого к оплате:\s*\n?\s*([0-9][0-9\s\u00a0]{1,15})\s*(?:₽|руб)", t)
    if m:
        v = re.sub(r"[^\d]", "", m.group(1))
        return int(v) if v else None
    m = re.search(r"оплате:\s*\n?\s*([0-9][0-9\s\u00a0]{1,15})\s*руб", t)
    if m:
        v = re.sub(r"[^\d]", "", m.group(1))
        v = int(v) if v else None
        if v and 500 <= v <= 500000:
            return v
    return None

def parse_deposit(t):
    m = re.search(r"[Зз]алог:?\s*\n?\s*([0-9][0-9\s\u00a0]{1,12})\s*(?:₽|руб)", t)
    if m:
        v = re.sub(r"[^\d]", "", m.group(1))
        return int(v) if v else None
    m = re.search(r"[Дд]епозит\)?\s*:?\s*([0-9][0-9\s\u00a0]{1,12})\s*(?:₽|руб)", t)
    if m:
        v = re.sub(r"[^\d]", "", m.group(1))
        return int(v) if v else None
    return None

def parse_phone(t):
    m = re.search(r"Телефон:\s*\n?\s*(\+?[78][\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-()]?\d{2}[\s\-()]?\d{2})", t)
    if m:
        return re.sub(r"[^\d+]", "", m.group(1))
    return None

def norm(s):
    if not s:
        return ""
    import unicodedata
    s = unicodedata.normalize("NFKC", s).lower().replace("ё", "е")
    return re.sub(r"[^а-яa-z0-9]+", "", s)

# vehicle slug guess from text/file
def veh_slug(model, t):
    if model:
        return model
    if "nibbler" in t.lower() or "ниблер" in t.lower(): return "Regulmoto Nibbler 300"
    return None

DB_SLUG_MAP = {}
for r in rentals:
    vid = r.get("vehicle_id")
    if vid:
        DB_SLUG_MAP[vid] = norm(vid)

def to_vid(model, db_vids):
    """Fuzzy-map zip model string to actual DB vehicle_id slug."""
    if not model:
        return None
    n = norm(model)
    n = n.replace("ducatipanigales electro", "ducatipanigaleselectro")
    best, bs = None, 0
    for vid in db_vids:
        v = norm(vid)
        if not v:
            continue
        if n == v:
            return vid
        s = 0
        if n and v and (n in v or v in n):
            s = min(len(v), len(n)) / max(len(v), len(n))
        elif n[:5] and n[:5] == v[:5]:
            s = 0.45
        if s > bs:
            best, bs = vid, s
    return best if bs >= 0.5 else None

DB_VIDS = sorted(set(r.get("vehicle_id") for r in rentals if r.get("vehicle_id")))

# explicit aliases: model-name fragment -> actual DB vehicle_id
ALIAS = [
    ("nibbler", "nibbler-regumoto-4v"), ("regulmoto", "nibbler-regumoto-4v"),
    ("motolandbreakout", "motoland-breakout"), ("breakout", "motoland-breakout"),
    ("falcongt", "falcon-gt-2026"), ("falconpro", "falcon-pro-2026"), ("falconlynx", "falcon-lynx-purple"), ("falconlite", "falcon-lynx-purple"),
    ("april", "aprilia-shiver"),
    ("rerode", "rerode-r1-plus"),
    ("kawasaki", "kawasaki-ex650k"), ("кава", "kawasaki-ex650k"),
    ("horwincr1", "horwin-cr1"), ("horwinsk3plus", "horwin-sk3plus"), ("horwinsk3", "horwin-sk3"), ("хорвин", "horwin-sk3"),
    ("selectroblackz", "ducati-panigale-s-electro-black"), ("selectrogreenz", "ducati-panigale-s-electro-green"),
    ("selectro", "ducati-panigale-s-electro"),
    ("ducati1199", "ducati-1199-panigale-2012"), ("ducatipanigale", "ducati-panigale-s-electro"), ("ducati", "ducati-panigale-s-electro"),
    ("m109r", "suzuki-vzr1800-boulevard-2006"), ("vzr1800", "suzuki-vzr1800-boulevard-2006"), ("boulevard", "suzuki-vzr1800-boulevard-2006"),
    ("gsxs1000f", "suzuki-gsx-s1000f"), ("gsxs", "suzuki-gsx-s1000f"), ("suzuki", "suzuki-gsx-s1000f"),
    ("zero", "sequence-zero"),
    ("bmw", "bmw-f800r"),
    ("jilang", "jilang-max-pro"), ("wenbox", "wenbox-u2-pro"),
    ("yamahar", "yamaha-r7"), ("cbr", "honda-cbr600rr-2003"), ("honda", "honda-cbr600rr-2003"),
    ("benda", "benda-lfc700-2024"), ("leopard", "leopard-asaka"),
    ("yvolt", "yvolt-surge-v"), ("surge", "yvolt-surge-v"),
]

def alias_vid(model):
    if not model:
        return None
    n = norm(model)
    for frag, vid in ALIAS:
        if frag in n:
            return vid
    return None


results = []
for f in inv:
    t = full_text(f["file"])
    rec = dict(f)
    rec["contract_no"] = parse_contract_no(t)
    rec["date_line"] = parse_date_line(t)
    if f["dates_in_name"]:
        rec["date_line"] = rec["date_line"] or f["dates_in_name"][0]
    rec["renter"] = parse_renter(t)
    rec["total"] = parse_total(t)
    rec["deposit"] = parse_deposit(t)
    rec["phone"] = parse_phone(t)
    s, e = parse_period(t)
    rec["period_start"], rec["period_end"] = s, e
    rec["vehicle"] = f["model"] or veh_slug(f["model"], t) or parse_ts(t)
    rec["vehicle_id_guess"] = to_vid(rec["vehicle"], DB_VIDS) or alias_vid(rec["vehicle"])
    rec["is_template"] = bool(re.search(r"«?__»?\s*_{3,}\s*2026", t)) and not rec["renter"]
    results.append(rec)

json.dump(results, open("/home/z/my-project/scripts/zip_structured.json", "w"), ensure_ascii=False, indent=1)

# ---------- MATCHING ----------
def surname(n):
    w = norm(n).split()
    return w[0][:6] if w else ""

def db_renter(r):
    md = r.get("metadata") or {}
    return md.get("renter_name")

rental_idx = []
for r in rentals:
    md = r.get("metadata") or {}
    rental_idx.append({
        "id": r["rental_id"], "vid": r.get("vehicle_id"),
        "start": (r.get("agreed_start_date") or r.get("requested_start_date") or "")[:10],
        "created": (r.get("created_at") or "")[:10],
        "renter": db_renter(r), "status": r.get("status"), "total": r.get("total_cost"),
        "source": md.get("source"),
    })

match_report = []
for rec in results:
    entry = {"file": rec["file"][:120], "kind": None, "rental_id": None, "how": None}
    if rec["type"] == "sale":
        entry["kind"] = "SALE_CONTRACT"
    elif rec["type"] == "testdrive":
        entry["kind"] = "TESTDRIVE"
    elif rec["is_template"]:
        entry["kind"] = "TEMPLATE"
    elif rec["date_line"] and rec["date_line"] < "2026-06-15":
        entry["kind"] = "PRE_DOC_ERA"
        entry["how"] = f"{rec['contract_no']} {rec['renter']} {rec['vehicle']} {rec['date_line']}"
    else:
        # doc-era rent: match vs DB
        vid = rec["vehicle_id_guess"]
        cands = []
        for rr in rental_idx:
            sc = 0
            if vid and rr["vid"] == vid:
                sc += 2
            if rec["renter"] and rr["renter"]:
                sn = surname(rec["renter"])
                rn = norm(rr["renter"])
                if sn and (rn.startswith(sn) or rn.split()[0].startswith(sn[:4]) if rn.split() else False):
                    sc += 3
            base = rec["period_start"] or rec["date_line"]
            if base and rr["start"]:
                dd = abs((datetime.fromisoformat(base) - datetime.fromisoformat(rr["start"])).days)
                if dd <= 1:
                    sc += 3
                elif dd <= 3:
                    sc += 1
                if dd > 7:
                    sc -= 2
            cands.append((sc, rr))
        cands.sort(key=lambda x: -x[0])
        if cands and cands[0][0] >= 4:
            entry["kind"] = "MATCHED_DB"
            entry["rental_id"] = cands[0][1]["id"]
            entry["how"] = f"score={cands[0][0]} db={cands[0][1]['vid']} {cands[0][1]['start']} renter={cands[0][1]['renter']}"
        else:
            entry["kind"] = "DOC_ERA_UNMATCHED"
            if cands:
                entry["how"] = f"best score={cands[0][0]} db={cands[0][1]['vid']} {cands[0][1]['start']} {cands[0][1]['renter']}"
    match_report.append(entry)

json.dump(match_report, open("/home/z/my-project/scripts/zip_match_v2.json", "w"), ensure_ascii=False, indent=1)

from collections import Counter
print(Counter(e["kind"] for e in match_report))
print("\nPRE_DOC_ERA (missing from DB):")
for e in match_report:
    if e["kind"] == "PRE_DOC_ERA":
        print("  *", e["file"][:90], "->", e["how"])
print("\nDOC_ERA_UNMATCHED:")
for e in match_report:
    if e["kind"] == "DOC_ERA_UNMATCHED":
        print("  ?", e["file"][:95], "|", e["how"])
print("\nMatched sample (10):")
for e in [x for x in match_report if x["kind"] == "MATCHED_DB"][:10]:
    print("  =", e["file"][:80], "->", e["how"][:90])
