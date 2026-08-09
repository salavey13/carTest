# FRANCHIZE-WIDE SERVICE OPERATIONS & PAYROLL SYSTEM PRD

**Version:** 3.0 (Polished — cross-referenced with production Supabase + actual code)
**Date:** 2026-08-09
**Status:** Ready for Implementation
**Related:** `docs/PRD_AUDIT_FINDINGS.md` (full audit), `docs/DOC_MANUAL_STEP_CORRECTION_PRD.md`

---

## 0. PRODUCTION REALITY (verified via direct Supabase queries)

Before reading this PRD, understand what ACTUALLY exists in production:

### Tables that EXIST:
| Table | Schema | Key Columns |
|-------|--------|-------------|
| `cars` | public | `id TEXT PK, make, model, type, specs JSONB, crew_id` — types in prod: `bike`(40), `wb_item`(78), `parts`(22), `service`(20), `car`(2), `accessory`(2), `gear`(2), `sauna`(1) |
| `rentals` | public | `rental_id UUID PK, user_id, vehicle_id→cars, owner_id, crew_id, status, total_cost, metadata JSONB` — equipment NOT stored in metadata |
| `crew_members` | public | `id UUID PK, crew_id→crews, user_id→users, role(owner\|co_owner\|admin\|mechanic\|member), membership_status, live_status` |
| `crew_member_shifts` | public | `id, member_id, crew_id, clock_in_time, clock_out_time, duration_minutes(generated), hourly_rate, salary_amount(generated), shift_type, notes, checkpoint JSONB, actions JSONB` — trigger `trg_calc_shift_salary` auto-calcs salary |
| `deposit_log` | public | `id, rental_id→rentals, action(collected\|returned), amount, method(cash\|bank_transfer\|telegram_stars\|none), operator_chat_id, notes` |
| `franchize_intents` | public | `id, slug, bike_id, intent_type, stage, metadata JSONB, telegram_user_id, phone` |
| `crew_todos` | public | `id, crew_id, lead_id, user_id, rental_id→rentals, title, status, priority, category, description JSONB` |
| `user_states` | public | `user_id, state, context JSONB, expires_at(30min)` — already used by doc-manual.ts for draft persistence |
| `user_rental_secrets` | private | `chat_id, crew_slug, doc_sha256, renter_*` |
| `rental_contract_artifacts` | private | `contract_key, crew_slug, rental_id→rentals, renter_*, original_sha256` |
| `sale_contract_artifacts` | private | `contract_key, crew_slug, buyer_*, sale_price, total_sum` |

### Tables that DO NOT EXIST (despite migration files):
| Table | Migration exists? | Applied? |
|-------|-------------------|----------|
| `rental_handoffs` | ✅ `20260623000003_rental_handoffs.sql` | ❌ NEVER APPLIED |
| `subrent_contract_artifacts` | ✅ `20260624000000` | ❌ NEVER APPLIED |
| `testdrive_contract_artifacts` | ✅ `20260809000000` | ❌ NOT YET APPLIED |
| `commercial_proposal_artifacts` | ✅ `20260617000001` | ❌ NEVER APPLIED |

### Key Architecture Facts:
1. **Services are `rentals` rows** where `vehicle_id IN (SELECT id FROM cars WHERE type='service')` — 20 service items exist (Нормо-час, Замена масла, etc.)
2. **Equipment is collected in `DocFlowContext`** (helmets, gloves, jacket, boots, net, backpack, bag, charger) but **NOT stored in `rentals` DB** — only goes to DOCX template
3. **`/shift` bot command + `/api/crew/shifts` API already work** — shift tracking is functional
4. **`deposit_log` is a narrow cash ledger** — only tracks deposits, not income/expenses
5. **`auth.jwt() ->> 'chat_id'` returns NULL with service_role** — all server actions use `supabaseAdmin`
6. **RLS must use `auth.jwt() ->> 'chat_id'`** (TEXT), NOT `auth.uid()` (UUID) — `users.user_id` is TEXT

