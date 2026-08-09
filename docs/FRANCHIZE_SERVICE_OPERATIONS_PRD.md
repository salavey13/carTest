# FRANCHIZE-WIDE SERVICE OPERATIONS & PAYROLL SYSTEM PRD

**Version:** 2.1  
**Date:** 2026-08-09  
**Status:** Draft for Review  
**Applies to:** All crews (vip-bike, nnvolt, etc.) via `[slug]` dynamic routing  
**Related Files:** `app/franchize/[slug]/dashboard/`, `app/franchize/[slug]/analytics/`, `app/franchize/[slug]/sales-analytics/`

---

## 1. EXECUTIVE SUMMARY

### 1.1 Problem Statement

Сервисы экипажей (VIP BIKE, NNVolt, и др.) нуждаются в унифицированной системе учета:

- **Доходы:** аренда байков, продажа услуг сервиса, аренда оборудования (шлемы)
- **Расходы:** зарплата сотрудников (механики, менеджеры), переводы из кассы
- **Зарплата:** расчет ЗП с бонусами от аренды/продаж/услуг сервиса с выплатами 10 и 25 числа
- **Ежедневная отчетность:** для ассистента и владельца экипажа
- **Оборудование:** учет выдачи шлемов и экипировки (требуется новая таблица `equipment_rentals`, т.к. `rental_handoffs` не существует)

### 1.2 Current Architecture Analysis

#### ✅ Existing Tables (from `supabase.txt` snapshot 2026-07-23):

**Public Schema:**
```sql
-- Crews & Members
public.crews                    -- id, slug, name, owner_id, theme
public.crew_members             -- id, crew_id, user_id, role (owner|co_owner|admin|mechanic|member)
public.users                    -- user_id, username, full_name, metadata->role

-- Catalog & Rentals
public.cars                     -- id, make, model, type ('bike'|'accessories'), specs->sale_price, specs->rent_weekday_hour
public.rentals                  -- rental_id, crew_id, vehicle_id, user_id, status, total_cost, metadata->service_description

-- Private Schema (PII & Contracts)
private.user_rental_secrets     -- chat_id, crew_slug, passport data, STS pledge
private.rental_contract_artifacts -- contract_key, rental_id, crew_slug, PDF storage_path
private.sale_contract_artifacts   -- contract_key, buyer_*, sale_price, warranty_months, crew_slug
```

#### ❌ Identified Gaps:

1. **NO `service_operations` table** — услуги сервиса (сборка, настройка, ремонт) хранятся только в `rentals.metadata->service_description` без структуризации
2. **NO `equipment_rentals` table** — шлемы и оборудование не имеют отдельного финансового учета аренды
3. **NO `cash_transactions` ledger** — доходы/расходы разрознены по таблицам, нет единого cash flow
4. **NO `commission_rates` configuration** — ставки комиссий менеджерам не настраиваются гибко
5. **NO `salary_plans` with payout schedule** — нет плана ЗП с привязкой к 10 и 25 числам
6. **NO `rental_handoffs` table** — выдача/возврат оборудования (шлемов) не отслеживается явно в БД
7. **NO `document_drafts` table** — состояние черновиков документов не сохраняется между сессиями

#### ⚠️ Important Findings from Deep Investigation:

- **`rental_handoffs` does NOT exist** in current schema (supabase.txt 2026-07-23) — выдача шлемов НЕ отслеживается на уровне БД
  - **Solution:** Create `public.equipment_rentals` table as single source of truth for equipment tracking
  - No need to create `rental_handoffs` — equipment rentals table is cleaner approach
  
- **`crew_member_shifts` FULLY EXISTS AND WORKS** ✅
  - Table structure confirmed: id, member_id, crew_id, clock_in_time, clock_out_time, duration_minutes (generated), hourly_rate, salary_amount, checkpoint (jsonb), actions (jsonb)
  - Trigger `trg_calc_shift_salary` auto-calculates salary on clock_out (BEFORE INSERT OR UPDATE OF clock_out_time)
  - Migration file: `app/wb/sql/shift_checkpoint.sql` adds checkpoint/actions JSONB columns
  - Bot command `/shift` implemented in `app/webhook-handlers/commands/shift.ts`
  - API endpoint `/api/crew/shifts` for CRUD operations (POST start, DELETE end, GET active)
  - **Integration:** Use existing `crew_member_shifts` table for base salary calculation in `salary_plans` via foreign key relationship
  
