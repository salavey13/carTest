# DOC-MANUAL COMMAND ENHANCEMENTS PRD

**Version:** 3.1 (Post-implementation audit — step numbering synced to shipped code, statuses updated)
**Date:** 2026-08-10 (audited 2026-08-11)
**Status:** ✅ Mostly Implemented (2026-08-10) — step numbering, step correction, deposit destination + split, sale delivery all shipped in `doc-manual.ts` + migration `20260810000020`. Remaining: analytics badges (§5), see meta plan.
**Applies to:** All crews via `/doc` command in Telegram bot
**Related:** `docs/DEPOSIT_TRACKING_PRD.md` (deposit destination step), `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md`, `docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md`
**Related Files:** `app/webhook-handlers/commands/doc-manual.ts` (4208 lines as of 2026-08-11), `app/webhook-handlers/actions/sendComplexMessage.ts`, `tests/franchize/doc-manual-steps.spec.ts`

---

## 1. EXECUTIVE SUMMARY

### 1.1 Current State (VERIFIED against actual code)

**File:** `app/webhook-handlers/commands/doc-manual.ts` (4208 lines as of 2026-08-11)

**Actual RENT flow** — ✅ SHIPPED, 16 numbered steps (+ 2 conditional split sub-states + optional СТС sub-flow). Source of truth: `RENT_STEPS` array at `doc-manual.ts:793`:
| # | State | What it asks |
|---|-------|-------------|
| 1 | `deal` | Rent or Sale? |
| 2 | `bike` | Which bike? |
| 3 | `name` | Full name (ФИО) |
| 4 | `passport` | Passport series + number + issue date + issued by |
| 5 | `birth` | Date of birth |
| 6 | `address` | Registration address |
| 7 | `has_license` | Has driver license? |
| 8 | `categories` | License categories (A, B, M) |
| 9 | `schedule_start` | Start date + time |
| 10 | `schedule_end` | End date + time |
| 11 | `equipment` | Helmets, gloves, jacket, etc. |
| 12 | `odometer` | Odometer reading |
| 13 | `payment_split` | Cash / bank / split |
| 14 | `deposit_choice` | Deposit amount or СТС |
| 15 | `deposit_destination` | Where collected? (cash/tbank/sber/split) |
| 15a | `deposit_split_cash` | (conditional) How much cash? (only if split chosen) |
| 15b | `deposit_split_card` | (conditional) Which card for remainder? (only if split) |
| 16 | `confirm` | Verify all data |

> ⚠️ **v3.1 correction — the `license` state exists but is UNNUMBERED.** The runtime state machine still has a `license` state (`doc-manual.ts:2809`, reached `has_license` → `license` → `categories`), but it was deliberately excluded from `RENT_STEPS` during simplification (locked in by `doc-manual-steps.spec.ts:86`). Consequences: (a) no "Шаг X/16" label is shown while entering license data; (b) license data is **not correctable** via step correction. Known trade-off — re-add to the array (making rent 17 steps) if operators ask to fix license typos. v3.0 incorrectly listed `license` as numbered step 8.

*If СТС chosen (step 14): skip steps 15/15a/15b, replaced by 6 СТС sub-steps: `sts_series` → `sts_plate` → `sts_owner` → `sts_relation` → `sts_vehicle` → `sts_vin` → `confirm`. СТС sub-steps are labelled `СТС-1`…`СТС-6` (bare label, no "Шаг" prefix — see §4).*

**Actual SALE flow** — ✅ SHIPPED, 13 steps. Source of truth: `SALE_STEPS` array at `doc-manual.ts:821`:
| # | State | What it asks |
|---|-------|-------------|
| 1 | `deal` | Rent or Sale? |
| 2 | `bike` | Which bike? |
| 3 | `name` | Full name (ФИО) |
| 4 | `passport` | Passport series + number + issue date + issued by |
| 5 | `birth` | Date of birth |
| 6 | `address` | Registration address |
| 7 | `sale_color` | Confirm or override bike color |
| 8 | `sale_vin` | Confirm, enter, or skip VIN |
| 9 | `price` | Sale price |
| 10 | `client_phone` | Buyer phone |
| 11 | `sale_delivery` | Delivery method |
| 12 | `sale_transport` | TC name (if TC selected) |
| 13 | `confirm` | Verify all data |

