-- 20260929120000_storage_bikes_updated_at.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Winter-storage gap analysis vs the subrenter/rentals feature (boss nuance 5,
-- 2026-09-29): the rentals table bumps updated_at on EVERY update via trigger
-- (20260928110000) so compare-and-swap writers and admin timelines see a
-- truthful freshness signal. storage_bikes ships the column
-- (default now() on insert) but no trigger — every status move / note /
-- photo event / payment mark / owner link left it frozen at the insert time.
--
-- This trigger stamps updated_at on every row update, same recipe as
-- rentals. SAFE for existing flows: no writer logic depends on updated_at
-- staying untouched (nothing reads it as «insert time»); the wall and story
-- pages already prefer events for ordering.
--
-- RUNBOOK: manual migration — run in Supabase SQL Editor. Idempotent
-- (drop-if-exists + re-create). MANUAL MIGRATION (Paul).
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_storage_bikes_touch_updated_at on public.storage_bikes;
drop function if exists public.storage_bikes_touch_updated_at();

create function public.storage_bikes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_storage_bikes_touch_updated_at
  before update on public.storage_bikes
  for each row
  execute function public.storage_bikes_touch_updated_at();
