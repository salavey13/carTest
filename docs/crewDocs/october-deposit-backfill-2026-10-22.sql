-- =====================================================================
-- Task 124 — October sus-разбор: legacy /doc rentals without deposit in books
-- Generated: 2026-10-22
-- Run manually (Paul) in Supabase SQL editor. Schema: public + private.
--
-- FINDING (full October recount, bike-only 154):
--   sus = 32, of which 28 = «договор на бумаге X против книг Y».
--   18 of those 28: rentals.deposit_amount = 0, but the printed contract
--   (private.rental_contract_artifacts.deposit_rub) carries 10 000–20 000 ₽.
--   ALL 18 were created before 2026-09-15 — i.e. before the iter21 fix that
--   started mirroring the /doc deposit into the books (doc-manual.ts).
--   Rows created after the fix all carry the deposit (10/10). Zero exceptions.
--
-- FIX: mirror the artifact deposit into the books for closed /doc rentals
-- that predate the mirror (guard: deposit_amount IS NULL/0, artifact exists,
-- no СТС-pledge, no deposit_entry already recorded).
-- After running, the сверка grader (C4/C6) sees the honest deposit and the
-- October audit re-flows: sus → almost/fine on recompute.
--
-- Двухшагово: сначала SELECT (dry-run) — сверить список, потом UPDATE.
--
-- TYPE SAFETY (fixed 2026-10-22, err 42804): deposits live as TEXT in
-- private.rental_contract_artifacts.deposit_rub — the contract builder prints
-- human strings ("20 000", "20 000 ₽", legacy "не указан"), see
-- deposit-rail.ts / actions-runtime.ts which parse it with [^\d] strip.
-- So every numeric comparison/assignment goes through money_to_num():
-- digits-only strip (same parser as the app: deposit-rail.ts / actions-runtime.ts
-- use replace(/[^\d]/g, "")) → '' → NULL → 0, so it can never throw on
-- "не указан" / "20 000 ₽". public.rentals.deposit_amount is numeric
-- (migration 20260726000001) — no cast needed there.
-- =====================================================================

CREATE OR REPLACE FUNCTION private.money_to_num(t text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(regexp_replace(t, '[^0-9]', '', 'g'), '')::numeric, 0);
$$;
-- (drop after the backfill: DROP FUNCTION private.money_to_num(text);)

-- ── 1. DRY RUN — what would change ──────────────────────────────────────
WITH candidates AS (
  SELECT
    r.rental_id,
    r.created_at,
    r.total_cost,
    a.deposit_rub AS paper_deposit,
    a.sts_pledge_used,
    a.total_sum AS paper_total
  FROM public.rentals r
  JOIN private.rental_contract_artifacts a ON a.rental_id = r.rental_id
  WHERE r.metadata->>'source' = 'doc_command'
    AND r.created_at < '2026-09-15T00:00:00+03:00'   -- pre-iter21 mirror
    AND COALESCE(r.deposit_amount, 0) = 0            -- books lost the deposit
    AND private.money_to_num(a.deposit_rub) > 0      -- paper HAS a deposit (TEXT col → num)
    AND COALESCE(a.sts_pledge_used, false) = false   -- СТС-pledge = no cash deposit by design
    AND r.status IN ('completed', 'confirmed')
    AND NOT EXISTS (                                 -- don't touch if deposit entries exist
      SELECT 1 FROM public.deposit_entries de WHERE de.rental_id = r.rental_id
    )
)
SELECT rental_id, created_at::date AS created, total_cost,
       paper_deposit,                                        -- raw paper string, e.g. "20 000 ₽"
       private.money_to_num(paper_deposit) AS paper_deposit_num,
       paper_total
FROM candidates
ORDER BY created;

-- Expected ~18 rows (October sus-разбор) + any older months with the same gap.

-- ── 2. APPLY — mirror deposit into books (idempotent) ───────────────────
WITH candidates AS (
  SELECT
    r.rental_id,
    private.money_to_num(a.deposit_rub) AS paper_deposit_num
  FROM public.rentals r
  JOIN private.rental_contract_artifacts a ON a.rental_id = r.rental_id
  WHERE r.metadata->>'source' = 'doc_command'
    AND r.created_at < '2026-09-15T00:00:00+03:00'
    AND COALESCE(r.deposit_amount, 0) = 0
    AND private.money_to_num(a.deposit_rub) > 0
    AND COALESCE(a.sts_pledge_used, false) = false
    AND r.status IN ('completed', 'confirmed')
    AND NOT EXISTS (
      SELECT 1 FROM public.deposit_entries de WHERE de.rental_id = r.rental_id
    )
)
UPDATE public.rentals r
SET deposit_amount = c.paper_deposit_num,     -- numeric → numeric, no 42804
    deposit_method = 'cash',              -- legacy /doc flow collected cash (default, matches insertDepositEntries)
    deposit_collected_at = r.created_at,  -- honest approximation: collection moment = doc creation
    updated_at = now()
FROM candidates c
WHERE r.rental_id = c.rental_id
  AND COALESCE(r.deposit_amount, 0) = 0;  -- re-guard inside UPDATE (idempotent, race-safe)

-- ── 3. VERIFY ────────────────────────────────────────────────────────────
-- Re-run the dry-run SELECT: it must return 0 rows.
-- Then the October recount (scripts/task124-recount.mjs) shows the sus
-- family shrink: 28 → ~10 «договор на бумаге…», of which ~11 flip to
-- almost by the new C4 tolerance (max(500 ₽, 5%)) — code deployed 2026-10-22.
-- NOTE: deposit_returned stays NULL on purpose — C6 will flag
-- «залог не помечен возвращённым» so the operator ticks it consciously.
--
-- CLEANUP (optional, after happy verify):
--   DROP FUNCTION IF EXISTS private.money_to_num(text);
-- =====================================================================
