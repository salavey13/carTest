create extension if not exists "pgcrypto";

create table supaplan_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  todo_path text,
  plugin text,
  capability text,
  status text not null default 'open',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb,
  pr_url text null
);

create table supaplan_claims (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references supaplan_tasks(id) on delete cascade,
  agent_id text not null,
  claim_token text not null,
  status text not null default 'claimed',
  claimed_at timestamptz default now(),
  last_heartbeat timestamptz default now(),
  ttl_seconds integer default 300
);

create table supaplan_events (
  id bigserial primary key,
  created_at timestamptz default now(),
  source text,
  type text,
  payload jsonb
);

create table supaplan_agents (
  id text primary key,
  capabilities text[],
  last_seen timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

create index supaplan_tasks_status_idx
on supaplan_tasks(status);

create index supaplan_claims_task_idx
on supaplan_claims(task_id);

create index supaplan_claims_heartbeat_idx
on supaplan_claims(last_heartbeat);
