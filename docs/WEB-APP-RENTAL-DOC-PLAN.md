# Web App Rental Doc Pipeline — Iteration Plan

> **Created:** 2026-07-11
> **Status:** Phase 1 complete (critical fixes shipped)
> **Owner:** fk-pasha-admin

---

## Phase 1: Critical Fixes ✅ SHIPPED (2026-07-11)

### 1.1 Power cap 3kW for electric bikes
- **Problem:** `bike_engine_spec_line_1` showed raw power (e.g. "17 кВт" for Falcon GT) instead of legally-capped 3kW
- **Fix:** Added 3kW cap in `getEngineSpecLines()` in both builders:
  - `app/franchize/lib/rental-contract-vars.ts`
  - `app/lib/rental-contract-vars.ts`
- **Status:** ✅ Shipped

### 1.2 Charger pricing 500→0
- **Problem:** Charger was priced at 500₽ in shared builder and CLI script, but should be free (tracked for return only)
- **Fix:** Changed `(eq.charger ? 500 : 0)` → `0` in:
  - `app/lib/rental-contract-vars.ts` (equipmentCostTotal)
  - `scripts/make-rental-contract-skill.mjs` (3 occurrences)
- **Status:** ✅ Shipped

### 1.3 Crew secrets loading (empty doc fields)
- **Problem:** Web app docs showed "Franchize" as org name, empty OGRNIP/INN/bank details
- **Root cause:** `contract_defaults` in `crew_secrets` is FLAT JSON, but code looked for nested `defaults` key → always `{}`
- **Fix:** 
  - Read `contractDefaults` directly (not `contractDefaults.defaults`)
  - Added `readFirst()` helper that tries both camelCase and snake_case keys
  - Fallback values match vip-bike hydration SQL data
- **Status:** ✅ Shipped

### 1.4 Template selection (SALE vs RENTAL)
- **Problem:** Web app generated SALE contract (КУПЛИ-ПРОДАЖИ) for rental flow → empty fields
- **Root cause:** `flowType="sale"` loaded SALE template but filled with rental variables (renter_* vs buyer_*)
- **Fix:** Always use RENTAL template for web app flow (templateFlowType = "rental")
- **Status:** ✅ Shipped

### 1.5 Doc naming
- **Problem:** `franchize-order-vip-bike-order-mrg7100y-vm03kn-bike0.docx` (gibberish)
- **Fix:** `rental-Rerode-R1+-2026-07-11.docx` (human-readable)
- **Status:** ✅ Shipped

### 1.6 Contract number format
- **Problem:** `VIP-BIKE-ORDER-MRG7100Y-VM03KN-2` (gibberish)
- **Fix:** `11.7/rerode-r1-plus` (matches /doc command format)
- **Status:** ✅ Shipped

### 1.7 XTR removal
- **Problem:** Order page showed "500 XTR" mentions, Telegram Stars payment option
- **Fix:** Removed `telegram_xtr` payment option, all XTR amount references, simplified submit label/hint
- **Status:** ✅ Shipped

---

## Phase 2: Variable Alignment (next iteration)

### 2.1 Equipment data passthrough
- **Problem:** Web app cart tracks extras (helmet, gloves, charger, etc.) but they may not reach the contract builder
- **Investigate:** How `payload.extras` maps to `options.equipment` in `buildRentalContractVariables()`
- **Files:** `actions-runtime.ts` (buildFranchizeOrderDocAndNotify), `rental-contract-vars.ts`
- **Expected:** Equipment summary, equipment cost, and individual items should appear in the doc

### 2.2 Payment split (cash/bank)
- **Problem:** Web app asks for payment method (cash/card/sbp) but contract shows hardcoded split
- **Fix:** Map `payload.payment` to `options.paymentSplit`:
  - `cash` → cashAmount = total, bankAmount = 0
  - `card`/`sbp` → cashAmount = deposit, bankAmount = total - deposit
- **Files:** `actions-runtime.ts` (variable building section)

