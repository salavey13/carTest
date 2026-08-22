create extension if not exists pgcrypto;

create table if not exists public.map_rider_sessions (
  id uuid primary key default gen_random_uuid(),
  crew_slug text not null,
  user_id text not null references public.users(user_id) on delete cascade,
  ride_name text,
  vehicle_label text,
  ride_mode text not null default 'rental' check (ride_mode in ('rental', 'personal')),
  visibility text not null default 'crew' check (visibility in ('crew', 'all_auth')),
  status text not null default 'active' check (status in ('active', 'completed')),
  sharing_enabled boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_ping_at timestamptz,
  latest_lat double precision,
  latest_lon double precision,
  latest_speed_kmh double precision not null default 0,
  avg_speed_kmh double precision not null default 0,
  max_speed_kmh double precision not null default 0,
  total_distance_km double precision not null default 0,
  duration_seconds integer not null default 0,
  stats jsonb not null default '{}'::jsonb,
  route_bounds jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_rider_sessions_crew_slug_idx on public.map_rider_sessions (crew_slug, status, started_at desc);
create index if not exists map_rider_sessions_user_idx on public.map_rider_sessions (user_id, started_at desc);

create table if not exists public.map_rider_points (
  id bigserial primary key,
  session_id uuid not null references public.map_rider_sessions(id) on delete cascade,
  crew_slug text not null,
  user_id text not null references public.users(user_id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  speed_kmh double precision not null default 0,
  heading_deg double precision,
  accuracy_meters double precision,
  captured_at timestamptz not null default now()
);

create index if not exists map_rider_points_session_idx on public.map_rider_points (session_id, captured_at asc);
create index if not exists map_rider_points_crew_idx on public.map_rider_points (crew_slug, captured_at desc);

create table if not exists public.map_rider_meetups (
  id uuid primary key default gen_random_uuid(),
  crew_slug text not null,
  created_by_user_id text not null references public.users(user_id) on delete cascade,
  title text not null,
  comment text,
  lat double precision not null,
  lon double precision not null,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists map_rider_meetups_crew_idx on public.map_rider_meetups (crew_slug, created_at desc);

alter table public.map_rider_sessions enable row level security;
alter table public.map_rider_points enable row level security;
alter table public.map_rider_meetups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_sessions' and policyname = 'Public can read map rider sessions'
  ) then
    create policy "Public can read map rider sessions" on public.map_rider_sessions for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_points' and policyname = 'Public can read map rider points'
  ) then
    create policy "Public can read map rider points" on public.map_rider_points for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_meetups' and policyname = 'Public can read map rider meetups'
  ) then
    create policy "Public can read map rider meetups" on public.map_rider_meetups for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_rider_sessions'
  ) then
    alter publication supabase_realtime add table public.map_rider_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_rider_meetups'
  ) then
    alter publication supabase_realtime add table public.map_rider_meetups;
  end if;
end $$;
