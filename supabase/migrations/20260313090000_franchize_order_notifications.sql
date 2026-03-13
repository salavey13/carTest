create table if not exists public.franchize_order_notifications (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  order_id text not null,
  payload jsonb not null,
  send_status text not null default 'pending' check (send_status in ('pending', 'sent', 'failed')),
  attempts integer not null default 1,
  rendered_markdown text,
  doc_file_name text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists franchize_order_notifications_slug_order_idx
  on public.franchize_order_notifications (slug, order_id, created_at desc);

create index if not exists franchize_order_notifications_status_idx
  on public.franchize_order_notifications (send_status, created_at desc);

alter table public.franchize_order_notifications enable row level security;

-- server-side service-role only table for delivery/audit pipeline
revoke all on public.franchize_order_notifications from anon, authenticated;
