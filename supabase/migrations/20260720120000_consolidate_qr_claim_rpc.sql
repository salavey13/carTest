-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260720120000_consolidate_qr_claim_rpc.sql
-- Phase 2: Consolidate QR claim propagation into single atomic RPC
--
-- Replaces the two split TS-side claim paths:
--   Path A: app/lib/qr-linking-handler.ts (missing intents/todos)
--   Path B: app/franchize/server-actions/rental-secrets-claim.ts (partial updates)
--
-- Atomic transaction propagates the claim across 6 tables:
--   rentals → rental_contract_artifacts → user_rental_secrets
--   → franchize_intents → crew_todos → lead_notes
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Helper: claim propagation ──────────────────────────────────────────
-- Idempotent block that propagates the renter identity to all linked tables.
-- Called by claim_rental_by_qr after the primary rental.user_id update.

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
    -- 4. Update crew_todos: match by rental_id in description JSON
    --    (primary matcher — works before QR claim when lead_id is still operator)
    UPDATE public.crew_todos
    SET user_id = p_renter_chat_id
    WHERE crew_id = v_crew_id
      AND description LIKE '%' || p_rental_id::text || '%'
      AND (user_id IS NULL OR user_id = p_old_user_id)
      AND user_id IS DISTINCT FROM p_renter_chat_id;

    -- 5. Update crew_todos: match by lead_id = old operator
    --    (secondary — catches todos keyed by operator id, e.g. intents-based)
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


-- ─── Main RPC: atomic QR claim ──────────────────────────────────────────
-- Called by both entry points after Phase 2 consolidation.
--
-- Returns:
--   success    BOOLEAN  — true if claim was processed
--   rental_id  TEXT     — the rental UUID (as text for client convenience)
--   error      TEXT     — machine-readable error code (null on success)
--   claimed_now BOOLEAN — true if this was a fresh claim (false = already claimed)
--
-- Error codes: DOCUMENT_NOT_FOUND, NO_RENTAL_LINKED, RENTAL_NOT_FOUND,
--              INVALID_RENTAL_ID, ALREADY_CLAIMED_BY_OTHER

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
  v_artifact       RECORD;
  v_rental         RECORD;
  v_old_user_id    TEXT;
  v_crew_slug      TEXT;
  v_rental_id_uuid UUID;
  v_updated        BOOLEAN;
BEGIN
  -- ── Step 1: Find artifact by doc_sha256 ─────────────────────────────
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

  -- ── Step 2: Validate artifact has rental_id ─────────────────────────
  IF v_artifact.rental_id IS NULL THEN
    success := false; error := 'NO_RENTAL_LINKED'; claimed_now := false;
    RETURN;
  END IF;

  -- ── Step 3: Cast rental_id to UUID ──────────────────────────────────
  BEGIN
    v_rental_id_uuid := v_artifact.rental_id::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      success := false; error := 'INVALID_RENTAL_ID'; claimed_now := false;
      RETURN;
  END;

  v_crew_slug := v_artifact.crew_slug;

  -- ── Step 4: Get the rental ──────────────────────────────────────────
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

  -- ── Step 5: Check current claim state ───────────────────────────────
  IF v_rental.user_id != v_rental.owner_id THEN
    -- Already claimed by someone
    IF v_rental.user_id = p_renter_chat_id THEN
      -- Already claimed by this user → idempotent: still propagate missed updates
      PERFORM private.propagate_claim(
        v_rental_id_uuid, p_doc_sha256, v_old_user_id, p_renter_chat_id, v_crew_slug
      );
      success := true; rental_id := v_artifact.rental_id; claimed_now := false;
      RETURN;
    ELSE
      -- Claimed by a different user
      success := false; error := 'ALREADY_CLAIMED_BY_OTHER'; claimed_now := false;
      RETURN;
    END IF;
  END IF;

  -- ── Step 6: Atomic primary update (guard: only if user_id === owner_id) ─
  UPDATE public.rentals
  SET user_id = p_renter_chat_id
  WHERE rental_id = v_rental_id_uuid
    AND user_id = v_rental.owner_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    -- Race condition: someone else claimed it between our SELECT and UPDATE
    BEGIN
      SELECT user_id INTO STRICT v_rental.user_id
      FROM public.rentals
      WHERE rental_id = v_rental_id_uuid;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        success := false; error := 'RENTAL_NOT_FOUND'; claimed_now := false;
        RETURN;
    END;

    IF v_rental.user_id = p_renter_chat_id THEN
      -- We actually got it (concurrent same-user claim — unlikely but handle)
      success := true; rental_id := v_artifact.rental_id; claimed_now := true;
    ELSE
      success := false; error := 'ALREADY_CLAIMED_BY_OTHER'; claimed_now := false;
    END IF;
    RETURN;
  END IF;

  -- ── Step 7: Propagate to all linked tables ──────────────────────────
  PERFORM private.propagate_claim(
    v_rental_id_uuid, p_doc_sha256, v_old_user_id, p_renter_chat_id, v_crew_slug
  );

  -- ── Success ──────────────────────────────────────────────────────────
  success := true; rental_id := v_artifact.rental_id; claimed_now := true;
END;
$$;


-- ── Grant execution to service_role (used by supabaseAdmin) ─────────────
-- The RPC is SECURITY DEFINER, so it runs with owner privileges.
-- Explicit grant makes the function callable via PostgREST.
GRANT EXECUTE ON FUNCTION public.claim_rental_by_qr TO service_role;
GRANT EXECUTE ON FUNCTION private.propagate_claim TO service_role;
