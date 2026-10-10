#!/usr/bin/env python3
# task91: merge section PDFs into catalogue v2 + verify every QR (zxing-cpp)
import sys, os, json, subprocess, glob

SECTIONS_DIR = "/home/z/my-project/download/task91-sections"
OUT = "/home/z/my-project/download/vip-bike-qr-catalogue-2026-10-v2.pdf"
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
w.add_metadata({"/Title": "VIP BIKE — каталог техники сезона 2026 (аренда и продажа)", "/Author": "VibeRider / oneBikePlsBot"})
with open(OUT, "wb") as fh:
    w.write(fh)
print(f"MERGED → {OUT} ({total} pages, {os.path.getsize(OUT)/1e6:.2f} MB)")
assert total == 29, f"expected 29 pages, got {total}"

# ── 2) render pages → png (landscape) ──
RENDER_DIR = "/tmp/task91-render"
os.makedirs(RENDER_DIR, exist_ok=True)
for f in glob.glob(f"{RENDER_DIR}/*.png"):
    os.remove(f)
if subprocess.call(["which", "pdftoppm"], stdout=subprocess.DEVNULL) == 0:
    subprocess.run(["pdftoppm", "-png", "-r", "110", OUT, f"{RENDER_DIR}/p"], check=True)
else:
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(OUT)
    for i in range(len(pdf)):
        img = pdf[i].render(scale=110/72).to_pil()
        img.save(f"{RENDER_DIR}/p-{i+1:02d}.png")
    pdf.close()
pages = sorted(glob.glob(f"{RENDER_DIR}/p-*.png"))
print(f"rendered {len(pages)} pages")

# ── 3) expected payloads: page -> list of payloads ──
bikes = [b for b in json.load(open("/home/z/cartest/scripts/task91-bikes.json")) if not b["hidden"]]
sections = [
    ("ev-rent",  "ev",  "rent", 3, 6),
    ("ev-sale",  "ev",  "sale", 10, 7),
    ("ice-rent", "ice", "rent", 18, 7),
    ("ice-sale", "ice", "sale", 26, 3),
]
expected = {}  # pageNo -> set of payloads on that page (2 per card page)
for key, pw, flow, start, npages in sections:
    items = [b for b in bikes if b["powertrain"] == pw and (b["for_rent"] if flow == "rent" else b["for_sale"])]
    items.sort(key=lambda b: -(b["daily_price"] if flow == "rent" else b["sale_price"]))
    assert len(items) <= npages * 2, f"{key}: {len(items)} > {npages*2}"
    for k, b in enumerate(items):
        pg = start + 1 + k // 2
        expected.setdefault(pg, []).append(f"{flow}_{b['id']}")

# ── 4) decode & compare ──
import cv2, zxingcpp
found = {}
ok_pages, warn = 0, []
for ppath in pages:
    num = int(os.path.basename(ppath).split("-")[1].split(".")[0])
    img = cv2.imread(ppath)
    try:
        decoded = [r.text for r in zxingcpp.read_barcodes(img)]
    except Exception:
        decoded = []
    if not decoded:
        # fallback: upscale 2x full page
        img2 = cv2.resize(img, None, fx=1.6, fy=1.6, interpolation=cv2.INTER_CUBIC)
        try:
            decoded = [r.text for r in zxingcpp.read_barcodes(img2)]
        except Exception:
            decoded = []
    payloads = [d for d in decoded if "startapp=" in d]
    got = {d.split("startapp=")[1] for d in payloads}
    found[num] = got
    if num == 1:
        hit = any("rent-bike" in g for g in got)
        print(f"p{num:02d} cover demo: {'OK' if hit else 'FAIL ' + str(got)}")
        ok_pages += hit
    elif num in expected:
        want = set(expected[num])
        if want <= got:
            ok_pages += 1
            print(f"p{num:02d} OK: {sorted(got)}")
        else:
            warn.append((num, want, got))
            print(f"p{num:02d} FAIL: want {sorted(want)} got {sorted(got)}")

want_all = set()
for v in expected.values(): want_all |= set(v)
got_all = set()
for num, got in found.items():
    if num != 1: got_all |= got
missing = want_all - got_all
dupes = len(got_all) < len(got_all)  # set dedupe check below
print(f"\nQR VERIFY: pages ok {ok_pages}/{len(expected)+1}")
print(f"expected payloads {len(want_all)}, unique decoded {len(got_all)}, missing: {sorted(missing) if missing else 'none'}")
sys.exit(1 if (warn or missing) else 0)
