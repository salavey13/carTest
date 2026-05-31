# 1-Click Next Rent — Project TODO

> Living document for VIP Bike Rental franchise integration.
> Each section has inline `[ ]` checkboxes. Check them off as you complete work.
> **Structure rule**: progress is tracked inline via checkboxes — do NOT append results to end of file. This avoids merge conflicts when multiple agents work on different sections.

---

## 🔍 Phase 1: Investigation

> Complete these investigations BEFORE designing anything. Read actual source files, trace call chains, document findings inline under each item.

### 1.1 Rental Contract Generation Pipeline

- [x] **Skill script** (`scripts/make-rental-contract-skill.mjs`): Trace full flow from trigger to delivered DOCX
  - [x] How does it parse bike identification? (`--phrase`, `--bikeId`, fuzzy matching against `cars` table)
  - [x] How does it receive renter data? (`--passportJson`, `--licenseJson` from OCR)
  - [x] How does it fill template variables? (~40 `{{mustache}}` placeholders)
  - [x] How does it compute `original_sha256`? (from DOCX buffer bytes)
  - [x] How does it save metadata? (`--saveMetadata 1` → `rental_contract_artifacts` table)
  - [x] How does it deliver the doc? (Telegram Bot API `sendDocument`)
  - [x] **Bug: duplicate DOCX** — trace the delivery code path, find where the same doc is sent twice
  - Findings: `--phrase` is trimmed into a bike query after the trigger words, falling back to `--bikeId`; date words are stripped, then all `cars` with `type in (bike, ebike)` are loaded and ranked by normalized id/make/model/VIN/frame fuzzy score. Renter data is JSON read from `--passportJson` and `--licenseJson`; required full name, birth date, passport series/number, and license series/number fail fast if missing. Variables are assembled in `vars` and rendered through mustache-style `{{key}}` replacement into either HTML (`RENTAL_DOC_TEMPLATE_MODE=html`) or MD fallback (`md` default). DOCX bytes come from `Packer.toBuffer(doc)`, and `original_sha256` is `sha256(buf)` after DOCX generation. Metadata is optional (`--saveMetadata 1`) and inserts `contract_key`, requested/resolved bike, Telegram chat/message id, renter name, rental dates, and `original_sha256` into `rental_contract_artifacts`, followed by read-after-write verification. Delivery sends one Telegram Bot API `sendDocument` request by `fetch`, with curl fallback only for network failure after this pass. Duplicate root cause found: the old `try` wrapped `fetch` plus `res.json()`, so if Telegram accepted the upload but response parsing/streaming failed, the catch retried with curl and could send the same DOCX again. Fixed in Task A by reading response text and failing parse errors without retrying the already-sent document.

- [x] **Web-app pipeline** (`lib/docx-capability.ts` → `buildFranchizeDocxFromTemplate()`)
  - [x] How is it called? (from `buildFranchizeOrderDocAndNotify()` in `actions-runtime.ts`)
  - [x] What's the `integrationScope` / `documentKey` pattern?
  - [x] How is `doc_verifier_records` populated? (via `registerVerifierOriginalForBuffer`)
  - [x] How is the SHA256 stored in rental's metadata? (`rentals.metadata.contract_verifier` JSONB)
  - Findings: `buildFranchizeOrderDocAndNotify()` loads cart cars, private user/crew data, resolves legal variables, then calls `buildFranchizeDocxFromTemplate()` with `integrationScope = ${flowType}:${slug}:${orderId}` and `documentKey = rental-${slug}-${orderId}` (or `sale-...`). `docx-capability` defaults to HTML mode, applies template vars, builds a DOCX through `htmlToDocxDocument()`, computes `sha256` from the final DOCX bytes, and calls `registerVerifierOriginalForBuffer()` when `documentKey` exists. That action upserts `doc_verifier_records` on `(integration_scope, document_key)` with `original_sha256`. After sending the DOCX to admin/user/crew owner, rental metadata is patched with `contract_verifier = { scope: rental:${rental_id}, sourceScope, documentKey, docVerifierRecordId, originalSha256: sha256, status: "verified", verifiedAt, expiresAt: null }`.

