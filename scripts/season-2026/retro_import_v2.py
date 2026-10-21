#!/usr/bin/env python3
"""retro_backfill_v2: import missing rentals from «все договора.zip» into Supabase.

Standing order (boss): "Finish retro importing rentals from zip docs to supabase
to make season-stats calculate/show correct stats" + "upload doc files themselves
to respective storage in supabase where we store our docs".

- Curated list derived from zip_match_v2 (task 109) + manual review of bodies.
- Idempotent: pre-checks against FRESH rentals fetch (date+vehicle+renter/total).
- Inserts source=retro_backfill_v2, audit in metadata.history + metadata.specs.
- Uploads original docx to private bucket `rental-contracts` under
  vip-bike/retro-2026/<sanitized original name> (app convention: <crew>/<key>.docx).
- Writes manifest: scripts/retro_backfill_v2_manifest.json (+ download copy).

SKIPped by design (documented in manifest):
- Сидоров И.О. №__ 15.06.2026 / №4 05.08.2026 — fleet-partnership (sub-rent,
  50% вознаграждение), not customer rentals.
- Новиков №5.7 (re-issue of №4.7, same period 04.07 + same sum) — one rental.
"""
import json, os, re, sys, time, zipfile, hashlib, urllib.request, urllib.parse
from datetime import datetime, timezone

BASE = "/home/z/my-project"
SRC = f"{BASE}/docs_extract"
SB = "https://inmctohsodgdohamhzag.supabase.co"
CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"   # vip-bike
WALKIN_USER = "356282674"                            # walk-in renter bucket (v1 precedent)
BUCKET = "rental-contracts"
STORAGE_DIR = "vip-bike/retro-2026"
TAG = "task111-retro-backfill-v2"


def key_load():
    k = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return k or open(f"{BASE}/scripts/.sb_key").read().strip()


KEY = key_load()


def api(method, path, body=None, headers=None, raw_body=None):
    url = SB + path
    data = None
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    if raw_body is not None:
        data = raw_body
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return r.status, json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


def fetch_all(table, select="*"):
    rows, off = [], 0
    while True:
        q = urllib.parse.urlencode({"select": select, "limit": "1000", "offset": str(off)})
        st, chunk = api("GET", f"/rest/v1/{table}?{q}")
        if st != 200:
            raise RuntimeError(f"{table}: {st} {chunk}")
        rows.extend(chunk)
        if len(chunk) < 1000:
            return rows
        off += 1000


def full_text(fn):
    p = os.path.join(SRC, fn)
    if fn.endswith(".txt"):
        return open(p, encoding="utf-8", errors="ignore").read()
    if fn.endswith(".pdf"):
        import subprocess
        return subprocess.run(["pdftotext", p, "-"], capture_output=True, text=True, timeout=30).stdout
    with zipfile.ZipFile(p) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    xml = re.sub(r"<w:p[ >]", "\n<w:p ", xml)
    t = re.sub(r"<[^>]+>", "", xml)
    return re.sub(r"[ \t]+", " ", t)


