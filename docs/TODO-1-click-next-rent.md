# 1-Click Next Rent — Project TODO

> Living document for VIP Bike Rental franchise integration.
> Each section has inline `[ ]` checkboxes. Check them off as you complete work.
> **Structure rule**: progress is tracked inline via checkboxes — do NOT append results to end of file.

---

## 🔍 Phase 1: Investigation ✅

> All investigations complete. Findings documented inline.

### 1.1 Rental Contract Generation Pipeline ✅
- [x] **Skill script** — full flow traced. Mustache replacement, `sha256(buf)`, `rental_contract_artifacts`, Telegram `sendDocument`.
- [x] **Web-app pipeline** — `buildFranchizeOrderDocAndNotify()` → `buildFranchizeDocxFromTemplate()` → `registerVerifierOriginalForBuffer()`.
- [x] **Template** — HTML mode is high-fidelity path. `renter_address` missing from templates. Page breaks added (Task H).

### 1.2–1.9 ✅ (see previous versions for detailed findings)

---

## 🏗️ Phase 2: Core Infrastructure

### Task A: Fix Duplicate DOCX Delivery Bug ✅
- [x] Root cause found + fixed. Parse errors no longer trigger curl retry.

### Task C: `private.user_rental_secrets` Table Migration ✅
- [x] Migration + access module created. 4 functions: get, getByDocSha, save, revoke.

### Task H: Contract Template Page Breaks ✅
- [x] 4 page-break divs added before appendices.

### Task I: Missing Blank Fields for Handoff ✅
- [x] Odometer, fuel, tires, damage blanks added to Appendix 1.

### Task K: Admin Dashboard — Successful Rents ✅
- [x] "Успешные аренды" section added with 60s refresh.

---

### Task B: QR Code Alongside Rental Contract

> **Depends on**: Task A ✅, Task C ✅
> **Complexity**: M

- [ ] **Design QR URL format**: `rent_{bike_id}_{doc_sha256}`
- [ ] **Generate QR PNG** using local `qrcode` npm package
- [ ] **Send DOCX + QR in ONE Telegram message** (`sendMediaGroup`)
- [ ] **Update skill script** — after DOCX + SHA256, construct QR, send combined
- [ ] **Update web-app pipeline** — same QR + combined delivery
- [ ] Test: verify DOCX + QR arrive in one message

---

### Task D: Save Renter Data on Contract Generation

> **Depends on**: Task C ✅
> **Complexity**: M

- [ ] **Skill script**: insert into `private.user_rental_secrets` after DOCX generation
- [ ] **Web-app pipeline**: same insert logic after successful doc generation
- [ ] **Shared template version constant** (`CURRENT_RENTAL_TEMPLATE_VERSION = 1`)
- [ ] Non-blocking: save failures must NOT prevent doc delivery
- [ ] Future: design insert for batch imports

---

### Task E: QR Deep-Link Parsing & Data Auto-fill

> **Depends on**: Tasks B, D
> **Complexity**: L

- [ ] Parse `startParam` `rent_{bikeId}_{docSha}` (extend existing `rent_` handler)
- [ ] Authenticate via `useTelegramAuth` → `chat_id`
- [ ] Lookup `private.user_rental_secrets` by `doc_sha256` + `chat_id` + `verified`
- [ ] Pre-fill rental form, skip doc photographing step
- [ ] First-time renter: bike pre-selected, no auto-fill
- [ ] Error states: wrong user, doc revoked, bike gone, stale data

---

### Task F: "Previous Rental" Data Picker UI

> **Depends on**: Tasks C ✅, D

- [ ] Query `user_rental_secrets` for current user + crew, `verified`, `created_at DESC`
- [ ] Display: "Кавасаки EX650K — 15.05.2026" with "Использовать данные" button
- [ ] On selection: pre-fill rental form

---

### Task G: Franchise Profile Page Enhancement

> **Depends on**: Tasks C ✅, D

- [ ] Show saved rental data (masked), allow edit/clear
- [ ] "Quick Rent" button → new rental using saved data

---

### Task J: Web-App Duration & Time Picker

> **Independent**
> **Complexity**: M

- [ ] Add date/time picker for start+end (precise to hours)
- [ ] Keep preset buttons as shortcuts, not only options

---

