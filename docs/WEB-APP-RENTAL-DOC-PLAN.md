# Web App Rental Doc Pipeline — Iteration Plan

> **Created:** 2026-07-11
> **Updated:** 2026-07-11 (Phase 3 + audit shipped)
> **Status:** Phase 1 + Phase 2 + Phase 3 + Phase 5 (audit) complete
> **Owner:** fk-pasha-admin

---

## Phase 1: Critical Fixes ✅ SHIPPED (2026-07-11)

### 1.1 Power cap 3kW for electric bikes ✅
- **Problem:** `bike_engine_spec_line_1` showed raw power (e.g. "17 кВт" for Falcon GT) instead of legally-capped 3kW
- **Fix:** Added 3kW cap in `getEngineSpecLines()` in both builders
- **Files:** `app/franchize/lib/rental-contract-vars.ts`, `app/lib/rental-contract-vars.ts`

### 1.2 Charger pricing 500→0 ✅
- **Problem:** Charger was priced at 500₽ in shared builder and CLI script, but should be free (tracked for return only)
- **Fix:** Changed `(eq.charger ? 500 : 0)` → `0` in 3 files

### 1.3 Crew secrets loading (empty doc fields) ✅
- **Problem:** Web app docs showed "Franchize" as org name, empty OGRNIP/INN/bank details
- **Root cause:** `contract_defaults` is FLAT JSON, code looked for nested `defaults` key → always `{}`
- **Fix:** Read flat structure directly + `readFirst()` helper for camelCase/snake_case keys

### 1.4 Template selection (SALE vs RENTAL) ✅
- **Problem:** Web app generated SALE contract for rental flow → empty fields
- **Fix:** Always use RENTAL template for web app flow

### 1.5 Doc naming ✅
- **Fix:** `rental-{make}-{model}-{date}.docx` (human-readable)

### 1.6 Contract number format ✅
- **Fix:** `11.7/bike-id` (matches /doc command format)

### 1.7 XTR removal ✅
- **Fix:** Removed `telegram_xtr` payment option, all XTR amount references

---

## Phase 2: Leads, Todos & Variable Alignment ✅ SHIPPED (2026-07-11)

### 2.1 Lead creation after doc generation ✅
- **Status:** Already existed in web app flow (line 2591-2617 in actions-runtime.ts)
- **Enhancement:** Updated to include ALL bike IDs/names in metadata (not just first bike)
- **Design:** ONE lead per order (same person), even with multiple bikes
- **Pattern:** `upsertFranchizeLead()` with `stage: "contract_generated"`, `contactChannel: "web_cart"`

### 2.2 Crew todos for equipment return ✅ NEW
- **Problem:** Web app flow did NOT create any crew_todos after doc generation (unlike /doc-manual)
- **Fix:** Added crew_todos creation after lead creation, following doc-manual.ts pattern
- **Design:** Todos are PER BIKE — each bike has its own equipment to return
  - One lead per order, many todos (per bike × per equipment item)
  - Example: 2 bikes with helmet+charger each = ~12 todos (5 base + 2 equipment per bike)
- **Todo structure:**
  - `id`: `todo-{timestamp36}-{index}-{random3}`
  - `crew_id`: vip-bike crew ID
  - `category`: `"lead_followup"`
  - `description`: JSON with `lead_id`, `lead_phone`, `lead_name`, `bike_id`, `order_id`, `source: "web_app_checkout"`
  - `assigned_to`: Telegram user ID (operator who created the order)
- **Base todos per bike:**
  - 🔧 Проверить ТС при возврате (high)
  - 🔑 Принять ключи (high)
  - 📄 Проверить документы (medium)
  - 🔍 Осмотр на повреждения (high)
- **Equipment todos per bike (conditional):**
  - 🪖 Принять N шлем(а/ов) (medium)
  - 🧤 Принять перчатки (low)
  - 🧥 Принять куртку (low)
  - 👢 Принять боты (low)
  - 🌐 Принять сетку (low)
  - 🎒 Принять рюкзак (low)
  - 👜 Принять сумку (low)
  - 🔌 Принять зарядное устройство (medium)

### 2.3 Equipment data passthrough ✅ (already implemented)
- **Status:** Equipment parsing from cart perk string was already in place (lines 2222-2239)
- **Verified:** `equipment` object is passed to `buildRentalContractVariables()` (line 2301)
- **Result:** `equipment_summary`, `equipment_total_cost`, and individual items appear in the doc

### 2.4 Payment split (cash/bank) ✅ (already implemented)
- **Status:** Payment split based on user-selected method was already in place (lines 2241-2250)
- **Logic:**
  - `cash` → cashAmount = total + deposit, bankAmount = 0
  - `card`/`sbp` → cashAmount = deposit, bankAmount = total
