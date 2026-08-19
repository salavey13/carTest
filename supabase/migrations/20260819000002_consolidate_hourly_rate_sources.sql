-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260819000002_consolidate_hourly_rate_sources.sql
-- Purpose:  Document the single source of truth for `hourly_rate` and mark
--           the unused `crew_members.hourly_rate` column as deprecated.
--
-- Context (from 2026-08-19 salary subsystem code review):
--   The codebase previously had THREE places that stored `hourly_rate`:
--     1. `users.metadata.hourly_rate` (JSONB) — set by /api/crew/shifts/rate
--     2. `crew_member_shifts.hourly_rate` — synced from (1) by the
--        `sync_hourly_rate_on_shift_start` AFTER INSERT trigger
--        (migration 20260814000001_fix_salary_commission_flow.sql)
--     3. `crew_members.hourly_rate` — added by migration
--        20260815000001_add_hourly_rate_to_crew_members.sql, default 169
--
--   After grep'ing the entire app/ tree, (3) is NEVER read by application
--   code. `CrewShiftsClient.tsx` reads `memberData.metadata.hourly_rate`
--   (source 1) and `shift.hourly_rate` (source 2). The salary server
--   actions read `crew_member_shifts.hourly_rate` (source 2).
--
--   Source (3) is therefore dead weight. This migration:
--     - Backfills `users.metadata.hourly_rate` from `crew_members.hourly_rate`
--       where the user has no rate set (so we don't lose any data)
--     - Adds a deprecation COMMENT on `crew_members.hourly_rate` so future
--       schema inspection surfaces the deprecation
--     - Leaves the column in place (dropping is destructive and can be done
--       in a separate migration once we've confirmed zero callers)
--
--   2026-08-19 follow-up: the original migration 20260815000001_add_hourly_rate_to_crew_members.sql
--   was apparently NEVER applied to production (verified via Supabase: the
--   `crew_members` table only has id, crew_id, user_id, role, joined_at,
--   membership_status, last_location, live_status — no hourly_rate).
--   The first attempt at this migration failed with:
--     ERROR: 42703: column cm.hourly_rate does not exist
--   Now we wrap all references to `crew_members.hourly_rate` in
--   information_schema existence checks so the migration succeeds on
--   environments both WITH and WITHOUT the column.
--
-- Single source of truth:
--   WRITE → users.metadata.hourly_rate (via /api/crew/shifts/rate POST)
--   SYNC → crew_member_shifts.hourly_rate (via trg_sync_hourly_rate_on_shift_start)
--   READ → either (1) for future shifts, or (2) for past shifts
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Backfill users.metadata.hourly_rate from crew_members.hourly_rate ───────
-- Only runs if the crew_members.hourly_rate column exists. On environments
-- where migration 20260815000001 was never applied, this block is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crew_members'
      AND column_name = 'hourly_rate'
  ) THEN
    -- Only sets the value if the user's metadata doesn't already have one
    -- (don't overwrite explicit user-set rates). Uses jsonb_set with COALESCE
    -- so we don't blow away the rest of the metadata object.
    UPDATE public.users u
    SET metadata = jsonb_set(
      COALESCE(u.metadata, '{}'::jsonb),
      '{hourly_rate}',
      (cm.hourly_rate::text)::jsonb,
      true  -- create_key if missing
    )
    FROM public.crew_members cm
    WHERE cm.user_id = u.user_id
      AND cm.hourly_rate IS NOT NULL
      AND COALESCE(u.metadata->>'hourly_rate', '') = '';

    RAISE NOTICE 'Backfilled users.metadata.hourly_rate from crew_members.hourly_rate.';
  ELSE
    RAISE NOTICE 'crew_members.hourly_rate column does not exist — skipping backfill (migration 20260815000001 was not applied to this DB).';
  END IF;
END $$;

-- ─── Mark crew_members.hourly_rate as deprecated (if it exists) ─────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crew_members'
      AND column_name = 'hourly_rate'
  ) THEN
    COMMENT ON COLUMN public.crew_members.hourly_rate IS
      'DEPRECATED 2026-08-19: this column is dead weight — no application code reads it. '
      'The single source of truth for a member''s hourly rate is '
      'users.metadata.hourly_rate (written by /api/crew/shifts/rate POST). '
      'New shifts sync that rate into crew_member_shifts.hourly_rate via the '
      'trg_sync_hourly_rate_on_shift_start AFTER INSERT trigger. '
      'Safe to drop in a follow-up migration once a fresh grep confirms zero callers.';
    RAISE NOTICE 'Added deprecation COMMENT on crew_members.hourly_rate.';
  ELSE
    RAISE NOTICE 'crew_members.hourly_rate column does not exist — skipping COMMENT (migration 20260815000001 was not applied to this DB).';
  END IF;
END $$;

-- ─── Sanity check: log how many rows have a populated rate in each location ──
-- This block always runs regardless of whether crew_members.hourly_rate exists,
-- so you can see the consolidation state after applying the migration.
DO $$
DECLARE
  users_with_rate INTEGER;
  crew_members_with_rate INTEGER;
  shifts_with_rate INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_with_rate
  FROM public.users
  WHERE metadata->>'hourly_rate' IS NOT NULL;

  -- Dynamically check crew_members.hourly_rate existence.
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.crew_members WHERE hourly_rate IS NOT NULL'
      INTO crew_members_with_rate;
  EXCEPTION WHEN undefined_column THEN
    crew_members_with_rate := -1;  -- sentinel meaning "column doesn't exist"
  END;

  SELECT COUNT(*) INTO shifts_with_rate
  FROM public.crew_member_shifts
  WHERE hourly_rate IS NOT NULL;

  IF crew_members_with_rate = -1 THEN
    RAISE NOTICE 'hourly_rate sources after consolidation: users.metadata=%, crew_members.hourly_rate=<column does not exist>, crew_member_shifts.hourly_rate=%',
      users_with_rate, shifts_with_rate;
  ELSE
    RAISE NOTICE 'hourly_rate sources after consolidation: users.metadata=%, crew_members.hourly_rate=%, crew_member_shifts.hourly_rate=%',
      users_with_rate, crew_members_with_rate, shifts_with_rate;
  END IF;
END $$;
