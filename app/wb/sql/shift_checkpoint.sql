-- 1) Add JSONB columns to store checkpoint and actions (best-effort / non-breaking)
alter table public.crew_member_shifts
  add column if not exists checkpoint jsonb default '{}'::jsonb,
  add column if not exists actions jsonb default '[]'::jsonb;

-- 2) Optionally create an index to quickly find active shifts by member and crew
create index if not exists idx_crew_member_shifts_member_crew_active
  on public.crew_member_shifts (member_id, crew_id)
  where (clock_out_time is null);