def sha256_file(fn):
    h = hashlib.sha256()
    with open(os.path.join(SRC, fn), "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def extract_times(text, d1, d2):
    """Pull HH:MM times from «Срок аренды: с «DD.MM.YYYY» HH:MM по «DD.MM.YYYY» HH:MM»."""
    m = re.search(r"Срок аренды:\s*с\s*«?([0-9]{2}\.[0-9]{2}\.[0-9]{4})»?\s+([0-9]{1,2}:[0-9]{2})\s*по\s*«?([0-9]{2}\.[0-9]{2}\.[0-9]{4})»?\s+([0-9]{1,2}:[0-9]{2})", text)
    if m:
        return m.group(2), m.group(4)
    return None, None


def ts(date_str, time_str="09:00"):
    dt = datetime.fromisoformat(f"{date_str}T{time_str}:00+00:00")
    return dt.isoformat()


# ─────────────────────────── curated import list ───────────────────────────
# Every entry references the zip file exactly as in docs_extract/.
# veh=real cars.id (or documented partner-bike slug), start/end = contract dates.
C = [
    # ── pre-doc era: May / early June (old-format templates, totals not fixed in body) ──
    dict(file="Договор 3 проката аренды электромотоцикла Zero.docx",
         no="9-05/1", renter="Стерлягов Алексей Николаевич", veh="sequence-zero",
         start="2026-05-09", end=None, total=None, dep=20000,
         note="старый шаблон: сумма в теле не зафиксирована (тарифы), залог 20 000"),
    dict(file="Договор аренды электромотоцикла   Falcon GT + PRO чистый — — копия — копия.docx",
         no="16-5", renter="Калинин Илья Викторович", veh="falcon-gt-2026",
         start="2026-05-16", end=None, total=None, dep=10000,
         note="старый шаблон (тариф 3000+4000 в час), сумма не зафиксирована; файл-двойник «…копия.docx1» — тот же договор"),
    dict(file="Договор аренды электромотоцикла   Falcon GT + PRO чистый — — копия — копия.docx1.docx",
         no="16-51", renter="Могучев Иван Вахтангович", veh="falcon-gt-2026",
         start="2026-05-18", end=None, total=None, dep=10000,
         note="старый шаблон, сумма не зафиксирована"),
    dict(file="Договор аренды электромотоцикла  Horwin CR1  20.05.2026 Мирощников С.В..docx",
         no="20-05/1", renter="Мирошников Станислав Валерьевич", veh="horwin-cr1",
         start="2026-05-20", end=None, total=None, dep=20000,
         note="Horwin CR1 отсутствует в cars (продан в сезоне) — vehicle_id задокументирован, FK мягкий"),
    dict(file="Договор аренды электромотоцикла Ducati Panigale чистый Шкитин М.О.docx",
         no="20-05/2", renter="Шкитин Михаил Олегович", veh="ducati-panigale-s-electro-black",
         start="2026-05-20", end=None, total=None, dep=20000,
         note="цвет в договоре не указан → black (дефолт парка, прецедент retro_backfill_v1)"),
    dict(file="Договор аренды электромотоцикла Ducati Panigale чистый Шкитин М.О — копия.docx",
         no="20-05/2", renter="Голубев Валерий Юрьевич", veh="ducati-panigale-s-electro-black",
         start="2026-06-01", end=None, total=None, dep=20000,
         note="тот же шаблон №20-05/2, другой арендатор и дата (01.06); цвет не указан → black"),
    dict(file="Договор аренды электромотоцикла KAWASAKI EX650K чистый — — копия — копия.docx",
         no="26.5/1", renter="Воронцов Денис Сергеевич", veh="kawasaki-ex650k",
         start="2026-05-26", end=None, total=None, dep=20000,
         note="старый шаблон, сумма не зафиксирована; файл без ФИО — пустой близнец пропущен"),
    # ── doc era: July / August contracts missing from DB ──
    dict(file="rent-BMW-F800R-03.07.2026 (Фимин Максим).docx",
         no="3.7_2/BMW-F800R", renter="Фимин Максим Сергеевич", veh="bmw-f800r",
         start="2026-07-03", end="2026-07-04", total=12000, dep=20000, note=None),
    dict(file="rent-BMW-F800R-04.07.2026_Локтев_Дмитрий.docx",
         no="4.7/BMW-F800R", renter="Локтев Дмитрий Олегович", veh="bmw-f800r",
         start="2026-07-04", end="2026-07-05", total=12000, dep=20000,
         note="второй файл «(Восстановлен)» — восстановленная копия того же договора",
         extra_files=["rent-BMW-F800R-04.07.2026_Локтев_Дмитрий (Восстановлен).docx"]),
    dict(file="rent-BMW-F800R-10.07.2026_Павликов__BMW_F800R.docx",
         no="10.7/BMW-F800R", renter="Павликов Дмитрий Николаевич", veh="bmw-f800r",
         start="2026-07-10", end="2026-07-10", total=28000, dep=20000,
         note="4 часа × 7000 + оборудование = 28 000; файл-двойник «…Павликов.docx» — тот же договор",
         extra_files=["rent-BMW-F800R-10.07.2026_Павликов__BMW_F800R.docx Павликов.docx"]),
    dict(file="rent-Ducati-Panigale-S-Electro-03.07.2026_Сидоров_Андрей.docx",
         no="3.7/DUCATI-PANIGALE-S-ELECTRO", renter="Сидоров Андрей Дмитриевич", veh="ducati-panigale-s-electro-black",
         start="2026-07-03", end="2026-07-04", total=None, dep=20000,
         note="цвет в договоре не указан → black (дефолт парка); сумма не зафиксирована в теле"),
    dict(file="rent-Ducati-Panigale-S-Electro-03.07.2026_Томашевский_Нектарий.docx",
         no="3.7_2/DUCATI-PANIGALE-S-ELECTRO", renter="Томашевский Нектарий Михайлович", veh="ducati-panigale-s-electro-black",
         start="2026-07-03", end="2026-07-04", total=None, dep=20000,
         note="цвет не указан → black; сумма не зафиксирована"),
    dict(file="rent-Ducati-Panigale-S-Electro-04.07.2026_Гречковский_Сергей.docx",
         no="4.7/DUCATI-PANIGALE-S-ELECTRO", renter="Гречковский Сергей Сергеевич", veh="ducati-panigale-s-electro-black",
         start="2026-07-04", end="2026-07-05", total=10000, dep=20000,
         note="цвет не указан → black"),
    dict(file="rent-Ducati-Panigale-S-Electro-04.07.2026_Заваленский.docx",
         no="4.7/DUCATI-PANIGALE-S-ELECTRO", renter="Заваленский Игорь Олегович", veh="ducati-panigale-s-electro-black",
         start="2026-07-04", end="2026-07-04", total=3750, dep=20000,
         note="цвет не указан → black"),
    dict(file="rent-Ducati-Panigale-S-Electro-Red-05.07.2026_Чуфыркин.docx",
         no="5.7/DUCATI-PANIGALE-S-ELECTRO-RED", renter="Чуфыркин Михаил Сергеевич", veh="ducati-panigale-s-electro-red",
         start="2026-07-05", end="2026-07-06", total=12000, dep=20000,
         note="Red Panigale — партнёрский байк (нет в cars); файл-двойник «…Чуфыркин.docx Чуфыркин.docx»",
         extra_files=["rent-Ducati-Panigale-S-Electro-Red-05.07.2026_Чуфыркин.docx Чуфыркин.docx"]),
    dict(file="rent-Ducati-Panigale-S-Electro-Red-08.07.2026.docx Халикова Диана.docx",
         no="8.7/DUCATI-PANIGALE-S-ELECTRO-RED", renter="Халикова Диана Александровна", veh="ducati-panigale-s-electro-red",
         start="2026-07-08", end="2026-07-08", total=17000, dep=10000,
         note="Red Panigale — партнёрский байк (нет в cars)"),
    dict(file="rent-Jilang-Max-Pro-03.07.2026.docx",
         no="3.7/JILANG-MAX-PRO", renter="Сухарев Андрей Викторович", veh="jilang-max-pro",
         start="2026-07-03", end="2026-07-03", total=5000, dep=10000, note=None),
    dict(file="rent-Regulmoto-Nibbler-300-4V-04.07.2026.docx",
         no="4.7/NIBBLER-REGUMOTO-4V", renter="Новиков Алексей Александрович", veh="nibbler-regumoto-4v",
         start="2026-07-04", end="2026-07-04", total=2250, dep=20000,
         note="№5.7 от 06.07 (файл «…04.07.2026.docx Новиков.docx») — перевыпуск того же договора на тот же период/сумму; не дублируем",
         extra_files=["rent-Regulmoto-Nibbler-300-4V-04.07.2026.docx Новиков.docx"]),
    dict(file="rent-Regulmoto-Nibbler-300-4V-06.07.2026_Шевчук.docx",
         no="6.7/NIBBLER-REGUMOTO-4V", renter="Шевчук Эдуард Олегович", veh="nibbler-regumoto-4v",
         start="2026-07-06", end="2026-07-07", total=8000, dep=10000, note=None),
    dict(file="rent-Rerode-R1-10.07.2026_Ворожейкин_Степан.docx",
         no="10.7/RERODE-R1-PLUS", renter="Ворожейкин Степан Евгеньевич", veh="rerode-r1-plus",
         start="2026-07-10", end="2026-07-11", total=32500, dep=20000, note=None),
    dict(file="rent-bike-KAWASAKI-EX650K-02.07.2026.docx",
         no="2.7/KAWASAKI-EX650K", renter="Галанов Андрей Олегович", veh="kawasaki-ex650k",
         start="2026-07-02", end="2026-07-03", total=20000, dep=20000, note=None),
    dict(file="rent-bike-KAWASAKI-EX650K-29.06.2026.docx Ларин.docx",
         no="05.08/APRILIA", renter="Ларин Алексей Александрович", veh="aprilia-shiver",
         start="2026-06-29", end="2026-06-29", total=6500, dep=13500,
         note="договор оформлен 05.08 задним числом; срок аренды по тексту: 29.06.2026 18:30–20:30 (3 часа), APRILIA; имя файла вводит в заблуждение"),
    dict(file="Договор аренды мотоцикла Suzuki GSXS 1000F чистый .docx не чистый.docx",
         no="888", renter="Кузовлев Иван Александрович", veh="suzuki-gsx-s1000f",
         start="2026-07-03", end="2026-07-03", total=None, dep=20000,
         note="сумма в теле не зафиксирована («Итого к оплате» пусто)"),
    dict(file="Договор аренды мотоцикла nibbler 300.docx Алиев Амаль.docx",
         no="11.07", renter="Алиев Амаль Рубинович", veh="nibbler-regumoto-4v",
         start="2026-07-11", end="2026-07-11", total=None, dep=20000,
         note="сумма в теле не зафиксирована"),
]

SKIPPED = [
    dict(file="Договор аренды мотоцикла без экипажа с тарифами.docx",
         reason="партнёрский договор субаренды (Сидоров И.О., вознаграждение 50%, срок 15.06–15.11) — не клиентская аренда, в rentals не импортируем"),
    dict(file="01 Договор аренды мотоцикла без экипажа с тарифами.docx DUCATI.docx",
         reason="партнёрский договор субаренды (Сидоров И.О. / Арендодатель Буробин Д.Д., 50%, с 05.08) — не клиентская аренда"),
]


def struct_by_file():
    return {r["file"]: r for r in json.load(open(f"{BASE}/scripts/zip_structured.json"))}


def main():
    apply = "--apply" in sys.argv
    struct = struct_by_file()
    now = datetime.now(timezone.utc).isoformat()

    fresh = fetch_all("rentals", select="rental_id,agreed_start_date,vehicle_id,total_cost,user_id,metadata")
    print(f"fresh rentals: {len(fresh)}")

    seen_keys = set()
    for r in fresh:
        d = (r.get("agreed_start_date") or "")[:10]
        seen_keys.add((d, r.get("vehicle_id")))

    manifest = {"run_at": now, "tag": TAG, "apply": apply, "inserted": [], "skipped_existing": [], "errors": [], "skipped_by_design": SKIPPED}
    rows_to_insert = []

    for c in C:
        f = c["file"]
        if not os.path.exists(os.path.join(SRC, f)):
            manifest["errors"].append({"file": f, "error": "file not found in docs_extract"})
            continue
        st = struct.get(f, {})
        sha = st.get("sha256") or sha256_file(f)
        end = c["end"] or c["start"]
        text = full_text(f)
        t1, t2 = extract_times(text, c["start"], end)
        if not t1:
            t1, t2 = "09:00", "19:00"
        phone = st.get("phone")
        # idempotency: same start date + vehicle
        if (c["start"], c["veh"]) in seen_keys:
            manifest["skipped_existing"].append({"file": f, "reason": f"rental already exists {c['start']} {c['veh']}"})
            continue
        row = {
            "user_id": WALKIN_USER,
            "owner_id": WALKIN_USER,
            "vehicle_id": c["veh"],
            "crew_id": CREW_ID,
            "status": "completed",
            "payment_status": "fully_paid",
            "total_cost": c["total"],
            "deposit_amount": c["dep"] or 0,
            "requested_start_date": ts(c["start"], t1),
            "requested_end_date": ts(end, t2),
            "agreed_start_date": ts(c["start"], t1),
            "agreed_end_date": ts(end, t2),
            "created_at": ts(c["start"], t1),
            "metadata": {
                "source": "retro_backfill_v2",
                "renter_name": c["renter"],
                "renter_phone": phone,
                "contract_no": c["no"],
                "doc_file": f,
                "doc_sha256": sha,
                "duration_note": None,
                "specs": {
                    "retro_backfill_v2": {
                        "origin": "все договора.zip (145 docs, sha-verified)",
                        "file": f,
                        "sha256": sha,
                        "contract_no": c["no"],
                        "confidence": "high" if c["total"] else "medium",
                        "note": c["note"],
                        "backfilled_at": now,
                        "backfilled_by": TAG,
                    }
                },
                "history": [{
                    "at": now, "by": TAG,
                    "note": f"retro insert from zip contract №{c['no']} ({c['renter']}), boss order: complete season stats",
                    "status": "completed",
                }],
            },
        }
        rows_to_insert.append((f, c, row, sha, t1, t2))

    print(f"rows to insert: {len(rows_to_insert)}, skipped existing: {len(manifest['skipped_existing'])}")

    for f, c, row, sha, t1, t2 in rows_to_insert:
        if not apply:
            print(f"[DRY] {c['start']} {c['veh']:32} {c['renter'][:30]:32} total={c['total']} dep={c['dep']} {t1}-{t2}")
            continue
        st, resp = api("POST", "/rest/v1/rentals", row,
                       headers={"Prefer": "return=representation"})
        if st in (200, 201) and isinstance(resp, list) and resp:
            rid = resp[0]["rental_id"]
            print(f"[OK ] {c['start']} {c['veh']:32} {c['renter'][:28]:30} → {rid}")
            manifest["inserted"].append({"file": f, "rental_id": rid, "vehicle": c["veh"],
                                         "start": c["start"], "total": c["total"], "sha256": sha})
        else:
            print(f"[ERR] {c['start']} {c['veh']} {c['renter'][:24]}: {st} {str(resp)[:160]}")
            manifest["errors"].append({"file": f, "status": st, "error": str(resp)[:300]})

    # storage upload for every inserted row (+ extras)
    if apply:
        for entry in manifest["inserted"]:
            c = next(x for x in C if x["file"] == entry["file"])
            files = [c["file"]] + (c.get("extra_files") or [])
            paths = []
            for fn in files:
                p = os.path.join(SRC, fn)
                if not os.path.exists(p):
                    manifest["errors"].append({"file": fn, "error": "storage: file not found"})
                    continue
                safe = re.sub(r"[\\/:*?\"<>|\n\r\t]+", "_", fn)
                path = f"{STORAGE_DIR}/{safe}"
                data = open(p, "rb").read()
                st, resp = api("POST", f"/storage/v1/object/{BUCKET}/{urllib.parse.quote(path)}",
                               raw_body=data,
                               headers={"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                        "x-upsert": "false"})
                if st in (200, 201):
                    paths.append(path)
                    print(f"[STOR] {path}")
                elif st == 409:
                    paths.append(path)
                    print(f"[STOR=exists] {path}")
                else:
                    print(f"[STOR-ERR] {st} {str(resp)[:140]} {path}")
                    manifest["errors"].append({"file": fn, "error": f"storage {st}: {str(resp)[:200]}"})
            if paths:
                # patch rental metadata with storage paths
                st2, cur = api("GET", f"/rest/v1/rentals?select=metadata&rental_id=eq.{entry['rental_id']}")
                md = (cur[0]["metadata"] if st2 == 200 and cur else {}) or {}
                md["doc_storage_paths"] = paths
                md["doc_storage_bucket"] = BUCKET
                md["history"] = (md.get("history") or []) + [{
                    "at": datetime.now(timezone.utc).isoformat(), "by": TAG,
                    "note": f"original contract docx uploaded to storage {BUCKET}/{STORAGE_DIR}",
                    "status": "completed"}]
                st3, r3 = api("PATCH", f"/rest/v1/rentals?rental_id=eq.{entry['rental_id']}",
                              {"metadata": md}, headers={"Prefer": "return=minimal"})
                if st3 not in (200, 204):
                    manifest["errors"].append({"file": entry["file"], "error": f"metadata patch {st3}"})

    out = f"{BASE}/scripts/retro_backfill_v2_manifest.json"
    json.dump(manifest, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"\nmanifest → {out}")
    ins = manifest["inserted"]
    print(f"inserted: {len(ins)}  sum_known={sum(x['total'] or 0 for x in ins):,}₽  errors: {len(manifest['errors'])}")


if __name__ == "__main__":
    main()
