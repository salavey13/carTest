-- 20260927120000_winter_storage.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Winter storage («Зимнее хранение») — persistent tracking for OWNER bikes
-- stored for the season. These are CLIENT machines: they never become `cars`
-- rows and are NOT available for rent — the wall badge says it explicitly.
--
-- Backs:
--   · the owner-facing «Хранение» wall (/franchize/<slug>/storage) —
--     «Мотопарк for actual owners»: an owner adds his bikes manually and
--     tracks every move, staff sees the whole season;
--   · the flowType="storage" checkout (contract generated from
--     docs/crewDocs/vip-bike_WINTER_STORAGE_TEMPLATE.html) — the order now
--     persists a row instead of vanishing after the TG notification;
--   · «notifications for every move» — storage_bike_events is the move log;
--     every status change / note emits a Telegram message (owner + crew).
--
-- MANUAL MIGRATION (run in Supabase SQL Editor) — idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.storage_bikes (
  id uuid primary key default gen_random_uuid(),
  crew_slug text not null,
  -- users.user_id (Telegram chat id, digits) when the owner is known —
  -- web checkouts from an anonymous browser stay null until claimed.
  owner_user_id text,
  owner_name text not null default '',
  owner_phone text not null default '',
  -- Machine identity (the contract's мото-транспорт block, п. 1.1–1.3).
  make text not null default '',         -- «марка и модель», e.g. «SYM LM 25»
  model text not null default '',
  reg_number text not null default '',
  vin text not null default '',
  bike_year int,
  color text not null default '',
  mileage_km int,
  accessories text not null default '',  -- чехол / кофры / доп. оборудование
  -- Money anchors: estimated value = liability cap (п. 1.3/5.1 шаблона),
  -- monthly × season = the invoice the manager confirms.
  estimated_value_rub numeric(12, 2) not null default 0,
  monthly_price_rub numeric(12, 2) not null default 0,
  total_price_rub numeric(12, 2) not null default 0,
  storage_address text not null default '',   -- «Стригинский переулок, 13Б»
  notice_address text not null default '',    -- адрес для уведомлений (Акт прил. 1)
  season_start date,
  season_end date,                            -- п. 2.1 «включительно»
  -- Lifecycle: requested → in_storage → returned (+ cancelled).
  status text not null default 'requested'
    check (status in ('requested', 'in_storage', 'returned', 'cancelled')),
  pep_signed boolean not null default false,  -- ПЭП п. 10.2 шаблона
  order_id text,                              -- franchize checkout orderId
  doc_path text,                              -- rental-contracts/<slug>/storage-*.docx
  source text not null default 'checkout'
    check (source in ('checkout', 'owner_add', 'crew_add')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storage_bikes_crew_slug_idx
  on public.storage_bikes (crew_slug, created_at desc);
create index if not exists storage_bikes_owner_idx
  on public.storage_bikes (owner_user_id)
  where owner_user_id is not null;

-- Every move gets a row here; the wall renders it as the card timeline.
create table if not exists public.storage_bike_events (
  id bigserial primary key,
  bike_id uuid not null references public.storage_bikes (id) on delete cascade,
  type text not null default 'status_changed'
    check (type in ('created', 'status_changed', 'note', 'doc')),
  status text,                            -- resulting status (status_changed)
  actor text not null default '',         -- users.user_id or 'system'
  actor_name text not null default '',
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists storage_bike_events_bike_idx
  on public.storage_bike_events (bike_id, created_at desc);

-- updated_at touch — cheap and keeps the wall «last move» sorting honest.
create or replace function public.storage_bikes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists storage_bikes_touch on public.storage_bikes;
create trigger storage_bikes_touch
  before update on public.storage_bikes
  for each row execute function public.storage_bikes_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- All product access goes through server actions on the service role (RLS is
-- bypassed there). Direct anon/authed reads are locked except the row's own
-- owner, via the same auth.jwt()->>'chat_id' convention the events table uses
-- (migration 20250720100000). No anon writes, ever — the wall add-form is a
-- server action that verifies the Telegram identity first.

alter table public.storage_bikes enable row level security;
alter table public.storage_bike_events enable row level security;

drop policy if exists storage_bikes_owner_read on public.storage_bikes;
create policy storage_bikes_owner_read on public.storage_bikes
  for select
  using (owner_user_id is not null and owner_user_id = auth.jwt() ->> 'chat_id');

drop policy if exists storage_bike_events_owner_read on public.storage_bike_events;
create policy storage_bike_events_owner_read on public.storage_bike_events
  for select
  using (
    exists (
      select 1 from public.storage_bikes sb
      where sb.id = storage_bike_events.bike_id
        and sb.owner_user_id is not null
        and sb.owner_user_id = auth.jwt() ->> 'chat_id'
    )
  );
