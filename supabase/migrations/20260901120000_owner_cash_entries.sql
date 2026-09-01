-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260901120000_owner_cash_entries.sql
-- Purpose:   Личный кошелёк владельца экипажа (crew owner) — все подряд
--            движения денег, которые не попадают в автоматические системы:
--            наличная выручка мимо кассы (в), личные траты (шлем Байкленд,
--            еда — хотя еда идёт в cash_transactions/хозрасходы), выплаты
--            субарендаторам (kind='subrenter_payout'), прочее.
--
-- Отдельная таблица (владелец просил «просто отдельную табличку на все
-- подряд для владельцев») — НЕ путать с cash_transactions ( единый ledger
-- операций экипажа, I5).
--
-- Идемпотентно. Применяется владельцем руками (см. run-migrations.mjs или
-- SQL-редактор Supabase). Безопасно для повторного запуска.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.owner_cash_entries (
  id             uuid primary key default gen_random_uuid(),
  crew_id        uuid not null references public.crews(id) on delete cascade,
  owner_user_id  text,                    -- telegram chat_id владельца (если известен)
  direction      text not null check (direction in ('in', 'out')),
  kind           text not null default 'personal' check (kind in ('personal', 'subrenter_payout', 'other')),
  amount         numeric not null check (amount > 0),
  title          text not null,           -- «CBR 600RR Влад», «Шлем Байкленд», «Обед»
  person         text,                    -- кто отдал / кому выплатили (свободный текст)
  entry_date     date not null default current_date,
  created_by     text,                    -- chat_id оператора/ассистента, создавшего запись
  source         text not null default 'manual' check (source in ('manual', 'assistant_bot', 'profile', 'api')),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default timezone('utc'::text, now()),
  updated_at     timestamptz not null default timezone('utc'::text, now())
);

comment on table public.owner_cash_entries is
  'Личный кошелёк владельца экипажа: наличные приходы/расходы мимо автоматических систем, выплаты субарендаторам (kind=subrenter_payout). Отображается в профиле франшизы (панель «Кошелёк владельца»).';

create index if not exists idx_owner_cash_crew_date
  on public.owner_cash_entries(crew_id, entry_date desc, created_at desc);
create index if not exists idx_owner_cash_crew_kind
  on public.owner_cash_entries(crew_id, kind)
  where kind = 'subrenter_payout';

-- updated_at trigger (локальная функция — не зависит от триггеров других таблиц)
create or replace function public.owner_cash_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_owner_cash_entries_updated_at on public.owner_cash_entries;
create trigger trg_owner_cash_entries_updated_at
  before update on public.owner_cash_entries
  for each row
  execute function public.owner_cash_set_updated_at();

-- ─── RLS: зеркалируем cash_transactions ────────────────────────────────────
alter table public.owner_cash_entries enable row level security;

drop policy if exists "Crew members can read owner cash entries" on public.owner_cash_entries;
create policy "Crew members can read owner cash entries"
  on public.owner_cash_entries for select
  using (
    exists (
      select 1 from public.crew_members cm
      where cm.crew_id = owner_cash_entries.crew_id
        and cm.user_id = (select auth.jwt() ->> 'user_id')
    )
  );

drop policy if exists "Crew owners can manage owner cash entries" on public.owner_cash_entries;
create policy "Crew owners can manage owner cash entries"
  on public.owner_cash_entries for all
  using (
    exists (
      select 1 from public.crews c
      where c.id = owner_cash_entries.crew_id
        and c.owner_id = (select auth.jwt() ->> 'user_id')
    )
  );

grant select on public.owner_cash_entries to service_role, authenticated;

DO $$
BEGIN
  RAISE NOTICE 'owner_cash_entries created: личный кошелёк владельца готов';
END;
$$;
