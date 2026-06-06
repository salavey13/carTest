# /doc Command Enhancement Plan
> Prepared: 2026-06-06 | Status: DRAFT (awaiting operator approval)

## Current State (v1 — Rent-Only)

### What works
- 4-state machine: `doc_awaiting_bike` → `doc_awaiting_passport` → `doc_awaiting_license` → `doc_awaiting_schedule`
- VLM extraction via ZAI SDK for passport + license
- Bike selection via ReplyKeyboard (tier emoji indicators)
- Schedule input via free-text ("с завтра 18:00 до завтра 10:00")
- DOCX generation via `buildFranchizeDocxFromTemplate()` (HTML template → cheerio → docx)
- Telegram delivery + rental secrets persistence
- Admin notification

### Critical gaps
1. **NO SALE FLOW** — `/doc` only generates rental contracts
2. **NO deal type selection** — rent is hardcoded
3. **Schedule is free-text** — error-prone, no validation
4. **Passport page 2 (прописка)** — only 1 passport photo processed, but sale needs page 2 for registration address
5. **Address extraction** — VLM prompt doesn't handle Russian cursive on passport page 2
6. **No InlineKeyboard for bike selection** — ReplyKeyboard is clunky, no pagination
7. **No date picker** — Telegram WebApp Calendar or InlineKeyboard date grid
8. **`generateAndSendContract()` doesn't use `make-deal-contract-skill.mjs`** — duplicated logic
9. **No `sale_contract_artifacts` table** — metadata not persisted for sales
10. **No retry/edit flow** — if VLM misreads a field, user must restart

---

## Enhancement Roadmap

### Phase 1: Sale Flow + Deal Type Toggle (HIGH PRIORITY)
**Goal:** `/doc` supports both rent AND sale contracts end-to-end

#### 1.1 New states in state machine
```
Current:  doc_awaiting_bike → doc_awaiting_passport → doc_awaiting_license → doc_awaiting_schedule
Enhanced: doc_awaiting_bike → doc_awaiting_deal_type → doc_awaiting_passport → 
doc_awaiting_passport_page2 → doc_awaiting_address_confirm
          [IF RENT: doc_awaiting_license → doc_awaiting_schedule]
          [IF SALE: ]
```

New states:
- `doc_awaiting_deal_type` — InlineKeyboard: "📋 Аренда" / "🛒 Покупка"
- `doc_awaiting_passport_page2` — sale/rent: request second passport photo (прописка)
- `doc_awaiting_address_confirm` — sale/re nt: show extracted address, ask to confirm or type correct one

#### 1.2 DocFlowContext additions
```typescript
interface DocFlowContext {
  bikeId: string;
  bikeMake?: string;
  bikeModel?: string;
  dealType?: "rent" | "sale";           // NEW
  passportData?: Record<string, string>;
  passportPage2Data?: Record<string, string>; // NEW — registration address from page 2
  licenseData?: Record<string, string>;
  categories?: string[];
  accessTier?: AccessTier;
  extractionProvider?: "zai-vlm";
  buyerAddressOverride?: string;         // NEW — manual address correction
}
```

#### 1.3 Sale contract generation
- Use `SALE_DEAL_TEMPLATE.html` (already fixed, exact match of original DOCX)
- Build sale-specific vars: `contract_day`, `contract_month_genitive`, `price_digits`, `price_words`, `product_name`, `buyer_*`, `seller_address`, etc.
- Use the same `buildFranchizeDocxFromTemplate()` pipeline but with `templatePath: "sale"` parameter
- Save to `sale_contract_artifacts` table (migration needed)

#### 1.4 Sale flow: passport only (NO license)
- Sale requires 2 passport photos (page 1 + page 2 with прописка)
- License photo step is SKIPPED for sale
- Registration address extracted from passport page 2
- If VLM yields only city-level address (cursive handwriting issue), show:
  ```
  ⚠️ Не удалось точно распознать адрес регистрации.
  Укажите полный адрес:
  г. Нижний Новгород, ул. ___, д. ___, кв. ___
  ```
- User types full address → stored as `buyerAddressOverride` → passed to template

#### 1.5 Implementation: `generateAndSendSaleContract()`
New function parallel to `generateAndSendContract()`:
```typescript
async function generateAndSendSaleContract(
  chatId: number,
  userId: string,
  context: DocFlowContext,
): Promise<boolean>
```
- Builds sale vars matching `SALE_DEAL_TEMPLATE.html` placeholders exactly
- Calls `buildFranchizeDocxFromTemplate(vars, "html", "sale")` (needs docx-capability.ts update to support sale template path)
- Sends DOCX via Telegram
- Saves metadata to `sale_contract_artifacts`
- Shows sale-specific summary (price, warranty, VIN)

---

### Phase 2: Smart Bike Selection (MEDIUM PRIORITY)
**Goal:** Replace clunky ReplyKeyboard with InlineKeyboard + pagination

#### 2.1 InlineKeyboard bike selection
- Show bikes as InlineKeyboard with callback data: `doc:bike:<bikeId>`
- Each button: `🔴 Ducati Panigale V4 Electro` (tier emoji + make + model)
- Pagination: `doc:bikes:page:2` for >5 bikes
- "🔍 Ввести вручную" button at bottom

#### 2.2 Callback query handler
- In `command-handler.ts`, route `callback_query.data` starting with `doc:` to `handleDocCallback()`
- New function in `doc.ts`: `handleDocCallback(callbackQuery)`
- Handles: `doc:bike:<id>`, `doc:bikes:page:<n>`, `doc:deal:rent`, `doc:deal:sale`

