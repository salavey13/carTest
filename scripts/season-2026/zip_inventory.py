#!/usr/bin/env python3
"""Inventory all contract files from zip: sha256, dates, model, type, extracted text snippet."""
import os, re, json, hashlib, zipfile

SRC = "/home/z/my-project/docs_extract"
OUT = "/home/z/my-project/scripts/doc_inventory.json"

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def docx_text(path, limit=4000):
    try:
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    except Exception:
        return ""
    xml = re.sub(r"<w:p[ >]", "\n<w:p ", xml)
    txt = re.sub(r"<[^>]+>", "", xml)
    txt = re.sub(r"&amp;", "&", txt)
    txt = re.sub(r"[ \t]+", " ", txt)
    return txt[:limit]

def extract_dates(name, text=""):
    """Return list of date strings found: dd.mm.yyyy / d.m.yyyy / yyyy-mm-dd / yyyy DD month-rus."""
    dates = set()
    for m in re.finditer(r"\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b", name):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= d <= 31 and 1 <= mo <= 12 and 2020 <= y <= 2027:
            dates.add(f"{y:04d}-{mo:02d}-{d:02d}")
    for m in re.finditer(r"\b(\d{4})-(\d{2})-(\d{2})\b", name):
        dates.add(m.group(0))
    # Russian month in filename: "17.05—" already covered; "20.05.2026" covered
    return sorted(dates)

MODELS = [
    ("Ducati-Panigale-S-Electro-Black-Aero", "Ducati Panigale S Electro Black Aero"),
    ("Ducati-Panigale-S-Electro-Black-Z", "Ducati Panigale S Electro Black Z"),
    ("Ducati-Panigale-S-Electro-Green-Z", "Ducati Panigale S Electro Green Z"),
    ("Ducati-Panigale-S-Electro-Gold", "Ducati Panigale S Electro Gold"),
    ("Ducati-Panigale-S-Electro-Red", "Ducati Panigale S Electro Red"),
    ("Ducati-Panigale-S-Electro-Black", "Ducati Panigale S Electro Black"),
    ("Ducati-Panigale-S-Electro", "Ducati Panigale S Electro"),
    ("79BIKE-Falcon-Lynx", "Falcon Lynx"),
    ("79BIKE-Falcon-GT", "Falcon GT"),
    ("79BIKE-Falcon-Pro", "Falcon Pro"),
    ("Falcon-Pro", "Falcon Pro"),
    ("Falcon-GT", "Falcon GT"),
    ("Falcon-Lite", "Falcon Lite"),
    ("BMW-F800R", "BMW F800R"),
    ("BMW-S1000RR", "BMW S1000RR"),
    ("Kawasaki-EX650K-Ninja-650", "Kawasaki EX650K Ninja 650"),
    ("KAWASAKI-EX650K", "Kawasaki EX650K Ninja 650"),
    ("KAWASAKI EX650K", "Kawasaki EX650K Ninja 650"),
    ("Aprilia-Shiver-750", "Aprilia Shiver 750"),
    ("BENDA-LFC700", "BENDA LFC700"),
    ("Honda-CBR600RR", "Honda CBR600RR"),
    ("Horwin-SK3plus", "Horwin SK3plus"),
    ("Horwin-SK3", "Horwin SK3"),
    ("Horwin-CR1", "Horwin CR1"),
    ("Horwin-EK1", "Horwin EK1"),
    ("Motoland-Breakout-300", "Motoland Breakout 300"),
    ("Regulmoto-Nibbler-300-4V", "Regulmoto Nibbler 300"),
    ("Rerode-R1", "Rerode R1"),
    ("Sequence-Zero", "Sequence Zero"),
    ("Suzuki-GSX-S1000F", "Suzuki GSX-S1000F"),
    ("Suzuki-GSXS-1000F", "Suzuki GSX-S1000F"),
    ("Suzuki-M109R-1800-Boulevard", "Suzuki M109R Boulevard"),
    ("Suzuki-VZR1800-Boulevard", "Suzuki VZR1800 Boulevard"),
    ("Wenbox-U2-Pro", "Wenbox U2 Pro"),
    ("Yamaha-R7", "Yamaha R7"),
    ("Yamaha-R6", "Yamaha R6"),
    ("Y-VOLT-Surge-V", "Y-VOLT Surge V"),
    ("Jilang-Max-Pro", "Jilang Max Pro"),
    ("Leopard-Asaka", "Leopard Asaka"),
    ("nibbler", "Regulmoto Nibbler 300"),
    ("Nibbler", "Regulmoto Nibbler 300"),
    ("DUКАТИ", "Ducati Panigale"),
    ("ДУКАТИ", "Ducati Panigale"),
    ("Ducati Panigale", "Ducati Panigale"),
    ("Ducati", "Ducati"),
    ("Zero", "Sequence Zero"),
    ("Хорвин", "Horwin"),
    ("Кава", "Kawasaki EX650K Ninja 650"),
]

def guess_model(name, text=""):
    n = name.lower()
    for pat, model in MODELS:
        if pat.lower() in n:
            return model
    return None

def guess_type(name):
    b = os.path.basename(name).lower()
    if b.startswith("sale-"): return "sale"
    if b.startswith("testdrive-"): return "testdrive"
    if b.startswith("rent-") or b.startswith("rental-"): return "rent"
    if "договор" in b: return "rent_or_template"
    return "other"

rows = []
for fn in sorted(os.listdir(SRC)):
    p = os.path.join(SRC, fn)
    if not os.path.isfile(p):
        continue
    ext = fn.split(".")[-1].lower()
    text = ""
    if ext == "docx":
        text = docx_text(p)
    elif ext == "pdf":
        try:
            import subprocess
            text = subprocess.run(["pdftotext", "-l", "2", p, "-"], capture_output=True, text=True, timeout=30).stdout[:4000]
        except Exception:
            text = ""
    elif ext == "txt":
        text = open(p, encoding="utf-8", errors="ignore").read()[:4000]
    rec = {
        "file": fn,
        "size": os.path.getsize(p),
        "sha256": sha256(p),
        "type": guess_type(fn),
        "dates_in_name": extract_dates(fn),
        "model": guess_model(fn),
        "text_head": text[:1500],
    }
    # try to extract client name from docx text (Паспорт / ФИО lines) and contract date from text
    m = re.search(r"(\d{1,2})\.(\d{2})\.(\d{4})", text)
    rec["first_date_in_text"] = f"{m.group(3)}-{m.group(2)}-{int(m.group(1)):02d}" if m else None
    rows.append(rec)

json.dump(rows, open(OUT, "w"), ensure_ascii=False, indent=1)
print(f"Wrote {len(rows)} records -> {OUT}")

# quick stats
from collections import Counter
print("Types:", Counter(r["type"] for r in rows))
print("With dates in name:", sum(1 for r in rows if r["dates_in_name"]))
print("Models found:", Counter(r["model"] for r in rows).most_common(30))
pre_june = [r for r in rows if r["dates_in_name"] and all(d < "2026-06-15" for d in r["dates_in_name"])]
print("\nPre-mid-June files:", len(pre_june))
for r in pre_june:
    print("  *", r["file"][:110], "| dates:", r["dates_in_name"])
