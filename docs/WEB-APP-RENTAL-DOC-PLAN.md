# Web App Rental Doc Pipeline — Iteration Plan

> **Created:** 2026-07-11
> **Updated:** 2026-07-11 (Phase 2 shipped)
> **Status:** Phase 1 + Phase 2 complete
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

## Phase 3: Multi-Bike Cart Polish (next iteration)

### 3.1 Per-bike pricing
- **Problem:** All bikes share the same `totalAmount` in the payload
- **Fix:** Calculate per-bike totals from `line.lineTotal` and pass to each doc
- **Files:** `actions-runtime.ts` (bike loop section)
- **Note:** The `lineTotal` is already available per cart line — just needs to be used instead of `payload.totalAmount`

### 3.2 Per-bike equipment
- **Status:** ✅ Already implemented — equipment is parsed per cart line (line 2226-2239)
- Each bike's perk string is parsed independently

### 3.3 Sequential contract numbers
- **Problem:** All bikes get the same contract number (e.g. "11.7/rerode-r1-plus")
- **Fix:** Append bike index: "11.7/rerode-r1-plus-1", "11.7/falcon-pro-2025-2"
- **Priority:** Low — multi-bike rentals are rare

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

### 4.4 /doc-manual sale power cap
- **Problem:** Sale contract path in doc-manual.ts doesn't cap power at 3kW
- **Fix:** Apply same 3kW cap in sale variable building
- **Priority:** Low — sale contracts for electric bikes are rare

### 4.5 Email sending
- **Problem:** Email sending works in web app flow (lines 2619-2660) but not in /doc command
- **Fix:** Add email sending to doc-manual.ts after doc generation
- **Priority:** Medium

---

## Phase 5: Testing & Validation

### 5.1 End-to-end test matrix
| Scenario | Template | Lead? | Todos? | Expected |
|----------|----------|-------|--------|----------|
| Single bike rental (web) | RENTAL | ✅ 1 | ✅ ~5-12 | Full doc + lead + todos |
| Multi-bike rental (web) | RENTAL × N | ✅ 1 | ✅ N×5-12 | N docs, 1 lead, N×todos |
| Single bike rental (/doc-manual) | RENTAL | ✅ 1 | ✅ ~5-12 | Full doc (reference) |
| Sale flow (web) | RENTAL (forced) | ✅ 1 | ❌ | Rental doc (not sale) |
| Testdrive (web) | TESTDRIVE | ✅ 1 | ❌ | Simple testdrive doc |

### 5.2 Variable coverage audit
- [ ] Compare /doc output vs web app output field-by-field
- [ ] List all mustache variables in RENTAL_DEAL_TEMPLATE.html
- [ ] Verify each variable is populated by both flows
- [ ] Flag any variables that are empty in web app but filled in /doc

### 5.3 Regression tests
- [x] Power cap: all electric bikes show ≤3kW in engine spec line
- [x] Charger: always 0₽ in equipment cost
- [x] Crew secrets: OGRNIP, INN, bank details populated
- [x] Doc naming: human-readable filename
- [x] Contract number: DD.MM/bike-id format
- [x] Lead created after web app checkout
- [x] Todos created per bike for equipment return

---

## Known Issues (backlog)

| # | Issue | Severity | Phase |
|---|-------|----------|-------|
| 1 | Odometer always 0 | Low | 4 |
| 2 | Multi-bike pricing shared (totalAmount vs lineTotal) | Medium | 3 |
| 3 | Sale contract not supported in web app | Low | 4 |
| 4 | VLM /doc flow doesn't create leads/todos | Medium | 4 |
| 5 | /doc-manual sale path doesn't cap power at 3kW | Medium | 4 |
| 6 | Email not sent with /doc command | Medium | 4 |
| 7 | `equipment` override set to "—" (should show actual equipment) | Low | 3 |
| 8 | `lead_id` column in crew_todos not populated (stored in JSON description instead) | Low | 4 |

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
