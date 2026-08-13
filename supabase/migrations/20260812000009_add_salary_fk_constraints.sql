-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000009_add_salary_fk_constraints.sql
-- Purpose:   I5 — Add FK constraints between salary_calculations and cash_transactions
--           (Deferred to break circular dependency during table creation)
-- Contract:  PLAN-I5-SERVICE-OPERATIONS.md п.1 (FK relationships)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This migration adds the FK constraints that were deferred during initial
-- table creation to avoid circular dependency errors.
--
-- Relations:
-- - cash_transactions.salary_calc_id → salary_calculations.id
-- - salary_calculations.cash_transaction_id → cash_transactions.id
-- ═══════════════════════════════════════════════════════════════════════════

-- Add FK from cash_transactions.salary_calc_id to salary_calculations
DO $$
BEGIN
  -- Check if column exists and doesn't already have FK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cash_transactions'
      AND column_name = 'salary_calc_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'cash_transactions'
      AND kcu.column_name = 'salary_calc_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.cash_transactions
      ADD CONSTRAINT fk_cash_transactions_salary_calc
      FOREIGN KEY (salary_calc_id)
      REFERENCES public.salary_calculations(id)
      ON DELETE SET NULL;

    RAISE NOTICE 'Added FK: cash_transactions.salary_calc_id → salary_calculations.id';
  ELSE
    RAISE NOTICE 'FK cash_transactions.salary_calc_id already exists or column missing';
  END IF;
END $$;

-- Add FK from salary_calculations.cash_transaction_id to cash_transactions
DO $$
BEGIN
  -- Check if column exists and doesn't already have FK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'salary_calculations'
      AND column_name = 'cash_transaction_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'salary_calculations'
      AND kcu.column_name = 'cash_transaction_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.salary_calculations
      ADD CONSTRAINT fk_salary_calculations_cash_transaction
      FOREIGN KEY (cash_transaction_id)
      REFERENCES public.cash_transactions(id)
      ON DELETE SET NULL;

    RAISE NOTICE 'Added FK: salary_calculations.cash_transaction_id → cash_transactions.id';
  ELSE
    RAISE NOTICE 'FK salary_calculations.cash_transaction_id already exists or column missing';
  END IF;
END $$;

COMMENT ON CONSTRAINT fk_cash_transactions_salary_calc ON public.cash_transactions IS
'I5: Links expense_salary transactions to their salary calculation record';

COMMENT ON CONSTRAINT fk_salary_calculations_cash_transaction ON public.salary_calculations IS
'I5: Links salary calculations to their payment transaction';

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION
-- Run this to verify FKs are in place:
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('cash_transactions', 'salary_calculations');
-- ═══════════════════════════════════════════════════════════════════════════
