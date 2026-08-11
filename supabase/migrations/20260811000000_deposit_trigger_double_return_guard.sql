-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260811000000_deposit_trigger_double_return_guard.sql
-- Purpose:   I1 hotfix — add NOT EXISTS guard to auto_return_deposit_entries()
-- Bug:       DEPOSIT_TRACKING_PRD §3.2a — completed-path trigger lacks double-return guard
-- Meta:      docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md Iteration I1
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHAT'S BROKEN
-- ─────────────
-- `auto_return_deposit_entries()` (fires when rental status → 'completed')
-- inserts a `deposit_returned` row for every `deposit_collected` row —
-- UNCONDITIONALLY. The code comment even says "Let's add a guard to prevent
-- double-returns" — but no guard follows.
--
-- The cancel-path function `auto_return_deposit_on_cancel()` DOES have the
-- `AND NOT EXISTS (...)` guard. This migration mirrors that pattern to the
-- completed path.
--
-- CONSEQUENCE OF THE BUG
-- ───────────────────────
-- If a rental is re-completed (status flipped active → completed twice),
-- duplicate `deposit_returned` rows are created — one per re-completion.
-- This corrupts deposit balance math: `getDepositSummary()` would report
-- `returned = 2 × actual`, making it look like the operator over-refunded.
--
-- PROD STATE (verified 2026-08-11)
-- ────────────────────────────────
-- 0 duplicate rows exist today (7 deposit_returned rows, all unique).
-- Bug is latent — hasn't fired because no rental has been re-completed twice
-- since the trigger shipped on 2026-08-10. But it WILL fire the moment any
-- operator re-opens and re-closes a rental.
--
-- THE FIX
-- ───────
-- Add `AND NOT EXISTS (...)` to the INSERT's SELECT, matching on
-- (rental_id, destination, amount). A genuinely different re-collection
-- (different amount) still inserts a new row — only exact duplicates are
-- blocked. Same pattern the cancel path already uses.
--
-- IDEMPOTENCY
-- ───────────
-- ✅ `CREATE OR REPLACE FUNCTION` — safe to re-run
-- ✅ `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` — safe to re-run
-- ✅ `DELETE ... WHERE rn > 1` — safe to re-run (no-op after first run)
-- ✅ `COMMENT ON FUNCTION` — safe to re-run
--
-- ROLLBACK PLAN (if the guard incorrectly blocks a legit return)
-- ──────────────────────────────────────────────────────────────
-- If an operator reports a deposit was returned but `getDepositSummary()`
-- shows 0 returned, the guard may have blocked a legitimate INSERT.
-- Manual fix:
--   INSERT INTO public.deposit_entries
--     (rental_id, entry_type, amount, direction, destination, operator_chat_id, notes)
--   VALUES
--     ('<rental_id>', 'deposit_returned', <amount>, 'out', '<destination>', <operator_chat_id>,
--      'Manual override — I1 guard false-positive (20260811000000)');
-- Then investigate WHY the guard matched — likely a stale `deposit_collected`
-- row with the same (destination, amount) as the intended return.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Recreate the function WITH the double-return guard ─────────────────
CREATE OR REPLACE FUNCTION public.auto_return_deposit_entries()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  -- Only fire on transition TO 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- For each deposit_collected entry, create a matching deposit_returned entry
    -- UNLESS one already exists (idempotency guard added 2026-08-11, I1 hotfix).
    --
    -- The guard matches on (rental_id, destination, amount) — same triple the
    -- cancel path uses. A genuinely different re-collection (e.g. operator
    -- collects a different amount the second time) will have a different amount
    -- and correctly inserts a new row. Only exact duplicates are blocked.
    INSERT INTO public.deposit_entries (
      rental_id, entry_type, amount, direction, destination, operator_chat_id, notes
    )
    SELECT
      NEW.rental_id,
      'deposit_returned',
      de.amount,
      'out',
      de.destination,
      NULL, -- system-generated, no human operator
      'Auto-returned on rental completion'
    FROM public.deposit_entries de
    WHERE de.rental_id = NEW.rental_id
      AND de.entry_type = 'deposit_collected'
      AND NOT EXISTS (
        SELECT 1
        FROM public.deposit_entries ret
        WHERE ret.rental_id = de.rental_id
          AND ret.entry_type = 'deposit_returned'
          AND ret.destination = de.destination
          AND ret.amount = de.amount
      );
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 2. Rebind the trigger (safe — DROP IF EXISTS + CREATE) ────────────────
-- CREATE OR REPLACE FUNCTION updates the body in place, but we rebind the
-- trigger anyway for safety — guarantees the trigger exists and points to
-- the updated function even on databases where the original migration
-- (20260810000011) was never applied.
DROP TRIGGER IF EXISTS trg_auto_return_deposit_entries ON public.rentals;

