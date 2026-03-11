create or replace function supaplan_claim_task(
  p_capability text,
  p_agent text
)
returns json
language plpgsql
as $$
declare
  v_task supaplan_tasks;
  v_claim supaplan_claims;
begin

  select *
  into v_task
  from supaplan_tasks
  where status = 'open'
  and capability = p_capability
  order by created_at
  for update skip locked
  limit 1;

  if v_task.id is null then
    return json_build_object('task', null);
  end if;

  update supaplan_tasks
  set status = 'claimed',
      updated_at = now()
  where id = v_task.id;

  insert into supaplan_claims (
    task_id,
    agent_id,
    claim_token
  )
  values (
    v_task.id,
    p_agent,
    gen_random_uuid()::text
  )
  returning *
  into v_claim;

  return json_build_object(
    'task', row_to_json(v_task),
    'claim', row_to_json(v_claim)
  );

end;
$$;