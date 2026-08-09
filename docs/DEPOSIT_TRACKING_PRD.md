# DEPOSIT & PAYMENT TRACKING ENHANCEMENT PRD

**Version:** 1.0
**Date:** 2026-08-10
**Status:** Ready for Implementation
**Related:** `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md` §6.6, `docs/DOC_MANUAL_STEP_CORRECTION_PRD.md`

---

## 1. PROBLEM

### 1.1 Current State
- `deposit_log` table exists with `method` column (only `cash` in production — 14 rows)
- `doc-manual.ts` has a `payment_split` step: "Всё наличными" / "Всё безнал" / split
- "Безнал" (bank transfer) does NOT specify WHICH card — T-Bank or Sber
- No way to track where money actually went
- `deposit_log.method` CHECK allows `cash, bank_transfer, telegram_stars, none` — but `bank_transfer` doesn't distinguish cards

### 1.2 What's Needed
- When operator collects deposit or rental payment, they choose:
  - 💵 **Наличные** (cash)
  - 💳 **Карта Тинькофф** (card1 / tbank — DEFAULT)
  - 💳 **Карта Сбербанк** (card2 / sber)
- Each money movement creates a `deposit_entry` row linked to the rental
- Both deposit collection AND rental payment are tracked

---

## 2. DATABASE CHANGES

### 2.1 New Table: `public.deposit_entries`

Replaces the narrow `deposit_log` (which stays for backward compat). Each row = one money movement (deposit collected, deposit returned, rental payment, equipment payment).

```sql
-- Migration: 20260810000010_create_deposit_entries.sql

CREATE TABLE IF NOT EXISTS public.deposit_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id       UUID NOT NULL REFERENCES public.rentals(rental_id) ON DELETE CASCADE,

  -- What kind of money movement
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
    'deposit_collected',    -- Депозит получен
    'deposit_returned',     -- Депозит возвращён
    'rental_payment',       -- Оплата аренды
    'equipment_payment',    -- Оплата оборудования
    'sale_payment',         -- Оплата покупки
    'service_payment',      -- Оплата сервиса
    'penalty',              -- Штраф/удержание из депозита
    'adjustment'            -- Ручная корректировка
  )),

  -- Amount and direction
  amount          NUMERIC NOT NULL CHECK (amount >= 0),
  direction       TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  -- 'in' = money came TO the business (deposit collected, rental paid)
  -- 'out' = money left the business (deposit returned, refund)

  -- WHERE the money went (THE KEY ENHANCEMENT)
  destination     TEXT NOT NULL CHECK (destination IN (
    'cash',     -- Наличные
    'tbank',    -- Карта Тинькофф (card 1, default)
    'sber',     -- Карта Сбербанк (card 2)
    'stars'     -- Telegram Stars
  )),

  -- Who and when
  operator_chat_id TEXT NOT NULL, -- who collected/returned (FK to users.user_id conceptually)
  rental_id_at_time TEXT, -- rental_id as string (for audit if rental is deleted)

  -- Notes
  notes           TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_deposit_entries_rental ON public.deposit_entries(rental_id);
CREATE INDEX idx_deposit_entries_destination ON public.deposit_entries(destination);
CREATE INDEX idx_deposit_entries_type ON public.deposit_entries(entry_type);
CREATE INDEX idx_deposit_entries_date ON public.deposit_entries(created_at);
CREATE INDEX idx_deposit_entries_operator ON public.deposit_entries(operator_chat_id);

-- RLS
ALTER TABLE public.deposit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read deposit entries"
  ON public.deposit_entries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.rentals r
            JOIN public.crew_members cm ON cm.crew_id = r.crew_id
            WHERE r.rental_id = deposit_entries.rental_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );
CREATE POLICY "Crew owners can manage deposit entries"
  ON public.deposit_entries FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.rentals r
            JOIN public.crews c ON c.id = r.crew_id
            WHERE r.rental_id = deposit_entries.rental_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );

-- View: daily deposit summary by destination
CREATE OR REPLACE VIEW public.daily_deposit_summary AS
SELECT
  DATE(de.created_at AT TIME ZONE 'Europe/Moscow') as flow_date,
  de.destination,
  de.entry_type,
  SUM(CASE WHEN de.direction = 'in' THEN de.amount ELSE 0 END) as total_in,
  SUM(CASE WHEN de.direction = 'out' THEN de.amount ELSE 0 END) as total_out,
  SUM(CASE WHEN de.direction = 'in' THEN de.amount ELSE -de.amount END) as net,
  COUNT(*) as entry_count
FROM public.deposit_entries de
GROUP BY DATE(de.created_at AT TIME ZONE 'Europe/Moscow'), de.destination, de.entry_type
ORDER BY flow_date DESC, destination;
```

### 2.2 Backfill from `deposit_log`

