-- Franchize intent ledger: server-side conversion/recovery signals for `/franchize/*`.
-- Direct anon/authenticated writes are intentionally not granted; server actions/service-role only.

create table if not exists public.franchize_intents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  bike_id text,
  intent_type text not null,
  stage text not null,
  source_route text,
  contact_channel text,
  urgency_score integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  telegram_user_id text,
  phone text,
  last_seen_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint franchize_intents_slug_nonempty check (length(btrim(slug)) > 0),
  constraint franchize_intents_intent_type_allowed check (
    intent_type in (
      'checkout_start',
      'payment_failure',
      'payment_success',
      'hold_created',
      'map_click',
      'contact_click',
      'test_ride_click',
      'prebuy'
    )
  ),
  constraint franchize_intents_stage_allowed check (
    stage in (
      'discovered',
      'clicked',
      'prebuy_started',
      'checkout_started',
      'hold_created',
      'payment_failed',
      'payment_confirmed',
      'contacted',
      'test_ride_requested'
    )
  ),
  constraint franchize_intents_urgency_score_range check (urgency_score between 0 and 100)
);

create index if not exists franchize_intents_slug_urgency_updated_idx
  on public.franchize_intents (slug, urgency_score desc, updated_at desc);

create index if not exists franchize_intents_slug_bike_idx
  on public.franchize_intents (slug, bike_id)
  where bike_id is not null;

create index if not exists franchize_intents_type_stage_idx
  on public.franchize_intents (intent_type, stage);

create index if not exists franchize_intents_telegram_lookup_idx
  on public.franchize_intents (telegram_user_id, slug, updated_at desc)
  where telegram_user_id is not null;

create index if not exists franchize_intents_contact_lookup_idx
  on public.franchize_intents (phone, contact_channel, slug, updated_at desc)
  where phone is not null or contact_channel is not null;

create or replace function public.set_franchize_intents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  new.last_seen_at = coalesce(new.last_seen_at, new.updated_at);
  return new;
end;
$$;

drop trigger if exists trg_franchize_intents_updated_at on public.franchize_intents;
create trigger trg_franchize_intents_updated_at
  before update on public.franchize_intents
  for each row
  execute function public.set_franchize_intents_updated_at();

alter table public.franchize_intents enable row level security;

revoke all on table public.franchize_intents from anon, authenticated;
grant all on table public.franchize_intents to service_role;

comment on table public.franchize_intents is 'Server-only franchize conversion intent ledger. RLS has no anon/authenticated write policies by design.';
comment on column public.franchize_intents.metadata is 'Validated server action metadata: cart summaries, invoice/rental ids, click labels, and source details.';
