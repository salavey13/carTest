-- /supabase/migrations/20260623000001_backfill_rentals_from_artifacts.sql
-- BACKFILL: Create rentals entries from existing rental_contract_artifacts
-- PURPOSE: Test migration to populate rentals table from legacy contracts
--          created before the skill was updated to always create rentals.
--
-- USE CASE: Contracts from 20.06/21.06 that only have rental_contract_artifacts
--           entries but no corresponding rentals table entries.
--
-- SAFETY: This is a ONE-TIME backfill. After running, you can delete this migration
--         or mark it as run. It uses INSERT ... ON CONFLICT DO NOTHING to avoid
--         duplicates if run multiple times.

-- Step 1: Create a helper function to parse Russian dates (DD.MM.YYYY) to timestamp
CREATE OR REPLACE FUNCTION private.parse_ru_date(date_text TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
  parts TEXT[];
  day_num INT;
  month_num INT;
  year_num INT;
BEGIN
  IF date_text IS NULL OR date_text = '' THEN
    RETURN NULL;
  END IF;

  -- Split by '.' and expect DD.MM.YYYY format
  parts := regexp_split_to_array(date_text, '\.');

  IF array_length(parts, 1) != 3 THEN
    RETURN NULL;
  END IF;

  day_num := parts[1]::INT;
  month_num := parts[2]::INT;
  year_num := parts[3]::INT;

  -- Handle 2-digit years (YY -> 20YY)
  IF year_num < 100 THEN
    year_num := 2000 + year_num;
  END IF;

  -- Create timestamp at noon Moscow time (UTC+3)
  RETURN make_timestamp(
    year_num,
    month_num,
    day_num,
    12,  -- noon
    0,
    0
  ) AT TIME ZONE 'Europe/Moscow';
END;
$$;

-- Step 2: Backfill rentals from rental_contract_artifacts
-- For each artifact that doesn't have a matching rental entry
INSERT INTO public.rentals (
  rental_id,
  user_id,
  owner_id,
  vehicle_id,
  status,
  payment_status,
  requested_start_date,
  requested_end_date,
  agreed_start_date,
  agreed_end_date,
  total_cost,
  metadata,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() AS rental_id,
  -- Use telegram_chat_id as placeholder user_id (crew owner would be better but not available)
  COALESCE(rca.telegram_chat_id::TEXT, 'system') AS user_id,
  -- Use telegram_chat_id as owner_id placeholder
  COALESCE(rca.telegram_chat_id::TEXT, 'system') AS owner_id,
  rca.resolved_bike_id AS vehicle_id,
  'active' AS status,  -- Backfilled as active since contracts were signed
  'fully_paid' AS payment_status,  -- Assume fully paid for signed contracts
  private.parse_ru_date(rca.rent_start_date) AS requested_start_date,
  private.parse_ru_date(rca.rent_end_date) AS requested_end_date,
  private.parse_ru_date(rca.rent_start_date) AS agreed_start_date,  -- Same as requested for backfill
  private.parse_ru_date(rca.rent_end_date) AS agreed_end_date,  -- Same as requested for backfill
  -- Use total_sum if available, otherwise calculate from daily_price
  COALESCE(
    rca.total_sum::NUMERIC,
    (rca.daily_price::NUMERIC * 1)  -- Fallback: at least daily price
  ) AS total_cost,
  jsonb_build_object(
    'source', 'backfill_from_artifacts',
    'backfilled_at', NOW(),
    'original_contract_key', rca.contract_key,
    'original_sha256', rca.original_sha256,
    'telegram_chat_id', rca.telegram_chat_id,
    'daily_price', rca.daily_price
  ) AS metadata,
  rca.created_at AS created_at,  -- Use original artifact created_at
  NOW() AS updated_at
FROM private.rental_contract_artifacts rca
-- Only backfill rent contracts (not sale)
WHERE rca.rent_start_date IS NOT NULL
  AND rca.rent_end_date IS NOT NULL
  AND rca.resolved_bike_id IS NOT NULL
  -- DEDUPE: Skip if rental already exists by multiple criteria
  AND NOT EXISTS (
    -- Check 1: By original_contract_key in metadata (already backfilled)
    SELECT 1 FROM public.rentals r
    WHERE r.metadata->>'original_contract_key' = rca.contract_key
    UNION ALL
    -- Check 2: By original_sha256 in metadata (created by skill with contract_sha256)
    SELECT 1 FROM public.rentals r
    WHERE r.metadata->>'contract_sha256' = rca.original_sha256
    UNION ALL
    -- Check 3: By bike_id + date overlap (same bike, same dates = same rental)
    SELECT 1 FROM public.rentals r
    WHERE r.vehicle_id = rca.resolved_bike_id
      AND r.requested_start_date = private.parse_ru_date(rca.rent_start_date)
      AND r.requested_end_date = private.parse_ru_date(rca.rent_end_date)
      AND r.metadata->>'source' IN ('bot_contract', 'doc_command', 'franchize_order')
  )
ON CONFLICT (rental_id) DO NOTHING;

-- Step 3: Update rental_contract_artifacts with the new rental_id
UPDATE private.rental_contract_artifacts rca
SET rental_id = (
  SELECT r.rental_id
  FROM public.rentals r
  WHERE r.metadata->>'original_contract_key' = rca.contract_key
  LIMIT 1
)
WHERE rca.rental_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.rentals r
    WHERE r.metadata->>'original_contract_key' = rca.contract_key
  );

-- Step 4: Report results
DO $$
DECLARE
  backfilled_count INT;
  updated_artifacts_count INT;
BEGIN
  SELECT COUNT(*) INTO backfilled_count
  FROM public.rentals
  WHERE metadata->>'source' = 'backfill_from_artifacts';

  SELECT COUNT(*) INTO updated_artifacts_count
  FROM private.rental_contract_artifacts
  WHERE rental_id IS NOT NULL
    AND rental_id IN (
      SELECT rental_id FROM public.rentals WHERE metadata->>'source' = 'backfill_from_artifacts'
    );

  RAISE NOTICE 'Backfill complete: % rentals created, % artifacts updated with rental_id',
    backfilled_count, updated_artifacts_count;
END $$;

-- Clean up helper function (optional - keep for potential future use)
-- DROP FUNCTION IF EXISTS private.parse_ru_date(TEXT);

COMMENT ON FUNCTION private.parse_ru_date IS 'Helper to parse Russian date format DD.MM.YYYY to timestamp';