- **Verified:** `paymentSplit` is passed to `buildRentalContractVariables()` (line 2303)

### 2.5 Rental period display ✅ (already implemented)
- **Status:** `rentStartDate`/`rentEndDate` from cart line options properly passed (lines 2275-2284)
- **Time fields:** `rentStartTime`/`rentEndTime` read from cart line options (not hardcoded "12:00")

### 2.6 Pricing tier alignment ✅ (partially implemented)
- **Status:** `priceBreakdown` from cart line passed to builder (line 2299)
- **Note:** Cart uses hour-aware pricing calculator; contract builder uses it when available

---

## Phase 3: Multi-Bike Cart Polish ✅ SHIPPED (2026-07-11)

### 3.1 Per-bike pricing ✅
- **Fix:** Use `line.lineTotal` instead of `payload.totalAmount` for each bike's contract
- Same fix for `subtotal_rub` — each bike shows its own price

### 3.2 Per-bike equipment ✅
- **Status:** Already implemented — equipment parsed per cart line perk string

### 3.3 Sequential contract numbers ✅
- **Fix:** Multi-bike: `11.7/falcon-pro-2025-1`, `11.7/rerode-r1-plus-2`
- Single bike: `11.7/falcon-pro-2025` (no suffix, matches /doc format)

### 3.4 Equipment display fix ✅
- **Problem:** `equipment: "—"` override was killing the shared builder's `equipment_summary`
- **Fix:** Removed the override — equipment now shows correctly in quick-info box

### 3.5 /doc-manual sale power cap ✅
- **Fix:** Applied 3kW cap to `bike_power_kw` in sale contract path (was missing)

---

## Phase 4: Remaining Gaps (future)

