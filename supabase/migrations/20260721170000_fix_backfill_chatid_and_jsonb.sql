-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260721170000_fix_backfill_chatid_and_jsonb.sql
-- Phase 3d: Fix known gaps in previous backfill + propagate_claim
--
-- Исправляет (см. §13.7):
--   #1 — backfill в 20260721160000 Step 3 не проставлял secret.chat_id
--        (только source_rental_id и qr_claimed_at). Добавляем chat_id.
--   #3 — propagate_claim Step 4 ищет rental_id через LIKE '%...%' substring
--        match. Меняем на JSONB-извлечение: description::jsonb ->> 'rental_id'.
--
-- Идемпотентно. Запускать после 20260721160000.
-- ═══════════════════════════════════════════════════════════════════════════

-- --─ Step 1: Fix propagate_claim — JSONB вместо LIKE ---------------------
-- LIKE '%' || p_rental_id::text || '%' ловит ложные совпадения (например,
-- rental_id 'abc' совпадает с description 'abc-123'). JSONB точнее.

CREATE OR REPLACE FUNCTION private.propagate_claim(
  p_rental_id          UUID,
  p_doc_sha256         TEXT,
  p_old_user_id        TEXT,
  p_renter_chat_id     TEXT,
  p_crew_slug          TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_crew_id INTEGER;
BEGIN
  -- 0. Preserve operator identity on artifact before overwriting telegram_chat_id
  UPDATE private.rental_contract_artifacts
  SET created_by_operator_chat_id = COALESCE(created_by_operator_chat_id, telegram_chat_id)
  WHERE original_sha256 = p_doc_sha256;

  -- 1a. Update artifact telegram_chat_id → renter (by sha256)
  UPDATE private.rental_contract_artifacts
  SET telegram_chat_id = p_renter_chat_id
  WHERE original_sha256 = p_doc_sha256;

  -- 1b. Also update by rental_id for robustness (catches any sha256 mismatch)
  UPDATE private.rental_contract_artifacts
  SET telegram_chat_id = p_renter_chat_id
  WHERE rental_id = p_rental_id
    AND telegram_chat_id IS DISTINCT FROM p_renter_chat_id;

  -- 2. Update secret: set chat_id → renter, link source_rental_id
  UPDATE private.user_rental_secrets
  SET chat_id = p_renter_chat_id,
      source_rental_id = COALESCE(source_rental_id, p_rental_id::text),
      qr_claimed_at = COALESCE(qr_claimed_at, now()),
      updated_at = now()
  WHERE doc_sha256 = p_doc_sha256
    AND (chat_id IS NULL OR chat_id = p_old_user_id OR chat_id = p_renter_chat_id);

  -- 2b. Also update secrets by source_rental_id (catch any sha256 mismatch)
  UPDATE private.user_rental_secrets
  SET chat_id = p_renter_chat_id,
      qr_claimed_at = COALESCE(qr_claimed_at, now()),
      updated_at = now()
  WHERE source_rental_id = p_rental_id::text
    AND (chat_id IS NULL OR chat_id = p_old_user_id OR chat_id = p_renter_chat_id)
    AND chat_id IS DISTINCT FROM p_renter_chat_id;

  -- 3. Update franchize_intents: re-key from old operator → renter
  IF p_crew_slug IS NOT NULL AND p_old_user_id IS NOT NULL THEN
    UPDATE public.franchize_intents
    SET telegram_user_id = p_renter_chat_id
    WHERE slug = p_crew_slug
      AND telegram_user_id = p_old_user_id;
  END IF;

  -- Resolve crew_id from slug once
  BEGIN
    SELECT id INTO STRICT v_crew_id FROM public.crews WHERE slug = p_crew_slug;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      v_crew_id := NULL;
    WHEN OTHERS THEN
      v_crew_id := NULL;
  END;

  IF v_crew_id IS NOT NULL THEN
    -- 4. Update crew_todos: match by rental_id in description JSON (JSONB, not LIKE)
    UPDATE public.crew_todos
    SET user_id = p_renter_chat_id
    WHERE crew_id = v_crew_id
      AND (description::jsonb ->> 'rental_id') = p_rental_id::text
      AND (user_id IS NULL OR user_id = p_old_user_id)
      AND user_id IS DISTINCT FROM p_renter_chat_id;

    -- 5. Update crew_todos: match by lead_id = old operator
    UPDATE public.crew_todos
    SET user_id = p_renter_chat_id
    WHERE crew_id = v_crew_id
      AND lead_id = p_old_user_id
      AND (user_id IS NULL OR user_id = p_old_user_id)
      AND user_id IS DISTINCT FROM p_renter_chat_id;

    -- 6. Update lead_notes: re-key from old operator → renter
    UPDATE public.lead_notes
    SET lead_id = p_renter_chat_id
    WHERE crew_id = v_crew_id
      AND lead_id = p_old_user_id;
  END IF;
END;
$$;


-- --─ Step 2: Fix backfill — include chat_id for already-claimed rentals ──
-- В 20260721160000 Step 3 секрет обновлялся без chat_id.
-- Перезапускаем с chat_id.

DO $$
DECLARE
  v_rec RECORD;
  v_updated INT;
BEGIN
  FOR v_rec IN
    SELECT r.rental_id, r.user_id AS renter_id,
           a.original_sha256
    FROM public.rentals r
    JOIN private.rental_contract_artifacts a ON a.rental_id::uuid = r.rental_id
    WHERE r.user_id != r.owner_id
      AND (a.telegram_chat_id IS DISTINCT FROM r.user_id
           OR EXISTS (
             SELECT 1 FROM private.user_rental_secrets s
             WHERE s.doc_sha256 = a.original_sha256
               AND (s.chat_id IS DISTINCT FROM r.user_id
                    OR s.chat_id IS NULL)
           ))
  LOOP
    -- Preserve operator identity
    UPDATE private.rental_contract_artifacts
    SET created_by_operator_chat_id = COALESCE(created_by_operator_chat_id, telegram_chat_id)
    WHERE original_sha256 = v_rec.original_sha256;

    -- Set artifact telegram_chat_id → renter
    UPDATE private.rental_contract_artifacts
    SET telegram_chat_id = v_rec.renter_id
    WHERE original_sha256 = v_rec.original_sha256;

    -- Set secret: chat_id + source_rental_id + qr_claimed_at
    UPDATE private.user_rental_secrets
    SET chat_id = v_rec.renter_id,
        source_rental_id = COALESCE(source_rental_id, v_rec.rental_id::text),
        qr_claimed_at = COALESCE(qr_claimed_at, now()),
        updated_at = now()
    WHERE doc_sha256 = v_rec.original_sha256
      AND (chat_id IS DISTINCT FROM v_rec.renter_id
           OR source_rental_id IS DISTINCT FROM v_rec.rental_id::text);

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Fixed: rental=% renter=% secret_rows_updated=%',
      v_rec.rental_id, v_rec.renter_id, v_updated;
  END LOOP;
END;
$$;


-- --─ Step 3: Verify -------------------------------------------------------

DO $$
DECLARE
  v_total_secrets INT;
  v_chat_id_null INT;
  v_chat_id_set INT;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE chat_id IS NULL),
         COUNT(*) FILTER (WHERE chat_id IS NOT NULL)
  INTO v_total_secrets, v_chat_id_null, v_chat_id_set
  FROM private.user_rental_secrets;

  RAISE NOTICE 'Secrets after fix: total=%, chat_id=NULL=%, chat_id=set=%',
    v_total_secrets, v_chat_id_null, v_chat_id_set;
END;
$$;

GRANT EXECUTE ON FUNCTION private.propagate_claim TO service_role;