- **`document_drafts` does NOT exist** — doc-manual.ts state persistence needs new table (PRD #2 proposes this)

- **"vip-bike" is a crew slug** — NEVER hardcoded; all paths use `[slug]` parameter ✅

- **Existing sales-analytics** (`app/franchize/[slug]/sales-analytics/SalesAnalyticsClient.tsx`) shows `SaleDashboardItem` without delivery method field — needs update

### 1.3 Franchise Architecture Alignment

All new features MUST work for ANY crew via dynamic routing:

```
app/franchize/[slug]/
├── dashboard/              -- Crew-specific dashboard (already exists)
├── analytics/              -- Rental analytics (already exists)
├── sales-analytics/        -- Sales analytics (already exists)
├── service-operations/     -- NEW: Service operations tracking
├── equipment/              -- NEW: Equipment rentals management
├── finance/                -- NEW: Cash flow & transactions
└── salary/                 -- NEW: Employee salary plans & calculations

api/franchize/[slug]/
├── service-operations/     -- POST/GET service operations
├── equipment-rentals/      -- POST/GET equipment rentals
├── cash-transactions/      -- POST/GET cash transactions
└── salary/                 -- GET salary calculations, POST plans
```

---

## 2. PROPOSED DATABASE SCHEMA

### 2.1 Migration Strategy

All new tables follow naming conventions from existing migrations:
- Prefix: `YYYYMMDDHHMMSS_` timestamp
- Suffix: descriptive name
- Location: `supabase/migrations/` (to be created)
- Update `supabase.txt` after migration

### 2.2 Table: `public.service_operations`

**Purpose:** Учет операций сервиса для любого экипажа

```sql
-- Migration: 20260809000001_create_service_operations.sql

CREATE TABLE public.service_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  
  -- Operation details
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'assembly',      -- Сборка (например Folkon GT)
    'tuning',        -- Настройка (ослабление цепи, регулировка)
    'repair',        -- Ремонт
    'maintenance',   -- ТО
    'installation',  -- Установка (колеса, суппорты)
    'removal',       -- Снятие
    'inspection'     -- Диагностика
  )),
  
  -- Link to bike/equipment
  vehicle_id TEXT REFERENCES public.cars(id),
  equipment_ids TEXT[],  -- Array of equipment IDs (helmets, wheels)
  
  -- Link to rental (if service is part of rental)
  rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL,
  
  -- Financials
  customer_price NUMERIC NOT NULL CHECK (customer_price > 0),
  technician_cost NUMERIC NOT NULL CHECK (technician_cost >= 0),
  -- Constraint: customer_price should be >= technician_cost * 2 (enforced in app logic)
  
  -- Technician assignment
  technician_id TEXT REFERENCES public.users(user_id),
  technician_commission_pct NUMERIC DEFAULT 0.50,  -- 50% by default
  
  -- Description
  description TEXT NOT NULL,
  detailed_notes TEXT,
  time_spent_minutes INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN (
    'scheduled', 'in_progress', 'completed', 'cancelled', 'billed'
  )),
  
  -- Dates
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT now(),
  billed_at TIMESTAMPTZ,
  
  -- Payment
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'included_in_rental', 'deferred')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial', 'waived')),
  paid_at TIMESTAMPTZ,
  
  -- Audit
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_service_operations_crew ON public.service_operations(crew_id);
CREATE INDEX idx_service_operations_vehicle ON public.service_operations(vehicle_id);
CREATE INDEX idx_service_operations_rental ON public.service_operations(rental_id);
CREATE INDEX idx_service_operations_technician ON public.service_operations(technician_id);
CREATE INDEX idx_service_operations_completed_at ON public.service_operations(completed_at DESC);

-- RLS Policies
ALTER TABLE public.service_operations ENABLE ROW LEVEL SECURITY;

-- Crew members can read their crew's operations
CREATE POLICY "Crew members can read service operations" 
  ON public.service_operations FOR SELECT
  USING (
    crew_id IN (
      SELECT crew_id FROM public.crew_members
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND (users.metadata->>'role')::text = 'admin'
    )
  );

-- Crew owners and admins can manage
CREATE POLICY "Crew owners can manage service operations"
  ON public.service_operations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.crews
      WHERE crews.id = service_operations.crew_id
      AND crews.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND (users.metadata->>'role')::text = 'admin'
    )
  );

COMMENT ON TABLE public.service_operations IS 'Service operations tracking for all crews. Customer price typically = 2x technician cost.';
```

### 2.3 Table: `public.equipment_rentals`

**Purpose:** Аренда оборудования (шлемы, экипировка) отдельно от аренды байка

```sql
-- Migration: 20260809000002_create_equipment_rentals.sql

CREATE TABLE public.equipment_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  
  -- Equipment being rented
  equipment_id TEXT NOT NULL REFERENCES public.cars(id),
  
  -- Renter info
  renter_user_id TEXT REFERENCES public.users(user_id),
  renter_name TEXT NOT NULL,
  renter_phone TEXT,
  renter_email TEXT,
  
  -- Link to primary rental (optional)
  primary_rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL,
  
  -- Financials
  rental_price NUMERIC NOT NULL CHECK (rental_price >= 0),
  deposit_amount NUMERIC DEFAULT 0,
  
  -- Rental period
  rented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_at TIMESTAMPTZ,
  actually_returned_at TIMESTAMPTZ,
  
  -- Condition tracking
  condition_at_rent TEXT DEFAULT 'good' CHECK (condition_at_rent IN ('excellent', 'good', 'fair', 'damaged')),
  condition_at_return TEXT,
  damage_notes TEXT,
  
  -- Issued/received by crew members
  issued_by TEXT REFERENCES public.users(user_id),
  received_by TEXT REFERENCES public.users(user_id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'returned', 'lost', 'damaged', 'overdue'
  )),
  
  -- Payment
  payment_method TEXT,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial', 'waived')),
  paid_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_equipment_rentals_crew ON public.equipment_rentals(crew_id);
CREATE INDEX idx_equipment_rentals_equipment ON public.equipment_rentals(equipment_id);
CREATE INDEX idx_equipment_rentals_renter ON public.equipment_rentals(renter_user_id);
CREATE INDEX idx_equipment_rentals_status ON public.equipment_rentals(status);
CREATE INDEX idx_equipment_rentals_rented_at ON public.equipment_rentals(rented_at DESC);

-- RLS
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members can read equipment rentals"
  ON public.equipment_rentals FOR SELECT
  USING (
    crew_id IN (
      SELECT crew_id FROM public.crew_members
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND (users.metadata->>'role')::text = 'admin'
    )
  );

COMMENT ON TABLE public.equipment_rentals IS 'Equipment rentals (helmets, gear) tracking for all crews';
```

### 2.4 Table: `public.cash_transactions`

**Purpose:** Единый реестр всех денежных движений для экипажа

```sql
-- Migration: 20260809000003_create_cash_transactions.sql

CREATE TABLE public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  
  -- Transaction type
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'income_rental',       -- Доход от аренды
    'income_sale',         -- Доход от продажи
    'income_service',      -- Доход от услуг сервиса
    'income_equipment',    -- Доход от аренды оборудования
    'expense_salary',      -- Расход на зарплату
    'expense_commission',  -- Комиссия менеджеру
    'expense_tech_work',   -- Оплата техники
    'expense_cashout',     -- Расход из кассы (перевод)
    'expense_other',       -- Другие расходы
    'transfer_in',         -- Входящий перевод
    'transfer_out'         -- Исходящий перевод
  )),
  
  -- Amount
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'RUB',
  
  -- Payment method
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash', 'bank_transfer', 'telegram_stars', 'sbp'
  )),
  
  -- Flow direction
  flow_direction TEXT NOT NULL CHECK (flow_direction IN ('in', 'out')),
  
  -- Links to entities
  rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL,
  sale_contract_id UUID,  -- References private.sale_contract_artifacts(id)
  service_operation_id UUID REFERENCES public.service_operations(id) ON DELETE SET NULL,
  equipment_rental_id UUID REFERENCES public.equipment_rentals(id) ON DELETE SET NULL,
  
  -- Counterparties
  from_user_id TEXT REFERENCES public.users(user_id),
  to_user_id TEXT REFERENCES public.users(user_id),
  recipient_name TEXT,  -- For external recipients
  recipient_bank TEXT,
  
  -- Categorization
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'reversed')),
  
  -- Dates
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  value_date TIMESTAMPTZ,
  
  -- Documents
  document_url TEXT,
  receipt_number TEXT,
  
  -- Description
  description TEXT NOT NULL,
  notes TEXT,
  
  -- Balance snapshots (optional)
  cash_balance_before NUMERIC,
  cash_balance_after NUMERIC,
  bank_balance_before NUMERIC,
  bank_balance_after NUMERIC,
  
  -- Audit
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cash_transactions_crew ON public.cash_transactions(crew_id);
CREATE INDEX idx_cash_transactions_type ON public.cash_transactions(transaction_type);
CREATE INDEX idx_cash_transactions_date ON public.cash_transactions(transaction_date DESC);
CREATE INDEX idx_cash_transactions_rental ON public.cash_transactions(rental_id);
CREATE INDEX idx_cash_transactions_flow ON public.cash_transactions(flow_direction);
CREATE INDEX idx_cash_transactions_category ON public.cash_transactions(category);

-- RLS
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members can read transactions"
  ON public.cash_transactions FOR SELECT
  USING (
    crew_id IN (
      SELECT crew_id FROM public.crew_members
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND (users.metadata->>'role')::text = 'admin'
    )
  );

-- View: Daily Cash Flow Summary per Crew
CREATE OR REPLACE VIEW public.daily_cash_flow AS
SELECT
  crew_id,
  DATE(transaction_date) as date,
  transaction_type,
  flow_direction,
  SUM(amount) as total_amount,
  COUNT(*) as transaction_count,
  payment_method
FROM public.cash_transactions
WHERE status = 'completed'
GROUP BY crew_id, DATE(transaction_date), transaction_type, flow_direction, payment_method;

COMMENT ON TABLE public.cash_transactions IS 'Unified cash flow ledger for all crews';
```

### 2.5 Table: `public.commission_rates`

**Purpose:** Гибкие настройки комиссионных ставок для менеджеров любого экипажа

```sql
-- Migration: 20260809000004_create_commission_rates.sql

CREATE TABLE public.commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  
  -- Operation type
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'rental_hourly',
    'rental_daily',
    'rental_weekly',
    'sale_bike',
    'sale_accessories',
    'service_assembly',
    'service_tuning',
    'equipment_rental'
  )),
  
  -- Commission type
  commission_type TEXT NOT NULL CHECK (commission_type IN (
    'percentage',
    'fixed_amount',
    'tiered'
  )),
  
  commission_value NUMERIC NOT NULL,  -- 0.15 = 15% or 500 RUB
  
  -- Tiered commission bounds
  tier_min_amount NUMERIC,
  tier_max_amount NUMERIC,
  
  -- Validity period
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  -- Priority (if multiple rules match)
  priority INTEGER DEFAULT 0,
  
  -- Metadata
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_commission_rule UNIQUE (crew_id, operation_type, priority)
);

-- Indexes
CREATE INDEX idx_commission_rates_crew ON public.commission_rates(crew_id);
CREATE INDEX idx_commission_rates_operation ON public.commission_rates(operation_type);
CREATE INDEX idx_commission_rates_validity ON public.commission_rates(valid_from, valid_until);

-- RLS
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew owners can manage commission rates"
  ON public.commission_rates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.crews
      WHERE crews.id = commission_rates.crew_id
      AND crews.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND (users.metadata->>'role')::text = 'admin'
    )
  );

COMMENT ON TABLE public.commission_rates IS 'Flexible commission rates configuration per crew';
```

### 2.6 Table: `public.salary_plans`

**Purpose:** Планы зарплаты сотрудников с выплатами 10 и 25 числа

```sql
-- Migration: 20260809000005_create_salary_plans.sql

CREATE TABLE public.salary_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_member_id UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  
  -- Plan period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Base rates
  base_salary NUMERIC DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 500,
  
  -- Commission percentages
  rental_commission_pct NUMERIC DEFAULT 0.10,
  sale_commission_pct NUMERIC DEFAULT 0.05,
  service_commission_pct NUMERIC DEFAULT 0.25,
  
  -- Targets & bonuses
  rental_target NUMERIC,
  sale_target NUMERIC,
  bonus_if_target_met NUMERIC,
  
  -- Payout schedule
  payout_schedule TEXT[] DEFAULT ARRAY['10', '25'],  -- Days of month
  last_payout_date DATE,
  next_payout_date DATE,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  
  -- Calculated totals (updated by trigger)
  calculated_base_salary NUMERIC DEFAULT 0,
  calculated_commissions NUMERIC DEFAULT 0,
  calculated_bonus NUMERIC DEFAULT 0,
  total_accrued NUMERIC GENERATED ALWAYS AS (
    calculated_base_salary + calculated_commissions + calculated_bonus
  ) STORED,
  total_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC GENERATED ALWAYS AS (total_accrued - total_paid) STORED,
  
  -- Audit
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_period CHECK (period_end >= period_start)
);

-- Indexes
CREATE INDEX idx_salary_plans_member ON public.salary_plans(crew_member_id);
CREATE INDEX idx_salary_plans_period ON public.salary_plans(period_start, period_end);
CREATE INDEX idx_salary_plans_status ON public.salary_plans(status);

-- RLS
ALTER TABLE public.salary_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew owners can manage salary plans"
  ON public.salary_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.crew_members cm
      JOIN public.crews c ON cm.crew_id = c.id
      WHERE cm.id = salary_plans.crew_member_id
      AND c.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND (users.metadata->>'role')::text = 'admin'
    )
  );

-- View: Active Salary Plans Summary
CREATE OR REPLACE VIEW public.active_salary_plans_summary AS
SELECT
  cm.id as crew_member_id,
  cm.user_id,
  u.full_name as employee_name,
  c.name as crew_name,
  c.slug as crew_slug,
  sp.period_start,
  sp.period_end,
  sp.base_salary,
  sp.calculated_commissions,
  sp.total_accrued,
  sp.total_paid,
  sp.balance_due,
  sp.next_payout_date,
  sp.status
FROM public.crew_members cm
JOIN public.users u ON cm.user_id = u.user_id
JOIN public.crews c ON cm.crew_id = c.id
JOIN public.salary_plans sp ON cm.id = sp.crew_member_id
WHERE sp.status = 'active'
  AND CURRENT_DATE BETWEEN sp.period_start AND sp.period_end;

COMMENT ON TABLE public.salary_plans IS 'Employee salary plans with commissions and 10th/25th payout schedule';
```

### 2.7 Table: `public.salary_calculations`

**Purpose:** Детальный расчет зарплаты за период с разбивкой по источникам

```sql
-- Migration: 20260809000006_create_salary_calculations.sql

CREATE TABLE public.salary_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_plan_id UUID NOT NULL REFERENCES public.salary_plans(id) ON DELETE CASCADE,
  crew_member_id UUID NOT NULL REFERENCES public.crew_members(id),
  
  -- Calculation period
  calculation_period_start DATE NOT NULL,
  calculation_period_end DATE NOT NULL,
  
  -- Hours worked
  total_hours_worked NUMERIC DEFAULT 0,
  total_shifts INTEGER DEFAULT 0,
  
  -- Volume by source
  rental_volume NUMERIC DEFAULT 0,
  sale_volume NUMERIC DEFAULT 0,
  service_volume NUMERIC DEFAULT 0,
  
  -- Commissions
  rental_commission NUMERIC DEFAULT 0,
  sale_commission NUMERIC DEFAULT 0,
  service_commission NUMERIC DEFAULT 0,
  total_commission NUMERIC GENERATED ALWAYS AS (
    rental_commission + sale_commission + service_commission
  ) STORED,
  
  -- Bonuses
  target_met_bonus NUMERIC DEFAULT 0,
  other_bonus NUMERIC DEFAULT 0,
  
  -- Totals
  base_pay NUMERIC DEFAULT 0,
  gross_total NUMERIC GENERATED ALWAYS AS (
    base_pay + total_commission + target_met_bonus + other_bonus
  ) STORED,
  
  -- Deductions
  deductions NUMERIC DEFAULT 0,
  deduction_reason TEXT,
  
  -- Net pay
  net_pay NUMERIC GENERATED ALWAYS AS (gross_total - deductions) STORED,
  
  -- Payout
  payout_date DATE,
  payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN (
    'pending', 'approved', 'paid', 'cancelled'
  )),
  payout_method TEXT,
  payout_reference TEXT,
  
  -- Breakdown (JSONB array)
  breakdown JSONB,  -- [{type: 'rental', amount: 5000, commission: 500, date: '2026-08-08'}, ...]
  
  -- Audit
  calculated_by TEXT NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  paid_by TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT
);

-- Indexes
CREATE INDEX idx_salary_calculations_plan ON public.salary_calculations(salary_plan_id);
CREATE INDEX idx_salary_calculations_member ON public.salary_calculations(crew_member_id);
CREATE INDEX idx_salary_calculations_period ON public.salary_calculations(calculation_period_start, calculation_period_end);
CREATE INDEX idx_salary_calculations_payout ON public.salary_calculations(payout_status, payout_date);

-- RLS
ALTER TABLE public.salary_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can read own calculations"
  ON public.salary_calculations FOR SELECT
  USING (
    crew_member_id IN (
      SELECT id FROM public.crew_members
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.crew_members cm
      JOIN public.crews c ON cm.crew_id = c.id
      WHERE cm.id = salary_calculations.crew_member_id
      AND c.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.salary_calculations IS 'Detailed salary calculations per period with breakdown by source';
```

### 2.8 Table: `public.document_drafts`

**Purpose:** Сохранение состояния черновиков для `/doc` команды (step correction feature)

```sql
-- Migration: 20260809000007_create_document_drafts.sql

CREATE TABLE public.document_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(user_id),
  crew_slug TEXT NOT NULL,
  
  -- Document type
  doc_type TEXT NOT NULL CHECK (doc_type IN ('rent', 'sale')),
  
  -- Current step
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 10,
  
  -- Collected data (JSONB)
  draft_data JSONB NOT NULL DEFAULT '{}',
  /*
   Example structure:
   {
     "full_name": "Иванов Иван Иванович",
     "passport": "4509 123456 15.03.2020 ОМВД",
     "birth_date": "15.03.1990",
     "address": "г. Москва, ул. Ленина 1",
     "has_license": true,
     "license": "99 76 123456 15.03 15.03",
     "categories": ["A", "B"],
     "start_date": "2026-08-09T18:00:00Z",
     "end_date": "2026-08-10T10:00:00Z",
     "deposit_choice": "confirm",
     "bike_id": "vivolt-dual-color",
     "deal_type": "rent",
     "delivery_method": "pickup",  // For sale only
     "transport_company": "Деловые Линии"  // For sale only
   }
  */
  
  -- Step correction tracking
  corrected_steps INTEGER[],  -- Array of step numbers that were corrected
  
  -- Status
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'expired')),
  
  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_steps CHECK (current_step >= 1 AND current_step <= total_steps)
);

-- Indexes
CREATE INDEX idx_document_drafts_user ON public.document_drafts(user_id);
CREATE INDEX idx_document_drafts_crew ON public.document_drafts(crew_slug);
CREATE INDEX idx_document_drafts_status ON public.document_drafts(status);
CREATE INDEX idx_document_drafts_expires ON public.document_drafts(expires_at);

-- RLS
ALTER TABLE public.document_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own drafts"
  ON public.document_drafts FOR ALL
  USING (user_id = auth.uid());

-- Function: Auto-cleanup expired drafts
CREATE OR REPLACE FUNCTION public.cleanup_expired_drafts()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.document_drafts
  WHERE expires_at < now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Run cleanup daily
-- (Requires pg_cron extension or scheduled Edge Function)

COMMENT ON TABLE public.document_drafts IS 'Document draft state persistence for /doc command with step correction support';
```

---

## 3. INTEGRATION PATTERNS

### 3.1 Sync Rentals with Service Operations

**Trigger:** When rental includes service work in metadata

```sql
-- Migration: 20260809000008_trigger_sync_rental_service.sql

CREATE OR REPLACE FUNCTION public.sync_rental_service_operation()
RETURNS TRIGGER AS $$
BEGIN
  -- If rental has service_description in metadata, create service_operation
  IF NEW.metadata->>'service_description' IS NOT NULL THEN
    INSERT INTO public.service_operations (
      operation_type,
      rental_id,
      vehicle_id,
      customer_price,
      technician_cost,
      description,
      technician_id,
      crew_id,
      status,
      completed_at,
      created_by
    )
    VALUES (
      'tuning',  -- Default for rental-related service
      NEW.rental_id,
      NEW.vehicle_id,
      (NEW.metadata->>'service_price')::NUMERIC,
      (NEW.metadata->>'service_price')::NUMERIC * 0.5,  -- 50% to technician
      NEW.metadata->>'service_description',
      NULL,  -- Assign technician later
      NEW.crew_id,
      'completed',
      NEW.updated_at,
      auth.jwt() ->> 'chat_id'
    );
    
    -- Create income transaction
    INSERT INTO public.cash_transactions (
      transaction_type,
      amount,
      flow_direction,
      payment_method,
      rental_id,
      category,
      description,
      crew_id,
      created_by
    )
    VALUES (
      'income_service',
      (NEW.metadata->>'service_price')::NUMERIC,
      'in',
      COALESCE(NEW.metadata->>'payment_method', 'cash'),
      NEW.rental_id,
      'Сервис',
      NEW.metadata->>'service_description',
      NEW.crew_id,
      auth.jwt() ->> 'chat_id'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_rental_service ON public.rentals;
CREATE TRIGGER trg_sync_rental_service
  AFTER INSERT ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rental_service_operation();
```

### 3.2 Auto-create Cash Transactions on Service Operation Completion

```sql
-- Migration: 20260809000009_trigger_auto_service_transaction.sql

CREATE OR REPLACE FUNCTION public.auto_create_service_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Income transaction
    INSERT INTO public.cash_transactions (
      transaction_type,
      amount,
      flow_direction,
      payment_method,
      service_operation_id,
      category,
      subcategory,
      description,
      crew_id,
      created_by
    )
    VALUES (
      'income_service',
      NEW.customer_price,
      'in',
      COALESCE(NEW.payment_method, 'cash'),
      NEW.id,
      'Сервис',
      NEW.operation_type,
      NEW.description,
      NEW.crew_id,
      NEW.created_by
    );
    
    -- Technician expense transaction
    INSERT INTO public.cash_transactions (
      transaction_type,
      amount,
      flow_direction,
      payment_method,
      to_user_id,
      category,
      description,
      crew_id,
      created_by
    )
    VALUES (
      'expense_tech_work',
      NEW.technician_cost,
      'out',
      'cash',
      NEW.technician_id,
      'Зарплата',
      'Оплата техники: ' || NEW.description,
      NEW.crew_id,
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_service_transaction ON public.service_operations;
CREATE TRIGGER trg_auto_service_transaction
  AFTER UPDATE OF status ON public.service_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_service_transaction();
```

### 3.3 Calculate Manager Commission on Rental Completion

```sql
-- Migration: 20260809000010_trigger_rental_commission.sql

CREATE OR REPLACE FUNCTION public.calculate_rental_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_pct NUMERIC;
  v_commission_amount NUMERIC;
  v_manager_id TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get commission rate for this crew
    SELECT commission_value INTO v_commission_pct
    FROM public.commission_rates
    WHERE crew_id = NEW.crew_id
      AND operation_type = 'rental_hourly'
      AND CURRENT_DATE BETWEEN valid_from AND COALESCE(valid_until, CURRENT_DATE)
    ORDER BY priority DESC
    LIMIT 1;
    
    v_commission_pct := COALESCE(v_commission_pct, 0.10);  -- Default 10%
    v_commission_amount := NEW.total_cost * v_commission_pct;
    
    -- Get crew owner (manager)
    SELECT owner_id INTO v_manager_id
    FROM public.crews
    WHERE id = NEW.crew_id;
    
    -- Create commission transaction
    INSERT INTO public.cash_transactions (
      transaction_type,
      amount,
      flow_direction,
      category,
      description,
      rental_id,
      to_user_id,
      crew_id,
      created_by
    )
    VALUES (
      'expense_commission',
      v_commission_amount,
      'out',
      'Комиссия',
      'Комиссия с аренды #' || SUBSTRING(NEW.rental_id::TEXT FROM 1 FOR 8),
      NEW.rental_id,
      v_manager_id,
      NEW.crew_id,
      auth.jwt() ->> 'chat_id'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rental_commission ON public.rentals;
CREATE TRIGGER trg_rental_commission
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_rental_commission();
```

---

## 4. API SPECIFICATION

All endpoints are crew-scoped via `[slug]` parameter.

### 4.1 POST `/api/franchize/[slug]/service-operations`

**Purpose:** Create service operation record

```typescript
// Request
{
  operation_type: "assembly",
  vehicle_id: "folkon-gt-125",
  rental_id?: "uuid",
  customer_price: 1250,
  technician_id: "vlad-user-id",
  technician_commission_pct: 0.50,
  description: "Сборка Folkon GT",
  detailed_notes: "Снятие/установка пер. колеса, с суппортами",
  time_spent_minutes: 90,
  payment_method: "cash"
}

// Response
{
  id: "uuid",
  operation_type: "assembly",
  customer_price: 1250,
  technician_cost: 625,
  profit_margin: 625,
  status: "completed",
  created_at: "2026-08-09T16:56:00Z"
}
```

### 4.2 POST `/api/franchize/[slug]/equipment-rentals`

**Purpose:** Rent out equipment (helmets)

```typescript
// Request
{
  equipment_id: "vivolt-helmet-black",
  renter_name: "Клиент",
  renter_phone: "+7...",
  primary_rental_id?: "uuid",
  rental_price: 500,
  deposit_amount: 3000,
  expected_return_at: "2026-08-10T20:00:00Z",
  issued_by: "user-id"
}
```

### 4.3 POST `/api/franchize/[slug]/cash-transactions`

**Purpose:** Record cash transaction

```typescript
// Request
{
  transaction_type: "expense_cashout",
  amount: 2000,
  payment_method: "bank_transfer",
  flow_direction: "out",
  recipient_name: "Илья Т Банк",
  category: "Расход",
  description: "Перевод Илья Т Банк"
}
```

### 4.4 GET `/api/franchize/[slug]/dashboard/daily-report`

**Purpose:** Generate daily report for assistant

```typescript
// Response
{
  date: "2026-08-09",
  crew_slug: "vip-bike",
  summary: {
    total_income: 15500,
    total_expenses: 5200,
    net_cashflow: 10300,
    by_category: {
      rental_income: 12000,
      service_income: 2000,
      equipment_income: 1500,
      salary_expenses: 3200,
      tech_work_expenses: 1000
    }
  },
  service_operations: [...],
  equipment_rentals: [...],
  pending_payouts: {
    next_date: "2026-08-10",
    total_due: 45000,
    by_employee: [...]
  }
}
```

### 4.5 GET `/api/franchize/[slug]/salary/:employee-id`

**Purpose:** Calculate employee salary

```typescript
// Response
{
  employee: {
    name: "Влад",
    role: "mechanic",
    crew: "vip-bike"
  },
  period: {
    start: "2026-08-01",
    end: "2026-08-15",
    next_payout: "2026-08-25"
  },
  earnings: {
    base_salary: 15000,
    rental_commission: 3500,
    service_commission: 6250,
    total_accrued: 24750
  },
  payouts: {
    paid_on_10th: 12000,
    pending_on_25th: 12750
  },
  breakdown: [...]
}
```

---

## 5. DATA MIGRATION STRATEGY

### 5.1 Backfill Service Operations from Rentals

```sql
-- Extract service operations from existing rentals with service metadata
INSERT INTO public.service_operations (
  operation_type,
  rental_id,
  vehicle_id,
  customer_price,
  technician_cost,
  description,
  crew_id,
  status,
  completed_at,
  created_by
)
SELECT
  'tuning' as operation_type,
  r.rental_id,
  r.vehicle_id,
  (r.metadata->>'service_price')::NUMERIC,
  (r.metadata->>'service_price')::NUMERIC * 0.5,
  r.metadata->>'service_description',
  r.crew_id,
  'completed',
  r.updated_at,
  r.owner_id
FROM public.rentals r
WHERE r.metadata->>'service_description' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.service_operations so
    WHERE so.rental_id = r.rental_id
  );
```

### 5.2 Backfill Cash Transactions from Rentals

```sql
-- Rental income transactions
INSERT INTO public.cash_transactions (
  transaction_type,
  amount,
  flow_direction,
  payment_method,
  rental_id,
  category,
  description,
  crew_id,
  transaction_date,
  status,
  created_by
)
SELECT
  'income_rental',
  r.total_cost,
  'in',
  COALESCE((r.metadata->>'payment_method'), 'cash'),
  r.rental_id,
  'Аренда',
  'Аренда ' || (SELECT model FROM public.cars WHERE id = r.vehicle_id),
  r.crew_id,
  r.created_at,
  'completed',
  r.owner_id
FROM public.rentals r
WHERE r.status IN ('completed', 'active')
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_transactions ct
    WHERE ct.rental_id = r.rental_id
      AND ct.transaction_type = 'income_rental'
  );
```

---

## 6. OPEN QUESTIONS

### 6.1 Commission Rates (To Be Confirmed by Crew Owners)
- Rental commission: __% (suggested 10%)
- Sale commission: __% (suggested 5%)
- Service commission to technician: __% (suggested 50%)
- Service commission to manager: __% (suggested 25%)

### 6.2 Salary Plan Parameters
- Base hourly rate: 500₽ (default) or different?
- Rental target for bonus: _____₽
- Sale target for bonus: _____₽
- Bonus amount: _____₽

### 6.3 Historical Data Digitization
- Period to backfill: Last month (August 2026) or longer?
- Approach: Manual entry vs CSV import vs hybrid?

---

## 7. SUCCESS METRICS

- ⏱️ Time to record service operation: < 30 seconds
- 📊 Daily report generation: < 5 seconds
- ✅ Data accuracy: 99%+ reconciliation rate
- 💰 Real-time cash balance tracking
- 👥 Zero salary disputes

---

## 8. IMPLEMENTATION PLAN

**Phase 1 (Week 1):** Database migrations, RLS policies, indexes  
**Phase 2 (Week 2):** Core API endpoints, service operations workflow  
**Phase 3 (Week 3):** Salary system, commission calculations  
**Phase 4 (Week 4):** Reporting, automation, Boss skill integration  
**Phase 5 (Week 5):** Data backfill, testing, production deployment  

---

**Document History:**
- v2.1 (2026-08-09): Generalized for all crews, aligned with existing supabase.txt schema, removed hardcoded "vip-bike"