---

## 1. EXECUTIVE SUMMARY

### 1.1 Problem Statement

The franchise needs:
1. **Standalone equipment rental** — rent helmets/jackets/etc separately from bike rentals (currently equipment is only tracked as "preset with bike" in DocFlowContext, lost after contract generation)
2. **Unified cash ledger** — income/expense tracking across rentals, sales, services, equipment, commissions, salaries (currently scattered across `rentals.total_cost`, `sale_contract_artifacts.sale_price`, `deposit_log`, `crew_member_shifts.salary_amount`)
3. **Commission configuration** — per-crew, per-operation-type commission rates (currently nothing)
4. **Salary plans with payout schedule** — 10th/25th payout cycle, per-period calculations (currently `crew_member_shifts.salary_amount` auto-calcs but no plan/payout concept)

### 1.2 What We're NOT Creating (reuse existing instead)

| Proposed | Why not | Reuse instead |
|----------|---------|---------------|
| `service_operations` table | Services already work as `rentals` with `cars.type='service'` | Extend `rentals.metadata` if needed |
| `document_drafts` table | `user_states` already persists drafts (30-min TTL) | Extend `user_states` with step columns |
| `rental_handoffs` table (from old migration) | Migration exists but never applied; equipment_rentals covers the gap | `equipment_rentals` (this PRD) |

### 1.3 What We ARE Creating

| Table | Purpose |
|-------|---------|
| `equipment_rentals` | Standalone equipment rental tracking (helmets, jackets, etc. rented without a bike) |
| `cash_transactions` | Unified ledger (income + expense + commissions + salaries) |
| `commission_rates` | Configurable commission percentages per crew + operation type |
| `salary_plans` | Payout schedule (10th/25th) + period tracking |
| `salary_calculations` | Per-period salary breakdown (shifts + commissions) |

---

## 2. PROPOSED DATABASE SCHEMA

### 2.1 Migration Strategy

All migrations use `IF NOT EXISTS` / `IF EXISTS` for idempotency. Apply in order:
1. `20260810000003_create_equipment_rentals.sql`
2. `20260810000004_create_cash_transactions.sql`
3. `20260810000005_create_commission_rates.sql`
4. `20260810000006_create_salary_plans.sql`
5. `20260810000007_create_salary_calculations.sql`
6. `20260810000008_seed_equipment_items.sql` (add helmets/jackets as `cars.type='equipment'`)

### 2.2 Table: `public.equipment_rentals`

**Purpose:** Track standalone equipment rentals (not tied to a bike rental). Equipment items are stored as `cars` rows with `type='equipment'`.

```sql
CREATE TABLE IF NOT EXISTS public.equipment_rentals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id         UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  equipment_id    TEXT NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  renter_user_id  TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  primary_rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL, -- NULL for standalone

  -- Rental period
  start_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date        TIMESTAMPTZ,
  expected_return_date TIMESTAMPTZ,

  -- Pricing
  daily_price     NUMERIC NOT NULL DEFAULT 0,
  total_cost      NUMERIC NOT NULL DEFAULT 0,

  -- Status
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'returned', 'lost', 'damaged', 'overdue'
  )),

  -- Handoff tracking (replaces never-applied rental_handoffs)
  issued_by       TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  received_by     TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  issued_at       TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  condition_notes TEXT, -- damage notes on return

  -- Metadata
  created_by      TEXT, -- operator chat_id (no FK — matches crew_todos pattern)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_rentals_crew ON public.equipment_rentals(crew_id);
CREATE INDEX idx_equipment_rentals_equipment ON public.equipment_rentals(equipment_id);
CREATE INDEX idx_equipment_rentals_renter ON public.equipment_rentals(renter_user_id) WHERE renter_user_id IS NOT NULL;
CREATE INDEX idx_equipment_rentals_primary_rental ON public.equipment_rentals(primary_rental_id) WHERE primary_rental_id IS NOT NULL;
CREATE INDEX idx_equipment_rentals_status ON public.equipment_rentals(status) WHERE status = 'active';

-- RLS: crew members can read, crew owners can write
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read equipment rentals"
  ON public.equipment_rentals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = equipment_rentals.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );
CREATE POLICY "Crew owners can manage equipment rentals"
  ON public.equipment_rentals FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c
            WHERE c.id = equipment_rentals.crew_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );
```

