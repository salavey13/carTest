# DOC-MANUAL COMMAND ENHANCEMENTS PRD

**Version:** 1.0  
**Date:** 2026-08-09  
**Status:** Draft for Review  
**Applies to:** All crews via `/doc` command in Telegram bot  
**Related Files:** `app/webhook-handlers/commands/doc-manual.ts`, `docs/DOC_COMMAND_ENHANCEMENT_PLAN.md`

---

## 1. EXECUTIVE SUMMARY

### 1.1 Current State Analysis

**File:** `app/webhook-handlers/commands/doc-manual.ts` (existing)

**Current Flow:**
- **RENT:** 10 steps (name → passport → birth → address → license? → license → categories → start → end → deposit)
- **SALE:** 7 steps (name → passport → birth → address → color → VIN → price)

**Existing State Management:**
- Uses in-memory state machine with states like `doc_awaiting_bike`, `doc_awaiting_passport`, etc.
- NO persistence layer — if user exits, all data is lost
- NO step correction — user must restart from beginning if mistake found on verification

**Current Sale Flow Limitations:**
- NO delivery method selection
- NO transport company option
- Customer either picks up or delivery is assumed but not tracked

### 1.2 Problem Statement

1. **No Step Correction:** On verification step, only "Yes/No" options. If user spots error in Step 3 data, must restart entire flow
2. **No Delivery Method for Sales:** Sale flow doesn't capture how customer receives bike (pickup vs TC delivery)
3. **No State Persistence:** Bot state lost on disconnect/restart
4. **Poor UX on Verification:** Shows "Всё правильно?" without displaying collected data context

### 1.3 Proposed Enhancements

#### Enhancement #1: Step Numbering & Navigation
- Explicit step numbers in every question ("Шаг 3/10")
- Progress indicator "X/Y шагов"
- Step number visible in verification summary

#### Enhancement #2: Step Correction Feature
- On verification: add option "Нет, исправить шаг (укажите номер 1-9)"
- User sends message with number "3" → bot re-asks ONLY that step
- Previous value shown as context: "Было указано: 15.03.1990. Введите новое значение:"
- Corrected steps tracked in `corrected_steps[]` array

#### Enhancement #3: Verification Data Display
- Instead of "Всё правильно?", show ALL collected data structured by sections
- Example:
  ```
  📋 ПРОВЕРКА ДАННЫХ
  
  👤 Клиент:
  • ФИО: Иванов Иван Иванович
  • Дата рождения: 15.03.1990
  • Адрес: г. Москва, ул. Ленина 1
  
  📄 Документы:
  • Паспорт: 4509 123456 15.03.2020 ОМВД
  • Права: есть (категории A, B)
  
  📅 Период аренды:
  • Начало: 09.08.2026 18:00
  • Конец: 10.08.2026 10:00
  
  💰 Оплата:
  • Депозит: подтверждаю
  
  ──────────────
  Всё верно?
  ✅ Да, всё правильно
  ❌ Нет, начать заново
  🔢 Нет, исправить шаг (укажите номер 1-9)
  ```

#### Enhancement #4: Delivery Method Step for Sales
- **NEW Step 7/8** in sale flow (after price, before completion)
- 3 options via inline keyboard:
  - 🏪 Самовывоз из шоурума
  - 🚚 ТК (оплачивает покупатель)
  - 🚚 ТК (за наш счёт)
- Follow-up for TC option: "Укажите название транспортной компании:"
- Store in `sale_contract_artifacts` (new columns needed)

---

## 2. DATABASE CHANGES

### 2.1 New Table: `public.document_drafts`

Already defined in `FRANCHIZE_SERVICE_OPERATIONS_PRD.md` (Section 2.8).

**Purpose:** Persist draft state between bot restarts, enable step correction

```sql
-- Migration: 20260809000007_create_document_drafts.sql
-- (See FRANCHIZE_SERVICE_OPERATIONS_PRD.md for full DDL)
```

### 2.2 Update Table: `private.sale_contract_artifacts`

Add delivery method columns:

```sql
-- Migration: 20260809000011_add_delivery_to_sale_contracts.sql

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
  'seller_pays',         -- За наш счёт
  'split'                -- Разделённая оплата (future)
));

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_sale_contract_artifacts_delivery 
  ON private.sale_contract_artifacts(delivery_method);

COMMENT ON COLUMN private.sale_contract_artifacts.delivery_method IS 'How customer receives purchased vehicle';
COMMENT ON COLUMN private.sale_contract_artifacts.transport_company_name IS 'Name of TC if delivery_method=transport_company';
COMMENT ON COLUMN private.sale_contract_artifacts.transport_payment_type IS 'Who pays for delivery';
```

### 2.3 Update View: Sales Dashboard

Update `SaleDashboardItem` interface to include delivery info:

```typescript
// File: app/franchize/server-actions/rentals-dashboard.ts

export interface SaleDashboardItem {
  id: string;
  contract_key: string;
  buyer_full_name: string | null;
  buyer_passport_number: string | null;
  buyer_email: string | null;
  sale_price: string | null;
  price_words: string | null;
  warranty_months: string | null;
  created_at: string;
  // NEW FIELDS:
  delivery_method: string | null;           // 'pickup' | 'transport_company'
  transport_company_name: string | null;    // e.g. "Деловые Линии"
  transport_payment_type: string | null;    // 'buyer_pays' | 'seller_pays'
  vehicle: {
    id: string;
    make: string;
    model: string;
    crew_id: string;
    type: string;
  } | null;
}
```

---

## 3. IMPLEMENTATION DETAILS

### 3.1 Modified State Machine

**Current States:**
```typescript
type DocState =
  | 'doc_awaiting_bike'
  | 'doc_awaiting_passport'
  | 'doc_awaiting_license'
  | 'doc_awaiting_schedule'
  | 'doc_awaiting_deposit';
```

**Enhanced States:**
```typescript
type DocState =
  | 'doc_awaiting_deal_type'      // NEW: rent vs sale
  | 'doc_awaiting_bike'
  | 'doc_awaiting_passport'
  | 'doc_awaiting_passport_page2' // NEW: for sale (registration address)
  | 'doc_awaiting_birth'
  | 'doc_awaiting_address'
  | 'doc_awaiting_license_question'
  | 'doc_awaiting_license'
  | 'doc_awaiting_categories'
  | 'doc_awaiting_start_date'
  | 'doc_awaiting_end_date'
  | 'doc_awaiting_deposit'
  | 'doc_awaiting_color'          // Sale only
  | 'doc_awaiting_vin'            // Sale only
  | 'doc_awaiting_price'          // Sale only
  | 'doc_awaiting_delivery'       // NEW: Sale only (Step 7/8)
  | 'doc_awaiting_transport'      // NEW: Sale only (if TC selected)
  | 'doc_verification'            // NEW: Unified verification step
  | 'doc_step_correction'         // NEW: Re-asking specific step
  | 'doc_completed';
```

### 3.2 Enhanced DocFlowContext

```typescript
interface DocFlowContext {
  // Common
  deal_type?: 'rent' | 'sale';
  bike_id?: string;
  bike_make?: string;
  bike_model?: string;
  
  // Personal info
  full_name?: string;
  passport_data?: Record<string, string>;
  passport_page2_data?: Record<string, string>;  // NEW
  birth_date?: string;
  address?: string;
  
  // License (rent only)
  has_license?: boolean;
  license_data?: Record<string, string>;
  categories?: string[];
  
  // Schedule (rent only)
  start_date?: string;
  end_date?: string;
  
  // Deposit (rent only)
  deposit_choice?: 'confirm' | 'override' | 'sts_pledge';
  sts_data?: Record<string, string>;
  
  // Sale-specific
  color_override?: string;
  vin_override?: string;
  sale_price?: string;
  
  // NEW: Delivery (sale only)
  delivery_method?: 'pickup' | 'transport_company';
  transport_company_name?: string;
  transport_payment_type?: 'buyer_pays' | 'seller_pays';
  
  // Metadata
  access_tier?: AccessTier;
  extraction_provider?: 'zai-vlm';
  
  // Step tracking
  current_step?: number;
  total_steps?: number;
  corrected_steps?: number[];  // NEW: Track which steps were corrected
}
```

### 3.3 Verification Step Implementation

**File:** `app/webhook-handlers/commands/doc-manual.ts`