- [x] **Template** (`docs/RENTAL_DEAL_TEMPLATE.html` and `.md`)
  - [x] What variables exist? (focus on renter fields: `renter_full_name`, `renter_passport`, `renter_driver_license`, `renter_birth_date`, `renter_phone`, `renter_address`)
  - [x] What's the template mode switch? (`RENTAL_DOC_TEMPLATE_MODE` env var → `html` vs `md`)
  - Findings: HTML is the active high-fidelity template path for the web-app pipeline; the skill script can use HTML only when `RENTAL_DOC_TEMPLATE_MODE=html`, otherwise it defaults to MD. Renter placeholders present in the templates include `renter_full_name`, `renter_birth_date`, `renter_phone`, `renter_email`, `renter_driver_license`, `renter_passport`, and `renter_passport_issue_date`; `renter_address` is referenced by the TODO/design but is not currently present in the HTML or MD template. Page-break support already existed in `htmlToDocx.mjs` for `<div style="page-break-before: always"></div>` / `.page-break`, but the rental HTML template did not emit those break markers before appendices, causing continuous printed flow.

### 1.2 Existing Secret Tables & Access Patterns

- [x] **`private.crew_secrets`** table:
  - [x] Document exact schema: `crew_slug (TEXT PK)`, `contract_defaults (JSONB)`, `updated_at (TIMESTAMPTZ)`
  - [x] Read by: `getCrewSensitiveDataOrDefault(slug, context)` from `@/app/lib/private-secrets`
  - [x] Written by: `saveCrewSensitiveData(slug, data)` from same module
  - Findings: Actual migrations define `private.crew_secrets` as `crew_slug TEXT PRIMARY KEY`, `contract_defaults TEXT`, `doc_templates TEXT`, `price_lists TEXT`, `sensitive_metadata JSONB DEFAULT '{}'::jsonb`, `updated_at TIMESTAMPTZ DEFAULT now()`; the code serializes/deserializes `contract_defaults` and `doc_templates` as JSON strings rather than JSONB. `getCrewSensitiveDataOrDefault()` reads through `supabaseAdmin.schema("private").from("crew_secrets")`, sanitizes JSON records, and returns `{ contractDefaults, docTemplates }` or empty defaults on private-read failure. `saveCrewSensitiveData()` upserts `crew_slug`, serialized `contract_defaults`/`doc_templates`, and `updated_at`, with guards against credential-like keys in editable crew JSON.

- [x] **User secrets** (module exists but table schema not in repo):
  - [x] **FIND the actual table**: search for `user_secrets` or similar in migrations, SQL files, or `private-secrets` module
  - [x] Document `getUserSensitiveDataOrDefault(telegramUserId, context)` return shape: `{ driverLicense, passport, renterBirthDate?, renterPhone?, renterEmail? }`
  - Findings: The actual table is `private.user_secrets` in `supabase/migrations/20260304_private_scheme.sql`: `user_id TEXT PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE`, `driver_license TEXT`, `passport TEXT`, `sensitive_metadata JSONB DEFAULT '{}'::jsonb`, `updated_at TIMESTAMPTZ DEFAULT now()`. Current code return shape is only `{ driverLicense: string, passport: string }`; `renterBirthDate`, `renterPhone`, and `renterEmail` are not part of `UserSensitiveData` yet. The web-app doc identity resolver therefore pulls birth/phone/email from payload/defaults where possible and warns when birth date is missing.

- [x] **`private` schema pattern**: PostgREST only exposes `public` schema. Data in `private.*` is inaccessible via anon/auth REST keys — implicit access control. Document how this is used.
  - Findings: Migrations revoke all on schema `private` from `anon` and `authenticated`, grant `USAGE` only to `service_role`, and grant table access only to `service_role`. App access is through server-only `app/lib/private-secrets.ts` (`"use server"`, `server-only`, `supabaseAdmin.schema("private")`), so client modules should not import it. The current pattern is service-role-only server mediation, not direct user RLS through public PostgREST.

