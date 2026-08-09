# DOC-MANUAL COMMAND ENHANCEMENTS PRD

**Version:** 2.0 (Polished — cross-referenced with actual code)
**Date:** 2026-08-09
**Status:** Ready for Implementation
**Applies to:** All crews via `/doc` command in Telegram bot
**Related Files:** `app/webhook-handlers/commands/doc-manual.ts` (3531 lines), `app/webhook-handlers/actions/sendComplexMessage.ts`

---

## 1. EXECUTIVE SUMMARY

### 1.1 Current State Analysis (VERIFIED against actual code)

**File:** `app/webhook-handlers/commands/doc-manual.ts` (3531 lines)

**Actual Flow (counted from code):**
- **RENT:** ~14 question steps + confirm:
  `deal` → `bike` → `name` → `passport` → `birth` → `address` → `has_license` → `license` → `categories` → `schedule_start` → `schedule_end` → `equipment` → `odometer` → `payment_split` → `deposit_choice` → `confirm`
  (Plus 6-state СТС sub-flow if `sts_pledge` chosen: `sts_series` → `sts_plate` → `sts_owner` → `sts_relation` → `sts_vehicle` → `sts_vin`)

- **SALE:** 8 question steps + confirm:
  `deal` → `bike` → `name` → `passport` → `birth` → `address` → `sale_color` → `sale_vin` → `price` → `client_phone` → `confirm`

**Actual State Management (VERIFIED):**
- States are **bare strings** (no `doc_awaiting_` prefix): `bike`, `deal`, `name`, `passport`, `birth`, `address`, `has_license`, `license`, `categories`, `schedule_start`, `schedule`, `schedule_end`, `sts_series`, `sts_plate`, `sts_owner`, `sts_relation`, `sts_vehicle`, `sts_vin`, `equipment`, `odometer`, `payment_split`, `payment_cash`, `deposit_choice`, `deposit_custom`, `sale_color`, `sale_vin`, `price`, `price_custom`, `confirm`, `client_phone`
- **Persistence EXISTS** via `user_states` table (30-min TTL):
  - `setState(userId, state, context)` → upserts to `user_states` (line 2352)
  - `getState(userId)` → reads from `user_states`, auto-expires (line 2365)
  - `clearState(userId)` → deletes row (line 2382)
- **Verification display EXISTS** via `buildRentSummary` (line 917) and `buildSaleSummary` (line 306) — already shows structured data (ФИО, паспорт, ВУ, период, депозит / ФИО, паспорт, цвет, VIN, цена)
- **Confirm keyboard** has 3 buttons: `✅ Всё верно` / `↩️ Начать заново` / `❌ Отменить` (callback_data: `ok` / `restart` / `cancel`)

**Actual DocFlowContext fields (VERIFIED — camelCase, NOT snake_case):**
```
// Common
bikeId, bikeMake, bikeModel, dealType
// Personal
mpFullName, mpSeries, mpNumber, mpIssueDate, mpIssuedBy, mpBirthDate, mpRegistration
// License
mlFullName, mlSeries, mlNumber, mlIssueDate, mlExpiryDate, mlCategories, mlAccessTier
// Schedule
rentStartDate, rentStartTime, rentEndDate, rentEndTime
// Equipment
helmets, gloves, jacket, boots, net, backpack, bag, charger
// Odometer
odometerBefore
// Payment
cashAmount, bankAmount
// Deposit
depositOverride, stsPledgeUsed, stsSeries, stsNumber, stsIssueDate,
stsVehiclePlate, stsVehicleVin, stsVehicleModel, stsVehicleYear,
stsOwnerFullName, stsOwnerRegistration, stsOwnerRelation, stsPledgeReturnDays,
depositAmountSkipped
// Sale
saleColor, saleVin, saleVinSkipped, salePrice
// Contact
clientPhone, clientPhoneResolved
```

**Actual sendComplexMessage signature (VERIFIED):**
```typescript
// Positional form (used everywhere in doc-manual.ts):
sendComplexMessage(chatId, text, buttons, {
  keyboardType: 'inline',
  parseMode: 'HTML',
})
```

### 1.2 Problem Statement (CORRECTED)

