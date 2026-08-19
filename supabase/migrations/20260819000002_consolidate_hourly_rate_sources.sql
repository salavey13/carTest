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
-- Single source of truth:
--   WRITE → users.metadata.hourly_rate (via /api/crew/shifts/rate POST)
--   SYNC → crew_member_shifts.hourly_rate (via trg_sync_hourly_rate_on_shift_start)
--   READ → either (1) for future shifts, or (2) for past shifts
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Backfill users.metadata.hourly_rate from crew_members.hourly_rate ───────
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

-- ─── Mark crew_members.hourly_rate as deprecated ──────────────────────────────
COMMENT ON COLUMN public.crew_members.hourly_rate IS
'DEPRECATED 2026-08-19: this column is dead weight — no application code reads it. '
'The single source of truth for a member''s hourly rate is '
'`users.metadata.hourly_rate` (written by /api/crew/shifts/rate POST). '
'New shifts sync that rate into `crew_member_shifts.hourly_rate` via the '
'trg_sync_hourly_rate_on_shift_start AFTER INSERT trigger. '
'Safe to drop in a follow-up migration once a fresh grep confirms zero callers.';

-- ─── Sanity check: log how many rows have a populated rate in each location ──
DO $$
DECLARE
  users_with_rate INTEGER;
  crew_members_with_rate INTEGER;
  shifts_with_rate INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_with_rate
  FROM public.users
  WHERE metadata->>'hourly_rate' IS NOT NULL;

  SELECT COUNT(*) INTO crew_members_with_rate
  FROM public.crew_members
  WHERE hourly_rate IS NOT NULL;

  SELECT COUNT(*) INTO shifts_with_rate
  FROM public.crew_member_shifts
  WHERE hourly_rate IS NOT NULL;

  RAISE NOTICE 'hourly_rate sources after consolidation: users.metadata=%, crew_members=%, crew_member_shifts=%',
    users_with_rate, crew_members_with_rate, shifts_with_rate;
END $$;
