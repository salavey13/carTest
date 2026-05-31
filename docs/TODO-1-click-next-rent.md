# 1-Click Next Rent — Project TODO

> Living document for VIP Bike Rental franchise integration.
> Each section has inline `[ ]` checkboxes. Check them off as you complete work.
> **Structure rule**: progress is tracked inline via checkboxes — do NOT append results to end of file. This avoids merge conflicts when multiple agents work on different sections.

---

## 🔍 Phase 1: Investigation ✅

> All investigations complete. Findings documented inline.

### 1.1 Rental Contract Generation Pipeline ✅
- [x] **Skill script** — full flow traced. Findings: `--phrase` → fuzzy bike match, `--passportJson`/`--licenseJson` for OCR data, mustache `{{key}}` replacement, `sha256(buf)` from DOCX bytes, `rental_contract_artifacts` metadata save, Telegram `sendDocument` delivery. Duplicate bug root cause found + fixed (Task A).
- [x] **Web-app pipeline** — `buildFranchizeOrderDocAndNotify()` → `buildFranchizeDocxFromTemplate()` → `htmlToDocxDocument()` → `registerVerifierOriginalForBuffer()`. SHA256 chain: `doc_verifier_records.original_sha256` = `rentals.metadata.contract_verifier.originalSha256`.
- [x] **Template** — HTML mode (`RENTAL_DOC_TEMPLATE_MODE=html`) is high-fidelity path. MD fallback exists. `renter_address` placeholder missing from templates. Page-break divs now added (Task H).

### 1.2 Existing Secret Tables & Access Patterns ✅
- [x] **`private.crew_secrets`** — `crew_slug TEXT PK`, `contract_defaults TEXT`, `doc_templates TEXT`, `price_lists TEXT`, `sensitive_metadata JSONB`. Access via `getCrewSensitiveDataOrDefault(slug)` / `saveCrewSensitiveData(slug, data)`.
- [x] **`private.user_secrets`** — `user_id TEXT PK`, `driver_license TEXT`, `passport TEXT`, `sensitive_metadata JSONB`. Return shape only `{ driverLicense, passport }` — no birth/phone/email yet.
- [x] **`private` schema pattern** — REVOKE all from anon/authenticated, GRANT to service_role only. Server-only access via `supabaseAdmin.schema("private")`.

### 1.3 Deep-Link & Telegram Mini App Flow ✅
- [x] **Current pattern**: `startapp=rental-${rentalId}` → `useTelegramAuth` → `useStartParamRouter()`.
- [x] **`rent_` prefix** already routes to `/api/startapp/vehicle?flow=rent`. New `rent_{bikeId}_{docSha}` won't collide with `rental-{id}` but must extend existing `rent_` handler for 3-part format.

### 1.4 Franchise Profile & User Data Pre-set ✅
- [x] Profile page at `app/franchize/[slug]/profile/page.tsx`. Prefill stores in `users.metadata.franchizeFormPrefill[slug]`. No passport/license editing on profile. Sensitive data lives in `private.user_secrets`.

### 1.5 QR Code — Current State ✅
- [x] Mostly remote-image based (`api.qrserver.com`). Network-dependent. Local `qrcode` npm package recommended for Task B.

### 1.6 Document Verification & SHA256 Chain ✅
- [x] Web-app and skill paths compute SHA256 independently. Skill stores in `rental_contract_artifacts`, web-app stores in `doc_verifier_records` + rental metadata. QR should encode `rental_contract_artifacts.original_sha256` for skill flow.

### 1.7 Full Rental Lifecycle & Handoff Steps ✅
- [x] State machine: `checkout_started` → `pending_confirmation` → `confirmed` → `active` → completed/closed. Handoff photos partially implemented (bot assigns before/after based on rent state). Paper fields now added (Task I). Hot-stage QR needs to navigate to rental detail directly.

### 1.8 Web-App Rental Order Flow ✅
- [x] Checkout asks: name, phone, time text, start date, auto-computed end date, signature, comment, payment, delivery, extras, promo, consent, safety quiz. No time-of-day picker. No passport/license/birth date in form — relies on `private.user_secrets` or auto-fill.