1. **No Step Correction:** On verification step (`confirm` state), only `ok`/`restart`/`cancel`. If user spots error in step 3, must restart entire flow. ✅ GENUINE PROBLEM
2. **No Delivery Method for Sales:** Sale flow doesn't capture pickup vs TC delivery. ✅ GENUINE PROBLEM
3. **No Draft Recovery Prompt:** While `user_states` persists data for 30 min, `/doc` always starts a fresh bike-selection menu and **silently overwrites** any existing state. There's no "Найден черновик, продолжить?" prompt. ✅ GENUINE PROBLEM (UX, not data)
4. **No Step Numbering:** Questions don't show "Шаг 3/14" — operator doesn't know progress. ✅ GENUINE PROBLEM

### 1.3 Proposed Enhancements

#### Enhancement #1: Step Numbering & Progress
- Add `currentStep` and `totalSteps` to `DocFlowContext`
- Show "Шаг 3/14" in every question message
- Show progress in verification summary

#### Enhancement #2: Step Correction
- On verification (`confirm` state): add 4th button `🔢 Исправить шаг`
- User sends message with number → bot re-asks ONLY that step
- Show previous value: "Было: Иванов И.И. Введите новое значение:"
- Track corrected steps in `correctedSteps: number[]`

#### Enhancement #3: Verification Enhancement (NOT creation — enhancement)
- `buildRentSummary`/`buildSaleSummary` already show data — enhance with:
  - HTML formatting (bold sections, icons)
  - Step numbers next to each field
  - "Шаг X/Y" header

#### Enhancement #4: Delivery Method Step (Sale only — NEW step 9)
- After `client_phone`, before `confirm`
- 3 options: 🏪 Самовывоз / 🚚 ТК (покупатель) / 🚚 ТК (за наш счёт)
- If TC: ask for company name
- Store in `sale_contract_artifacts` (new columns)

#### Enhancement #5: Draft Recovery Prompt
- On `/doc` start, check `getState(userId)` for existing state
- If found: "Найден черновик (шаг 5/14). Продолжить?" → Да/Нет
- If Да: resume from saved state
- If Нет: `clearState(userId)` + start fresh

---

## 2. DATABASE CHANGES

### 2.1 Extend `user_states` table (NOT create new table)

`user_states` already exists and is used by `doc-manual.ts`. Add columns for step tracking:

```sql
-- Migration: 20260810000001_extend_user_states_for_doc_steps.sql

ALTER TABLE public.user_states
ADD COLUMN IF NOT EXISTS crew_slug TEXT;

ALTER TABLE public.user_states
ADD COLUMN IF NOT EXISTS doc_type TEXT CHECK (doc_type IN ('rent', 'sale', 'testdrive', 'subrent'));

ALTER TABLE public.user_states
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;

ALTER TABLE public.user_states
ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0;

ALTER TABLE public.user_states
ADD COLUMN IF NOT EXISTS corrected_steps INTEGER[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_user_states_crew_slug
  ON public.user_states(crew_slug) WHERE crew_slug IS NOT NULL;
```

**Why not `document_drafts`?** `user_states` already does this job. Adding a parallel table would split the persistence layer. The `context` JSONB column already stores the full `DocFlowContext`. We just add metadata columns for crew_slug, doc_type, and step tracking.

### 2.2 Add delivery columns to `private.sale_contract_artifacts`

```sql
-- Migration: 20260810000002_add_delivery_to_sale_contracts.sql

ALTER TABLE private.sale_contract_artifacts
ADD COLUMN IF NOT EXISTS delivery_method TEXT CHECK (delivery_method IN (
  'pickup',              -- Самовывоз из шоурума
  'transport_company',   -- Транспортная компания
  'courier'              -- Курьерская доставка (future)
));

ALTER TABLE private.sale_contract_artifacts
ADD COLUMN IF NOT EXISTS transport_company_name TEXT;

ALTER TABLE private.sale_contract_artifacts
ADD COLUMN IF NOT EXISTS transport_payment_type TEXT CHECK (transport_payment_type IN (
  'buyer_pays',          -- Оплачивает покупатель
  'seller_pays'          -- За наш счёт
));

CREATE INDEX IF NOT EXISTS idx_sale_contract_artifacts_delivery
  ON private.sale_contract_artifacts(delivery_method);
```

### 2.3 Update `SaleDashboardItem` interface

**File:** `app/franchize/server-actions/rentals-dashboard.ts`

