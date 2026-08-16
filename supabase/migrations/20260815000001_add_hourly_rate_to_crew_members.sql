-- Migration: add hourly_rate column to crew_members table
-- This allows per-member shift rate configuration (replaces the dead code path
-- that referenced a non-existent crew_members.hourly_rate column)

-- 1. Add hourly_rate column with default 169 (current standard rate)
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS hourly_rate integer DEFAULT 169;

-- 2. Backfill: set existing members to 169 (was previously falling back to 500
--    via code fallback, now corrected to 169)
UPDATE crew_members SET hourly_rate = 169 WHERE hourly_rate IS NULL OR hourly_rate = 500;

-- 3. Add comment for documentation
COMMENT ON COLUMN crew_members.hourly_rate IS 'Per-hour shift rate in RUB. Default 169. Override per-member for custom rates.';

-- Note: The code in CrewShiftsClient.tsx already reads myMemberInfo?.hourly_rate
-- with || 169 fallback. Now that the column exists, it will be populated from
-- the DB and the fallback will only apply for new members before backfill.
--
-- To set a custom rate for a specific member:
-- UPDATE crew_members SET hourly_rate = 200 WHERE user_id = '123456789' AND crew_id = '...';
