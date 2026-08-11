-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000004_create_salary_plans.sql
-- Purpose:   I5 — salary plans table
-- Plan:      docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 1)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Salary plans define a payout period for a crew member.
-- Generated columns total_shift_income, total_commissions, total_accrued
-- aggregate from shifts and commissions for the period.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.salary_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id           UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  member_id         TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,

  -- Period definition
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,

  -- Payout schedule (default: 10th and 25th of month)
  payout_schedule   TEXT[] NOT NULL DEFAULT ARRAY['10', '25'],

  -- Generated columns (aggregates from shifts + commissions)
  total_shift_income NUMERIC GENERATED ALWAYS AS (
    COALESCE((SELECT SUM(salary_amount) FROM public.crew_member_shifts
              WHERE crew_id = salary_plans.crew_id
                AND member_id = salary_plans.member_id
                AND shift_start >= salary_plans.period_start
                AND shift_start < salary_plans.period_end), 0)
  ) STORED,

  total_commissions NUMERIC GENERATED ALWAYS AS (
    COALESCE((SELECT SUM(amount) FROM public.cash_transactions
              WHERE crew_id = salary_plans.crew_id
                AND to_user_id = salary_plans.member_id
                AND transaction_type = 'expense_commission'
                AND transaction_date >= salary_plans.period_start
                AND transaction_date < salary_plans.period_end), 0)
  ) STORED,

  total_accrued     NUMERIC GENERATED ALWAYS AS (
    COALESCE(total_shift_income, 0) + COALESCE(total_commissions, 0)
  ) STORED,

  -- Payout tracking
  balance_due       NUMERIC NOT NULL DEFAULT 0,  -- total_accrued - total_paid
  last_payout_date  TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(crew_id, member_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_salary_plans_crew_member ON public.salary_plans(crew_id, member_id);
CREATE INDEX IF NOT EXISTS idx_salary_plans_period ON public.salary_plans(period_start, period_end);

-- RLS: crew members can read own, crew owners can manage
ALTER TABLE public.salary_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew members can read own salary plans" ON public.salary_plans;
CREATE POLICY "Crew members can read own salary plans"
  ON public.salary_plans FOR SELECT
  TO authenticated USING (
    user_id = auth.jwt() ->> 'chat_id'
  );

DROP POLICY IF EXISTS "Crew owners can manage salary plans" ON public.salary_plans;
CREATE POLICY "Crew owners can manage salary plans"
  ON public.salary_plans FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c
            WHERE c.id = salary_plans.crew_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );

COMMENT ON TABLE public.salary_plans IS
'I5: salary plans per crew member per period. Generated columns aggregate shift income + commissions. balance_due = total_accrued - total_paid. Default payout_schedule: [10, 25] (days of month).';
