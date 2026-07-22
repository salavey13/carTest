-- ═══════════════════════════════════════════════════════════════════════════
-- ALL 3 MIGRATIONS — один файл для Supabase SQL Editor
-- Выполнять строго по порядку (1→2→3). Всё идемпотентно.
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1️⃣  20260722010000 — CHECK constraints fix (franchize_intents)
-- ────────────────────────────────────────────────────────────────────────────

alter table public.franchize_intents
  drop constraint if exists franchize_intents_intent_type_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_intent_type_allowed check (
    intent_type in (
      'callback_request',
      'checkout_start',
      'contact_click',
      'finance',
      'hold_created',
      'map_click',
      'payment_failure',
      'payment_success',
      'prebuy',
      'rent',
      'sale',
      'service',
      'test_drive',
      'test_ride',
      'test_ride_click',
      'trade_in'
    )
  );

alter table public.franchize_intents
  drop constraint if exists franchize_intents_stage_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_stage_allowed check (
    stage in (
      'alternative_offered',
      'checkout_started',
      'clicked',
      'closed',
      'configured',
      'contacted',
      'contract_generated',
      'discovered',
      'dismissed',
      'finance_requested',
      'hold_created',
      'lead_captured',
      'manual_reserved',
      'offer_sent',
      'payment_confirmed',
      'payment_failed',
      'prebuy_started',
      'test_ride_requested',
      'trade_in_requested',
      'viewed'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 2️⃣  20260722130000 — Backfill renter_phone from public.users
-- ────────────────────────────────────────────────────────────────────────────

UPDATE private.rental_contract_artifacts AS a
SET renter_phone = u.phone_value
FROM (
  SELECT
    lower(btrim(regexp_replace(u.full_name, '[.\s]+', ' ', 'g'), '.')) AS norm_name,
    COALESCE(
      NULLIF(u.metadata->>'phone', ''),
      CASE
        WHEN u.user_id ~ '^\+?\d{11,13}$' THEN u.user_id
      END
    ) AS phone_value
  FROM public.users u
  WHERE u.full_name IS NOT NULL
    AND (
      NULLIF(u.metadata->>'phone', '') IS NOT NULL
      OR u.user_id ~ '^\+?\d{11,13}$'
    )
) AS u
WHERE a.renter_phone IS NULL
  AND a.renter_full_name IS NOT NULL
  AND u.phone_value IS NOT NULL
  AND lower(btrim(regexp_replace(a.renter_full_name, '[.\s]+', ' ', 'g'), '.')) = u.norm_name;

UPDATE private.user_rental_secrets AS s
SET renter_phone = u.phone_value,
    updated_at = COALESCE(s.updated_at, now())
FROM (
  SELECT
    lower(btrim(regexp_replace(u.full_name, '[.\s]+', ' ', 'g'), '.')) AS norm_name,
    COALESCE(
      NULLIF(u.metadata->>'phone', ''),
      CASE
        WHEN u.user_id ~ '^\+?\d{11,13}$' THEN u.user_id
      END
    ) AS phone_value
  FROM public.users u
  WHERE u.full_name IS NOT NULL
    AND (
      NULLIF(u.metadata->>'phone', '') IS NOT NULL
      OR u.user_id ~ '^\+?\d{11,13}$'
    )
) AS u
WHERE s.renter_phone IS NULL
  AND s.renter_full_name IS NOT NULL
  AND u.phone_value IS NOT NULL
  AND lower(btrim(regexp_replace(s.renter_full_name, '[.\s]+', ' ', 'g'), '.')) = u.norm_name;

-- ────────────────────────────────────────────────────────────────────────────
-- 3️⃣  20260722140000 — Comprehensive phone backfill
--      Source of truth: user_rental_secrets → artifacts → todos
-- ────────────────────────────────────────────────────────────────────────────

-- Ensure created_by_operator_chat_id columns exist (self-sufficient, no deps)
ALTER TABLE IF EXISTS private.rental_contract_artifacts
  ADD COLUMN IF NOT EXISTS created_by_operator_chat_id TEXT;

ALTER TABLE IF EXISTS private.sale_contract_artifacts
  ADD COLUMN IF NOT EXISTS created_by_operator_chat_id TEXT;

-- Step 1: rental_contract_artifacts ← user_rental_secrets
UPDATE private.rental_contract_artifacts AS a
SET renter_phone = s.renter_phone
FROM private.user_rental_secrets s
WHERE a.renter_phone IS NULL
  AND s.renter_phone IS NOT NULL
  AND s.renter_phone ~ '^\+7\d{10}$'
  AND (s.source_doc_key = a.original_sha256 OR s.doc_sha256 = a.original_sha256);

-- Step 2: sale_contract_artifacts ← created_by_operator_chat_id
UPDATE private.sale_contract_artifacts AS a
SET buyer_phone = a.created_by_operator_chat_id
WHERE a.buyer_phone IS NULL
  AND a.created_by_operator_chat_id IS NOT NULL
  AND a.created_by_operator_chat_id ~ '^\+7\d{10}$';

-- Step 3: rental_contract_artifacts ← created_by_operator_chat_id (fallback)
UPDATE private.rental_contract_artifacts AS a
SET renter_phone = a.created_by_operator_chat_id
WHERE a.renter_phone IS NULL
  AND a.created_by_operator_chat_id IS NOT NULL
  AND a.created_by_operator_chat_id ~ '^\+7\d{10}$';

-- Step 4: user_rental_secrets ← rental_contract_artifacts (reverse, only still NULL)
UPDATE private.user_rental_secrets AS s
SET renter_phone = a.renter_phone,
    updated_at = COALESCE(s.updated_at, now())
FROM private.rental_contract_artifacts a
WHERE s.renter_phone IS NULL
  AND a.renter_phone IS NOT NULL
  AND (s.source_doc_key = a.original_sha256 OR s.doc_sha256 = a.original_sha256);

-- Step 5: crew_todos.phone ← rental_contract_artifacts
UPDATE public.crew_todos AS t
SET phone = a.renter_phone
FROM private.rental_contract_artifacts a
WHERE t.phone IS NULL
  AND a.renter_phone IS NOT NULL
  AND t.rental_id IS NOT NULL
  AND t.rental_id = a.rental_id;

-- Step 6: Normalize all recovered phones to E.164
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

-- ═══════════════════════════════════════════════════════════════════════════
-- ВЕРИФИКАЦИЯ — показывает результат ДО и ПОСЛЕ
-- Скопируй и выполни ДО migrations (чтобы видеть «было»),
-- затем выполни миграции, потом снова это — увидишь «стало».
-- ═══════════════════════════════════════════════════════════════════════════

SELECT '--- BEFORE / AFTER ---' AS info;

SELECT 'CHECK constraints fixed' AS step,
  (SELECT count(*) FROM public.franchize_intents WHERE intent_type = 'callback_request') AS callback_request_cnt,
  (SELECT count(*) FROM public.franchize_intents WHERE stage = 'dismissed') AS dismissed_cnt;

SELECT 'user_rental_secrets' AS tbl,
  count(*) AS total,
  count(*) FILTER (WHERE renter_phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE renter_phone IS NOT NULL) AS has_phone,
  count(*) FILTER (WHERE renter_phone ~ '^\+7\d{10}$') AS valid_e164
FROM private.user_rental_secrets;

SELECT 'rental_contract_artifacts' AS tbl,
  count(*) AS total,
  count(*) FILTER (WHERE renter_phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE renter_phone IS NOT NULL) AS has_phone,
  count(*) FILTER (WHERE renter_phone ~ '^\+7\d{10}$') AS valid_e164
FROM private.rental_contract_artifacts;

SELECT 'sale_contract_artifacts' AS tbl,
  count(*) AS total,
  count(*) FILTER (WHERE buyer_phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE buyer_phone IS NOT NULL) AS has_phone
FROM private.sale_contract_artifacts;

SELECT 'crew_todos' AS tbl,
  count(*) AS total,
  count(*) FILTER (WHERE phone IS NULL) AS null_phone,
  count(*) FILTER (WHERE phone IS NOT NULL) AS has_phone
FROM public.crew_todos;
