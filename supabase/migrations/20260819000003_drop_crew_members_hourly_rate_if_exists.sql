-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260819000003_drop_crew_members_hourly_rate_if_exists.sql
-- Purpose:  Drop the dead-weight crew_members.hourly_rate column on any
--           environment where it exists. Consolidates the hourly_rate
--           sources to two: users.metadata.hourly_rate (write) and
--           crew_member_shifts.hourly_rate (synced via trigger).
--
-- Context (from 2026-08-19 salary subsystem code review):
--   Migration 20260815000001_add_hourly_rate_to_crew_members.sql originally
--   added a `crew_members.hourly_rate` column. After grep'ing the entire
--   app/ tree, NO application code reads this column — CrewShiftsClient
--   reads `memberData.metadata.hourly_rate` (top-level users table) and
--   `shift.hourly_rate` (crew_member_shifts table). The column was dead
--   weight.
--
--   On production the 20260815000001 migration was NEVER applied (verified
--   via information_schema: the crew_members table has no hourly_rate
--   column). On some dev environments it may have been applied. This
--   migration drops it IF EXISTS so every environment converges to the
--   same clean state.
--
--   The original migration file 20260815000001_add_hourly_rate_to_crew_members.sql
--   has been deleted from the repo so it won't be applied to fresh
--   environments. This drop migration is the safety net for envs that
--   already applied it.
--
-- Single source of truth for hourly_rate:
--   WRITE → users.metadata.hourly_rate (via /api/crew/shifts/rate POST)
--   SYNC  → crew_member_shifts.hourly_rate (via trg_sync_hourly_rate_on_shift_start
--           AFTER INSERT trigger from migration 20260814000001)
--   READ  → users.metadata.hourly_rate (for future shifts / rate editor)
--           OR crew_member_shifts.hourly_rate (for past shifts)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crew_members'
      AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE public.crew_members DROP COLUMN hourly_rate;
    RAISE NOTICE 'Dropped crew_members.hourly_rate column.';
  ELSE
    RAISE NOTICE 'crew_members.hourly_rate column does not exist — nothing to drop (clean state).';
  END IF;
END $$;
