-- ═══════════════════════════════════════════════════════════════════════════
-- Regression Test: deposit trigger double-return guard (I1)
-- Migration under test: 20260811000000_deposit_trigger_double_return_guard.sql
-- Related: docs/DEPOSIT_TRACKING_PRD.md §3.2a, docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md I1
--
-- HOW TO RUN
-- ──────────
-- This is a MANUAL test script — run it in the Supabase SQL editor against
-- a TEST database (or a test rental you don't mind polluting).
--
-- The script creates a test rental + collected deposit, fires the trigger
-- twice, and asserts the guard blocks the duplicate INSERT on the second fire.
-- At the end it prints a PASS/FAIL summary and cleans up the test data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── SETUP: create a test rental with a collected deposit ──────────────────
-- Use a random UUID so the test is re-runnable without conflicts.
DO $$
DECLARE
  test_rental_id UUID := gen_random_uuid();
  test_vehicle_id TEXT := 'test-vehicle-i1-regression';
  test_user_id TEXT := 'test-user-i1-regression';
  collected_count INTEGER;
  returned_count INTEGER;
  returned_count_after_reopen INTEGER;
  returned_count_after_second_complete INTEGER;
BEGIN
  -- ─── 1. Create a minimal test rental in 'active' status ──────────────────
  -- We need a rental row so the trigger has something to fire on.
  INSERT INTO public.rentals (
    rental_id, user_id, owner_id, vehicle_id,
    status, payment_status, total_cost,
    requested_start_date, requested_end_date,
    agreed_start_date, agreed_end_date
  ) VALUES (
    test_rental_id, test_user_id, test_user_id, test_vehicle_id,
    'active', 'fully_paid', 5000,
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 hour',
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 hour'
  );

  -- ─── 2. Insert a deposit_collected row (the trigger will return this) ────
  INSERT INTO public.deposit_entries (
    rental_id, entry_type, amount, direction, destination, operator_chat_id, notes
  ) VALUES (
    test_rental_id, 'deposit_collected', 10000, 'in', 'cash', test_user_id,
    'I1 regression test — collected'
  );

  SELECT count(*) INTO collected_count
  FROM public.deposit_entries
  WHERE rental_id = test_rental_id AND entry_type = 'deposit_collected';

  -- ─── 3. Fire the trigger the FIRST time: active → completed ──────────────
  -- The trigger should INSERT 1 deposit_returned row (no existing return → guard passes).
  UPDATE public.rentals SET status = 'completed' WHERE rental_id = test_rental_id;

  SELECT count(*) INTO returned_count
  FROM public.deposit_entries
  WHERE rental_id = test_rental_id AND entry_type = 'deposit_returned';

  -- ─── 4. Re-open the rental: completed → active ───────────────────────────
  UPDATE public.rentals SET status = 'active' WHERE rental_id = test_rental_id;

  SELECT count(*) INTO returned_count_after_reopen
  FROM public.deposit_entries
  WHERE rental_id = test_rental_id AND entry_type = 'deposit_returned';

  -- ─── 5. Fire the trigger the SECOND time: active → completed again ───────
  -- WITHOUT the guard: would INSERT a 2nd deposit_returned row (duplicate).
  -- WITH the guard (I1 fix): should SKIP the INSERT — count stays at 1.
  UPDATE public.rentals SET status = 'completed' WHERE rental_id = test_rental_id;

  SELECT count(*) INTO returned_count_after_second_complete
  FROM public.deposit_entries
  WHERE rental_id = test_rental_id AND entry_type = 'deposit_returned';

  -- ─── 6. Print the verdict ────────────────────────────────────────────────
  RAISE NOTICE '';
  RAISE NOTICE '═══ I1 REGRESSION TEST RESULTS ═══';
  RAISE NOTICE 'Test rental_id: %', test_rental_id;
  RAISE NOTICE 'Collected rows:    % (expect 1)', collected_count;
  RAISE NOTICE 'Returned after 1st complete:  % (expect 1)', returned_count;
  RAISE NOTICE 'Returned after reopen:        % (expect 1 — reopen does not delete)', returned_count_after_reopen;
  RAISE NOTICE 'Returned after 2nd complete:  % (expect 1 — guard blocks duplicate)', returned_count_after_second_complete;

  IF returned_count_after_second_complete = 1 THEN
    RAISE NOTICE '✅ PASS — double-return guard works correctly';
  ELSIF returned_count_after_second_complete = 2 THEN
    RAISE NOTICE '❌ FAIL — guard did NOT block the duplicate (returned_count = 2). Migration 20260811000000 not applied?';
  ELSE
    RAISE NOTICE '❌ UNEXPECTED — returned_count = % (expected 1 or 2)', returned_count_after_second_complete;
  END IF;
  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE '';

  -- ─── 7. Cleanup: delete test data ───────────────────────────────────────
  -- deposit_entries cascade-deletes with the rental (FK ON DELETE CASCADE).
  DELETE FROM public.rentals WHERE rental_id = test_rental_id;

  RAISE NOTICE 'Test data cleaned up. Test rental_id % deleted.', test_rental_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXPECTED OUTPUT (in Supabase SQL editor → Messages tab):
--
-- ═══ I1 REGRESSION TEST RESULTS ═══
-- Test rental_id: <some-uuid>
-- Collected rows:    1 (expect 1)
-- Returned after 1st complete:  1 (expect 1)
-- Returned after reopen:        1 (expect 1 — reopen does not delete)
-- Returned after 2nd complete:  1 (expect 1 — guard blocks duplicate)
-- ✅ PASS — double-return guard works correctly
-- ═══════════════════════════════════════════════════════════════════════════
--
-- If you see "❌ FAIL", check:
--   1. Migration 20260811000000 was applied: \df+ auto_return_deposit_entries
--      should show the NOT EXISTS clause in the function body.
--   2. The trigger exists: SELECT tgname FROM pg_trigger WHERE tgname = 'trg_auto_return_deposit_entries';
--   3. No other trigger is shadowing this one.
-- ═══════════════════════════════════════════════════════════════════════════
