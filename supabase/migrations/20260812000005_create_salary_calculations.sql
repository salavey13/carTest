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

-- ── Trigger: Update salary_plans when payout is marked as paid ─────────────────────
CREATE OR REPLACE FUNCTION public.update_salary_plan_on_payout()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- When a calculation is marked as paid, update the parent plan
  -- IDEMPOTENCY: Only increment total_paid on transition to 'paid'
  IF NEW.payout_status = 'paid' AND (OLD IS NULL OR OLD.payout_status IS DISTINCT FROM 'paid') THEN
    UPDATE public.salary_plans
    SET total_paid = total_paid +
          CASE WHEN OLD IS NULL OR OLD.payout_status IS DISTINCT FROM 'paid'
               THEN NEW.total_income ELSE 0 END,
        last_payout_date = NEW.paid_at
    WHERE id = NEW.salary_plan_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_salary_plan_on_payout ON public.salary_calculations;
CREATE TRIGGER trg_update_salary_plan_on_payout
  AFTER INSERT OR UPDATE OF payout_status, paid_at ON public.salary_calculations
  FOR EACH ROW EXECUTE FUNCTION public.update_salary_plan_on_payout();

COMMENT ON FUNCTION public.update_salary_plan_on_payout() IS
'I5: Updates salary_plans.total_paid and last_payout_date when a salary calculation is marked as paid. Idempotent: only increments on transition to paid status.';
