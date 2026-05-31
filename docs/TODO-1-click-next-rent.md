# 1-Click Next Rent — Project TODO

> Living document for VIP Bike Rental franchise integration.
> Each section has inline `[ ]` checkboxes. Check them off as you complete work.
> **Structure rule**: progress is tracked inline via checkboxes — do NOT append results to end of file. This avoids merge conflicts when multiple agents work on different sections.

---

## 🔍 Phase 1: Investigation

> Complete these investigations BEFORE designing anything. Read actual source files, trace call chains, document findings inline under each item.

### 1.1 Rental Contract Generation Pipeline

- [ ] **Skill script** (`scripts/make-rental-contract-skill.mjs`): Trace full flow from trigger to delivered DOCX
  - [ ] How does it parse bike identification? (`--phrase`, `--bikeId`, fuzzy matching against `cars` table)
  - [ ] How does it receive renter data? (`--passportJson`, `--licenseJson` from OCR)
  - [ ] How does it fill template variables? (~40 `{{mustache}}` placeholders)
  - [ ] How does it compute `original_sha256`? (from DOCX buffer bytes)
  - [ ] How does it save metadata? (`--saveMetadata 1` → `rental_contract_artifacts` table)
  - [ ] How does it deliver the doc? (Telegram Bot API `sendDocument`)
  - [ ] **Bug: duplicate DOCX** — trace the delivery code path, find where the same doc is sent twice
  - Findings: _document here_

- [ ] **Web-app pipeline** (`lib/docx-capability.ts` → `buildFranchizeDocxFromTemplate()`)
  - [ ] How is it called? (from `buildFranchizeOrderDocAndNotify()` in `actions-runtime.ts`)
  - [ ] What's the `integrationScope` / `documentKey` pattern?
  - [ ] How is `doc_verifier_records` populated? (via `registerVerifierOriginalForBuffer`)
  - [ ] How is the SHA256 stored in rental's metadata? (`rentals.metadata.contract_verifier` JSONB)
  - Findings: _document here_

- [ ] **Template** (`docs/RENTAL_DEAL_TEMPLATE.html` and `.md`)
  - [ ] What variables exist? (focus on renter fields: `renter_full_name`, `renter_passport`, `renter_driver_license`, `renter_birth_date`, `renter_phone`, `renter_address`)
  - [ ] What's the template mode switch? (`RENTAL_DOC_TEMPLATE_MODE` env var → `html` vs `md`)
  - Findings: _document here_

### 1.2 Existing Secret Tables & Access Patterns

- [ ] **`private.crew_secrets`** table:
  - [ ] Document exact schema: `crew_slug (TEXT PK)`, `contract_defaults (JSONB)`, `updated_at (TIMESTAMPTZ)`
  - [ ] Read by: `getCrewSensitiveDataOrDefault(slug, context)` from `@/app/lib/private-secrets`
  - [ ] Written by: `saveCrewSensitiveData(slug, data)` from same module
  - Findings: _document here_

- [ ] **User secrets** (module exists but table schema not in repo):
  - [ ] **FIND the actual table**: search for `user_secrets` or similar in migrations, SQL files, or `private-secrets` module
  - [ ] Document `getUserSensitiveDataOrDefault(telegramUserId, context)` return shape: `{ driverLicense, passport, renterBirthDate?, renterPhone?, renterEmail? }`
  - Findings: _document here_

- [ ] **`private` schema pattern**: PostgREST only exposes `public` schema. Data in `private.*` is inaccessible via anon/auth REST keys — implicit access control. Document how this is used.
  - Findings: _document here_

### 1.3 Deep-Link & Telegram Mini App Flow

- [ ] **Current deep-link pattern**: `https://t.me/oneBikePlsBot/app?startapp=rental-${rentalId}`
  - [ ] Found in: `actions-runtime.ts` → `getFranchizeRentalCard()`
  - [ ] Parsed by: `useTelegramAuth.ts` → reads `startParam`
  - [ ] Routed by: router inside `ClientLayout.tsx` that maps `rental-*` prefix to rental detail page
  - [ ] **Design question**: can `startapp` be extended to `rent_{bikeId}_{docSha}` without breaking existing `rental-{id}` parsing?
  - Findings: _document here_

