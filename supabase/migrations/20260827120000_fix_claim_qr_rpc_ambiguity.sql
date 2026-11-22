-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260827120000_fix_claim_qr_rpc_ambiguity.sql
--
-- FIX: claim_rental_by_qr raises 42702 ("column reference "rental_id" is
-- ambiguous") on EVERY call since its latest edit, because the OUT parameter
-- is named `rental_id` and the function body references the rentals column
-- `rental_id` unqualified. With PL/pgSQL's default variable_conflict=error,
-- any of these statements explodes:
--
--   SELECT * INTO STRICT v_rental FROM public.rentals WHERE rental_id = ...;
--   UPDATE public.rentals SET ... WHERE rental_id = ... AND ...;
--
-- Impact (diagnosed 2026-08-27): every QR deep-link claim
-- (rent_{bikeId}_{docSha256}) silently failed — the client showed
-- "✅ Ваши данные привязаны" while user_rental_secrets.chat_id was never
-- set, so returning renters' passport data never pre-filled the order form.
-- (Web-app orders still saved their own chat_id-keyed secrets, and the
-- iter8 phone-fallback now compensates, but the RPC itself must be fixed.)
--
-- Fix strategy: qualify every ambiguous column reference with a table alias
-- (r.rental_id). OUT parameter names stay unchanged so the PostgREST
-- response shape ({ success, rental_id, error, claimed_now }) — and the TS
-- consumer in app/franchize/server-actions/rental-secrets-claim.ts — are
-- untouched.
--
-- Also set #variable_conflict use_column as a belt-and-suspenders default
-- for any future unqualified reference.
-- ═══════════════════════════════════════════════════════════════════════════

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
#variable_conflict use_column
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
  -- Step 1: Find artifact by doc_sha256
  BEGIN
    SELECT * INTO STRICT v_artifact
    FROM private.rental_contract_artifacts a
    WHERE a.original_sha256 = p_doc_sha256;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      success := false; error := 'DOCUMENT_NOT_FOUND'; claimed_now := false;
      RETURN;
    WHEN TOO_MANY_ROWS THEN
      success := false; error := 'MULTIPLE_DOCUMENTS'; claimed_now := false;
      RETURN;
  END;

  -- Step 2: Validate artifact has rental_id
  IF v_artifact.rental_id IS NULL THEN
    success := false; error := 'NO_RENTAL_LINKED'; claimed_now := false;
    RETURN;
  END IF;

  -- Step 3: Cast rental_id to UUID
  BEGIN
    v_rental_id_uuid := v_artifact.rental_id::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      success := false; error := 'INVALID_RENTAL_ID'; claimed_now := false;
      RETURN;
  END;

  v_crew_slug := v_artifact.crew_slug;

  -- Step 4: Get the rental (alias r — rental_id is ambiguous with the OUT param)
  BEGIN
    SELECT * INTO STRICT v_rental
    FROM public.rentals r
    WHERE r.rental_id = v_rental_id_uuid;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      success := false; error := 'RENTAL_NOT_FOUND'; claimed_now := false;
      RETURN;
  END;

  v_old_user_id := v_rental.user_id;

  -- Step 5: Check claim state via the secret (most reliable signal)
  BEGIN
    SELECT s.chat_id, s.qr_claimed_at INTO v_secret_chat_id, v_secret_claimed_at
    FROM private.user_rental_secrets s
    WHERE s.doc_sha256 = p_doc_sha256
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      v_secret_chat_id := NULL;
      v_secret_claimed_at := NULL;
  END;

  IF v_secret_chat_id IS NOT NULL AND v_secret_chat_id != p_renter_chat_id THEN
    IF v_secret_claimed_at IS NOT NULL THEN
      success := false; error := 'ALREADY_CLAIMED_BY_OTHER'; claimed_now := false;
      RETURN;
    END IF;
    -- qr_claimed_at IS NULL → possibly phone-derived or backfill artifact — allow claim
  END IF;

  -- Step 5b: Preserve operator identity BEFORE overwriting user_id
  UPDATE public.rentals r
  SET created_by_operator_chat_id = COALESCE(r.created_by_operator_chat_id, v_rental.owner_id)
  WHERE r.rental_id = v_rental_id_uuid
    AND r.created_by_operator_chat_id IS NULL;

  -- Step 6: Update rentals.user_id → renter (idempotent)
  UPDATE public.rentals r
  SET user_id = p_renter_chat_id
  WHERE r.rental_id = v_rental_id_uuid
    AND r.user_id IS DISTINCT FROM p_renter_chat_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Step 7: Propagate to all linked tables
  PERFORM private.propagate_claim(
    v_rental_id_uuid, p_doc_sha256, v_old_user_id, p_renter_chat_id, v_crew_slug
  );

  -- Success
  success := true; rental_id := v_artifact.rental_id; claimed_now := (v_updated > 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_rental_by_qr TO service_role;

-- ── Backfill: claim the renter-side secrets for rentals where user_id was
-- already re-keyed to the renter (QR scans that partially worked through the
-- TS fallback / manual fixes) but the secret row still has chat_id NULL.
-- Mirrors the §13.7 semantics: match by artifact sha + source_rental_id.
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT r.rental_id::text AS rental_id_text, r.user_id AS renter_id, a.original_sha256
    FROM public.rentals r
    JOIN private.rental_contract_artifacts a ON a.rental_id::uuid = r.rental_id
    WHERE r.user_id != r.owner_id
      AND a.telegram_chat_id IS DISTINCT FROM r.user_id
  LOOP
    UPDATE private.rental_contract_artifacts a
    SET telegram_chat_id = v_rec.renter_id
    WHERE a.rental_id = v_rec.rental_id_text
      AND a.telegram_chat_id IS DISTINCT FROM v_rec.renter_id;

    UPDATE private.user_rental_secrets s
    SET chat_id = COALESCE(s.chat_id, v_rec.renter_id),
        qr_claimed_at = COALESCE(s.qr_claimed_at, now()),
        updated_at = now()
    WHERE s.doc_sha256 = v_rec.original_sha256
      AND s.chat_id IS NULL;

    RAISE NOTICE 'Backfill checked: rental=% renter=%', v_rec.rental_id_text, v_rec.renter_id;
  END LOOP;
END;
$$;

-- ── Verification helpers (run manually after applying) ─────────────────────
-- 1. The RPC should succeed for an already-claimed doc (idempotent):
--    SELECT * FROM public.claim_rental_by_qr(
--      'a94ba25e228199ac5a7a72b942ea4d57cf9ddc61d921ab64926d7f96d8a0d388',
--      '8935491576');
--    Expected: success=true, claimed_now=false (already claimed by the same user)
--
-- 2. No unclaimed-but-should-be-claimed secrets left for finished rentals:
--    SELECT s.doc_sha256, s.renter_full_name
--    FROM private.user_rental_secrets s
--    JOIN private.rental_contract_artifacts a ON a.original_sha256 = s.doc_sha256
--    WHERE s.chat_id IS NULL AND a.telegram_chat_id IS NOT NULL;