```typescript
async function showVerificationStep(
  chatId: number,
  userId: string,
  context: DocFlowContext
): Promise<void> {
  const isSale = context.deal_type === 'sale';
  const totalSteps = isSale ? 8 : 10;
  const currentStep = totalSteps;  // Verification is last step
  
  // Build formatted summary
  let summary = `📋 <b>ПРОВЕРКА ДАННЫХ</b>\n\n`;
  
  if (isSale) {
    // SALE summary
    summary += `👤 <b>Покупатель:</b>\n`;
    summary += `• ФИО: ${escapeHtml(context.full_name)}\n`;
    summary += `• Дата рождения: ${escapeHtml(context.birth_date)}\n`;
    summary += `• Адрес: ${escapeHtml(context.address)}\n\n`;
    
    summary += `📄 <b>Документы:</b>\n`;
    summary += `• Паспорт: ${escapeHtml(context.passport_data?.full || 'не указан')}\n\n`;
    
    summary += `🏍️ <b>Техника:</b>\n`;
    summary += `• Модель: ${escapeHtml(context.bike_make)} ${escapeHtml(context.bike_model)}\n`;
    summary += `• Цвет: ${escapeHtml(context.color_override || 'по умолчанию')}\n`;
    summary += `• VIN: ${escapeHtml(context.vin_override || 'уточняется')}\n\n`;
    
    summary += `💰 <b>Оплата:</b>\n`;
    summary += `• Цена: ${escapeHtml(context.sale_price)} ₽\n\n`;
    
    // NEW: Delivery info
    if (context.delivery_method) {
      summary += `🚚 <b>Доставка:</b>\n`;
      if (context.delivery_method === 'pickup') {
        summary += `• Самовывоз из шоурума\n`;
      } else if (context.delivery_method === 'transport_company') {
        summary += `• Транспортная компания: ${escapeHtml(context.transport_company_name)}\n`;
        summary += `• Оплата: ${context.transport_payment_type === 'buyer_pays' ? 'покупатель' : 'за наш счёт'}\n`;
      }
      summary += `\n`;
    }
  } else {
    // RENT summary
    summary += `👤 <b>Арендатор:</b>\n`;
    summary += `• ФИО: ${escapeHtml(context.full_name)}\n`;
    summary += `• Дата рождения: ${escapeHtml(context.birth_date)}\n`;
    summary += `• Адрес: ${escapeHtml(context.address)}\n\n`;
    
    summary += `📄 <b>Документы:</b>\n`;
    summary += `• Паспорт: ${escapeHtml(context.passport_data?.full || 'не указан')}\n`;
    if (context.has_license) {
      summary += `• Права: ${escapeHtml(context.license_data?.full || 'не указаны')}\n`;
      summary += `• Категории: ${context.categories?.join(', ')}\n`;
    } else {
      summary += `• Права: нет\n`;
    }
    summary += `\n`;
    
    summary += `📅 <b>Период аренды:</b>\n`;
    summary += `• Начало: ${formatDate(context.start_date)}\n`;
    summary += `• Конец: ${formatDate(context.end_date)}\n\n`;
    
    summary += `💰 <b>Депозит:</b>\n`;
    if (context.deposit_choice === 'confirm') {
      summary += `• Подтверждаю стандартный депозит\n`;
    } else if (context.deposit_choice === 'override') {
      summary += `• Индивидуальная сумма\n`;
    } else if (context.deposit_choice === 'sts_pledge') {
      summary += `• СТС вместо депозита\n`;
    }
  }
  
  summary += `\n──────────────\n`;
  summary += `Шаг ${currentStep}/${totalSteps}\n\n`;
  summary += `<i>Для исправления укажите номер шага (1-${totalSteps-1})</i>\n`;
  
  // Inline keyboard with 3 options
  const keyboard: KeyboardButton[][] = [
    [{ text: '✅ Да, всё правильно', callback_data: 'verify_yes' }],
    [{ text: '❌ Нет, начать заново', callback_data: 'verify_no_restart' }],
    [{ text: '🔢 Исправить шаг', callback_data: 'verify_correct_hint' }]
  ];
  
  await sendComplexMessage({
    chat_id: chatId,
    text: summary,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard }
  });
  
  // Set state to await correction input
  await updateDocState(userId, 'doc_verification', context);
}
```

### 3.4 Step Correction Handler

