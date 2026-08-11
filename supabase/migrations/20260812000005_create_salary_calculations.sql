-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000005_create_salary_calculations.sql
-- Purpose:   I5 — salary calculations (payout records) table
-- Plan:      docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 1)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Each salary_calc is one payout record for a specific period.
-- Links to salary_plans (period definition) and creates expense_salary
-- entry in cash_transactions when paid.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.salary_calculations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_plan_id    UUID NOT NULL REFERENCES public.salary_plans(id) ON DELETE CASCADE,

  -- Period snapshot (copied from salary_plan at time of calculation)
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,

  -- Breakdown (stored, not generated — snapshot at calculation time)
  shift_income      NUMERIC NOT NULL DEFAULT 0,
  commission_income NUMERIC NOT NULL DEFAULT 0,
  bonus_income      NUMERIC NOT NULL DEFAULT 0,
  total_income      NUMERIC NOT NULL DEFAULT 0,

  -- Payout tracking
  payout_date       TIMESTAMPTZ NOT NULL,  -- expected date (10th or 25th)
  payout_status     TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'failed')),
  paid_at           TIMESTAMPTZ,

  -- Cash transaction link (created when payout_status='paid')
  cash_transaction_id UUID REFERENCES public.cash_transactions(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_calculations_plan ON public.salary_calculations(salary_plan_id);
CREATE INDEX IF NOT EXISTS idx_salary_calculations_status ON public.salary_calculations(payout_status);
CREATE INDEX IF NOT EXISTS idx_salary_calculations_date ON public.salary_calculations(payout_date);

-- RLS: crew members can read own, crew owners can manage
ALTER TABLE public.salary_calculations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew members can read own salary calculations" ON public.salary_calculations;
CREATE POLICY "Crew members can read own salary calculations"
  ON public.salary_calculations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.salary_plans sp
      JOIN public.salary_calculations sc ON sc.salary_plan_id = sp.id
      WHERE sc.id = salary_calculations.id
        AND sp.member_id = auth.jwt() ->> 'chat_id'
    )
  );

DROP POLICY IF EXISTS "Crew owners can manage salary calculations" ON public.salary_calculations;
CREATE POLICY "Crew owners can manage salary calculations"
  ON public.salary_calculations FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.salary_plans sp
      JOIN public.salary_calculations sc ON sc.salary_plan_id = sp.id
      WHERE sc.id = salary_calculations.id
        AND EXISTS (SELECT 1 FROM public.crews c
                    WHERE c.id = sp.crew_id
                      AND c.owner_id = auth.jwt() ->> 'chat_id')
    )
  );

COMMENT ON TABLE public.salary_calculations IS
'I5: salary calculation records (payouts). Links to salary_plans, stores breakdown snapshot. When paid, creates expense_salary in cash_transactions and links via cash_transaction_id. Payout dates: 10th/25th (from salary_plan.payout_schedule).';