- [ ] **Telegram auth hook**: `useTelegramAuth.ts` → `initData`, `initDataUnsafe.start_param`, validation via `/api/validate-telegram-auth`, upsert via `upsertTelegramUserAction`
  - Findings: _document here_

### 1.4 Franchise Profile & User Data Pre-set

- [ ] **Franchise profile route**: `/franchize/{slug}/profile`
  - [ ] **FIND the actual page component** — it's not in the current workspace but must exist in the repo
  - [ ] What data can users currently preset/save?
  - [ ] How is sensitive user data (passport, license) currently saved?
  - Findings: _document here_

- [ ] **User metadata JSONB** (`users.metadata`):
  - Current keys: `settings`, `cyberFitness`, `survey_results`, `behavior_signals`, `experience_lock`, `franchizeProfiles`, `franchizeNotificationPreferences`, `onboarding_context`
  - Design principle: **metadata stores RAW SIGNALS ONLY, never derived state**

### 1.5 QR Code — Current State

- [ ] **QR generation code exists** in the repo — find the web method that creates QR codes
  - [ ] What library does it use?
  - [ ] How does it render QR images?
  - [ ] Can it output PNG buffer for Telegram sending?
  - Findings: _document here_

### 1.6 Document Verification & SHA256 Chain

- [ ] Trace the SHA256 chain across tables:
  - [ ] `doc_verifier_records.original_sha256`
  - [ ] `rental_contract_artifacts.original_sha256`
  - [ ] `rentals.metadata.contract_verifier.originalSha256`
  - [ ] Are they always the same value? Which one should the QR link encode?
  - Findings: _document here_

### 1.7 Full Rental Lifecycle & Handoff Steps

> **Critical for understanding where "1-click" actually fits.** The rental flow is NOT a single step.

- [ ] **Contract generation** — what we have now: bike + renter data → DOCX + QR
- [ ] **Handoff** — when renter picks up the bike:
  - [ ] Photos of preexisting damage — **partially implemented**: sending photo to Telegram bot auto-assigns it as "before" or "after" depending on active rent state
  - [ ] Odometer reading — currently manual on paper
  - [ ] Fuel level — currently manual on paper
  - [ ] Condition notes — currently manual on paper
  - **Key insight**: the "hot stage" (rent in progress) needs a way to enter the web app WITHOUT requiring user to re-click/navigate. QR scan should open the rent-in-progress view directly.
  - Findings: _document here_

- [ ] **Return** — when renter brings bike back:
  - [ ] Final odometer, damage check, fuel level
  - Findings: _document here_

- [ ] What states does a rental go through in the web app? Document the full state machine.
  - Findings: _document here_

### 1.8 Web-App Rental Order Flow

- [ ] What fields does the renter currently fill in during checkout?
- [ ] What are the duration options? (likely 1/3/7 day presets currently)
- [ ] Is there a date/time picker or only preset durations?
- [ ] How does the web-app pipeline differ from the skill pipeline in data completeness?
- [ ] **Known gap**: web-app order flow doesn't cover 100% of data needed for the contract (some fields like birth date missing from form). Skill pipeline fills these from OCR. How to bridge this gap?
  - Findings: _document here_

### 1.9 Admin Dashboard — Current State

- [ ] **Partially implemented**: admin dashboard shows which step user got stuck in rental process
- [ ] Find and document the existing admin dashboard component
- [ ] What data does it currently show?
- [ ] Enhancement: showing successful rents automatically would be valuable
  - Findings: _document here_

---

## 🏗️ Phase 2: Design & Implementation Tasks

> Each task is self-contained with its own checkboxes. Complete Phase 1 investigations first, then work through these in order.

---

### Task A: Fix Duplicate DOCX Delivery Bug

> **Prerequisite**: investigation 1.1 (find the bug)
> **Complexity**: S
> **Blocks**: Task B (QR delivery) — must fix delivery mechanism before adding QR

- [ ] Find root cause of duplicate `sendDocument` call in skill script
- [ ] Fix: ensure DOCX is sent exactly once
- [ ] Verify fix doesn't break existing delivery

