# PRD: /ekip Command — Equipment Rental/Selling for Telegram Bot

**Document Version:** 1.0  
**Date:** 2026-08-19  
**Status:** Draft  
**Reference Implementation:** `/doc` command (`app/webhook-handlers/commands/doc-manual.ts`)

---

## 1. Problem Statement

### Current Situation
- Operators can create bike rental/sale contracts via `/doc` command
- Equipment (helmets, gloves, jackets, etc.) can only be rented **with** a bike
- No standalone equipment rental flow exists
- Operators cannot sell equipment separately through Telegram
- Equipment inventory exists in `cars` table with `type='equipment'` but lacks dedicated contract flow

### Business Need
- Operators need to rent equipment to customers **without** requiring a bike rental
- Operators need to sell equipment to customers with proper documentation
- Need a streamlined Telegram flow similar to `/doc` for equipment-only transactions
- Legal requirement: equipment sales require written contracts (same as bikes)

### Goals
1. Enable standalone equipment rentals through Telegram
2. Enable equipment sales through Telegram
3. Maintain consistency with existing `/doc` command UX patterns
4. Generate legal contracts for equipment transactions
5. Track equipment rentals in `equipment_rentals` table

---

## 2. User Stories

### Rental Stories
- **US-R1**: As an operator, I want to rent a helmet to a customer without a bike, so I can generate revenue from equipment-only rentals
- **US-R2**: As an operator, I want to rent multiple equipment items (helmet + gloves + jacket), so I can outfit customers completely
- **US-R3**: As an operator, I want to specify rental duration (hours/days), so I can charge appropriately
- **US-R4**: As an operator, I want to set deposit amounts for equipment, so I'm protected against loss/damage

### Sale Stories
- **US-S1**: As an operator, I want to sell a helmet to a customer, so I can liquidate inventory
- **US-S2**: As an operator, I want to generate a sale contract for equipment, so I have legal documentation
- **US-S3**: As an operator, I want to record sale price and payment method, so I can track revenue

### Operator Stories
- **US-O1**: As an operator, I want a familiar flow (similar to `/doc`), so I don't need to learn new patterns
- **US-O2**: As an operator, I want quick-pick buttons for common equipment, so I can enter data quickly
- **US-O3**: As an operator, I want to correct mistakes mid-flow, so I don't have to restart

---

## 3. Functional Requirements

### 3.1 Command Entry
- **FR-1**: `/ekip` command initiates equipment transaction flow
- **FR-2**: System prompts for transaction type (Rent/Sale)
- **FR-3**: If equipment argument provided (e.g., `/ekip helmet-1`), skip selection step

### 3.2 Equipment Catalog
- **FR-4**: System displays available equipment from `cars` where `type='equipment'`
- **FR-5**: Equipment grouped by category (Helmets, Protection, Accessories)
- **FR-6**: Each item shows name and quick-pick button
- **FR-7**: Support text search by equipment ID/name

### 3.3 Rental Flow (9 steps)
| Step | Field | Input Type | Validation |
|------|-------|------------|------------|
| 1 | Equipment selection | Inline buttons | Must exist in catalog |
| 2 | Renter full name | Free text | Capitalize, min 2 chars |
| 3 | Passport | Free text | `series number date issuer` format |
| 4 | Birth date | Free text | DD.MM.YYYY format |
| 5 | Address | Free text | Min 5 chars |
| 6 | Start date/time | Quick-pick + custom | Parse "сегодня 18", "завтра 10" |
| 7 | End date/time | Quick-pick + custom | Parse relative to start |
| 8 | Payment split | Inline buttons | Cash/Bank/Split |
| 9 | Deposit | Inline buttons | Default 2000₽ or custom |

