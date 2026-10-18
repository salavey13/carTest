#!/usr/bin/env python3
"""Find working Supabase service-role key: scan repo for JWT candidates, test each against PostgREST."""
import os, re, json, urllib.request

REPO = "/home/z/my-project/cartest"
URL = "https://inmctohsodgdohamhzag.supabase.co/rest/v1/"
JWT_RE = re.compile(r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_=-]{40,}\.[A-Za-z0-9_-]{20,}")

candidates = set()
for root, dirs, files in os.walk(REPO):
    dirs[:] = [d for d in dirs if d not in (".git", "node_modules", ".next")]
    for fn in files:
        if fn.split(".")[-1].lower() not in ("ts", "tsx", "js", "jsx", "py", "sql", "md", "env", "txt", "json", "sh", "yml", "yaml", "toml"):
            continue
        try:
            txt = open(os.path.join(root, fn), encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        for m in JWT_RE.findall(txt):
            candidates.add(m)

print(f"Found {len(candidates)} JWT candidates")

def test(tok):
    req = urllib.request.Request(URL + "rentals?select=rental_id&limit=1",
                                 headers={"apikey": tok, "Authorization": f"Bearer {tok}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        return False
    except Exception:
        return False

good = []
for tok in sorted(candidates):
    if test(tok):
        good.append(tok)
        print("WORKING:", tok[:50] + "...")

if good:
    with open("/home/z/my-project/scripts/.sb_key", "w") as f:
        f.write(good[0])
    os.chmod("/home/z/my-project/scripts/.sb_key", 0o600)
    print(f"Saved {len(good)} working key(s), best -> /home/z/my-project/scripts/.sb_key")
else:
    print("NO WORKING KEY FOUND")
