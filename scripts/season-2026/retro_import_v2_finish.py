#!/usr/bin/env python3
"""retro_backfill_v2 FINISH (task 111):
1) insert 3 remaining May/June rentals (Мирошников/Шкитин/Голубев);
2) patch Ларин dates: contract signed 05.08 but rental period is 29.06 18:30–20:30;
3) null the 4 zero-totals where contract has no sum (honest avg-rental stats);
4) upload ALL retro contract docx to storage rental-contracts/vip-bike/retro/<name>;
5) link storage paths into rentals.metadata + history audit;
6) manifest → scripts/retro_backfill_v2_manifest.json (+ download copy).

Prior session already inserted 21 rows tagged retro_backfill_v2 — we only finish.
Usage: python3 retro_import_v2_finish.py [--apply]
"""
import json, os, re, sys, urllib.request, urllib.parse
from datetime import datetime, timezone

BASE = "/home/z/my-project"
SRC = f"{BASE}/docs_extract"
SB = "https://inmctohsodgdohamhzag.supabase.co"
BUCKET = "rental-contracts"
STORAGE_DIR = "vip-bike/retro"
TAG = "task111-retro-finish"
sys.path.insert(0, f"{BASE}/scripts")
from retro_import_v2 import C, key_load, full_text, extract_times, ts  # curated list + helpers

KEY = key_load()


def api(method, path, body=None, raw_body=None, headers=None):
    data = None
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    if raw_body is not None:
        data = raw_body
    if headers:
        h.update(headers)
    req = urllib.request.Request(SB + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return r.status, json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


def fetch_all(table, select="*", order=None):
    rows, off = [], 0
    while True:
        q = {"select": select, "limit": "1000", "offset": str(off)}
        if order:
            q["order"] = order
        st, chunk = api("GET", f"/rest/v1/{table}?{urllib.parse.urlencode(q)}")
        if st != 200:
            raise RuntimeError(f"{table}: {st} {chunk}")
        rows.extend(chunk)
        if len(chunk) < 1000:
            return rows
        off += 1000


def now_iso():
    return datetime.now(timezone.utc).isoformat()


_RU2LA = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya", "і": "i",
}


def ascii_key(fn):
    """Storage keys must be S3-safe ASCII: transliterate cyrillic, drop odd chars."""
    base = "".join(_RU2LA.get(ch, ch) for ch in fn.lower())
    base = re.sub(r"[^a-z0-9._\- ]+", "_", base)
    base = re.sub(r"[ ]+", "_", base)
    base = re.sub(r"_+", "_", base).strip("_")
    return base or "contract.docx"


