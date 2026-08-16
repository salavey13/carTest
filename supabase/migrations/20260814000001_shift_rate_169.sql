-- Migration: change shift hourly_rate default from 500 to 169
-- and backfill existing shift rows

-- 1. Change column default for all future shifts
ALTER TABLE crew_member_shifts ALTER COLUMN hourly_rate SET DEFAULT 169;

-- 2. Backfill existing shift rows that have the old 500 rate
UPDATE crew_member_shifts SET hourly_rate = 169 WHERE hourly_rate = 500;

-- Note: the || 500 fallbacks in code (route.ts + CrewShiftsClient.tsx)
-- have also been changed to || 169 in the same commit.
-- The crew_members.hourly_rate column does NOT exist (dead code path),
-- so the code always falls through to the || 169 fallback unless
-- users.metadata.hourly_rate is set (per-user override).
