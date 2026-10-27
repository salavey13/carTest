#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task150: aggregate season P&L data for the v3 report → task150-data.json."""
import json
from collections import defaultdict, Counter

raw = json.load(open("/home/z/my-project/scripts/task150-raw.json"))
rentals, cars, vers, cash, users = raw["rentals"], raw["cars"], raw["verifications"], raw["cash"], raw["users"]
sales_db = raw.get("sale_contracts") or []
intents = raw.get("intents") or []
carmap = {c["id"]: c for c in cars}

def bike_name(c):
    if not c: return "—"
    base = (c.get("make") or "").strip()
    model = (c.get("model") or "").strip()
    if base and model and base.lower() not in model.lower(): return f"{base} {model}".strip()
    return model or base or "—"

def is_svc(r):
    c = carmap.get(r["vehicle_id"]) or {}
    return c.get("type") == "service" or (c.get("make") == "VIP_BIKE")

def month_of(r):
    d = r.get("agreed_start_date") or r.get("requested_start_date") or r.get("created_at") or ""
    return str(d)[:7]

IN_SEASON = lambda m: "2026-04" <= m <= "2026-10"

# ── A. month money ────────────────────────────────────────────────────────
months = {}
for m in ["2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"]:
    months[m] = {"rent": 0.0, "deals": 0, "svc": 0.0, "svc_n": 0}
for r in rentals:
    m = month_of(r)
    if not IN_SEASON(m) or r["status"] == "cancelled": continue
    if is_svc(r):
        months[m]["svc"] += r.get("total_cost") or 0; months[m]["svc_n"] += 1
    else:
        months[m]["rent"] += r.get("total_cost") or 0; months[m]["deals"] += 1

# ── B. per-bike earnings (ALL bikes, the boss wants the full list) ───────
bikes = defaultdict(lambda: {"name": "", "rev": 0.0, "deals": 0, "days": 0, "subrented": False, "sub_chat": None})
def days_between(a, b):
    try:
        from datetime import date
        da = date(*map(int, str(a)[:10].split("-"))); db = date(*map(int, str(b)[:10].split("-")))
        return max(1, (db - da).days)
    except Exception: return 1
for r in rentals:
    if r["status"] == "cancelled" or is_svc(r) or not IN_SEASON(month_of(r)): continue
    c = carmap.get(r["vehicle_id"]) or {}
    if c.get("type") not in ("bike", None): continue
    key = r["vehicle_id"]
    b = bikes[key]
    b["name"] = bike_name(c)
    b["rev"] += r.get("total_cost") or 0
    b["deals"] += 1
    b["days"] += days_between(r.get("agreed_start_date") or r.get("requested_start_date"), r.get("agreed_end_date") or r.get("requested_end_date"))
    sp = c.get("specs") or {}
    if sp.get("subrenter_chat_id"): b["subrented"] = True; b["sub_chat"] = str(sp["subrenter_chat_id"])

# partner (subrent) split: 50% of (total − equipment part); estimate equipment from metadata.equipment_price
partner_earn = defaultdict(float)
sub_bikes = [k for k, b in bikes.items() if b["subrented"]]
sub_rev = defaultdict(float)
for r in rentals:
    if r["status"] == "cancelled" or is_svc(r) or not IN_SEASON(month_of(r)): continue
    if r["vehicle_id"] in sub_bikes:
        meta = r.get("metadata") or {}
        eq = meta.get("equipment_price") or 0
        part = max(0.0, (r.get("total_cost") or 0) - (eq if isinstance(eq, (int, float)) else 0))
        partner_earn[r["vehicle_id"]] += part * 0.5
        sub_rev[r["vehicle_id"]] += r.get("total_cost") or 0

fleet = []
for k, b in bikes.items():
    fleet.append({"id": k, "name": b["name"], "revenue": round(b["rev"]), "deals": b["deals"],
                  "days": b["days"], "subrented": b["subrented"],
                  "partner_cut": round(partner_earn.get(k, 0)) if b["subrented"] else None})
fleet.sort(key=lambda x: -x["revenue"])

# ── C. operator commissions (verification snapshots) ─────────────────────
op_month = defaultdict(lambda: {"total": 0.0, "n": 0, "confirmed": 0, "pending": 0})
for v in vers:
    snap = v.get("snapshot") or {}
    tot = snap.get("total")
    if tot is None: continue
    m = str(v.get("requested_at") or "")[:7]
    if not IN_SEASON(m): continue
    key = str(v.get("operator_chat_id") or "?")
    e = op_month[key]; e["total"] += tot or 0; e["n"] += 1
    if v.get("status") == "verified": e["confirmed"] += 1
    else: e["pending"] += 1
operators = {}
for k, e in op_month.items():
    operators[k] = {"name": users.get(k, f"оператор {k}"), "total": round(e["total"]), "n": e["n"],
                    "confirmed": e["confirmed"], "pending": e["pending"],
                    "months": {}}
    for m in ["2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"]:
        pass
