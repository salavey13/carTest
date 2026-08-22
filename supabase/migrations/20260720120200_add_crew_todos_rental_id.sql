-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260720120200_add_crew_todos_rental_id.sql
-- Phase 3c: Add explicit rental_id FK to crew_todos
--
-- Stops parsing crew_todos.description JSON as primary linkage between
-- todos and rentals. Adds a real FK column backfilled from existing data.
--
-- Changes:
--   1. ADD COLUMN crew_todos.rental_id REFERENCES rentals(rental_id)
--   2. Backfill from description->>'rental_id'
--   3. Add index
--   4. Update propagate_claim to use rental_id column
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Step 1: Add column ────────────────────────────────────────────────

ALTER TABLE public.crew_todos
  ADD COLUMN IF NOT EXISTS rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.crew_todos.rental_id IS
  'FK to rentals table. Set at todo creation, used for matching todos to rentals without parsing description JSON.';


-- ─── Step 2: Backfill from description JSON ─────────────────────────────
-- description stores JSON like: {"rental_id": "abc-123-...", "lead_id": ..., ...}
-- Only backfill where description has a valid UUID rental_id.

UPDATE public.crew_todos
SET rental_id = (description::json->>'rental_id')::uuid
WHERE rental_id IS NULL
  AND description IS NOT NULL
  AND description LIKE '%rental_id%'
  AND (description::json->>'rental_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';


-- ─── Step 3: Index for fast joins ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_crew_todos_rental_id
  ON public.crew_todos(rental_id)
  WHERE rental_id IS NOT NULL;


-- ─── Step 4: Update propagate_claim to use rental_id column ─────────────
-- Instead of matching todos by description LIKE '%rental_id%', use the
-- real FK column. Falls back to description for legacy rows without FK.

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

  -- 1. Update artifact telegram_chat_id → renter
  UPDATE private.rental_contract_artifacts
  SET telegram_chat_id = p_renter_chat_id
  WHERE original_sha256 = p_doc_sha256;

  -- 2. Update secret chat_id → renter (if still unclaimed or held by operator)
  UPDATE private.user_rental_secrets
  SET chat_id = p_renter_chat_id,
      qr_claimed_at = COALESCE(qr_claimed_at, now()),
      updated_at = now()
  WHERE doc_sha256 = p_doc_sha256
    AND (chat_id IS NULL OR chat_id = p_old_user_id OR chat_id = p_renter_chat_id);

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
    -- 4. Update crew_todos: match by rental_id column (FK — primary matcher)
    UPDATE public.crew_todos
    SET user_id = p_renter_chat_id
    WHERE crew_id = v_crew_id::text
      AND rental_id = p_rental_id
      AND (user_id IS NULL OR user_id = p_old_user_id)
      AND user_id IS DISTINCT FROM p_renter_chat_id;

    -- 5. Update crew_todos: match by rental_id in description JSON (fallback for legacy)
    UPDATE public.crew_todos
    SET user_id = p_renter_chat_id
    WHERE crew_id = v_crew_id::text
      AND rental_id IS NULL
      AND description LIKE '%' || p_rental_id::text || '%'
      AND (user_id IS NULL OR user_id = p_old_user_id)
      AND user_id IS DISTINCT FROM p_renter_chat_id;

    -- 6. Update crew_todos: match by lead_id = old operator
    UPDATE public.crew_todos
    SET user_id = p_renter_chat_id
    WHERE crew_id = v_crew_id::text
      AND lead_id = p_old_user_id
      AND (user_id IS NULL OR user_id = p_old_user_id)
      AND user_id IS DISTINCT FROM p_renter_chat_id;

    -- 7. Update lead_notes: re-key from old operator → renter
    UPDATE public.lead_notes
    SET lead_id = p_renter_chat_id
    WHERE crew_id = v_crew_id
      AND lead_id = p_old_user_id;
  END IF;
END;
$$;


-- ── Grant execution to service_role ─────────────────────────────────────
GRANT EXECUTE ON FUNCTION private.propagate_claim TO service_role;
