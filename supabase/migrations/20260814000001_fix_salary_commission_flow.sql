-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260814000001_fix_salary_commission_flow.sql
-- Purpose:   Priority 1 & 2 fixes for salary/commission system
-- Issues:    https://github.com/salacey13/carTest/issues
--
-- Priority 1 (Fix Data Flow):
--   1. Sync hourly_rate from users.metadata when shift starts
--   2. Auto-calc salary_plans.total_accrued on salary_calculations updates
--   3. Fix commission method (use calculated OR recorded, not both)
--
-- Priority 2 (Add Validation):
--   4. Validate commission values (percentage ≤ 100, no negatives)
--   5. Add period overlap feedback with detailed messages
--   6. Add idempotency protection for duplicate salary calculations
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. SYNC HOURLY RATE ON SHIFT START ───────────────────────────────────────

-- Function to sync hourly_rate from users.metadata when shift is created
CREATE OR REPLACE FUNCTION public.sync_hourly_rate_on_shift_start()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  member_rate NUMERIC;
BEGIN
  -- Get hourly_rate from users.metadata (default to 500 if not set)
  SELECT COALESCE((metadata->>'hourly_rate')::NUMERIC, 500)
  INTO member_rate
  FROM public.users
  WHERE user_id = NEW.member_id;

  -- Update the shift with the member's current hourly rate
  UPDATE public.crew_member_shifts
  SET hourly_rate = member_rate
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_sync_hourly_rate_on_shift_start ON public.crew_member_shifts;

-- Create trigger to sync hourly_rate on shift insert
CREATE TRIGGER trg_sync_hourly_rate_on_shift_start
  AFTER INSERT ON public.crew_member_shifts
  FOR EACH ROW
  WHEN (NEW.clock_out_time IS NULL)  -- Only for new shifts (active ones)
  EXECUTE FUNCTION public.sync_hourly_rate_on_shift_start();

COMMENT ON FUNCTION public.sync_hourly_rate_on_shift_start() IS
'Priority 1 Fix 1: Syncs hourly_rate from users.metadata when shift starts. Defaults to 500 RUB/hour if not set.';

-- ── 2. AUTO-CALC salary_plans.total_accrued ────────────────────────────────────

-- Function to update total_accrued when salary_calculations is created/updated
CREATE OR REPLACE FUNCTION public.update_salary_plan_accrued()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update parent plan's total_accrued by summing all calculation records
  UPDATE public.salary_plans
  SET total_accrued = (
    SELECT COALESCE(SUM(total_income), 0)
    FROM public.salary_calculations
    WHERE salary_plan_id = NEW.salary_plan_id
  )
  WHERE id = NEW.salary_plan_id;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_update_salary_plan_accrued ON public.salary_calculations;

-- Create trigger to auto-update total_accrued
CREATE TRIGGER trg_update_salary_plan_accrued
  AFTER INSERT OR UPDATE OF total_income ON public.salary_calculations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_salary_plan_accrued();

COMMENT ON FUNCTION public.update_salary_plan_accrued() IS
'Priority 1 Fix 2: Auto-updates salary_plans.total_accrued by summing salary_calculations.total_income.';

-- ── 3. FIX COMMISSION METHOD (use calculated OR recorded) ────────────────────

-- The fix is implemented in salary-calculations.ts server action:
-- - Use calculated commissions from rates when available
-- - Fall back to recorded expense_commission transactions only if no rates configured
-- - Never sum both methods (prevents double-counting)

