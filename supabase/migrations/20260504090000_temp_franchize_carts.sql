create table if not exists public.temp_franchize_carts (
  cart_id text primary key,
  cart_by_slug jsonb not null default '{}'::jsonb,
  consumed_by_user_id text null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_temp_franchize_carts_consumed_by
  on public.temp_franchize_carts(consumed_by_user_id);

create index if not exists idx_temp_franchize_carts_updated_at
  on public.temp_franchize_carts(updated_at desc);

alter table public.temp_franchize_carts enable row level security;

drop policy if exists "temp_franchize_carts_service_role_only" on public.temp_franchize_carts;
create policy "temp_franchize_carts_service_role_only"
  on public.temp_franchize_carts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