### 3.4 Sale Flow (6 steps)
| Step | Field | Input Type | Validation |
|------|-------|------------|------------|
| 1 | Equipment selection | Inline buttons | Must exist in catalog |
| 2 | Buyer full name | Free text | Capitalize, min 2 chars |
| 3 | Passport | Free text | `series number date issuer` format |
| 4 | Birth date | Free text | DD.MM.YYYY format |
| 5 | Address | Free text | Min 5 chars |
| 6 | Price | Quick-pick + custom | Number > 100 |

### 3.5 Pricing Logic
- **FR-8**: Helmets: 500₽/hour (<24h) or 1000₽/day (≥24h)
- **FR-9**: All other equipment: 500₽ flat per rental
- **FR-10**: Sale prices from equipment catalog `specs.sale_price`
- **FR-11**: Multi-day rentals calculate daily price × days

### 3.6 Contract Generation
- **FR-12**: Generate DOCX from HTML template `vip-bike_EQUIPMENT_REAL_DEAL_TEMPLATE.html`
- **FR-13**: Include equipment details, pricing, dates, parties
- **FR-14**: Send DOCX to operator via Telegram
- **FR-15**: Store contract in `private.equipment_contract_artifacts`

### 3.7 Database Records
- **FR-16**: Create `equipment_rentals` row for rentals
- **FR-17**: Create `equipment_contract_artifacts` row
- **FR-18**: Link to renter via phone (if provided)
- **FR-19**: Support СТС pledge option (like `/doc`)

### 3.8 Notifications
- **FR-20**: Send confirmation to operator with contract link
- **FR-21**: Notify admin of new equipment contract
- **FR-22**: Create crew_todos for equipment return

---

## 4. Flow Specification

### 4.1 Rental Flow (Step-by-Step)

```
Operator: /ekip
Bot: [Equipment catalog with categories]
  🪖 Шлемы
  🧤 Перчатки
  🧥 Защита (куртка, штаны, боты)
  🎒 Аксессуары (сетка, рюкзак, зарядка)

Operator: [Selects "Шлем Pro M" and "Перчатки Summer X"]
Bot: 🪖 Шлем Pro M
  🧤 Перчатки Summer X
  
  ✅ Добавить ещё
  ➡️ Далее

Operator: [Presses "Далее"]
Bot: ФИО арендатора

Operator: Иванов Иван Иванович
Bot: ✅ Иванов Иван Иванович
  
  Паспорт (4509 123456 15.03.2020 ОМВД)

Operator: 4509 123456 15.03.2020 ОМВД по Н.Новгороду
Bot: ✅ Паспорт 4509 123456 от 15.03.2020
  
  Дата рождения (15.03.1990)

Operator: 15.03.1990
Bot: ✅ 15.03.1990
  
  Адрес регистрации

Operator: г. Н.Новгород, ул. Комсомольская, д. 10, кв. 50
Bot: ✅
  
  Когда начинаем?
  [Сегодня 18:00] [Завтра 10:00]
  [✏️ Свое время]

Operator: [Presses "Сегодня 18:00"]
Bot: ✅ Старт: 19.08.2026 18:00
  
  Когда заканчиваем?
  [Сегодня 21:00 (3 ч)] [Завтра 10:00]
  [✏️ Свое время]

Operator: [Presses "Завтра 10:00"]
Bot: ✅ Конец: 20.08.2026 10:00
  
  ⏳ Расчёт стоимости...
  Аренда (1 день): 2 000 ₽
  Оборудование: 2 000 ₽
  Итого: 2 000 ₽
  
  Как будет оплачено?
  [💵 Всё наличными]
  [💳 Тинькофф] [💳 Сбербанк]
  [🔀 Смешанный]

Operator: [Presses "💵 Всё наличными"]
Bot: Депозит: 2 000 ₽
  
  [✅ Депозит 2000 ₽]
  [✏️ Своя сумма]
  [🪪 СТС вместо депозита]

Operator: [Presses "✅ Депозит 2000 ₽"]
Bot: 📋 Проверьте:
  
  👤 Иванов Иван Иванович
  🪪 4509 123456 от 15.03.2020
  📅 15.03.1990
  
  🪖 Шлем Pro M
  🧤 Перчатки Summer X
  
  📅 19.08.2026 18:00 → 20.08.2026 10:00
  💰 Итого: 2 000 ₽
  💴 Депозит: 2 000 ₽
  
  Всё верно?
  [✅ Всё верно] [↩️ Начать заново]
  [🔢 Исправить шаг] [❌ Отменить]

Operator: [Presses "✅ Всё верно"]
Bot: 📞 Телефон клиента
  (если клиент с сайта — введите номер для привязки)
  
  [⏭ Пропустить] [❌ Отменить]

Operator: [Presses "⏭ Пропустить"]
Bot: ⏳ Генерирую...
  
  [✅ Договор аренды оборудования готов]
  
  🪖 Шлем Pro M, 🧤 Перчатки Summer X
  👤 Иванов Иван Иванович
  📅 19.08.2026 18:00 → 20.08.2026 10:00
  💰 2 000 ₽ (наличными)
  💴 Депозит: 2 000 ₽ (наличными)
  
  <Deep links to web app>
```

