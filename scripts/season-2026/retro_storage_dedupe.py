#!/usr/bin/env python3
"""Deduplicate retro/ storage objects created by task111 runs (underscores/lowercase
variants) when the prior 2026-10-18 upload already holds the same docx; point
rentals.metadata.doc_storage_paths at the canonical prior objects.

Matching: exact byte size (from doc_inventory.json) + best normalized-name score.
Deletion only when a strict size+name match exists. Metadata merged afterwards.
"""
import json, os, re, sys, urllib.request
sys.path.insert(0, "/home/z/my-project/scripts")
from retro_import_v2 import key_load, C  # noqa
from retro_import_v2_finish import api, _RU2LA, ascii_key  # reuse

BASE = "/home/z/my-project"
SB = "https://inmctohsodgdohamhzag.supabase.co"


def list_retro():
    req = urllib.request.Request(f"{SB}/storage/v1/object/list/rental-contracts",
        data=json.dumps({"prefix": "vip-bike/retro/", "limit": 400}).encode(),
        headers={"apikey": key_load(), "Authorization": f"Bearer {key_load()}",
                 "Content-Type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=30).read().decode())


def norm_name(s):
    s = s.lower()
    s = "".join(_RU2LA.get(ch, ch) for ch in s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def main():
    apply = "--apply" in sys.argv
    inv = {r["file"]: r for r in json.load(open(f"{BASE}/scripts/doc_inventory.json"))}
    objs = list_retro()
    print(f"retro objects in bucket: {len(objs)}")
    # canonical set = objects created 2026-10-18 (prior session)
    prior = [o for o in objs if (o.get("created_at") or "").startswith("2026-10-18")]
    mine = [o for o in objs if not (o.get("created_at") or "").startswith("2026-10-18")]
    print(f"prior(10-18): {len(prior)}   mine(new): {len(mine)}")

    def oname(o):
        return (o.get("name") or "").split("/")[-1]

    prior_norm = [norm_name(oname(o)) for o in prior]
    prior_sizes = [((o.get("metadata") or {}).get("size")) for o in prior]

    dup_paths = []
    mapping = {}  # my_file -> canonical object name
    for o in mine:
        nm = norm_name(oname(o))
        size = (o.get("metadata") or {}).get("size")
        # primary: exact size match — docx sizes are distinctive
        size_hits = [i for i, ps in enumerate(prior_sizes) if ps == size and size]
        if len(size_hits) == 1:
            dup_paths.append(o["name"])
            mapping[oname(o)] = oname(prior[size_hits[0]])
            continue
        best, bs = None, 0.0
        for i, pn in enumerate(prior_norm):
            ps = (prior[i].get("metadata") or {}).get("size")
            sc = 0
            if size and ps and size == ps:
                sc += 2
            common = os.path.commonprefix([nm, pn])
            sc += (len(common) / max(len(nm), len(pn), 1)) if nm and pn else 0
            if sc > bs:
                best, bs = prior[i], sc
        if best and bs >= 2.6 and (size == (best.get("metadata") or {}).get("size")):
            dup_paths.append(o["name"])
            mapping[oname(o)] = oname(best)
        else:
            mapping[oname(o)] = None  # keep (no canonical counterpart)

    print(f"duplicates to delete: {len(dup_paths)}")
    if apply:
        for p in dup_paths:
            full = p if p.startswith("vip-bike/retro/") else f"vip-bike/retro/{p}"
            st, resp = api("DELETE", f"/storage/v1/object/rental-contracts/{urllib.parse.quote(full)}")
            print(f"  [DEL {st}] {p.split('/')[-1]} {'' if st == 200 else str(resp)[:160]}")

    # rebuild doc_storage_paths for v2 rentals: match by exact docx size (distinctive)
    if apply:
        st, rentals = api("GET", "/rest/v1/rentals?select=rental_id,metadata&metadata->>source=eq.retro_backfill_v2&limit=100")
        rows = rentals if st == 200 and isinstance(rentals, list) else []
        prior_by_size = {}
        for o in prior:
            ps = (o.get("metadata") or {}).get("size")
            prior_by_size.setdefault(ps, []).append(oname(o))
        size_by_file = {r["file"]: r.get("size") for r in json.load(open(f"{BASE}/scripts/doc_inventory.json"))}

        def nn(s):
            s = s.lower()
            s = "".join(_RU2LA.get(ch, ch) for ch in s)
            return re.sub(r"[^a-z0-9]+", "", s)

        fixed = 0
        for r in rows:
            md = dict(r.get("metadata") or {})
            files = [md.get("doc_file")] if md.get("doc_file") else []
            paths = []
            for f in files:
                if not f:
                    continue
                cands = prior_by_size.get(size_by_file.get(f)) or []
                if cands:
                    nf = nn(f)
                    best = max(cands, key=lambda cn: len(os.path.commonprefix([nn(cn), nf])))
                    paths.append(f"vip-bike/retro/{best}")
                else:
                    paths.append(f"vip-bike/retro/{ascii_key(f)}")
            if not paths:
                continue
            if md.get("doc_storage_paths") != paths:
                md["doc_storage_paths"] = paths
                md["doc_storage_bucket"] = "rental-contracts"
                st2, _ = api("PATCH", f"/rest/v1/rentals?rental_id=eq.{r['rental_id']}",
                             {"metadata": md}, headers={"Prefer": "return=minimal"})
                if st2 in (200, 204):
                    fixed += 1
                else:
                    print(f"  [PATCH-ERR {st2}] {md.get('renter_name')}")
        print(f"metadata doc_storage_paths normalized → {fixed} rentals")
    else:
        for p in dup_paths:
            print("  [would DEL]", p.split("/")[-1])


import urllib.parse  # noqa: E402
if __name__ == "__main__":
    main()
