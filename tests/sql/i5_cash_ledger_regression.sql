-- ═══════════════════════════════════════════════════════════════════════════
-- I5 cash_ledger — regression checks
-- Plan: docs/superpowers/plans/2026-08-12-i5-cash-ledger.md (Task 1)
-- Usage: run in Supabase SQL editor on staging AFTER applying
--        supabase/migrations/20260812000002_create_cash_transactions.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Table + columns exist (17 expected)
SELECT count(*) AS column_count FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cash_transactions'
  AND column_name IN ('id','crew_id','rental_id','sale_contract_id','equipment_rental_id','salary_calc_id',
    'transaction_type','flow_direction','amount','payment_method','from_user_id','to_user_id',
    'category','description','transaction_date','created_by','created_at','updated_at');
-- Expected: 17

-- 2) CHECK on transaction_type rejects garbage
INSERT INTO public.cash_transactions (crew_id, transaction_type, amount, flow_direction)
VALUES ((SELECT id FROM crews LIMIT 1), 'income_magic', 100, 'in');
-- Expected: ERROR — new row violates check constraint

-- 3) CHECK on amount rejects <= 0
INSERT INTO public.cash_transactions (crew_id, transaction_type, amount, flow_direction)
VALUES ((SELECT id FROM crews LIMIT 1), 'income_other', 0, 'in');
-- Expected: ERROR — new row violates check constraint

-- 4) CHECK on flow_direction rejects garbage
INSERT INTO public.cash_transactions (crew_id, transaction_type, amount, flow_direction)
VALUES ((SELECT id FROM crews LIMIT 1), 'income_other', 100, 'sideways');
-- Expected: ERROR — new row violates check constraint

-- 5) View exists and is queryable
SELECT * FROM public.daily_cash_flow LIMIT 1;
-- Expected: executes (0+ rows — ok, or aggregated data if exists)

-- 6) RLS enabled
SELECT relrowsecurity FROM pg_class WHERE relname = 'cash_transactions';
-- Expected: t (true)

-- 7) Indexes exist
SELECT count(*) AS index_count FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'cash_transactions'
  AND indexname LIKE 'idx_cash_transactions%';
-- Expected: 6