### 1.9 Admin Dashboard — Current State ✅
- [x] `FranchizeAdminClient.tsx` loads fleet, failed orders, retry, review moderation, vehicle editing. Successful rentals section added (Task K).

---

## 🏗️ Phase 2: Design & Implementation Tasks

> Each task is self-contained with its own checkboxes.

---

### Task A: Fix Duplicate DOCX Delivery Bug ✅

- [x] Find root cause of duplicate `sendDocument` call in skill script
- [x] Fix: ensure DOCX is sent exactly once (parse errors no longer trigger curl retry)
- [x] Verify fix doesn't break existing delivery

---

### Task B: QR Code Alongside Rental Contract

> **Prerequisite**: Task A ✅, Task C ✅
> **Complexity**: M
> **Depends on**: Task A ✅, Task C ✅

- [ ] **Design QR URL format**:
  ```
  https://t.me/oneBikePlsBot/app?startapp=rent_{bike_id}_{doc_sha256}
  ```
  - `bike_id` = `cars.id` (human-readable slug like `kawasaki-ex650k`, NOT a UUID)
  - `doc_sha256` = SHA256 hex from `rental_contract_artifacts.original_sha256`

- [ ] **Generate QR PNG** using local `qrcode` npm package (safer than remote API)
  - [ ] Add `qrcode` to package.json
  - [ ] Output PNG buffer for Telegram sending

- [ ] **Send DOCX + QR in ONE Telegram message**
  - [ ] Use `sendMediaGroup` to combine document + photo
  - [ ] DO NOT send as separate messages
  - [ ] Include deep-link URL as text caption below QR image

- [ ] **Update skill script** (`make-rental-contract-skill.mjs`):
  - [ ] After DOCX generation + SHA256 computation, construct QR URL
  - [ ] Generate QR PNG, send combined message

- [ ] **Update web-app pipeline** (`buildFranchizeOrderDocAndNotify`):
  - [ ] Same QR generation + combined delivery logic

- [ ] Test: verify DOCX + QR arrive in one message, no duplicates

---

### Task C: `private.user_rental_secrets` Table Migration ✅

- [x] **Create migration file**: `supabase/migrations/20260601000000_user_rental_secrets.sql`
- [x] **Schema** with all required fields, indexes, UNIQUE constraint
- [x] **Follow `private` schema pattern** — REVOKE/GRANT on schema + table
- [x] **Server-side access module**: `app/lib/user-rental-secrets.ts`
  - [x] `getUserRentalSecrets(chatId, crewSlug)` — most recent verified row
  - [x] `getUserRentalSecretsByDocSha(docSha256)` — lookup by doc hash
  - [x] `saveUserRentalSecrets(data)` — insert new row
  - [x] `revokeUserRentalSecrets(docSha256)` — set status = 'revoked'
  - [x] All reads through `supabaseAdmin.schema("private")`
- [x] **Design decisions**: coexist with `private.user_secrets` (different lifecycle/purpose)
- [x] **Privacy**: Paper consent (Appendix 4) sufficient
- [x] **No data versioning column**: multiple rows per user, `created_at DESC` ordering
- [x] **`template_version` field**: for re-sign detection on template changes
- [x] **Future preparation**: schema supports batch imports

---

### Task D: Save Renter Data on Contract Generation

> **Prerequisite**: Task C ✅
> **Complexity**: M
> **Depends on**: Task C ✅

- [ ] **Skill script** (`make-rental-contract-skill.mjs`):
  - [ ] After successful DOCX generation + SHA256, insert row into `private.user_rental_secrets`
  - [ ] Extract renter fields from the same data used to fill template variables
  - [ ] Set `verification_status = 'verified'` (doc was just generated and sent)
  - [ ] Set `template_version` from current template version constant

- [ ] **Web-app pipeline** (`buildFranchizeOrderDocAndNotify`):
  - [ ] Same insert logic after successful doc generation
  - [ ] Read renter data from `userSensitive` + payload fields