### 2.3 Table: `public.cash_transactions`

**Purpose:** Unified cash ledger — replaces the narrow `deposit_log` (which stays as-is for backward compat).

```sql
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id         UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,

  -- Links to source records (all nullable — a transaction may not have all)
  rental_id       UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL,
  sale_contract_id UUID, -- FK to private.sale_contract_artifacts(id) — add separately if needed
  equipment_rental_id UUID REFERENCES public.equipment_rentals(id) ON DELETE SET NULL,
  salary_calc_id  UUID REFERENCES public.salary_calculations(id) ON DELETE SET NULL,

  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'income_rental', 'income_sale', 'income_service', 'income_equipment',
    'income_deposit', 'expense_deposit_return', 'expense_commission',
    'expense_salary', 'expense_equipment_repair', 'expense_other'
  )),
  amount          NUMERIC NOT NULL,
  flow_direction  TEXT NOT NULL CHECK (flow_direction IN ('in', 'out')),
  payment_method  TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'telegram_stars', 'sbp', 'none')),

  -- Parties
  from_user_id    TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  to_user_id      TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,

  -- Metadata
  category        TEXT, -- free-text: "Аренда", "Продажа", "Сервис", "Зарплата", etc.
  description     TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT, -- operator chat_id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_transactions_crew ON public.cash_transactions(crew_id);
CREATE INDEX idx_cash_transactions_type ON public.cash_transactions(transaction_type);
CREATE INDEX idx_cash_transactions_date ON public.cash_transactions(transaction_date);
CREATE INDEX idx_cash_transactions_rental ON public.cash_transactions(rental_id) WHERE rental_id IS NOT NULL;

-- View: daily cash flow summary
CREATE OR REPLACE VIEW public.daily_cash_flow AS
SELECT
  crew_id,
  DATE(transaction_date) as flow_date,
  SUM(CASE WHEN flow_direction = 'in' THEN amount ELSE 0 END) as total_in,
  SUM(CASE WHEN flow_direction = 'out' THEN amount ELSE 0 END) as total_out,
  SUM(CASE WHEN flow_direction = 'in' THEN amount ELSE -amount END) as net_flow,
  COUNT(*) as transaction_count
FROM public.cash_transactions
GROUP BY crew_id, DATE(transaction_date);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read cash transactions"
  ON public.cash_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = cash_transactions.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );
CREATE POLICY "Crew owners can manage cash transactions"
  ON public.cash_transactions FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c
            WHERE c.id = cash_transactions.crew_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );
```

### 2.4 Table: `public.commission_rates`

```sql
CREATE TABLE IF NOT EXISTS public.commission_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id         UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  operation_type  TEXT NOT NULL CHECK (operation_type IN (
    'rental_hourly', 'rental_daily', 'rental_weekly',
    'sale_bike', 'sale_accessories',
    'service', 'equipment_rental'
  )),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed_amount')),
  commission_value NUMERIC NOT NULL,
  priority        INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crew_id, operation_type, priority)
);

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read commission rates"
  ON public.commission_rates FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = commission_rates.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );
CREATE POLICY "Crew owners can manage commission rates"
  ON public.commission_rates FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c
            WHERE c.id = commission_rates.crew_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );
```

### 2.5 Table: `public.salary_plans`

