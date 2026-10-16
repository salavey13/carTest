-- ═══════════════════════════════════════════════════════════════════════════
-- salary-october-shifts-normalize-100-2026-10-17.sql
-- Task 100 (boss 2026-10-17) — FOR PAUL TO RUN (SQL only Paul runs).
--
-- CONTEXT
--   Task 98 set the NEW default to 100 ₽/h and backfilled djorudjov's
--   missing October shifts at 100 (Paul applied both files 2026-10-16 —
--   verified: 18 backfilled shifts present, sweep owner_fix_20261016_operator_
--   sweep applied). But the 14 October shifts logged BEFORE the change keep
--   their stored rate 500 ₽/h, so the boss still sees «Смена (12ч) 6 000 ₽»:
--   «shifts are counted as 500/h still for some reason btw».
--
-- WHAT THIS DOES
--   Normalizes EVERY completed October-2026 shift of crew vip-bike that still
--   carries the legacy 500 ₽/h to the new 100 ₽/h policy, recomputing
--   salary_amount explicitly.
--
--   ⚠ WHY salary_amount IS SET EXPLICITLY: trg_calc_shift_salary fires on
--   `BEFORE INSERT OR UPDATE OF clock_out_time` ONLY (migration
--   20260726000001) — a plain `SET hourly_rate` would NOT recompute it, and
--   duration_minutes is GENERATED ALWAYS (428C9 lesson, task 99) so it is
--   only READ here (duration_minutes / 60.0 × 100), never written.
--
-- MEASURED IMPACT (live data 2026-10-17, vip-bike, October, rate=500):
--   djorudjov  (7813830016): 6 shifts × 12h   36 000.00 →  7 200.00 ₽ (−28 800)
--   salavey13  (413553377):  6 shifts, 67.87h 33 933.33 →  6 787.42 ₽
--   Гундермурд (52191929…):  2 shifts, 19.51h  9 758.33 →  1 951.67 ₽
--   The leaderboard/bonuses recompute automatically from the new numbers.
--   Boss consciously sets the 100 ₽/h policy («10h shift = 1k rub») — run
--   only after he confirms the cut for October is intended.
--
-- AUDIT
--   crews.metadata.specs.owner_fix_20261017_salary_normalize_100 (jsonb merge)
--
-- IDEMPOTENT: safe to re-run — rows already at 100 don't match the guard.
-- SCOPE: vip-bike crew only; drop the crew_id filter to widen to all crews.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Preview (no writes) — run first, eyeball the per-row effect ─────────
SELECT s.id, s.member_id, s.clock_in_time::date AS day,
       s.duration_minutes, s.hourly_rate, s.salary_amount,
       ROUND((s.duration_minutes / 60.0) * 100, 2) AS new_salary
FROM public.crew_member_shifts s
WHERE s.crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
  AND s.clock_in_time >= '2026-10-01 00:00:00+00:00'::timestamptz
  AND s.clock_in_time <  '2026-11-01 00:00:00+00:00'::timestamptz
  AND s.clock_out_time IS NOT NULL
  AND s.hourly_rate = 500
ORDER BY s.clock_in_time;

-- ── 2. Normalize 500 → 100 ₽/h (salary recomputed from generated duration) ─
DO $$
DECLARE
  affected integer;
  leftover integer;
BEGIN
  UPDATE public.crew_member_shifts
  SET hourly_rate   = 100,
      salary_amount = ROUND((duration_minutes / 60.0) * 100, 2),
      notes = COALESCE(notes, '') || ' · нормализовано до 100 ₽/ч (task100 2026-10-17)'
  WHERE crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
    AND clock_in_time >= '2026-10-01 00:00:00+00:00'::timestamptz
    AND clock_in_time <  '2026-11-01 00:00:00+00:00'::timestamptz
    AND clock_out_time IS NOT NULL
    AND hourly_rate = 500;          -- same guard makes re-runs a no-op

  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'normalized % october shift(s) 500 → 100 ₽/h', affected;

  -- Awareness probe: any October row still NOT at 100 (deliberate rates stay)
  SELECT count(*) INTO leftover
  FROM public.crew_member_shifts
  WHERE crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
    AND clock_in_time >= '2026-10-01 00:00:00+00:00'::timestamptz
    AND clock_in_time <  '2026-11-01 00:00:00+00:00'::timestamptz
    AND hourly_rate IS DISTINCT FROM 100;
  RAISE NOTICE 'october rows still not at 100 ₽/h: % (review manually if > 0)', leftover;
END $$;

-- ── 3. Audit block (PATCH crews.metadata.specs — merge, no clobber) ────────
UPDATE public.crews
SET metadata = jsonb_set(
  metadata,
  '{specs,owner_fix_20261017_salary_normalize_100}',
  jsonb_build_object(
    'applied_by', 'Paul',
    'applied_at', to_char(now() AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD HH24:MI:SS MSK'),
    'scope', 'october 2026 shifts normalize 500 → 100 ₽/h (vip-bike)',
    'normalized_shifts', (SELECT count(*) FROM public.crew_member_shifts
        WHERE crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
          AND clock_in_time >= '2026-10-01 00:00:00+00:00'::timestamptz
          AND clock_in_time <  '2026-11-01 00:00:00+00:00'::timestamptz
          AND hourly_rate = 100
          AND notes LIKE '%task100 2026-10-17%'),
    'rate_rub_hour', 100,
    'crew', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746 (vip-bike)'
  ),
  true
)
WHERE id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

-- ── VERIFY (run after) ──────────────────────────────────────────────────────
-- SELECT member_id, count(*) AS shifts, sum(duration_minutes) AS minutes,
--        sum(salary_amount) AS pay
-- FROM public.crew_member_shifts
-- WHERE crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
--   AND clock_in_time >= '2026-10-01' AND clock_in_time < '2026-11-01'
-- GROUP BY member_id ORDER BY pay DESC;
-- Expect: no October row at 500; pay ≈ hours × 100
-- (djorudjov 288h → 28 800, salavey13 67.9h → ~6 787, Гундермурд 19.5h → ~1 952).
