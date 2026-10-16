-- ═══════════════════════════════════════════════════════════════════════════
-- fix-djorudjov-identity-mockupsert-2026-10-17.sql
-- Task 100 (incident follow-up) — FOR PAUL TO RUN (SQL only Paul runs).
--
-- INCIDENT
--   users row 7813830016 (djorudjov, vip-bike admin — the rent-commission
--   operator) was re-labelled «Mock User / @mockuser» by a mock-mode UI
--   session: local `next dev` with NEXT_PUBLIC_USE_MOCK_USER=true +
--   NEXT_PUBLIC_MOCK_USER_ID=7813830016 (the mock-user testing setup from
--   task 99). The Telegram-auth chain (useTelegramAuth.handleAuthentication →
--   upsertTelegramUserAction → createOrUpdateUser) saw the DB row differ
--   from the mock payload and synced «Mock User» INTO THE SHARED PRODUCTION
--   users TABLE. Side effects until healed: team leaderboard «Сотрудник»,
--   CSV «Оператор (ЗП)» labels, commissionItem role labels.
--
--   Self-heal exists (djorudjov's next real Telegram interaction re-syncs
--   his real profile), but this SQL fixes it immediately and deterministically.
--
--   CODE GUARD (shipped in the same task): createOrUpdateUser now REFUSES
--   mock-identity writes when NEXT_PUBLIC_USE_MOCK_USER=true — the incident
--   cannot recur; mock audits are read-only against users.
--
-- RESTORE VALUES: username 'djorudjov', full_name 'Dmitry User' — exactly
--   what the row carried before the incident (verified in task 98/99
--   diagnostics and in the boss's 2026-10-17 morning screenshot).
--
-- AUDIT: users.metadata.owner_fix_20261017_identity_restore (jsonb merge —
--   only that key is touched, riderProfiles and the rest stay intact).
--
-- IDEMPOTENT: re-runs are no-ops (IS DISTINCT FROM guards).
-- ═══════════════════════════════════════════════════════════════════════════

-- 0. Preview
SELECT user_id, username, full_name, avatar_url, language_code, updated_at
FROM public.users
WHERE user_id = '7813830016';

-- 1. Restore the real identity (audit block merged into metadata)
UPDATE public.users
SET username   = 'djorudjov',
    full_name  = 'Dmitry User',
    metadata   = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{owner_fix_20261017_identity_restore}',
      jsonb_build_object(
        'applied_by', 'Paul',
        'applied_at', to_char(now() AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD HH24:MI:SS MSK'),
        'cause', 'mock-mode UI session upserted NEXT_PUBLIC_MOCK_USER identity (task99 testing setup) into shared users table',
        'clobbered_values', jsonb_build_object('username', 'mockuser', 'full_name', 'Mock User'),
        'restored_values',  jsonb_build_object('username', 'djorudjov', 'full_name', 'Dmitry User'),
        'code_guard', 'createOrUpdateUser refuses mock-identity upserts when NEXT_PUBLIC_USE_MOCK_USER=true (task100)'
      ),
      true
    ),
    updated_at = now()
WHERE user_id = '7813830016'
  AND (username IS DISTINCT FROM 'djorudjov' OR full_name IS DISTINCT FROM 'Dmitry User');

-- 2. Sanity sweeps for OTHER possible mock clobbers (report only, no writes):
--    any row still carrying the mock labels?
SELECT user_id, username, full_name
FROM public.users
WHERE username = 'mockuser' OR full_name = 'Mock User';
-- Expect: 0 rows after step 1 (the mock id is 7813830016 — the only writer target).

--    junk app_open leads planted by mock audits (delete is OPTIONAL, Paul's call):
SELECT id, slug, user_id, full_name, username, created_at
FROM public.franchize_leads
WHERE user_id = '7813830016' AND full_name = 'Mock User'
ORDER BY created_at DESC
LIMIT 20;