### Task L: Hot-Stage QR Entry (Rent-in-Progress View)

> **Depends on**: Task E
> **Complexity**: M

- [ ] QR scan during active rental → open rental detail directly
- [ ] "Handoff mode" with damage photos, odometer, notes

---

### Task M: Fix Admin Dashboard Bugs

> **Independent**
> **Complexity**: S

- [ ] **Bug M1**: renter name fallback — add `users` table join + `metadata.recipientName` + `metadata.rentalStartDate`
- [ ] **Bug M2**: dates fallback — add `metadata.rentalStartDate` / `metadata.rentalEndDate` tertiary

---

## 🏆 Phase 3: VIP Club — Trust-Based Access Tiers

> **Core insight**: The bike `specs.license_class` field ALREADY EXISTS in the gold seed. No schema change needed. The tier is derived from existing data.

### 3.0 VIP Club — Concept

> Those who rented once become VIP. Trust is established after one successful rent. Docs verified manually once, saved to secrets. QR scan = ФЗ-152 consent + profile link. VIP members rent in their access tier with 1-click.

### 3.1 Bike Access Tiers (from existing `specs.license_class`)

The gold seed already has `license_class` on every bike. Here's the mapping:

| Bike | `license_class` | Power | Access Tier |
|------|----------------|-------|-------------|
| Falcon GT | М (49 сс), В или А1 | 17 kW | **Entry** |
| Falcon Pro | М (49 сс), В или А1 | 10 kW | **Entry** |
| Ducati Panigale S Electro | М (49 сс), В или М1 | 12 kW | **Entry** |
| HORWIN SK3 Plus | 125 сс (A1 / B) | 8.64 kW | **Mid** |
| Sequence Zero | А (электро 30 кВт, экв. 125 сс+) | 30 kW | **Pro** |
| Y-VOLT Surge V | А (электро 35 кВт, экв. 125 сс+) | 35 kW | **Pro** |
| Kawasaki EX650K | А / L3 (ICE 649 см³) | 50.2 kW | **Pro** |

**Tier definitions:**
- **Entry**: Category M/М1 — moped-class, no motorcycle license needed. Car license (B) sufficient or no license at all for electric under 4 kW nominal.
- **Mid**: Category A1/B — 125cc equivalent, limited power. Requires A1 or B-category license with motorcycle confirmation.
- **Pro**: Category A — full motorcycle license required. ICE or high-power electric (30+ kW).

**Trickling down**: VIP with Pro access can also rent Mid and Entry bikes. VIP with Mid access can rent Entry and Mid. VIP with Entry access can only rent Entry bikes.

- [ ] **Add `access_tier` derived field** to bike data:
  - [ ] Option A: compute at query time from `specs.license_class` (no migration)
  - [ ] Option B: add `specs.access_tier` field to gold seed ("entry" | "mid" | "pro")
  - [ ] Recommendation: **Option B** — explicit is better, `license_class` is human-readable Russian text, `access_tier` is machine-parseable
  - [ ] Update gold seed CSV: add `access_tier` to each bike's specs JSON

- [ ] **Extract access tier from `license_class`** (utility function):
  ```typescript
  function deriveAccessTier(licenseClass: string): "entry" | "mid" | "pro" {
    // "М (49 сс)" → "entry"
    // "125 сс (A1 / B)" → "mid"
    // "А (электро 30 кВт)" → "pro"
    // "А / L3" → "pro"
  }
  ```

### 3.2 VIP Status — Derived from User's Verified Docs

- [ ] **Determine user's access tier from their verified documents**:
  - [ ] No driver's license on file → **Entry only** (can rent Entry bikes — Falcon GT, Falcon Pro, Ducati Panigale S)
  - [ ] License category B/M confirmed → **Mid access** (Entry + Mid bikes — adds HORWIN SK3 Plus)
  - [ ] License category A confirmed → **Pro access** (all bikes — adds Sequence Zero, Y-VOLT Surge V, Kawasaki)
  - [ ] Query: look at `user_rental_secrets.renter_driver_license` field — does it contain category info? Or query `user_secrets.driver_license`

- [ ] **License category extraction from OCR**:
  - [ ] OCR of driver's license returns category fields (A, A1, B, B1, M, etc.)
  - [ ] Store extracted categories in `user_rental_secrets.renter_driver_license` or `user_secrets.sensitive_metadata`
  - [ ] Derive access tier from highest category: A > A1/B > M > none

