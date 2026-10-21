#!/usr/bin/env python3
"""Compute season stats pack for SUMMARY.html -> summary_data.json"""
import json
from collections import defaultdict, Counter
from datetime import datetime

rentals = json.load(open("/home/z/my-project/scripts/rentals_full.json"))
cash = json.load(open("/home/z/my-project/scripts/cash_full.json"))
xlsx = json.load(open("/home/z/my-project/scripts/xlsx_parsed.json"))
match = json.load(open("/home/z/my-project/scripts/zip_match_v2.json"))
zres = {r["file"]: r for r in json.load(open("/home/z/my-project/scripts/zip_structured.json"))}

D = {}

# ---------- DB rentals by agreed month ----------
by_m_cnt, by_m_sum = Counter(), Counter()
for r in rentals:
    st = (r.get("agreed_start_date") or "")[:7]
    if not st:
        st = "unknown"
    if r.get("status") == "cancelled":
        continue
    by_m_cnt[st] += 1
    by_m_sum[st] += float(r.get("total_cost") or 0)

D["db"] = {
    "total_rows": len(rentals),
    "active_rows": sum(1 for r in rentals if r.get("status") == "active"),
    "cancelled": sum(1 for r in rentals if r.get("status") == "cancelled"),
    "months_cnt": dict(sorted(by_m_cnt.items())),
    "months_sum": dict(sorted(by_m_sum.items())),
    "revenue_total": sum(by_m_sum.values()),
    "sources": dict(Counter((r.get("metadata") or {}).get("source") or "other" for r in rentals)),
}

# ---------- cash ----------
cin, cout = defaultdict(float), defaultdict(float)
for c in cash:
    t = c.get("transaction_type") or "?"
    a = float(c.get("amount") or 0)
    if t.startswith("income"):
        cin[t] += a
    else:
        cout[t] += a
D["cash"] = {
    "income": dict(cin), "expense": dict(cout),
    "n_income": sum(1 for c in cash if (c.get("transaction_type") or "").startswith("income")),
    "n_expense": sum(1 for c in cash if not (c.get("transaction_type") or "").startswith("income")),
    "sale_n": sum(1 for c in cash if c.get("sale_contract_id")),
    "sale_sum": sum(float(c.get("amount") or 0) for c in cash if c.get("sale_contract_id")),
    "months_sale": {},
}
ms = defaultdict(float)
for c in cash:
    if c.get("sale_contract_id"):
        d = (c.get("transaction_date") or "")[:7]
        ms[d] += float(c.get("amount") or 0)
D["cash"]["months_sale"] = dict(sorted(ms.items()))

# ---------- xlsx ----------
ar_rows = xlsx["Аренда"]
ar_recs = []
for r in ar_rows:
    seg = r[6:16] if len(r) > 6 else []
    if len(seg) >= 4 and seg[0] and seg[3] is not None:
        try:
            profit = float(seg[3])
        except (TypeError, ValueError):
            continue
        if profit == 101000:  # итоговая строка
            continue
        ar_recs.append({"bike": str(seg[0]).strip(), "term": str(seg[1] or "").strip(),
                        "client": str(seg[2] or "").strip(), "profit": profit,
                        "gear": seg[4] if len(seg) > 4 else None,
                        "date": str(seg[5])[:10] if len(seg) > 5 and seg[5] else None,
                        "pay": str(seg[6] or "").strip() if len(seg) > 6 else None})
D["xlsx_rentals"] = ar_recs
D["xlsx_rentals_sum"] = sum(a["profit"] for a in ar_recs)

# продажи xlsx
zp = xlsx["Закупка продажа"]
sale_rows = []
for r in zp:
    if len(r) > 10 and r[1] and r[6] is not None:
        pass
D["xlsx_sales"] = {"cost_total": 16612515, "revenue_total": 17793800, "profit_total": 3995460,
                   "stock_salon": 3125900, "stock_partner": 1483000, "as_of": "29.09.2026"}
D["xlsx_expenses"] = {
    "маркетинг/выставки": 928141, "салон": 275922, "экипировка": 393160,
    "сервис (закупка)": 75887, "закупка мото (май)": 4113000,
}
D["xlsx_service_income"] = 7000

# ---------- zip / match ----------
kinds = Counter(m["kind"] for m in match)
D["zip"] = {"total": len(match), "kinds": dict(kinds)}

def uniq_missing(kind_filter, date_key):
    seen, out = set(), []
    for m in match:
        if m["kind"] != kind_filter:
            continue
        r = zres[m["file"]]
        key = (r.get("contract_no"), r.get("renter"), r.get(date_key))
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out

pre = uniq_missing("PRE_DOC_ERA", "date_line")
doc = uniq_missing("DOC_ERA_UNMATCHED", "period_start")

