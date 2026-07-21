-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260721150000_fix_claim_rental_rpc.sql
-- Phase 3c: Fix QR claim RPC for phone-based rentals
--
-- Диагностика показала:
-- 1. RPC `claim_rental_by_qr` использует `user_id != owner_id` как сигнал
--    "уже занято". Но phone-based rental (созданный через веб-форму или
--    /doc-manual с телефоном) имеет user_id = phone_id, owner_id = operator_id,
--    что всегда разные → RPC ошибочно думает "уже занято" и не апдейтит.
-- 2. propagate_claim не обновила artifact.telegram_chat_id для 5 уже
--    заклеймленных rental'ов (все 54 артефакта показывают tg == op).
--
-- Фикс RPC:
--   - Вместо `user_id != owner_id` используем проверку по секрету:
--     если secret.chat_id установлен на ДРУГОГО реального пользователя
--     (не оператора) И qr_claimed_at проставлен → rental занят.
--   - Guard Step 6 меняем с `user_id = owner_id` на `rental_id = uuid`
--     (idempotent, race condition ловится через секрет).
--
-- Фикс propagate_claim:
--   - Добавляем обновление artifact.telegram_chat_id через rental_id
--     (дополнительно к original_sha256 — для надёжности).
--
-- Бэкфилл: обновляем artifact.telegram_chat_id для 5 уже заклеймленных rental'ов.
-- ═══════════════════════════════════════════════════════════════════════════

-- --─ Step 1: Update propagate_claim helper ------------------------------─
-- Улучшаем: обновляем artifact по rental_id (не только по sha256),
--            добавляем обновление secret.source_rental_id

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
    -- 4. Update crew_todos: match by rental_id in description JSON
    UPDATE public.crew_todos
    SET user_id = p_renter_chat_id
    WHERE crew_id = v_crew_id
      AND description LIKE '%' || p_rental_id::text || '%'
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


-- --─ Step 2: Rewrite claim_rental_by_qr RPC ------------------------------
-- Главный фикс: вместо user_id != owner_id используем проверку secret'а.

