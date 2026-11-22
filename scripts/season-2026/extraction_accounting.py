#!/usr/bin/env python3
"""Extraction middle step v1: full accounting of all 145 zip docs vs Supabase.

Joins doc_inventory.json + zip_structured.json + zip_match_v2.json +
task108-backfill-manifest.json + FRESH DB state into one canonical
extraction_v1.json — the input artifact for retro_backfill_v2.

Inputs (same dir): doc_inventory.json, zip_structured.json, zip_match_v2.json
(regenerate with zip_inventory.py / master_parse_match.py if missing) + live
Supabase (service key via SUPABASE_SERVICE_ROLE_KEY env or .sb_key in cwd).

Statuses per file:
  imported_db            — matched to a live rental (fuzzy/sha, score>=5)
  imported_backfill_v1   — covered by the 5-row task108 xlsx backfill
  retro_missing          — rent doc, no DB row  (retro_backfill_v2 payload)
  retro_needs_review     — weak fuzzy hit (3-4), human decides before import
  duplicate_of           — copy/restore of another file (same sha or same rental)
  testdrive              — test-drive doc, not a rental
  sale                   — sale contract (separate table)
  template               — blank/reference contract template
Also emits per-month docs-vs-DB reconciliation (May/June doublecheck).
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "https://inmctohsodgdohamhzag.supabase.co"
CREW_SLUG = "vip-bike"


def _load_key():
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env:
        return env
    kf = os.path.join(HERE, ".sb_key")
    if os.path.exists(kf):
        return open(kf).read().strip()
    raise SystemExit("service key not found")


KEY = _load_key()


def rest(path, params=None, profile=None):
    url = f"{BASE}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    out, off = [], 0
    while True:
        page = url + (("&" if params else "?") + f"offset={off}")
        r = urllib.request.Request(page)
        r.add_header("apikey", KEY)
        r.add_header("Authorization", f"Bearer {KEY}")
        if profile:
            r.add_header("Accept-Profile", profile)
        with urllib.request.urlopen(r, timeout=60) as resp:
            chunk = json.loads(resp.read().decode("utf-8") or "[]")
        if not isinstance(chunk, list):
            return chunk
        out.extend(chunk)
        if len(chunk) < 1000:
            break
        off += 1000
    return out


def norm_name(s):
    if not s:
        return ""
    s = s.lower().replace("ё", "е")
    s = re.sub(r"[^a-zа-я0-9 ]", " ", s)
    return " ".join(s.split())


def model_tokens(s):
    if not s:
        return set()
    s = s.lower().replace("ё", "е")
    s = re.sub(r"[^a-zа-я0-9]+", " ", s)
    stop = {"rent", "договор", "аренды", "аренда", "мотоцикла", "электромотоцикла", "чистый", "копия",
            "восстановлен", "восстановление", "автовосстановление", "docx", "doc", "проката"}
    return {t for t in s.split() if len(t) > 2 and t not in stop}


def parse_date_guess(doc):
    """Best guess of contract date: explicit date_line -> name date -> first date in text."""
    for src in (doc.get("date_line"), doc.get("dates_in_name"), [doc.get("first_date_in_text")] if doc.get("first_date_in_text") else []):
        if not src:
            continue
        if isinstance(src, str):
            src = [src]
        for item in src:
            m = re.search(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})", str(item))
            if m:
                d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                try:
                    return datetime(y, mo, d).date().isoformat()
                except ValueError:
                    continue
            m = re.search(r"(20\d{2})-(\d{2})-(\d{2})", str(item))
            if m:
                return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def day_diff(a, b):
    if not a or not b:
        return None
    try:
        return abs((datetime.fromisoformat(a[:10]) - datetime.fromisoformat(b[:10])).days)
    except ValueError:
        return None


def total_num(t):
    if t is None:
        return None
    digits = "".join(ch for ch in str(t) if ch.isdigit())
    return int(digits) if digits else None


def main():
    inv = json.load(open(os.path.join(HERE, "doc_inventory.json")))
    st = json.load(open(os.path.join(HERE, "zip_structured.json")))
    mv = json.load(open(os.path.join(HERE, "zip_match_v2.json")))

    inv_by_file = {x["file"]: x for x in inv}
    st_by_file = {x["file"]: x for x in st}
    mv_by_file = {x["file"]: x for x in mv}

    # task108 backfill rows -> match by renter+date+model against manifest descriptions is hard;
    # instead fetch DB rows with source=retro_backfill_v1 and fuzzy them against PRE_DOC_ERA docs.
    crew = rest("crews", {"select": "id,slug,name", "slug": f"eq.{CREW_SLUG}"})[0]
    crew_id = crew["id"]
    rentals = rest("rentals", {
        "select": "rental_id,status,total_cost,requested_start_date,agreed_start_date,created_at,"
                  "user_id,metadata,vehicle:cars!inner(id,crew_id,make,model,type)",
        "vehicle.crew_id": f"eq.{crew_id}",
    })
    users = rest("users", {"select": "user_id,full_name,username"})
    users_by_id = {u["user_id"]: u for u in users}

    db_rows = []
    for r in rentals:
        meta = r.get("metadata") or {}
        v = r.get("vehicle") or {}
        renter = meta.get("renter_name") or (users_by_id.get(r.get("user_id")) or {}).get("full_name") or ""
        start = (r.get("requested_start_date") or r.get("agreed_start_date") or "")[:10]
        db_rows.append({
            "rental_id": r["rental_id"], "status": r.get("status"),
            "total": r.get("total_cost"), "start": start, "created_at": r.get("created_at"),
            "model": f"{v.get('make') or ''} {v.get('model') or ''}".strip(),
            "renter": renter, "phone": meta.get("renter_phone") or "",
            "source": meta.get("source") or "bot", "doc_sha": meta.get("doc_sha256") or meta.get("original_sha256") or "",
        })

    # sha direct index
    sha_index = {r["doc_sha"]: r for r in db_rows if r["doc_sha"]}

    # ---- pass 1: classify by v2 kinds + sha/rental direct hits ----
    records = []
    for f in sorted(inv_by_file):
        i, s, m = inv_by_file[f], st_by_file.get(f, {}), mv_by_file.get(f, {})
        kind = m.get("kind")
        rec = {
            "file": f, "sha256": i.get("sha256"), "size": i.get("size"),
            "doc_type": i.get("type"), "model_hint": i.get("model"),
            "contract_no": s.get("contract_no"), "renter": s.get("renter"),
            "doc_total": s.get("total"), "deposit": s.get("deposit"), "phone": s.get("phone"),
            "doc_date": parse_date_guess(s), "v2_kind": kind, "v2_how": m.get("how"),
        }
        rec["month"] = rec["doc_date"][:7] if rec["doc_date"] else None
        rec["total_num"] = total_num(s.get("total"))

        if kind == "MATCHED_DB" and m.get("rental_id"):
            rec["status"] = "imported_db"
            rec["rental_id"] = m["rental_id"]
            row = next((r for r in db_rows if r["rental_id"] == m["rental_id"]), None)
            rec["db"] = {"start": row["start"], "total": row["total"], "status": row["status"]} if row else None
        elif kind == "TESTDRIVE":
            rec["status"] = "testdrive"
        elif kind == "SALE_CONTRACT":
            rec["status"] = "sale"
        elif kind == "TEMPLATE":
            rec["status"] = "template"
        else:  # DOC_ERA_UNMATCHED / PRE_DOC_ERA / unknown -> fuzzy pass 2
            rec["status"] = None
        records.append(rec)

    # ---- pass 2: fuzzy match unmatched rent docs against fresh DB ----
    backfill_ids = set()
    for r in db_rows:
        if r["source"] == "retro_backfill_v1":
            backfill_ids.add(r["rental_id"])

    for rec in records:
        if rec["status"] is not None:
            continue
        # sha direct
        row = sha_index.get(rec["sha256"])
        if row:
            rec["status"] = "imported_db" if row["rental_id"] not in backfill_ids else "imported_backfill_v1"
            rec["rental_id"] = row["rental_id"]
            rec["match_how"] = "sha256"
            continue
        best, best_score, best_exact = None, -1, False
        for r in db_rows:
            score = 0
            dd = day_diff(rec["doc_date"], r["start"])
            if dd is not None and dd <= 3:
                score += 3
            elif dd is not None and dd <= 7:
                score += 1
            mt_doc, mt_db = model_tokens(rec["model_hint"]), model_tokens(r["model"])
            if mt_doc and mt_db:
                ov = len(mt_doc & mt_db) / max(1, min(len(mt_doc), len(mt_db)))
                if ov >= 0.6:
                    score += 2
                elif ov >= 0.35:
                    score += 1
            rn_doc, rn_db = norm_name(rec["renter"]), norm_name(r["renter"])
            renter_conflict = False
            if rn_doc and rn_db:
                dt = [tok for tok in rn_doc.split() if len(tok) >= 4]
                if any(tok in rn_db for tok in dt):
                    score += 2
                else:
                    renter_conflict = True
                    score -= 2
            total_eq = rec["total_num"] is not None and r["total"] is not None and int(r["total"]) == rec["total_num"]
            if total_eq:
                score += 1
            # strong override: exact date + exact total + no renter conflict
            exact = dd is not None and dd <= 1 and total_eq and not renter_conflict
            if exact:
                score += 2
            if score > best_score or (score == best_score and exact and not best_exact):
                best, best_score, best_exact = r, score, exact
        # explicit exact-match rule (doc without parsed renter/model, e.g. scan-copy)
        if best is not None and best_exact and not (
            norm_name(rec["renter"]) and norm_name(best["renter"])
            and not any(t in norm_name(best["renter"]) for t in norm_name(rec["renter"]).split() if len(t) >= 4)
        ):
            rec["status"] = "imported_backfill_v1" if best["rental_id"] in backfill_ids else "imported_db"
            rec["rental_id"] = best["rental_id"]
            rec["match_how"] = f"exact date+total db={best['start']} {best['model']} {best['total']}\u20bd"
        elif best_score >= 5:
            rec["status"] = "imported_backfill_v1" if best["rental_id"] in backfill_ids else "imported_db"
            rec["rental_id"] = best["rental_id"]
            rec["match_how"] = f"fuzzy score={best_score} db={best['start']} {best['model']}"
        elif best_score >= 3:
            rec["status"] = "retro_needs_review"
            rec["match_how"] = f"weak score={best_score} db={best['start']} {best['model']}"
        else:
            rec["status"] = "retro_missing"
            if best is not None:
                rec["match_how"] = f"no-hit (best score={best_score})"

    # ---- pass 3: duplicates by sha ----
    by_sha = defaultdict(list)
    for rec in records:
        by_sha[rec["sha256"]].append(rec)
    for sha, group in by_sha.items():
        if len(group) > 1:
            keep = min(group, key=lambda r: r["file"])
            for rec in group:
                if rec is not keep and rec["status"].startswith(("imported", "retro_")):
                    # same-sha copies: mark as duplicate, keep pointer
                    rec["dup_of"] = keep["file"]
                    rec["status_note"] = f"same sha256 as {keep['file']} ({keep['status']})"

    # ---- pass 4: same-month+model renter-less copies -> likely duplicates ----
    missing_recs = [r for r in records if r["status"] in ("retro_missing", "retro_needs_review")]
    for a in missing_recs:
        for b in missing_recs:
            if a is b or a.get("likely_dup_of") or b.get("likely_dup_of"):
                continue
            if a["month"] and a["month"] == b["month"] and a["status"] == b["status"]:
                ma, mb = model_tokens(a["model_hint"]), model_tokens(b["model_hint"])
                ra, rb = norm_name(a["renter"]), norm_name(b["renter"])
                same_model = (not ma or not mb) or len(ma & mb) / max(1, min(len(ma), len(mb))) >= 0.5
                same_renter = (not ra or not rb) or ra == rb or any(t in rb for t in ra.split() if len(t) >= 4)
                dd = day_diff(a["doc_date"], b["doc_date"])
                if same_model and same_renter and dd is not None and dd <= 2:
                    # keep the one with more parsed info
                    info_a = sum(1 for k in ("renter", "total_num", "contract_no", "model_hint") if a.get(k))
                    info_b = sum(1 for k in ("renter", "total_num", "contract_no", "model_hint") if b.get(k))
                    loser = b if info_a >= info_b else a
                    winner = a if loser is b else b
                    loser["likely_dup_of"] = winner["file"]
                    loser["status_note"] = f"same-day/same-bike copy of {winner['file']}"

    # ---- summary + per-month reconciliation (rent docs only) ----
    RENT_STATUSES = ("imported_db", "imported_backfill_v1", "retro_missing", "retro_needs_review")
    docs_by_month = defaultdict(lambda: defaultdict(int))
    for rec in records:
        if rec["status"] in RENT_STATUSES and rec["month"]:
            docs_by_month[rec["month"]][rec["status"]] += 1
    db_by_month = defaultdict(lambda: {"n": 0, "sum": 0.0})
    for r in db_rows:
        if r["status"] == "cancelled" or not r["start"]:
            continue
        db_by_month[r["start"][:7]]["n"] += 1
        db_by_month[r["start"][:7]]["sum"] += float(r["total"] or 0)

    recon = {}
    for month in sorted(set(list(docs_by_month) + [m for m in db_by_month if m >= "2026-04"])):
        d = docs_by_month.get(month, {})
        db = db_by_month.get(month, {"n": 0, "sum": 0.0})
        docs_rent = sum(d.values())
        # net new-to-import: missing minus likely duplicates
        net_missing = sum(
            1 for r in records
            if r["status"] in ("retro_missing", "retro_needs_review")
            and r["month"] == month and not r.get("likely_dup_of")
        )
        recon[month] = {
            "docs_rent_total": docs_rent,
            "docs_matched": d.get("imported_db", 0) + d.get("imported_backfill_v1", 0),
            "docs_missing": d.get("retro_missing", 0) + d.get("retro_needs_review", 0),
            "docs_missing_net_of_dups": net_missing,
            "db_rows_noncancelled": db["n"],
            "db_sum_rub": db["sum"],
            "expected_after_import": db["n"] + net_missing,
        }

    missing = [r for r in records if r["status"] == "retro_missing" and not r.get("likely_dup_of")]
    review = [r for r in records if r["status"] == "retro_needs_review" and not r.get("likely_dup_of")]
    summary = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "files_total": len(records),
        "by_status": {k: sum(1 for r in records if r["status"] == k) for k in
                      ("imported_db", "imported_backfill_v1", "retro_missing", "retro_needs_review",
                       "testdrive", "sale", "template")},
        "rentals_in_db_crew_noncancelled": sum(1 for r in db_rows if r["status"] != "cancelled"),
        "distinct_rentals_covered_by_docs": len({r["rental_id"] for r in records if r.get("rental_id")}),
        "missing_money_known_rub": sum(r["total_num"] or 0 for r in missing),
        "review_money_known_rub": sum(r["total_num"] or 0 for r in review),
        "may_june": {m: recon.get(m) for m in ("2026-04", "2026-05", "2026-06") if m in recon},
    }

    dups = [r for r in records if r.get("likely_dup_of")]
    out = {"summary": summary, "reconciliation_by_month": recon, "records": records,
           "retro_missing": missing, "retro_needs_review": review,
           "likely_duplicates": dups}
    dst = os.path.join(HERE, "extraction_v1.json")
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1, default=str)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("\n--- reconciliation ---")
    for m, v in recon.items():
        print(m, v)
    return 0


if __name__ == "__main__":
    sys.exit(main())