### 4.2 Sale Flow (Step-by-Step)

```
Operator: /ekip
Bot: [Equipment catalog]

Operator: [Selects "Шлем Pro M"]
Bot: Тип сделки
  
  [📋 Аренда] [💰 Продажа]

Operator: [Presses "💰 Продажа"]
Bot: 💰 Продажа — ФИО

Operator: Петров Петр Петрович
Bot: ✅ Петров Петр Петрович
  
  Паспорт (4509 123456 15.03.2020 ОМВД)

[... passport, birth, address steps same as rental ...]

Bot: ✅
  
  💰 Цена
  [3 000 ₽ (из каталога)]
  [5 000 ₽] [7 000 ₽]
  [✏️ Своя цена]

Operator: [Presses "✏️ Своя цена"]
Bot: Введите цену (руб)

Operator: 4500
Bot: 📋 Продажа — проверьте:
  
  👤 Петров Петр Петрович
  🪪 4509 123456
  📅 15.03.1990
  🏠 [адрес]
  
  🪖 Шлем Pro M
  💰 4 500 ₽
  
  Всё верно?
  [✅ Всё верно] [↩️ Начать заново]
  [❌ Отменить]

Operator: [Presses "✅ Всё верно"]
Bot: ⏳ Генерирую...
  [Contract generated and sent]
```

### 4.3 Error Handling

| Error Type | Handler | Recovery |
|------------|---------|-----------|
| Invalid passport format | Re-prompt with example | User re-enters |
| Invalid date format | Re-prompt with START_DATE_EXAMPLES | User re-enters |
| Equipment not found | Show catalog again | User selects different |
| State expiry (30 min) | Clear state, suggest /ekip | User restarts |
| Callback timeout | Answer callback query anyway | User re-clicks button |

---

## 5. Technical Implementation Notes

### 5.1 File Structure
```
app/webhook-handlers/commands/
  ├── ekip-manual.ts          [NEW] Main /ekip command
  └── command-handler.ts      [MODIFY] Add /ekip routing

docs/crewDocs/
  └── vip-bike_EQUIPMENT_REAL_DEAL_TEMPLATE.html [NEW] Equipment contract template
```

### 5.2 State Machine
- Use `user_states` table for flow state (same as `/doc`)
- State namespacing: `ekip_rent_*` and `ekip_sale_*`
- Context interface: `EkipFlowContext` (similar to `DocFlowContext`)

### 5.3 Key Functions to Implement