---

### Task B: QR Code Alongside Rental Contract

> **Prerequisite**: investigation 1.5 (QR generation), Task A (fix duplicate doc)
> **Complexity**: M
> **Depends on**: Task A

- [ ] **Design QR URL format**:
  ```
  https://t.me/oneBikePlsBot/app?startapp=rent_{bike_id}_{doc_sha256}
  ```
  - `bike_id` = `cars.id` (human-readable slug like `kawasaki-ex650k`, NOT a UUID)
  - `doc_sha256` = SHA256 hex from `rental_contract_artifacts.original_sha256` (hex string, not UUID — don't confuse with `crew_id` which IS a UUID)

- [ ] **Generate QR PNG** using existing web QR method (found in investigation 1.5)
  - [ ] Confirm it can output PNG buffer for Telegram
  - [ ] If not, add `qrcode` npm package as fallback

- [ ] **Send DOCX + QR in ONE Telegram message**
  - [ ] Use `sendMediaGroup` or equivalent to combine document + photo
  - [ ] DO NOT send as separate messages (confusing for users)
  - [ ] Include deep-link URL as text caption below QR image (for non-QR-capable devices)

- [ ] **Update skill script** (`make-rental-contract-skill.mjs`):
  - [ ] After DOCX generation + SHA256 computation, construct QR URL
  - [ ] Generate QR PNG
  - [ ] Send combined message

- [ ] **Update web-app pipeline** (`buildFranchizeOrderDocAndNotify`):
  - [ ] Same QR generation + combined delivery logic

- [ ] Test: verify DOCX + QR arrive in one message, no duplicates

---

### Task C: `private.user_rental_secrets` Table Migration

> **Prerequisite**: investigation 1.2 (existing secret tables)
> **Complexity**: M
> **Blocks**: Tasks D, E, F, G (all depend on this table existing)

- [ ] **Create migration file**: `202606XXXXXXX_user_rental_secrets.sql`

- [ ] **Schema** (refine based on investigation findings):
  ```sql
  CREATE TABLE private.user_rental_secrets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id           TEXT NOT NULL,          -- telegram user's chat_id (matches users table key)
    crew_slug         TEXT NOT NULL,           -- franchise scope (crew isolation is intentional — do NOT design cross-franchise sharing)
    doc_sha256        TEXT NOT NULL,           -- links to rental_contract_artifacts.original_sha256
    renter_full_name  TEXT,
    renter_passport   TEXT,
    renter_driver_license TEXT,
    renter_birth_date TEXT,
    renter_phone      TEXT,
    renter_email      TEXT,
    renter_address    TEXT,
    source_doc_key    TEXT,                    -- contract_key of the source document
    source_rental_id  TEXT,                    -- rental_id if available
    verification_status TEXT NOT NULL DEFAULT 'verified',  -- 'verified' | 'pending' | 'revoked'
    template_version  INTEGER,                 -- version of contract template used (for template revocation — re-sign if template changes)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(chat_id, crew_slug, doc_sha256)
  );

  CREATE INDEX idx_user_rental_secrets_doc_sha
    ON private.user_rental_secrets(doc_sha256);

  CREATE INDEX idx_user_rental_secrets_user_crew
    ON private.user_rental_secrets(chat_id, crew_slug, verification_status);
  ```

- [ ] **Design decisions to resolve** (check when decided):
  - [ ] Should this replace or augment existing `getUserSensitiveDataOrDefault`? Or coexist during migration?
  - [ ] How does it relate to existing (undocumented) user secrets table? Merge or coexist?
  - [ ] RLS policy: users can only read own rows (by `chat_id`). Service role can read/write all. Define exact SQL policies.

- [ ] **Privacy**: Paper contract consent (Appendix 4 — Согласие на обработку ПД) covers data storage. `private.*` schema + service-role-only access is sufficient. No separate digital consent needed.

- [ ] **No data versioning column**: Each rental creates a new row (unique on `chat_id + crew_slug + doc_sha256`). Multiple rows for same user across different rentals are expected — most recent verified row is used for auto-fill. Use `created_at DESC` for ordering.

- [ ] **`template_version` field**: Tracks which contract template version was used. When template is updated, old rentals on previous version can be identified for re-sign.

- [ ] **Migration pattern**: Follow `private.crew_secrets` approach — SQL migration file

---

### Task D: Save Renter Data on Contract Generation

> **Prerequisite**: Task C (table exists)
> **Complexity**: M
> **Depends on**: Task C

- [ ] **Skill script** (`make-rental-contract-skill.mjs`):
  - [ ] After successful DOCX generation + SHA256, insert row into `private.user_rental_secrets`
  - [ ] Extract renter fields from the same data used to fill template variables
  - [ ] Set `verification_status = 'verified'` (doc was just generated and sent)
  - [ ] Set `template_version` from current template version constant

- [ ] **Web-app pipeline** (`buildFranchizeOrderDocAndNotify`):
  - [ ] Same insert logic after successful doc generation
  - [ ] Read renter data from `userSensitive` + payload fields

- [ ] **Future preparation**: design the insert to work for batch imports too (digitize old docs workflow — batch-insert rows from historical paper documents, generate shareable links per rider)

---

### Task E: QR Deep-Link Parsing & Data Auto-fill

> **Prerequisite**: investigation 1.3 (deep-links), Task B (QR generation), Task C (table), Task D (data saved)
> **Complexity**: L
> **Depends on**: Tasks B, C, D

- [ ] **Parse `startParam`**: Detect `rent_` prefix (NOT `rental-`), extract `bikeId` and `docSha`
  - [ ] Must NOT break existing `rental-{id}` parsing
  - [ ] Add new route/dispatch case for `rent_` prefix

- [ ] **Authenticate**: Use existing `useTelegramAuth` flow → get `chat_id` from `initData`

- [ ] **Lookup renter data**: Query `private.user_rental_secrets` where:
  - `doc_sha256 = docSha`
  - `chat_id = current_user_chat_id`
  - `verification_status = 'verified'`

- [ ] **Verify source doc exists**: Cross-reference with `rental_contract_artifacts`

- [ ] **Pre-fill rental form**: Auto-populate renter fields, skip "photograph documents" step

- [ ] **Allow edit**: User can modify any pre-filled field before submission

- [ ] **First-time renter flow**: If scanner has no matching data (different user or no history):
  - [ ] Open rental page with bike pre-selected (using `bikeId` from QR)
  - [ ] No auto-fill — standard rental flow
  - [ ] This is also the "cold start" onboarding path

- [ ] **QR expiration**: Consider expiring after first successful usage, or on doc revocation
  - [ ] Decide: expire on first use? Or keep link alive for repeated use?
  - [ ] If expired, show "Ссылка использована" → redirect to manual rental

- [ ] **Security**: `doc_sha256` is a lookup key, NOT an auth token. Auth comes from Telegram `initData`. QR is given to driver personally (not public).

- [ ] **Error states** (implement all):
  | Scenario | Behavior |
  |----------|----------|
  | QR scanned by different user | Open rental with bike pre-selected, no auto-fill |
  | Doc revoked | Error: "Документ аннулирован" → manual rental |
  | Bike no longer in fleet | Error: "Мотоцикл не доступен" → suggest alternatives |
  | QR link expired | Error: "Ссылка использована" → manual rental |
  | Stale data (old rental) | Show with date context: "Данные от DD.MM.YYYY" → let user verify |
  | Multiple rentals for same user | Show picker (Task F) |
  | No rental history | Standard rental flow |

---

### Task F: "Previous Rental" Data Picker UI

> **Prerequisite**: Task C (table), Task D (data saved), Task E (auto-fill flow)
> **Complexity**: M
> **Depends on**: Tasks C, D

- [ ] **Query**: `private.user_rental_secrets` where `chat_id = current_user` AND `crew_slug = current_franchise` AND `verification_status = 'verified'`
- [ ] **Sort**: `created_at DESC` (most recent first)
- [ ] **Display**: list of previous rentals — "Кавасаки EX650K — 15.05.2026" with "Использовать данные" button
- [ ] **On selection**: pre-fill rental creation form
- [ ] **Design decisions**:
  - [ ] Where in UI? (profile page section? modal in rental flow? both?)
  - [ ] Data staleness: show date of last rental as context, let user decide

---

### Task G: Franchise Profile Page Enhancement

> **Prerequisite**: investigation 1.4 (find profile page), Task C (table)
> **Complexity**: M
> **Depends on**: Tasks C, D

- [ ] Show user's saved rental data (masked: "Паспорт: **** 4512")
- [ ] Allow editing/clearing saved data
- [ ] Show linked rental documents
- [ ] Provide "Quick Rent" button → initiate new rental using saved data

---

### Task H: Contract Template Page Breaks

> **Prerequisite**: investigation 1.1 (template structure)
> **Complexity**: S
> **Depends on**: nothing (independent fix)

- [ ] **Problem**: DOCX prints as continuous flow ("сплошняком"), signature shifts to wrong side
- [ ] **Fix option A**: Add `<div style="page-break-before: always">` to HTML template before each Appendix
- [ ] **Fix option B**: Detect section headers in `htmlToDocx` and insert `new Paragraph({ pageBreakBefore: true })`
- [ ] Choose approach and implement
- [ ] Verify printed output has proper page breaks between sections

---

### Task I: Missing Blank Fields for Handoff

> **Prerequisite**: investigation 1.7 (rental lifecycle)
> **Complexity**: S
> **Depends on**: nothing (independent fix)

- [ ] **Add blank placeholders to Appendix 1 (Акт приема-передачи)**:
  - [ ] Показания одометра: ____________
  - [ ] Уровень топлива: ____________
  - [ ] Состояние шин: ____________
  - [ ] Повреждения при передаче: ____________
- [ ] Update both HTML and MD templates
- [ ] These fields are filled manually during handoff until digitized handoff is implemented

---

### Task J: Web-App Duration & Time Picker

> **Prerequisite**: investigation 1.8 (current checkout flow)
> **Complexity**: M
> **Depends on**: nothing (independent enhancement)

- [ ] **Current state**: checkout likely has preset duration options (1/3/7 days)
- [ ] **Real-world usage**: hourly rentals (3 hours on Kawasaki), custom time ranges
- [ ] **Enhancement**:
  - [ ] Add date/time picker for start and end date+time (precise to hours)
  - [ ] Keep quick preset buttons ("1 день", "3 дня", "неделя") as popular shortcuts
  - [ ] Presets are NOT the only options — they just pre-fill the picker
  - [ ] Aligns web-app with skill pipeline's arbitrary time range support

---

### Task K: Admin Dashboard — Successful Rents Display

> **Prerequisite**: investigation 1.9 (current admin dashboard)
> **Complexity**: S
> **Depends on**: nothing (independent enhancement)

- [ ] Find existing admin dashboard component
- [ ] Currently shows which step user got stuck in
- [ ] **Enhancement**: also show successful rents automatically
- [ ] Display rental history with doc verification status

---

### Task L: Hot-Stage QR Entry (Rent-in-Progress View)

> **Prerequisite**: investigation 1.7 (rental lifecycle), Task E (QR deep-link parsing)
> **Complexity**: M
> **Depends on**: Task E

> **Context**: Handoff photos are partially implemented — sending a photo to Telegram bot auto-assigns it as "before" or "after" depending on active rent state. But there's no way to enter the "hot stage" (rent in progress) web view without navigating manually.

- [ ] **Design**: QR scan should open rent-in-progress view directly (not just contract pre-fill)
- [ ] When user scans QR during active rental:
  - [ ] Open the rental detail page for that active rental
  - [ ] Show "handoff mode" — add damage photos, odometer, notes
  - [ ] No need to re-navigate or re-click anything
- [ ] This bridges the gap between paper handoff and digitized handoff

---

## 📊 Task Dependency Graph

```
Task A (fix duplicate doc) ──→ Task B (QR alongside doc)
                                    │
Task C (secret table) ──────────────┼──→ Task D (save renter data)
                                    │         │
                                    │         ├──→ Task E (QR deep-link auto-fill) ──→ Task L (hot-stage entry)
                                    │         │
                                    │         ├──→ Task F (previous rental picker)
                                    │         │
                                    │         └──→ Task G (profile page enhancement)

Independent: Task H (page breaks), Task I (blank fields), Task J (time picker), Task K (admin dashboard)
```

**Suggested execution order**: C → D → A → B → E → F → G → L | H, I, J, K can run in parallel

---

## ⚠️ Constraints

- **No breaking changes**: Existing `rental-{id}` deep-links must continue to work. New `rent_{bikeId}_{docSha}` must not collide.
- **Private schema for secrets**: Sensitive renter data MUST live in `private.*` tables, never `public.*`.
- **Metadata principle**: `users.metadata` stores raw signals only. Derived state goes in secret table, not metadata.
- **Crew isolation**: Scoped per franchise (`crew_slug`). Do NOT design cross-franchise data sharing. Different crews may have different doc types and templates.
- **Privacy**: Paper contract consent (Appendix 4) covers data storage. `private.*` schema + service-role-only access is sufficient.
- **Bike IDs are slugs**: `cars.id` is human-readable (`kawasaki-ex650k`), NOT a UUID. `doc_sha256` is a hex string (also not UUID). Don't confuse with `crew_id` which IS a UUID.
- **No multi-bike support**: 1 bike = 1 doc = 1 contract. Keep it simple.
- **Russian language**: All user-facing text in Russian. Code/comments can be English.
- **Supabase-first**: Use Supabase client (service role for `private.*` access), not raw SQL from app code.

---

## 🏭 Production Feedback (May 30, 2026)

Client triggered: `@Codex сделай договор аренды мотоцикла на кавасаки на этого клиента. Дата 30.05.26 время с 20.00 до 23.00 сумма 6000р`

Contract was **printed and signed IRL** ✅

### Known Issues

| # | Issue | Status | Task |
|---|-------|--------|------|
| LAYOUT-1 | No page breaks — doc prints "сплошняком" | Open | Task H |
| PRICE-1 | Explicit price in prompt ignored | **Deferred** — price override from prompt text needs more thought, could raise questions. Seed data fixed instead. | Not in scope |
| DATA-1 | Kawasaki daily price wrong | **Fixed** ✅ (dailyPrice=16000, price_per_hour=2000) | Done |
| DATA-2 | Missing blank handoff fields | Open | Task I |
| BUG | Duplicate DOCX delivery | Open | Task A |

---

## 🧭 Navigation Hints

**Key files:**
- `scripts/make-rental-contract-skill.mjs` — Skill script (Codex/Slack trigger)
- `lib/docx-capability.ts` — Web-app doc builder
- `lib/htmlToDocx.mjs` and `lib/htmlToDocx.ts` — HTML→DOCX conversion
- `docs/RENTAL_DEAL_TEMPLATE.html` — Contract template with all `{{variables}}`
- `actions-runtime.ts` — Main server actions (search for `buildFranchizeOrderDocAndNotify`, `getFranchizeRentalCard`, `getUserSensitiveDataOrDefault`)
- `useTelegramAuth.ts` — Telegram auth hook with `startParam`
- `start.ts` — `/start` command handler
- `FranchizeProfileButton.tsx` — Profile dropdown (links to `/franchize/{slug}/profile`)
- `experience-types.ts` — Type definitions including `VipBikeUserMetadata`
- `track-behavior.ts` — Existing QR scan tracking
- `20260527090000_rental_contract_artifacts.sql` — Existing artifacts table migration
- `crews_rows.csv` / `users_rows.csv` — Seed data with metadata JSONB structure

**Key search terms:**
- `private.crew_secrets` / `crew_secrets` — existing secret table pattern
- `getUserSensitiveDataOrDefault` / `saveCrewSensitiveData` — secret access functions
- `startapp` / `startParam` / `start_param` — deep-link handling
- `contract_verifier` / `originalSha256` / `doc_verifier` — document verification
- `rental_contract_artifacts` — contract metadata table
- `franchize` / `franchise` — franchise-related code (both spellings exist!)
- `qr` / `qrcode` / `QR` — QR code generation (web method exists in repo)
