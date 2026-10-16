-- ═══════════════════════════════════════════════════════════════════════════
-- salary-hourly-default-100-dj-october-shifts-2026-10-16.sql
-- Task 98 (boss/djorudjov 2026-10-16) — FOR PAUL TO RUN (SQL only Paul runs).
--
-- WHAT THIS DOES
--   1. New default hourly rate = 100 ₽/h (was 500):
--        • crew_member_shifts.hourly_rate column DEFAULT → 100
--        • sync_hourly_rate_on_shift_start() COALESCE fallback → 100
--      «make default value for "per hour" coefficient 100 rub/hour instead of
--      500 and 169 — this way 10h shift equals to 1k rub — closer to reality».
--      Historical shifts keep their stored rate (no recalculation).
--
--   2. Backfills djorudjov's (TG 7813830016, crew vip-bike 2d5fde70) MISSING
--      October shifts. Verified 2026-10-16: crew_member_shifts has rows for
--      01–06 Oct only (12h, rate 500), September is complete, but the boss
--      worked EVERY DAY except 15 Oct (day off). Missing: 07–14 and 16–25
--      October = 18 shifts, inserted at the NEW default 100 ₽/h
--      (12h × 100 = 1 200 ₽ each; 18 × 1 200 = 21 600 ₽).
--
--      ⚠️ RATE DECISION: backfilled shifts use the NEW default 100 ₽/h —
--      consistent with the boss's «closer to reality» guidance. The six
--      01–06 Oct shifts already recorded at 500 ₽/h are NOT touched.
--      If Paul/boss prefers those six normalized to 100 ₽/h as well, run
--      the OPTIONAL block at the bottom (commented out) — it would change
--      them from 6 000 → 1 200 ₽ each (36 000 → 7 200 for the six).
--
-- AUDIT
--   crews.metadata.specs.owner_fix_20261016_salary_defaults = {
--     applied_by: "Paul", date: ..., scope: "hourly_default_100 + dj shifts backfill",
--     backfilled_shifts: 18, rate: 100, member: "7813830016", crew: "2d5fde70"
--   }
--
-- IDEMPOTENT: safe to re-run (default/COALESCE are idempotent; the INSERT
-- has an EXISTS guard per shift day; the audit PATCH is a jsonb merge).
--
-- NOTE BEFORE RUNNING: \sf+ public.sync_hourly_rate_on_shift_start() — if the
-- live function carries special attributes (SECURITY DEFINER etc.), re-add
-- them after the CREATE OR REPLACE below (OR REPLACE resets attributes).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1a. Column default: 100 ₽/h ────────────────────────────────────────────
ALTER TABLE public.crew_member_shifts
  ALTER COLUMN hourly_rate SET DEFAULT 100;

-- ── 1b. Trigger function fallback: 100 ₽/h (same body, new fallback) ──────
CREATE OR REPLACE FUNCTION public.sync_hourly_rate_on_shift_start()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  member_rate NUMERIC;
BEGIN
  -- hourly_rate from users.metadata; fallback 100 ₽/h (task98: was 500)
  SELECT COALESCE((metadata->>'hourly_rate')::NUMERIC, 100)
  INTO member_rate
  FROM public.users
  WHERE user_id = NEW.member_id;

  UPDATE public.crew_member_shifts
  SET hourly_rate = member_rate
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ── 2. Backfill djorudjov's missing October shifts (rate 100) ──────────────
-- Same shape as the existing rows: 07:00→19:00 UTC, 720 min, shift_type
-- 'online'. The BEFORE trigger recomputes salary_amount = 720/60 × 100.
DO $$
DECLARE
  d date;
  crew uuid := '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';
  member text := '7813830016';
BEGIN
  -- 07–14 Oct
  FOR d IN SELECT generate_series('2026-10-07'::date, '2026-10-14'::date, '1 day') LOOP
    INSERT INTO public.crew_member_shifts
      (member_id, crew_id, clock_in_time, clock_out_time, duration_minutes, shift_type, hourly_rate, salary_amount, notes)
    SELECT member, crew,
           (d::text || ' 07:00:00+00:00')::timestamptz,
           (d::text || ' 19:00:00+00:00')::timestamptz,
           720, 'online', 100, 1200,
           'восстановлено автоматически (task98 2026-10-16): смена не была отмечена в боте'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.crew_member_shifts s
      WHERE s.member_id = member AND s.crew_id = crew
        AND s.clock_in_time >= (d::text || ' 00:00:00+00:00')::timestamptz
        AND s.clock_in_time <  ((d + 1)::text || ' 00:00:00+00:00')::timestamptz
    );
  END LOOP;

  -- 16–25 Oct (15th = day off, сознательно пропущен)
  FOR d IN SELECT generate_series('2026-10-16'::date, '2026-10-25'::date, '1 day') LOOP
    INSERT INTO public.crew_member_shifts
      (member_id, crew_id, clock_in_time, clock_out_time, duration_minutes, shift_type, hourly_rate, salary_amount, notes)
    SELECT member, crew,
           (d::text || ' 07:00:00+00:00')::timestamptz,
           (d::text || ' 19:00:00+00:00')::timestamptz,
           720, 'online', 100, 1200,
           'восстановлено автоматически (task98 2026-10-16): смена не была отмечена в боте'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.crew_member_shifts s
      WHERE s.member_id = member AND s.crew_id = crew
        AND s.clock_in_time >= (d::text || ' 00:00:00+00:00')::timestamptz
        AND s.clock_in_time <  ((d + 1)::text || ' 00:00:00+00:00')::timestamptz
    );
  END LOOP;
END $$;

-- ── 3. Audit block (PATCH crews.metadata.specs — merge, no clobber) ────────
UPDATE public.crews
SET metadata = jsonb_set(
  metadata,
  '{specs,owner_fix_20261016_salary_defaults}',
  jsonb_build_object(
    'applied_by', 'Paul',
    'applied_at', to_char(now() AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD HH24:MI:SS MSK'),
    'scope', 'hourly_default_100 + djorudjov october shifts backfill',
    'backfilled_shifts', (SELECT count(*) FROM public.crew_member_shifts
        WHERE member_id = '7813830016' AND crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
          AND notes LIKE 'восстановлено автоматически (task98%'),
    'rate_rub_hour', 100,
    'member', '7813830016 (djorudjov)',
    'crew', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746 (vip-bike)'
  ),
  true
)
WHERE id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

-- ── OPTIONAL: normalize the six 01–06 Oct shifts 500 → 100 ₽/h ────────────
-- Uncomment ONLY if Paul/boss wants the whole of October at the new rate.
-- Effect: 6 shifts 6 000 → 1 200 ₽ each (36 000 → 7 200).
--
-- UPDATE public.crew_member_shifts
-- SET hourly_rate = 100, salary_amount = 1200
-- WHERE member_id = '7813830016'
--   AND crew_id   = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
--   AND clock_in_time >= '2026-10-01 00:00:00+00:00'::timestamptz
--   AND clock_in_time <  '2026-10-07 00:00:00+00:00'::timestamptz
--   AND hourly_rate = 500;

-- ── VERIFY (run after) ──────────────────────────────────────────────────────
-- SELECT clock_in_time::date AS day, duration_minutes, hourly_rate, salary_amount, notes
-- FROM public.crew_member_shifts
-- WHERE member_id = '7813830016' AND clock_in_time >= '2026-10-01' AND clock_in_time < '2026-10-26'
-- ORDER BY clock_in_time;
-- Expect: every day 01–25 except the 15th; 01–06 at 500, 07+/16+ at 100 (unless OPTIONAL ran).