```sql
CREATE TABLE IF NOT EXISTS public.salary_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_member_id  UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  crew_id         UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,

  -- Period
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  payout_schedule TEXT[] NOT NULL DEFAULT ARRAY['10', '25'], -- days of month

  -- Base rate (supplements crew_member_shifts.hourly_rate)
  base_rate       NUMERIC NOT NULL DEFAULT 0,

  -- Calculated totals (generated)
  total_shifts    INTEGER NOT NULL DEFAULT 0,
  total_shift_hours NUMERIC NOT NULL DEFAULT 0,
  total_shift_income NUMERIC NOT NULL DEFAULT 0,
  total_commissions NUMERIC NOT NULL DEFAULT 0,
  total_bonuses   NUMERIC NOT NULL DEFAULT 0,
  total_accrued   NUMERIC GENERATED ALWAYS AS (total_shift_income + total_commissions + total_bonuses) STORED,
  total_paid      NUMERIC NOT NULL DEFAULT 0,
  balance_due     NUMERIC GENERATED ALWAYS AS (total_accrued - total_paid) STORED,

  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'paid')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_salary_plans_member ON public.salary_plans(crew_member_id);
CREATE INDEX idx_salary_plans_crew ON public.salary_plans(crew_id);
CREATE INDEX idx_salary_plans_period ON public.salary_plans(period_start, period_end);
CREATE INDEX idx_salary_plans_status ON public.salary_plans(status) WHERE status = 'active';

ALTER TABLE public.salary_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read own salary plans"
  ON public.salary_plans FOR SELECT
  TO authenticated USING (
    crew_member_id IN (SELECT id FROM public.crew_members WHERE user_id = auth.jwt() ->> 'chat_id')
    OR EXISTS (SELECT 1 FROM public.crews c WHERE c.id = salary_plans.crew_id AND c.owner_id = auth.jwt() ->> 'chat_id')
  );
CREATE POLICY "Crew owners can manage salary plans"
  ON public.salary_plans FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c WHERE c.id = salary_plans.crew_id AND c.owner_id = auth.jwt() ->> 'chat_id')
  );
```

### 2.6 Table: `public.salary_calculations`

```sql
CREATE TABLE IF NOT EXISTS public.salary_calculations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_plan_id  UUID NOT NULL REFERENCES public.salary_plans(id) ON DELETE CASCADE,
  crew_member_id  UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  crew_id         UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,

  calculation_date DATE NOT NULL,
  shift_income    NUMERIC NOT NULL DEFAULT 0,
  commission_income NUMERIC NOT NULL DEFAULT 0,
  bonus_income    NUMERIC NOT NULL DEFAULT 0,
  total_income    NUMERIC GENERATED ALWAYS AS (shift_income + commission_income + bonus_income) STORED,

  -- Payout tracking
  payout_date     DATE, -- 10th or 25th
  payout_status   TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'cancelled')),
  paid_at         TIMESTAMPTZ,

  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_salary_calcs_plan ON public.salary_calculations(salary_plan_id);
CREATE INDEX idx_salary_calcs_member ON public.salary_calculations(crew_member_id);
CREATE INDEX idx_salary_calcs_payout ON public.salary_calculations(payout_date) WHERE payout_date IS NOT NULL;

ALTER TABLE public.salary_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read own calculations"
  ON public.salary_calculations FOR SELECT
  TO authenticated USING (
    crew_member_id IN (SELECT id FROM public.crew_members WHERE user_id = auth.jwt() ->> 'chat_id')
    OR EXISTS (SELECT 1 FROM public.crews c WHERE c.id = salary_calculations.crew_id AND c.owner_id = auth.jwt() ->> 'chat_id')
  );
CREATE POLICY "Crew owners can manage calculations"
  ON public.salary_calculations FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c WHERE c.id = salary_calculations.crew_id AND c.owner_id = auth.jwt() ->> 'chat_id')
  );
```

### 2.7 Seed Equipment Items

Add equipment as `cars` rows with `type='equipment'`:

```sql
INSERT INTO public.cars (id, make, model, type, specs, daily_price, image_url, rent_link, description, crew_id)
VALUES
  ('equip-helmet-l', 'VIP Bike', 'Шлем L', 'equipment',
   '{"size":"L","color":"black","condition":"new"}'::jsonb,
   500, '', '', 'Шлем размера L', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'),
  ('equip-helmet-xl', 'VIP Bike', 'Шлем XL', 'equipment',
   '{"size":"XL","color":"black","condition":"new"}'::jsonb,
   500, '', '', 'Шлем размера XL', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'),
  ('equip-jacket-l', 'VIP Bike', 'Куртка L', 'equipment',
   '{"size":"L","type":"motorcycle","protection":"yes"}'::jsonb,
   500, '', '', 'Мотокуртка размера L', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'),
  ('equip-gloves-m', 'VIP Bike', 'Перчатки M', 'equipment',
   '{"size":"M","type":"motorcycle"}'::jsonb,
   300, '', '', 'Мотоперчатки размера M', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746')
ON CONFLICT (id) DO NOTHING;
```

---

## 3. INTEGRATION PATTERNS

### 3.1 Auto-create Cash Transaction on Rental Completion

**Trigger:** fires when `rentals.status` changes to `completed`.

```sql
CREATE OR REPLACE FUNCTION public.auto_create_rental_transaction()
RETURNS TRIGGER SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_crew_id UUID;
  v_commission_pct NUMERIC := 0.10;
  v_manager_id TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Get crew_id
    v_crew_id := NEW.crew_id;
    IF v_crew_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Get commission rate
    SELECT commission_value INTO v_commission_pct
    FROM public.commission_rates
    WHERE crew_id = v_crew_id AND operation_type = 'rental_hourly' AND is_active = true
    ORDER BY priority DESC LIMIT 1;
    v_commission_pct := COALESCE(v_commission_pct, 0.10);

    -- Get crew owner
    SELECT owner_id INTO v_manager_id FROM public.crews WHERE id = v_crew_id;

    -- Insert income transaction
    INSERT INTO public.cash_transactions (
      crew_id, rental_id, transaction_type, amount, flow_direction,
      payment_method, category, description, transaction_date, created_by
    ) VALUES (
      v_crew_id, NEW.rental_id, 'income_rental', COALESCE(NEW.total_cost, 0), 'in',
      COALESCE(NEW.metadata->>'payment_method', 'cash'),
      'Аренда',
      'Аренда ' || (SELECT model FROM public.cars WHERE id = NEW.vehicle_id),
      NEW.created_at,
      COALESCE(NEW.created_by_operator_chat_id, NEW.owner_id, 'system')
    );

    -- Insert commission expense (if manager exists)
    IF v_manager_id IS NOT NULL AND NEW.total_cost > 0 THEN
      INSERT INTO public.cash_transactions (
        crew_id, rental_id, transaction_type, amount, flow_direction,
        payment_method, category, description, transaction_date,
        from_user_id, to_user_id, created_by
      ) VALUES (
        v_crew_id, NEW.rental_id, 'expense_commission',
        NEW.total_cost * v_commission_pct, 'out',
        'cash', 'Комиссия',
        'Комиссия за аренду ' || SUBSTRING(NEW.rental_id::TEXT FROM 1 FOR 8),
        now(), NEW.user_id, v_manager_id,
        COALESCE(NEW.created_by_operator_chat_id, 'system')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_rental_transaction ON public.rentals;
CREATE TRIGGER trg_auto_rental_transaction
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_rental_transaction();
```

### 3.2 Auto-create Cash Transaction on Sale