- [ ] **Future preparation**: design insert to work for batch imports (digitize old docs workflow)

---

### Task E: QR Deep-Link Parsing & Data Auto-fill

> **Prerequisite**: Task B, Task C ✅, Task D
> **Complexity**: L
> **Depends on**: Tasks B, D

- [ ] **Parse `startParam`**: Detect `rent_` prefix, extract `bikeId` and `docSha`
  - [ ] Must NOT break existing `rental-{id}` parsing
  - [ ] Extend existing `rent_` handler for 3-part format `rent_{bikeId}_{docSha}` vs 2-part `rent_{bikeId}`

- [ ] **Authenticate**: Use `useTelegramAuth` → get `chat_id` from `initData`

- [ ] **Lookup renter data**: Query `private.user_rental_secrets` by `doc_sha256` + `chat_id` + `verification_status = 'verified'`

- [ ] **Pre-fill rental form**: Auto-populate renter fields, skip "photograph documents" step

- [ ] **Allow edit**: User can modify any pre-filled field before submission

- [ ] **First-time renter flow** (no matching data):
  - [ ] Open rental page with bike pre-selected (using `bikeId` from QR)
  - [ ] No auto-fill — standard rental flow

- [ ] **QR expiration**: expire on doc revocation, keep alive for repeated use otherwise

- [ ] **Error states** (implement all):
  | Scenario | Behavior |
  |----------|----------|
  | QR scanned by different user | Open rental with bike pre-selected, no auto-fill |
  | Doc revoked | Error: "Документ аннулирован" → manual rental |
  | Bike no longer in fleet | Error: "Мотоцикл не доступен" → suggest alternatives |
  | Stale data (old rental) | Show with date context: "Данные от DD.MM.YYYY" |
  | Multiple rentals for same user | Show picker (Task F) |
  | No rental history | Standard rental flow |

---

### Task F: "Previous Rental" Data Picker UI

> **Prerequisite**: Task C ✅, Task D
> **Complexity**: M
> **Depends on**: Tasks C ✅, D

- [ ] **Query**: `private.user_rental_secrets` where `chat_id = current_user` AND `crew_slug = current_franchise` AND `verification_status = 'verified'`
- [ ] **Sort**: `created_at DESC` (most recent first)
- [ ] **Display**: list of previous rentals — "Кавасаки EX650K — 15.05.2026" with "Использовать данные" button
- [ ] **On selection**: pre-fill rental creation form
- [ ] **Design decisions**:
  - [ ] Where in UI? (profile page section? modal in rental flow? both?)
  - [ ] Data staleness: show date of last rental as context

---

### Task G: Franchise Profile Page Enhancement

> **Prerequisite**: Task C ✅, Task D
> **Complexity**: M
> **Depends on**: Tasks C ✅, D

- [ ] Show user's saved rental data (masked: "Паспорт: **** 4512")
- [ ] Allow editing/clearing saved data
- [ ] Show linked rental documents
- [ ] Provide "Quick Rent" button → initiate new rental using saved data

---

### Task H: Contract Template Page Breaks ✅

- [x] Add `<div style="page-break-before: always">` to HTML template before each Appendix
- [x] Verified: 4 `w:br w:type="page"` markers in generated DOCX XML

---

### Task I: Missing Blank Fields for Handoff ✅

- [x] Added: odometer, fuel level, tire condition, delivery damage blanks to Appendix 1
- [x] Updated both HTML and MD templates

---

### Task J: Web-App Duration & Time Picker

> **Complexity**: M
> **Depends on**: nothing (independent)

- [ ] Add date/time picker for start and end date+time (precise to hours)
- [ ] Keep quick preset buttons ("1 день", "3 дня", "неделя") as shortcuts
- [ ] Presets pre-fill the picker, not the only options
- [ ] Aligns web-app with skill pipeline's arbitrary time range support

---

### Task K: Admin Dashboard — Successful Rents Display ✅