Add delivery fields to the existing interface:
```typescript
export interface SaleDashboardItem {
  // ... existing fields ...
  delivery_method: string | null;           // 'pickup' | 'transport_company'
  transport_company_name: string | null;    // e.g. "Деловые Линии"
  transport_payment_type: string | null;    // 'buyer_pays' | 'seller_pays'
}
```

---

## 3. IMPLEMENTATION DETAILS

### 3.1 State Machine Changes

**No new state names needed** — the existing bare-string states work. Only add:
- `sale_delivery` — NEW state (after `client_phone`, before `confirm`)
- `sale_transport` — NEW state (if TC selected, asks for company name)

The `confirm` state already exists — we just enhance its keyboard and handler.

### 3.2 DocFlowContext Changes

Add to existing `DocFlowContext` interface (line 526-606 of doc-manual.ts):
```typescript
// Step tracking (NEW)
currentStep?: number;
totalSteps?: number;
correctedSteps?: number[];

// Delivery (NEW — sale only)
saleDeliveryMethod?: 'pickup' | 'transport_company';
saleTransportCompany?: string;
saleTransportPaymentType?: 'buyer_pays' | 'seller_pays';
```

### 3.3 Step Numbering Implementation

Add a helper function:
```typescript
function stepLabel(context: DocFlowContext): string {
  const current = context.currentStep || 0;
  const total = context.totalSteps || 0;
  return total > 0 ? `Шаг ${current}/${total}` : '';
}
```

Prepend to every question message:
```typescript
await sendComplexMessage(chatId,
  `${stepLabel(context)}\n\n✏️ Введите ФИО:`,
  undefined, { keyboardType: 'inline' }
);
```

### 3.4 Step Correction Implementation

**Modified `buildConfirmKeyboard` (line 288):**
```typescript
function buildConfirmKeyboard(): KeyboardButton[][] {
  return [
    [{ text: "✅ Всё верно", callback_data: "ok" }],
    [{ text: "↩️ Начать заново", callback_data: "restart" }],
    [{ text: "🔢 Исправить шаг", callback_data: "correct_step" }],  // NEW
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}
```

**New handler for `correct_step` callback:**
```typescript
// When user taps "Исправить шаг":
await setState(userId, 'step_correction', context);
await sendComplexMessage(chatId,
  `🔢 Укажите номер шага для исправления:\n\n` +
  rentSteps.map((s, i) => `${i + 1}. ${s.label}`).join('\n'),
  undefined, { keyboardType: 'inline' }
);
```

**When user sends a number:**
```typescript
// In handleDocText, when state === 'step_correction':
const stepNum = parseInt(text.trim());
if (isNaN(stepNum) || stepNum < 1 || stepNum > totalSteps) {
  await sendComplexMessage(chatId, `⚠️ Введите число от 1 до ${totalSteps}`);
  return;
}
// Track corrected step
context.correctedSteps = context.correctedSteps || [];
if (!context.correctedSteps.includes(stepNum)) {
  context.correctedSteps.push(stepNum);
}
// Route to the step's question handler
const stepState = rentSteps[stepNum - 1].state;
await setState(userId, stepState, context);
await askStepQuestion(chatId, userId, context, stepState);
```

### 3.5 Delivery Method Step (Sale flow)

After `client_phone` state, before `confirm`:

```typescript
// New state: sale_delivery
async function askDeliveryMethod(chatId: number, userId: string, context: DocFlowContext) {
  const keyboard: KeyboardButton[][] = [
    [{ text: "🏪 Самовывоз", callback_data: "delivery_pickup" }],
    [{ text: "🚚 ТК (покупатель)", callback_data: "delivery_tc_buyer" }],
    [{ text: "🚚 ТК (за наш счёт)", callback_data: "delivery_tc_seller" }],
  ];
  await sendComplexMessage(chatId,
    `${stepLabel(context)}\n\nКак покупатель получит мотоцикл?`,
    keyboard, { keyboardType: 'inline', parseMode: 'HTML' }
  );
  await setState(userId, 'sale_delivery', context);
}
```

**Callback handler:**
```typescript
case 'delivery_pickup':
  context.saleDeliveryMethod = 'pickup';
  await gotoConfirm(chatId, userId, context);
  break;
case 'delivery_tc_buyer':
  context.saleDeliveryMethod = 'transport_company';
  context.saleTransportPaymentType = 'buyer_pays';
  await askTransportCompany(chatId, userId, context);
  break;
case 'delivery_tc_seller':
  context.saleDeliveryMethod = 'transport_company';
  context.saleTransportPaymentType = 'seller_pays';
  await askTransportCompany(chatId, userId, context);
  break;
```