### 4.1 Odometer reading
- **Problem:** `odometer_before` is always 0 in web app docs
- **Fix:** Add odometer input field on order page (or use bike's current mileage from specs)
- **Priority:** Low — operators fill this at handoff

### 4.2 Sale contract support
- **Problem:** Web app has no sale contract builder — always uses rental template
- **Fix:** Create `buildSaleContractVariables()` call path for `flowType="sale"`
- **Priority:** Low — sales are handled by /doc command

### 4.3 VLM /doc flow gaps
- **Problem:** `doc.ts` (VLM/photo OCR flow) does NOT create leads or todos
- **Fix:** Add lead + todo creation to `generateAndSendContract()` in doc.ts
- **Priority:** Medium — VLM flow is fallback, manual flow is primary

### 4.4 STS pledge support in web app
- **Problem:** Web app doesn't support СТС-as-deposit (no input fields, no `stsPledge` passed to builder)
- **Impact:** Template `{{#if sts_collateral}}` blocks are skipped — regular deposit path shown
- **Priority:** Low — СТС pledge is rare, operators use /doc-manual for this

### 4.5 Email sending
- **Problem:** Email sending works in web app flow but not in /doc command
- **Fix:** Add email sending to doc-manual.ts after doc generation
- **Priority:** Medium

---

## Phase 5: Variable Coverage Audit ✅ COMPLETE (2026-07-11)

### Audit Results

**Template:** `docs/RENTAL_DEAL_TEMPLATE.html` — 85 unique mustache variables

| Category | Variables | Shared Builder | Web App Override | /doc-manual | Status |
|----------|-----------|---------------|-----------------|-------------|--------|
| **Contract header** | contract_number, day, month_num, year | ✅ | — | ✅ | ✅ Complete |
| **Renter identity** | renter_full_name, renter_birth_date, renter_phone, renter_email, renter_passport, renter_passport_issue_date, renter_registration, renter_driver_license | ✅ | renter_phone, renter_passport, renter_driver_license (re-resolved from rental secrets) | ✅ | ✅ Complete |
| **Bike identity** | bike_make, bike_model, bike_vin, bike_category, bike_color, bike_year | ✅ | — | ✅ | ✅ Complete |
| **Engine specs** | bike_engine_spec_line_1/2/3 | ✅ (3kW capped) | — | ✅ | ✅ Complete |
| **Vehicle type** | bike_vehicle_type_label/accusative/genitive | ✅ | — | ✅ | ✅ Complete |
| **Rental period** | rent_start_date/time, rent_end_date/time | ✅ | — | ✅ | ✅ Complete |
| **Pricing** | daily_price_rub, pricing_tier_price_rub, pricing_tier_unit, deposit_rub, subtotal_rub | ✅ | total_price_rub, subtotal_rub (per-bike lineTotal) | ✅ | ✅ Complete |
| **Equipment** | equipment_helmets/gloves/net/backpack/bag/charger, equipment_summary, equipment_total_cost | ✅ | — (removed "—" override) | ✅ | ✅ Complete |
| **Payment split** | payment_cash_rub, payment_bank_rub | ✅ | — (computed from payment method) | ✅ | ✅ Complete |
| **Odometer** | odometer_before | ✅ (default 0) | — | ✅ (from operator input) | ⚠️ Always 0 in web app |
| **Org/crew info** | organization_short, organization_representative, ogrnip, inn, bank_account/name/city/corr_account, legal_address, lessor_address, return_address, issuer_signatory | ✅ (from crew_secrets) | — | ✅ | ✅ Complete |
| **STS pledge** | sts_collateral, sts_series/number/issue_date, sts_vehicle_*, sts_owner_*, sts_pledge_return_days, sts_deposit_amount_skipped | ✅ (default empty) | — (not passed) | ✅ (full support) | ⚠️ Not supported in web app |
| **Damage/return** | damage_notes_at_delivery/return, damage_price_list, battery_level_start/end, media_links | ✅ (defaults) | media_links: "—" | ✅ | ✅ Complete |
| **Signatures** | signature_timestamp, signature_fingerprint, renter_signature | ✅ | — | ✅ | ✅ Complete |

### Summary
- **85 template variables** — all covered by the shared builder
- **0 critical gaps** — web app produces a complete rental contract
- **2 minor gaps:**
  - `odometer_before` always 0 (operator fills at handoff)
  - STS pledge not supported (feature gap, operators use /doc-manual)
- **Web app advantages over /doc-manual:**
  - Per-bike pricing in multi-bike orders
  - Sequential contract numbers
  - Automatic lead + todo creation

---

## Known Issues (backlog)

| # | Issue | Severity | Phase |
|---|-------|----------|-------|
| 1 | Odometer always 0 | Low | 4 |
| 2 | Sale contract not supported in web app | Low | 4 |
| 3 | VLM /doc flow doesn't create leads/todos | Medium | 4 |
| 4 | STS pledge not supported in web app | Low | 4 |
| 5 | Email not sent with /doc command | Medium | 4 |
| 6 | `lead_id` column in crew_todos not populated (stored in JSON description instead) | Low | 4 |

---

## Architecture Notes

### Data flow (web app rental — post Phase 2)
```
CartPageClient → handleProceed() → router.push(/order/{id})
  ↓
OrderPageClient → onSubmitValid() → createFranchizeOrderCheckout()
  ↓
actions-runtime.ts:
  1. Validate payload (franchizeOrderInvoiceSchema)
  2. Rate limit
  3. Resolve total (check promo, etc.)
  4. buildFranchizeOrderDocAndNotify():
     a. Load cars from Supabase
     b. Load crew secrets (crew_secrets table) ← FIXED (Phase 1)
     c. Load user sensitive data (users table)
     d. Load verified rental secrets (user_rental_secrets)
     e. For each bike:
        - Parse equipment from perk string ← ALREADY WORKING
        - Build payment split from payment method ← ALREADY WORKING
        - Build variables via buildRentalContractVariables()
        - Generate DOCX via buildFranchizeDocxFromTemplate()
     f. Send docs via Telegram
     g. Save to rental_contract_artifacts
     h. Create rentals rows
     i. Create ONE lead in franchize_intents ← ENHANCED (Phase 2)
     j. Create crew_todos PER BIKE ← NEW (Phase 2)
```

### Lead vs Todo relationship
```
Order (1 person, N bikes)
  ├── 1 lead (franchize_intents)
  │     └── metadata: { bikeIds: [...], bikeNames: [...], bikeCount: N }
  │
  └── N × M todos (crew_todos)
        ├── Bike 1: 5 base + equipment todos
        ├── Bike 2: 5 base + equipment todos
        └── ...
        Each todo.description JSON contains:
          { lead_id, bike_id, order_id, source: "web_app_checkout" }
```

### Key files
| File | Role |
|------|------|
| `app/franchize/actions-runtime.ts` | Server action: checkout + doc generation + leads + todos |
| `app/lib/rental-contract-vars.ts` | Shared variable builder (ONE TRUE SOURCE) |
| `app/franchize/lib/rental-contract-vars.ts` | Franchize-specific builder (delegates to shared) |
| `app/franchize/lib/docx-capability.ts` | DOCX generation pipeline |
| `app/franchize/lib/leads.ts` | `upsertFranchizeLead()` — lead creation helper |
| `app/franchize/server-actions/intents.ts` | `upsertFranchizeIntent()` — intent CRUD |
| `docs/RENTAL_DEAL_TEMPLATE.html` | Rental contract template (440 lines) |
| `lib/private-secrets.ts` | Crew secrets CRUD (crew_secrets table) |
| `app/webhook-handlers/commands/doc-manual.ts` | /doc command (reference implementation) |
