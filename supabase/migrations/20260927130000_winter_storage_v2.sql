-- 20260927130000_winter_storage_v2.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Winter storage v2 — owner-transparency parity with the Мотопарк wall
-- (boss: «owners transparency on same quality level as subrenters, with
-- admin/crewowner config, full package»).
--
-- Adds:
--   · storage_bikes.paid_until date          — one-shot season payment marker
--     (оплата единовременно за сезон, contract п. 3); staff sets it via
--     markStorageBikePaidAction, the owner sees «Оплачено до DD.MM.YYYY» on
--     the wall/story and in the report.
--   · storage_bike_events.type += 'payment' | 'owner_linked'
--     payment      — «Отметка об оплате» (money timeline parity with Мотопарк)
--     owner_linked — crew attached a TG owner to a web-checkout bike
--       (checkout rows arrive with owner_user_id = NULL; without this event
--       the linking move would be invisible to the crew's own audit).
--
-- RUNBOOK: run AFTER 20260927120000_winter_storage.sql (v1 creates the
-- tables this file alters). Idempotent — safe to re-run.
-- NO new RLS policies: the two owner-SELECT policies from v1 already cover
-- the new column/events; writes stay service-role only.
-- MANUAL MIGRATION (run in Supabase SQL Editor) — Paul.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. paid_until: null = не оплачено; date = оплачено до этой даты включительно.
alter table public.storage_bikes
  add column if not exists paid_until date;

comment on column public.storage_bikes.paid_until is
  'Season payment marker (one-shot): NULL = unpaid, date = paid through this day (inclusive).';

-- 2. Widen the event-type CHECK. v1 declared it inline on the column, so
-- Postgres auto-named it storage_bike_events_type_check. Drop-if-exists then
-- re-add keeps this step re-runnable (and repairs a hand-edited CHECK too).
alter table public.storage_bike_events
  drop constraint if exists storage_bike_events_type_check;

alter table public.storage_bike_events
  add constraint storage_bike_events_type_check
  check (type in ('created', 'status_changed', 'note', 'doc', 'payment', 'owner_linked'));