**Step counts (verified against code 2026-08-11):** RENT = 16 numbered (+15a/15b when split), SALE = 13. Step numbering is flow-specific. v3.0 said "RENT 17 / SALE 12" and its own history said "16 / 12" — both were wrong.

**State management (VERIFIED):**
- States are bare strings (no prefix)
- `setState(userId, state, context)` / `getState(userId)` / `clearState(userId)` persist to `user_states` (30-min TTL)
- `buildRentSummary` / `buildSaleSummary` already show structured verification data
- Confirm keyboard: `ok` / `restart` / `cancel`

**DocFlowContext fields (VERIFIED — camelCase):**
```
bikeId, bikeMake, bikeModel, dealType
mpFullName, mpSeries, mpNumber, mpIssueDate, mpIssuedBy, mpBirthDate, mpRegistration
mlFullName, mlSeries, mlNumber, mlIssueDate, mlExpiryDate, mlCategories, mlAccessTier
rentStartDate, rentStartTime, rentEndDate, rentEndTime
helmets, gloves, jacket, boots, net, backpack, bag, charger
odometerBefore
cashAmount, bankAmount
depositOverride, stsPledgeUsed, stsSeries, stsNumber, stsIssueDate,
stsVehiclePlate, stsVehicleVin, stsVehicleModel, stsVehicleYear,
stsOwnerFullName, stsOwnerRegistration, stsOwnerRelation, stsPledgeReturnDays,
depositAmountSkipped
saleColor, saleVin, saleVinSkipped, salePrice
clientPhone, clientPhoneResolved
```

**sendComplexMessage (VERIFIED):**
```typescript
sendComplexMessage(chatId, text, buttons, { keyboardType: 'inline', parseMode: 'HTML' })
```

### 1.2 Problem Statement

1. **No Step Correction:** On `confirm`, only `ok`/`restart`/`cancel`. Spot error in step 3 → must restart entire flow. ✅ GENUINE
2. **No Delivery Method for Sales:** Sale flow doesn't capture pickup vs TC delivery. ✅ GENUINE
3. **No Step Numbering:** No "Шаг 3/15" — operator doesn't know progress. ✅ GENUINE
4. **No Deposit Destination:** Deposit collected but WHERE (cash/card/which card) is not tracked. ✅ GENUINE (see DEPOSIT_TRACKING_PRD)

### 1.3 Proposed Enhancements (4 — draft recovery REMOVED per user feedback)

#### Enhancement #1: Step Numbering (flow-specific) — ✅ SHIPPED
- RENT steps: 16 numbered (14 questions + deposit_destination + confirm) + 15a/15b split sub-states + `СТС-1..6` sub-flow labels
- SALE steps: 13 (11 questions + sale_transport conditional + confirm)
- Show "Шаг 3/16" (rent) or "Шаг 3/13" (sale) in every question
- Use explicit step arrays (not computed) to avoid off-by-one errors — ✅ `RENT_STEPS`/`SALE_STEPS` at `doc-manual.ts:793/821`, locked by `tests/franchize/doc-manual-steps.spec.ts`

#### Enhancement #2: Step Correction — ✅ SHIPPED
- On `confirm`: add 4th button `🔢 Исправить шаг` — ✅ `doc-manual.ts:295` (`correct_step` callback, handler at :4097)
- Bot shows numbered list of steps (flow-specific) — ✅ `getVisibleSteps()` at `doc-manual.ts:865`
- User sends number → bot re-asks ONLY that step — ✅ `step_correction` state at `doc-manual.ts:3298`
- After correction → return to `confirm` (not next step)

#### Enhancement #3: Verification Enhancement
- `buildRentSummary`/`buildSaleSummary` already show data — enhance with HTML formatting