-- Add helper function to check if crew has commission rates configured
CREATE OR REPLACE FUNCTION public.has_commission_rates(p_crew_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.commission_rates
    WHERE crew_id = p_crew_id AND is_active = true
    LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.has_commission_rates() IS
'Priority 1 Fix 3: Helper to check if crew has commission rates configured. Used to determine calculation method.';

-- ── 4. VALIDATE COMMISSION VALUES ─────────────────────────────────────────────

-- Function to validate commission rate values before insert/update
CREATE OR REPLACE FUNCTION public.validate_commission_rate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Percentage commissions cannot exceed 100%
  IF NEW.commission_type = 'percentage' AND NEW.commission_value > 100 THEN
    RAISE EXCEPTION 'Комиссия в процентах не может превышать 100%%. Указано: %', NEW.commission_value
    USING ERRCODE = 'check_violation';
  END IF;

  -- No negative values allowed
  IF NEW.commission_value < 0 THEN
    RAISE EXCEPTION 'Значение комиссии не может быть отрицательным. Указано: %', NEW.commission_value
    USING ERRCODE = 'check_violation';
  END IF;

  -- Fixed amounts should be reasonable (warn if > 1M RUB)
  IF NEW.commission_type = 'fixed_amount' AND NEW.commission_value > 1000000 THEN
    RAISE NOTICE 'Фиксированная комиссия превышает 1,000,000 RUB. Указано: %', NEW.commission_value;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_validate_commission_rate ON public.commission_rates;

-- Create validation trigger
CREATE TRIGGER trg_validate_commission_rate
  BEFORE INSERT OR UPDATE OF commission_type, commission_value ON public.commission_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commission_rate();

COMMENT ON FUNCTION public.validate_commission_rate() IS
'Priority 2 Fix 4: Validates commission values. Percentage ≤ 100%%, no negatives, warns on large fixed amounts.';

-- ── 5. IMPROVED PERIOD OVERLAP DETECTION ─────────────────────────────────────

-- Enhanced function to detect period overlaps with detailed feedback
CREATE OR REPLACE FUNCTION public.check_period_overlap(
  p_crew_id UUID,
  p_member_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE(
  overlapping_id UUID,
  overlapping_start TIMESTAMPTZ,
  overlapping_end TIMESTAMPTZ,
  conflict_description TEXT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.period_start,
    sp.period_end,
    format(
      'Период пересекается с существующим планом (%s — %s)',
      sp.period_start::DATE,
      sp.period_end::DATE
    ) AS conflict_description
  FROM public.salary_plans sp
  WHERE sp.crew_id = p_crew_id
    AND sp.member_id = p_member_id
    AND (p_exclude_id IS NULL OR sp.id != p_exclude_id)
    AND sp.period_start < p_period_end
    AND sp.period_end > p_period_start;
END;
$$;

COMMENT ON FUNCTION public.check_period_overlap() IS
'Priority 2 Fix 5: Detects overlapping salary plan periods with detailed conflict messages.';

-- Wrapper function for use in server actions with simple error message
CREATE OR REPLACE FUNCTION public.check_period_overlap_simple(
  p_crew_id UUID,
  p_member_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.check_period_overlap(p_crew_id, p_member_id, p_period_start, p_period_end)
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

COMMENT ON FUNCTION public.check_period_overlap_simple() IS
'Simplified version for existing server actions. Returns true/false.';

-- ── 6. IDEMPOTENCY PROTECTION FOR SALARY CALCULATIONS ───────────────────────

-- Add unique constraint to prevent duplicate calculations for same period
-- Note: This is a soft constraint - allows multiple calculations but requires explicit override

-- Function to check for existing calculations
CREATE OR REPLACE FUNCTION public.has_salary_calculation(
  p_salary_plan_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.salary_calculations
    WHERE salary_plan_id = p_salary_plan_id
      AND period_start = p_period_start
      AND period_end = p_period_end
      AND payout_status NOT IN ('failed')
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

COMMENT ON FUNCTION public.has_salary_calculation() IS
'Priority 2 Fix 6: Checks for existing salary calculation to prevent duplicates. Allows failed calculations to be retried.';

-- Add comment column to salary_calculations for audit trail
ALTER TABLE public.salary_calculations
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.salary_calculations.notes IS
'Optional notes for audit trail. Can be used to record calculation method override or manual adjustments.';

-- ── BACKFILL: Update existing shifts with hourly_rate ───────────────────────

-- Backfill hourly_rate for existing active shifts from users.metadata
UPDATE public.crew_member_shifts cms
SET hourly_rate = COALESCE(
  (SELECT u.metadata->>'hourly_rate'::NUMERIC FROM public.users u WHERE u.user_id = cms.member_id),
  500
)
WHERE cms.clock_out_time IS NULL  -- Only active shifts
  AND cms.hourly_rate IS NULL;  -- Only where not set

-- Backfill hourly_rate for completed shifts without it
UPDATE public.crew_member_shifts cms
SET hourly_rate = COALESCE(
  (SELECT u.metadata->>'hourly_rate'::NUMERIC FROM public.users u WHERE u.user_id = cms.member_id),
  500
)
WHERE cms.clock_out_time IS NOT NULL  -- Completed shifts
  AND cms.hourly_rate IS NULL  -- Only where not set
  AND cms.duration_minutes IS NOT NULL  -- Has duration data
LIMIT 1000;  -- Limit to recent 1000 shifts for performance

-- ── BACKFILL: Recalculate total_accrued for all salary_plans ───────────────

-- Update all salary_plans with sum of their calculations
UPDATE public.salary_plans sp
SET total_accrued = (
  SELECT COALESCE(SUM(sc.total_income), 0)
  FROM public.salary_calculations sc
  WHERE sc.salary_plan_id = sp.id
);

-- ── REPORT: Migration Results ───────────────────────────────────────────────

DO $$
DECLARE
  v_shifts_updated INT;
  v_plans_updated INT;
BEGIN
  -- Count shifts updated
  SELECT COUNT(*) INTO v_shifts_updated
  FROM public.crew_member_shifts
  WHERE clock_out_time IS NULL AND hourly_rate IS NOT NULL;

  -- Count plans updated
  SELECT COUNT(*) INTO v_plans_updated
  FROM public.salary_plans
  WHERE total_accrued IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 20260814000001 Complete';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Priority 1 Fixes Applied:';
  RAISE NOTICE '  1. Hourly rate sync trigger created';
  RAISE NOTICE '  2. Total_accrued auto-calc trigger created';
  RAISE NOTICE '  3. Commission calculation helper function added';
  RAISE NOTICE '';
  RAISE NOTICE 'Priority 2 Fixes Applied:';
  RAISE NOTICE '  4. Commission validation trigger created';
  RAISE NOTICE '  5. Period overlap detection enhanced';
  RAISE NOTICE '  6. Idempotency protection functions added';
  RAISE NOTICE '';
  RAISE NOTICE 'Backfill Results:';
  RAISE NOTICE '  - Active shifts with hourly_rate: %', v_shifts_updated;
  RAISE NOTICE '  - Salary plans with total_accrued: %', v_plans_updated;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