CREATE TRIGGER trg_auto_return_deposit_entries
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_return_deposit_entries();

GRANT EXECUTE ON FUNCTION public.auto_return_deposit_entries() TO service_role;

COMMENT ON FUNCTION public.auto_return_deposit_entries() IS
  'Idempotent since 2026-08-11 (I1): skips INSERT if a matching deposit_returned row already exists for (rental_id, destination, amount). See supabase/migrations/20260810000011 for original non-idempotent version.';

-- ─── 3. One-time prod dedup check ──────────────────────────────────────────
-- As of 2026-08-11, production has 0 duplicate rows (verified via direct query).
-- This block cleans up any duplicates that may have been created between
-- 2026-08-10 (when the trigger shipped) and now.
--
-- Strategy: per (rental_id, destination, amount) partition, keep the EARLIEST
-- row (smallest created_at) and delete all later duplicates.
--
-- Safe to run multiple times — after the first run, there are no duplicates
-- left to delete (the DELETE becomes a no-op).
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.deposit_entries
  WHERE id IN (
    SELECT id
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY rental_id, destination, amount
          ORDER BY created_at ASC
        ) AS rn
      FROM public.deposit_entries
      WHERE entry_type = 'deposit_returned'
    ) d
    WHERE rn > 1
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'I1 dedup: deleted % duplicate deposit_returned rows', deleted_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION (run manually in Supabase SQL editor)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. Verify the function body now contains the NOT EXISTS guard:
--
--    SELECT prosrc FROM pg_proc WHERE proname = 'auto_return_deposit_entries';
--    -- Should show "AND NOT EXISTS" in the function source
--
-- 2. Verify no duplicate deposit_returned rows exist:
--
--    SELECT rental_id, destination, amount, count(*) as cnt
--    FROM public.deposit_entries
--    WHERE entry_type = 'deposit_returned'
--    GROUP BY rental_id, destination, amount
--    HAVING count(*) > 1;
--    -- Should return 0 rows
--
-- 3. REGRESSION TEST (run against a TEST rental, not a real one):
--
--    a. Pick a test rental that has a deposit_collected row:
--       SELECT rental_id FROM deposit_entries
--       WHERE entry_type = 'deposit_collected' LIMIT 1;
--
--    b. Flip it to completed (first time — trigger should INSERT 1 return):
--       UPDATE rentals SET status = 'completed'
--       WHERE rental_id = '<test_rental_id>';
--       SELECT count(*) FROM deposit_entries
--       WHERE rental_id = '<test_rental_id>' AND entry_type = 'deposit_returned';
--       -- Expect: 1 (per collected row)
--
--    c. Flip it back to active:
--       UPDATE rentals SET status = 'active'
--       WHERE rental_id = '<test_rental_id>';
--
--    d. Flip it to completed AGAIN (second time — guard should BLOCK the INSERT):
--       UPDATE rentals SET status = 'completed'
--       WHERE rental_id = '<test_rental_id>';
--       SELECT count(*) FROM deposit_entries
--       WHERE rental_id = '<test_rental_id>' AND entry_type = 'deposit_returned';
--       -- Expect: STILL 1 (not 2) — guard works!
--
--    e. Clean up: restore the original status or mark the rental as completed.
-- ═══════════════════════════════════════════════════════════════════════════
