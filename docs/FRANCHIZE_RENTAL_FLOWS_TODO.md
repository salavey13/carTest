# TODO: franchize rental/order document flow alignment

Updated: 2026-06-18

## Status

**Completed:** Cart date storage, Russian labels, Filter rail, Loading improvements
**Remaining:** 3 tasks

---

## Remaining Tasks

### Task #1: Remove QR generation from web app order flow

**Why:** Web app users are already defined (unlike `/doc` flow). Owner approval subflow exists instead of QR for repeat rental.

**Location:** `app/franchize/actions-runtime.ts:buildFranchizeOrderDocAndNotify()`

**What to fix:**
- Lines 2000-2014 generate QR deep-link PNG and send it
- Remove QR generation for web flow
- Keep DOCX-only delivery for web app
- `/doc` flow should still generate QR (that's its purpose)

**Files:**
- `app/franchize/actions-runtime.ts` (lines 2000-2014, 2024-2038)

---

### Task #2: Extract shared rental contract variable builder

**Why:** Each flow builds variables independently → risk of different DOCX output. Need one canonical builder.

**Current state:**
- `/doc` flow: `app/webhook-handlers/commands/doc-manual.ts` lines 920-1065 (strongest impl)
- OCR skill: `scripts/make-deal-contract-skill.mjs` lines 531-714
- Web app: `app/franchize/actions-runtime.ts` lines 1877-1953

**What to do:**
1. Extract `buildRentalContractVariables()` from `/doc` as the canonical builder
2. Update OCR skill to use shared builder
3. Update web app to use shared builder
4. Regression test: same bike/renter/dates → same DOCX across all flows

**Note:** `/doc` builder is the reference - it has full manual input, СТС pledge support, proper date/time handling.

---

### Task #3: Design multi-bike document generation

**Why:** Current: only first bike's data used for document. Multi-bike carts exist but docs don't reflect it.

**Current behavior:**
- Cart can contain multiple bikes
- `buildFranchizeOrderDocAndNotify()` uses `firstCar` and `firstSpecs`
- Only one DOCX generated with first bike's data

**Options:**
1. **One DOCX per bike** - Generate separate DOCX for each bike in cart
2. **Appendix table** - Single DOCX with table of all bikes
3. **Block multi-bike** - Prevent adding >1 bike to cart for rental flow

**Recommendation:** Start with option 1 (one DOCX per bike) - cleanest separation.

**Location:** `app/franchize/actions-runtime.ts:buildFranchizeOrderDocAndNotify()`

---

## Completed ✅

- **Cart date storage** - Fixed in commit `fa171d5c`
  - Added `rentStartDate`/`rentEndDate` to `FranchizeCartOptions`
  - Dates persist from modal → cart → order form

- **Russian labels** - Fixed in commit `705499fd`
  - Uses `spec_labels` from CSV
  - Priority specs: power, top_speed, engine, range, acceleration, torque, weight, capacity

- **Filter rail & header** - Fixed in commit `705499fd`
  - "partners" → "Байки партнёров"

- **Loading improvements** - Fixed in commit `705499fd`
  - Removed dits/particles, clean radial glow
  - Added `/loading-test` for filter testing

---

## Flow Reference

### `/doc` manual command (Telegram)
- Lines 920-1065 in `doc-manual.ts`
- Full manual input, СТС pledge support
- QR + DOCX delivery

### OCR contract skill
- Lines 531-714 in `make-deal-contract-skill.mjs`
- OCR data from passport/license
- QR + DOCX delivery

### Franchize web app
- Lines 1877-1953 in `actions-runtime.ts`
- 3-tier renter priority (secrets > profile > placeholder)
- Currently: QR + DOCX (should be DOCX only)
