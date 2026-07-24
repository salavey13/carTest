-- /supabase/migrations/20260724000002_fix_rentals_crew_id_comprehensive.sql
--
-- Comprehensive fix for rentals.crew_id = NULL issue.
--
-- Background:
--   Migration 20260724000001 (by the assistant bot) fixed the immediate issue:
--   backfill from cars.crew_id + trigger for future inserts. The TS code fixes
--   in doc-manual.ts, rentals/actions.ts, and markdown-doc/actions.ts ensure
--   all 3 insert paths now set crew_id.
--
--   This migration is a FOLLOW-UP that:
--   1. Re-runs the backfill (catches any rentals created between 20260724000001
--      and the TS fixes being deployed)
--   2. Ensures the trigger exists (idempotent — safe if 20260724000001 ran)
--   3. Handles the sauna-001 edge case (5 rentals with NULL crew_id because
--      the car itself has no crew_id — these are legitimately NULL since
--      sauna-001 is a personal sauna rental, not a vip-bike vehicle)
--
-- NOTE: rental_contract_artifacts has `crew_slug` (string), NOT `crew_id` (UUID).
-- The original version of this migration tried to join on `art.crew_id` which
-- doesn't exist. This version is corrected.
--
-- Idempotent: safe to run multiple times.

-- ─── Step 1: Re-run the rentals backfill from cars.crew_id ──────────────────
-- (Same as migration 20260724000001 step 1 — re-run to catch any new NULLs
-- that were created between the bot's migration and the TS fixes being deployed)
UPDATE public.rentals r
SET crew_id = c.crew_id
FROM public.cars c
WHERE r.vehicle_id = c.id
  AND c.crew_id IS NOT NULL
  AND r.crew_id IS DISTINCT FROM c.crew_id;

-- ─── Step 2: Ensure the trigger exists (idempotent) ─────────────────────────
-- (Copied from migration 20260724000001 — safe to re-create.
-- CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE TRIGGER
-- is fully idempotent.)
CREATE OR REPLACE FUNCTION public.set_rentals_crew_id_from_vehicle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.crew_id IS NULL AND NEW.vehicle_id IS NOT NULL THEN
    SELECT c.crew_id INTO NEW.crew_id
    FROM public.cars c
    WHERE c.id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rentals_set_crew_id ON public.rentals;
CREATE TRIGGER trg_rentals_set_crew_id
  BEFORE INSERT OR UPDATE OF vehicle_id ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_rentals_crew_id_from_vehicle();

COMMENT ON FUNCTION public.set_rentals_crew_id_from_vehicle() IS
'Auto-populate rentals.crew_id from cars.crew_id on insert or when vehicle_id changes. Defence-in-depth: application code is the primary source, this trigger catches any other insert path that forgets crew_id.';

-- ─── Step 3: Verification report ────────────────────────────────────────────
-- Print a summary of what was fixed (visible in Supabase Studio output).
-- After running this migration, the expected state is:
--   - All vip-bike rentals have crew_id = 2d5fde70-1dd3-4f0d-8d72-66ccf6908746
--   - 5 sauna-001 rentals remain NULL (legitimately — sauna-001 is not a
--     vip-bike vehicle, it's a personal sauna rental)
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
  sauna_count INTEGER;
BEGIN
  SELECT COUNT(*) FILTER (WHERE crew_id IS NULL), COUNT(*)
  INTO null_count, total_count
  FROM public.rentals;

  SELECT COUNT(*)
  INTO sauna_count
  FROM public.rentals r
  WHERE r.crew_id IS NULL
    AND r.vehicle_id = 'sauna-001';

  RAISE NOTICE 'Migration 20260724000002 complete:';
  RAISE NOTICE '  Total rentals: %', total_count;
  RAISE NOTICE '  Rentals with NULL crew_id: %', null_count;
  RAISE NOTICE '  Rentals with crew_id set: %', total_count - null_count;
  RAISE NOTICE '  NULLs from sauna-001 (legitimate): %', sauna_count;
  RAISE NOTICE '  Other NULLs (may need investigation): %', null_count - sauna_count;

  IF null_count - sauna_count > 0 THEN
    RAISE NOTICE '  Non-sauna NULLs found — check:';
    RAISE NOTICE '    SELECT r.rental_id, r.vehicle_id, c.make, c.model FROM public.rentals r LEFT JOIN public.cars c ON c.id = r.vehicle_id WHERE r.crew_id IS NULL AND r.vehicle_id <> ''sauna-001'' LIMIT 10;';
  END IF;
END;
$$;