### 1.3 Deep-Link & Telegram Mini App Flow

- [x] **Current deep-link pattern**: `https://t.me/oneBikePlsBot/app?startapp=rental-${rentalId}`
  - [x] Found in: `actions-runtime.ts` → `getFranchizeRentalCard()`
  - [x] Parsed by: `useTelegramAuth.ts` → reads `startParam`
  - [x] Routed by: router inside `ClientLayout.tsx` that maps `rental-*` prefix to rental detail page
  - [x] **Design question**: can `startapp` be extended to `rent_{bikeId}_{docSha}` without breaking existing `rental-{id}` parsing?
  - Findings: `getFranchizeRentalCard()` emits `startapp=rental-${rentalId}` for rental detail cards. `useTelegramAuth` reads `webApp.initDataUnsafe.start_param` (with launch-param fallback) and stores it in app context. `ClientLayout` calls `useStartParamRouter()`, which currently routes `rental-*`, `rentals-*`, and `sale-*` to `/franchize/{slug}/rental/{id}`. `rent_` is already reserved for vehicle rent QR and calls `/api/startapp/vehicle?flow=rent`; therefore `rent_{bikeId}_{docSha}` will not collide with `rental-{id}`, but it will require refining the existing `rent_` branch to distinguish a two-part vehicle deep link from the new three-part document-hash format.

- [x] **Telegram auth hook**: `useTelegramAuth.ts` → `initData`, `initDataUnsafe.start_param`, validation via `/api/validate-telegram-auth`, upsert via `upsertTelegramUserAction`
  - Findings: The hook safely reads Telegram SDK fields with Safari-safe try/catch guards, validates `initData` through `/api/validate-telegram-auth`, allows dev/mock fallback only in allowed contexts, then calls `handleAuthentication()` / `upsertTelegramUserAction` to persist the Telegram user and set `dbUser`. Auth is therefore available before private QR auto-fill should be attempted, and `doc_sha256` must be treated as a lookup key rather than an auth token.

### 1.4 Franchise Profile & User Data Pre-set

- [x] **Franchise profile route**: `/franchize/{slug}/profile`
  - [x] **FIND the actual page component** — it's not in the current workspace but must exist in the repo
  - [x] What data can users currently preset/save?
  - [x] How is sensitive user data (passport, license) currently saved?
  - Findings: The page exists at `app/franchize/[slug]/profile/page.tsx` and renders `FranchizeProfileClient`. The client loads achievements/activity, capability contracts, operator access, and `FranchizeFormPrefill` (`fullName`, `phone`, `preferredTime`, `deliveryMode`, `comment`). `saveFranchizeFormPrefillAction()` stores this prefill under `users.metadata.franchizeFormPrefill[slug]`, so it is non-secret contact/order convenience data. Passport and license are not edited on this page; sensitive doc data currently lives in `private.user_secrets` via `saveUserSensitiveData()` when used elsewhere, and new rental-history fields should not be added to `users.metadata`.

- [x] **User metadata JSONB** (`users.metadata`):
  - Current keys: `settings`, `cyberFitness`, `survey_results`, `behavior_signals`, `experience_lock`, `franchizeProfiles`, `franchizeNotificationPreferences`, `onboarding_context`
  - Design principle: **metadata stores RAW SIGNALS ONLY, never derived state**
  - Findings: Current profile prefill slightly extends metadata with `franchizeFormPrefill`; keep future scanned-contract/rental-derived identity data in `private.user_rental_secrets`, not metadata.

### 1.5 QR Code — Current State

- [x] **QR generation code exists** in the repo — find the web method that creates QR codes
  - [x] What library does it use?
  - [x] How does it render QR images?
  - [x] Can it output PNG buffer for Telegram sending?
  - Findings: Existing web QR generation is mostly remote-image based: strikeball pages and franchize buy-print fetch/use `https://api.qrserver.com/v1/create-qr-code/?size=...&data=...`; `buy-print.ts` fetches that URL as an image and embeds it into a PDF, while React pages render it as `<img>`. There is also a `QRCodeSVG` import in `app/strikeball/test-lab/page.tsx`, but `qrcode.react` is not declared in `package.json`, so it is not a reliable dependency. The current method can produce a PNG buffer for Telegram if the server fetches `api.qrserver.com`, but it is network-dependent; a local `qrcode` package remains the safer fallback for Task B.

