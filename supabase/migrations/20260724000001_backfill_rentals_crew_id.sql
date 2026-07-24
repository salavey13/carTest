-- Backfill public.rentals.crew_id from public.cars.crew_id
--
-- Background: doc-manual.ts createRentalFromDocContract() resolved
-- bike.crew_id (effectiveCrewId) but never wrote it into the rentals insert,
-- so every rental created via /doc had crew_id = NULL. Crew-scoped queries
-- in rentals-dashboard.ts and the rental-analytics-text skill filter by
-- `crew_id = eq.<crew>` and silently returned 0 rows for active seasons.
--
-- This migration:
--   1. Re-runs the backfill from cars.crew_id (idempotent).
--   2. Adds a trigger so future inserts auto-populate crew_id from the
--      vehicle when the application code forgets to set it. Defence in
--      depth — the TS fix in doc-manual.ts is the primary cure, but this
--      trigger guarantees no future regression (other insert paths,
--      manual SQL, etc.).
--
-- Idempotent: safe to run multiple times.

UPDATE public.rentals r
SET crew_id = c.crew_id
FROM public.cars c
WHERE r.vehicle_id = c.id
  AND c.crew_id IS NOT NULL
  AND r.crew_id IS DISTINCT FROM c.crew_id;

-- Helper function: resolve crew_id from vehicles when missing on insert/update.
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
'Auto-populate rentals.crew_id from cars.crew_id on insert or when vehicle_id changes. Defence-in-depth: doc-manual.ts is the primary source, this trigger catches any other insert path that forgets crew_id.';
