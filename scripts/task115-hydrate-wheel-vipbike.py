#!/usr/bin/env python3
"""Task 115: hydrate vip-bike wheel promo into crews.metadata.

Idempotent read-modify-write via PostgREST (service role):
  1) franchize.catalog.adCards      — upsert «Колесо фортуны» ad card (id=wheel-fortune-card)
  2) franchize.header.menuLinks     — insert «Колесо фортуны» link after «Карта» (by href match)

Touches ONLY these two arrays; every other metadata key stays byte-identical.
Safe to re-run: both steps match by stable id/href first.
"""
import json, os, sys, urllib.request

def _load_key() -> str:
    """Service key: env var first, then .sb_key in cwd / script dir (never in git)."""
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env:
        return env
    for path in (
        os.path.join(os.getcwd(), ".sb_key"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".sb_key"),
    ):
        if os.path.exists(path):
            return open(path).read().strip()
    raise SystemExit("No SUPABASE_SERVICE_ROLE_KEY env / .sb_key file found")


KEY = _load_key()
BASE = "https://inmctohsodgdohamhzag.supabase.co/rest/v1"
SLUG = "vip-bike"

WHEEL_AD_ID = "wheel-fortune-card"
WHEEL_MENU_HREF = "/franchize/{slug}/wheel"
WHEEL_MENU_LABEL = "Колесо фортуны"

WHEEL_AD = {
    "id": WHEEL_AD_ID,
    "title": "Колесо фортуны",
    "subtitle": "Крути колесо и забирай скидку: 1 000 ₽, 2 000 ₽, 5 000 ₽ или 15% на аренду и покупку. Одна крутка в сутки — зайди и попробуй удачу.",
    "href": "/franchize/vip-bike/wheel",
    "imageUrl": "",
    "badge": "Призы каждый день",
    "activeFrom": "2026-10-21",
    "activeTo": "2026-12-31",
    "priority": 96,
    "ctaLabel": "Крутить колесо",
}


def req(path, method="GET", body=None):
    r = urllib.request.Request(BASE + path, method=method)
    r.add_header("apikey", KEY)
    r.add_header("Authorization", f"Bearer {KEY}")
    if body is not None:
        r.add_header("Content-Type", "application/json")
        r.add_header("Prefer", "return=representation")
        data = json.dumps(body).encode()
    else:
        data = None
    with urllib.request.urlopen(r, data=data, timeout=30) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip() else None


crews = req(f"/crews?select=id,slug,metadata&slug=eq.{SLUG}")
assert crews and len(crews) == 1, f"crew {SLUG} lookup failed: {crews}"
crew = crews[0]
md = crew.get("metadata") or {}
fr = md.get("franchize") or {}
catalog = fr.get("catalog") or {}
header = fr.get("header") or {}
ads = list(catalog.get("adCards") or [])
menu = list(header.get("menuLinks") or [])

print(f"BEFORE: adCards={len(ads)}, menuLinks={len(menu)}")
for a in ads:
    print(f"  ad: id={a.get('id')} prio={a.get('priority')} {a.get('title')}")

# ── 1) upsert wheel ad card (idempotent by id) ─────────────────────────────
ads = [a for a in ads if a.get("id") != WHEEL_AD_ID]
ads.append(dict(WHEEL_AD))
ads.sort(key=lambda a: -(a.get("priority") or 0))

# ── 2) insert wheel menu link after «Карта» (idempotent by href) ───────────
menu = [l for l in menu if l.get("href") != WHEEL_MENU_HREF]
insert_at = 0
for i, l in enumerate(menu):
    if "map-riders" in str(l.get("href", "")):
        insert_at = i + 1
        break
else:
    insert_at = min(2, len(menu))
menu.insert(insert_at, {"label": WHEEL_MENU_LABEL, "href": WHEEL_MENU_HREF})

next_md = json.loads(json.dumps(md))  # deep copy
next_md["franchize"]["catalog"]["adCards"] = ads
next_md["franchize"]["header"]["menuLinks"] = menu

patched = req(f"/crews?slug=eq.{SLUG}", method="PATCH", body={"metadata": next_md})
assert patched and len(patched) == 1, "PATCH failed"

# verify
ver = patched[0]["metadata"]["franchize"]
v_ads = ver["catalog"]["adCards"]
v_menu = ver["header"]["menuLinks"]
print(f"\nAFTER: adCards={len(v_ads)}, menuLinks={len(v_menu)}")
for a in v_ads:
    print(f"  ad: id={a.get('id')} prio={a.get('priority')} {a.get('title')}")
for l in v_menu:
    print(f"  menu: {l.get('label')} -> {l.get('href')}")
wheel_ok = any(a.get("id") == WHEEL_AD_ID for a in v_ads) and any(
    l.get("href") == WHEEL_MENU_HREF for l in v_menu
)
print(f"\nWHEEL HYDRATED: {wheel_ok}")
sys.exit(0 if wheel_ok else 1)
