-- ═══════════════════════════════════════════════════════════════════════════
-- I5 salary + commissions — regression checks
-- Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 1)
-- Usage: run in Supabase SQL editor on staging AFTER applying migrations:
--        20260812000003_create_commission_rates.sql
--        20260812000004_create_salary_plans.sql
--        20260812000005_create_salary_calculations.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('commission_rates','salary_plans','salary_calculations');
-- Expected: 3 rows

-- 2) commission_rates: percentage > 100 rejected
INSERT INTO public.commission_rates (crew_id, operation_type, commission_type, commission_value)
VALUES ((SELECT id FROM crews LIMIT 1), 'rental_hourly', 'percentage', 150);
-- Expected: ERROR — violates check constraint

-- 3) commission_rates: fixed_amount > 100 allowed
INSERT INTO public.commission_rates (crew_id, operation_type, commission_type, commission_value, priority)
VALUES ((SELECT id FROM crews LIMIT 1), 'sale', 'fixed_amount', 5000, 1);
-- Expected: SUCCESS (then cleanup in real run)

-- 4) Seed: every crew has default 10% rental_hourly rate
SELECT c.id FROM public.crews c
WHERE NOT EXISTS (
  SELECT 1 FROM public.commission_rates r
  WHERE r.crew_id = c.id AND r.operation_type='rental_hourly' AND r.priority=0
);
-- Expected: 0 rows (all crews seeded)

-- 5) salary_plans: generated columns calculate correctly
-- Insert a test plan with shifts/commissions
-- (Skip in regression — needs actual data; verify column exists instead)
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='salary_plans'
  AND column_name IN ('total_shift_income','total_commissions','total_accrued','balance_due');
-- Expected: 4 rows

-- 6) salary_calculations: payout_status check rejects garbage
INSERT INTO public.salary_calculations (salary_plan_id, period_start, period_end, payout_date, payout_status)
VALUES ((SELECT id FROM salary_plans LIMIT 1), now(), now(), now(), 'invalid_status');
-- Expected: ERROR — violates check constraint

-- 7) RLS enabled on all tables
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('commission_rates','salary_plans','salary_calculations')
  AND relnamespace = 'public'::regnamespace;
-- Expected: 3 rows, all relrowsecurity = t

-- 8) Indexes exist
SELECT count(*) AS index_count FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('commission_rates','salary_plans','salary_calculations')
  AND indexname LIKE 'idx_%';
-- Expected: 8+ (commission_rates: 2, salary_plans: 2, salary_calculations: 3+)
