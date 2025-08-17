-- Создаёт таблицу leads_optima. Выполни через Supabase SQL Editor или CLI.

-- Вариант A: pgcrypto (рекомендуется)
create extension if not exists pgcrypto;

create table if not exists public.leads_optima (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  message text,
  source text, -- 'telegram' or 'website'
  telegram_user_id text,
  metadata jsonb,
  status text default 'new', -- new | in_progress | closed | archived
  notified boolean default false, -- отправлен ли уведомительный телеграм
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_leads_optima_created_at on public.leads_optima (created_at desc);
create index if not exists idx_leads_optima_telegram_user_id on public.leads_optima (telegram_user_id);
create index if not exists idx_leads_optima_status on public.leads_optima (status);

-- Если у тебя уже есть таблица leads и хочешь переименовать её в prod:
-- (ВНИМАНИЕ: сделай бэкап перед выполнением!)
-- ALTER TABLE public.leads RENAME TO leads_optima;
-- -- При необходимости переименовать PK/constraints, проверь их имена и обнови.