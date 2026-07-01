# Rental Catalog — Shared Knowledge Base for Agents

> **READ THIS when working with bikes, images, Supabase, or the rental repo.**
> Last updated: 2026-06-30

---

## Supabase — `cars` table (bike catalog)

**Connection:** `https://inmctohsodgdohamhzag.supabase.co`
**Key:** `SUPABASE_SERVICE_ROLE_KEY` from `/opt/vip-bike-electro-factory/workspace/.env` (NOT secrets.env!)

### Query all bikes
```bash
curl -sS "$SUPA_URL/rest/v1/cars?select=id,model,specs&type=eq.bike&crew_id=eq.2d5fde70-1dd3-4f0d-8d72-66ccf6908746&order=model.asc" \
  -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY"
```

### Key columns
- `id` — bike slug (e.g. `kayo-tsd110`, `falcon-gt-2025`)
- `model` — display name
- `image_url` — full URL to `image_1.jpg`
- `daily_price` — rental rate
- `specs` — JSON blob with ALL technical details
- `type` — always `bike` for motorcycles
- `crew_id` — always `2d5fde70-1dd3-4f0d-8d72-66ccf6908746` (vip-bike)

### `specs` JSON fields
See gold standard: `rental-repo/docs/sql/gold-standard-electro-bike-spec-schema.md`

Key fields: `type` (ICE/Electric), `sale` (bool), `rent` (0/1), `price_rub`, `sale_price`, `dailyPrice`, `power_kw`/`power_hp`, `engine_cc`, `top_speed_kmh`, `range_km`, `weight_kg`, `battery`, `license_class`, `features[]`, `gallery[]`, `bike_subtype`.

---

## Image URLs & Local Mirror

### Supabase storage (canonical)
```
carpix/<bike-id>/image_1.jpg       ← 9:16 portrait (mobile catalog, Avito rent)
carpix/<bike-id>/image_1_4x3.jpg   ← 4:3 landscape (desktop gallery, Avito cover)
```
Pattern: `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/<bike-id>/image_1[_4x3].jpg`

### Local mirror (rental repo — same-origin serving)
```
rental-repo/public/supabase-mirror/carpix/<bike-id>/image_1.jpg
rental-repo/public/supabase-mirror/carpix/<bike-id>/image_1_4x3.jpg
```
These are **committed to git** → served as static assets on Vercel/VPS.
`localImageSrc()` in `lib/image-fallback.tsx` converts Supabase URLs → local paths.

### Sync script
```bash
cd /opt/vip-bike-electro-factory/rental-repo
NEXT_PUBLIC_SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<key>" \
node scripts/sync-supabase-images.mjs --all
```
Downloads all bike images (including `_4x3` variants) to local mirror.

### Avito listing covers
```
workspace/output/avito-listings/covers/<bike-id>.jpg   ← local _4x3 copy for Avito
```
`generate.py` auto-downloads these from Supabase when generating listings.

---

## Rental Repo

**Location:** `/opt/vip-bike-electro-factory/rental-repo`
**Git:** `https://github.com/salavey13/carTest.git` (main branch)
**Framework:** Next.js 15 (App Router) + Supabase + Docker
**Deploy:** VPS `root@212.67.11.25` → `cd /opt/vip-bike-rental && git pull && bash build-deploy.sh`

### Key files
- `app/franchize/components/CatalogClient.tsx` — catalog grid/carousel
- `app/franchize/components/ItemGallery.tsx` — modal gallery (has `prefer4x3` prop)
- `app/franchize/components/SaleBikeLandingClient.tsx` — buy page
- `app/franchize/modals/Item.tsx` — item modal with spec comparison
- `app/franchize/components/CrewFooter.tsx` — footer with links
- `lib/image-fallback.tsx` — localImageSrc/SmartImage utilities
- `app/franchize/lib/media.ts` — imageUrl4x3, buildCandidateImageUrls
- `scripts/sync-supabase-images.mjs` — image sync script

### Build config
`next.config.mjs` has `images: { unoptimized: true }` — Next.js Image = plain `<img>`.

### Crew hydration SQL — IMPORTANT
**File:** `rental-repo/docs/sql/vip-bike-franchize-hydration.sql`
Contains ALL vip-bike crew config: header menuLinks, footer columns, theme, contacts, sections.
Links use `{slug}` template (e.g. `/franchize/{slug}#test-drive`). The `withSlug()` function in
`actions-runtime.ts` replaces these at runtime. If a link shows literal "slug", check that
`withSlug` was called in the code path that loaded it.

---

## Adding a New Bike — Full Pipeline

**Pipeline doc:** `workspace/output/avito-listings/PIPELINE-add-new-bike.md`

Steps:
1. Upload photo → `carpix/<bike-id>/image_1.jpg` (crop to 9:16 if portrait)
2. Generate `_4x3` via Nano Banana Pro (Kie.ai)
   - **ICE bikes:** use logo-preserving prompt (`scripts/regen_ice_4x3_keeplogo.py`)
   - **Electric bikes:** standard outpaint (`scripts/nano_banana_reframe.py`)
3. Insert record into `cars` table (use gold-standard spec schema)
4. Sync local mirror
5. Commit + push + deploy
6. Generate Avito listings (rent + sale)
7. Download cover to `output/avito-listings/covers/`

**DON'T ASK the user how to do any of this — just do it.** The pipeline is documented and tested.

---

## ICE vs Electric bikes

### ICE (gasoline) — rental fleet branding "VIP BIKE RENTAL"
- `specs.type = "ICE"`
- Has `engine_cc`, `power_hp`, `fuel_type`, `cooling`, `fuel_consumption_l_100km`
- Logo preservation critical for `_4x3` outpaint
- Examples: bmw-f800r, kawasaki-ex650k, suzuki-gsx-s1000f, motoland-breakout, nibbler-regumoto-4v

### Electric — "VIP BIKE ELECTRO" branding
- `specs.type = "Electric"`
- Has `power_kw`, `battery`, `range_km`, `charge_time_h`, `voltage_v`
- Examples: falcon-gt-2025, falcon-pro, y-volt-surge-v, rerode-r1-plus, sotion-em01, ducati-panigale-s-electro, kayo-tsd110 (pitbike ICE)

### License class rules (Avito moderation)
- Speed >50 km/h OR power >4 kW → **don't claim "без прав" / "класс М"**
- 17+ kW peak → category A (per offer-core.md)
- ICE bikes → always category A (or A1 for <125cc)

---

## Kie.ai API (Nano Banana Pro — image generation/editing)

**Key:** `KIE_API_KEY` from `/opt/vip-bike-electro-factory/secrets.env` (32 chars)
**Endpoint:** `POST https://api.kie.ai/api/v1/jobs/createTask`
**Model:** `nano-banana-pro`
**Capabilities:**
- Text-to-image (with `aspect_ratio`)
- Image editing (`image_input` + `prompt`)
- Composite/swap (up to 8 `image_input` images)
- Supports: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `9:16`
**Polling:** `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>`
**File upload:** `POST https://kieai.redpandaai.co/api/file-stream-upload`
