-- ═══════════════════════════════════════════════════════════════════════════
-- Comprehensive phone backfill across ALL tables
--
-- PROBLEM:
--   Old /doc-manual code stored client phone in telegram_chat_id (wrong column).
--   Migration 20260720120100 copied telegram_chat_id → created_by_operator_chat_id
--   but did NOT copy to renter_phone / buyer_phone.
--
--   Result: phones that WERE entered by the operator are now stranded in
--   created_by_operator_chat_id (which expects a TG ID, not a phone).
--
--   Additionally, franchize_intents.phone has callback-lead phones that were
--   never linked to their contract artifacts.
--
-- FIX:
--   1. rental_contract_artifacts.renter_phone ← created_by_operator_chat_id
--      where it matches +7NNN... pattern (phone, not TG chat_id).
--   2. sale_contract_artifacts.buyer_phone ← created_by_operator_chat_id
--      same pattern.
--   3. franchise_intents.phone → rental_contract_artifacts.renter_phone
--      matched by renter_full_name identity key (matching leads.ts logic).
--   4. crew_todos.phone ← rental_contract_artifacts.renter_phone (by rental_id).
--   5. user_rental_secrets.renter_phone ← rental_contract_artifacts.renter_phone
--      (by doc_sha256 / source_doc_key).
--
-- SAFETY:
--   Only touches rows WHERE renter_phone/buyer_phone IS NULL.
--   Only fills from values matching E.164 (+7NNNNNNNNNN).
--   Idempotent — re-run is safe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Step 1: rental_contract_artifacts.renter_phone ───────────────────────
-- Backfill from created_by_operator_chat_id where it's a phone (+7NNN...)
UPDATE private.rental_contract_artifacts AS a
SET renter_phone = a.created_by_operator_chat_id
WHERE a.renter_phone IS NULL
  AND a.created_by_operator_chat_id IS NOT NULL
  AND a.created_by_operator_chat_id ~ '^\+7\d{10}$';

-- Also backfill from franchize_intents matched by normalized renter_full_name
-- (same identity key logic as leads.ts / leads-query.mjs)
UPDATE private.rental_contract_artifacts AS a
SET renter_phone = fi.phone
FROM (
  SELECT DISTINCT ON (lower(btrim(regexp_replace(full_name, '[.\s]+', ' ', 'g'), '.')))
    lower(btrim(regexp_replace(full_name, '[.\s]+', ' ', 'g'), '.')) AS norm_name,
    phone
  FROM (
    SELECT
      a2.renter_full_name AS full_name,
      fi2.phone
    FROM private.rental_contract_artifacts a2
    JOIN public.franchize_intents fi2
      ON fi2.phone IS NOT NULL
      AND fi2.phone ~ '^\+7\d{10}$'
      AND a2.crew_slug = fi2.slug
    WHERE a2.renter_phone IS NULL
      AND a2.renter_full_name IS NOT NULL
      AND fi2.phone IS NOT NULL
  ) sub
  WHERE sub.phone IS NOT NULL
) AS fi
WHERE a.renter_phone IS NULL
  AND a.renter_full_name IS NOT NULL
  AND fi.phone IS NOT NULL
  AND lower(btrim(regexp_replace(a.renter_full_name, '[.\s]+', ' ', 'g'), '.')) = fi.norm_name;

-- ── Step 2: sale_contract_artifacts.buyer_phone ──────────────────────────
UPDATE private.sale_contract_artifacts AS a
SET buyer_phone = a.created_by_operator_chat_id
WHERE a.buyer_phone IS NULL
  AND a.created_by_operator_chat_id IS NOT NULL
  AND a.created_by_operator_chat_id ~ '^\+7\d{10}$';

-- ── Step 3: user_rental_secrets.renter_phone ─────────────────────────────
-- Backfill from rental_contract_artifacts matched by doc_sha256 ↔ source_doc_key
UPDATE private.user_rental_secrets AS s
SET renter_phone = a.renter_phone,
    updated_at = COALESCE(s.updated_at, now())
FROM private.rental_contract_artifacts a
WHERE s.renter_phone IS NULL
  AND a.renter_phone IS NOT NULL
  AND (s.source_doc_key = a.original_sha256 OR s.doc_sha256 = a.original_sha256);

-- ── Step 4: crew_todos.phone ─────────────────────────────────────────────
-- Backfill from rental_contract_artifacts matched by crew_todos.rental_id
UPDATE public.crew_todos AS t
SET phone = a.renter_phone
FROM private.rental_contract_artifacts a
WHERE t.phone IS NULL
  AND a.renter_phone IS NOT NULL
  AND t.rental_id IS NOT NULL
  AND t.rental_id = a.rental_id;

-- ── Step 5: Also try crew_todos.phone from linked description JSON ───────
-- In case rental_id FK is null but description has rental id embedded
UPDATE public.crew_todos AS t
SET phone = a.renter_phone
FROM private.rental_contract_artifacts a
WHERE t.phone IS NULL
  AND a.renter_phone IS NOT NULL
  AND t.rental_id IS NULL
  AND t.description LIKE '%' || a.rental_id::text || '%';

-- ── Step 6: Normalize all recovered phones ───────────────────────────────
-- (same logic as hotfix migration — ensures E.164 format)

UPDATE private.rental_contract_artifacts
SET renter_phone = '+7' || substring(regexp_replace(renter_phone, '\D', '', 'g') from 2)
WHERE renter_phone IS NOT NULL
  AND regexp_replace(renter_phone, '\D', '', 'g') ~ '^8\d{10}$';

UPDATE private.rental_contract_artifacts
SET renter_phone = '+' || regexp_replace(renter_phone, '\D', '', 'g')
WHERE renter_phone IS NOT NULL
  AND regexp_replace(renter_phone, '\D', '', 'g') ~ '^7\d{10}$'
  AND renter_phone !~ '^\+7\d{10}$';

UPDATE private.sale_contract_artifacts
SET buyer_phone = '+7' || substring(regexp_replace(buyer_phone, '\D', '', 'g') from 2)
WHERE buyer_phone IS NOT NULL
  AND regexp_replace(buyer_phone, '\D', '', 'g') ~ '^8\d{10}$';

UPDATE private.sale_contract_artifacts
SET buyer_phone = '+' || regexp_replace(buyer_phone, '\D', '', 'g')
WHERE buyer_phone IS NOT NULL
  AND regexp_replace(buyer_phone, '\D', '', 'g') ~ '^7\d{10}$'
  AND buyer_phone !~ '^\+7\d{10}$';

-- ── Verification queries (run before & after) ────────────────────────────
/*
SELECT 'rental_contract_artifacts' AS tbl,
  count(*) FILTER (WHERE renter_phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE renter_phone IS NOT NULL) AS has_phone,
  count(*) FILTER (WHERE renter_phone ~ '^\+7\d{10}$') AS valid_e164
FROM private.rental_contract_artifacts;

SELECT 'sale_contract_artifacts' AS tbl,
  count(*) FILTER (WHERE buyer_phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE buyer_phone IS NOT NULL) AS has_phone,
  count(*) FILTER (WHERE buyer_phone ~ '^\+7\d{10}$') AS valid_e164
FROM private.sale_contract_artifacts;

SELECT 'user_rental_secrets' AS tbl,
  count(*) FILTER (WHERE renter_phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE renter_phone IS NOT NULL) AS has_phone
FROM private.user_rental_secrets;

SELECT 'crew_todos' AS tbl,
  count(*) FILTER (WHERE phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE phone IS NOT NULL) AS has_phone
FROM public.crew_todos;
*/