```typescript
// ekip-manual.ts
export async function ekipCommand(chatId, userId, username, text)
export async function handleEkipText(userId, chatId, text): Promise<boolean>
export async function handleEkipCallback(userId, chatId, callbackData, callbackQueryId): Promise<boolean>

// State routers
async function gotoEquipmentSelection(chatId, userId, context)
async function gotoPaymentSplit(chatId, userId, context)  // Rental only
async function gotoDeposit(chatId, userId, context)         // Rental only
async function gotoPrice(chatId, userId, context)           // Sale only
async function gotoConfirm(chatId, userId, context)

// Keyboard builders
function buildEquipmentKeyboard(crewSlug): Promise<KeyboardButton[][]>
function buildDealKeyboard(): KeyboardButton[][]
function buildPaymentKeyboard(totalAmount): KeyboardButton[][]
function buildPriceKeyboard(): Promise<KeyboardButton[][]>

// Parsers
function parsePassport(text): PassportData | null
function parseStartDate(text): DateData | null
function parseEndDate(text, startDate): DateData | null

// Contract generation
async function generateEquipmentContract(chatId, userId, context, crewSlug): Promise<boolean>
```

### 5.4 Database Schema

Uses existing tables:
- `cars` (type='equipment') — Equipment catalog
- `equipment_rentals` — Rental tracking
- `equipment_contract_artifacts` (NEW in private schema) — Contract storage

```sql
-- New table for equipment contract artifacts
CREATE TABLE private.equipment_contract_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_key TEXT NOT NULL,
  crew_slug TEXT NOT NULL,
  storage_path TEXT,
  original_sha256 TEXT NOT NULL,
  requested_equipment_id TEXT NOT NULL,
  resolved_equipment_id TEXT NOT NULL,
  
  -- Deal type
  deal_type TEXT NOT NULL CHECK (deal_type IN ('rent', 'sale')),
  
  -- Parties
  telegram_chat_id TEXT NOT NULL,
  client_phone TEXT,
  created_by_operator_chat_id TEXT NOT NULL,
  
  -- Renter/Buyer info
  renter_full_name TEXT,
  renter_passport TEXT,
  renter_passport_issued_by TEXT,
  renter_passport_issue_date TEXT,
  renter_registration TEXT,
  renter_birth_date TEXT,
  
  -- Rental-specific
  rent_start_date TEXT,
  rent_end_date TEXT,
  daily_price NUMERIC,
  deposit_rub NUMERIC,
  total_sum NUMERIC,
  
  -- Sale-specific
  sale_price NUMERIC,
  
  -- Payment
  payment_cash_amount NUMERIC DEFAULT 0,
  payment_bank_amount NUMERIC DEFAULT 0,
  payment_card_destination TEXT CHECK (payment_card_destination IN ('tbank', 'sber')),
  
  -- СТС pledge
  sts_pledge_used BOOLEAN DEFAULT false,
  sts_series TEXT,
  sts_number TEXT,
  sts_issue_date TEXT,
  sts_vehicle_plate TEXT,
  sts_vehicle_vin TEXT,
  sts_vehicle_model TEXT,
  sts_vehicle_year TEXT,
  sts_owner_full_name TEXT,
  sts_owner_registration TEXT,
  sts_owner_relation TEXT,
  sts_pledge_return_days INTEGER DEFAULT 3,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  template_version INTEGER DEFAULT 1,
  
  -- Indexes
  UNIQUE (contract_key, crew_slug)
);

-- Indexes
CREATE INDEX idx_equipment_contract_artifacts_crew_slug ON private.equipment_contract_artifacts(crew_slug);
CREATE INDEX idx_equipment_contract_artifacts_contract_key ON private.equipment_contract_artifacts(contract_key);
CREATE INDEX idx_equipment_contract_artifacts_deal_type ON private.equipment_contract_artifacts(deal_type);
```

### 5.5 Template Variables

The `vip-bike_EQUIPMENT_REAL_DEAL_TEMPLATE.html` template accepts:

```typescript
interface EquipmentContractVars {
  // Common
  contract_number: string;
  day: string;
  month: string;
  month_num: string;
  year: string;
  
  // Parties
  renter_full_name: string;
  renter_short_name: string;
  renter_birth_date: string;
  renter_passport_number: string;
  renter_passport_issued_by: string;
  renter_passport_issue_date: string;
  renter_registration: string;
  renter_phone: string;
  
  // Equipment
  equipment_make: string;
  equipment_model: string;
  equipment_type: string;
  equipment_count: number;  // For multiple items
  equipment_list: string;    // Comma-separated list
  
  // Pricing
  daily_price_rub: string;
  subtotal_rub: string;
  deposit_rub: string;
  
  // Dates (rental only)
  rent_start_date: string;
  rent_start_time: string;
  rent_end_date: string;
  rent_end_time: string;
  
  // Sale only
  sale_price_rub: string;
  sale_price_words: string;
  
  // Payment
  payment_cash_rub: string;
  payment_bank_rub: string;
  
  // Organization
  organization_name: string;
  organization_short: string;
  ogrnip: string;
  inn: string;
  legal_address: string;
  // ... (same as /doc)
}
```

### 5.6 Equipment Selection UX

Equipment organized by category:

```typescript
interface EquipmentCategory {
  id: string;
  label: string;
  icon: string;
  items: EquipmentItem[];
}

const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  {
    id: 'helmets',
    label: 'Шлемы',
    icon: '🪖',
    items: [], // Loaded from cars table
  },
  {
    id: 'gloves',
    label: 'Перчатки',
    icon: '🧤',
    items: [],
  },
  {
    id: 'protection',
    label: 'Защита',
    icon: '🛡️',
    items: [], // Jackets, pants, boots
  },
  {
    id: 'accessories',
    label: 'Аксессуары',
    icon: '🎒',
    items: [], // Net, backpack, charger
  },
];
```

Multi-selection keyboard for rentals:

```typescript
function buildEquipmentSelectionKeyboard(context: EkipFlowContext): KeyboardButton[][] {
  const selected = context.selectedEquipment || [];  // Array of equipment IDs
  
  return [
    // Equipment items with toggle buttons
    ...categories.flatMap(cat => 
      cat.items.map(item => [{
        text: `${selected.includes(item.id) ? '✅' : '⬜'} ${item.make} ${item.model}`,
        callback_data: `eq_select_${item.id}`,
      }])
    ),
    
    // Action buttons
    [{ text: '✅ Готово (выбрано: N)', callback_data: 'eq_done' }],
    [{ text: '❌ Отменить', callback_data: 'cancel' }],
  ];
}
```

---

## 6. API Endpoints Needed

### 6.1 Equipment Catalog

```typescript
// GET /api/equipment/catalog
// Returns equipment list for a crew
interface EquipmentCatalogResponse {
  success: boolean;
  data: {
    categories: EquipmentCategory[];
  };
}
```

### 6.2 Equipment Contract Lookup

```typescript
// GET /api/equipment/contract/:key
// Returns contract details by key
interface EquipmentContractResponse {
  success: boolean;
  data: {
    contract: EquipmentContractArtifact;
    equipment: EquipmentItem[];
  };
}
```

### 6.3 Equipment List (for admin)

```typescript
// GET /api/equipment/list?crewSlug={slug}&status={active|returned}
// Lists equipment rentals for crew
interface EquipmentListResponse {
  success: boolean;
  data: EquipmentRental[];
}
```

---

## 7. UI/UX Specifications for Telegram Inline Keyboards

### 7.1 Button Design Patterns

| Pattern | Usage | Example |
|---------|-------|---------|
| ✅ ⬜ | Toggle selection | `✅ Шлем Pro M` |
| ➡️ | Next step | `➡️ Далее` |
| ✏️ | Custom input | `✏️ Своя цена` |
| ❌ | Cancel action | `❌ Отменить` |
| ⏭ | Skip optional | `⏭ Пропустить` |

### 7.2 Keyboard Layout Rules