Similar trigger on `sale_contract_artifacts` — fires on INSERT (sales don't have status changes).

### 3.3 Auto-create Cash Transaction on Equipment Rental Completion

Trigger on `equipment_rentals.status` → `returned`.

---

## 4. API SPECIFICATION

**All endpoints require authentication** — reuse `verifyCrewAccess(slug, actorUserId)` pattern from `app/franchize/server-actions/leads.ts`.

### 4.1 POST `/api/franchize/[slug]/equipment-rentals`

Create standalone equipment rental.

### 4.2 POST `/api/franchize/[slug]/cash-transactions`

Record manual cash transaction (adjustments, bonuses, etc.).

### 4.3 GET `/api/franchize/[slug]/dashboard/daily-report?date=YYYY-MM-DD`

Daily cash flow report — uses `daily_cash_flow` view + detailed transactions.

### 4.4 GET `/api/franchize/[slug]/salary/[employeeId]?from=YYYY-MM-DD&to=YYYY-MM-DD`

Salary calculation for a crew member — aggregates `crew_member_shifts.salary_amount` + `cash_transactions` commissions for the period.

**Note:** Next.js uses `[employeeId]` dynamic segment, NOT `:employee-id` Express syntax.

---

## 5. DATA MIGRATION STRATEGY

### 5.1 Backfill cash transactions from existing rentals

```sql
-- Backfill income transactions for completed/active rentals
INSERT INTO public.cash_transactions (
  crew_id, rental_id, transaction_type, amount, flow_direction,
  payment_method, category, description, transaction_date, created_by
)
SELECT
  r.crew_id, r.rental_id, 'income_rental',
  COALESCE(r.total_cost, 0), 'in',
  'cash', 'Аренда',
  'Аренда ' || COALESCE((SELECT model FROM public.cars WHERE id = r.vehicle_id), ''),
  r.created_at,
  COALESCE(r.created_by_operator_chat_id, r.owner_id, 'system')
FROM public.rentals r
WHERE r.status IN ('completed', 'active')
  AND r.crew_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_transactions ct
    WHERE ct.rental_id = r.rental_id AND ct.transaction_type = 'income_rental'
  );
```

### 5.2 Backfill cash transactions from existing sales

```sql
INSERT INTO public.cash_transactions (
  crew_id, transaction_type, amount, flow_direction,
  payment_method, category, description, transaction_date, created_by
)
SELECT
  s.crew_slug::UUID, 'income_sale',
  COALESCE(s.total_sum, s.sale_price::NUMERIC, 0), 'in',
  'cash', 'Продажа',
  'Продажа ' || COALESCE((SELECT model FROM public.cars WHERE id = s.resolved_bike_id), ''),
  s.created_at,
  COALESCE(s.created_by_operator_chat_id, 'system')
FROM private.sale_contract_artifacts s
WHERE NOT EXISTS (
    SELECT 1 FROM public.cash_transactions ct
    WHERE ct.sale_contract_id = s.id AND ct.transaction_type = 'income_sale'
  );
```

**Note:** `sale_contract_id` column needs to be added to `cash_transactions` and linked to `private.sale_contract_artifacts.id`. Cross-schema FK is supported.

---

## 6. INTEGRATION WITH EXISTING SYSTEMS

### 6.1 Shifts (`crew_member_shifts`)
- `salary_plans.total_shift_income` = SUM of `crew_member_shifts.salary_amount` for the period
- `salary_calculations.shift_income` = same, per calculation date
- No changes to existing shift tracking — just read from it

### 6.2 Profile Page — "My Earnings" + "My Work" Sections

**File:** `app/franchize/[slug]/profile/ProfileClient.tsx` (945 lines)

Add TWO new sections:

#### 6.2.1 "My Earnings" Section
Shows salary/commission data for the logged-in crew member:
- Current period salary plan (total_accrued, balance_due)
- Recent shift income (from `crew_member_shifts`)
- Recent commissions (from `cash_transactions` where `to_user_id = userId`)
- Next payout date (10th or 25th of month)

#### 6.2.2 "My Work" Section (NEW — mirrors evening digest for this operator)
Shows today's work performed by this operator — same data as evening-summary.sh but filtered to THIS operator only.

**Data source:** `rentals` where `created_by_operator_chat_id = userId` AND created today, joined with `cars` for bike titles.

**New server action:** `getMyWorkTodayAction({ userId, slug })`
```typescript
// Returns today's work for this operator:
// - Rentals created today (rent flow)
// - Sales created today (sale_contract_artifacts where created_by_operator_chat_id = userId)
// - Service work logged today (rentals where metadata.source = 'service_work' AND created_by_operator_chat_id = userId)
// - Active shift (if clocked in)
// - Total earned today (shift salary + commissions)

export type MyWorkToday = {
  rentals: Array<{ rentalId: string; bikeTitle: string; status: string; totalCost: number }>;
  sales: Array<{ saleId: string; bikeTitle: string; salePrice: number }>;
  serviceWork: Array<{ rentalId: string; serviceName: string; totalCost: number; performedAt: string }>;
  activeShift: { shiftId: string; clockInTime: string; hoursSoFar: number; shiftIncome: number } | null;
  totalEarnedToday: number; // shift income + commissions
  shiftIncomeToday: number;
  commissionIncomeToday: number;
};
```

**SQL query pattern:**
```sql
-- Today's rentals by this operator
SELECT r.rental_id, r.status, r.total_cost, c.make, c.model, r.metadata
FROM public.rentals r
JOIN public.cars c ON r.vehicle_id = c.id
WHERE r.created_by_operator_chat_id = $userId
  AND r.metadata->>'source' != 'service_work'  -- exclude service work (shown separately)
  AND DATE(r.created_at AT TIME ZONE 'Europe/Moscow') = DATE(now() AT TIME ZONE 'Europe/Moscow')
ORDER BY r.created_at DESC;

-- Today's service work by this operator
SELECT r.rental_id, r.total_cost, r.metadata->>'service_name' as service_name, r.metadata->>'performed_at' as performed_at
FROM public.rentals r
WHERE r.created_by_operator_chat_id = $userId
  AND r.metadata->>'source' = 'service_work'
  AND DATE(r.created_at AT TIME ZONE 'Europe/Moscow') = DATE(now() AT TIME ZONE 'Europe/Moscow')
ORDER BY r.created_at DESC;

-- Today's sales by this operator
SELECT s.id, s.sale_price, s.total_sum, c.make, c.model
FROM private.sale_contract_artifacts s
LEFT JOIN public.cars c ON s.resolved_bike_id = c.id
WHERE s.created_by_operator_chat_id = $userId
  AND DATE(s.created_at AT TIME ZONE 'Europe/Moscow') = DATE(now() AT TIME ZONE 'Europe/Moscow')
ORDER BY s.created_at DESC;

-- Active shift
SELECT id, clock_in_time, salary_amount, hourly_rate
FROM public.crew_member_shifts
WHERE member_id = $userId
  AND clock_out_time IS NULL
LIMIT 1;
```

**UI layout:**
```
┌─────────────────────────────────────┐
│ 📊 Моя работа сегодня               │
│                                     │
│ ⏱ Смена: 4ч 23м (500₽/час)        │
│ 💰 Заработано: 3 500₽              │
│   ├── Смена: 2 150₽                │
│   └── Комиссии: 1 350₽             │
│                                     │
│ 🏍 Аренды (2):                      │
│   • Kawasaki EX650K — 9 000₽      │
│   • Ducati Panigale — 10 000₽     │
│                                     │
│ 💰 Продажи (1):                     │
│   • Falcon Pro — 390 000₽          │
│                                     │
│ 🔧 Сервис (3):                      │
│   • Замена масла — 1 500₽         │
│   • Диагностика — 1 000₽          │
│   • Шиномонтаж — 800₽             │
└─────────────────────────────────────┘
```

### 6.3 Crew Members Page (`CrewMembersClient.tsx`)
- Add salary summary per member (for crew owners)
- Show current period accrued + balance

### 6.4 Equipment in Bike Rentals
- Keep `DocFlowContext` equipment booleans for "preset with bike" flow
- Store equipment in `rentals.metadata.equipment` (NEW — currently not stored)
- Also create `equipment_rentals` rows linked to `primary_rental_id` when equipment is rented with a bike

### 6.5 Service Operations
- Services continue to work as `rentals` with `cars.type='service'`
- `cash_transactions` auto-creates `income_service` when a service rental completes
- No new `service_operations` table needed
- Service work is logged via `service-work-text` skill: INSERT into `rentals` with `metadata.source='service_work'`, `metadata.service_name`, `metadata.performed_at`, `created_by_operator_chat_id`

### 6.6 Deposit & Payment Tracking Enhancement

**See separate PRD:** `docs/DEPOSIT_TRACKING_PRD.md` for full details.

**Summary:** New `deposit_entries` table (FK to `rentals`) tracks WHERE money went:
- `destination` column: `cash` | `tbank` (card 1, default) | `sber` (card 2) | `stars`
- Replaces narrow `deposit_log` (which only had `method='cash'` in production)
- Both deposit collection AND rental payment create entries
- Tied into doc-manual deposit + payment_split steps
- Admin debug page at `/franchize/[slug]/admin/deposits`
- New skill: `deposit-tracer-text`

**Note on method CHECK:** `card` and `sbp` are the same as `bank_transfer` — we don't need separate method values. The `destination` column (cash/tbank/sber/stars) is the important distinction. `deposit_log` stays as-is for backward compat; `deposit_entries` is the new unified table.

**Also:** Apply the never-applied `rental_handoffs` migration (`20260623000003_rental_handoffs.sql`) — the code (`rental-handoffs.ts` + `RentalHandoffModal.tsx`) already exists and expects this table. Without it, the handoff modal crashes.

---

## 7. OPEN QUESTIONS

1. **Commission rates** — what % for each operation type? (default 10% for rentals)
2. **Base rate** — is there a base monthly salary in addition to shift income?
3. **Payout schedule** — confirm 10th and 25th of each month?
4. **Equipment deposit** — separate deposit for equipment rentals?
5. **Cross-schema FK** — should `cash_transactions.sale_contract_id` have an actual FK to `private.sale_contract_artifacts(id)`? (Postgres supports this but RLS may complicate)
6. **Deposit card defaults** — confirm T-Bank (tbank) = card 1, Sber (sber) = card 2? Any other cards?
7. **Deposit auto-return** — should auto-return copy the `destination` from the original collection? (Yes — if deposit was collected on T-Bank, return to T-Bank)
8. **rental_handoffs migration** — should we apply `20260623000003_rental_handoffs.sql`? Code already expects it (`rental-handoffs.ts` + `RentalHandoffModal.tsx`). Recommendation: YES, apply it.

---

## 8. SUCCESS METRICS

- 100% of rental completions auto-create cash transactions
- 100% of sales auto-create cash transactions
- Salary calculations run automatically on payout dates
- Equipment rentals tracked separately from bike rentals
- Daily cash flow report available for crew owners
- Profile page shows earnings for crew members

---

## 9. IMPLEMENTATION PLAN

**Phase 1 (Days 1-2):** DB migrations (equipment_rentals, cash_transactions, commission_rates, salary_plans, salary_calculations, seed equipment items)

**Phase 2 (Days 3-4):** Triggers (auto-create cash transactions on rental/sale/equipment completion)

**Phase 3 (Days 5-6):** Backfill existing rentals/sales into cash_transactions

**Phase 4 (Days 7-8):** API endpoints (equipment-rentals, cash-transactions, daily-report, salary)

**Phase 5 (Days 9-10):** Profile page "My Earnings" section + crew members salary summary

**Phase 6 (Days 11-12):** Testing & deployment

---

**Document History:**
- v1.0 (2026-08-09): Initial draft by other agent — contained many inaccuracies about existing schema
- v2.0 (2026-08-09): First audit by Super Z — found 17 issues
- v3.0 (2026-08-09): Polished by Super Z — direct Supabase queries confirmed production state, removed `service_operations` table (reuse rentals pattern), removed `document_drafts` (extend user_states), fixed all auth.uid() → auth.jwt() ->> 'chat_id', fixed all triggers to use SECURITY DEFINER + COALESCE for created_by