- [x] Find existing admin dashboard component — **Found** in Phase 1
- [x] Added "Успешные аренды" section with bike, renter, dates, contract status
- [x] 60-second auto-refresh
- [x] Wired through `getFranchizeSuccessfulRentals` action

---

### Task L: Hot-Stage QR Entry (Rent-in-Progress View)

> **Prerequisite**: Task E
> **Complexity**: M
> **Depends on**: Task E

> **Context**: Handoff photos partially implemented (bot assigns before/after). Need way to enter "hot stage" web view directly via QR.

- [ ] QR scan during active rental → open rental detail page directly
- [ ] Show "handoff mode" — add damage photos, odometer, notes
- [ ] No re-navigation required
- [ ] `FranchizeRentalDocumentsPanel` already has `saveRentalPickupFreeze` and `addRentalDamageReport`

---

### Task M: Fix Admin Dashboard Bugs (from Run 2 Code Review)

> **Complexity**: S
> **Depends on**: nothing (bug fixes in existing code)

- [ ] **Bug 1 — renter name fallback**: `metadata.renter_full_name` is null for web-app rentals → add fallback to `metadata.recipientName` + join `users` table for actual name
  - Current code: `metadata.renter_full_name` → `metadata.recipientName` → `metadata.customerName` → `row.user_id`
  - Fix: also try `users.display_name` or `users.metadata.franchizeFormPrefill[slug].fullName` via user_id join

- [ ] **Bug 2 — missing date fallback**: `agreed_start_date` / `requested_start_date` are null for payment-webhook rentals → add fallback to `metadata.rentalStartDate` / `metadata.rentalEndDate`
  - Current code: `agreed_start_date` → `requested_start_date` → null
  - Fix: `agreed_start_date` → `requested_start_date` → `metadata.rentalStartDate` → null

---

## 🏆 Phase 3: VIP Club — Trust-Based Access Tiers

> **Vision**: Once a renter completes a verified rental, they become a VIP Club member. Their docs are verified, their data is saved, and they can rent bikes in their access tier without re-photographing documents. The QR code is the gateway — scan once, agree to ФЗ-152 data storage, link web-app account to verified identity, and all future rentals are streamlined.

### 3.0 VIP Club — Concept & Lore

> **Why "VIP Bike"?** — Those who rented once become part of the VIP Club. Trust is established after one successful rent. Docs are verified manually once and saved to secrets. By scanning QR code, the user agrees to ФЗ-152 (Federal Law on Personal Data) storage, links their web-app profile, and all future rents in their access tier are 1-click.

**The core loop:**
1. First rent → docs photographed + verified manually → contract signed → QR on contract
2. User scans QR → agrees to ФЗ-152 → profile linked → VIP status unlocked
3. Next rent → select bike in access tier → notification to admin with doc ready → confirm → ride
4. Future: NFC activation via phone (bike started by card with NFC today, phone-as-key tomorrow)

### 3.1 Bike Access Tiers

> **Concept**: Bikes require different levels of documentation/qualification. Tier determines what docs are needed and what VIP members can access.

