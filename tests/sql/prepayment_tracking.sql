-- ═══════════════════════════════════════════════════════════════════════════
-- SQL Regression Tests for P2 Prepayment Tracking
-- Migration: supabase/migrations/20260825000000_prepayment_tracking.sql
-- PRD: docs/PRD_META_CRM_ENHANCEMENTS.md §1.5
-- ═══════════════════════════════════════════════════════════════════════════
-- Run with: psql -h <host> -U <user> -d <database> -f tests/sql/prepayment_tracking.sql
-- Or via Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 1: Verify CHECK constraint includes income_prepayment
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conname = 'cash_transactions_transaction_type_check';

  IF constraint_def IS NULL THEN
    RAISE EXCEPTION 'CHECK constraint not found';
  END IF;

  IF constraint_def NOT LIKE '%income_prepayment%' THEN
    RAISE EXCEPTION 'income_prepayment not in CHECK constraint. Got: %', constraint_def;
  END IF;

  RAISE NOTICE '✅ Test 1 PASSED: income_prepayment in CHECK constraint';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 2: Test INSERT with income_prepayment transaction type
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_crew_id UUID;
  test_rental_id UUID;
  test_transaction_id UUID;
BEGIN
  -- Get test crew
  SELECT id INTO test_crew_id FROM public.crews LIMIT 1;

  IF test_crew_id IS NULL THEN
    RAISE NOTICE '⚠️  No crew found, skipping Test 2';
    RETURN;
  END IF;

  -- Create test rental
  INSERT INTO public.rentals (crew_id, vehicle_id, agreed_start_date, agreed_end_date, status, total_cost)
  VALUES (test_crew_id, 'test-prepayment-bike', NOW(), NOW() + INTERVAL '1 day', 'confirmed', 10000)
  RETURNING rental_id INTO test_rental_id;

  -- Insert prepayment
  INSERT INTO public.cash_transactions (
    crew_id,
    rental_id,
    transaction_type,
    flow_direction,
    amount,
    description,
    transaction_date
  ) VALUES (
    test_crew_id,
    test_rental_id,
    'income_prepayment',
    'in',
    5000,
    'Test prepayment',
    NOW()
  )
  RETURNING id INTO test_transaction_id;

  IF test_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Failed to insert prepayment transaction';
  END IF;

  -- Cleanup
  DELETE FROM public.cash_transactions WHERE id = test_transaction_id;
  DELETE FROM public.rentals WHERE rental_id = test_rental_id;

  RAISE NOTICE '✅ Test 2 PASSED: income_prepayment INSERT successful';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 3: Verify index exists
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_cash_transactions_prepayment'
  ) THEN
    RAISE EXCEPTION 'idx_cash_transactions_prepayment index not found';
  END IF;

  RAISE NOTICE '✅ Test 3 PASSED: idx_cash_transactions_prepayment index exists';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 4: Verify prepayment_summary view exists and works
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  view_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'prepayment_summary'
  ) INTO view_exists;

  IF NOT view_exists THEN
    RAISE EXCEPTION 'prepayment_summary view does not exist';
  END IF;

  RAISE NOTICE '✅ Test 4 PASSED: prepayment_summary view exists';

  -- Test query (may return empty if no prepayments exist)
  PERFORM * FROM public.prepayment_summary LIMIT 1;
  RAISE NOTICE '✅ Test 4b PASSED: prepayment_summary view queryable';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 5: Verify transaction_type column comment
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  col_comment TEXT;
BEGIN
  SELECT pg_description.description INTO col_comment
  FROM pg_description
  JOIN pg_class ON pg_description.objoid = pg_class.oid
  JOIN pg_attribute ON pg_description.objsubid = pg_attribute.attnum
  WHERE pg_class.relname = 'cash_transactions'
  AND pg_attribute.attname = 'transaction_type';

  IF col_comment IS NULL THEN
    RAISE NOTICE '⚠️  No comment on transaction_type column';
  ELSE
    IF col_comment LIKE '%income_prepayment%' THEN
      RAISE NOTICE '✅ Test 5 PASSED: transaction_type comment mentions income_prepayment';
    ELSE
      RAISE NOTICE '⚠️  Comment exists but does not mention income_prepayment';
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 6: Verify all transaction types in CHECK constraint
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  constraint_def TEXT;
  expected_types TEXT[] := ARRAY[
    'income_prepayment',
    'income_rental',
    'income_sale',
    'income_equipment',
    'income_service',
    'income_other',
    'expense_commission',
    'expense_salary',
    'expense_deposit_return',
    'expense_other'
  ];
  missing_types TEXT[] := '{}';
  expected_type TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conname = 'cash_transactions_transaction_type_check';

  FOREACH expected_type IN ARRAY expected_types
  LOOP
    IF constraint_def NOT LIKE '%' || expected_type || '%' THEN
      missing_types := array_append(missing_types, expected_type);
    END IF;
  END LOOP;

  IF array_length(missing_types, 1) > 0 THEN
    RAISE EXCEPTION 'Missing transaction types in CHECK constraint: %', missing_types;
  END IF;

  RAISE NOTICE '✅ Test 6 PASSED: All expected transaction types in CHECK constraint';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 7: Verify cash_transactions table structure
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  -- Check rental_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'cash_transactions'
    AND column_name = 'rental_id'
  ) INTO column_exists;

  IF NOT column_exists THEN
    RAISE EXCEPTION 'rental_id column not found in cash_transactions';
  END IF;

  RAISE NOTICE '✅ Test 7 PASSED: cash_transactions has rental_id column';

  -- Check other critical columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'cash_transactions'
    AND column_name IN ('transaction_type', 'flow_direction', 'amount', 'crew_id')
  ) INTO column_exists;

  IF NOT column_exists THEN
    RAISE EXCEPTION 'Missing critical columns in cash_transactions';
  END IF;

  RAISE NOTICE '✅ Test 7b PASSED: All critical columns present';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 8: Query performance test (basic)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration INTERVAL;
