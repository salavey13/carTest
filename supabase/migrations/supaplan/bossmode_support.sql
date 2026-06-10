-- BOSS mode support for multi-agent SupaPlan
-- Adds fields for direct commit workflow and agent tracking

-- Add tracking fields for BOSS mode completion
alter table supaplan_tasks
  add column if not exists completed_by text,
  add column if not exists completed_at timestamptz;

-- Add index for completed_by queries
create index if not exists supaplan_tasks_completed_by_idx
  on supaplan_tasks(completed_by)
  where completed_by is not null;

-- Add index for agent activity tracking
create index if not exists supaplan_claims_agent_idx
  on supaplan_claims(agent_id);

-- Add cheatcode metadata support
-- The metadata jsonb field already exists, but let's add a comment
comment on column supaplan_tasks.metadata is 'Task metadata including cheatcode flag, agent preferences, and workflow hints';

-- Add function to get agent activity stats
create or replace function supaplan_agent_stats(p_agent text)
returns json
language plpgsql
as $$
declare
  v_stats json;
begin
  select json_build_object(
    'agent_id', p_agent,
    'tasks_claimed', (
      select count(*)
      from supaplan_claims
      where agent_id = p_agent
    ),
    'tasks_completed', (
      select count(*)
      from supaplan_tasks
      where completed_by = p_agent
    ),
    'last_claim', (
      select max(claimed_at)
      from supaplan_claims
      where agent_id = p_agent
    ),
    'last_completion', (
      select max(completed_at)
      from supaplan_tasks
      where completed_by = p_agent
    )
  )
  into v_stats;

  return v_stats;
end;
$$;

-- Add function to get parallel work status (detect potential conflicts)
create or replace function supaplan_parallel_work_check()
returns table (
  capability text,
  running_count bigint,
  running_agents text[]
)
language plpgsql
as $$
begin
  return query
  select
    t.capability,
    count(distinct t.id) as running_count,
    array_agg(distinct c.agent_id) as running_agents
  from supaplan_tasks t
  join supaplan_claims c on c.task_id = t.id
  where t.status = 'running'
  group by t.capability
  order by running_count desc;
end;
$$;
