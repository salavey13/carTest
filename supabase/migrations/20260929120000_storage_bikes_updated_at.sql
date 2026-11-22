-- 20260929120000_storage_bikes_updated_at.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- v2 — FIX for boss-reported apply failure (2026-09-30):
--   ERROR 2BP01: cannot drop function storage_bikes_touch_updated_at()
--   because trigger storage_bikes_touch on table storage_bikes depends on it.
--
-- ROOT CAUSE: the base winter-storage migration (20260927120000) ALREADY
-- ships function public.storage_bikes_touch_updated_at() + trigger
-- storage_bikes_touch. The first draft of this file re-created the same
-- pair under a different trigger name (trg_storage_bikes_touch_updated_at)
-- and its prelude only dropped THAT new name — so on a crew DB where the
-- base migration had been applied, DROP FUNCTION hit the live dependency
-- from the original storage_bikes_touch trigger and the whole script
-- aborted. The gap this migration targets (updated_at freshness parity
-- with rentals) was in fact already closed on any DB that ran the base
-- winter-storage script; this file now only CANONICALIZES the objects.
--
-- WHAT IT DOES (safe on every historical state):
--   1. drops BOTH historical trigger names (if exists — no-ops when absent)
--   2. drops the function WITH CASCADE (clears any trigger dependency)
--   3. re-creates the function + one canonical trigger storage_bikes_touch
--      (same name the base migration uses, so re-running the base
--      winter-storage script stays consistent)
--
-- RUNBOOK: manual migration — run in Supabase SQL Editor. Idempotent.
-- MANUAL MIGRATION (Paul).
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_storage_bikes_touch_updated_at on public.storage_bikes;
drop trigger if exists storage_bikes_touch on public.storage_bikes;
drop function if exists public.storage_bikes_touch_updated_at() cascade;

create function public.storage_bikes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger storage_bikes_touch
  before update on public.storage_bikes
  for each row
  execute function public.storage_bikes_touch_updated_at();
