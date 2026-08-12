-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000004_create_salary_plans.sql
-- Purpose:   I5 — salary plans table
-- Plan:      docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 1)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Salary plans define a payout period for a crew member.
-- NOTE: Generated columns removed (PostgreSQL doesn't support subqueries).
--        Use salary_calculations table for computed breakdowns.
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

  -- Manual accrual tracking (replaces generated columns)
  base_salary       NUMERIC NOT NULL DEFAULT 0,
  total_accrued     NUMERIC NOT NULL DEFAULT 0,
  total_paid        NUMERIC NOT NULL DEFAULT 0,
  balance_due       NUMERIC NOT NULL DEFAULT 0,  -- total_accrued - total_paid

  last_payout_date  TIMESTAMPTZ,
  notes             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(crew_id, member_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_salary_plans_crew_member ON public.salary_plans(crew_id, member_id);
CREATE INDEX IF NOT EXISTS idx_salary_plans_period ON public.salary_plans(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_salary_plans_balance ON public.salary_plans(balance_due) WHERE balance_due > 0;

-- Trigger to update balance_due and updated_at
CREATE OR REPLACE FUNCTION public.update_salary_plan_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.balance_due := GREATEST(0, NEW.total_accrued - NEW.total_paid);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_salary_plan_balance ON public.salary_plans;
CREATE TRIGGER trg_update_salary_plan_balance
  BEFORE INSERT OR UPDATE ON public.salary_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_salary_plan_balance();

-- RLS: crew members can read own, crew owners can manage
ALTER TABLE public.salary_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew members can read own salary plans" ON public.salary_plans;
CREATE POLICY "Crew members can read own salary plans"
  ON public.salary_plans FOR SELECT
  TO authenticated USING (
    member_id = auth.jwt() ->> 'chat_id'
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
'I5: salary plans per crew member per period. Manual accrual tracking (base_salary, total_accrued, total_paid, balance_due). Computed breakdowns stored in salary_calculations. Default payout_schedule: [10, 25] (days of month).';
