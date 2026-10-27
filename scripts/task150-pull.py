#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task150: full season data pull for the v3 season report (P&L edition).
Pulls rentals + fleet + verifications + cash ledger + intents from prod DB,
aggregates everything the boss asked for, saves task150-data.json."""
import json, urllib.request, urllib.parse
from collections import defaultdict

SB = "https://inmctohsodgdohamhzag.supabase.co"
KEY = open("/home/z/cartest/.sb_key").read().strip()
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
SEASON = ("2026-03-25", "2026-11-01")  # wide net, filter by month key later

def get(table, params, private=False, count=False):
    q = f"{SB}/rest/v1/{table}?{params}"
    req = urllib.request.Request(q)
    req.add_header("apikey", KEY); req.add_header("Authorization", f"Bearer {KEY}")
    if private: req.add_header("Accept-Profile", "private")
    n = 0; out = []
    while True:
        r = urllib.request.Request(q + f"&limit=1000&offset={n}")
        r.add_header("apikey", KEY); r.add_header("Authorization", f"Bearer {KEY}")
        if private: r.add_header("Accept-Profile", "private")
        with urllib.request.urlopen(r) as resp:
            batch = json.loads(resp.read().decode())
        out += batch
        if len(batch) < 1000: break
        n += 1000
    return out

# ── 1. rentals ────────────────────────────────────────────────────────────
rentals = get("rentals", f"crew_id=eq.{CREW}&select=rental_id,vehicle_id,owner_id,status,payment_status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,deposit_amount,deposit_returned,deposit_notes,metadata,created_at")
print("rentals:", len(rentals))

# ── 2. fleet ──────────────────────────────────────────────────────────────
cars = get("cars", f"crew_id=eq.{CREW}&select=id,make,model,daily_price,type,specs,owner_id")
print("cars:", len(cars))

# ── 3. verifications (commission snapshots) ──────────────────────────────
vers = get("rental_verifications", f"crew_id=eq.{CREW}&select=rental_id,operator_chat_id,owner_chat_id,status,requested_at,snapshot,payout,negotiation")
print("verifications:", len(vers))

# ── 4. cash ledger ────────────────────────────────────────────────────────
cash = get("cash_transactions", f"crew_id=eq.{CREW}&select=*")
print("cash:", len(cash))

# ── 5. users for name mapping ─────────────────────────────────────────────
chat_ids = sorted({str(r.get("operator_chat_id") or "") for r in vers if r.get("operator_chat_id")} |
                  {str(r.get("owner_chat_id") or "") for r in vers if r.get("owner_chat_id")} |
                  {str(c.get("owner_id") or "") for c in cars if c.get("owner_id")} |
                  {str(r.get("owner_id") or "") for r in rentals if r.get("owner_id")})
users = {}
try:
    idlist = ",".join(c for c in chat_ids if c)
    urows = get("users", f"user_id=in.({idlist})&select=user_id,username,full_name")
    for u in urows:
        users[str(u["user_id"])] = (u.get("full_name") or "") + (f" @{u['username']}" if u.get("username") else "")
except Exception as e:
    print("users mapping failed:", e)
print("users mapped:", len(users))

# ── 6. sales contracts (private schema) ──────────────────────────────────
try:
    sales = get("sale_contract_artifacts", "select=id,resolved_bike_id,sale_price,created_at,buyer_full_name", private=True)
    print("sale_contract_artifacts:", len(sales), list(sales[0].keys()) if sales else "")
except Exception as e:
    sales = []; print("sale_contract_artifacts: none", str(e)[:120])

# ── 7. intents funnel (public) ───────────────────────────────────────────
try:
    intents = get("franchize_intents", f"crew_id=eq.{CREW}&select=intent_type,created_at")
    print("intents:", len(intents))
except Exception as e:
    intents = []; print("intents: none", str(e)[:120])

json.dump({"rentals": rentals, "cars": cars, "verifications": vers, "cash": cash,
           "users": users, "sale_contracts": sales, "intents": intents},
          open("/home/z/my-project/scripts/task150-raw.json", "w"), ensure_ascii=False)
print("saved task150-raw.json")