#### Enhancement #4: Delivery Method Step (Sale only) — ✅ SHIPPED
- New states: `sale_delivery` + `sale_transport` (after `client_phone`, before `confirm`) — ✅ `doc-manual.ts:3192/3341/3393`
- 3 options: 🏪 Самовывоз / 🚚 ТК (покупатель) / 🚚 ТК (за наш счёт)
- Store in `sale_contract_artifacts` (new columns) — ✅ migration `20260810000020` (`delivery_method`, `transport_company_name`, `transport_payment_type` + CHECK constraints + index)

#### Enhancement #5: Deposit Destination Step (Rent only) — ✅ SHIPPED
- New state: `deposit_destination` (after `deposit_choice`, before `confirm`) — ✅ `doc-manual.ts:400`, step 15/16
- See `DEPOSIT_TRACKING_PRD.md` for full details
- Supports: all cash / all T-Bank / all Sber / split (cash + one card) — ✅ split sub-states `deposit_split_cash`/`deposit_split_card` (`doc-manual.ts:3199/3228`), inserts at `doc-manual.ts:432-495`
- СТС path: skip deposit_destination (no cash deposit collected) — ✅ also skipped when deposit = 0 (`doc-manual.ts:394`)

---

## 2. DATABASE CHANGES

### 2.1 Extend `user_states` (NOT create new table)

```sql
ALTER TABLE public.user_states ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
ALTER TABLE public.user_states ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0;
ALTER TABLE public.user_states ADD COLUMN IF NOT EXISTS corrected_steps INTEGER[] DEFAULT '{}';
```

### 2.2 Add delivery columns to `private.sale_contract_artifacts`

```sql
ALTER TABLE private.sale_contract_artifacts
ADD COLUMN IF NOT EXISTS delivery_method TEXT CHECK (delivery_method IN ('pickup', 'transport_company'));
ALTER TABLE private.sale_contract_artifacts ADD COLUMN IF NOT EXISTS transport_company_name TEXT;
ALTER TABLE private.sale_contract_artifacts
ADD COLUMN IF NOT EXISTS transport_payment_type TEXT CHECK (transport_payment_type IN ('buyer_pays', 'seller_pays'));
```

---

## 3. IMPLEMENTATION DETAILS

### 3.1 Step Numbering — Explicit Step Arrays

