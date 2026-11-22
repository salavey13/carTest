-- 20260928110000_rentals_updated_at_trigger.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Boss R3 recommendation: make the metadata CAS airtight.
--
-- The rental-odometer API (field:"start"/"end") guards its metadata jsonb
-- merges with a compare-and-swap on rentals.updated_at. A census found ~12
-- metadata writers that do NOT bump updated_at manually (handoffs, contract
-- draft submit/approve, contract_verifier refresh, checklist verify, bot
-- commands, …) — their writes were invisible to the CAS. This trigger sets
-- updated_at on EVERY update, covering all current and future writers.
--
-- SAFE for existing flows: no writer logic depends on updated_at staying
-- untouched (the column's default already stamps inserts; the update path
-- was simply inconsistent until now).
--
-- RUNBOOK: manual migration — run in Supabase SQL Editor. Idempotent
-- (drop-if-exists + re-create). MANUAL MIGRATION (Paul).
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_rentals_touch_updated_at on public.rentals;
drop function if exists public.rentals_touch_updated_at();

create function public.rentals_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_rentals_touch_updated_at
  before update on public.rentals
  for each row
  execute function public.rentals_touch_updated_at();
