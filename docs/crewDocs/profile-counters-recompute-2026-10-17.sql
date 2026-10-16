-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILE COUNTERS RECOMPUTE — «731 смены за 3 месяца» fix (task101, 2026-10-17)
-- ═══════════════════════════════════════════════════════════════════════════
-- RUNNER: Paul (manual, as always). Idempotent — safe to re-run.
--
-- ROOT CAUSE (code bug, FIXED in the same task and already pushed):
--   webhook shift.ts grantShiftAchievements() passed shift TOTALS
--   (shiftsCompleted = ALL completed shifts, totalHoursWorked = ALL hours)
--   as incrementCounters — i.e. as DELTAS — once per ELIGIBLE ACHIEVEMENT on
--   every clock-out (8-10 badges per closure). The profile counter therefore
--   grew like Σ(total × badges) instead of total:
--     salavey13:  stored 731 shifts / 8512 h   ← truth 31 shifts / 290 h
--     5219192922: stored  93 shifts / 1641.8 h ← truth 26 shifts / 246 h
--   (audit scripts/task101-counters-audit.mjs, read-only, 2026-10-17)
--
-- THIS FILE: recomputes franchizeProfiles.<slug>.counters.shiftsCompleted /
--   .totalHoursWorked from the source of truth (crew_member_shifts per crew
--   slug), ONLY where the stored value differs (IS DISTINCT FROM → idempotent).
--   Other counters (rentalsClosed, profileOpenCount, idealClosures, ...) are
--   NOT touched — jsonb_set merges only these two keys.
--
-- SELF-HEAL NOTE: the fixed code SETs these counters from truth on every
--   clock-out, so even WITHOUT this file the numbers converge after each
--   member's next shift. This file just fixes TODAY, without waiting.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PREVIEW: stored vs truth (run first, eyeball the diff) ──────────────────
WITH truth AS (
  SELECT c.slug AS slug,
         s.member_id::text AS member_id,
         COUNT(*)::int AS shifts,
         ROUND(COALESCE(SUM(s.duration_minutes), 0) / 60.0, 2) AS hours
  FROM crew_member_shifts s
  JOIN crews c ON c.id = s.crew_id
  WHERE s.clock_out_time IS NOT NULL
  GROUP BY c.slug, s.member_id
)
SELECT u.username,
       t.slug,
       u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'shiftsCompleted']    AS stored_shifts,
       t.shifts                                                                             AS true_shifts,
       u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'totalHoursWorked']    AS stored_hours,
       t.hours                                                                              AS true_hours
FROM truth t
JOIN users u ON u.user_id::text = t.member_id
WHERE (u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'shiftsCompleted']) IS DISTINCT FROM t.shifts::text
   OR (u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'totalHoursWorked']) IS DISTINCT FROM t.hours::text;

-- ── FIX: recompute both counters from truth (only where they differ) ────────
WITH truth AS (
  SELECT c.slug AS slug,
         s.member_id::text AS member_id,
         COUNT(*)::int AS shifts,
         ROUND(COALESCE(SUM(s.duration_minutes), 0) / 60.0, 2) AS hours
  FROM crew_member_shifts s
  JOIN crews c ON c.id = s.crew_id
  WHERE s.clock_out_time IS NOT NULL
  GROUP BY c.slug, s.member_id
),
targets AS (
  SELECT u.user_id, u.metadata, t.slug, t.shifts, t.hours
  FROM truth t
  JOIN users u ON u.user_id::text = t.member_id
  WHERE u.metadata ? ARRAY['franchizeProfiles']::text[]
    AND u.metadata #> '{"franchizeProfiles"}' ? t.slug
    AND (
      (u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'shiftsCompleted'])  IS DISTINCT FROM t.shifts::text
      OR (u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'totalHoursWorked']) IS DISTINCT FROM t.hours::text
    )
),
patched AS (
  SELECT user_id,
         jsonb_set(
           jsonb_set(
             metadata,
             ARRAY['franchizeProfiles', slug, 'counters', 'shiftsCompleted'],
             shifts::text::jsonb,
             true
           ),
           ARRAY['franchizeProfiles', slug, 'counters', 'totalHoursWorked'],
           hours::text::jsonb,
           true
         ) AS new_metadata,
         slug, shifts, hours
  FROM targets
)
UPDATE users u
SET metadata = jsonb_set(
      p.new_metadata,
      ARRAY['specs', 'owner_fix_20261017_counters_recompute'],
      jsonb_build_object(
        'applied_at',  to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'applied_by',  'Paul (manual SQL, task101)',
        'per_profile', (SELECT jsonb_object_agg(slug, jsonb_build_object('shiftsCompleted', shifts, 'totalHoursWorked', hours)) FROM patched q WHERE q.user_id = p.user_id),
        'note',        'shiftsCompleted/totalHoursWorked recomputed from crew_member_shifts (clock_out not null); task101 root cause = shift.ts incrementCounters-per-achievement (fixed in code)'
      ),
      true
    ),
    updated_at = now()
FROM patched p
WHERE u.user_id = p.user_id;

-- ── AUDIT CHECK (should show stored == truth for everyone) ──────────────────
WITH truth AS (
  SELECT c.slug AS slug, s.member_id::text AS member_id,
         COUNT(*)::int AS shifts,
         ROUND(COALESCE(SUM(s.duration_minutes), 0) / 60.0, 2) AS hours
  FROM crew_member_shifts s
  JOIN crews c ON c.id = s.crew_id
  WHERE s.clock_out_time IS NOT NULL
  GROUP BY c.slug, s.member_id
)
SELECT u.username, t.slug,
       u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'shiftsCompleted'] AS stored_shifts,
       t.shifts AS true_shifts,
       u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'totalHoursWorked'] AS stored_hours,
       t.hours AS true_hours,
       (u.metadata #> 'specs' -> 'owner_fix_20261017_counters_recompute') IS NOT NULL AS audited
FROM truth t
JOIN users u ON u.user_id::text = t.member_id
WHERE u.metadata ? ARRAY['franchizeProfiles']::text[]
  AND u.metadata #> '{"franchizeProfiles"}' ? t.slug
ORDER BY u.username, t.slug;