- [ ] **Access tier check in rental flow**:
  - [ ] When user selects a bike, check if their access tier allows it
  - [ ] If not: "Для аренды этого мотоцикла необходимы права категории А. Ваши документы позволяют аренду до уровня Mid."
  - [ ] If yes: proceed with VIP 1-click flow or standard flow

- [ ] **ФЗ-152 digital consent** (on first QR scan):
  - [ ] Show consent screen in web app
  - [ ] Store consent timestamp in `user_rental_secrets.sensitive_metadata.consent_given_at`
  - [ ] User can revoke → data cleared from secrets

### 3.3 Streamlined VIP Re-Rental

- [ ] **VIP rental flow** (1-click for returning riders):
  - [ ] User sees bikes filtered by their access tier
  - [ ] Select bike → duration → submit (no doc photographing)
  - [ ] Contract auto-generated with saved data
  - [ ] Admin gets "VIP ✅" notification with pre-verified badge
  - [ ] Configurable: auto-confirm VIP rentals per crew

- [ ] **Bike catalog filtering**:
  - [ ] Filter available bikes by user's access tier
  - [ ] Show locked bikes with "Требуется категория А" label
  - [ ] Upgrade prompt: "Получите доступ — предоставьте водительское удостоверение категории А"

### 3.4 NFC Activation (Research Phase)

- [ ] **Investigate bike NFC hardware**: reader model, protocol, token format
- [ ] **Phone-as-key feasibility**: Web NFC API? Native app? Token generation?
- [ ] **Temporary NFC marks**: one-time tokens tied to rental + user, expire at rental end
- [ ] **Fallback**: admin generates physical NFC card mark

---

## 🔬 Phase 4: OCR Pipeline — `/doc` Command & Web-App OCR

> **Goal**: Users send passport/license photos to bot → OCR extracts data → contract generated. No more manual JSON files. OCR result also extracts license category, feeding directly into VIP tier system.

### 4.0 OCR Architecture Decision

- [ ] **Evaluate OCR approaches**:
  - [ ] **Option A: VLM-based** — send photo to GLM-4V / GPT-4V → structured JSON extraction
    - Pros: already using VLM for bike specs, handles Russian passports/licenses well
    - Cons: API latency, cost per call, not always deterministic
  - [ ] **Option B: Tesseract.js** — open-source OCR in Node.js
    - Pros: free, local, no API dependency
    - Cons: lower accuracy on Russian passports, needs trained models
  - [ ] **Option C: Hybrid** — Tesseract for text extraction + VLM for structured parsing
    - Pros: Tesseract handles layout, VLM handles semantics
    - Cons: two-pass complexity
  - [ ] **Recommendation**: **Option A first** (VLM) — simplest to implement, highest accuracy. Add Tesseract fallback later for cost optimization.

### 4.1 Telegram Bot `/doc` Command

> **New bot command**: `/doc` triggers the document generation flow directly in Telegram.

- [ ] **Register `/doc` command** in webhook handler:
  - [ ] Add to `app/webhook-handlers/commands/` (alongside existing `/start`)
  - [ ] Register command with BotFather for UI discovery

- [ ] **`/doc` command flow**:
  ```
  User: /doc
  Bot:  📄 Для создания договора аренды мне нужны:
        1️⃣ Фото паспорта (разворот с фото)
        2️⃣ Фото водительского удостоверения (если есть)

        Отправьте фото паспорта 👇

  User: [sends passport photo]
  Bot:  ✅ Паспорт получен. Отправьте фото водительского удостоверения или напишите "нет" 👇

  User: [sends license photo] or "нет"
  Bot:  ✅ Данные обработаны:
        👤 Иванов Иван Иванович
        🪪 Паспорт: 1234 567890
        🚗 ВУ: 99 76 543210 (кат. А, В)
        🏍️ Доступные мотоциклы: все категории

        Какой мотоцикл? Напишите название или выберите:
        [Inline keyboard with available bikes by tier]

  User: [selects bike or types name]
  Bot:  На какой срок?
        [Inline keyboard: 1 час / 3 часа / 1 день / 3 дня / неделя / Свой вариант]

  User: [selects duration or types custom]
  Bot:  ✅ Договор создан!
        [DOCX + QR in one message via sendMediaGroup]
  ```