# exclude rows already backfilled earlier (source=retro_backfill_v1) by date+vid+amount
already = {(r.get("agreed_start_date", "")[:10], r.get("vehicle_id"), float(r.get("total_cost") or 0))
           for r in rentals if (r.get("metadata") or {}).get("source") == "retro_backfill_v1"}
ALREADY_VIDS = {"ducati-panigale-s-electro-black": "ducati-panigale"}  # contract guessed vs db slug

def is_already(r):
    for d, v, a in already:
        vid = r.get("vehicle_id_guess")
        if vid == "ducati-panigale" and v == "ducati-panigale-s-electro-black":
            vid = v
        if r.get("date_line") != d:
            continue
        if vid == v:
            return True
        # (date + amount) fallback: Забалдин pdf 30.05 6000 == retro row 30.05 6000
        if r.get("total") is not None and float(r["total"]) == a:
            return True
        # renter surname fallback (Шаронов №777 case: wrong vid guess)
        rn = r.get("renter") or ""
        db_renter = next((x for x in rentals if (x.get("agreed_start_date") or "")[:10] == d
                          and x.get("vehicle_id") == v), None)
        if db_renter:
            dbn = ((db_renter.get("metadata") or {}).get("renter_name") or "")
            if rn and dbn and norm_sur(rn) and norm_sur(rn) == norm_sur(dbn):
                return True
            if not rn and not a:  # nothing to compare
                continue
    return False

def norm_sur(s):
    import re as _re
    return _re.sub(r"[^а-яa-z]", "", s.lower().replace("ё", "е")).split() and _re.sub(r"[^а-яa-z]", "", s.lower().replace("ё", "е"))[:7]

pre_skipped = [r for r in pre if is_already(r)]
pre = [r for r in pre if not is_already(r)]
# drop contract-less txt twin when a filled contract exists on the same date
by_date = {}
for r in pre:
    by_date.setdefault(r["date_line"], []).append(r)
pre2 = []
for d, group in by_date.items():
    filled = [g for g in group if g["renter"]]
    pre2.extend(filled if filled else group)
pre = pre2
print("pre-doc already in DB (skipped):", [(r["contract_no"], r["renter"], r["date_line"]) for r in pre_skipped])
# doc-era: dedupe by (contract_no, renter)
D["missing_pre_doc"] = [{"no": r["contract_no"], "date": r["date_line"], "renter": r["renter"],
                         "vehicle": r["vehicle"], "vid": r["vehicle_id_guess"], "total": r["total"],
                         "deposit": r["deposit"], "file": r["file"][:90]} for r in pre]
D["missing_doc_era"] = [{"no": r["contract_no"], "date": r["period_start"] or r["date_line"], "renter": r["renter"],
                         "vehicle": r["vehicle"], "vid": r["vehicle_id_guess"], "total": r["total"],
                         "deposit": r["deposit"], "file": r["file"][:90]} for r in doc]

# Ларин mislabel fix
for m in D["missing_doc_era"]:
    if m["renter"] and "Ларин" in m["renter"]:
        m["note"] = "файл назван 29.06, внутри договор №05.08/APRILIA от 05.08"
        m["vid"] = "aprilia-shiver?"
D["missing_doc_era_sum"] = sum(m["total"] or 0 for m in D["missing_doc_era"])
D["missing_pre_doc_sum"] = sum(m["total"] or 0 for m in D["missing_pre_doc"])

# ---------- projected season ----------
known_missing = D["missing_doc_era_sum"]
# xlsx-only rows (no contract files): Платонов 30000, Коля 2000, слава 4000, Борский 19000
# (Коняхин 10000, Zero 04.05 10000, Ульви 10000, Забалдин 6000, Шаронов 10000 уже в БД retro_backfill_v1)
xlsx_only = 30000 + 2000 + 4000 + 19000
D["projection"] = {
    "db_revenue": D["db"]["revenue_total"],
    "july_contracts_sum": known_missing,
    "pre_doc_contracts_sum": D["missing_pre_doc_sum"],
    "xlsx_only_sum": xlsx_only,
    "gear_xlsx": 4000,
    "already_backfilled": 46000,
    "projected_total": D["db"]["revenue_total"] + known_missing + D["missing_pre_doc_sum"] + xlsx_only,
}

json.dump(D, open("/home/z/my-project/scripts/summary_data.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: (v if not isinstance(v, list) else f"[{len(v)} items]") for k, v in D.items()}, ensure_ascii=False, indent=1)[:2000])
print("\nMISSING PRE-DOC:")
for m in D["missing_pre_doc"]:
    print("  ", m["no"], m["date"], m["renter"], m["vehicle"], m["total"])
print("\nMISSING DOC-ERA:")
for m in D["missing_doc_era"]:
    print("  ", m["no"], m["date"], (m["renter"] or "-")[:28], m["vehicle"], m["total"])
print("\nprojection:", D["projection"])