CREATE OR REPLACE FUNCTION public.claim_rental_by_qr(
  p_doc_sha256      TEXT,
  p_renter_chat_id  TEXT,
  OUT success       BOOLEAN,
  OUT rental_id     TEXT,
  OUT error         TEXT,
  OUT claimed_now   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_artifact          RECORD;
  v_rental            RECORD;
  v_old_user_id       TEXT;
  v_crew_slug         TEXT;
  v_rental_id_uuid    UUID;
  v_updated           INT;
  v_secret_chat_id    TEXT;
  v_secret_claimed_at TIMESTAMPTZ;
BEGIN
  -- -- Step 1: Find artifact by doc_sha256 ----------------------------─
  BEGIN
    SELECT * INTO STRICT v_artifact
    FROM private.rental_contract_artifacts
    WHERE original_sha256 = p_doc_sha256;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      success := false; error := 'DOCUMENT_NOT_FOUND'; claimed_now := false;
      RETURN;
    WHEN TOO_MANY_ROWS THEN
      success := false; error := 'MULTIPLE_DOCUMENTS'; claimed_now := false;
      RETURN;
  END;

  -- -- Step 2: Validate artifact has rental_id ------------------------─
  IF v_artifact.rental_id IS NULL THEN
    success := false; error := 'NO_RENTAL_LINKED'; claimed_now := false;
    RETURN;
  END IF;

  -- -- Step 3: Cast rental_id to UUID ----------------------------------
  BEGIN
    v_rental_id_uuid := v_artifact.rental_id::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      success := false; error := 'INVALID_RENTAL_ID'; claimed_now := false;
      RETURN;
  END;

  v_crew_slug := v_artifact.crew_slug;

  -- -- Step 4: Get the rental ------------------------------------------
  BEGIN
    SELECT * INTO STRICT v_rental
    FROM public.rentals
    WHERE rental_id = v_rental_id_uuid;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      success := false; error := 'RENTAL_NOT_FOUND'; claimed_now := false;
      RETURN;
  END;

  v_old_user_id := v_rental.user_id;

  -- -- Step 5: Check claim state via the secret (MOST RELIABLE SIGNAL) ─
  -- Используем secret как источник правды: если secret.chat_id
  -- установлен на ДРУГОГО Telegram-юзера (не p_renter_chat_id)
  -- И qr_claimed_at проставлен → rental занят другим.
  --
  -- Это заменяет старую проверку user_id != owner_id, которая
  -- ломалась для phone-based rental'ов (user_id = phone_id всегда
  -- отличается от owner_id = operator_id).
  BEGIN
    SELECT chat_id, qr_claimed_at INTO v_secret_chat_id, v_secret_claimed_at
    FROM private.user_rental_secrets
    WHERE doc_sha256 = p_doc_sha256
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      v_secret_chat_id := NULL;
      v_secret_claimed_at := NULL;
  END;

  IF v_secret_chat_id IS NOT NULL AND v_secret_chat_id != p_renter_chat_id THEN
    -- Secret найден и chat_id принадлежит другому пользователю
    IF v_secret_claimed_at IS NOT NULL THEN
      -- Реальный QR claim уже был — rental занят другим
      success := false; error := 'ALREADY_CLAIMED_BY_OTHER'; claimed_now := false;
      RETURN;
    END IF;
    -- Если qr_claimed_at IS NULL, это может быть phone-derived ID
    -- или артефакт бэкфилла — разрешаем claim (secret обновится в propagate)
  END IF;

  -- -- Step 5b: Preserve operator identity BEFORE overwriting user_id --─
  UPDATE public.rentals
  -- NOTE: use owner_id (always the operator) not user_id (may be phone-derived for web-callback rentals)
  SET created_by_operator_chat_id = COALESCE(created_by_operator_chat_id, v_rental.owner_id)
  WHERE rental_id = v_rental_id_uuid
    AND created_by_operator_chat_id IS NULL;

  -- -- Step 6: Update rentals.user_id → renter --------------------------
  -- Guard: просто апдейтим по rental_id (idempotent).
  -- Race condition защищена через секрет (шаг 2 в propagate_claim).
  UPDATE public.rentals
  SET user_id = p_renter_chat_id
  WHERE rental_id = v_rental_id_uuid
    AND user_id IS DISTINCT FROM p_renter_chat_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- -- Step 7: Propagate to all linked tables --------------------------
  PERFORM private.propagate_claim(
    v_rental_id_uuid, p_doc_sha256, v_old_user_id, p_renter_chat_id, v_crew_slug
  );

  -- -- Success ----------------------------------------------------------
  success := true; rental_id := v_artifact.rental_id; claimed_now := (v_updated > 0);
END;
$$;


-- --─ Step 3: Backfill artifact telegram_chat_id for already-claimed rentals --
-- 5 rentals имеют user_id != owner_id (уже заклеймлены), но их артефакты
-- всё ещё показывают telegram_chat_id = created_by_operator_chat_id.
-- Пробегаемся и фиксим.

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT r.rental_id, r.user_id AS renter_id, a.original_sha256
    FROM public.rentals r
    JOIN private.rental_contract_artifacts a ON a.rental_id::uuid = r.rental_id
    WHERE r.user_id != r.owner_id
      AND a.telegram_chat_id IS DISTINCT FROM r.user_id
  LOOP
    -- Update artifact telegram_chat_id → renter
    UPDATE private.rental_contract_artifacts
    SET telegram_chat_id = v_rec.renter_id
    WHERE rental_id = v_rec.rental_id
      AND telegram_chat_id IS DISTINCT FROM v_rec.renter_id;

    -- Update secret source_rental_id if missing
    UPDATE private.user_rental_secrets
    SET source_rental_id = COALESCE(source_rental_id, v_rec.rental_id::text),
        qr_claimed_at = COALESCE(qr_claimed_at, now()),
        updated_at = now()
    WHERE doc_sha256 = v_rec.original_sha256
      AND source_rental_id IS DISTINCT FROM v_rec.rental_id::text;

    RAISE NOTICE 'Backfilled: rental=% renter=%', v_rec.rental_id, v_rec.renter_id;
  END LOOP;
END;
$$;


-- --─ Step 4: Grant permissions --------------------------------------------─
GRANT EXECUTE ON FUNCTION public.claim_rental_by_qr TO service_role;
GRANT EXECUTE ON FUNCTION private.propagate_claim TO service_role;
