# DOC-MANUAL COMMAND ENHANCEMENTS PRD

**Version:** 3.0 (Final — removed draft recovery, explicit step arrays, deposit integration)
**Date:** 2026-08-10
**Status:** Ready for Implementation
**Applies to:** All crews via `/doc` command in Telegram bot
**Related:** `docs/DEPOSIT_TRACKING_PRD.md` (deposit destination step), `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md`
**Related Files:** `app/webhook-handlers/commands/doc-manual.ts` (3531 lines), `app/webhook-handlers/actions/sendComplexMessage.ts`

---

## 1. EXECUTIVE SUMMARY

### 1.1 Current State (VERIFIED against actual code)

**File:** `app/webhook-handlers/commands/doc-manual.ts` (3531 lines)

**Actual RENT flow** (15 steps + confirm + optional СТС sub-flow):
| # | State | What it asks |
|---|-------|-------------|
| 1 | `deal` | Rent or Sale? |
| 2 | `bike` | Which bike? |
| 3 | `name` | Full name (ФИО) |
| 4 | `passport` | Passport series + number + issue date + issued by |
| 5 | `birth` | Date of birth |
| 6 | `address` | Registration address |
| 7 | `has_license` | Has driver license? |
| 8 | `license` | License series + number + dates |
| 9 | `categories` | License categories (A, B, M) |
| 10 | `schedule_start` | Start date + time |
| 11 | `schedule_end` | End date + time |
| 12 | `equipment` | Helmets, gloves, jacket, etc. |
| 13 | `odometer` | Odometer reading |
| 14 | `payment_split` | Cash / bank / split |
| 15 | `deposit_choice` | Deposit amount or СТС |
| — | `deposit_destination` | **NEW: Where collected? (cash/tbank/sber/split)** |
| 16 | `confirm` | Verify all data |

*If СТС chosen (step 15): 6 extra sub-steps: `sts_series` → `sts_plate` → `sts_owner` → `sts_relation` → `sts_vehicle` → `sts_vin` → `confirm`*

**Actual SALE flow** (10 steps + confirm):
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
| — | `sale_delivery` | **NEW: Delivery method** |
| — | `sale_transport` | **NEW: TC name (if TC selected)** |
| 11 | `confirm` | Verify all data |

**Step counts differ:** RENT = 15 steps (16 with deposit_destination), SALE = 10 steps (12 with delivery). Step numbering MUST be flow-specific.

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

#### Enhancement #1: Step Numbering (flow-specific)
- RENT steps: 16 (15 questions + deposit_destination) — or 22 with СТС sub-flow
- SALE steps: 12 (10 questions + sale_delivery + sale_transport)
- Show "Шаг 3/16" (rent) or "Шаг 3/12" (sale) in every question
- Use explicit step arrays (not computed) to avoid off-by-one errors

#### Enhancement #2: Step Correction
- On `confirm`: add 4th button `🔢 Исправить шаг`
- Bot shows numbered list of steps (flow-specific)
- User sends number → bot re-asks ONLY that step
- After correction → return to `confirm` (not next step)

#### Enhancement #3: Verification Enhancement
- `buildRentSummary`/`buildSaleSummary` already show data — enhance with HTML formatting

#### Enhancement #4: Delivery Method Step (Sale only)
- New states: `sale_delivery` + `sale_transport` (after `client_phone`, before `confirm`)
- 3 options: 🏪 Самовывоз / 🚚 ТК (покупатель) / 🚚 ТК (за наш счёт)
- Store in `sale_contract_artifacts` (new columns)

#### Enhancement #5: Deposit Destination Step (Rent only)
- New state: `deposit_destination` (after `deposit_choice`, before `confirm`)
- See `DEPOSIT_TRACKING_PRD.md` for full details
- Supports: all cash / all T-Bank / all Sber / split (cash + one card)
- СТС path: skip deposit_destination (no cash deposit collected)

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

