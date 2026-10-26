#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task144: compute all season report stats from DB → task144-report-data.json"""
import json, urllib.request, urllib.parse
from collections import Counter, defaultdict
from datetime import datetime

URL = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open("/home/z/cartest/scripts/.sb_key").read().strip()
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

def rest(table, params):
    qs = "&".join(k + "=" + urllib.parse.quote(v, safe="") for k, v in params)
    req = urllib.request.Request(URL + "/rest/v1/" + table + "?" + qs)
    req.add_header("apikey", KEY); req.add_header("Authorization", "Bearer " + KEY)
    return json.loads(urllib.request.urlopen(req, timeout=60).read())

veh = {v["id"]: v for v in rest("cars", [("select", "id,make,model,type,daily_price"), ("crew_id", "eq." + CREW), ("limit", "300")])}
rentals = rest("rentals", [
    ("select", "rental_id,vehicle_id,total_cost,requested_start_date,requested_end_date,status,metadata,created_at,created_by_operator_chat_id,deposit_amount,deposit_returned"),
    ("crew_id", "eq." + CREW),
    ("requested_start_date", "gte.2026-04-01T00:00:00+00:00"),
    ("requested_start_date", "lt.2026-11-01T00:00:00+00:00"),
])

MONTH_KEYS = {"2026-04": "Апрель", "2026-05": "Май", "2026-06": "Июнь", "2026-07": "Июль",
              "2026-08": "Август", "2026-09": "Сентябрь", "2026-10": "Октябрь"}

months = {k: {"revenue": 0, "deals": 0, "svc": 0, "svc_sum": 0} for k in MONTH_KEYS}
fleet = defaultdict(lambda: {"rev": 0, "deals": 0, "days": 0.0})
status = Counter()
gear_rev = 0
deposits_held = 0
op_deals = {"count": 0, "revenue": 0}
renters = Counter()
rent_days_total = 0.0

def duration_days(s, e):
    try:
        d = (datetime.fromisoformat(e.replace("+00:00", "")) - datetime.fromisoformat(s.replace("+00:00", "")))
        return max(d.total_seconds() / 86400, 0.04)
    except Exception:
        return 1.0

for x in rentals:
    md = x.get("metadata") or {}
    v = veh.get(x.get("vehicle_id"))
    m = (x.get("requested_start_date") or "")[:7]
    if x["status"] == "cancelled" or x["status"] == "pending_confirmation":
        status[x["status"]] += 1
        continue
    status[x["status"]] += 1
    cost = x.get("total_cost") or 0
    is_svc = (x.get("vehicle_id") or "").startswith("vip-bike-svc")
    is_gear = (v or {}).get("type") == "equipment"
    if m in months:
        if is_svc:
            months[m]["svc"] += 1; months[m]["svc_sum"] += cost
        else:
            months[m]["deals"] += 1; months[m]["revenue"] += cost
    if is_gear:
        gear_rev += cost
        continue
    if is_svc:
        continue
    # bike rental
    title = f"{(v or {}).get('make','')} {(v or {}).get('model','')}".strip() or (x.get("vehicle_id") or "?")
    days = duration_days(x.get("requested_start_date"), x.get("requested_end_date") or x.get("requested_start_date"))
    fleet[title]["rev"] += cost
    fleet[title]["deals"] += 1
    fleet[title]["days"] += days
    rent_days_total += days
    rn = md.get("renter_name")
    if rn:
        renters[rn] += 1
    if x.get("created_by_operator_chat_id") == "7813830016":
        op_deals["count"] += 1
        op_deals["revenue"] += cost
    if x.get("deposit_amount") and not x.get("deposit_returned"):
        deposits_held += x["deposit_amount"]

repeat = sum(1 for n, c in renters.items() if c > 1)
fleet_list = [
    {"name": k, "revenue": int(v["rev"]), "deals": v["deals"], "days": round(v["days"], 1)}
    for k, v in sorted(fleet.items(), key=lambda kv: -kv[1]["rev"])
]
months_out = [{"key": MONTH_KEYS[k], "revenue": int(months[k]["revenue"]), "deals": months[k]["deals"],
               "svc": months[k]["svc"], "svcSum": int(months[k]["svc_sum"])}
              for k in sorted(MONTH_KEYS)]

# intents funnel
intents = rest("franchize_intents", [("select", "intent_type,stage"), ("slug", "eq.vip-bike"), ("limit", "2000")])
ic = Counter((i["intent_type"], i["stage"]) for i in intents)
funnel = {
    "rentIntents": sum(c for (t, s), c in ic.items() if t == "rent"),
    "rentContractGenerated": ic.get(("rent", "contract_generated"), 0),
    "testDrives": sum(c for (t, s), c in ic.items() if t == "test_drive"),
    "saleIntents": sum(c for (t, s), c in ic.items() if t == "sale"),
    "stagesRent": {s: c for (t, s), c in ic.items() if t == "rent"},
}
# sale contracts
try:
    sales = rest("sale_contract_artifacts", [("select", "id,total_sum,status"), ("limit", "200")])
except Exception:
    sales = []

verifs = rest("rental_verifications", [("select", "status,snapshot,payout"), ("crew_id", "eq." + CREW)])
vc = Counter(v["status"] for v in verifs)
commission_pool = sum((v.get("snapshot") or {}).get("total") or 0 for v in verifs)
commission_paid = sum(sum((v.get("payout") or {}).get("entries", {}).values()) if isinstance(v.get("payout"), dict) else 0 for v in verifs)

out = {
    "generatedAt": "2026-10-26T18:30:00Z",
    "months": months_out,
    "statusMix": {"completed": status.get("completed", 0), "active": 0,
                  "cancelled": status.get("cancelled", 0), "pending": status.get("pending_confirmation", 0)},
    "gearRevenue": int(gear_rev),
    "depositHeld": int(deposits_held),
    "fleet": fleet_list,
    "bikesTouched": len(fleet),
    "rentDays": round(rent_days_total, 1),
    "dealsTotal": sum(m["deals"] for m in months_out),
    "revenueTotal": sum(m["revenue"] for m in months_out),
    "svcTotal": {"rows": sum(m["svc"] for m in months_out), "sum": sum(m["svcSum"] for m in months_out)},
    "renters": {"total": len(renters), "repeat": repeat},
    "operatorDeals": op_deals,
    "funnel": funnel,
    "saleContracts": len(sales),
    "verifications": {"total": len(verifs), "byStatus": dict(vc), "commissionPool": int(commission_pool)},
    "topRenters": [{"name": n, "count": c} for n, c in renters.most_common(8)],
}
json.dump(out, open("/home/z/my-project/scripts/task144-report-data.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1)[:3500])