#### 2.3 Sale/rent toggle via InlineKeyboard
After bike selection, show:
```
Выберите тип договора:
[📋 Аренда]  [🛒 Покупка]
```
Callback: `doc:deal:rent` / `doc:deal:sale`

---

### Phase 3: Date & Schedule UX (MEDIUM PRIORITY)
**Goal:** Structured date input instead of free-text

#### 3.1 Option A: Telegram WebApp Calendar (preferred)
- Launch mini-app with calendar widget
- User picks start date + end date
- Returns dates as callback: `doc:schedule:start:15.06.2026:end:16.06.2026`
- Times: InlineKeyboard "18:00 → 10:00 (1 сутки)" / "10:00 → 20:00 (полдня)"

#### 3.2 Option B: InlineKeyboard Date Grid (simpler, no WebApp)
- Show current month as grid: `doc:date:start:15.06.2026`
- Then show end date grid
- Then time selection keyboard

#### 3.3 Schedule parser enhancement
- Keep `extractScheduleFromPhrase()` as fallback for free-text
- Add structured schedule builder from callback data
- Validate: end date > start date, reasonable duration

---

### Phase 4: VLM Enhancement (MEDIUM PRIORITY)
**Goal:** Better OCR accuracy, especially for passport page 2

#### 4.1 Passport page 2 prompt (NEW)
```typescript
const PASSPORT_PAGE2_SYSTEM_PROMPT = `You are extracting the REGISTRATION ADDRESS from the second page of a Russian passport (страница с пропиской).
Russian passports may have MULTIPLE stamped addresses — extract ONLY the LAST one (most recent).
If the address is handwritten in Russian cursive, do your best to read it.
Return ONLY valid JSON:
{
  "registration": "Full address: city, street, house, apartment",
  "registrationCity": "City name only",
  "registrationIncomplete": true/false,
  "confidence": 0.0,
  "warnings": []
}
If any part of the address is unreadable, set registrationIncomplete=true and note it in warnings.`;
```

#### 4.2 Two-pass passport extraction
- Photo 1: main page → fullName, birthDate, series, number, issuedBy, issueDate
- Photo 2: registration page → registration address (sale only)
- Merge into combined passportData object

#### 4.3 Confidence threshold + retry
- If VLM confidence < 0.6, auto-ask for retake
- Show extracted data with "✅ Подтвердить" / "🔄 Переснять" buttons
- If user confirms with wrong data, they can edit individual fields (future enhancement)

---

### Phase 5: Contract Generation Pipeline Unification (LOWER PRIORITY)
**Goal:** Eliminate duplicated logic between `doc.ts` and `make-deal-contract-skill.mjs`

#### 5.1 Shared vars builder
Extract bike-to-vars mapping into a shared module:
```typescript
// lib/contract-vars-builder.ts
export function buildRentVars(bike, passport, license, schedule): Record<string, string>
export function buildSaleVars(bike, passport, registration): Record<string, string>
```

Both `doc.ts` and `make-deal-contract-skill.mjs` would call these functions.

#### 5.2 Template-aware docx generation
Update `buildFranchizeDocxFromTemplate()` to accept deal type:
```typescript
buildFranchizeDocxFromTemplate(vars, "html", dealType: "rent" | "sale")
```
- Rent → `RENTAL_DEAL_TEMPLATE.html`
- Sale → `SALE_DEAL_TEMPLATE.html`

#### 5.3 Metadata persistence abstraction
```typescript
// lib/contract-metadata.ts
export async function persistContractMetadata(dealType, payload)
```
- Rent → `rental_contract_artifacts`
- Sale → `sale_contract_artifacts`

---

### Phase 6: Polish & Edge Cases (ONGOING)
- Double notification bug fix in `codex-notify.mjs`
- Contract document preview (show template fields before generating)
- Edit flow: "✏️ Изменить данные" after extraction
- Re-booking flow: "📋 Повторить аренду" using saved rental secrets
- Multi-language support (currently RU-only, fine for VIP Bike)

---

## Files to Create/Modify

### New files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260607000000_create_sale_contract_artifacts.sql` | Sale artifacts table |
| `app/lib/contract-vars-builder.ts` | Shared vars builder |
| `app/lib/contract-metadata.ts` | Metadata persistence abstraction |

### Modified files
| File | Changes |
|------|---------|
| `app/webhook-handlers/commands/doc.ts` | Sale flow, deal type toggle, passport page 2, address confirm, InlineKeyboard, callback handler |
| `app/webhook-handlers/commands/command-handler.ts` | Route `doc:` callbacks |
| `app/lib/vlm-extract.ts` | Add passport page 2 prompt, two-pass extraction |
| `app/franchize/lib/docx-capability.ts` | Support sale template path |
| `skills/deal-contract-from-photos/SKILL.md` | Update with /doc inline flow documentation |

### Dependencies
- ZAI API key (incoming) — required for VLM calls
- `sale_contract_artifacts` migration — must run before deploying sale flow
- `user_states` migration — already created

---

## Estimated Effort

| Phase | Complexity | Dependencies |
|-------|-----------|--------------|
| Phase 1: Sale Flow | HIGH | Sale template (done), migration, VLM page 2 prompt |
| Phase 2: InlineKeyboard | MEDIUM | Callback query routing |
| Phase 3: Date Picker | MEDIUM | WebApp or InlineKeyboard grid |
| Phase 4: VLM Enhancement | MEDIUM | ZAI API key |
| Phase 5: Unification | LOW | Phases 1-2 complete |
| Phase 6: Polish | ONGOING | All phases |

**Recommended order:** Phase 1 → Phase 2 → Phase 4 → Phase 3 → Phase 5 → Phase 6

Phase 1 is the highest value — it enables the primary revenue stream (sale contracts).
