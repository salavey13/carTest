#!/usr/bin/env python3
# task90: merge section PDFs into one catalogue + verify every QR decodes
import sys, os, json, subprocess, glob

SECTIONS_DIR = "/home/z/my-project/download/task90-sections"
OUT = "/home/z/my-project/download/vip-bike-qr-catalogue-2026-10.pdf"
ORDER = ["00-cover-toc.pdf", "01-electro-rent.pdf", "02-electro-sale.pdf", "03-ice-rent.pdf", "04-ice-sale.pdf"]

# ── 1) merge ──
from pypdf import PdfWriter, PdfReader
w = PdfWriter()
total = 0
for f in ORDER:
    p = os.path.join(SECTIONS_DIR, f)
    r = PdfReader(p)
    print(f"{f}: {len(r.pages)} pages")
    total += len(r.pages)
    for pg in r.pages:
        w.add_page(pg)
w.add_metadata({"/Title": "VIP BIKE ELECTRO — каталог QR-кодов (аренда и продажа)", "/Author": "VibeRider / oneBikePlsBot"})
with open(OUT, "wb") as fh:
    w.write(fh)
print(f"MERGED → {OUT} ({total} pages, {os.path.getsize(OUT)/1e6:.2f} MB)")
assert total == 59, f"expected 59 pages, got {total}"

# ── 2) render pages → png ──
RENDER_DIR = "/tmp/task90-render"
os.makedirs(RENDER_DIR, exist_ok=True)
for f in glob.glob(f"{RENDER_DIR}/*.png"):
    os.remove(f)
if subprocess.call(["which", "pdftoppm"], stdout=subprocess.DEVNULL) == 0:
    subprocess.run(["pdftoppm", "-png", "-r", "100", OUT, f"{RENDER_DIR}/p"], check=True)
else:
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(OUT)
    for i in range(len(pdf)):
        page = pdf[i]
        img = page.render(scale=100/72).to_pil()
        img.save(f"{RENDER_DIR}/p-{i+1:02d}.png")
    pdf.close()
pages = sorted(glob.glob(f"{RENDER_DIR}/p-*.png"))
print(f"rendered {len(pages)} pages")

# ── 3) decode QRs: zxing-cpp primary (cv2 is unreliable on EC-H dense codes) ──
import cv2, numpy as np, zxingcpp
det = cv2.QRCodeDetector()

# expected payload map (same ordering logic as the generator)
bikes = json.load(open("/home/z/cartest/scripts/task90-bikes.json"))
sections = [
    ("ev-rent",  "ev",  "rent", 4),
    ("ev-sale",  "ev",  "sale", 19),
    ("ice-rent", "ice", "rent", 37),
    ("ice-sale", "ice", "sale", 53),
]
expected = {}  # page -> payload
for key, pw, flow, start in sections:
    items = [b for b in bikes if b["powertrain"] == pw and ((b["for_rent"] if flow == "rent" else b["for_sale"]))]
    items.sort(key=lambda b: -(b["daily_price"] if flow == "rent" else b["sale_price"]))
    for k, b in enumerate(items):
        expected[start + k] = f"{flow}_{b['id']}"

ok, bad = 0, []
for ppath in pages:
    num = int(os.path.basename(ppath).split("-")[1].split(".")[0])
    img = cv2.imread(ppath)
    try:
        decoded = [r.text for r in zxingcpp.read_barcodes(img)]
    except Exception:
        decoded = []

    def crop_decode(im):
        """fallback: crop QR region (left column of bike pages) + preprocess"""
        out = []
        H, W = im.shape[:2]
        s = 100 / 72.0
        x0, y0 = int(30 * s), int(100 * s)
        x1, y1 = min(W, int(310 * s)), min(H, int(400 * s))
        crop = im[y0:y1, x0:x1]
        if crop.size == 0:
            return out
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        for variant in [crop, gray, cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
                        cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)]:
            try:
                out += [r.text for r in zxingcpp.read_barcodes(variant)]
            except Exception:
                pass
            if out:
                break
        return out

    if not decoded and (num in expected or num == 1):
        decoded = crop_decode(img)
    if num in expected:
        want = expected[num]
        hit = any(want in d for d in decoded)
        if hit:
            ok += 1
        else:
            bad.append((num, want, decoded))
    elif num == 1:
        hit = any("startapp=rent-bike" in d for d in decoded)
        if hit: ok += 1
        else: bad.append((num, "rent-bike cover", decoded))

print(f"QR VERIFY: {ok}/{len(expected)+1} decoded correctly")
for b in bad:
    print("  FAIL page", b[0], "want", b[1], "got", b[2][:2])
# sanity: known ids all present
ids = {b["id"] for b in bikes}
payload_ids = {v.split("_", 1)[1] for v in expected.values()}
missing = ids - payload_ids
print("bikes missing from catalogue:", missing if missing else "none")
sys.exit(1 if bad else 0)