```typescript
const RENT_STEPS = [
  { num: 1, state: 'deal', label: 'Тип сделки' },
  { num: 2, state: 'bike', label: 'Выбор байка' },
  { num: 3, state: 'name', label: 'ФИО' },
  { num: 4, state: 'passport', label: 'Паспорт' },
  { num: 5, state: 'birth', label: 'Дата рождения' },
  { num: 6, state: 'address', label: 'Адрес регистрации' },
  { num: 7, state: 'has_license', label: 'Наличие ВУ' },
  { num: 8, state: 'license', label: 'Водительское удостоверение' },
  { num: 9, state: 'categories', label: 'Категории ВУ' },
  { num: 10, state: 'schedule_start', label: 'Дата и время начала' },
  { num: 11, state: 'schedule_end', label: 'Дата и время окончания' },
  { num: 12, state: 'equipment', label: 'Оборудование' },
  { num: 13, state: 'odometer', label: 'Одометр' },
  { num: 14, state: 'payment_split', label: 'Способ оплаты' },
  { num: 15, state: 'deposit_choice', label: 'Депозит / СТС' },
  { num: 16, state: 'deposit_destination', label: 'Где получен депозит' }, // NEW
  // Note: if СТС chosen, steps 16 is skipped, replaced by sts_* sub-flow
] as const;

const SALE_STEPS = [
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
  { num: 11, state: 'sale_delivery', label: 'Способ получения' }, // NEW
  { num: 12, state: 'sale_transport', label: 'Транспортная компания' }, // NEW (conditional)
] as const;

function stepLabel(context: DocFlowContext): string {
  const steps = context.dealType === 'sale' ? SALE_STEPS : RENT_STEPS;
  const step = steps.find(s => s.state === context.currentState);
  if (!step) return '';
  const total = context.dealType === 'sale' ? SALE_STEPS.length : RENT_STEPS.length;
  return `Шаг ${step.num}/${total}`;
}
```

### 3.2 Step Correction — Flow-Specific Step Lists

When user taps "🔢 Исправить шаг":
```typescript
const steps = context.dealType === 'sale' ? SALE_STEPS : RENT_STEPS;
// Filter out conditional steps (deposit_destination if СТС, sale_transport if pickup)
const visibleSteps = steps.filter(s => {
  if (s.state === 'deposit_destination' && context.stsPledgeUsed) return false;
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
depositCashAmount?: number;      // cash portion
depositCardDestination?: 'tbank' | 'sber';  // which card
depositCardAmount?: number;      // card portion
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
| User corrects step 15 (deposit_choice) to СТС | `deposit_destination` step skipped, `sts_*` sub-flow activated |
| User corrects step 15 (deposit_choice) from СТС to cash | `sts_*` data cleared, `deposit_destination` step shown |
| User corrects delivery (step 11) from TC to pickup | `sale_transport` data cleared (`saleTransportCompany = undefined`) |
| СТС sub-flow active + user corrects to a non-deposit step | СТС data preserved, just re-ask the corrected step |
| Step numbering with СТС | If СТС chosen, `deposit_destination` (step 16) is replaced by 6 СТС sub-steps. Show as "Шаг 16/16 (СТС: серия)" or similar |
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
1. Complete steps 1-15, make typo on step 8 (license)
2. On `confirm`, tap "🔢 Исправить шаг"
3. Bot shows: "1. Тип сделки\n2. Выбор байка\n...\n8. Водительское удостоверение\n...\n16. Где получен депозит"
4. Send "8"
5. Bot: "Было: 99 76 123456. Введите новое значение:"
6. User corrects → returns to `confirm`

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

**Phase 1:** DB migration (extend `user_states`, add delivery columns to `sale_contract_artifacts`)
**Phase 2:** Step arrays + `stepLabel()` helper + step numbering in all questions
**Phase 3:** Step correction handler + `correct_step` callback + `step_correction` state
**Phase 4:** Deposit destination step (integrated with DEPOSIT_TRACKING_PRD)
**Phase 5:** Delivery method step for sales
**Phase 6:** Sales analytics UI + rental card deposit badge
**Phase 7:** Testing

---

**Document History:**
- v1.0: Initial draft — many inaccuracies
- v2.0: Cross-referenced with actual code
- v3.0: Removed draft recovery (user: "not needed"). Added explicit step arrays for rent (16) vs sale (12). Added deposit destination integration. Added corner cases. Extended scope to skills/pages.