# monthly split per operator
opm = defaultdict(lambda: defaultdict(float))
for v in vers:
    snap = v.get("snapshot") or {}
    tot = snap.get("total")
    if tot is None: continue
    m = str(v.get("requested_at") or "")[:7]
    if not IN_SEASON(m): continue
    opm[str(v.get("operator_chat_id") or "?")][m] += tot or 0
for k in operators:
    operators[k]["months"] = {m: round(opm[k].get(m, 0)) for m in sorted(opm[k])}

# cash ledger commission payouts (actual money paid out)
cash_comm = defaultdict(float); cash_comm_n = Counter()
for c in cash:
    if c.get("transaction_type") == "expense_commission":
        to = str(c.get("to_user_id") or "?")
        cash_comm[to] += c.get("amount") or 0; cash_comm_n[to] += 1
cash_out = defaultdict(float)
for c in cash:
    cash_out[str(c.get("transaction_type"))] += c.get("amount") or 0
cash_in = defaultdict(float)
for c in cash:
    if c.get("flow_direction") == "in": cash_in[str(c.get("transaction_type"))] += c.get("amount") or 0

# ── D. deposits / «падальщики» ────────────────────────────────────────────
dep_rows = []
for r in rentals:
    d = r.get("deposit_amount") or 0
    if not d: continue
    c = carmap.get(r["vehicle_id"]) or {}
    dep_rows.append({"rental": r["rental_id"], "month": month_of(r), "bike": bike_name(c),
                     "renter": (r.get("metadata") or {}).get("renter_name") or "—",
                     "amount": d, "returned": bool(r.get("deposit_returned")),
                     "notes": r.get("deposit_notes") or "", "status": r["status"]})
kept = [d for d in dep_rows if not d["returned"]]
dep_total_collected = sum(d["amount"] for d in dep_rows)
dep_total_kept = sum(d["amount"] for d in kept)

# ── E. sales (db contracts) ───────────────────────────────────────────────
sales = []
for s in sales_db:
    price = str(s.get("sale_price") or "0").replace(" ", "").replace("\u00a0", "").replace(",", ".")
    try: price = float(price)
    except ValueError: price = 0.0
    sales.append({"price": price, "created": str(s.get("created_at") or "")[:7],
                  "buyer": s.get("buyer_full_name") or "", "bike": s.get("resolved_bike_id")})
sales_total = sum(s["price"] for s in sales)

# ── F. funnel ─────────────────────────────────────────────────────────────
funnel = Counter(i["intent_type"] for i in intents)

# ── G. service spendings per bike from service rows (what we spent) ──────
svc_spend = defaultdict(float)
for r in rentals:
    if not is_svc(r) or r["status"] == "cancelled": continue
    meta = r.get("metadata") or {}
    target = meta.get("bike") or meta.get("bike_name") or ""
    svc_spend[target or "—"] += r.get("total_cost") or 0

out = {
    "generatedAt": "2026-10-27",
    "months": {m: {k: round(v) if isinstance(v, float) else v for k, v in d.items()} for m, d in months.items()},
    "fleet": fleet,
    "fleetTotalRevenue": round(sum(f["revenue"] for f in fleet)),
    "operators": operators,
    "cashCommPayouts": {k: {"sum": round(v), "n": cash_comm_n[k], "name": users.get(k, k)} for k, v in cash_comm.items()},
    "cashOut": {k: round(v) for k, v in cash_out.items()},
    "cashIn": {k: round(v) for k, v in cash_in.items()},
    "deposits": {"rows": len(dep_rows), "collected": dep_total_collected, "kept": dep_total_kept,
                 "keptCount": len(kept), "keptList": sorted(kept, key=lambda x: -x["amount"])[:40]},
    "salesDb": {"n": len(sales), "total": sales_total},
    "funnel": dict(funnel),
    "svcSpendByName": {k: round(v) for k, v in sorted(svc_spend.items(), key=lambda kv: -kv[1])},
}
json.dump(out, open("/home/z/my-project/scripts/task150-data.json", "w"), ensure_ascii=False, indent=1)
print("fleet bikes with revenue:", len(fleet))
for f in fleet[:35]: print(" ", f["name"], f["revenue"], f"deals={f['deals']}", "SUBRENT" if f["subrented"] else "")
print("month total rent:", sum(d["rent"] for d in months.values()))
print("operators:", {k: v["name"] + " " + str(v["total"]) for k, v in operators.items()})
print("cash comm payouts:", out["cashCommPayouts"])
print("cash in:", out["cashIn"], "out:", out["cashOut"])
print("deposits: collected", dep_total_collected, "kept", dep_total_kept, "keptCount", len(kept))
print("sales db:", out["salesDb"])
print("funnel:", dict(funnel))
print("svc spend:", out["svcSpendByName"])
