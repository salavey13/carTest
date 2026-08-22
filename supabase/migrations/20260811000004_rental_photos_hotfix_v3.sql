-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260811000004_rental_photos_hotfix_v3.sql
-- Purpose:   Fix v2 migration that failed because RLS policies depend on
--             can_access_rental_photo() — must DROP ... CASCADE.
-- Meta:      docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md I3 code review
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ERROR (user-reported 2026-08-11):
--   ERROR: 2BP01: cannot drop function can_access_rental_photo(text,text)
--   because other objects depend on it
--   DETAIL: policy rental-photos select for authorized users on table
--   storage.objects depends on function can_access_rental_photo(text,text)
--   policy rental_photos select for authorized users on table rental_photos
--   depends on function can_access_rental_photo(text,text)
--   HINT:  Use DROP ... CASCADE to drop the dependent objects too.
--
-- Root cause: Two RLS policies (on storage.objects + rental_photos) call
-- can_access_rental_photo(). DROP FUNCTION without CASCADE refuses to drop
-- a function that other objects depend on.
--
-- Fix: DROP FUNCTION ... CASCADE. This drops the dependent policies too.
-- Then recreate the function with p_user_id, then recreate the policies.
--
-- This migration is self-contained — it does everything v1 + v2 tried to do:
--   1. DROP FUNCTION ... CASCADE (drops policies too)
--   2. CREATE FUNCTION with p_user_id (C1 fix)
--   3. Recreate RLS policies (storage.objects + rental_photos)
--   4. Re-apply C5 (increment_photo_count RPC)
--   5. Re-apply H3 (dedup before unique index)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. DROP FUNCTION with CASCADE (drops dependent RLS policies) ──────────
DROP FUNCTION IF EXISTS public.can_access_rental_photo(TEXT, TEXT) CASCADE;


-- ─── 2. CREATE FUNCTION with p_user_id (C1 fix) ───────────────────────────
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
  path_rental_id := split_part(object_path, '/', 1);

  IF path_rental_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

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

  -- Check 2: active crew member (p_user_id no longer shadows crew_members.user_id)
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
  'I3 hotfix v3 (2026-08-11): DROP CASCADE + recreate. p_user_id avoids shadowing crew_members.user_id.';


-- ─── 3. Recreate RLS policies (were dropped by CASCADE) ────────────────────

-- storage.objects policies (for rental-photos bucket)
-- Use DO block for idempotency (DROP IF EXISTS + CREATE)
DO $$
BEGIN
  -- SELECT policy
  BEGIN
    DROP POLICY IF EXISTS "rental-photos select for authorized users" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    CREATE POLICY "rental-photos select for authorized users"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'rental-photos'
        AND public.can_access_rental_photo(
          name,
          coalesce(auth.jwt() ->> 'sub', '')
        )
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage SELECT policy create skipped: %', SQLERRM;
  END;

  -- INSERT policy — service role only
  BEGIN
    DROP POLICY IF EXISTS "rental-photos insert service role only" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    CREATE POLICY "rental-photos insert service role only"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'rental-photos'
        AND auth.role() = 'service_role'
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage INSERT policy create skipped: %', SQLERRM;
  END;

  -- DELETE policy — service role only
  BEGIN
    DROP POLICY IF EXISTS "rental-photos delete service role only" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    CREATE POLICY "rental-photos delete service role only"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'rental-photos'
        AND auth.role() = 'service_role'
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage DELETE policy create skipped: %', SQLERRM;
  END;
END
$$;

-- rental_photos table policies
DO $$
BEGIN
  -- SELECT: renter or crew member
  BEGIN
    DROP POLICY IF EXISTS "rental_photos select for authorized users" ON public.rental_photos;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    CREATE POLICY "rental_photos select for authorized users"
      ON public.rental_photos FOR SELECT
      USING (
        public.can_access_rental_photo(
          rental_id::text || '/any/any.jpg',
          coalesce(auth.jwt() ->> 'sub', '')
        )
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rental_photos SELECT policy create skipped: %', SQLERRM;
  END;

  -- INSERT: service role only
  BEGIN
    DROP POLICY IF EXISTS "rental_photos insert service role only" ON public.rental_photos;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    CREATE POLICY "rental_photos insert service role only"
      ON public.rental_photos FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rental_photos INSERT policy create skipped: %', SQLERRM;
  END;

  -- UPDATE: service role only
  BEGIN
    DROP POLICY IF EXISTS "rental_photos update service role only" ON public.rental_photos;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    CREATE POLICY "rental_photos update service role only"
      ON public.rental_photos FOR UPDATE
      USING (auth.role() = 'service_role');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rental_photos UPDATE policy create skipped: %', SQLERRM;
  END;

  -- DELETE: service role only
  BEGIN
    DROP POLICY IF EXISTS "rental_photos delete service role only" ON public.rental_photos;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    CREATE POLICY "rental_photos delete service role only"
      ON public.rental_photos FOR DELETE
      USING (auth.role() = 'service_role');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rental_photos DELETE policy create skipped: %', SQLERRM;
  END;
END
$$;


-- ─── 4. C5: Atomic counter increment RPC ───────────────────────────────────
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


-- ─── 5. H3: Dedup before unique index ──────────────────────────────────────
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
-- 1. Verify parameter name:
--    SELECT pg_get_function_arguments('can_access_rental_photo'::regproc);
--    -- Expect: object_path text, p_user_id text
--
-- 2. Verify RLS policies recreated:
--    SELECT polname, polcmd FROM pg_policies WHERE tablename = 'rental_photos';
--    -- Expect 4 policies: select, insert, update, delete
--
-- 3. Test:
--    SELECT public.can_access_rental_photo('00000000-0000-0000-0000-000000000000/start/test.jpg', '');
--    -- Expect: false
-- ═══════════════════════════════════════════════════════════════════════════
