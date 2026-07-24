-- /supabase/migrations/20260724000002_fix_rentals_crew_id_comprehensive.sql
--
-- Comprehensive fix for rentals.crew_id = NULL issue.
--
-- Background:
--   The bot's migration 20260724000001 fixed the immediate issue (backfill +
--   trigger), but there are additional gaps:
--
--   1. app/rentals/actions.ts createBooking() — doesn't set crew_id on insert
--   2. app/markdown-doc/actions.ts saveRentalDocGenerationDemo() — doesn't
--      set crew_id on insert
--   3. 5 rentals for vehicle sauna-001 still have NULL crew_id because
--      sauna-001 itself has no crew_id in the cars table
--
-- This migration:
--   1. Re-runs the backfill (catches any rentals created between the bot's
--      migration and the TS fixes being deployed)
--   2. Backfills cars.crew_id for vehicles that belong to a crew but are
--      missing the column (the sauna-001 case — resolve from
--      rental_contract_artifacts.crew_id if available)
--   3. Re-runs the rentals backfill again (now that more cars have crew_id)
--   4. Verifies the trigger from migration 20260724000001 exists (creates
--      it if not — idempotent)
--
-- Idempotent: safe to run multiple times.

-- ─── Step 1: Backfill cars.crew_id from rental_contract_artifacts ───────────
-- Some vehicles (like sauna-001) are missing crew_id in the cars table but
-- have rentals with crew_id in the artifacts table. Resolve from there.
UPDATE public.cars c
SET crew_id = art.crew_id
FROM private.rental_contract_artifacts art
WHERE art.resolved_bike_id = c.id
  AND art.crew_id IS NOT NULL
  AND c.crew_id IS NULL;

-- ─── Step 2: Backfill rentals.crew_id from cars.crew_id ─────────────────────
-- (Same as migration 20260724000001 step 1 — re-run to catch any new NULLs)
UPDATE public.rentals r
SET crew_id = c.crew_id
FROM public.cars c
WHERE r.vehicle_id = c.id
  AND c.crew_id IS NOT NULL
  AND r.crew_id IS DISTINCT FROM c.crew_id;

-- ─── Step 3: For rentals where the car STILL has no crew_id, try to resolve ─
-- from the rental_contract_artifacts table directly.
UPDATE public.rentals r
SET crew_id = art.crew_id
FROM private.rental_contract_artifacts art
WHERE art.rental_id = r.rental_id
  AND art.crew_id IS NOT NULL
  AND r.crew_id IS NULL;

-- ─── Step 4: Ensure the trigger exists (idempotent) ─────────────────────────
-- (Copied from migration 20260724000001 — safe to re-create)
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

-- ─── Step 5: Verification query (run manually to check) ─────────────────────
-- After running this migration, verify with:
--
-- SELECT
--   COUNT(*) FILTER (WHERE crew_id IS NULL) AS null_crew_id,
--   COUNT(*) AS total
-- FROM public.rentals;
--
-- Expected: null_crew_id should be 0 (or close to 0 — some legacy rentals
-- with no vehicle_id will still be NULL, which is acceptable).

-- ─── Step 6: Report ─────────────────────────────────────────────────────────
-- Print a summary of what was fixed (visible in Supabase Studio output)
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) FILTER (WHERE crew_id IS NULL), COUNT(*)
  INTO null_count, total_count
  FROM public.rentals;

  RAISE NOTICE 'Migration 20260724000002 complete:';
  RAISE NOTICE '  Total rentals: %', total_count;
  RAISE NOTICE '  Rentals with NULL crew_id: %', null_count;
  RAISE NOTICE '  Rentals with crew_id: %', total_count - null_count;

  IF null_count > 0 THEN
    RAISE NOTICE '  Remaining NULLs are likely rentals with no vehicle_id or no resolvable crew. Check:';
    RAISE NOTICE '    SELECT r.rental_id, r.vehicle_id FROM public.rentals r WHERE r.crew_id IS NULL LIMIT 10;';
  END IF;
END;
$$;
