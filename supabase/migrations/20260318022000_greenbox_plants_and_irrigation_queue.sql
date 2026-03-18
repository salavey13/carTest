-- Greenbox domain tables (separate from SupaPlan internal events)

create table if not exists public.greenbox_plants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  stage text not null,
  health text not null,
  hydration integer not null default 0,
  ec numeric(4,2) not null default 0,
  ph numeric(4,2) not null default 0,
  fruit_count integer not null default 0,
  progress integer not null default 0,
  note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.greenbox_irrigation_queue (
  id uuid primary key default gen_random_uuid(),
  zone text not null,
  intensity text not null,
  status text not null default 'queued',
  source text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists greenbox_irrigation_queue_requested_idx
  on public.greenbox_irrigation_queue (requested_at desc);

insert into public.greenbox_plants (slug, name, stage, health, hydration, ec, ph, fruit_count, progress, note, is_demo)
values
  ('demo-cherry-1', 'Черри #1', 'Росток', 'Отлично', 73, 1.20, 6.10, 0, 28, 'Наращивает корневую массу после пересадки.', true),
  ('demo-rosehoney-2', 'Розовый мёд #2', 'Цветение', 'Норма', 66, 1.60, 6.40, 4, 58, 'Первые кисти раскрылись, нужен стабильный обдув.', true),
  ('demo-bullheart-3', 'Бычье сердце #3', 'Плодоношение', 'Отлично', 71, 2.00, 6.20, 11, 84, 'Плоды наливаются, вес кистей растёт.', true),
  ('demo-plum-4', 'Сливка #4', 'Восстановление', 'Требует внимания', 54, 1.10, 5.70, 2, 42, 'Стресс после жары, нужен мягкий полив и тень.', true)
on conflict (slug) do update set
  name = excluded.name,
  stage = excluded.stage,
  health = excluded.health,
  hydration = excluded.hydration,
  ec = excluded.ec,
  ph = excluded.ph,
  fruit_count = excluded.fruit_count,
  progress = excluded.progress,
  note = excluded.note,
  is_demo = excluded.is_demo,
  updated_at = now();

insert into public.greenbox_irrigation_queue (zone, intensity, status, source)
values
  ('tomato-main', 'gentle', 'queued', 'seed'),
  ('microgreens', 'normal', 'queued', 'seed')
on conflict do nothing;
