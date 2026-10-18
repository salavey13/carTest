-- =============================================================================
-- verification-svc-eq-cleanup-2026-10-19.sql
-- Task 114 — remove verification rows that must not exist: service records
-- disguised as rentals + equipment docs.
--
-- WHY: the live verification flow SKIPS service/equipment docs at closure
-- (rental-verify.ts: «Gear/service docs carry no operator bonus — nothing to
-- verify»), so they never get a verification row from the product itself.
-- The Aug/Sep/Oct backfill (2026-10-18) accidentally created rows for them
-- anyway — Paul: «some rentals are really service records disguised as
-- rentals … so exclude such from sus in audit». As pending rows they would
-- linger forever in the «⏳ ждут» counter and the drawer, poisoning every
-- future month's verification tally (44 service + 2 helmet equipment rows).
--
-- GUARDS (all three must hold for a row to be deleted):
--   • the rental's car is type='service' (или 'equipment') / item_type=equipment
--   • row status = 'pending' (verified/disputed/operator_confirmed are NEVER
--     touched — human decisions stay)
--   • row source = 'backfill_audit' (only the backfill-created rows; the live
--     flow cannot have created these)
--
-- IDEMPOTENT: rerun deletes 0 rows. Actual prod state at writing:
--   44 service rows + 2 equipment rows (Meta Universal Helmet 1000₽/500₽)
--   = 46 deletions expected. 170 rows before → 124 after.
--
-- Run in Supabase SQL Editor, whole file at once.
-- =============================================================================

-- ── 1. PRE-CHECK: what exactly is about to go (should list 44 + 2 rows) ──────
select v.rental_id, c.type as car_type, c.make, c.model,
       r.total_cost, r.status as rental_status, v.status, v.source
from rental_verifications v
join rentals r on r.rental_id = v.rental_id
join cars c on c.id = r.vehicle_id
where v.status = 'pending'
  and v.source = 'backfill_audit'
  and (
    c.type in ('service', 'equipment')
    or coalesce(r.metadata->>'item_type', '') = 'equipment'
  )
order by c.type, c.make;

-- ── 2. DELETE: service records (VIP_BIKE Уборка шланга, Сборка байка, …) ─────
delete from rental_verifications v
using rentals r, cars c
where v.rental_id = r.rental_id
  and r.vehicle_id = c.id
  and c.type = 'service'
  and v.status = 'pending'
  and v.source = 'backfill_audit';

-- ── 3. DELETE: equipment docs (Meta Universal Helmet ×2, item_type=equipment) ─
delete from rental_verifications v
using rentals r, cars c
where v.rental_id = r.rental_id
  and r.vehicle_id = c.id
  and v.status = 'pending'
  and v.source = 'backfill_audit'
  and (
    c.type = 'equipment'
    or coalesce(r.metadata->>'item_type', '') = 'equipment'
  );

-- ── 4. POST-CHECK (all three must return 0) ──────────────────────────────────
select count(*) as remaining_on_service_cars
from rental_verifications v
join rentals r on r.rental_id = v.rental_id
join cars c on c.id = r.vehicle_id
where c.type = 'service';

select count(*) as remaining_on_equipment_docs
from rental_verifications v
join rentals r on r.rental_id = v.rental_id
join cars c on c.id = r.vehicle_id
where c.type = 'equipment' or coalesce(r.metadata->>'item_type', '') = 'equipment';

select count(*) as remaining_backfill_rows_on_svc_or_eq
from rental_verifications v
join rentals r on r.rental_id = v.rental_id
join cars c on c.id = r.vehicle_id
where v.status = 'pending' and v.source = 'backfill_audit'
  and (c.type in ('service','equipment') or coalesce(r.metadata->>'item_type','') = 'equipment');

-- ── 5. TOTALS after cleanup ───────────────────────────────────────────────────
select status, count(*)
from rental_verifications
group by status
order by count(*) desc;
-- expected: pending 122, operator_confirmed 1 (R6 48 000 — ждёт владельца),
--           disputed 1 (Suzuki M109R 14 000 — спор) → 124 total.

-- ── 6. OCTOBER sanity (the month Paul asked about) ───────────────────────────
-- ok     = grade fine   (sweepable with «✅ fine за 2026-10» in one tap)
-- not-ok = grade almost (quick eyeball) + sus (real mismatches to resolve)
select v.snapshot->'audit'->>'grade' as grade,
       v.status,
       count(*) as rows
from rental_verifications v
join rentals r on r.rental_id = v.rental_id
where r.requested_start_date >= '2026-09-30T21:00:00Z'
  and r.requested_start_date <  '2026-10-31T21:00:00Z'
  and r.status in ('completed','confirmed')
group by 1, 2
order by 1, 2;
-- expected: fine 13 · almost 2 · sus 2 (+ R6/suzuki live rows without grade)
