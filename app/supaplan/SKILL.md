# SupaPlan Agent Skill (runtime)

Runtime server module: `app/supaplan/skill.ts`.

For operator-facing CLI/runbook usage, use local skill:
- `skills/supaplan-supabase-operator/SKILL.md`

## Runtime API

### `supaplan.pick_task(capability, agentId)`

- Uses `supaplan_claim_task` RPC for atomic claim.
- If RPC is unavailable, uses fallback claim sequence:
  1. select first `open` task by capability,
  2. update task to `claimed` guarded by `status = open`,
  3. insert claim into `supaplan_claims`.

### `supaplan.update_status(taskId, status)`

Allowed status writes for agents only:
- `claimed`
- `running`
- `ready_for_pr`

### `supaplan.log_event(type, payload)`

- Inserts into `supaplan_events` with `source: "codex"`.

## Agent loop

1. `pick_task`
2. `update_status(..., "running")`
3. execute task work
4. `log_event("task_progress", ...)`
5. `update_status(..., "ready_for_pr")`

`done` is merge-owned and must not be set by agents.