1. **Primary actions** on first row (left)
2. **Secondary actions** on second row
3. **Cancel** always on bottom row (right)
4. **Max 2 buttons per row** for readability
5. **Row limit**: 8 rows max (Telegram API limit)

### 7.3 Message Formatting

```typescript
// Step headers
const stepHeader = (step: number, total: number, label: string) => 
  `*Шаг ${step}/${total}: ${label}*`;

// Confirmation summaries
const rentSummary = (ctx: EkipFlowContext) => `
*📋 Проверьте:*

👤 ${ctx.renterFullName}
🪪 ${ctx.passportSeries} ${ctx.passportNumber}
📅 ${ctx.birthDate}

${ctx.selectedEquipment.map(e => `🔹 ${e.make} ${e.model}`).join('\n')}

📅 ${ctx.startDate} ${ctx.startTime} → ${ctx.endDate} ${ctx.endTime}
💰 Итого: ${ctx.totalAmount.toLocaleString('ru-RU')} ₽
💴 Депозит: ${ctx.depositAmount.toLocaleString('ru-RU')} ₽

Всё верно?
`;

// Success message
const successMessage = (contract: EquipmentContract) => `
✅ *Договор ${contract.dealType === 'rent' ? 'аренды' : 'продажи} оборудования готов*

${contract.equipmentList.map(e => `🔹 ${e.make} ${e.model}`).join('\n')}
👤 ${contract.renterFullName}
${contract.dealType === 'rent' ? `📅 ${contract.startDate} → ${contract.endDate}` : `💰 ${contract.salePrice.toLocaleString('ru-RU')} ₽`}

${contract.links}
`;
```

### 7.4 Color Coding (Emojis)

| Category | Emoji | Usage |
|----------|-------|-------|
| 🪖 | Helmet | Head protection |
| 🧤 | Gloves | Hand protection |
| 🧥 | Jacket | Body protection |
| 👖 | Pants | Leg protection |
| 👢 | Boots | Foot protection |
| 🎒 | Backpack/Bag | Storage |
| 🌐 | Safety Net | Cargo |
| 🔌 | Charger | Electronics |

---

## 8. Integration Points

### 8.1 Command Handler Integration

Add to `command-handler.ts`:

```typescript
// Import
import { ekipCommand, handleEkipText, handleEkipCallback } from "./ekip-manual";

// Command routing
if (command === '/ekip' || command === '/equipment') {
    await ekipCommand(chatId, userId, username, text);
    return;
}

// Callback routing
if (update.callback_query && (
    text.startsWith('eq_') ||
    text.startsWith('ep_') ||  // ekip payment
    text.startsWith('ed_') ||  // ekip deposit
    text === 'ekip_done' ||
    text === 'ekip_cancel'
)) {
    const handled = await handleEkipCallback(userIdStr, chatId, text, update.callback_query.id);
    if (handled) return;
}

// Text routing (state-based)
const ekipState = await getState(userIdStr);
if (ekipState?.state?.startsWith('ekip_')) {
    const handled = await handleEkipText(userIdStr, chatId, text);
    if (handled) return;
}
```

### 8.2 Help Command Integration

Add `/ekip` to help text:

```typescript
const helpText = `
...
📦 *Equipment*
/ekip — Аренда/продажа экипировки (шлемы, перчатки, защита)
`;
```

### 8.3 Admin Notifications

Reuse `/doc` notification patterns:

```typescript
// After contract generation
await notifyAdmin(`
📦 *Новый договор оборудования*

${contract.dealType === 'rent' ? '🔄 Аренда' : '💰 Продажа'}
${equipmentList}
👤 ${contract.renterFullName}
📞 ${contract.clientPhone || 'не указан'}

${rentalLink}
`);
```

---

## 9. Testing Checklist

### 9.1 Rental Flow Tests
- [ ] Select single equipment item
- [ ] Select multiple equipment items
- [ ] Toggle equipment selection (add/remove)
- [ ] Complete renter info (name, passport, birth, address)
- [ ] Set start date (today/tomorrow/custom)
- [ ] Set end date (same-day/next-day/custom)
- [ ] Verify pricing calculation
- [ ] Select payment method (cash/bank/split)
- [ ] Set deposit amount
- [ ] Skip phone input
- [ ] Generate contract
- [ ] Receive DOCX via Telegram
- [ ] Verify database records

### 9.2 Sale Flow Tests
- [ ] Select equipment for sale
- [ ] Complete buyer info
- [ ] Set sale price (catalog/custom)
- [ ] Generate contract
- [ ] Verify no deposit required

### 9.3 Error Handling Tests
- [ ] Invalid passport format
- [ ] Invalid date format
- [ ] Equipment not found
- [ ] State expiry (wait 30 min)
- [ ] Cancel mid-flow
- [ ] Restart mid-flow
- [ ] Step correction

### 9.4 Integration Tests
- [ ] СТС pledge flow (if supported)
- [ ] Equipment catalog loading
- [ ] Crew-specific equipment filtering
- [ ] Admin notification delivery
- [ ] Contract storage upload

---

## 10. Open Questions

| Question | Options | Decision | Date |
|----------|---------|----------|------|
| Support СТС pledge for equipment? | Yes/No | TBD | |
| Max equipment items per rental? | 5/10/Unlimited | TBD | |
| Equipment bundle discounts? | Yes/No | TBD | |
| Link equipment rental to bike rental? | Yes/No | Already in /doc | |
| Equipment return checklist? | Yes/No | TBD | |

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Command usage | 50+ rentals/month | `equipment_contract_artifacts` count |
| Average flow time | <3 min | State timestamps |
| Error rate | <5% | Error logs / total attempts |
| Contract generation success | >95% | Success / total |

---

## 12. References

1. **Gold Standard Implementation**: `/doc` command (`app/webhook-handlers/commands/doc-manual.ts`)
2. **Equipment Rentals Module**: `app/franchize/server-actions/equipment-rentals.ts`
3. **Template Reference**: `docs/crewDocs/vip-bike_RENTAL_DEAL_TEMPLATE.html`
4. **Database Schema**: Migration `20260812000006_seed_equipment.sql`
5. **State Management Pattern**: `user_states` table (shared across commands)

---

## Appendix A: Equipment Type Mapping

```typescript
const EQUIPMENT_TYPE_PRICES = {
  helmet: { hourly: 500, daily: 1000 },
  gloves: { flat: 500 },
  jacket: { flat: 500 },
  pants: { flat: 500 },
  boots: { flat: 500 },
  net: { flat: 500 },
  backpack: { flat: 500 },
  bag: { flat: 500 },
  charger: { flat: 0 },  // Free but tracked
};

function calculateEquipmentPrice(
  type: EquipmentType,
  hours: number
): number {
  const config = EQUIPMENT_TYPE_PRICES[type];
  if (!config) return 0;
  
  if (config.hourly && config.daily) {
    // Helmets: hourly <24h, daily ≥24h
    return hours < 24 ? config.hourly : config.daily;
  }
  
  if (config.flat) {
    return config.flat;
  }
  
  return 0;
}
```

---

## Appendix B: State Transition Diagram

```
[Start]
  │
  ├─→ /ekip
  │     │
  │     ├─→ equipment_select ──> deal_type ──> (rent|sale)
  │     │                                      │
  │     │                                      ├─→ rent flow
  │     │                                      │   ├─→ name ──> passport ──> birth ──> address
  │     │                                      │   └─> schedule_start ──> schedule_end
  │     │                                      │       └─> payment_split ──> deposit ──> confirm
  │     │                                      │
  │     │                                      └─→ sale flow
  │     │                                          └─→ name ──> passport ──> birth ──> address
  │     │                                              └─> price ──> confirm
  │     │
  │     └─→ any state ──> cancel/restart/step_correction
  │
  [End]
```

---

**Document End**