### 1.6 Document Verification & SHA256 Chain

- [x] Trace the SHA256 chain across tables:
  - [x] `doc_verifier_records.original_sha256`
  - [x] `rental_contract_artifacts.original_sha256`
  - [x] `rentals.metadata.contract_verifier.originalSha256`
  - [x] Are they always the same value? Which one should the QR link encode?
  - Findings: Web-app contracts compute one SHA256 from final DOCX bytes inside `buildFranchizeDocxFromTemplate()`, register the same bytes in `doc_verifier_records.original_sha256`, and copy that `sha256` into `rentals.metadata.contract_verifier.originalSha256`. The skill script separately computes `originalSha256` from its final DOCX buffer and stores it in `rental_contract_artifacts.original_sha256` when metadata is enabled; it does not currently register `doc_verifier_records`. Values are the same only within a single generation path for the same bytes; web-app and skill-generated docs can differ if templates/modes/defaults differ. QR should encode the exact `rental_contract_artifacts.original_sha256` for the delivered paper/DOCX artifact when using the skill flow; for web-app flow, either create the artifact row from the same bytes or encode the verifier/rental metadata hash from the same final buffer.

### 1.7 Full Rental Lifecycle & Handoff Steps

> **Critical for understanding where "1-click" actually fits.** The rental flow is NOT a single step.

- [x] **Contract generation** — what we have now: bike + renter data → DOCX + QR
- [x] **Handoff** — when renter picks up the bike:
  - [x] Photos of preexisting damage — **partially implemented**: sending photo to Telegram bot auto-assigns it as "before" or "after" depending on active rent state
  - [x] Odometer reading — currently manual on paper
  - [x] Fuel level — currently manual on paper
  - [x] Condition notes — currently manual on paper
  - **Key insight**: the "hot stage" (rent in progress) needs a way to enter the web app WITHOUT requiring user to re-click/navigate. QR scan should open the rent-in-progress view directly.
  - Findings: Rental detail route `/franchize/[slug]/rental/[id]` loads `getFranchizeRentalCard()` and includes `FranchizeRentalDocumentsPanel`. That panel already exposes pickup freeze and damage report actions (`saveRentalPickupFreeze`, `addRentalDamageReport`) for active rental documentation, so hot-stage QR should resolve to this rental detail route when there is an active rental for the scanned bike/user. Paper fields for odometer/fuel/tires/damage were missing in Appendix 1 and are now added by Task I.

- [x] **Return** — when renter brings bike back:
  - [x] Final odometer, damage check, fuel level
  - Findings: The existing rental docs panel has before/after style damage report support via rental actions, but final odometer/fuel-level structured capture is still not fully digitized in this TODO scope. Keep manual blanks on Appendix 1 until the hot-stage view adds structured return fields.

- [x] What states does a rental go through in the web app? Document the full state machine.
  - Findings: Availability logic treats `pending_confirmation` and `confirmed` as upcoming bookings and `active` as in-use; order creation and rental card code also handles missing/not-found fallback, and review/completion surfaces imply a later completed/returned state. Practical state machine for 1-click design: `checkout_started` recovery snapshot → order notification/payment → `pending_confirmation` rental → `confirmed` booking → `active` handoff/hot-stage → return/damage review → completed/closed (plus cancellation/revocation error paths).

### 1.8 Web-App Rental Order Flow

