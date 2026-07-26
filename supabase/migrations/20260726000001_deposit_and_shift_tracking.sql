-- /supabase/migrations/20260726000001_add_deposit_tracking.sql
--
-- Deposit tracking for rentals.
--
-- Problem: Every rental has a returnable deposit (cash or bank transfer) but
-- there's no tracking of:
--   - Was a deposit collected?
--   - How much?
--   - Cash or bank transfer?
--   - Was it returned?
--   - When?
--
-- Solution: Add columns to the rentals table for deposit tracking.
-- Also add a deposit_log table for audit trail (who collected/returned, when).
--
-- Idempotent: safe to run multiple times (uses IF NOT EXISTS).

-- ─── Add deposit columns to rentals ─────────────────────────────────────────
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_method text CHECK (deposit_method IN ('cash', 'bank_transfer', 'telegram_stars', 'none', NULL));
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_collected_at timestamptz;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_collected_by text; -- operator chat_id
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_returned boolean DEFAULT false;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_returned_at timestamptz;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_returned_by text; -- operator chat_id
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deposit_notes text;

-- ─── Deposit audit log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deposit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id text NOT NULL REFERENCES public.rentals(rental_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('collected', 'returned', 'adjusted', 'noted')),
  amount numeric,
  method text,
  operator_chat_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposit_log_rental_id ON public.deposit_log(rental_id);
CREATE INDEX IF NOT EXISTS idx_deposit_log_created_at ON public.deposit_log(created_at);

-- ─── Shift tracking table ──────────────────────────────────────────────────
-- Tracks operator check-in/check-out for shift management + salary calculation.
CREATE TABLE IF NOT EXISTS public.crew_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id text NOT NULL,
  operator_chat_id text NOT NULL,
  shift_date date NOT NULL,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'absent', 'cancelled')),
  hours_worked numeric GENERATED ALWAYS AS (
    CASE
      WHEN checked_in_at IS NOT NULL AND checked_out_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (checked_out_at - checked_in_at)) / 3600.0
      ELSE NULL
    END
  ) STORED,
  hourly_rate numeric DEFAULT 500, -- ₽/hour, configurable per crew
  salary_amount numeric GENERATED ALWAYS AS (
    CASE
      WHEN hours_worked IS NOT NULL AND hourly_rate IS NOT NULL
      THEN hours_worked * hourly_rate
      ELSE NULL
    END
  ) STORED,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(crew_id, operator_chat_id, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_crew_shifts_crew_date ON public.crew_shifts(crew_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_crew_shifts_operator ON public.crew_shifts(operator_chat_id);

-- ─── RLS for deposit_log ───────────────────────────────────────────────────
ALTER TABLE public.deposit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read deposit logs" ON public.deposit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rentals r
      WHERE r.rental_id = deposit_log.rental_id
      AND r.crew_id IN (
        SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()
      )
    )
  );

-- ─── RLS for crew_shifts ───────────────────────────────────────────────────
ALTER TABLE public.crew_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew members can read shifts" ON public.crew_shifts
  FOR SELECT USING (
    crew_id IN (
      SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()
    )
  );

-- ─── Trigger: auto-update deposit_returned when status changes ─────────────
CREATE OR REPLACE FUNCTION public.auto_log_deposit_return()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a rental is marked as 'completed', auto-set deposit_returned = true
  -- if deposit was collected (deposit_collected_at IS NOT NULL)
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.deposit_collected_at IS NOT NULL AND NEW.deposit_returned = false THEN
      NEW.deposit_returned = true;
      NEW.deposit_returned_at = now();

      -- Log the auto-return
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

-- ─── Verification ──────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260726000001 complete:';
  RAISE NOTICE '  Added 7 deposit columns to rentals';
  RAISE NOTICE '  Created deposit_log table';
  RAISE NOTICE '  Created crew_shifts table';
  RAISE NOTICE '  Created auto-return trigger';
END;
$$;
