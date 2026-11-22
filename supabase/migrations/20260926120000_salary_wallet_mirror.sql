-- Migration: 20260926120000_salary_wallet_mirror.sql
-- Run manually in the Supabase SQL Editor (project inmctohsodgdohamhzag).
--
-- 2026-09-26 salary audit (vip-bike, pay period 25th) — the «двухкнижная» fix.
--
-- PROBLEM
--   The crew keeps two money books:
--     • FORMAL salary ledger: cash_transactions, transaction_type =
--       'expense_salary', to_user_id = member. The salary page counts ONLY
--       this book as «уже выплачено».
--     • OWNER WALLET: owner_cash_entries. The assistant bot and the owner
--       write every real-world money move here («занеси выплату зарплаты
--       админу 10 000» → assistant_bot row).
--   Wallet-only payouts were invisible to the salary math: the page kept
--   showing a balance for money that had already left → double-pay risk.
--   The forward direction (salary page → wallet) was mirrored in code on
--   2026-09-09, the reverse direction (wallet/bot → formal ledger) was not.
--
-- WHAT THIS MIGRATION DOES (all steps idempotent, safe to re-run)
--   1. Adds cash_transactions.metadata (jsonb) — the mirror-link column.
--   2. AFTER INSERT trigger on owner_cash_entries: a wallet payout that
--      names a crew member and reads as salary is mirrored into the formal
--      ledger, and the wallet row is tagged metadata.mirroredToTx.
--      Skipped: forward-mirror rows (metadata.mirrorOfTx), rows without a
--      resolvable member id in person («Механик» has no «(7868630963)»),
--      subrenter payouts, non-salary titles, re-runs.
--   3. Backfill: mirrors historical wallet salary rows that have no formal
--      twin, and tags wallet rows whose formal twin already exists (e.g. the
--      2026-09-09 manual backfill row for salavey13's 10 000 ₽, whose
--      description quotes the wallet id d3235c01-…).
--   4. Transparency view v_crew_member_salary_ledger (security_invoker —
--      RLS of the CALLER applies; anon keeps whatever RLS grants).
--
--  After running this, the app (already deployed) counts «уже выплачено»
--  from BOTH books via app/franchize/lib/salary-paid-out.ts, using the
--  metadata tags below to never double count a payout.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Mirror-link column on the formal ledger
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Reverse-mirror trigger (wallet → formal ledger)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mirror_wallet_salary_to_ledger() RETURNS trigger AS $fn$
DECLARE
  v_member_id text;
  v_tx_id uuid;
