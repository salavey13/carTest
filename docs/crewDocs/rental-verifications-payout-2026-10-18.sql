-- rental-verifications-payout-2026-10-18.sql
-- Task 107 — VERIFIED PAYOUT: mark verified operator commissions as paid out.
--
-- WHAT: one jsonb column on rental_verifications. No new tables.
--
-- SHAPE (written by the app, never by hand):
--   payout = {
--     "operator": { "marked": true,  "at": "...", "by": "111", "note": "нал" },
--     "log": [ { "action": "marked", "part": "operator", "at": "...", "by": "..." },
--              { "action": "unmarked", "part": "operator", "at": "...", "by": "..." } ]
--   }
--   • payout IS NULL                              → never touched (counts as unpaid)
--   • payout.operator.marked = true               → money paid, leaves «к выплате»
--   • payout.operator.marked = false (after undo) → back to «к выплате», log keeps the audit
--
-- WHY JSONB: the whole payout state is one attribute of a verification row —
-- same degradation pattern as the `negotiation` column (task 106). Until this
-- file is applied the payout hub degrades: counters still work (unpaid
-- defaults), the «отметить выплаченной» button answers with a friendly
-- «apply the SQL» message instead of crashing.
--
-- IDEMPOTENT: safe to run twice (IF NOT EXISTS + DO-postcheck).
-- Supabase SQL Editor runs the file as ONE implicit transaction.

-- ── 1. Column ────────────────────────────────────────────────────────────────

ALTER TABLE public.rental_verifications
  ADD COLUMN IF NOT EXISTS payout jsonb;

-- ── 2. Audit comment (visible in \d+ and Data API introspection) ─────────────
-- NB (2026-10-18, task108): COMMENT ON ... IS accepts ONLY a single string
-- literal — no expressions, so 'a' || 'b' here fails with 42601 «syntax error
-- at or near "||"». Multi-line comments are merged into ONE literal instead.
-- The other crewDocs «||» uses are fine (they sit inside expressions/UPDATEs).

COMMENT ON COLUMN public.rental_verifications.payout IS
  'Task 107 verified-payout: per-party paid-out stamps + audit log. NULL = never touched (= unpaid). operator.marked=true = commission paid. App-managed; do not edit by hand. Degrades: hub stays read-only until this column exists.';

-- ── 3. Post-check (must return payout = jsonb) ───────────────────────────────

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'rental_verifications'
    AND column_name  = 'payout';

  IF col_type IS NULL THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: rental_verifications.payout was not created';
  END IF;
  IF col_type <> 'jsonb' THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: payout type is %, expected jsonb', col_type;
  END IF;

  RAISE NOTICE 'OK: rental_verifications.payout (jsonb) is ready — verified payout feature can go live.';
END $$;