- [ ] **State machine for `/doc` conversation**:
  - [ ] States: `idle` → `awaiting_passport` → `awaiting_license` → `confirming_data` → `selecting_bike` → `selecting_duration` → `generating_contract`
  - [ ] Store state in `users.metadata.doc_flow_state` (temporary, cleared after completion)
  - [ ] Timeout: 5 minutes of inactivity → reset state

- [ ] **Photo handling**:
  - [ ] Receive photo via Telegram `message.photo` (largest size)
  - [ ] Download to temp storage or pass URL to VLM
  - [ ] VLM extracts structured data → `passportJson` / `licenseJson` format
  - [ ] Validate extracted fields (non-empty name, valid series/number format)

### 4.2 OCR Service (Next.js API Route)

- [ ] **Create `/api/ocr` endpoint** — reusable by both bot and web app:
  ```typescript
  // POST /api/ocr
  // Body: { image: base64, type: "passport" | "license" }
  // Response: { passportJson } or { licenseJson }
  ```

- [ ] **VLM integration**:
  - [ ] Use `z-ai-web-dev-sdk` VLM capabilities (already available in project)
  - [ ] System prompt for passport extraction:
    ```
    Extract passport data from this Russian passport photo. Return JSON:
    { "fullName": "...", "birthDate": "DD.MM.YYYY", "series": "1234",
      "number": "567890", "issueDate": "DD.MM.YYYY", "registration": "..." }
    ```
  - [ ] System prompt for license extraction:
    ```
    Extract driver's license data from this Russian ВУ photo. Return JSON:
    { "series": "99 76", "number": "543210", "categories": ["A", "B", "M"],
      "issueDate": "DD.MM.YYYY", "expiryDate": "DD.MM.YYYY" }
    ```

- [ ] **License category extraction** — CRITICAL for VIP tier system:
  - [ ] Parse `categories` array from OCR result
  - [ ] Map to access tier: A → Pro, A1/B/M → Mid, none → Entry
  - [ ] Store in `user_rental_secrets` or `user_secrets.sensitive_metadata.license_categories`

- [ ] **Web-app OCR integration**:
  - [ ] Camera capture in checkout flow: "Сфотографируйте паспорт"
  - [ ] Upload to `/api/ocr` → extract data → pre-fill form
  - [ ] Fallback: manual entry if OCR fails or user prefers typing
  - [ ] Progressive disclosure: passport first, then license (license = tier upgrade)

### 4.3 OCR Result → VIP Tier Auto-Upgrade

- [ ] **On successful OCR + verification**:
  - [ ] Extract license categories from OCR
  - [ ] Derive access tier: `A → "pro"`, `A1/B/M → "mid"`, `no license → "entry"`
  - [ ] Store tier in `user_rental_secrets.sensitive_metadata.access_tier`
  - [ ] Or compute dynamically from stored license categories at rental time

- [ ] **No OCR result → Entry tier only**:
  - [ ] User who didn't provide license can only rent Entry bikes
  - [ ] This is the "cold start" path — safe default, no license check needed
  - [ ] Upgrade available at any time: "Улучшите доступ — предоставьте ВУ"

### 4.4 OCR Quality & Fallbacks

- [ ] **Validation**: check OCR output for common errors
  - [ ] Russian passport: series is 4 digits, number is 6 digits
  - [ ] License: series is 2+2 digits, number is 6 digits
  - [ ] Birth date format: DD.MM.YYYY
  - [ ] Category format: A, A1, B, B1, M, etc.

- [ ] **Human verification**: admin can review + correct OCR results
  - [ ] Admin dashboard: "Проверка документов" section
  - [ ] Show OCR result + original photo side-by-side
  - [ ] Confirm or edit before saving to secrets

- [ ] **OCR caching**: don't re-OCR same photo if user resends
  - [ ] Hash photo bytes → cache OCR result
  - [ ] Useful for retry scenarios

---

## 📊 Full Roadmap — Execution Order