```sql
-- Migrate existing deposit_log rows to deposit_entries
INSERT INTO public.deposit_entries (rental_id, entry_type, amount, direction, destination, operator_chat_id, notes, created_at)
SELECT
  dl.rental_id::UUID,
  CASE WHEN dl.action = 'collected' THEN 'deposit_collected' ELSE 'deposit_returned' END,
  dl.amount,
  CASE WHEN dl.action = 'collected' THEN 'in' ELSE 'out' END,
  'cash', -- all existing are cash
  dl.operator_chat_id,
  dl.notes,
  dl.created_at
FROM public.deposit_log dl
WHERE NOT EXISTS (
  SELECT 1 FROM public.deposit_entries de
  WHERE de.rental_id = dl.rental_id::UUID
    AND de.created_at = dl.created_at
);
```

### 2.3 Keep `deposit_log` for backward compat

Don't drop `deposit_log` — existing code writes to it. New code writes to BOTH tables during transition, then eventually only to `deposit_entries`.

---

## 3. DOC-MANUAL INTEGRATION

### 3.1 Deposit Collection Step Enhancement

**Current** `buildDepositChoiceKeyboard` (line 341):
```
[✅ Депозит 20 000 ₽]  [✏️ Своя сумма]  [🪪 СТС вместо депозита]  [❌ Отменить]
```

**Enhanced** — after choosing deposit amount, ask WHERE it was collected:
```
Step 1: [✅ Депозит 20 000 ₽]  [✏️ Своя сумма]  [🪪 СТС]  [❌ Отменить]
Step 2: Где получен депозит?
        [💵 Наличные]  [💳 Тинькофф]  [💳 Сбербанк]  [⭐ Stars]
```

**New state:** `deposit_destination` (between `deposit_choice` and `equipment`)

**New DocFlowContext fields:**
```typescript
depositDestination?: 'cash' | 'tbank' | 'sber' | 'stars';
```

**On confirm:** Insert into `deposit_entries`:
```sql
INSERT INTO public.deposit_entries (
  rental_id, entry_type, amount, direction, destination, operator_chat_id, notes
) VALUES (
  $rentalId, 'deposit_collected', $depositAmount, 'in', $destination, $userId, 'Deposit collected via /doc'
);
```

### 3.2 Payment Split Step Enhancement

**Current** `buildPaymentSplitKeyboard` (line 405):
```
[💰 Итого: 15 000 ₽]
[💵 Ввести сумму наличными]
[✅ Всё наличными]
[💳 Всё безнал]
[❌ Отменить]
```

**Enhanced** — "безнал" now asks which card:
```
Step 1: [💰 Итого: 15 000 ₽]
        [💵 Ввести сумму наличными]
        [✅ Всё наличными]
        [💳 Всё на Тинькофф]
        [💳 Всё на Сбербанк]
        [🔀 Смешанная оплата]
        [❌ Отменить]

Step 2 (if mixed): "Сколько наличными?"
Step 3 (if mixed): "Остаток (5 000₽) — куда?"
                   [💳 Тинькофф]  [💳 Сбербанк]
```

**New DocFlowContext fields:**
```typescript
paymentDestination?: 'cash' | 'tbank' | 'sber' | 'stars';
// For mixed payments:
cashAmount?: number;
bankDestination?: 'tbank' | 'sber';
bankAmount?: number;
```

**On confirm:** Insert into `deposit_entries`:
```sql
-- Cash portion
INSERT INTO public.deposit_entries (
  rental_id, entry_type, amount, direction, destination, operator_chat_id, notes
) VALUES (
  $rentalId, 'rental_payment', $cashAmount, 'in', 'cash', $userId, 'Rental payment (cash)'
);

-- Bank portion (if any)
IF $bankAmount > 0 THEN
  INSERT INTO public.deposit_entries (
    rental_id, entry_type, amount, direction, destination, operator_chat_id, notes
  ) VALUES (
    $rentalId, 'rental_payment', $bankAmount, 'in', $bankDestination, $userId, 'Rental payment (card)'
  );
END IF;
```

### 3.3 Deposit Return on Rental Completion

**Current:** `deposit_log` auto-creates a `returned` row when rental status → `completed`.

**Enhanced:** Auto-create `deposit_entries` row with the SAME destination as collection:
```sql
-- In the trigger that fires on rental completion:
INSERT INTO public.deposit_entries (
  rental_id, entry_type, amount, direction, destination, operator_chat_id, notes
)
SELECT
  rental_id, 'deposit_returned', amount, 'out', destination, operator_chat_id, 'Auto-returned on rental completion'
FROM public.deposit_entries
WHERE rental_id = NEW.rental_id AND entry_type = 'deposit_collected'
ORDER BY created_at DESC LIMIT 1;
-- Copies the destination from the original collection
```

---

## 4. ADMIN DEBUG PAGE

### 4.1 `/franchize/[slug]/admin/deposits`

