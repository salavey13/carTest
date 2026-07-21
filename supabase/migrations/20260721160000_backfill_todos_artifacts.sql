-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260721160000_backfill_todos_artifacts.sql
-- Phase 3c.5: Backfill existing data after RPC fix
--
-- Diagnostika pokazala:
--  - 60/60 crew_todos have user_id = NULL
--  - 30/54 rental_contract_artifacts have no rental_id
--
-- RPC propagate_claim only fixes FUTURE QR claims.
-- This backfill recovers EXISTING rows so the leads page works correctly TODAY.
--
-- Порядок выполнения:
--   1. Сначала выполни RPC migration (20260721150000), если ещё нет
--   2. Потом эту миграцию
--
-- Все UPDATE идемпотентны — можно запускать несколько раз.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Step 1: Backfill crew_todos.user_id ─────────────────────────────────
-- Из 60 todos, 0 имеют user_id. Без этого leads page не видит todos
-- через новый canonical path (только через phone/lead_id fallback).

-- 1a: todos with rental_id column set (новые)
UPDATE public.crew_todos t
SET user_id = r.user_id
FROM public.rentals r
WHERE t.rental_id = r.rental_id
  AND t.user_id IS NULL
  AND r.user_id IS NOT NULL
  AND r.user_id != r.owner_id;  -- skip operator-placeholder rentals

-- 1b: todos with rental_id only in description JSON (старые)
UPDATE public.crew_todos t
SET user_id = r.user_id,
    rental_id = (t.description::jsonb ->> 'rental_id')::uuid  -- promote to column
FROM public.rentals r
WHERE t.rental_id IS NULL
  AND t.user_id IS NULL
  AND (t.description::jsonb ->> 'rental_id') IS NOT NULL
  AND (t.description::jsonb ->> 'rental_id') = r.rental_id::text
  AND r.user_id != r.owner_id;

-- 1c: todos with only lead_id = phone → match via artifact.renter_phone
UPDATE public.crew_todos t
SET user_id = r.user_id
FROM private.rental_contract_artifacts a
JOIN public.rentals r ON r.rental_id = a.rental_id::uuid
WHERE t.user_id IS NULL
  AND t.lead_id IS NOT NULL
  AND a.renter_phone = t.lead_id
  AND r.user_id != r.owner_id;

-- 1d: todos by lead_id = operator → pull user_id from rentals by created_by_operator_chat_id
UPDATE public.crew_todos t
SET user_id = r.user_id
FROM public.rentals r
WHERE t.user_id IS NULL
  AND t.lead_id = r.created_by_operator_chat_id
  AND r.user_id != r.owner_id;

-- Verify
DO $$
DECLARE
  v_total INT; v_now INT; v_still INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE user_id IS NOT NULL), COUNT(*) FILTER (WHERE user_id IS NULL)
  INTO v_total, v_now, v_still FROM public.crew_todos;
  RAISE NOTICE 'Todos backfill: total=%, has_user_id=%, still_null=%', v_total, v_now, v_still;
END;
$$;


-- ─── Step 2: Backfill orphaned artifact rental_ids ───────────────────────
-- 30/54 artifacts have no rental_id. They can never be QR-claimed.

-- 2a: Link via secrets.source_rental_id (самый надёжный)
UPDATE private.rental_contract_artifacts a
SET rental_id = s.source_rental_id::uuid
FROM private.user_rental_secrets s
WHERE a.rental_id IS NULL
  AND a.original_sha256 = s.doc_sha256
  AND s.source_rental_id IS NOT NULL
  AND s.source_rental_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2b: Link by matching operator + bike + start date
UPDATE private.rental_contract_artifacts a
SET rental_id = r.rental_id
FROM public.rentals r
WHERE a.rental_id IS NULL
  AND r.created_by_operator_chat_id = a.created_by_operator_chat_id
  AND r.requested_start_date::text = a.rent_start_date
  AND r.vehicle_id = COALESCE(a.resolved_bike_id, a.requested_bike_id);