```typescript
async function handleStepCorrection(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  stepNumber: number
): Promise<void> {
  const isSale = context.deal_type === 'sale';
  const totalSteps = isSale ? 8 : 10;
  
  if (stepNumber < 1 || stepNumber >= totalSteps) {
    await sendComplexMessage({
      chat_id: chatId,
      text: `⚠️ Введите номер шага от 1 до ${totalSteps-1}`
    });
    return;
  }
  
  // Track corrected step
  if (!context.corrected_steps) {
    context.corrected_steps = [];
  }
  if (!context.corrected_steps.includes(stepNumber)) {
    context.corrected_steps.push(stepNumber);
  }
  
  context.current_step = stepNumber;
  
  // Route to appropriate step handler based on step number and deal type
  if (isSale) {
    await handleSaleStep(chatId, userId, context, stepNumber);
  } else {
    await handleRentStep(chatId, userId, context, stepNumber);
  }
  
  // Update state to doc_step_correction
  await updateDocState(userId, 'doc_step_correction', context);
}

async function handleSaleStep(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  stepNumber: number
): Promise<void> {
  switch (stepNumber) {
    case 1:
      await sendComplexMessage({
        chat_id: chatId,
        text: `✏️ <b>Шаг 1/8: Исправление ФИО</b>\n\n` +
              `Было указано: ${escapeHtml(context.full_name)}\n\n` +
              `Введите правильное ФИО:`
      });
      // Next state: doc_awaiting_full_name
      break;
      
    case 2:
      await sendComplexMessage({
        chat_id: chatId,
        text: `✏️ <b>Шаг 2/8: Исправление паспорта</b>\n\n` +
              `Было указано: ${escapeHtml(context.passport_data?.full)}\n\n` +
              `Отправьте фото паспорта (главная страница) или введите текст:`
      });
      // Next state: doc_awaiting_passport
      break;
      
    case 3:
      await sendComplexMessage({
        chat_id: chatId,
        text: `✏️ <b>Шаг 3/8: Исправление даты рождения</b>\n\n` +
              `Было указано: ${escapeHtml(context.birth_date)}\n\n` +
              `Введите дату рождения (например, 15.03.1990):`
      });
      // Next state: doc_awaiting_birth
      break;
      
    case 4:
      await sendComplexMessage({
        chat_id: chatId,
        text: `✏️ <b>Шаг 4/8: Исправление адреса</b>\n\n` +
              `Было указано: ${escapeHtml(context.address)}\n\n` +
              `Введите адрес регистрации:`
      });
      // Next state: doc_awaiting_address
      break;
      
    case 5:
      await sendComplexMessage({
        chat_id: chatId,
        text: `✏️ <b>Шаг 5/8: Исправление цвета</b>\n\n` +
              `Было указано: ${escapeHtml(context.color_override || 'по умолчанию')}\n\n` +
              `Введите цвет мотоцикла:`
      });
      // Next state: doc_awaiting_color
      break;
      
    case 6:
      await sendComplexMessage({
        chat_id: chatId,
        text: `✏️ <b>Шаг 6/8: Исправление VIN</b>\n\n` +
              `Было указано: ${escapeHtml(context.vin_override || 'уточняется')}\n\n` +
              `Введите VIN или отправьте фото:`
      });
      // Next state: doc_awaiting_vin
      break;
      
    case 7:
      await sendComplexMessage({
        chat_id: chatId,
        text: `✏️ <b>Шаг 7/8: Исправление цены</b>\n\n` +
              `Было указано: ${escapeHtml(context.sale_price)} ₽\n\n` +
              `Введите цену продажи:`
      });
      // Next state: doc_awaiting_price
      break;
  }
}
```

### 3.5 Delivery Method Step (Sale Flow)

