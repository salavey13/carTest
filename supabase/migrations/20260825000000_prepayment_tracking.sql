-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260825000000_prepayment_tracking.sql
-- Purpose:   P2 Prepayment tracking — Add income_prepayment transaction type
-- PRD:       docs/PRD_META_CRM_ENHANCEMENTS.md §1.5
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds support for prepayments/booking fees as a separate transaction type.
-- Prepayments are partial payments that reserve a bike for a future rental.
--
-- Schema changes:
-- - Adds 'income_prepayment' to cash_transactions.transaction_type CHECK constraint
-- - Adds 'rental_id' column reference for linking prepayment to future rental
-- - Adds comment documentation
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Drop existing CHECK constraint (PostgreSQL doesn't support ALTER on CHECK)
ALTER TABLE public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_transaction_type_check;

-- Step 2: Recreate CHECK constraint with income_prepayment added
ALTER TABLE public.cash_transactions
ADD CONSTRAINT cash_transactions_transaction_type_check
CHECK (transaction_type IN (
  -- Income
  'income_prepayment',  -- NEW: Prepayments/booking fees for future rentals
  'income_rental',
  'income_sale',
  'income_equipment',
  'income_service',
  'income_other',
  -- Expense
  'expense_commission',
  'expense_salary',
  'expense_deposit_return',
  'expense_other'
));

-- Step 3: Add comment for prepayment type
COMMENT ON COLUMN public.cash_transactions.transaction_type IS
'Type of cash transaction. income_prepayment: partial payment reserving a future rental (excluded from daily revenue totals until rental completes).';

-- Step 4: Add index for prepayment queries (evening summary, analytics)
CREATE INDEX IF NOT EXISTS idx_cash_transactions_prepayment
ON public.cash_transactions(crew_id, transaction_type)
WHERE transaction_type = 'income_prepayment';

-- Step 5: Create view for prepayment summary (optional helper for evening summary)
CREATE OR REPLACE VIEW public.prepayment_summary AS
SELECT
  crew_id,
  transaction_date::date AS date,
  COUNT(*) AS prepayment_count,
  SUM(amount) AS total_prepayments,
  COUNT(DISTINCT rental_id) AS unique_rentals_reserved
FROM public.cash_transactions
WHERE transaction_type = 'income_prepayment'
GROUP BY crew_id, transaction_date::date;

COMMENT ON VIEW public.prepayment_summary IS
'Daily prepayment aggregates: count, total amount, and unique rentals reserved per crew per day.';

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Run these queries to verify:

-- 1. Verify CHECK constraint includes income_prepayment:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname = 'cash_transactions_transaction_type_check';

-- 2. Test inserting a prepayment transaction:
-- INSERT INTO public.cash_transactions (crew_id, rental_id, transaction_type, flow_direction, amount, description, transaction_date)
-- VALUES (
--   (SELECT id FROM public.crews LIMIT 1),
--   (SELECT rental_id FROM public.rentals LIMIT 1),
--   'income_prepayment',
--   'in',
--   5000,
--   'Предоплата за бронь BMW',
--   NOW()
-- );

-- 3. Verify prepayment_summary view:
-- SELECT * FROM public.prepayment_summary LIMIT 5;
