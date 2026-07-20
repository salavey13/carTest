-- ============================================================================
-- Identity flow diagnostics: 20 real rows across all lead/renter tables
-- Run this in Supabase SQL editor and share the results.
-- Shows the exact identity key used in each table for the last 20 rentals.
-- ============================================================================

-- Step 1: Find the crew IDs for our known operator slugs
WITH crew_ids AS (
  SELECT id, slug FROM public.crews WHERE slug IN ('vip-bike', 'svarprofi', 'nnvolt')
),

-- Step 2: Last 20 rentals with all identity-relevant fields
latest_rentals AS (
  SELECT
    r.rental_id,
    r.user_id              AS rentals_user_id,
    r.owner_id             AS rentals_owner_id,
    r.status               AS rentals_status,
    r.requested_start_date AS rentals_start,
    r.requested_end_date   AS rentals_end,
    r.total_cost           AS rentals_total_cost,
    r.created_at           AS rentals_created,
    (r.metadata->>'daily_price')::text AS rentals_daily_price
  FROM public.rentals r
  WHERE r.crew_id IN (SELECT id FROM crew_ids)
  ORDER BY r.created_at DESC
  LIMIT 20
)

-- Step 3: Join with artifacts, secrets, intents, todos
SELECT
  -- Rental fields
  lr.rental_id,
  lr.rentals_user_id,
  lr.rentals_owner_id,

  -- Artifact fields (operator telegram_chat_id, may NOT be the renter)
  rca.telegram_chat_id     AS artifact_tg_chat_id,
  rca.renter_phone         AS artifact_renter_phone,
  rca.renter_full_name     AS artifact_renter_name,

  -- Secret fields (chat_id is NULL until QR claimed)
  urs.chat_id              AS secret_chat_id,
  urs.renter_phone         AS secret_renter_phone,
  urs.source_doc_key       AS secret_source,
  urs.verification_status  AS secret_verification,

  -- Intent fields (telegram_user_id may be operator or renter)
  fi.telegram_user_id      AS intent_tg_user_id,
  fi.phone                 AS intent_phone,
  fi.slug                  AS intent_slug,
  fi.stage                 AS intent_stage,

  -- Todo count for this rental
  (SELECT count(*) FROM public.crew_todos ct
   WHERE (ct.description IS NOT NULL AND ct.description LIKE '%' || lr.rental_id || '%')
  )                        AS rental_todo_count,

  -- Identity state classification
  CASE
    WHEN lr.rentals_user_id IN ('7813830016', '413553377', '356282674') THEN 'OPERATOR_PLACEHOLDER'
    WHEN urs.chat_id IS NOT NULL AND urs.chat_id != lr.rentals_user_id THEN 'QR_CLAIMED_RENTER_MISMATCH'
    WHEN urs.chat_id IS NOT NULL THEN 'QR_CLAIMED'
    WHEN rca.renter_phone IS NOT NULL THEN 'PHONE_ONLY_RENTER'
    ELSE 'UNCLAIMED_OPERATOR'
  END AS identity_state,

  -- How this rental connects to leads
  CASE
    WHEN lr.rentals_user_id = fi.telegram_user_id THEN 'MATCHES_INTENT_BY_USER_ID'
    WHEN rca.renter_phone = fi.phone AND rca.renter_phone IS NOT NULL THEN 'MATCHES_INTENT_BY_PHONE'
    WHEN fi.telegram_user_id IS NULL AND fi.phone IS NOT NULL THEN 'PHONE_ONLY_INTENT'
    ELSE 'NO_DIRECT_MATCH'
  END AS intent_match_type

FROM latest_rentals lr

-- LEFT JOIN artifacts (may or may not exist for each rental)
LEFT JOIN private.rental_contract_artifacts rca
  ON rca.rental_id = lr.rental_id

-- LEFT JOIN secrets (may be NULL if unclaimed)
-- Note: source_rental_id is TEXT, rental_id is UUID → cast UUID to text
LEFT JOIN private.user_rental_secrets urs
  ON urs.source_rental_id = lr.rental_id::text

-- LEFT JOIN intents (match by common identity fields)
LEFT JOIN public.franchize_intents fi
  ON (fi.telegram_user_id = lr.rentals_user_id
      OR (rca.renter_phone IS NOT NULL AND fi.phone = rca.renter_phone)
      OR (urs.chat_id IS NOT NULL AND fi.telegram_user_id = urs.chat_id))
  AND fi.slug IN (SELECT slug FROM crew_ids)

ORDER BY lr.rentals_created DESC;

-- ============================================================================
-- Bonus: Operator count check
-- How many active rentals are still under operator placeholders?
-- ============================================================================
SELECT
  'operator_placeholder_rentals' AS check_name,
  count(*) AS count
FROM public.rentals r
WHERE r.crew_id IN (SELECT id FROM crew_ids)
  AND r.user_id IN ('7813830016', '413553377', '356282674')
  AND r.status NOT IN ('completed', 'cancelled')

UNION ALL

SELECT
  'artifacts_with_operator_id_and_phone' AS check_name,
  count(*) AS count
FROM private.rental_contract_artifacts a
WHERE a.crew_slug IN (SELECT slug FROM crew_ids)
  AND a.telegram_chat_id IN ('7813830016', '413553377', '356282674')
  AND a.renter_phone IS NOT NULL

UNION ALL

SELECT
  'secrets_null_chat_id_after_claim' AS check_name,
  count(*) AS count
FROM private.user_rental_secrets s
WHERE s.crew_slug IN (SELECT slug FROM crew_ids)
  AND s.chat_id IS NULL
  AND s.source_rental_id IS NOT NULL;