```typescript
async function askDeliveryMethod(
  chatId: number,
  userId: string,
  context: DocFlowContext
): Promise<void> {
  const keyboard: KeyboardButton[][] = [
    [
      { text: '🏪 Самовывоз', callback_data: 'delivery_pickup' },
      { text: '🚚 ТК (покупатель)', callback_data: 'delivery_tc_buyer' }
    ],
    [
      { text: '🚚 ТК (за наш счёт)', callback_data: 'delivery_tc_seller' }
    ]
  ];
  
  await sendComplexMessage({
    chat_id: chatId,
    text: `✏️ <b>Шаг 7/8: Способ получения</b>\n\n` +
          `Как покупатель получит мотоцикл?\n\n` +
          `🏪 <b>Самовывоз</b> — из нашего шоурума\n` +
          `🚚 <b>ТК (покупатель)</b> — отправим транспортной компанией, оплачивает покупатель\n` +
          `🚚 <b>ТК (за наш счёт)</b> — отправим ТК, оплачиваем мы`,
    reply_markup: { inline_keyboard: keyboard }
  });
  
  // Next state: doc_awaiting_delivery
  await updateDocState(userId, 'doc_awaiting_delivery', context);
}

async function handleDeliverySelection(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  selection: 'pickup' | 'tc_buyer' | 'tc_seller'
): Promise<void> {
  if (selection === 'pickup') {
    context.delivery_method = 'pickup';
    context.transport_payment_type = undefined;
    context.transport_company_name = undefined;
    
    // Proceed to verification
    await showVerificationStep(chatId, userId, context);
  } else {
    // TC selected, need company name
    context.delivery_method = 'transport_company';
    context.transport_payment_type = selection === 'tc_buyer' ? 'buyer_pays' : 'seller_pays';
    
    await sendComplexMessage({
      chat_id: chatId,
      text: `✏️ <b>Шаг 7.1/8: Транспортная компания</b>\n\n` +
            `Укажите название транспортной компании:\n` +
            `(например, "Деловые Линии", "ПЭК", "СДЭК")`
    });
    
    // Next state: doc_awaiting_transport
    await updateDocState(userId, 'doc_awaiting_transport', context);
  }
}

async function handleTransportCompanyInput(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  companyName: string
): Promise<void> {
  context.transport_company_name = companyName.trim();
  
  // Proceed to verification
  await showVerificationStep(chatId, userId, context);
}
```

### 3.6 Save Draft to Database

```typescript
async function saveDocumentDraft(
  userId: string,
  crewSlug: string,
  docType: 'rent' | 'sale',
  context: DocFlowContext
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('document_drafts')
    .upsert({
      user_id: userId,
      crew_slug: crewSlug,
      doc_type: docType,
      current_step: context.current_step || 1,
      total_steps: context.total_steps || (docType === 'sale' ? 8 : 10),
      draft_data: context as unknown as Record<string, unknown>,
      corrected_steps: context.corrected_steps || [],
      status: 'in_progress',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()  // 30 min
    }, {
      onConflict: 'user_id,crew_slug,doc_type'
    });
  
  if (error) {
    logger.error('[/doc] Failed to save draft:', error);
  }
}

async function loadDocumentDraft(
  userId: string,
  crewSlug: string,
  docType: 'rent' | 'sale'
): Promise<DocFlowContext | null> {
  const { data, error } = await supabaseAdmin
    .from('document_drafts')
    .select('*')
    .eq('user_id', userId)
    .eq('crew_slug', crewSlug)
    .eq('doc_type', docType)
    .eq('status', 'in_progress')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  
  if (error || !data) {
    return null;
  }
  
  return data.draft_data as unknown as DocFlowContext;
}
```

---

## 4. UI UPDATES

### 4.1 Sales Analytics Card

**File:** `app/franchize/[slug]/sales-analytics/SalesAnalyticsClient.tsx`

Add delivery info to `SaleItemCard`:

```tsx
<div key={sale.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
  <div className="flex-1 space-y-1">
    {/* Existing fields */}
    <div className="flex items-center gap-2">
      <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
      <span className="text-sm font-semibold" style={{ color: textPrimary }}>
        {sale.buyer_full_name || "Без имени"}
      </span>
    </div>
    
    {/* NEW: Delivery method badge */}
    {sale.delivery_method && (
      <div className="flex items-center gap-2">
        <Bike className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentMain }} />
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: sale.delivery_method === 'pickup'
                  ? withAlpha(accentMain, 0.1)
                  : withAlpha('#10B981', 0.1),
                color: sale.delivery_method === 'pickup'
                  ? accentMain
                  : '#10B981'
              }}>
          {sale.delivery_method === 'pickup'
            ? '🏪 Самовывоз'
            : `🚚 ${sale.transport_company_name || 'ТК'}`}
        </span>
        {sale.transport_payment_type && (
          <span className="text-[10px]" style={{ color: textSecondary }}>
            ({sale.transport_payment_type === 'buyer_pays' ? 'опл. покуп.' : 'за наш счёт'})
          </span>
        )}
      </div>
    )}
    
    {/* Other existing fields */}
  </div>
  
  {/* Price column */}
  <div className="flex flex-col md:items-end gap-1">
    <div className="text-lg font-black" style={{ color: accentMain }}>
      {formatRubles(sale.sale_price)}
    </div>
    {sale.warranty_months && (
      <div className="text-[10px] uppercase tracking-wide" style={{ color: textSecondary }}>
        Гарантия: {sale.warranty_months} мес.
      </div>
    )}
    <div className="text-[10px]" style={{ color: textSecondary }}>
      {formatRussianDate(sale.created_at)}
    </div>
  </div>
</div>
```

