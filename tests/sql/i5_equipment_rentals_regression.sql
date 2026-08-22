-- ═══════════════════════════════════════════════════════════════════════════
-- I5 equipment_rentals — regression checks
-- Plan: docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Task 1)
-- Usage: run in Supabase SQL editor on staging AFTER applying
--        supabase/migrations/20260812000001_create_equipment_rentals.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Table + columns exist (19 expected)
SELECT count(*) AS column_count FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'equipment_rentals'
  AND column_name IN ('id','crew_id','equipment_id','renter_user_id','primary_rental_id',
                      'start_date','end_date','expected_return_date','daily_price','total_cost',
                      'status','issued_by','received_by','issued_at','returned_at','condition_notes',
                      'created_by','created_at','updated_at');
-- Expected: 19

-- 2) Status CHECK rejects garbage
INSERT INTO public.equipment_rentals (crew_id, equipment_id, status)
VALUES ((SELECT id FROM crews LIMIT 1), 'equip-helmet-l', 'banana');
-- Expected: ERROR — new row violates check constraint "equipment_rentals_status_check"

-- 3) FK to cars works
INSERT INTO public.equipment_rentals (crew_id, equipment_id)
VALUES ((SELECT id FROM crews LIMIT 1), 'no-such-item');
-- Expected: ERROR — insert violates foreign key constraint "equipment_rentals_equipment_id_fkey"

-- 4) RLS enabled
SELECT relrowsecurity FROM pg_class WHERE relname = 'equipment_rentals';
-- Expected: t (true)
