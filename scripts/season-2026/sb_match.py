#!/usr/bin/env python3
"""Fetch rentals + cash_transactions; match zip doc files against rentals by sha256/keys."""
import os, json, urllib.request, urllib.parse, hashlib

import os as _os
KEY = _os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or (open(".sb_key").read().strip() if _os.path.exists(".sb_key") else None)
if not KEY:
    raise SystemExit("Set SUPABASE_SERVICE_ROLE_KEY env or drop .sb_key in cwd")
BASE = "https://inmctohsodgdohamhzag.supabase.co/rest/v1"
HDRS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

def fetch_all(table, order=None):
    out, off = [], 0
    while True:
        params = {"select": "*", "limit": 1000, "offset": off}
        if order:
            params["order"] = order
        url = f"{BASE}/{table}?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers=HDRS)
        with urllib.request.urlopen(req, timeout=30) as r:
            batch = json.loads(r.read())
        if not batch:
            break
        out += batch
        off += 1000
        if len(batch) < 1000:
            break
    return out

rentals = fetch_all("rentals", order="created_at.asc")
cash = fetch_all("cash_transactions", order="transaction_date.asc")
json.dump(rentals, open("/home/z/my-project/scripts/rentals_full.json", "w"), ensure_ascii=False, indent=1)
json.dump(cash, open("/home/z/my-project/scripts/cash_full.json", "w"), ensure_ascii=False, indent=1)
print(f"rentals={len(rentals)} cash_transactions={len(cash)}")

# cash stats by type
from collections import Counter
tt = Counter(c.get("transaction_type") for c in cash)
print("cash transaction_type:", tt.most_common())
sale_cash = [c for c in cash if c.get("sale_contract_id")]
print(f"cash with sale_contract_id: {len(sale_cash)}, sum={sum(float(c.get('amount') or 0) for c in sale_cash):,.0f}")

# ---- matching ----
inv = json.load(open("/home/z/my-project/scripts/doc_inventory.json"))
by_doc_sha, by_orig_sha, by_ock = {}, {}, {}
for r in rentals:
    md = r.get("metadata") or {}
    for k in ("doc_sha256", "original_sha256"):
        v = md.get(k)
        if v:
            (by_doc_sha if k == "doc_sha256" else by_orig_sha).setdefault(v, []).append(r)
    ock = md.get("original_contract_key")
    if ock:
        by_ock.setdefault(ock, []).append(r)

print(f"\nDB hash keys: doc_sha256={len(by_doc_sha)} orig_sha256={len(by_orig_sha)} ock={len(by_ock)}")

# look for the pdf artifact key
pdf_ock = [k for k in by_ock if "1780156819969" in k]
print("ock containing 1780156819969:", pdf_ock)
if pdf_ock:
    for r in by_ock[pdf_ock[0]]:
        print("  ->", r["rental_id"], r.get("status"), r.get("agreed_start_date"), r.get("total_cost"),
              (r.get("metadata") or {}).get("renter_name"))

report = []
for f in inv:
    sha = f["sha256"]
    matched = by_doc_sha.get(sha) or by_orig_sha.get(sha)
    rec = {"file": f["file"], "type": f["type"], "sha256": sha,
           "matched_rental_id": matched[0]["rental_id"] if matched else None,
           "matched_status": matched[0].get("status") if matched else None,
           "matched_created_at": matched[0].get("created_at") if matched else None}
    report.append(rec)
json.dump(report, open("/home/z/my-project/scripts/doc_match_report.json", "w"), ensure_ascii=False, indent=1)

n_m = sum(1 for r in report if r["matched_rental_id"])
print(f"\nMATCHED by sha256: {n_m}/{len(report)}")
print("\nUNMATCHED files:")
for r in report:
    if not r["matched_rental_id"]:
        print("  -", r["file"][:120], f"[{r['type']}]")