- [ ] **Design access tier system** for bikes:
  - [ ] **Entry** — e-bikes, scooters, low-power (no driver's license required, basic ID only)
  - [ ] **Mid** — mid-size motorcycles (category A1/A license required, full passport + license)
  - [ ] **Pro** — high-power motorcycles (category A license + experience verification)
  - [ ] Tier stored where? `cars.metadata.access_tier` or `cars.specs.access_tier`?

- [ ] **Tier determination logic**:
  - [ ] What fields on `cars` determine tier? (type, engine displacement, power, category)
  - [ ] Can tiers be configured per crew? (crew A classifies differently than crew B)
  - [ ] Should tiers be hardcoded or configurable in `crew_secrets.price_lists`?

- [ ] **VIP access check**: when VIP member scans QR or opens rental:
  - [ ] What tier(s) is this user verified for?
  - [ ] Based on: verified doc types in `user_rental_secrets` + driver's license category
  - [ ] Entry-tier VIP: passport verified → can rent entry-level
  - [ ] Mid-tier VIP: passport + license (A1/A) verified → can rent entry + mid
  - [ ] Pro-tier VIP: passport + license (A) + experience confirmed → can rent all

### 3.2 VIP Status & Trust Level

- [ ] **Design VIP status mechanism**:
  - [ ] Option A: derived status — query `user_rental_secrets` for verified rows to determine tier (no new column needed)
  - [ ] Option B: explicit `vip_tier` column on `users.metadata` or new `user_vip_status` table
  - [ ] Recommendation: **Option A first** — derive from existing data, add explicit column only if query performance requires it

- [ ] **Trust establishment flow**:
  - [ ] First rent: docs photographed via OCR, verified by admin manually
  - [ ] Admin confirms verification → `user_rental_secrets.verification_status = 'verified'`
  - [ ] User scans QR on paper contract → ФЗ-152 consent → profile linked
  - [ ] VIP unlocked: next rentals skip doc photographing step

- [ ] **ФЗ-152 digital consent** (via QR scan):
  - [ ] When user scans QR for first time, show consent screen
  - [ ] "Вы соглашаетесь с обработкой персональных данных в соответствии с ФЗ-152"
  - [ ] Paper consent (Appendix 4) covers the original rental; this covers digital storage for re-use
  - [ ] Store consent timestamp in `user_rental_secrets` or separate `user_consent_records`
  - [ ] User can revoke → data deleted from `user_rental_secrets`

### 3.3 Streamlined Re-Rental for VIP Members

- [ ] **VIP rental flow** (1-click for returning riders):
  - [ ] User opens web app → sees bikes available in their tier
  - [ ] Selects bike → duration → submit
  - [ ] No doc photographing needed — data pre-filled from `user_rental_secrets`
  - [ ] Contract auto-generated with saved data → sent to admin for confirmation
  - [ ] Admin gets notification: "VIP-аренда: [Name] → [Bike] — данные проверены"
  - [ ] Admin confirms → rental active → user gets bike

- [ ] **Admin notification enhancement**:
  - [ ] Distinguish VIP rentals from first-time rentals in admin dashboard
  - [ ] Show "VIP ✅" badge vs "Новый клиент 🆕" badge
  - [ ] VIP rentals can be auto-confirmed (configurable per crew)

### 3.4 NFC Activation (Future / Research)

> **Context**: Bikes are currently started by NFC card. VIP members could use their phone as key.

- [ ] **Research NFC capabilities**:
  - [ ] What NFC hardware is on the bikes? (reader model, protocol)
  - [ ] Can phone NFC emulate the same card? (Web NFC API? Native Android/iOS?)
  - [ ] Temporary NFC marks — can the system generate one-time NFC tokens?
  - [ ] Security: NFC token tied to rental + user, expires at rental end

- [ ] **Phone-as-key design** (speculative):
  - [ ] Rental confirmed → generate NFC token → send to user's phone via Telegram mini-app
  - [ ] User taps phone on bike → bike starts
  - [ ] Token expires at rental end → bike won't start for expired rentals
  - [ ] Fallback: admin can generate temporary NFC card mark

- [ ] **Investigate existing NFC system**:
  - [ ] Find NFC hardware integration code in repo
  - [ ] What API/protocol does it use?
  - [ ] Is there a management interface for NFC tokens?

---

## 📊 Task Dependency Graph

```
Phase 2 (core infrastructure):
  Task A ✅ ──→ Task B (QR alongside doc) ──→ Task E (deep-link auto-fill) ──→ Task L (hot-stage entry)
  Task C ✅ ──→ Task D (save renter data) ──┤
                                             ├──→ Task F (previous rental picker)
                                             └──→ Task G (profile page enhancement)

  Independent: Task H ✅, Task I ✅, Task J (time picker), Task K ✅, Task M (bug fixes)

Phase 3 (VIP Club — builds on Phase 2):
  Task D ──→ 3.1 (bike access tiers) ──→ 3.3 (streamlined re-rental)
  Task D ──→ 3.2 (VIP status/trust)  ──→ 3.3 (streamlined re-rental)
  Task E ──→ 3.2 (ФЗ-152 consent via QR)
  3.4 (NFC) — independent research track
```

**Current execution order**: D + M → B → E → F → G → L → then Phase 3

---

## ⚠️ Constraints

- **No breaking changes**: Existing `rental-{id}` deep-links must continue to work. New `rent_{bikeId}_{docSha}` must not collide.
- **Private schema for secrets**: Sensitive renter data MUST live in `private.*` tables, never `public.*`.
- **Metadata principle**: `users.metadata` stores raw signals only. Derived state goes in secret table, not metadata.
- **Crew isolation**: Scoped per franchise (`crew_slug`). Do NOT design cross-franchise data sharing.
- **Privacy**: Paper contract consent (Appendix 4) covers initial data storage. ФЗ-152 digital consent needed for re-use of data across rentals (Phase 3).
- **Bike IDs are slugs**: `cars.id` is human-readable (`kawasaki-ex650k`), NOT a UUID.
- **No multi-bike support**: 1 bike = 1 doc = 1 contract.
- **Russian language**: All user-facing text in Russian. Code/comments can be English.
- **Supabase-first**: Use Supabase client (service role for `private.*` access), not raw SQL from app code.

---

## 🏭 Production Feedback (May 30, 2026)

Client triggered: `@Codex сделай договор аренды мотоцикла на кавасаки на этого клиента. Дата 30.05.26 время с 20.00 до 23.00 сумма 6000р`

Contract was **printed and signed IRL** ✅

### Known Issues

| # | Issue | Status | Task |
|---|-------|--------|------|
| LAYOUT-1 | No page breaks — doc prints "сплошняком" | **Fixed** ✅ | Task H |
| PRICE-1 | Explicit price in prompt ignored | **Deferred** — seed data fixed instead | Not in scope |
| DATA-1 | Kawasaki daily price wrong | **Fixed** ✅ (dailyPrice=16000, price_per_hour=2000) | Done |
| DATA-2 | Missing blank handoff fields | **Fixed** ✅ | Task I |
| BUG | Duplicate DOCX delivery | **Fixed** ✅ | Task A |
| BUG-M1 | Admin renter name shows user_id for web-app rentals | **Open** — fallback chain misses `metadata.recipientName` + user join | Task M |
| BUG-M2 | Admin dates show "—" for payment-webhook rentals | **Open** — missing `metadata.rentalStartDate` fallback | Task M |

---

## 🧭 Navigation Hints

**Key files:**
- `scripts/make-rental-contract-skill.mjs` — Skill script (Codex/Slack trigger)
- `lib/docx-capability.ts` — Web-app doc builder
- `lib/htmlToDocx.mjs` and `lib/htmlToDocx.ts` — HTML→DOCX conversion
- `docs/RENTAL_DEAL_TEMPLATE.html` — Contract template with all `{{variables}}`
- `app/franchize/actions-runtime.ts` — Main server actions (including `getFranchizeSuccessfulRentals`)
- `app/franchize/components/FranchizeAdminClient.tsx` — Admin dashboard (includes "Успешные аренды")
- `app/lib/user-rental-secrets.ts` — Rental secrets access module
- `supabase/migrations/20260601000000_user_rental_secrets.sql` — Rental secrets table migration
- `useTelegramAuth.ts` — Telegram auth hook with `startParam`
- `app/franchize/[slug]/admin/page.tsx` — Admin page
- `app/franchize/[slug]/profile/page.tsx` — User profile

**Key search terms:**
- `private.crew_secrets` / `private.user_secrets` / `private.user_rental_secrets` — secret tables
- `getUserSensitiveDataOrDefault` / `getUserRentalSecrets` — secret access functions
- `startapp` / `startParam` / `start_param` — deep-link handling
- `contract_verifier` / `originalSha256` / `doc_verifier` — document verification
- `rental_contract_artifacts` — contract metadata table
- `franchize` / `franchise` — franchise-related code (both spellings exist!)
- `sendMediaGroup` / `sendDocument` — Telegram bot API delivery methods