✅ **SHIPPED** — below is the actual code (`doc-manual.ts:793-860`), supersedes the v3.0 sketch (which had a phantom `license` step, wrong numbering, and a `stepLabel(context)` signature that doesn't exist):

```typescript
const RENT_STEPS: StepDef[] = [
  { num: 1, state: 'deal', label: 'Тип сделки' },
  { num: 2, state: 'bike', label: 'Выбор байка' },
  { num: 3, state: 'name', label: 'ФИО' },
  { num: 4, state: 'passport', label: 'Паспорт' },
  { num: 5, state: 'birth', label: 'Дата рождения' },
  { num: 6, state: 'address', label: 'Адрес регистрации' },
  { num: 7, state: 'has_license', label: 'Наличие ВУ' },
  { num: 8, state: 'categories', label: 'Категории ВУ' },
  { num: 9, state: 'schedule_start', label: 'Дата и время начала' },
  { num: 10, state: 'schedule_end', label: 'Дата и время окончания' },
  { num: 11, state: 'equipment', label: 'Оборудование' },
  { num: 12, state: 'odometer', label: 'Одометр' },
  { num: 13, state: 'payment_split', label: 'Способ оплаты' },
  { num: 14, state: 'deposit_choice', label: 'Депозит / СТС' },
  { num: 15, state: 'deposit_destination', label: 'Где получен депозит' },
  { num: '15a', state: 'deposit_split_cash', label: 'Смешанный: сколько наличными' },
  { num: '15b', state: 'deposit_split_card', label: 'Смешанный: выбор карты' },
  { num: 16, state: 'confirm', label: 'Проверка данных' },
  // СТС sub-flow states (not numbered — shown as "СТС-1" etc.)
  { num: 'СТС-1', state: 'sts_series', label: 'СТС: серия и номер' },
  // ... СТС-2..СТС-6 ...
];

const SALE_STEPS: StepDef[] = [
  { num: 1, state: 'deal', label: 'Тип сделки' },
  { num: 2, state: 'bike', label: 'Выбор байка' },
  { num: 3, state: 'name', label: 'ФИО' },
  { num: 4, state: 'passport', label: 'Паспорт' },
  { num: 5, state: 'birth', label: 'Дата рождения' },
  { num: 6, state: 'address', label: 'Адрес регистрации' },
  { num: 7, state: 'sale_color', label: 'Цвет' },
  { num: 8, state: 'sale_vin', label: 'VIN' },
  { num: 9, state: 'price', label: 'Цена' },
  { num: 10, state: 'client_phone', label: 'Телефон покупателя' },
  { num: 11, state: 'sale_delivery', label: 'Способ получения' },
  { num: 12, state: 'sale_transport', label: 'Транспортная компания' },
  { num: 13, state: 'confirm', label: 'Проверка данных' },
];

// Actual shipped signature — (state, dealType), NOT (context):
function stepLabel(state: string, dealType?: string): string {
  const steps = dealType === 'sale' ? SALE_STEPS : RENT_STEPS;
  const step = steps.find(s => s.state === state);
  if (!step) return '';
  if (typeof step.num === 'string' && step.num.startsWith('СТС')) {
    return String(step.num); // bare "СТС-1", no "Шаг" prefix
  }
  const total = dealType === 'sale' ? 13 : 16;
  return `Шаг ${step.num}/${total}`;
}
```

**Note on `corrected_steps`:** migration `20260810000020` adds `user_states.corrected_steps INTEGER[]`, but the shipped code tracks `context.correctedSteps` inside the state context JSONB instead (split sub-state nums like `'15a'` are strings and wouldn't fit INTEGER[] anyway). The DB column is currently unused — either wire a write-through on confirm or drop the column in a future cleanup.

### 3.2 Step Correction — Flow-Specific Step Lists

When user taps "🔢 Исправить шаг":
```typescript
const steps = context.dealType === 'sale' ? SALE_STEPS : RENT_STEPS;
// Filter out conditional steps (deposit_destination if СТС, split sub-states if not split, sale_transport if pickup)
const visibleSteps = steps.filter(s => {
  if (s.state === 'deposit_destination' && context.stsPledgeUsed) return false;
  if (s.state === 'deposit_split_cash' && context.depositCardDestination === undefined) return false; // only show if split was chosen
  if (s.state === 'deposit_split_card' && context.depositCardDestination === undefined) return false;
  if (s.state === 'sale_transport' && context.saleDeliveryMethod !== 'transport_company') return false;
  return true;
});

const list = visibleSteps.map(s => `${s.num}. ${s.label}`).join('\n');
await sendComplexMessage(chatId,
  `🔢 Какой шаг исправить?\n\n${list}\n\nВведите номер:`,
  undefined, { keyboardType: 'inline' }
);
await setState(userId, 'step_correction', context);
```

When user sends a number:
```typescript
const stepNum = parseInt(text.trim());
const step = visibleSteps.find(s => s.num === stepNum);
if (!step) {
  await sendComplexMessage(chatId, `⚠️ Нет такого шага. Введите число от 1 до ${visibleSteps.length}`);
  return;
}
context.correctedSteps = context.correctedSteps || [];
if (!context.correctedSteps.includes(stepNum)) context.correctedSteps.push(stepNum);
// Route to the step's question handler with "Было:" prefix
await setState(userId, step.state, context);
await askStepQuestion(chatId, userId, context, step.state, true /* isCorrection */);
```

### 3.3 Deposit Destination Step (Rent only — see DEPOSIT_TRACKING_PRD)

**Corner cases handled:**

| Scenario | What happens |
|----------|-------------|
| Standard deposit (all cash) | `deposit_choice` → `deposit_destination` → pick "💵 Всё наличными" → 1 entry in `deposit_entries` |
| Deposit on T-Bank | `deposit_choice` → `deposit_destination` → pick "💳 Всё на Тинькофф" → 1 entry |
| Split: 5000 cash + 15000 T-Bank | `deposit_choice` → `deposit_destination` → pick "🔀 Смешанный" → type 5000 → pick T-Bank → 2 entries |
| Split: 5000 cash + 15000 Sber | Same flow, pick Sber instead of T-Bank |
| СТС instead of deposit | `deposit_choice` → pick "🪪 СТС" → skip `deposit_destination` entirely → `sts_*` sub-flow → NO entries in `deposit_entries` (no cash deposit) |
| Custom deposit amount | `deposit_choice` → pick "✏️ Своя сумма" → type amount → `deposit_destination` → pick where |
| Deposit = 0 (free rental) | `deposit_choice` → deposit = 0 → skip `deposit_destination` (nothing to track) |

**New DocFlowContext fields:**
```typescript
depositCashAmount?: number;      // cash portion (0 if all card)
depositCardDestination?: 'tbank' | 'sber';  // which card (undefined if all cash or СТС)
depositCardAmount?: number;      // card portion (0 if all cash)
```

### 3.4 Delivery Method Step (Sale only)

```typescript
// New state: sale_delivery (after client_phone, before confirm)
async function askDeliveryMethod(chatId, userId, context) {
  await sendComplexMessage(chatId,
    `${stepLabel(context)}\nКак покупатель получит мотоцикл?`,
    [
      [{ text: "🏪 Самовывоз", callback_data: "delivery_pickup" }],
      [{ text: "🚚 ТК (покупатель)", callback_data: "delivery_tc_buyer" }],
      [{ text: "🚚 ТК (за наш счёт)", callback_data: "delivery_tc_seller" }],
    ],
    { keyboardType: 'inline', parseMode: 'HTML' }
  );
  await setState(userId, 'sale_delivery', context);
}
```

If TC selected → ask company name (`sale_transport` state) → `confirm`
If pickup → skip `sale_transport` → `confirm`

### 3.5 VIN in Verification

VIN shows blank (not "уточняется") when skipped — already fixed in code (commit 311364d6).

---

## 4. CORNER CASES

| Scenario | Handling |
|----------|----------|
| User corrects step 1 (deal type) | Switches from rent to sale or vice versa — all subsequent context cleared, restart from step 2 |
| User corrects step 14 (deposit_choice) to СТС | `deposit_destination` step skipped, `sts_*` sub-flow activated |
| User corrects step 14 (deposit_choice) from СТС to cash | `sts_*` data cleared, `deposit_destination` step shown |
| User corrects delivery (step 11) from TC to pickup | `sale_transport` data cleared (`saleTransportCompany = undefined`) |
| СТС sub-flow active + user corrects to a non-deposit step | СТС data preserved, just re-ask the corrected step |
| Step numbering with СТС | If СТС chosen, `deposit_destination` (step 15) is replaced by 6 СТС sub-steps. ✅ Shipped behavior: `stepLabel()` returns the bare label `СТС-1`…`СТС-6` with **no "Шаг" prefix** (`doc-manual.ts:846-848`) — v3.0's "Шаг 16/16 (СТС: серия)" format was not implemented |
| User corrects license data | ⚠️ **Not possible** — `license` state is excluded from `RENT_STEPS` (see §1.1 note). Operator must restart or fix post-generation |
| All-cash deposit + rental payment also all cash | Two separate `deposit_entries` rows: one for deposit, one would be in `cash_transactions` (if that PRD is implemented) |

---

## 5. SKILLS & PAGES THAT BENEFIT

| Skill/Page | Enhancement |
|------------|------------|
| `rental-card-text` | Show deposit destination breakdown (💵5 000₽ 💳Т15 000₽) |
| `rental-analytics-text` | Deposit summary in rental detail (where collected, where returned) |
| `sale-analytics-text` | Show delivery method badge (🏪 Самовывоз / 🚚 ТК: Деловые Линии) |
| `leads-crm-text` | Show deposit status on lead card (collected? returned? penalty?) |
| Evening digest | Add deposit summary per card (cash total, T-Bank total, Sber total) |
| Profile page "My Work" | Show deposit destinations collected today by this operator |
| `/franchize/[slug]/admin/deposits` | Visual deposit tracker (from DEPOSIT_TRACKING_PRD) |
| `/franchize/[slug]/rentals-analytics` | Rental card shows deposit badge + delivery badge |
| `/franchize/[slug]/sales-analytics` | Sale card shows delivery badge |

---

## 6. TESTING SCENARIOS

### Scenario 1: Step Correction in Rent Flow
1. Complete steps 1-15, make typo on step 4 (passport)
2. On `confirm`, tap "🔢 Исправить шаг"
3. Bot shows: "1. Тип сделки\n2. Выбор байка\n...\n4. Паспорт\n...\n15. Где получен депозит" (16th step `confirm` is excluded from the list)
4. Send "4"
5. Bot: "Было: 45 09 123456. Введите новое значение:"
6. User corrects → returns to `confirm`

*Note: license data is NOT correctable this way (state excluded from the step array — see §1.1). v3.0's version of this scenario used "step 8 (license)" which no longer exists as a numbered step.*

### Scenario 2: Sale with TC Delivery
1. Complete sale steps 1-10
2. Step 11: delivery method → "🚚 ТК (покупатель)"
3. Step 12: "Укажите название ТК:" → "Деловые Линии"
4. `confirm` shows delivery info
5. Contract generated with delivery fields

### Scenario 3: Split Deposit
1. Rent flow step 15: deposit = 20 000₽
2. Step 16: "🔀 Смешанный" → type "5000" → pick "💳 Тинькофф"
3. `deposit_entries`: 2 rows (5000 cash + 15000 tbank)
4. On rental completion: auto-return creates 2 rows (5000 cash out + 15000 tbank out)

### Scenario 4: СТС — No Deposit Destination
1. Rent flow step 15: pick "🪪 СТС вместо депозита"
2. `deposit_destination` SKIPPED — no deposit_entries created
3. `sts_*` sub-flow runs instead
4. Step correction list shows step 16 as СТС steps, not deposit_destination

---

## 7. IMPLEMENTATION PLAN

**Phase 1:** ✅ DONE (2026-08-10) — DB migration `20260810000020` (extend `user_states`, add delivery columns to `sale_contract_artifacts`)
**Phase 2:** ✅ DONE — Step arrays + `stepLabel()` helper + step numbering in all questions (`doc-manual.ts:793-860`)
**Phase 3:** ✅ DONE — Step correction handler + `correct_step` callback + `step_correction` state
**Phase 4:** ✅ DONE — Deposit destination step (integrated with DEPOSIT_TRACKING_PRD)
**Phase 5:** ✅ DONE — Delivery method step for sales
**Phase 6:** ⏳ PENDING — Sales analytics UI + rental card deposit badge (see meta plan, Iteration I2)
**Phase 7:** ⚠️ PARTIAL — unit tests shipped (`doc-manual-steps.spec.ts`, `deposit-scenarios.spec.ts`); manual end-to-end pass in production bot still recommended
**Phase 8 (NEW, v3.1):** ⏳ Decide fate of unused `user_states.corrected_steps` column (wire write-through or drop) + optionally re-add `license` to `RENT_STEPS` if operators need license correction

---

**Document History:**
- v1.0: Initial draft — many inaccuracies
- v2.0: Cross-referenced with actual code
- v3.0: Removed draft recovery (user: "not needed"). Added explicit step arrays for rent (16) vs sale (12). Added deposit destination integration. Added corner cases. Extended scope to skills/pages.
- v3.1 (2026-08-11): Post-implementation audit. Status → Mostly Implemented. **Fixed step numbering to match shipped code: RENT = 16 (not 17), SALE = 13 (not 12)** — v3.0's arrays included a phantom numbered `license` step; the `license` STATE still exists at runtime (`doc-manual.ts:2809`) but is deliberately unnumbered (no step label, not correctable). Fixed `stepLabel` signature `(state, dealType)`, СТС labels (bare `СТС-N`, no "Шаг" prefix), Scenario 1 (license → passport). Noted unused `user_states.corrected_steps` column. Line count 3531 → 4208.