- [x] What fields does the renter currently fill in during checkout?
- [x] What are the duration options? (likely 1/3/7 day presets currently)
- [x] Is there a date/time picker or only preset durations?
- [x] How does the web-app pipeline differ from the skill pipeline in data completeness?
- [x] **Known gap**: web-app order flow doesn't cover 100% of data needed for the contract (some fields like birth date missing from form). Skill pipeline fills these from OCR. How to bridge this gap?
  - Findings: Checkout currently asks for recipient name, phone, convenient time text, start date (`type=date`), auto-computed end date, signature name, comment, payment, delivery mode, extras, promo, consent, and safety quiz. Duration comes from cart line options (`duration`, default `1 день`) and `rentalDays`; checkout only exposes start date and computes end date from max rental days, with no start/end time picker. Web-app pipeline is less complete than the OCR skill: it does not collect passport/license/birth date in the order form and relies on `private.user_secrets` or placeholders. Bridge gap by using `private.user_rental_secrets`/previous verified rentals for auto-fill and adding explicit editable document fields only behind server/private storage.

### 1.9 Admin Dashboard — Current State

- [x] **Partially implemented**: admin dashboard shows which step user got stuck in rental process
- [x] Find and document the existing admin dashboard component
- [x] What data does it currently show?
- [x] Enhancement: showing successful rents automatically would be valuable
  - Findings: Existing admin UI lives in `app/franchize/[slug]/admin/page.tsx` + `app/franchize/components/FranchizeAdminClient.tsx`. It loads editable fleet, failed order notifications (`getFranchizeOrderNotificationFailures`), retry controls, review moderation, and vehicle editing. Checkout recovery snapshots are sent from cart/order flows with stages like `checkout_started`, but the admin panel currently focuses on failures/moderation/fleet and does not surface successful rental history with contract verifier status. Task K should add a successful-rentals section from `rentals` joined with vehicle and metadata `contract_verifier`.

---

## 🏗️ Phase 2: Design & Implementation Tasks

> Each task is self-contained with its own checkboxes. Complete Phase 1 investigations first, then work through these in order.

---

### Task A: Fix Duplicate DOCX Delivery Bug ✅

> **Prerequisite**: investigation 1.1 (find the bug)
> **Complexity**: S
> **Blocks**: Task B (QR delivery) — must fix delivery mechanism before adding QR

- [x] Find root cause of duplicate `sendDocument` call in skill script
- [x] Fix: ensure DOCX is sent exactly once
- [x] Verify fix doesn't break existing delivery
  - Findings: The fetch/curl fallback no longer retries after a response body parse failure from an already accepted Telegram request; curl fallback is reserved for network/send exceptions before a response is available.

---

### Task B: QR Code Alongside Rental Contract

> **Prerequisite**: investigation 1.5 (QR generation), Task A (fix duplicate doc)
> **Complexity**: M
> **Depends on**: Task A ✅, Task C (for doc_sha256 source)

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

- [x] **Create migration file**: `supabase/migrations/20260601000000_user_rental_secrets.sql`

- [x] **Schema** (refined based on Phase 1 findings):
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

- [x] **Follow `private` schema pattern** (from investigation 1.2):
  - [x] Revoke all from `anon` and `authenticated`
  - [x] Grant USAGE + table access only to `service_role`
  - [x] Follow `20260304_private_scheme.sql` pattern exactly

- [x] **Server-side access module**: create `app/lib/user-rental-secrets.ts`
  - [x] `"use server"` + `server-only` imports (same pattern as `private-secrets.ts`)
  - [x] `getUserRentalSecrets(chatId, crewSlug)` — returns most recent verified row per user+crew
  - [x] `getUserRentalSecretsByDocSha(docSha256)` — lookup by doc hash (for QR verification)
  - [x] `saveUserRentalSecrets(data)` — insert new row
  - [x] `revokeUserRentalSecrets(docSha256)` — set `verification_status = 'revoked'`
  - [x] All reads through `supabaseAdmin.schema("private")`

- [x] **Design decisions** (check when decided):
  - [x] Should this replace or augment existing `getUserSensitiveDataOrDefault`? Or coexist during migration?
  - [x] How does it relate to existing `private.user_secrets` table? Merge or coexist?
  - [x] Recommendation from Phase 1: **coexist**. `user_secrets` stores raw OCR scan data (passport, license strings). `user_rental_secrets` stores rental-contextual identity (with doc_sha256 provenance, crew scope, verification status). Different lifecycle, different access patterns.

