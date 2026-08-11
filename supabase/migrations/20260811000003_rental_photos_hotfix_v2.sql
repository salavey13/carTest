-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260811000003_rental_photos_hotfix_v2.sql
-- Purpose:   Fix the C1 hotfix migration that failed because PostgreSQL
--             doesn't allow renaming function parameters via CREATE OR REPLACE.
--             Must DROP FUNCTION first, then CREATE with the new signature.
-- Meta:      docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md I3 code review
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ERROR (user-reported 2026-08-11):
--   ERROR: 42P13: cannot change name of input parameter "user_id"
--   HINT:  Use DROP FUNCTION can_access_rental_photo(text,text) first.
--
-- Root cause: CREATE OR REPLACE FUNCTION can change the function body but
-- NOT the parameter names. PostgreSQL treats parameter names as part of the
-- function's signature for overload resolution. To rename, must DROP + CREATE.
--
-- This migration does: DROP FUNCTION → CREATE FUNCTION (with p_user_id) →
-- GRANT → COMMENT. The function body is identical to the v1 hotfix intent.
--
-- Also re-runs the C5 (increment_photo_count RPC) and H3 (dedup) steps from
-- the v1 hotfix migration, in case that migration partially failed.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── C1: DROP + RECREATE can_access_rental_photo with p_user_id ────────────
-- DROP first (required by PG when changing parameter names)
DROP FUNCTION IF EXISTS public.can_access_rental_photo(TEXT, TEXT);

CREATE FUNCTION public.can_access_rental_photo(
  object_path TEXT,
  p_user_id   TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  path_rental_id TEXT;
  rental_row RECORD;
BEGIN
  -- Path schema: '<rental_id>/<start|end>/<file>.jpg'
  path_rental_id := split_part(object_path, '/', 1);

  -- Validate UUID (case-insensitive)
  IF path_rental_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

  -- Fetch rental + vehicle crew_id
  SELECT
    r.user_id,
    r.owner_id,
    c.crew_id
  INTO rental_row
  FROM public.rentals r
  LEFT JOIN public.cars c ON c.id = r.vehicle_id
  WHERE r.rental_id = path_rental_id::uuid;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check 1: renter or owner
  IF rental_row.user_id = p_user_id OR rental_row.owner_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Check 2: active crew member (parameter p_user_id no longer shadows crew_members.user_id)
  IF rental_row.crew_id IS NOT NULL THEN
    PERFORM 1
    FROM public.crew_members
    WHERE crew_id = rental_row.crew_id
      AND user_id = p_user_id
      AND membership_status = 'active'
      AND role IN ('owner', 'admin', 'co_owner', 'member');
    IF FOUND THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_rental_photo(TEXT, TEXT) TO service_role, anon, authenticated;

COMMENT ON FUNCTION public.can_access_rental_photo(TEXT, TEXT) IS
  'I3 hotfix v2 (2026-08-11): parameter renamed to p_user_id via DROP+CREATE. Fixes shadowing of crew_members.user_id column that made the RLS check always TRUE.';


-- ─── C5: Atomic counter increment RPC (re-applied in case v1 hotfix failed) ─
CREATE OR REPLACE FUNCTION public.increment_photo_count(
  p_rental_id UUID,
  p_column    TEXT,
  p_delta     INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_column NOT IN ('start_photo_count', 'end_photo_count') THEN
    RAISE EXCEPTION 'Invalid column name for increment_photo_count: %', p_column;
  END IF;
  EXECUTE format(
    'UPDATE public.rentals SET %I = GREATEST(0, %I + $1) WHERE rental_id = $2',
    p_column, p_column
  ) USING p_delta, p_rental_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_photo_count(UUID, TEXT, INTEGER) TO service_role;


-- ─── H3: Dedup before unique index (re-applied, idempotent) ────────────────
DELETE FROM public.rental_photos a
USING public.rental_photos b
WHERE a.id > b.id
  AND a.rental_id = b.rental_id
  AND a.photo_type = b.photo_type
  AND a.sha256_hash = b.sha256_hash;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_rental_photos_dedup
  ON public.rental_photos(rental_id, photo_type, sha256_hash);


-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Verify parameter name changed:
--    SELECT pg_get_function_arguments('can_access_rental_photo'::regproc);
--    -- Expect: object_path text, p_user_id text
--
-- 2. Verify the RPC exists:
--    SELECT proname FROM pg_proc WHERE proname = 'increment_photo_count';
--
-- 3. Test the fixed RLS:
--    SELECT public.can_access_rental_photo('00000000-0000-0000-0000-000000000000/start/test.jpg', '');
--    -- Expect: false
-- ═══════════════════════════════════════════════════════════════════════════