### 3.6 Draft Recovery Prompt

At the start of `/doc` command:
```typescript
const existing = await getState(userId);
if (existing && existing.state !== 'bike' && existing.state !== 'deal') {
  // Found a draft in progress
  const keyboard: KeyboardButton[][] = [
    [{ text: "✅ Продолжить", callback_data: "draft_resume" }],
    [{ text: "❌ Начать заново", callback_data: "draft_discard" }],
  ];
  await sendComplexMessage(chatId,
    `Найден черновик договора (${existing.context.dealType || 'аренда'}, шаг ${existing.context.currentStep || '?'}/${existing.context.totalSteps || '?'}).\n\nПродолжить?`,
    keyboard, { keyboardType: 'inline' }
  );
  return;
}
// No draft — start fresh
await startDocFlow(chatId, userId);
```

### 3.7 VIN in Verification Summary

**CORRECTED:** VIN should show blank (not "уточняется") when skipped:
```typescript
// In buildSaleSummary:
const vinLine = context.saleVinSkipped
  ? `🔢 VIN: (пропущен)`           // Show "(пропущен)" in summary
  : `🔢 VIN: ${context.saleVin || '(из карточки ТС)'}`;
```

**In the DOCX template:** `effectiveVin` is already `""` (blank) when `saleVinSkipped=true` (fixed in commit 311364d6).

---

## 4. UI UPDATES

### 4.1 Sales Analytics Card

**File:** `app/franchize/[slug]/sales-analytics/SalesAnalyticsClient.tsx`

Add delivery badge to sale cards:
```tsx
{sale.delivery_method && (
  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{
          backgroundColor: sale.delivery_method === 'pickup'
            ? withAlpha(accentMain, 0.1) : withAlpha('#10B981', 0.1),
          color: sale.delivery_method === 'pickup'
            ? accentMain : '#10B981'
        }}>
    {sale.delivery_method === 'pickup'
      ? '🏪 Самовывоз'
      : `🚚 ${sale.transport_company_name || 'ТК'}`}
  </span>
)}
```

---

## 5. TESTING SCENARIOS

### Scenario 1: Step Correction in Rent Flow
1. Start `/doc` → select "Аренда" → complete steps 1-5
2. On step 6 (license), make typo
3. Reach verification (step ~15)
4. Tap "🔢 Исправить шаг"
5. Send "6"
6. Bot re-asks step 6: "Было: 99 76 123456. Введите новое значение:"
7. User corrects → returns to verification
8. Confirms → contract generated

### Scenario 2: Sale with TC Delivery
1. Start `/doc` → select "Покупка"
2. Complete steps 1-8 (name, passport, birth, address, color, VIN, price, phone)
3. Step 9: delivery method appears
4. Select "🚚 ТК (покупатель)"
5. Bot asks: "Укажите название ТК:"
6. User: "Деловые Линии"
7. Verification shows delivery info
8. Contract generated with delivery fields in `sale_contract_artifacts`

### Scenario 3: Draft Recovery
1. Complete 5 steps of rent flow
2. Close bot / send `/start`
3. Send `/doc` again
4. Bot: "Найден черновик (аренда, шаг 5/14). Продолжить?"
5. Tap "✅ Продолжить"
6. Bot resumes from step 5 with previous data intact

---

## 6. IMPLEMENTATION PLAN

**Phase 1:** DB migration (extend `user_states`, add delivery columns to `sale_contract_artifacts`)
**Phase 2:** Step numbering + `currentStep`/`totalSteps` in `DocFlowContext`
**Phase 3:** Step correction handler + `correct_step` callback
**Phase 4:** Draft recovery prompt at `/doc` start
**Phase 5:** Delivery method step for sales
**Phase 6:** Sales analytics UI updates
**Phase 7:** Testing

---

**Document History:**
- v1.0 (2026-08-09): Initial draft by other agent — contained many inaccuracies
- v2.0 (2026-08-09): Polished by Super Z — cross-referenced with actual doc-manual.ts code (3531 lines), verified all state names, field names, function signatures against production code