-- 2c: Link by matching sha256 with secrets that have source_rental_id (fallback)
UPDATE private.rental_contract_artifacts a
SET rental_id = s.source_rental_id::uuid
FROM private.user_rental_secrets s
WHERE a.rental_id IS NULL
  AND a.original_sha256 = s.doc_sha256
  AND s.source_rental_id IS NOT NULL;

-- Verify
DO $$
DECLARE
  v_total INT; v_linked INT; v_still INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE rental_id IS NOT NULL), COUNT(*) FILTER (WHERE rental_id IS NULL)
  INTO v_total, v_linked, v_still FROM private.rental_contract_artifacts;
  RAISE NOTICE 'Artifacts backfill: total=%, has_rental_id=%, still_orphaned=%', v_total, v_linked, v_still;
END;
$$;


-- ─── Step 3: Re-run propagate_claim for rentals that were claimed ─────────
-- After backfilling rental_ids, some artifacts now have rental linkage but
-- their telegram_chat_id may still be the operator (not renter).
-- Best-effort re-propagation: for each rental where user_id != owner_id,
-- call propagate_claim via the DO block pattern.

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT r.rental_id, r.user_id AS renter_id,
           a.original_sha256, a.created_by_operator_chat_id,
           c.slug AS crew_slug
    FROM public.rentals r
    JOIN private.rental_contract_artifacts a ON a.rental_id::uuid = r.rental_id
    LEFT JOIN public.crews c ON c.slug = a.crew_slug
    WHERE r.user_id != r.owner_id
      AND (a.telegram_chat_id IS DISTINCT FROM r.user_id
           OR a.created_by_operator_chat_id IS NULL)
  LOOP
    -- Preserve operator identity if not already set
    UPDATE private.rental_contract_artifacts
    SET created_by_operator_chat_id = COALESCE(created_by_operator_chat_id, telegram_chat_id)
    WHERE original_sha256 = v_rec.original_sha256;

    -- Set telegram_chat_id → renter
    UPDATE private.rental_contract_artifacts
    SET telegram_chat_id = v_rec.renter_id
    WHERE original_sha256 = v_rec.original_sha256;

    -- Set secret source_rental_id + chat_id if missing
    UPDATE private.user_rental_secrets
    SET source_rental_id = COALESCE(source_rental_id, v_rec.rental_id::text),
        qr_claimed_at = COALESCE(qr_claimed_at, now()),
        updated_at = now()
    WHERE doc_sha256 = v_rec.original_sha256
      AND (source_rental_id IS DISTINCT FROM v_rec.rental_id::text
           OR chat_id IS DISTINCT FROM v_rec.renter_id);

    RAISE NOTICE 'Propagated: rental=% renter=%', v_rec.rental_id, v_rec.renter_id;
  END LOOP;
END;
$$;


-- ─── Step 4: Final verification ──────────────────────────────────────────
SELECT '=== FINAL VERIFICATION ===' AS step;

SELECT 'Artifacts' AS table_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE telegram_chat_id = created_by_operator_chat_id OR created_by_operator_chat_id IS NULL) AS unclaimed,
  COUNT(*) FILTER (WHERE telegram_chat_id != created_by_operator_chat_id) AS claimed,
  COUNT(*) FILTER (WHERE rental_id IS NULL) AS orphaned
FROM private.rental_contract_artifacts;

SELECT 'Secrets' AS table_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE chat_id IS NULL) AS null_chat_id,
  COUNT(*) FILTER (WHERE source_rental_id IS NULL) AS no_source_rental,
  COUNT(*) FILTER (WHERE chat_id IS NOT NULL AND qr_claimed_at IS NOT NULL) AS fully_claimed
FROM private.user_rental_secrets;

SELECT 'Todos' AS table_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS has_user_id,
  COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS has_lead_id,
  COUNT(*) FILTER (WHERE rental_id IS NOT NULL) AS has_rental_id
FROM public.crew_todos;