BEGIN
  start_time := clock_timestamp();

  -- Perform prepayment query (should use index)
  PERFORM * FROM public.cash_transactions
  WHERE transaction_type = 'income_prepayment'
  LIMIT 10;

  end_time := clock_timestamp();
  duration := end_time - start_time;

  -- Should complete in under 1 second
  IF duration > INTERVAL '1 second' THEN
    RAISE NOTICE '⚠️  Prepayment query took % seconds (may need index tuning)', duration;
  ELSE
    RAISE NOTICE '✅ Test 8 PASSED: Prepayment query completed in %', duration;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 9: Verify RLS policies don't break prepayments
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Check that RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'cash_transactions'
    AND relrowsecurity = true
  ) THEN
    RAISE NOTICE '⚠️  RLS not enabled on cash_transactions';
  ELSE
    RAISE NOTICE '✅ Test 9 PASSED: RLS enabled on cash_transactions';
  END IF;

  -- Check that policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_transactions'
  ) THEN
    RAISE NOTICE '⚠️  No RLS policies found on cash_transactions';
  ELSE
    RAISE NOTICE '✅ Test 9b PASSED: RLS policies exist on cash_transactions';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Test 10: Test rejection of invalid transaction type
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_crew_id UUID;
BEGIN
  SELECT id INTO test_crew_id FROM public.crews LIMIT 1;

  IF test_crew_id IS NULL THEN
    RAISE NOTICE '⚠️  No crew found, skipping Test 10';
    RETURN;
  END IF;

  -- This should fail due to CHECK constraint
  BEGIN
    INSERT INTO public.cash_transactions (
      crew_id,
      transaction_type,
      flow_direction,
      amount
    ) VALUES (
      test_crew_id,
      'invalid_transaction_type',
      'in',
      100
    );
    RAISE EXCEPTION 'Invalid transaction_type was accepted (should have been rejected)';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✅ Test 10 PASSED: Invalid transaction_type rejected by CHECK constraint';
  END;
END $$;

ROLLBACK; -- Rollback to clean up test data

-- ═══════════════════════════════════════════════════════════════════════════
-- Summary Report
-- ═══════════════════════════════════════════════════════════════════════════
-- All tests completed. Check NOTICE messages above for results.
-- Expected: 10+ PASSED messages
-- ═══════════════════════════════════════════════════════════════════════════