Visual deposit tracker:

**Filters:**
- Date picker (default: today)
- Destination filter: All / Cash / T-Bank / Sber / Stars
- Entry type filter: All / Collected / Returned / Payments

**Summary cards (top):**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 💵 Наличные   │ │ 💳 Тинькофф   │ │ 💳 Сбербанк   │ │ ⭐ Stars     │
│              │ │              │ │              │ │              │
│ +15 000₽    │ │ +40 000₽    │ │ +0₽         │ │ +0₽         │
│ -5 000₽     │ │ -0₽         │ │ -0₽         │ │ -0₽         │
│ ─────────   │ │ ─────────   │ │ ─────────   │ │ ─────────   │
│ Итого: 10к  │ │ Итого: 40к  │ │ Итого: 0    │ │ Итого: 0    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Table:**
| Time | Rental | Type | Amount | Destination | Operator |
|------|--------|------|--------|-------------|----------|
| 12:11 | kawasaki-ex650k | deposit_collected | +20 000₽ | 💵 Cash | DJORUDJOV |
| 12:15 | kawasaki-ex650k | rental_payment | +9 000₽ | 💳 T-Bank | DJORUDJOV |
| 14:30 | ducati-panigale | deposit_collected | +20 000₽ | 💳 Sber | Roman |
| 16:00 | kawasaki-ex650k | deposit_returned | -20 000₽ | 💵 Cash | system |

Color-coded: green = `in`, red = `out`.

---

## 5. NEW SKILL: `deposit-tracer-text`

```
Trigger phrases: "где депозиты", "статус депозитов", "депозиты на картах",
"cash or card", "deposit trace", "депозиты сегодня", "куда пришли деньги"

Commands:
1. deposit-list [--date YYYY-MM-DD] [--destination cash|tbank|sber|stars]
   Lists all deposit_entries for a date, filtered by destination.
   Shows: time, rental, type, amount, destination, operator

2. deposit-balance [--from YYYY-MM-DD] [--to YYYY-MM-DD]
   Summary per destination:
   - Cash: +X collected, -Y returned, net = X-Y
   - T-Bank: +X collected, -Y returned, net = X-Y
   - Sber: +X collected, -Y returned, net = X-Y
   - Stars: +X collected, -Y returned, net = X-Y

3. deposit-rental <rentalId>
   Shows all deposit_entries for a specific rental:
   - 12:11 deposit_collected +20 000₽ cash by DJORUDJOV
   - 12:15 rental_payment +9 000₽ tbank by DJORUDJOV
   - 16:00 deposit_returned -20 000₽ cash (auto-return)

4. deposit-card <tbank|sber> [--date YYYY-MM-DD]
   Shows all money that went to a specific card today:
   - 12:15 rental_payment +9 000₽ (kawasaki-ex650k)
   - 14:30 deposit_collected +20 000₽ (ducati-panigale)
   Total on T-Bank today: 29 000₽
```

---

## 6. RELATIONSHIP TO `rental_handoffs`

The `rental_handoffs` migration (`20260623000003_rental_handoffs.sql`) was NEVER APPLIED to production. It tracks:
- Odometer start/end
- Fuel/battery levels
- Equipment checklist (helmets, jacket, keys, charger, etc.)
- Damage notes
- Handout/return phases

**Recommendation:** APPLY this migration — the code (`rental-handoffs.ts` server action + `RentalHandoffModal.tsx` UI) already exists and expects this table. Without it, the handoff modal crashes silently.

The `deposit_entries` table is SEPARATE from `rental_handoffs`:
- `rental_handoffs` = physical handout/return checklist (odometer, equipment, damage)
- `deposit_entries` = financial movements (where money went)

Both link to `rentals.rental_id` via FK.

---

## 7. IMPLEMENTATION PLAN

1. **Migration:** `20260810000010_create_deposit_entries.sql` (table + view + RLS + backfill from deposit_log)
2. **Migration:** Apply `20260623000003_rental_handoffs.sql` (if not already applied — it wasn't!)
3. **doc-manual.ts:** Add `deposit_destination` state after `deposit_choice`
4. **doc-manual.ts:** Enhance `buildPaymentSplitKeyboard` with card-specific buttons
5. **doc-manual.ts:** Insert into `deposit_entries` on deposit collection + rental payment
6. **Trigger:** Auto-create `deposit_returned` entry on rental completion (copies destination from collection)
7. **Admin page:** `/franchize/[slug]/admin/deposits` visual tracker
8. **Skill:** `deposit-tracer-text` for text-based deposit queries
9. **Evening digest:** Add deposit summary per card to `evening-summary.sh`

---

**Document History:**
- v1.0 (2026-08-10): Initial draft — separates deposit tracking from the service operations PRD, creates `deposit_entries` table with `destination` column (cash/tbank/sber/stars), ties into doc-manual deposit + payment steps