- [x] **Privacy**: Paper contract consent (Appendix 4 — Согласие на обработку ПД) covers data storage. `private.*` schema + service-role-only access is sufficient. No separate digital consent needed.

- [x] **No data versioning column**: Each rental creates a new row (unique on `chat_id + crew_slug + doc_sha256`). Multiple rows for same user across different rentals are expected — most recent verified row is used for auto-fill. Use `created_at DESC` for ordering.

- [x] **`template_version` field**: Tracks which contract template version was used. When template is updated, old rentals on previous version can be identified for re-sign.

- [x] **Future preparation**: design the schema to support batch imports (digitize old docs workflow — batch-insert rows from historical paper documents)

- [x] **Write a seed migration** or test data script to verify the table works with `supabaseAdmin`

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
  - [ ] Phase 1 finding: `rent_` already routes to `/api/startapp/vehicle?flow=rent` — extend this handler to detect three-part format `rent_{bikeId}_{docSha}` vs existing two-part `rent_{bikeId}`

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

### Task H: Contract Template Page Breaks ✅

> **Prerequisite**: investigation 1.1 (template structure)
> **Complexity**: S
> **Depends on**: nothing (independent fix)

- [x] **Problem**: DOCX prints as continuous flow ("сплошняком"), signature shifts to wrong side
- [x] **Fix option A**: Add `<div style="page-break-before: always">` to HTML template before each Appendix — **CHOSEN ✅**
- [x] ~~Fix option B~~: Detect section headers in `htmlToDocx` — **SKIPPED** (option A sufficient, `htmlToDocx` already supports page-break divs)
- [x] Choose approach and implement
- [x] Verify printed output has proper page breaks between sections
  - Findings: Chose option A because `htmlToDocx.mjs` already converts page-break divs into DOCX `PageBreak` paragraphs. Verified generated DOCX XML contains four `w:br w:type="page"` markers.

---

### Task I: Missing Blank Fields for Handoff ✅

> **Prerequisite**: investigation 1.7 (rental lifecycle)
> **Complexity**: S
> **Depends on**: nothing (independent fix)

- [x] **Add blank placeholders to Appendix 1 (Акт приема-передачи)**:
  - [x] Показания одометра: ____________
  - [x] Уровень топлива: ____________
  - [x] Состояние шин: ____________
  - [x] Повреждения при передаче: ____________
- [x] Update both HTML and MD templates
- [x] These fields are filled manually during handoff until digitized handoff is implemented

---

### Task J: Web-App Duration & Time Picker

> **Prerequisite**: investigation 1.8 (current checkout flow)
> **Complexity**: M
> **Depends on**: nothing (independent enhancement)

- [ ] **Current state**: checkout has preset duration options (1/3/7 days) as "quick presets" only
- [ ] **Real-world usage**: hourly rentals (3 hours on Kawasaki), custom time ranges, arbitrary hours
- [ ] **Enhancement**:
  - [ ] Add date/time picker for start and end date+time (precise to hours)
  - [ ] Keep quick preset buttons ("1 день", "3 дня", "неделя") as popular shortcuts
  - [ ] Presets are NOT the only options — they just pre-fill the picker
  - [ ] Aligns web-app with skill pipeline's arbitrary time range support
  - [ ] Phase 1 finding: checkout only exposes start date (`type=date`) and computes end from `rentalDays`; no time-of-day picker exists yet

---

### Task K: Admin Dashboard — Successful Rents Display

> **Prerequisite**: investigation 1.9 (current admin dashboard) ✅
> **Complexity**: S
> **Depends on**: nothing (independent enhancement)

