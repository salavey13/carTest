#!/usr/bin/env python3
"""Rebuild doc_storage_paths for all retro_backfill_v2 rows from the curated list
(matched by renter_name), pointing at the canonical 2026-10-18 prior objects
(exact docx-size match via doc_inventory)."""
import json, os, re, sys, urllib.request
sys.path.insert(0, "/home/z/my-project/scripts")
from retro_import_v2 import key_load, C
from retro_import_v2_finish import _RU2LA

SB = "https://inmctohsodgdohamhzag.supabase.co"


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"apikey": key_load(), "Authorization": f"Bearer {key_load()}"}
    if body is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(SB + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return r.status, json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def nn(s):
    s = s.lower()
    s = "".join(_RU2LA.get(ch, ch) for ch in s)
    return re.sub(r"[^a-z0-9]+", "", s)


def main():
    st, rows = api("GET", "/rest/v1/rentals?select=rental_id,metadata&metadata->>source=eq.retro_backfill_v2&limit=100")
    rows = rows if st == 200 and isinstance(rows, list) else []
    req = urllib.request.Request(f"{SB}/storage/v1/object/list/rental-contracts",
        data=json.dumps({"prefix": "vip-bike/retro/", "limit": 400}).encode(),
        headers={"apikey": key_load(), "Authorization": f"Bearer {key_load()}",
                 "Content-Type": "application/json"}, method="POST")
    objs = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
    prior = [o for o in objs if (o.get("created_at") or "").startswith("2026-10-18")]
    prior_by_size = {}
    for o in prior:
        ps = (o.get("metadata") or {}).get("size")
        prior_by_size.setdefault(ps, []).append(o["name"].split("/")[-1])
    size_by_file = {r["file"]: r.get("size") for r in json.load(open("/home/z/my-project/scripts/doc_inventory.json"))}

    cur_by_renter = {c["renter"]: c for c in C}
    fixed = 0
    for r in rows:
        md = dict(r.get("metadata") or {})
        rn = md.get("renter_name")
        c = cur_by_renter.get(rn)
        if not c:
            print(f"  [NO-CURATED] {rn}")
            continue
        files = [c["file"]] + list(c.get("extra_files") or [])
        paths = []
        for f in files:
            cands = prior_by_size.get(size_by_file.get(f)) or []
            if cands:
                nf = nn(f)
                best = max(cands, key=lambda cn: len(os.path.commonprefix([nn(cn), nf])))
                paths.append(f"vip-bike/retro/{best}")
            else:
                print(f"  [NO-SIZE-MATCH] {f}")
        md["doc_storage_paths"] = paths
        md["doc_storage_bucket"] = "rental-contracts"
        hist = md.get("history") or []
        if not any("canonical storage path" in (h.get("note") or "") for h in hist):
            hist = hist + [{"at": "2026-10-21T00:00:00Z", "by": "task111-retro-finish",
                            "note": "canonical storage path fix (dedupe of task111 upload variants)",
                            "status": "completed"}]
            md["history"] = hist
        st2, _ = api("PATCH", f"/rest/v1/rentals?rental_id=eq.{r['rental_id']}", {"metadata": md})
        if st2 in (200, 204):
            fixed += 1
        else:
            print(f"  [PATCH-ERR {st2}] {rn}")
    print(f"rebuilt doc_storage_paths → {fixed}/{len(rows)} rentals")


if __name__ == "__main__":
    main()
