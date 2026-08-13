-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000002_create_cash_transactions.sql
-- Purpose:   I5 — unified cash ledger for crew operations
-- Plan:      docs/superpowers/plans/2026-08-12-i5-cash-ledger.md (Task 1)
-- Contract:  PLAN-I5-SERVICE-OPERATIONS.md п.1 (migration series 20260812*)
--           п.4: sale_contract_id column WITHOUT FK (cross-schema)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Single ledger table for all crew money flows:
-- - Income: rentals (income_rental), sales (income_sale), equipment (income_equipment),
--           service (income_service), other (income_other)
-- - Expense: commissions (expense_commission), salaries (expense_salary),
--            deposit returns (expense_deposit_return), other (expense_other)
--
-- Nullable FKs link to source operations (rental_id, sale_contract_id, etc.)
-- Transaction type + flow_direction classify the entry.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id           UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,

  -- Source operation FKs (nullable — each transaction has at most one source)
  rental_id         UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL,
  sale_contract_id  UUID,  -- REFERENCES private.sale_contract_artifacts(id) — cross-schema FK NOT created (contract p.4)
  equipment_rental_id UUID REFERENCES public.equipment_rentals(id) ON DELETE SET NULL,
  -- salary_calc_id: UUID column without FK to avoid circular dependency
  -- (salary_calculations has FK to cash_transactions.cash_transaction_id)
  salary_calc_id    UUID,

  -- Classification
  transaction_type  TEXT NOT NULL CHECK (transaction_type IN (
    -- Income
    'income_rental', 'income_sale', 'income_equipment', 'income_service', 'income_other',
    -- Expense
    'expense_commission', 'expense_salary', 'expense_deposit_return', 'expense_other'
  )),
  flow_direction    TEXT NOT NULL CHECK (flow_direction IN ('in', 'out')),
  amount            NUMERIC NOT NULL CHECK (amount > 0),

  -- Payment metadata
  payment_method    TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  from_user_id      TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,  -- payer (for income)
  to_user_id        TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,  -- recipient (for expense)

  -- Categorization
  category          TEXT,
  description       TEXT,

  -- Timestamps
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT,  -- operator chat_id who created this entry
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_cash_transactions_crew ON public.cash_transactions(crew_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_rental ON public.cash_transactions(rental_id) WHERE rental_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_transactions_sale_contract ON public.cash_transactions(sale_contract_id) WHERE sale_contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_transactions_equipment_rental ON public.cash_transactions(equipment_rental_id) WHERE equipment_rental_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_transactions_salary_calc ON public.cash_transactions(salary_calc_id) WHERE salary_calc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type_date ON public.cash_transactions(crew_id, transaction_type, transaction_date DESC);

-- RLS: crew members can read, crew owners can write
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew members can read cash transactions" ON public.cash_transactions;
CREATE POLICY "Crew members can read cash transactions"
  ON public.cash_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = cash_transactions.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );

DROP POLICY IF EXISTS "Crew owners can manage cash transactions" ON public.cash_transactions;
CREATE POLICY "Crew owners can manage cash transactions"
  ON public.cash_transactions FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c
            WHERE c.id = cash_transactions.crew_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Daily cash flow view (aggregates transactions by date)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.daily_cash_flow AS
SELECT
  crew_id,
  transaction_date::date AS date,
  SUM(CASE WHEN flow_direction = 'in' THEN amount ELSE 0 END) AS total_in,
  SUM(CASE WHEN flow_direction = 'out' THEN amount ELSE 0 END) AS total_out,
  SUM(CASE WHEN flow_direction = 'in' THEN amount ELSE -amount END) AS net_flow,
  COUNT(*) AS transaction_count
FROM public.cash_transactions
GROUP BY crew_id, transaction_date::date;

COMMENT ON VIEW public.daily_cash_flow IS 'Daily cash flow aggregates: income, expenses, net flow per crew per day.';

COMMENT ON TABLE public.cash_transactions IS
'I5: unified cash ledger for crew operations. Each transaction links to at most one source operation (rental, sale, equipment_rental, salary_calc). sale_contract_id has no FK due to cross-schema reference (private schema). Flow direction: in=income, out=expense.';

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION: tests/sql/i5_cash_ledger_regression.sql
-- ═══════════════════════════════════════════════════════════════════════════