def storage_upload(path, filepath):
    data = open(filepath, "rb").read()
    st, resp = api("POST", f"/storage/v1/object/{BUCKET}/{urllib.parse.quote(path)}",
                   raw_body=data,
                   headers={"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            "x-upsert": "false"})
    if st in (200, 201):
        return "ok"
    if st == 409 or (isinstance(resp, str) and "Duplicate" in resp) or (isinstance(resp, dict) and resp.get("statusCode") == 409):
        return "exists"
    return f"err:{st}:{str(resp)[:160]}"


def patch_history(md, note):
    md = dict(md or {})
    md["history"] = (md.get("history") or []) + [{"at": now_iso(), "by": TAG, "note": note, "status": "completed"}]
    return md


def main():
    apply = "--apply" in sys.argv
    now = now_iso()
    manifest = {"run_at": now, "tag": TAG, "apply": apply, "inserted": [], "patched": [],
                "uploads": [], "errors": [], "already_there": []}

    rentals = fetch_all("rentals", select="rental_id,agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,vehicle_id,total_cost,metadata")
    v2rows = [r for r in rentals if (r.get("metadata") or {}).get("source") == "retro_backfill_v2"]
    print(f"rentals={len(rentals)}  retro_backfill_v2={len(v2rows)}")

    # ── 1) insert the 3 missing May/June rows ──────────────────────────────
    seen = set()
    for r in rentals:
        seen.add(((r.get("agreed_start_date") or "")[:10], r.get("vehicle_id")))

    TODO = [c for c in C if any(k in c["file"] for k in ("Мирощников", "Шкитин М.О.docx", "Шкитин М.О — копия"))]
    print(f"rows to insert: {len(TODO)}")
    for c in TODO:
        if (c["start"], c["veh"]) in seen:
            print(f"  [SKIP] {c['start']} {c['veh']} — уже есть")
            manifest["already_there"].append(c["file"])
            continue
        text = full_text(c["file"])
        t1, t2 = extract_times(text, c["start"], c["end"] or c["start"]) or ("09:00", "19:00")
        if not t1:
            t1, t2 = "09:00", "19:00"
        end = c["end"] or c["start"]
        row = {
            "user_id": "356282674", "owner_id": "356282674",
            "vehicle_id": c["veh"], "crew_id": "2d5fde70-1dd3-4f0d-8d72-66ccf6908746",
            "status": "completed", "payment_status": "fully_paid",
            "total_cost": c["total"],
            "deposit_amount": c["dep"] or 0,
            "requested_start_date": ts(c["start"], t1), "requested_end_date": ts(end, t2),
            "agreed_start_date": ts(c["start"], t1), "agreed_end_date": ts(end, t2),
            "created_at": ts(c["start"], t1),
            "metadata": {
                "source": "retro_backfill_v2",
                "renter_name": c["renter"],
                "contract_no": c["no"],
                "doc_file": c["file"],
                "doc_sha256": None,
                "specs": {"retro_backfill_v2": {
                    "origin": "все договора.zip (sha-verified)", "file": c["file"],
                    "contract_no": c["no"], "confidence": "medium", "note": c["note"],
                    "backfilled_at": now, "backfilled_by": "task111-retro-finish (final 3 of 24-gap set)"}},
                "history": [{"at": now, "by": TAG,
                             "note": f"retro insert from zip contract №{c['no']} ({c['renter']})",
                             "status": "completed"}],
            },
        }
        print(f"  [{'INS' if apply else 'DRY'}] {c['start']} {c['veh']:32} {c['renter'][:30]} dep={c['dep']}")
        if apply:
            st, resp = api("POST", "/rest/v1/rentals", row, headers={"Prefer": "return=representation"})
            if st in (200, 201) and isinstance(resp, list) and resp:
                rid = resp[0]["rental_id"]
                manifest["inserted"].append({"file": c["file"], "rental_id": rid, "start": c["start"], "vehicle": c["veh"]})
                print(f"    → {rid}")
            else:
                print(f"    [ERR] {st} {str(resp)[:200]}")
                manifest["errors"].append({"file": c["file"], "error": str(resp)[:300]})

    # ── 1b) hidden cars for FK: Horwin CR1 (May fleet) + Red Panigale (partner) ──
    cars_needed = [
        dict(id="horwin-cr1", make="Horwin", model="CR1",
             note="Майский флот 2026 (продан); добавлен для FK ретро-аренды Мирошникова 20.05, в каталоге скрыт"),
        dict(id="ducati-panigale-s-electro-red", make="Ducati", model="Panigale S Electro Red",
             note="партнёрский Red Panigale (СВОП §7); скрыт в каталоге; аренды Чуфыркина 05.07 и Халиковой 08.07"),
    ]
    st, have = api("GET", "/rest/v1/cars?select=id&or=(id.eq.horwin-cr1,id.eq.ducati-panigale-s-electro-red)")
    have_ids = {c["id"] for c in have} if st == 200 and isinstance(have, list) else set()
    for car in cars_needed:
        if car["id"] in have_ids:
            continue
        print(f"{'[CARS]' if apply else '[DRY]  '} cars += {car['id']} (hidden)")
        if apply:
            st2, r2 = api("POST", "/rest/v1/cars", {
                "id": car["id"], "make": car["make"], "model": car["model"],
                "type": "bike", "crew_id": "2d5fde70-1dd3-4f0d-8d72-66ccf6908746",
                "quantity": 0,
                "specs": {"hidden": True, "retro_note": car["note"]},
            }, headers={"Prefer": "return=minimal"})
            ok = st2 in (200, 201)
            print(f"    → {'OK' if ok else st2} {str(r2)[:120]}")
            if not ok:
                manifest["errors"].append({"cars": car["id"], "error": str(r2)[:200]})

    # ── 1c) insert Мирошников now that horwin-cr1 exists (FK) ──
    if apply and "horwin-cr1" not in have_ids:
        pass  # cars row created above; insert below proceeds regardless
    miro = next((c for c in TODO if "Мирощников" in c["file"]), None)
    if miro and apply:
        miro_row = None
        # check again post-cars-insert
        st3, chk = api("GET", f"/rest/v1/rentals?select=rental_id&agreed_start_date=gte.2026-05-20T00:00:00Z&agreed_start_date=lte.2026-05-20T23:59:59Z&vehicle_id=eq.horwin-cr1")
        if not (st3 == 200 and isinstance(chk, list) and chk):
            text = full_text(miro["file"])
            t1, t2 = extract_times(text, miro["start"], miro["end"] or miro["start"]) or ("09:00", "19:00")
            if not t1:
                t1, t2 = "09:00", "19:00"
            end = miro["end"] or miro["start"]
            miro_row = {
                "user_id": "356282674", "owner_id": "356282674",
                "vehicle_id": miro["veh"], "crew_id": "2d5fde70-1dd3-4f0d-8d72-66ccf6908746",
                "status": "completed", "payment_status": "fully_paid",
                "total_cost": miro["total"], "deposit_amount": miro["dep"] or 0,
                "requested_start_date": ts(miro["start"], t1), "requested_end_date": ts(end, t2),
                "agreed_start_date": ts(miro["start"], t1), "agreed_end_date": ts(end, t2),
                "created_at": ts(miro["start"], t1),
                "metadata": {
                    "source": "retro_backfill_v2", "renter_name": miro["renter"],
                    "contract_no": miro["no"], "doc_file": miro["file"],
                    "specs": {"retro_backfill_v2": {
                        "origin": "все договора.zip", "file": miro["file"],
                        "contract_no": miro["no"], "confidence": "medium", "note": miro["note"],
                        "backfilled_at": now, "backfilled_by": TAG}},
                    "history": [{"at": now, "by": TAG,
                                 "note": f"retro insert from zip contract №{miro['no']} ({miro['renter']}); cars.horwin-cr1 добавлен (hidden)",
                                 "status": "completed"}],
                },
            }
            st4, resp4 = api("POST", "/rest/v1/rentals", miro_row, headers={"Prefer": "return=representation"})
            if st4 in (200, 201) and isinstance(resp4, list) and resp4:
                rid4 = resp4[0]["rental_id"]
                print(f"[INS ] 2026-05-20 horwin-cr1 Мирошников → {rid4}")
                manifest["inserted"].append({"file": miro["file"], "rental_id": rid4, "start": miro["start"], "vehicle": miro["veh"]})
            else:
                print(f"[ERR] Мирошников: {st4} {str(resp4)[:200]}")
                manifest["errors"].append({"file": miro["file"], "error": str(resp4)[:300]})
        else:
            print("Мирошников уже есть (horwin-cr1, 20.05)")
            manifest["already_there"].append("miroshnikov")

    # ── 1d) RED contracts: vehicle black→red (contracts explicitly say RED) ──
    if apply:
        for r in v2rows:
            md = r.get("metadata") or {}
            rn = md.get("renter_name") or ""
            no = md.get("contract_no") or ""
            if r.get("vehicle_id") == "ducati-panigale-s-electro-black" and (
                    "RED" in no or rn in ("Чуфыркин Михаил Сергеевич", "Халикова Диана Александровна")):
                md2 = patch_history(md, "vehicle_id black→red: в договоре ТС DUCATI-PANIGALE-S-ELECTRO-RED (партнёрский байк; cars.ducati-panigale-s-electro-red добавлен hidden)")
                st5, _ = api("PATCH", f"/rest/v1/rentals?rental_id=eq.{r['rental_id']}",
                             {"vehicle_id": "ducati-panigale-s-electro-red", "metadata": md2},
                             headers={"Prefer": "return=minimal"})
                ok = st5 in (200, 204)
                print(f"[RED {'OK' if ok else st5}] {rn[:28]} {(r.get('agreed_start_date') or '')[:10]}")
                manifest["patched"].append({"rental_id": r["rental_id"], "what": "vehicle black→red", "ok": ok})
        # refresh manifest['inserted'] vehicles for uploads matching by id

    # ── 2) Ларин: 05.08 (signing) → 29.06 18:30–20:30 (actual rental period) ──
    larin = next((r for r in v2rows if (r.get("metadata") or {}).get("contract_no") == "05.08/APRILIA"), None)
    if larin:
        start = (larin.get("agreed_start_date") or "")[:10]
        if start == "2026-08-05":
            print(f"{'[PATCH]' if apply else '[DRY]  '} Ларин {larin['rental_id']}: 2026-08-05 → 2026-06-29 18:30–20:30")
            if apply:
                md = patch_history(larin.get("metadata"),
                                   "дата аренды исправлена: в договоре №05.08/APRILIA срок аренды 29.06.2026 18:30–20:30 "
                                   "(подписан задним числом 05.08); июньский доход/счётчик восстановлены")
                md["specs"] = md.get("specs") or {}
                md["specs"]["retro_backfill_v2"] = (md["specs"].get("retro_backfill_v2") or {})
                md["specs"]["retro_backfill_v2"]["period_note"] = "срок по тексту договора: 29.06.2026 18:30–20:30, подписание 05.08"
                body = {"requested_start_date": ts("2026-06-29", "18:30"),
                        "requested_end_date": ts("2026-06-29", "20:30"),
                        "agreed_start_date": ts("2026-06-29", "18:30"),
                        "agreed_end_date": ts("2026-06-29", "20:30"),
                        "metadata": md}
                st, resp = api("PATCH", f"/rest/v1/rentals?rental_id=eq.{larin['rental_id']}", body,
                               headers={"Prefer": "return=minimal"})
                ok = st in (200, 204)
                print(f"    → {'OK' if ok else st}")
                manifest["patched"].append({"rental_id": larin["rental_id"], "what": "larin dates → 2026-06-29", "ok": ok})
        else:
            print(f"Ларин уже на {start} — патч не нужен")
            manifest["already_there"].append("larin-dates-ok")
    else:
        print("Ларин v2-строка не найдена?!")

    # ── 3) zero totals → null (4 rows: Стерлягов, Воронцов, Кузовлев, Алиев) ──
    for r in v2rows:
        md = r.get("metadata") or {}
        if r.get("total_cost") == 0 and md.get("renter_name") in (
                "Стерлягов Алексей Николаевич", "Воронцов Денис Сергеевич",
                "Кузовлев Иван Александрович", "Алиев Амаль Рубинович"):
            print(f"{'[PATCH]' if apply else '[DRY]  '} total 0→null: {md.get('renter_name')} {(r.get('agreed_start_date') or '')[:10]}")
            if apply:
                md2 = patch_history(md, "total_cost 0→null: сумма в договоре не зафиксирована (старый шаблон), 0 искажал средний чек")
                st, resp = api("PATCH", f"/rest/v1/rentals?rental_id=eq.{r['rental_id']}",
                               {"total_cost": None, "metadata": md2}, headers={"Prefer": "return=minimal"})
                ok = st in (200, 204)
                manifest["patched"].append({"rental_id": r["rental_id"], "what": "total 0→null", "ok": ok})

    # ── 4) upload ALL retro docs (21 prior + new) & link into metadata ──────
    by_renter = {}
    for r in v2rows:
        md = r.get("metadata") or {}
        rn = md.get("renter_name") or ""
        by_renter.setdefault(rn.split()[0] if rn else "?", []).append(r)

    upload_plan = []  # (rental_id, file)
    for c in C:
        surname = (c["renter"] or "?").split()[0]
        # match prior rows by surname+contract date window OR our inserted rows
        cands = by_renter.get(surname, [])
        match = None
        for r in cands:
            d = (r.get("agreed_start_date") or "")[:10]
            if d[:7] == c["start"][:7] or (c["no"] == "05.08/APRILIA" and d in ("2026-06-29", "2026-08-05")):
                match = r
                break
        if match:
            upload_plan.append((match["rental_id"], c["file"]))
            for extra in c.get("extra_files") or []:
                upload_plan.append((match["rental_id"], extra))
    for entry in manifest["inserted"]:
        c = next(x for x in C if x["file"] == entry["file"])
        upload_plan.append((entry["rental_id"], c["file"]))
    # dedupe
    seen_up = set()
    upload_plan = [x for x in upload_plan if not (x in seen_up or seen_up.add(x))]

    print(f"\nupload plan: {len(upload_plan)} files")
    linked = {}
    for rid, fn in upload_plan:
        p = os.path.join(SRC, fn)
        if not os.path.exists(p):
            print(f"  [MISS] {fn}")
            manifest["errors"].append({"file": fn, "error": "not in docs_extract"})
            continue
        path = f"{STORAGE_DIR}/{ascii_key(fn)}"
        if apply:
            res = storage_upload(path, p)
            print(f"  [{res:>6}] {path}")
            if res in ("ok", "exists"):
                manifest["uploads"].append({"rental_id": rid, "path": path})
                linked.setdefault(rid, []).append(path)
            elif res.startswith("err"):
                manifest["errors"].append({"file": fn, "error": res})
        else:
            print(f"  [DRY  ] {path}")

    if apply and linked:
        allmd = {r["rental_id"]: r for r in rentals}
        for rid, paths in linked.items():
            md = patch_history(allmd.get(rid, {}).get("metadata"),
                               f"original contract docx uploaded to storage {BUCKET}/{STORAGE_DIR} (task111)")
            md["doc_storage_bucket"] = BUCKET
            md["doc_storage_paths"] = sorted(set((md.get("doc_storage_paths") or []) + paths))
            st, resp = api("PATCH", f"/rest/v1/rentals?rental_id=eq.{rid}", {"metadata": md},
                           headers={"Prefer": "return=minimal"})
            if st not in (200, 204):
                manifest["errors"].append({"rental_id": rid, "error": f"metadata patch {st}"})
        print(f"linked storage paths → {len(linked)} rentals")

    out = f"{BASE}/scripts/retro_backfill_v2_manifest.json"
    json.dump(manifest, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"\nmanifest → {out}")
    print(f"inserted={len(manifest['inserted'])} patched={len(manifest['patched'])} "
          f"uploads={len(manifest['uploads'])} errors={len(manifest['errors'])}")


if __name__ == "__main__":
    main()
