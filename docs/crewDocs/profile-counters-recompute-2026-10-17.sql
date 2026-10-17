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
--
-- CHANGELOG (SQL-side fixes after Paul's manual runs):
--   r1: 42883 «operator does not exist: jsonb ? text[]» — jsonb «?» accepts a
--       SINGLE text key only; no text[] overload exists. Fixed by
--       «? 'franchizeProfiles'».
--   r2: 22P02 «malformed array literal: "specs"» — jsonb «#>» requires a
--       text[] path (ARRAY['a','b'] or '{"a"}'); a bare 'specs' string gets
--       parsed as an array literal and fails. Audit line switched to a plain
--       «-> 'specs' -> 'key'» chain.
--       Same pass: (a) UPDATE hardened — patches are aggregated PER USER, so a
--       member of 2+ crews gets ALL their profiles patched (UPDATE...FROM
--       would otherwise match several rows and keep only the last); (b) counters
--       are written as jsonb NUMBERS (to_jsonb) matching the app's stored
--       shape; (c) the audit stamp merges into «specs» EXPLICITLY — jsonb_set
--       does NOT auto-create intermediate path levels (create_missing covers
--       only the LAST key), so jsonb_set(meta, ARRAY['specs','key'], ...) is a
--       silent no-op when metadata has no «specs» object yet (caught by the
--       PG18 e2e harness run before this file was handed back to Paul).
--   NB: Supabase SQL Editor runs the whole file as ONE transaction — any
--   error rolls back everything, so a failed run leaves NO partial changes.
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
-- NB: jsonb «?» accepts a single text key (no text[] overload → 42883);
--     «#>» needs a text[] path — bare 'text' → 22P02 malformed array literal.
-- NB: «patched» aggregates PER USER: a member of 2+ crews gets ALL their
--     profiles patched in one pass (a naive UPDATE...FROM over per-slug rows
--     matches several rows for one user and silently keeps only the last).
-- NB: counters are written as jsonb NUMBERS (to_jsonb) — same shape the app
--     stores on clock-out; other counters and profile keys survive untouched
--     (shallow «||» merge on the counters object, jsonb_set elsewhere).
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
  WHERE u.metadata ? 'franchizeProfiles'
    AND u.metadata #> '{"franchizeProfiles"}' ? t.slug
    AND (
      (u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'shiftsCompleted'])  IS DISTINCT FROM t.shifts::text
      OR (u.metadata #>> ARRAY['franchizeProfiles', t.slug, 'counters', 'totalHoursWorked']) IS DISTINCT FROM t.hours::text
    )
),
patched AS (
  SELECT t.user_id,
         t.metadata,
         jsonb_object_agg(
           t.slug,
           jsonb_set(
             COALESCE(t.metadata #> ARRAY['franchizeProfiles', t.slug], '{}'::jsonb),
             ARRAY['counters'],
             COALESCE(t.metadata #> ARRAY['franchizeProfiles', t.slug, 'counters'], '{}'::jsonb)
               || jsonb_build_object('shiftsCompleted', to_jsonb(t.shifts),
                                     'totalHoursWorked', to_jsonb(t.hours)),
             true
           )
         ) AS profile_patches,
         jsonb_object_agg(
           t.slug,
           jsonb_build_object('shiftsCompleted', t.shifts, 'totalHoursWorked', t.hours)
         ) AS per_profile
  FROM targets t
  GROUP BY t.user_id, t.metadata
)
UPDATE users u
SET metadata = jsonb_set(
      jsonb_set(
        p.metadata,
        ARRAY['franchizeProfiles'],
        COALESCE(p.metadata #> ARRAY['franchizeProfiles'], '{}'::jsonb) || p.profile_patches,
        true
      ),
      ARRAY['specs'],
      -- NB: jsonb_set does NOT auto-create INTERMEDIATE path levels (create_missing
--     covers only the LAST key) — a 2-level path silently no-ops when the root
--      key is absent. So the stamp merges into «specs» explicitly: users without
--      a specs object get one created, existing specs keys survive untouched.
      COALESCE(p.metadata #> ARRAY['specs'], '{}'::jsonb)
        || jsonb_build_object(
             'owner_fix_20261017_counters_recompute',
             jsonb_build_object(
               'applied_at',  to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'applied_by',  'Paul (manual SQL, task101)',
               'per_profile', p.per_profile,
               'note',        'shiftsCompleted/totalHoursWorked recomputed from crew_member_shifts (clock_out not null); task101 root cause = shift.ts incrementCounters-per-achievement (fixed in code)'
             )
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
       -- NB: «#>» needs a text[] path — bare 'specs' → 22P02; plain «->» chain is enough here.
       (u.metadata -> 'specs' -> 'owner_fix_20261017_counters_recompute') IS NOT NULL AS audited,
       u.metadata #>> ARRAY['specs', 'owner_fix_20261017_counters_recompute', 'applied_at'] AS stamped_at
FROM truth t
JOIN users u ON u.user_id::text = t.member_id
WHERE u.metadata ? 'franchizeProfiles'
  AND u.metadata #> '{"franchizeProfiles"}' ? t.slug
ORDER BY u.username, t.slug;