BEGIN
  -- Only real payouts.
  IF NEW.direction <> 'out' OR COALESCE(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Never re-mirror the code's forward-mirror rows (salary page payout →
  -- wallet): their formal twin already exists and is counted.
  IF COALESCE(NEW.metadata ->> 'mirrorOfTx', '') <> '' THEN
    RETURN NEW;
  END IF;

  -- Subrenter share has its own ledger — not crew salary.
  IF NEW.kind = 'subrenter_payout' THEN
    RETURN NEW;
  END IF;

  -- Salary-ish only: explicit book tag or a salary-like title.
  IF COALESCE(NEW.metadata ->> 'book', '') <> 'salary'
     AND COALESCE(NEW.title, '') !~* 'зарпл' THEN
    RETURN NEW;
  END IF;

  -- Resolve the crew member from person «… (413553377)» — the convention of
  -- both the assistant bot and the app's forward mirror.
  v_member_id := substring(COALESCE(NEW.person, '') from '\((\d{4,})\)');
  IF v_member_id IS NULL THEN
    -- Rows without an id in person (e.g. «Механик») cannot be classified
    -- reliably — skip; the owner records such payouts on the salary page.
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM crew_members cm
    WHERE cm.crew_id = NEW.crew_id AND cm.user_id = v_member_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Idempotency: this wallet row was already mirrored (metadata link or the
  -- 2026-09-09 manual-backfill description quoting the wallet id).
  IF EXISTS (
    SELECT 1 FROM cash_transactions ct
    WHERE ct.transaction_type = 'expense_salary'
      AND ct.crew_id = NEW.crew_id
      AND ct.to_user_id = v_member_id
      AND (ct.metadata ->> 'mirrorOfWalletId' = NEW.id::text
           OR ct.description LIKE '%' || NEW.id::text || '%')
  ) THEN
    -- Still (re)tag the wallet row so the app-side sum stays deduped.
    UPDATE owner_cash_entries w
    SET metadata = COALESCE(w.metadata, '{}'::jsonb)
                   || jsonb_build_object('mirroredToTx', ct.id::text)
    FROM cash_transactions ct
    WHERE w.id = NEW.id
      AND ct.transaction_type = 'expense_salary'
      AND ct.crew_id = NEW.crew_id
      AND ct.to_user_id = v_member_id
      AND (ct.metadata ->> 'mirrorOfWalletId' = NEW.id::text
           OR ct.description LIKE '%' || NEW.id::text || '%');
    RETURN NEW;
  END IF;

  INSERT INTO cash_transactions (
    crew_id, transaction_type, flow_direction, amount, payment_method,
    category, description, transaction_date, to_user_id, created_by, metadata
  ) VALUES (
    NEW.crew_id,
    'expense_salary',
    'out',
    NEW.amount,
    'cash',
    'Зарплата',
    'Зеркало из кошелька · wallet:' || NEW.id::text || ' · ' || COALESCE(NEW.title, ''),
    COALESCE(NEW.created_at, now()),
    v_member_id,
    NEW.created_by,
    jsonb_build_object('mirrorOfWalletId', NEW.id::text, 'book', 'salary')
  ) RETURNING id INTO v_tx_id;

  -- Tag the wallet row so the app-side sum counts this payout exactly once
  -- (via the formal row) and never twice.
  UPDATE owner_cash_entries
  SET metadata = COALESCE(metadata, '{}'::jsonb)
                 || jsonb_build_object('mirroredToTx', v_tx_id::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallet_salary_mirror ON owner_cash_entries;
CREATE TRIGGER trg_wallet_salary_mirror
AFTER INSERT ON owner_cash_entries
FOR EACH ROW EXECUTE FUNCTION mirror_wallet_salary_to_ledger();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. Backfill: mirror historical wallet salary rows without a formal twin
-- ─────────────────────────────────────────────────────────────────────────────
WITH candidates AS (
  SELECT w.*,
         substring(COALESCE(w.person, '') from '\((\d{4,})\)') AS resolved_member_id
  FROM owner_cash_entries w
  WHERE w.direction = 'out'
    AND COALESCE(w.amount, 0) > 0
    AND w.kind <> 'subrenter_payout'
    AND (
      COALESCE(w.metadata ->> 'book', '') = 'salary'
      OR (COALESCE(w.title, '') ~* 'зарпл'
          AND COALESCE(w.metadata ->> 'mirrorOfTx', '') = ''
          AND COALESCE(w.metadata ->> 'mirroredToTx', '') = '')
    )
)
INSERT INTO cash_transactions (
  crew_id, transaction_type, flow_direction, amount, payment_method,
  category, description, transaction_date, to_user_id, created_by, metadata
)
SELECT
  c.crew_id, 'expense_salary', 'out', c.amount, 'cash',
  'Зарплата',
  'Зеркало из кошелька · wallet:' || c.id::text || ' · ' || COALESCE(c.title, ''),
  COALESCE(c.created_at, now()),
  c.resolved_member_id,
  c.created_by,
  jsonb_build_object('mirrorOfWalletId', c.id::text, 'book', 'salary')
FROM candidates c
WHERE c.resolved_member_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM crew_members cm
    WHERE cm.crew_id = c.crew_id AND cm.user_id = c.resolved_member_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM cash_transactions ct
    WHERE ct.transaction_type = 'expense_salary'
      AND ct.crew_id = c.crew_id
      AND ct.to_user_id = c.resolved_member_id
      AND (ct.metadata ->> 'mirrorOfWalletId' = c.id::text
           OR ct.description LIKE '%' || c.id::text || '%')
  );

-- 3b. Backfill: tag wallet rows whose formal twin already exists (manual
-- backfill rows like the 2026-09-09 salavey13 10 000 ₽).
UPDATE owner_cash_entries w
SET metadata = COALESCE(w.metadata, '{}'::jsonb)
               || jsonb_build_object('mirroredToTx', ct.id::text)
FROM cash_transactions ct
WHERE w.direction = 'out'
  AND COALESCE(w.metadata ->> 'mirroredToTx', '') = ''
  AND ct.transaction_type = 'expense_salary'
  AND ct.crew_id = w.crew_id
  AND ct.to_user_id = substring(COALESCE(w.person, '') from '\((\d{4,})\)')
  AND (ct.metadata ->> 'mirrorOfWalletId' = w.id::text
       OR ct.description LIKE '%' || w.id::text || '%');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Transparency view (RLS of the caller applies — security_invoker)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_crew_member_salary_ledger
WITH (security_invoker = true) AS
SELECT
  ct.crew_id,
  ct.to_user_id AS member_id,
  ct.amount,
  ct.transaction_date AS paid_at,
  'formal'::text AS source,
  ct.id::text AS ref_id,
  ct.description
FROM cash_transactions ct
WHERE ct.transaction_type = 'expense_salary'
UNION ALL
SELECT
  w.crew_id,
  substring(COALESCE(w.person, '') from '\((\d{4,})\)') AS member_id,
  w.amount,
  w.created_at AS paid_at,
  'wallet'::text AS source,
  w.id::text AS ref_id,
  w.title AS description
FROM owner_cash_entries w
WHERE w.direction = 'out'
  AND COALESCE(w.amount, 0) > 0
  AND w.kind <> 'subrenter_payout'
  AND (COALESCE(w.metadata ->> 'book', '') = 'salary' OR COALESCE(w.title, '') ~* 'зарпл')
  AND COALESCE(w.metadata ->> 'mirrorOfTx', '') = ''      -- forward mirror: formal twin counted
  AND COALESCE(w.metadata ->> 'mirroredToTx', '') = '';   -- reverse-mirrored: formal twin counted
