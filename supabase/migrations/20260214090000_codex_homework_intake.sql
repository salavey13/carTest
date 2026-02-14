create table if not exists public.codex_homework_intake (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id text not null,
  telegram_user_id text not null,
  photo_url text not null,
  status text not null default 'stored',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists codex_homework_intake_status_created_at_idx
  on public.codex_homework_intake(status, created_at desc);

alter table public.codex_homework_intake enable row level security;
