-- ═══════════════════════════════════════════════════════════════════════════
-- Rename bike ID: falcon-pro-2025 → falcon-pro-2026
-- Also fix: specs.year "2025" → "2026" (the actual model year)
--
-- WHY: The bike ID contains "2025" but the actual model year is 2026.
-- The ID is used in generated contract documents (rental/sale/testdrive
-- DOCX filenames, contract numbers, QR deep links) which is misleading.
--
-- INVESTIGATION RESULTS (all tables referencing falcon-pro-2025):
--
-- PUBLIC SCHEMA:
--   1. cars.id (PK)                          — 1 row (the bike itself)
--   2. rentals.vehicle_id (FK ON DELETE CASCADE, NO ON UPDATE)  — 1 row
--   3. franchize_intents.bike_id (plain TEXT, no FK)            — 11 rows
--   4. crew_todos.description (JSON, contains bike_id in JSON)  — 12 rows
--   5. user_results.car_id (FK ON DELETE CASCADE)               — 0 rows (check)
--
-- PRIVATE SCHEMA (all plain TEXT, no FK):
--   6. sale_contract_artifacts.requested_bike_id / resolved_bike_id  — 4 rows
--   7. sale_contract_artifacts.storage_path (contains bike ID in filename)  — 5 rows
--   8. rental_contract_artifacts.requested_bike_id / resolved_bike_id  — 0 rows
--   9. testdrive_contract_artifacts.requested_bike_id / resolved_bike_id  — 0 rows
--  10. user_rental_secrets.source_doc_key (contains bike ID)  — 6 rows
--
-- STORAGE (Supabase Storage):
--  11. carpix bucket folder "falcon-pro" (NO year in folder name)  — NO CHANGE NEEDED
--  12. specs.gallery URLs use "falcon-pro" (no year)  — NO CHANGE NEEDED
--
-- STRATEGY:
--   - The ONLY FK constraint with ON DELETE CASCADE is on rentals.vehicle_id
--     (and user_results.car_id). There is NO ON UPDATE CASCADE.
--   - If we UPDATE cars.id directly, the FK on rentals.vehicle_id would BLOCK
--     the update (foreign key constraint violation).
--   - Solution: alter the FK to ON UPDATE CASCADE first, then updating cars.id
--     propagates to rentals.vehicle_id + user_results.car_id automatically.
--   - The private tables (no FK) are updated manually.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Make rentals.vehicle_id FK support ON UPDATE CASCADE
-- ═══════════════════════════════════════════════════════════════════════════
-- The current constraint is ON DELETE CASCADE with NO ON UPDATE (defaults to
-- NO ACTION which blocks updates). We need to drop and recreate with
-- ON UPDATE CASCADE so that updating cars.id propagates to rentals.vehicle_id.

ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_vehicle_id_fkey;

ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES public.cars(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Same for user_results.car_id (if any rows exist)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_results
  DROP CONSTRAINT IF EXISTS user_results_car_id_fkey;

ALTER TABLE public.user_results
  ADD CONSTRAINT user_results_car_id_fkey
  FOREIGN KEY (car_id) REFERENCES public.cars(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Update cars.id (propagates to rentals.vehicle_id + user_results.car_id)
-- ═══════════════════════════════════════════════════════════════════════════
-- Also fix specs.year from "2025" to "2026" in the same update.

UPDATE public.cars
SET id = 'falcon-pro-2026',
    specs = jsonb_set(specs, '{year}', '"2026"')
WHERE id = 'falcon-pro-2025';

-- Verify the bike was renamed
SELECT id, make, model, specs->>'year' AS year
FROM public.cars
WHERE id = 'falcon-pro-2026';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Update franchize_intents.bike_id (plain TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.franchize_intents
SET bike_id = 'falcon-pro-2026'
WHERE bike_id = 'falcon-pro-2025';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Update crew_todos.description (JSON — replace bike ID in text)
-- ═══════════════════════════════════════════════════════════════════════════
-- The description column stores JSON with bike_id embedded in the text.
-- We cast to text, replace, and cast back to jsonb.

UPDATE public.crew_todos
SET description = REPLACE(description::text, 'falcon-pro-2025', 'falcon-pro-2026')::jsonb
WHERE description::text LIKE '%falcon-pro-2025%';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: Update private.sale_contract_artifacts (plain TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE private.sale_contract_artifacts
SET requested_bike_id = 'falcon-pro-2026'
WHERE requested_bike_id = 'falcon-pro-2025';

UPDATE private.sale_contract_artifacts
SET resolved_bike_id = 'falcon-pro-2026'
WHERE resolved_bike_id = 'falcon-pro-2025';

-- NOTE: storage_path is NOT updated. It contains filenames like
-- "vip-bike/sale-falcon-pro-2025-1786260529564.docx" which are the ACTUAL
-- file paths in Supabase Storage. Renaming the path in the DB without
-- renaming the file would break the link. The filename is a historical
-- artifact — the file is still accessible at the old path.

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7: Update private.rental_contract_artifacts (plain TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE private.rental_contract_artifacts
SET requested_bike_id = 'falcon-pro-2026'
WHERE requested_bike_id = 'falcon-pro-2025';

UPDATE private.rental_contract_artifacts
SET resolved_bike_id = 'falcon-pro-2026'
WHERE resolved_bike_id = 'falcon-pro-2025';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 8: Update private.testdrive_contract_artifacts (plain TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE private.testdrive_contract_artifacts
SET requested_bike_id = 'falcon-pro-2026'
WHERE requested_bike_id = 'falcon-pro-2025';

UPDATE private.testdrive_contract_artifacts
SET resolved_bike_id = 'falcon-pro-2026'
WHERE resolved_bike_id = 'falcon-pro-2025';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 9: Update private.user_rental_secrets.source_doc_key
-- ═══════════════════════════════════════════════════════════════════════════
-- source_doc_key contains values like "sale-falcon-pro-2025-1786260529564"
-- We update this because source_doc_key is used for lookups.

UPDATE private.user_rental_secrets
SET source_doc_key = REPLACE(source_doc_key, 'falcon-pro-2025', 'falcon-pro-2026')
WHERE source_doc_key LIKE '%falcon-pro-2025%';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 10: Final verification — all counts should be 0
-- ═══════════════════════════════════════════════════════════════════════════

SELECT '=== VERIFICATION (all counts should be 0) ===' AS info;

SELECT 'cars' AS table_name, COUNT(*) AS rows_with_old_id
FROM public.cars WHERE id = 'falcon-pro-2025';

SELECT 'rentals' AS table_name, COUNT(*) AS rows_with_old_id
FROM public.rentals WHERE vehicle_id = 'falcon-pro-2025';

SELECT 'franchize_intents' AS table_name, COUNT(*) AS rows_with_old_id
FROM public.franchize_intents WHERE bike_id = 'falcon-pro-2025';

SELECT 'crew_todos' AS table_name, COUNT(*) AS rows_with_old_id
FROM public.crew_todos WHERE description::text LIKE '%falcon-pro-2025%';

SELECT 'sale_artifacts_bike_id' AS table_name, COUNT(*) AS rows_with_old_id
FROM private.sale_contract_artifacts
WHERE requested_bike_id = 'falcon-pro-2025' OR resolved_bike_id = 'falcon-pro-2025';

SELECT 'rental_artifacts_bike_id' AS table_name, COUNT(*) AS rows_with_old_id
FROM private.rental_contract_artifacts
WHERE requested_bike_id = 'falcon-pro-2025' OR resolved_bike_id = 'falcon-pro-2025';

SELECT 'testdrive_artifacts_bike_id' AS table_name, COUNT(*) AS rows_with_old_id
FROM private.testdrive_contract_artifacts
WHERE requested_bike_id = 'falcon-pro-2025' OR resolved_bike_id = 'falcon-pro-2025';

SELECT 'user_rental_secrets' AS table_name, COUNT(*) AS rows_with_old_id
FROM private.user_rental_secrets WHERE source_doc_key LIKE '%falcon-pro-2025%';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES:
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Storage files are NOT renamed. The DOCX files in Supabase Storage still
--    have "falcon-pro-2025" in their filenames (e.g., "sale-falcon-pro-2025-1786260529564.docx").
--    This is fine — storage_path in the DB still points to the correct file.
--    The filename is a historical artifact.
--
-- 2. The carpix storage bucket folder is "falcon-pro" (no year) — no change needed.
--    Gallery URLs in specs.gallery use "falcon-pro" (no year) — no change needed.
--
-- 3. The FK constraints on rentals.vehicle_id and user_results.car_id now have
--    ON UPDATE CASCADE. This is BETTER than before — future bike ID renames
--    will propagate automatically to rentals and user_results.
--
-- 4. If you also want to rename falcon-gt-2025 → falcon-gt-2026 (same issue),
--    duplicate this migration and replace "falcon-pro" with "falcon-gt".
--    But first verify that falcon-gt's actual year is indeed 2026.
