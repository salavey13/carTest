-- 20260928100000_storage_bikes_order_uniq.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Winter storage hardening (boss review R2 #4): the checkout persistence
-- promises «one season row per orderId, ever» (actions-runtime.ts storage
-- branch does a check-then-insert), but nothing ENFORCED it — two concurrent
-- webhook/notification retries (different warm lambdas) could both pass the
-- pre-check and double-insert, and a duplicate row then also breaks the
-- future maybeSingle() lookups with an error.
--
-- Partial UNIQUE index: only rows with a real order_id (manual owner/crew
-- adds have order_id = NULL and may repeat freely).
--
-- RUNBOOK: manual migration — run in Supabase SQL Editor AFTER
-- 20260927120000_winter_storage.sql. Idempotent. Before running, de-dupe any
-- existing rows (keep the earliest):
--
--   delete from public.storage_bikes a
--   using public.storage_bikes b
--   where a.order_id is not null
--     and b.order_id = a.order_id
--     and b.crew_slug = a.crew_slug
--     and (b.created_at < a.created_at
        or (b.created_at = a.created_at and b.id < a.id)); -- R3: tie-breaker for identical created_at
--
-- MANUAL MIGRATION (Paul).
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists storage_bikes_crew_order_uniq
  on public.storage_bikes (crew_slug, order_id)
  where order_id is not null;