- [x] Find existing admin dashboard component — **Found** in Phase 1: `app/franchize/[slug]/admin/page.tsx` + `FranchizeAdminClient.tsx`
- [x] **Currently shows**: fleet, failed orders, retry controls, review moderation, vehicle editing; added successful rental history with contract verifier status
- [x] **Enhancement**: add successful rents section
  - [x] Query `rentals` joined with vehicle data and `metadata.contract_verifier`
  - [x] Show rental history with doc verification status
  - [x] Display: bike name, renter, dates, contract status (verified/pending/none)
  - [x] Auto-refresh or live updates when new rents complete

---

### Task L: Hot-Stage QR Entry (Rent-in-Progress View)

> **Prerequisite**: investigation 1.7 (rental lifecycle) ✅, Task E (QR deep-link parsing)
> **Complexity**: M
> **Depends on**: Task E

> **Context**: Handoff photos are partially implemented — sending a photo to Telegram bot auto-assigns it as "before" or "after" depending on active rent state. But there's no way to enter the "hot stage" (rent in progress) web view without navigating manually.

- [ ] **Design**: QR scan should open rent-in-progress view directly (not just contract pre-fill)
- [ ] When user scans QR during active rental:
  - [ ] Open the rental detail page for that active rental (`/franchize/[slug]/rental/[id]`)
  - [ ] Show "handoff mode" — add damage photos, odometer, notes
  - [ ] No need to re-navigate or re-click anything
- [ ] This bridges the gap between paper handoff and digitized handoff
- [ ] Phase 1 finding: `FranchizeRentalDocumentsPanel` already has `saveRentalPickupFreeze` and `addRentalDamageReport` actions — hot-stage QR just needs to navigate there

---

## 📊 Task Dependency Graph

```
Task A (fix duplicate doc) ✅ ──→ Task B (QR alongside doc)
                                         │
Task C (secret table) ───────────────────┼──→ Task D (save renter data)
                                         │         │
                                         │         ├──→ Task E (QR deep-link auto-fill) ──→ Task L (hot-stage entry)
                                         │         │
                                         │         ├──→ Task F (previous rental picker)
                                         │         │
                                         │         └──→ Task G (profile page enhancement)

Independent: Task H ✅, Task I ✅, Task J (time picker), Task K (admin dashboard)
```

**Suggested execution order**: C → D → B → E → F → G → L | J, K can run in parallel

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
| LAYOUT-1 | No page breaks — doc prints "сплошняком" | **Fixed** ✅ — HTML template emits DOCX page-break markers before appendices | Task H |
| PRICE-1 | Explicit price in prompt ignored | **Deferred** — price override from prompt text needs more thought, could raise questions. Seed data fixed instead. | Not in scope |
| DATA-1 | Kawasaki daily price wrong | **Fixed** ✅ (dailyPrice=16000, price_per_hour=2000) | Done |
| DATA-2 | Missing blank handoff fields | **Fixed** ✅ — manual blanks added to Appendix 1 in HTML + MD | Task I |
| BUG | Duplicate DOCX delivery | **Fixed** ✅ — Telegram response parse errors no longer trigger resend fallback | Task A |

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
- `20260304_private_scheme.sql` — Existing private schema migration (pattern to follow)
- `crews_rows.csv` / `users_rows.csv` — Seed data with metadata JSONB structure
- `app/franchize/[slug]/admin/page.tsx` + `FranchizeAdminClient.tsx` — Admin dashboard
- `app/franchize/[slug]/profile/page.tsx` + `FranchizeProfileClient` — User profile

**Key search terms:**
- `private.crew_secrets` / `crew_secrets` — existing secret table pattern
- `private.user_secrets` / `user_secrets` — existing user secrets table
- `getUserSensitiveDataOrDefault` / `saveCrewSensitiveData` — secret access functions
- `startapp` / `startParam` / `start_param` — deep-link handling
- `contract_verifier` / `originalSha256` / `doc_verifier` — document verification
- `rental_contract_artifacts` — contract metadata table
- `franchize` / `franchise` — franchise-related code (both spellings exist!)
- `qr` / `qrcode` / `QR` — QR code generation (web method exists in repo)
- `sendMediaGroup` / `sendDocument` — Telegram bot API delivery methods
