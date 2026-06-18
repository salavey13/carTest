# TODO: franchize rental/order document flow alignment

Generated: 2026-06-18
Updated: Refined understanding after code investigation

## Scope

Three rental/document flows compared:
1. **Telegram `/doc` manual command** - `app/webhook-handlers/commands/doc-manual.ts`
2. **OCR contract skill** - `scripts/make-deal-contract-skill.mjs` 
3. **Franchize web app order flow** - `app/franchize/actions-runtime.ts`

## Completed ✅

- **Russian spec labels in catalog modal** - Fixed in `actions-runtime.ts:getFranchizeBySlug()`
  - Now uses `specs.spec_labels` from CSV for Russian translations
  - Fallback to underscore-to-space if no translation exists

## Current flow map

### 1. `/doc` manual command (Telegram)

**Variable builder:** Lines 920-1065 in `doc-manual.ts`
- Full manual renter input: name, passport, birth, address, license, categories
- Dates: start/end **with times** (line 21-22)
- Deposit: supports confirm, override, or СТС pledge (lines 1040-1052)
- QR: Generates and sends DOCX + QR media group (lines 1107-1120)
- Rental row: Creates rental + saves user_rental_secrets (lines 1167-1179)

### 2. OCR contract skill

**Variable builder:** Lines 531-714 in `make-deal-contract-skill.mjs`
- Renter data from OCR JSON (passport/license)
- Dates: parsed from phrase or CLI args **with times**
- Deposit: bike.specs defaults, СТС pledge supported (lines 677-689)
- QR: Generates and sends DOCX + QR
- Rental row: Can create rental rows

### 3. Franchize web app order flow

**Variable builder:** Lines 1877-1953 in `actions-runtime.ts:buildFranchizeOrderDocAndNotify()`
- Renter: 3-tier priority (rental secrets > userSensitive > placeholder)
- Dates: **TIMES HARDCODED to "12:00"** ❌ (lines 1917-1919)
- Deposit: crew defaults only, no СТС pledge support ❌
- QR: Generates and sends DOCX + QR (lines 2000-2014) - should be removed for web flow
- **BUG FOUND:** `rentStartDate`/`rentEndDate` from modal not stored in cart! ❌
  - Modal collects dates in `selectedOptions`
  - But `FranchizeCartOptions` type doesn't include date fields
  - Dates lost during `addItem()` call

## Issues to fix

### P0 — Critical

**1. Cart date storage bug**
- Location: `app/franchize/hooks/useFranchizeCart.ts`
- Fix: Add `rentStartDate`/`rentEndDate` to `FranchizeCartOptions` type
- Update: `DEFAULT_OPTIONS`, `sanitizeCartState`, `areLineOptionsEqual`
- Status: Ready to implement

**2. QR policy for web app**
- Web app users are already defined (unlike /doc flow)
- Owner approval subflow exists instead of QR for repeat rental
- Remove QR generation from `buildFranchizeOrderDocAndNotify()` (lines 2000-2014)
- Keep DOCX-only delivery for web app

**3. Date/time parity**
- Web app hardcodes times to "12:00" (lines 1917-1919)
- After fixing #1, use actual dates from payload
- Consider: add time inputs vs default to opening hours (10:00-20:00?)

**4. One canonical document variable builder**
- Each flow builds variables independently - risk of different DOCX output
- Extract shared `buildRentalContractVariables()` from `/doc` (strongest impl)
- All flows should call shared builder
- Regression test: same bike/renter/dates → same DOCX across all flows

### P1 — Important

**5. Deposit/STS pledge parity**
- Web cart: crew defaults only, no СТС support
- Add СТС pledge fields to web checkout

**6. Rental row / artifact linkage**
- Web order attaches metadata only if rental row found by `orderId`
- Verify checkout always creates rental row before document generation

**7. Identity data completeness**
- Web uses placeholders ("указывается при выдаче")
- Add preflight checklist showing verified vs placeholder fields

### P2 — Nice to have

**8. Multi-bike cart semantics**
- Current: only first bike's data used for document
- Feature: support multiple bikes in single order
- Options: block multi-bike, one DOCX per bike, or appendix table

**9. Price parity**
- Web uses cart subtotal + bike.dailyPrice + crew defaults
- Ensure DOCX fields match invoice totals and bike specs

## Implementation sequence

1. ✅ Fix cart date storage (Task #1)
2. Remove QR from web app (Task #3)
3. Extract shared variable builder (Task #4)
4. Add time inputs or document defaults (Task #3 continued)
5. Add СТС pledge to web checkout (Task #5)
6. Multi-bike document generation design (Task #2)

## Test plan

After fixes:
1. Add item to cart with dates → verify dates persist
2. Checkout → verify document uses cart dates
3. Verify QR not sent in web flow
4. Compare DOCX variables across /doc, skill, web for same bike/renter
