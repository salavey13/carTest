-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260811000002_rental_photos_code_review_hotfix.sql
-- Purpose:   I3 code-review hotfix — fixes C1 (RLS security hole), C5 (atomic
--             counter increment RPC), H3 (dedup before unique index)
-- Meta:      docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md I3 code review
-- ═══════════════════════════════════════════════════════════════════════════
--
-- C1: can_access_rental_photo() parameter shadowing
-- ────────────────────────────────────────────────
-- The function parameter was named `user_id`, which collides with the
-- `crew_members.user_id` column inside the PERFORM query. PL/pgSQL's default
-- variable_conflict setting resolves unqualified names to columns when a FROM
-- clause is present — so `WHERE user_id = user_id` became
-- `crew_members.user_id = crew_members.user_id` (always TRUE).
--
-- Impact: any caller (including unauthenticated requests with empty user_id)
-- passed the crew check as long as the rental's bike had ANY active crew
-- member. The RLS SELECT policies were effectively no-ops.
--
-- Fix: rename the parameter to `p_user_id` so it's unambiguous.
--
-- C5: atomic counter increment RPC
-- ────────────────────────────────
-- The I3 code called `supabaseAdmin.rpc("increment_photo_count", ...)` but
-- this RPC didn't exist. The fallback used read-modify-write which is a race
-- condition (two concurrent uploads both read count=2, both write 3, lose 1).
--
-- Fix: create the RPC with an atomic UPDATE ... SET col = col + 1.
--
-- H3: dedup before unique index
-- ─────────────────────────────
-- If the migration is ever re-run after data exists with duplicate
-- (rental_id, photo_type, sha256_hash) tuples, CREATE UNIQUE INDEX fails.
-- Add a dedup DELETE step before the index creation (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── C1: Recreate can_access_rental_photo with p_user_id parameter ─────────
CREATE OR REPLACE FUNCTION public.can_access_rental_photo(
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
  -- split_part returns the first segment (rental_id).
  path_rental_id := split_part(object_path, '/', 1);

  -- Validate it's a UUID (case-insensitive — accept uppercase hex too)
  IF path_rental_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

  -- Fetch the rental + vehicle crew_id in one shot
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

  -- Check 1: is the caller the renter or owner?
  IF rental_row.user_id = p_user_id OR rental_row.owner_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Check 2: is the caller an active crew member of the bike's crew?
  -- (parameter renamed to p_user_id — no longer collides with crew_members.user_id column)
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

-- Re-grant (in case the recreate dropped privileges)
GRANT EXECUTE ON FUNCTION public.can_access_rental_photo(TEXT, TEXT) TO service_role, anon, authenticated;

COMMENT ON FUNCTION public.can_access_rental_photo(TEXT, TEXT) IS
  'I3 hotfix 2026-08-11: parameter renamed to p_user_id to avoid shadowing crew_members.user_id column.';


-- ─── C5: Atomic counter increment RPC ──────────────────────────────────────
-- Called by uploadRentalPhoto (INSERT, delta=+1) and deleteRentalPhoto (delta=-1).
-- Atomic UPDATE col = col + delta — no race condition.
-- Validates column name to prevent SQL injection via dynamic SQL.
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
  -- Whitelist column name (prevent SQL injection via EXECUTE)
  IF p_column NOT IN ('start_photo_count', 'end_photo_count') THEN
    RAISE EXCEPTION 'Invalid column name for increment_photo_count: %', p_column;
  END IF;

  -- Atomic increment — no read-modify-write race
  -- GREATEST(0, ...) clamps to 0 on decrement (prevents negative counts)
  EXECUTE format(
    'UPDATE public.rentals SET %I = GREATEST(0, %I + $1) WHERE rental_id = $2',
    p_column, p_column
  ) USING p_delta, p_rental_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_photo_count(UUID, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.increment_photo_count(UUID, TEXT, INTEGER) IS
  'Atomic increment/decrement of start_photo_count or end_photo_count on rentals. Pass p_delta=-1 for decrement (clamped at 0).';


-- ─── H3: Dedup before unique index (idempotent) ────────────────────────────
-- If duplicate (rental_id, photo_type, sha256_hash) rows exist (e.g. from a
-- race in uploadRentalPhoto before this hotfix), the unique index creation
-- would fail. Delete duplicates first, keeping the oldest by created_at.
DELETE FROM public.rental_photos a
USING public.rental_photos b
WHERE a.id > b.id
  AND a.rental_id = b.rental_id
  AND a.photo_type = b.photo_type
  AND a.sha256_hash = b.sha256_hash;

-- Now safe to (re)create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rental_photos_dedup
  ON public.rental_photos(rental_id, photo_type, sha256_hash);


-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Verify the function signature changed (parameter is now p_user_id):
--    SELECT pg_get_function_arguments('can_access_rental_photo'::regproc);
--    -- Expect: object_path text, p_user_id text
--
-- 2. Verify the RPC exists:
--    SELECT proname FROM pg_proc WHERE proname = 'increment_photo_count';
--    -- Expect: 1 row
--
-- 3. Test the fixed RLS function:
--    SELECT public.can_access_rental_photo('00000000-0000-0000-0000-000000000000/start/test.jpg', '');
--    -- Expect: false (empty user_id, no rental found OR rental exists but caller isn't renter/crew)
--
--    SELECT public.can_access_rental_photo('invalid-path', 'some-user');
--    -- Expect: false (not a UUID)
--
-- 4. Verify no duplicates remain:
--    SELECT rental_id, photo_type, sha256_hash, count(*)
--    FROM public.rental_photos
--    GROUP BY 1, 2, 3 HAVING count(*) > 1;
--    -- Expect: 0 rows
-- ═══════════════════════════════════════════════════════════════════════════
