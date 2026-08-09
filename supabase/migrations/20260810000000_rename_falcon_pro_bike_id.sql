-- ═══════════════════════════════════════════════════════════════════════════
-- Rename bike IDs: falcon-pro-2025 → falcon-pro-2026 AND falcon-gt-2025 → falcon-gt-2026
-- Also fix: specs.year "2025" → "2026" (the actual model year for both bikes)
--
-- WHY: Both bike IDs contain "2025" but the actual model year is 2026.
-- The ID is used in generated contract documents (rental/sale/testdrive
-- DOCX filenames, contract numbers, QR deep links) which is misleading.
--
-- INVESTIGATION RESULTS:
--
-- falcon-pro-2025 references:
--   PUBLIC:  cars.id (1), rentals.vehicle_id (1), franchize_intents.bike_id (11),
--            crew_todos.description JSON (12), user_results.car_id (0)
--   PRIVATE: sale_contract_artifacts.bike_id (4), sale_contract_artifacts.storage_path (5),
--            rental_contract_artifacts.bike_id (0), testdrive_contract_artifacts.bike_id (0),
--            user_rental_secrets.source_doc_key (6)
--   STORAGE: carpix/falcon-pro/ folder (NO year — no storage rename needed)
--            specs.gallery URLs use "falcon-pro" (no year) — no URL update needed
--
-- falcon-gt-2025 references:
--   PUBLIC:  cars.id (1), rentals.vehicle_id (0), franchize_intents.bike_id (13),
--            crew_todos.description JSON (6), user_results.car_id (0)
--   PRIVATE: sale_contract_artifacts.bike_id (5), sale_contract_artifacts.storage_path (4),
--            rental_contract_artifacts.bike_id (1), testdrive_contract_artifacts.bike_id (0),
--            user_rental_secrets.source_doc_key (5)
--   STORAGE: carpix/falcon-gt-2025/ folder (WITH year — MUST rename!)
--            specs.gallery URLs use "falcon-gt-2025" (WITH year — MUST update!)
--
-- PRE-MIGRATION STEP (already done):
--   The storage folder carpix/falcon-gt-2025/ has been renamed to carpix/falcon-gt-2026/
--   via scripts/rename_falcon_gt_storage.sh (download → upload → delete for each file).
--   11 images moved. Old folder is now empty.
--   This was done BEFORE the SQL migration so gallery URLs can be updated to match.
--
-- STRATEGY:
--   - Step 1-2: Alter FKs on rentals.vehicle_id + user_results.car_id to ON UPDATE CASCADE
--   - Step 3: Update cars.id for BOTH bikes (CASCADE propagates to rentals + user_results)
--   - Step 4-9: Update all other tables (plain TEXT, no FK — manual update)
--   - Step 10: Update falcon-gt specs.gallery URLs (falcon-pro gallery has no year — skip)
--   - Step 11: Verification queries
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Make rentals.vehicle_id FK support ON UPDATE CASCADE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_vehicle_id_fkey;

ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES public.cars(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Same for user_results.car_id
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_results
  DROP CONSTRAINT IF EXISTS user_results_car_id_fkey;

ALTER TABLE public.user_results
  ADD CONSTRAINT user_results_car_id_fkey
  FOREIGN KEY (car_id) REFERENCES public.cars(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Update cars.id + specs.year for BOTH bikes
-- ═══════════════════════════════════════════════════════════════════════════
-- The CASCADE on rentals.vehicle_id + user_results.car_id propagates automatically.
-- specs.year is updated from "2025" to "2026" in the same UPDATE.

-- 3a: falcon-pro-2025 → falcon-pro-2026
UPDATE public.cars
SET id = 'falcon-pro-2026',
    specs = jsonb_set(specs, '{year}', '"2026"')
WHERE id = 'falcon-pro-2025';

-- 3b: falcon-gt-2025 → falcon-gt-2026
-- ALSO update specs.gallery URLs: falcon-gt-2025 → falcon-gt-2026 in each URL
UPDATE public.cars
SET id = 'falcon-gt-2026',
    specs = jsonb_set(
      jsonb_set(specs, '{year}', '"2026"'),
      '{gallery}',
      (SELECT jsonb_agg(REPLACE(url::text, 'falcon-gt-2025', 'falcon-gt-2026')::jsonb)
       FROM jsonb_array_elements(specs->'gallery') AS url)
    )
WHERE id = 'falcon-gt-2025';

-- Verify both bikes renamed
SELECT id, make, model, specs->>'year' AS year
FROM public.cars
WHERE id IN ('falcon-pro-2026', 'falcon-gt-2026')
ORDER BY id;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Update franchize_intents.bike_id (plain TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.franchize_intents SET bike_id = 'falcon-pro-2026' WHERE bike_id = 'falcon-pro-2025';
UPDATE public.franchize_intents SET bike_id = 'falcon-gt-2026' WHERE bike_id = 'falcon-gt-2025';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Update crew_todos.description (JSON — replace bike ID in text)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.crew_todos
SET description = REPLACE(description::text, 'falcon-pro-2025', 'falcon-pro-2026')::jsonb
WHERE description::text LIKE '%falcon-pro-2025%';

UPDATE public.crew_todos
SET description = REPLACE(description::text, 'falcon-gt-2025', 'falcon-gt-2026')::jsonb
WHERE description::text LIKE '%falcon-gt-2025%';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: Update private.sale_contract_artifacts (plain TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE private.sale_contract_artifacts SET requested_bike_id = 'falcon-pro-2026' WHERE requested_bike_id = 'falcon-pro-2025';
UPDATE private.sale_contract_artifacts SET resolved_bike_id = 'falcon-pro-2026' WHERE resolved_bike_id = 'falcon-pro-2025';
UPDATE private.sale_contract_artifacts SET requested_bike_id = 'falcon-gt-2026' WHERE requested_bike_id = 'falcon-gt-2025';
UPDATE private.sale_contract_artifacts SET resolved_bike_id = 'falcon-gt-2026' WHERE resolved_bike_id = 'falcon-gt-2025';

-- NOTE: storage_path is NOT updated. It contains filenames like
-- "vip-bike/sale-falcon-gt-2025-1782739097482.docx" which are the ACTUAL
-- file paths in Supabase Storage. Renaming the path in DB without renaming
-- the file would break the link. The filename is a historical artifact.

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7: Update private.rental_contract_artifacts (plain TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE private.rental_contract_artifacts SET requested_bike_id = 'falcon-pro-2026' WHERE requested_bike_id = 'falcon-pro-2025';
UPDATE private.rental_contract_artifacts SET resolved_bike_id = 'falcon-pro-2026' WHERE resolved_bike_id = 'falcon-pro-2025';
UPDATE private.rental_contract_artifacts SET requested_bike_id = 'falcon-gt-2026' WHERE requested_bike_id = 'falcon-gt-2025';
UPDATE private.rental_contract_artifacts SET resolved_bike_id = 'falcon-gt-2026' WHERE resolved_bike_id = 'falcon-gt-2025';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 8: Update private.testdrive_contract_artifacts (plain TEXT, no FK)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE private.testdrive_contract_artifacts SET requested_bike_id = 'falcon-pro-2026' WHERE requested_bike_id = 'falcon-pro-2025';
UPDATE private.testdrive_contract_artifacts SET resolved_bike_id = 'falcon-pro-2026' WHERE resolved_bike_id = 'falcon-pro-2025';
UPDATE private.testdrive_contract_artifacts SET requested_bike_id = 'falcon-gt-2026' WHERE requested_bike_id = 'falcon-gt-2025';
UPDATE private.testdrive_contract_artifacts SET resolved_bike_id = 'falcon-gt-2026' WHERE resolved_bike_id = 'falcon-gt-2025';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 9: Update private.user_rental_secrets.source_doc_key
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE private.user_rental_secrets
SET source_doc_key = REPLACE(source_doc_key, 'falcon-pro-2025', 'falcon-pro-2026')
WHERE source_doc_key LIKE '%falcon-pro-2025%';

UPDATE private.user_rental_secrets
SET source_doc_key = REPLACE(source_doc_key, 'falcon-gt-2025', 'falcon-gt-2026')
WHERE source_doc_key LIKE '%falcon-gt-2025%';

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 10: Final verification — all counts should be 0
-- ═══════════════════════════════════════════════════════════════════════════

SELECT '=== VERIFICATION (all counts should be 0) ===' AS info;

SELECT 'cars with falcon-pro-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM public.cars WHERE id = 'falcon-pro-2025';

SELECT 'cars with falcon-gt-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM public.cars WHERE id = 'falcon-gt-2025';

SELECT 'rentals with falcon-pro-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM public.rentals WHERE vehicle_id = 'falcon-pro-2025';

SELECT 'rentals with falcon-gt-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM public.rentals WHERE vehicle_id = 'falcon-gt-2025';

SELECT 'franchize_intents with falcon-pro-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM public.franchize_intents WHERE bike_id = 'falcon-pro-2025';

SELECT 'franchize_intents with falcon-gt-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM public.franchize_intents WHERE bike_id = 'falcon-gt-2025';

SELECT 'crew_todos with falcon-pro-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM public.crew_todos WHERE description::text LIKE '%falcon-pro-2025%';

SELECT 'crew_todos with falcon-gt-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM public.crew_todos WHERE description::text LIKE '%falcon-gt-2025%';

SELECT 'sale_artifacts with falcon-pro-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM private.sale_contract_artifacts
WHERE requested_bike_id = 'falcon-pro-2025' OR resolved_bike_id = 'falcon-pro-2025';

SELECT 'sale_artifacts with falcon-gt-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM private.sale_contract_artifacts
WHERE requested_bike_id = 'falcon-gt-2025' OR resolved_bike_id = 'falcon-gt-2025';

SELECT 'rental_artifacts with falcon-pro-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM private.rental_contract_artifacts
WHERE requested_bike_id = 'falcon-pro-2025' OR resolved_bike_id = 'falcon-pro-2025';

SELECT 'rental_artifacts with falcon-gt-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM private.rental_contract_artifacts
WHERE requested_bike_id = 'falcon-gt-2025' OR resolved_bike_id = 'falcon-gt-2025';

SELECT 'testdrive_artifacts with falcon-pro-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM private.testdrive_contract_artifacts
WHERE requested_bike_id = 'falcon-pro-2025' OR resolved_bike_id = 'falcon-pro-2025';

SELECT 'testdrive_artifacts with falcon-gt-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM private.testdrive_contract_artifacts
WHERE requested_bike_id = 'falcon-gt-2025' OR resolved_bike_id = 'falcon-gt-2025';

SELECT 'user_rental_secrets with falcon-pro-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM private.user_rental_secrets WHERE source_doc_key LIKE '%falcon-pro-2025%';

SELECT 'user_rental_secrets with falcon-gt-2025' AS check_name, COUNT(*) AS rows_with_old_id
FROM private.user_rental_secrets WHERE source_doc_key LIKE '%falcon-gt-2025%';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES:
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Storage DOCX files are NOT renamed. They still have "falcon-pro-2025" or
--    "falcon-gt-2025" in their filenames (e.g., "sale-falcon-gt-2025-1782739097482.docx").
--    This is fine — storage_path in the DB still points to the correct file.
--    The filename is a historical artifact.
--
-- 2. Storage IMAGE files for falcon-gt WERE renamed (via scripts/rename_falcon_gt_storage.sh):
--    carpix/falcon-gt-2025/ → carpix/falcon-gt-2026/ (11 images moved).
--    This was done BEFORE this SQL migration so gallery URLs can be updated to match.
--    falcon-pro images use folder "falcon-pro/" (no year) — no rename needed.
--
-- 3. The FK constraints on rentals.vehicle_id and user_results.car_id now have
--    ON UPDATE CASCADE. Future bike ID renames will propagate automatically.
--
-- 4. specs.gallery URLs for falcon-gt are updated in Step 3b (falcon-gt-2025 → falcon-gt-2026).
--    falcon-pro gallery URLs use "falcon-pro" (no year) — no update needed.