### 2.3 Odometer reading
- **Problem:** `odometer_before` is always 0 in web app docs
- **Fix:** Add odometer input field on order page (or use bike's current mileage from specs)
- **Priority:** Low — operators fill this at handoff

### 2.4 Rental period display
- **Problem:** Period might show wrong format or empty if dates aren't set
- **Fix:** Ensure `rentStartDate`/`rentEndDate` from cart line options are properly passed to builder
- **Verify:** `rent_start_date`, `rent_start_time`, `rent_end_date`, `rent_end_time` in output

### 2.5 Pricing tier alignment
- **Problem:** Cart uses pricing calculator (hour-aware) but contract might use day-rate
- **Fix:** Pass `priceBreakdown` from cart line to contract builder
- **Status:** Partially done (line 2245 passes priceBreakdown) — verify it's used correctly

---

## Phase 3: Multi-Bike Cart Polish

### 3.1 Per-bike pricing
- **Problem:** All bikes share the same `totalAmount` in the payload
- **Fix:** Calculate per-bike totals from `line.lineTotal` and pass to each doc
- **Files:** `actions-runtime.ts` (bike loop section)

### 3.2 Per-bike equipment
- **Problem:** Equipment is shared across all bikes in cart
- **Fix:** Each bike should have its own equipment list (from cart line options)
- **Files:** Cart line options → equipment mapping

### 3.3 Sequential contract numbers
- **Problem:** All bikes get the same contract number (e.g. "11.7/rerode-r1-plus")
- **Fix:** Append bike index: "11.7/rerode-r1-plus-1", "11.7/falcon-pro-2025-2"
- **Priority:** Low — multi-bike rentals are rare

---

## Phase 4: Sale Contract Support (future)

### 4.1 Dedicated sale variable builder
- **Problem:** Web app has no sale contract builder — always uses rental
- **Fix:** Create `buildSaleContractVariables()` call path for `flowType="sale"`
- **Template:** SALE_DEAL_TEMPLATE.html
- **Variables:** `buyer_full_name`, `price_digits`, `price_words`, `product_color`, `product_vin`
- **Priority:** Low — sales are handled by /doc command

### 4.2 Sale-specific fields on order page
- **Problem:** Order page shows rental fields (passport, license) even for sale flow
- **Fix:** Conditionally show sale-specific fields (buyer name, delivery address)
- **Priority:** Low

---

## Phase 5: Testing & Validation

### 5.1 End-to-end test matrix
| Scenario | Template | Variables | Expected |
|----------|----------|-----------|----------|
| Single bike rental (web) | RENTAL | renter_*, bike_*, period_* | Full doc with all fields |
| Single bike rental (/doc) | RENTAL | Same | Full doc (reference) |
| Multi-bike rental (web) | RENTAL × N | Per-bike vars | N docs, each complete |
| Sale flow (web) | RENTAL (forced) | renter_* | Rental doc (not sale) |
| Testdrive (web) | TESTDRIVE | customer_* | Simple testdrive doc |

### 5.2 Variable coverage audit
- [ ] Compare /doc output vs web app output field-by-field
- [ ] List all mustache variables in RENTAL_DEAL_TEMPLATE.html
- [ ] Verify each variable is populated by both flows
- [ ] Flag any variables that are empty in web app but filled in /doc

### 5.3 Regression tests
- [ ] Power cap: all electric bikes show ≤3kW in engine spec line
- [ ] Charger: always 0₽ in equipment cost
- [ ] Crew secrets: OGRNIP, INN, bank details populated
- [ ] Doc naming: human-readable filename
- [ ] Contract number: DD.MM/bike-id format

---

## Known Issues (backlog)

| # | Issue | Severity | Phase |
|---|-------|----------|-------|
| 1 | Equipment data not reaching contract builder | High | 2 |
| 2 | Payment split hardcoded instead of user-selected | Medium | 2 |
| 3 | Odometer always 0 | Low | 2 |
| 4 | Multi-bike pricing shared | Medium | 3 |
| 5 | Sale contract not supported in web app | Low | 4 |
| 6 | Email not sent with web app docs | High | 2 |
| 7 | /doc-manual sale path doesn't cap power at 3kW | Medium | 2 |

---

## Architecture Notes

### Data flow (web app rental)
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
     b. Load crew secrets (crew_secrets table) ← FIXED
     c. Load user sensitive data (users table)
     d. Load verified rental secrets (user_rental_secrets)
     e. For each bike:
        - Build variables via buildRentalContractVariables()
        - Generate DOCX via buildFranchizeDocxFromTemplate()
     f. Send docs via Telegram
     g. Save to rental_contract_artifacts
     h. Create rentals rows
```

### Key files
| File | Role |
|------|------|
| `app/franchize/actions-runtime.ts` | Server action: checkout + doc generation |
| `app/lib/rental-contract-vars.ts` | Shared variable builder (ONE TRUE SOURCE) |
| `app/franchize/lib/rental-contract-vars.ts` | Franchize-specific builder (delegates to shared) |
| `app/franchize/lib/docx-capability.ts` | DOCX generation pipeline |
| `docs/RENTAL_DEAL_TEMPLATE.html` | Rental contract template (440 lines) |
| `docs/SALE_DEAL_TEMPLATE.html` | Sale contract template (282 lines) |
| `lib/private-secrets.ts` | Crew secrets CRUD (crew_secrets table) |
| `app/franchize/components/OrderPageClient.tsx` | Order page UI |
| `app/franchize/components/CartPageClient.tsx` | Cart page UI |
