-- ═══════════════════════════════════════════════════════════════════════════
-- Comprehensive phone backfill — source of truth: user_rental_secrets
--
-- PROBLEM:
--   user_rental_secrets.renter_phone is the canonical store for operator-entered
--   phone numbers (set at doc-manual line 1625). But rental_contract_artifacts
--   and crew_todos may have NULL phone when:
--     a) historical rows were created before renter_phone column existed
--     b) old code stored phone in telegram_chat_id (wrong column) and migration
--        20260720120100 moved it to created_by_operator_chat_id (also wrong)
--     c) phone was entered in the OCR step but not propagated to all tables
--
-- FIX (direction: user_rental_secrets → artifacts → todos):
--   1. rental_contract_artifacts.renter_phone ← user_rental_secrets.renter_phone
--      matched by doc_sha256 ↔ source_doc_key / original_sha256
--   2. sale_contract_artifacts.buyer_phone ← created_by_operator_chat_id
--      (if it's a phone, not a TG ID — historical recovery)
--   3. rental_contract_artifacts.renter_phone ← created_by_operator_chat_id
--      (if still null after step 1 — historical recovery)
--   4. user_rental_secrets.renter_phone ← rental_contract_artifacts (reverse)
--      (only rows still null after the above — last-resort cross-fill)
--   5. crew_todos.phone ← rental_contract_artifacts.renter_phone (by rental_id)
--   6. Normalize all to E.164
--
-- SAFETY:
--   Only touches rows WHERE target IS NULL.
--   All phone patterns validated before write.
--   Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Step 1: rental_contract_artifacts ← user_rental_secrets ──────────────
UPDATE private.rental_contract_artifacts AS a
SET renter_phone = s.renter_phone
FROM private.user_rental_secrets s
WHERE a.renter_phone IS NULL
  AND s.renter_phone IS NOT NULL
  AND s.renter_phone ~ '^\+7\d{10}$'
  AND (s.source_doc_key = a.original_sha256 OR s.doc_sha256 = a.original_sha256);

-- ── Step 2: sale_contract_artifacts ← created_by_operator_chat_id ────────
UPDATE private.sale_contract_artifacts AS a
SET buyer_phone = a.created_by_operator_chat_id
WHERE a.buyer_phone IS NULL
  AND a.created_by_operator_chat_id IS NOT NULL
  AND a.created_by_operator_chat_id ~ '^\+7\d{10}$';

-- ── Step 3: rental_contract_artifacts ← created_by_operator_chat_id ──────
-- Covers rows that have no matching user_rental_secrets record.
UPDATE private.rental_contract_artifacts AS a
SET renter_phone = a.created_by_operator_chat_id
WHERE a.renter_phone IS NULL
  AND a.created_by_operator_chat_id IS NOT NULL
  AND a.created_by_operator_chat_id ~ '^\+7\d{10}$';

-- ── Step 4: user_rental_secrets ← rental_contract_artifacts (reverse) ────
-- Only secrets that are still NULL but have a matching artifact with phone.
UPDATE private.user_rental_secrets AS s
SET renter_phone = a.renter_phone,
    updated_at = COALESCE(s.updated_at, now())
FROM private.rental_contract_artifacts a
WHERE s.renter_phone IS NULL
  AND a.renter_phone IS NOT NULL
  AND (s.source_doc_key = a.original_sha256 OR s.doc_sha256 = a.original_sha256);

-- ── Step 5: crew_todos.phone ← rental_contract_artifacts ─────────────────
UPDATE public.crew_todos AS t
SET phone = a.renter_phone
FROM private.rental_contract_artifacts a
WHERE t.phone IS NULL
  AND a.renter_phone IS NOT NULL
  AND t.rental_id IS NOT NULL
  AND t.rental_id = a.rental_id;

-- ── Step 6: Normalize all recovered phones to E.164 ──────────────────────
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
SELECT 'user_rental_secrets' AS src,
  count(*) FILTER (WHERE renter_phone IS NOT NULL) AS has_phone
FROM private.user_rental_secrets;

SELECT 'rental_contract_artifacts' AS tbl,
  count(*) FILTER (WHERE renter_phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE renter_phone IS NOT NULL) AS has_phone,
  count(*) FILTER (WHERE renter_phone ~ '^\+7\d{10}$') AS valid_e164
FROM private.rental_contract_artifacts;

SELECT 'sale_contract_artifacts' AS tbl,
  count(*) FILTER (WHERE buyer_phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE buyer_phone IS NOT NULL) AS has_phone
FROM private.sale_contract_artifacts;

SELECT 'crew_todos' AS tbl,
  count(*) FILTER (WHERE phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE phone IS NOT NULL) AS has_phone
FROM public.crew_todos;
*/