---

## 5. API CHANGES

### 5.1 POST `/api/franchize/[slug]/sale-contracts`

Update request schema to include delivery fields:

```typescript
// Request
{
  buyer_full_name: string,
  buyer_passport: string,
  buyer_birth_date: string,
  buyer_address: string,
  bike_id: string,
  color_override?: string,
  vin_override?: string,
  sale_price: string,
  // NEW:
  delivery_method: 'pickup' | 'transport_company',
  transport_company_name?: string,
  transport_payment_type?: 'buyer_pays' | 'seller_pays'
}
```

---

## 6. TESTING SCENARIOS

### Scenario 1: Step Correction in Rent Flow
1. User starts `/doc` → selects "Аренда"
2. Completes steps 1-5 correctly
3. On step 6 (license), makes typo
4. Reaches verification (step 10)
5. Sees all data, notices error in step 6
6. Sends message: "6"
7. Bot re-asks step 6 ONLY: "Было указано: 99 76 123456 15.03 15.03. Введите правильное значение:"
8. User corrects → proceeds to verification again
9. Confirms → contract generated

### Scenario 2: Sale with TC Delivery
1. User starts `/doc` → selects "Покупка"
2. Completes steps 1-6 (name, passport, birth, address, color, VIN)
3. Step 7: enters price "390000"
4. Step 8: delivery method selection appears
5. Selects "🚚 ТК (покупатель)"
6. Bot asks: "Укажите название транспортной компании:"
7. User: "Деловые Линии"
8. Verification shows delivery info
9. Contract generated with delivery fields populated

### Scenario 3: Draft Recovery After Restart
1. User completes 5 steps of rent flow
2. Bot restarts / user disconnects
3. User sends `/doc` again
4. Bot detects existing draft: "Найден черновик договора аренды (шаг 5/10). Продолжить?"
5. User: "Да"
6. Bot resumes from step 5 with previous data preserved

---

## 7. OPEN QUESTIONS

### 7.1 Draft Expiry
- Current: 30 minutes
- Question: Should expiry be configurable per crew?

### 7.2 Multiple Drafts
- Current: One draft per user+crew+doc_type
- Question: Allow multiple parallel drafts (e.g., helping multiple customers)?

### 7.3 Transport Cost Calculation
- Current: Not calculated, just tracked
- Question: Should we auto-calculate TC cost based on distance and add to sale price?

---

## 8. SUCCESS METRICS

- ⏱️ Time saved on corrections: 60% reduction (no full restart)
- 📝 Draft recovery rate: >80% of interrupted flows completed
- 🚚 Delivery tracking: 100% of sales have delivery method recorded
- 😊 User satisfaction: <5% abandonment rate on verification step

---

## 9. IMPLEMENTATION PLAN

**Phase 1 (Days 1-2):** Database migrations (`document_drafts`, `sale_contract_artifacts` updates)  
**Phase 2 (Days 3-5):** Step numbering & verification UI in `doc-manual.ts`  
**Phase 3 (Days 6-7):** Step correction logic & draft persistence  
**Phase 4 (Days 8-9):** Delivery method step for sales  
**Phase 5 (Day 10):** Sales analytics UI updates  
**Phase 6 (Days 11-12):** Testing & bug fixes  
**Phase 7 (Day 13):** Production deployment  

---

**Document History:**
- v1.0 (2026-08-09): Initial draft based on enhancement requirements