```
Phase 2 (core — in progress):
  Run 3:  Task D (save renter data) + Task M (admin bugs)     ← Codex cooking now
  Run 4:  Task B (QR alongside contract)
  Run 5:  Task E (deep-link auto-fill) + Task J (time picker)
  Run 6:  Task F (previous rental picker) + Task L (hot-stage QR)
  Run 7:  Task G (profile page enhancement)

Phase 3 (VIP Club — can start after D lands):
  Run 8:  3.1 (access tiers in gold seed + utility function)
  Run 9:  3.2 (VIP tier derivation from license + ФЗ-152 consent)
  Run 10: 3.3 (streamlined VIP re-rental + bike catalog filtering)

Phase 4 (OCR — can start in parallel with Phase 3):
  Run 11: 4.1 (Telegram /doc command + conversation state)
  Run 12: 4.2 (OCR API endpoint + VLM integration)
  Run 13: 4.3 (OCR → VIP tier auto-upgrade)
  Run 14: 4.4 (OCR quality + admin verification UI)

Phase 5 (future):
  3.4 NFC activation research
  Digitize old docs batch import
  Price override from natural language prompt
  Multi-franchise expansion
```

---

## 📊 Task Dependency Graph

```
Phase 2:
  A ✅ → B (QR) → E (deep-link) → L (hot-stage)
  C ✅ → D (save data) → F (picker), G (profile)
  Independent: H ✅, I ✅, J, K ✅, M

Phase 3 (builds on Phase 2):
  D → 3.1 (tiers from gold seed) → 3.3 (VIP rental flow)
  D → 3.2 (tier from license) → 3.3

Phase 4 (builds on Phase 2 + 3):
  D → 4.1 (/doc command)
  4.2 (OCR API) → 4.3 (OCR → tier upgrade)
  4.1 → 4.2 (bot needs OCR to process photos)
  3.2 → 4.3 (tier system must exist for auto-upgrade)
```

---

## ⚠️ Constraints

- **No breaking changes**: Existing deep-links must continue to work.
- **Private schema for secrets**: Sensitive renter data MUST live in `private.*` tables.
- **Metadata principle**: `users.metadata` stores raw signals only, never derived state.
- **Crew isolation**: Scoped per franchise (`crew_slug`).
- **Privacy**: Paper consent (Appendix 4) for initial rental. ФЗ-152 digital consent for data re-use (Phase 3+).
- **Bike IDs are slugs**: `cars.id` is human-readable, NOT a UUID.
- **`specs.license_class` is already in gold seed**: Tier derivation needs NO new bike schema columns, just an `access_tier` computed/parsed field.
- **No multi-bike support**: 1 bike = 1 doc = 1 contract.
- **Russian language**: All user-facing text in Russian.
- **Supabase-first**: Use Supabase client, not raw SQL.

---

## 🏭 Production Feedback (May 30, 2026)

| # | Issue | Status | Task |
|---|-------|--------|------|
| LAYOUT-1 | No page breaks | **Fixed** ✅ | Task H |
| PRICE-1 | Price override from prompt | **Deferred** | — |
| DATA-1 | Kawasaki price wrong | **Fixed** ✅ | Done |
| DATA-2 | Missing handoff blanks | **Fixed** ✅ | Task I |
| BUG | Duplicate DOCX | **Fixed** ✅ | Task A |
| BUG-M1 | Admin renter name shows user_id | **Open** | Task M |
| BUG-M2 | Admin dates show "—" | **Open** | Task M |

---

## 🧭 Navigation Hints

**Key files:**
- `scripts/make-rental-contract-skill.mjs` — Skill script
- `lib/docx-capability.ts` — Web-app doc builder
- `app/lib/user-rental-secrets.ts` — Rental secrets access module
- `app/franchize/actions-runtime.ts` — Server actions + admin queries
- `app/franchize/components/FranchizeAdminClient.tsx` — Admin dashboard
- `docs/RENTAL_DEAL_TEMPLATE.html` — Contract template
- `supabase/migrations/20260601000000_user_rental_secrets.sql` — Rental secrets migration
- `download/cars_rows_7bikes_golden.csv` — Gold bike seed (has `specs.license_class`)

**Key search terms:**
- `private.user_rental_secrets` / `getUserRentalSecrets` — rental secrets
- `license_class` / `access_tier` — bike tier data (in specs JSON)
- `startapp` / `rent_` — deep-link handling
- `contract_verifier` / `originalSha256` — document verification
- `sendMediaGroup` — combined DOCX + QR delivery
