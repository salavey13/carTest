-- /supabase/migrations/20260726000001_deposit_and_shift_tracking.sql
--
-- Deposit tracking for rentals + extend existing shift tracking.
--
-- DEPOSIT TRACKING:
--   Every rental has a returnable deposit (cash or bank transfer) but there's
--   no tracking. This adds 7 columns to rentals + a deposit_log audit table.
--
-- SHIFT TRACKING EXTENSION:
--   The existing crew_member_shifts table (from 20240728000000 migration) has
--   clock_in_time, clock_out_time, duration_minutes, shift_type. We extend it
--   with hourly_rate + salary_amount + notes for salary calculation.
--
-- Idempotent: safe to run multiple times (uses IF NOT EXISTS).

-- ═══ DEPOSIT TRACKING ═══════════════════════════════════════════════════════

-- ─── Add deposit columns to rentals ─────────────────────────────────────────
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_method text;
-- Check constraint allows NULL (for legacy rentals) + the 4 valid methods
DO $$ BEGIN
  ALTER TABLE public.rentals ADD CONSTRAINT deposit_method_valid
    CHECK (deposit_method IS NULL OR deposit_method IN ('cash', 'bank_transfer', 'telegram_stars', 'none'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_collected_at timestamptz;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_collected_by text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_returned boolean DEFAULT false;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_returned_at timestamptz;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_returned_by text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_notes text;

-- ─── Deposit audit log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deposit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(rental_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('collected', 'returned', 'adjusted', 'noted')),
  amount numeric,
  method text,
  operator_chat_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposit_log_rental_id ON public.deposit_log(rental_id);
CREATE INDEX IF NOT EXISTS idx_deposit_log_created_at ON public.deposit_log(created_at);

-- ─── RLS for deposit_log ───────────────────────────────────────────────────
ALTER TABLE public.deposit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Crew members can read deposit logs" ON public.deposit_log
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.rentals r
        WHERE r.rental_id = deposit_log.rental_id
        AND r.crew_id IN (
          SELECT crew_id FROM public.crew_members WHERE user_id = (auth.jwt() ->> 'chat_id')
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Trigger: auto-set deposit_returned when rental completes ──────────────
CREATE OR REPLACE FUNCTION public.auto_log_deposit_return()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.deposit_collected_at IS NOT NULL AND NEW.deposit_returned = false THEN
      NEW.deposit_returned = true;
      NEW.deposit_returned_at = now();

      INSERT INTO public.deposit_log (rental_id, action, amount, method, notes)
      VALUES (NEW.rental_id, 'returned', NEW.deposit_amount, NEW.deposit_method, 'Auto-returned on rental completion');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_deposit_return ON public.rentals;
CREATE TRIGGER trg_auto_deposit_return
  BEFORE UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_deposit_return();

-- ═══ SHIFT TRACKING EXTENSION ══════════════════════════════════════════════
-- The existing crew_member_shifts table already has:
--   id, member_id, crew_id, clock_in_time, clock_out_time,
--   duration_minutes, shift_type, checkpoint (jsonb), actions (jsonb)
--
-- We ADD salary tracking columns (don't touch existing columns):

ALTER TABLE public.crew_member_shifts ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 500;
ALTER TABLE public.crew_member_shifts ADD COLUMN IF NOT EXISTS salary_amount numeric;
ALTER TABLE public.crew_member_shifts ADD COLUMN IF NOT EXISTS notes text;

-- ─── Trigger: auto-calculate salary on clock_out ───────────────────────────
-- When clock_out_time is set, calculate salary = duration_minutes/60 * hourly_rate
CREATE OR REPLACE FUNCTION public.calc_shift_salary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.clock_out_time IS NOT NULL AND NEW.clock_in_time IS NOT NULL THEN
    -- Calculate duration in minutes if not already set
    IF NEW.duration_minutes IS NULL THEN
      NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 60;
    END IF;
    -- Calculate salary
    IF NEW.hourly_rate IS NOT NULL AND NEW.duration_minutes IS NOT NULL THEN
      NEW.salary_amount = (NEW.duration_minutes / 60.0) * NEW.hourly_rate;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_shift_salary ON public.crew_member_shifts;
CREATE TRIGGER trg_calc_shift_salary
  BEFORE INSERT OR UPDATE OF clock_out_time ON public.crew_member_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_shift_salary();

-- ─── Backfill salary for existing completed shifts ─────────────────────────
UPDATE public.crew_member_shifts
SET salary_amount = (duration_minutes / 60.0) * hourly_rate
WHERE clock_out_time IS NOT NULL
  AND duration_minutes IS NOT NULL
  AND salary_amount IS NULL;

-- ═══ VERIFICATION ═════════════════════════════════════════════════════════
DO $$
DECLARE
  shift_count INTEGER;
  deposit_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO shift_count FROM public.crew_member_shifts;
  SELECT COUNT(*) INTO deposit_count FROM public.deposit_log;

  RAISE NOTICE 'Migration 20260726000001 complete:';
  RAISE NOTICE '  Deposit tracking: 7 columns on rentals + deposit_log table + auto-return trigger';
  RAISE NOTICE '  Shift extension: hourly_rate + salary_amount + notes on crew_member_shifts';
  RAISE NOTICE '  Shift salary trigger: auto-calculates on clock_out';
  RAISE NOTICE '  Existing shifts: %', shift_count;
  RAISE NOTICE '  Deposit log entries: %', deposit_count;
END;
$$;
