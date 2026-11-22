#!/usr/bin/env python3
"""Backfill the formal salary-ledger side of the 10k payout to salavey13.

Why: the payout was recorded ONLY in owner_cash_entries (owner wallet, via
assistant bot). The salary pages compute «already paid» from cash_transactions
expense_salary rows (to_user_id) — without this row the salary page would keep
showing a balance for money already handed out (double-pay risk).
Also: fix «Paul» → «salavey13» in the y-volt saleProgress note (admin roster:
413553377 → salavey13).
"""
import json, urllib.request, urllib.parse

def env(k):
    with open("/home/z/cartest/.env.local") as f:
        for line in f:
            if line.startswith(k + "="):
                return line.strip().split("=", 1)[1]
    raise KeyError(k)

BASE = env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
KEY = env("SUPABASE_SERVICE_ROLE_KEY")
CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
ADMIN = "413553377"
WALLET_ENTRY = "d3235c01-dec8-411e-bedc-f2f7f52df117"
YVOLT_LEAD = "086e8ba9-d3ad-4510-bbcc-eaf7dd511c8d"

def req(path, params=None, method="GET", body=None):
    url = f"{BASE}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    r = urllib.request.Request(url, method=method)
    r.add_header("apikey", KEY)
    r.add_header("Authorization", f"Bearer {KEY}")
    if body is not None:
        r.add_header("Content-Type", "application/json")
        r.add_header("Prefer", "return=representation")
        data = json.dumps(body).encode()
    else:
        data = None
    try:
        with urllib.request.urlopen(r, data) as resp:
            return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")

# ── 1) formal expense_salary row (idempotent) ────────────────────────────────
desc = f"Выплата зарплаты админу salavey13 — зеркало кошелька {WALLET_ENTRY} (assistant_bot, 2026-09-09)"
st, dup = req("cash_transactions", {
    "crew_id": f"eq.{CREW}", "to_user_id": f"eq.{ADMIN}",
    "transaction_type": "eq.expense_salary", "amount": "eq.10000",
    "select": "id,transaction_date,description",
})
if st == 200 and dup:
    print("expense_salary: already exists", json.dumps(dup, ensure_ascii=False)[:200])
else:
    row = {
        "crew_id": CREW,
        "transaction_type": "expense_salary",
        "flow_direction": "out",
        "amount": 10000,
        "payment_method": "cash",
        "category": "Зарплата",
        "description": desc,
        "transaction_date": "2026-09-09T12:00:00+00:00",
        "to_user_id": ADMIN,
        "created_by": ADMIN,
    }
    st, ins = req("cash_transactions", method="POST", body=row)
    print("expense_salary insert:", st, json.dumps(ins, ensure_ascii=False)[:300] if st == 201 else ins)

# ── 2) y-volt saleProgress note: Paul → salavey13 ────────────────────────────
st, rows = req("franchize_intents", {"id": f"eq.{YVOLT_LEAD}", "select": "id,metadata"})
if st == 200 and rows:
    md = rows[0].get("metadata") or {}
    sp = md.get("saleProgress") or {}
    note = sp.get("note") or ""
    if "Paul" in note:
        sp["note"] = note.replace(
            "со слов Paul (admin 413553377)", "со слов salavey13 (admin 413553377)")
        md["saleProgress"] = sp
        st2, upd = req("franchize_intents", {"id": f"eq.{YVOLT_LEAD}"}, method="PATCH",
                       body={"metadata": md})
        print("yvolt note PATCH:", st2)
    else:
        print("yvolt note already clean")
    st3, chk = req("franchize_intents", {"id": f"eq.{YVOLT_LEAD}", "select": "metadata->>saleProgress"})
    print("yvolt saleProgress now:", json.dumps(chk, ensure_ascii=False)[:300])

# ── 3) verify all three ledgers agree ────────────────────────────────────────
st, tx = req("cash_transactions", {
    "crew_id": f"eq.{CREW}", "to_user_id": f"eq.{ADMIN}",
    "transaction_type": "eq.expense_salary",
    "select": "id,amount,transaction_date,description", "order": "transaction_date.desc", "limit": 3,
})
print("\nverify expense_salary (to salavey13):")
for t in tx or []:
    print(" ", json.dumps(t, ensure_ascii=False)[:250])
st, oc = req("owner_cash_entries", {
    "crew_id": f"eq.{CREW}", "direction": "eq.out", "amount": "eq.10000",
    "select": "id,title,person,entry_date,source",
})
print("wallet side:", json.dumps(oc, ensure_ascii=False)[:250])
