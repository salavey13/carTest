# Using SupaPlan in Codex

When running agents in Codex, use the repo script flow (not pseudo API names):

1. claim task
2. execute scope
3. move status (`running` -> `ready_for_pr`)
4. verify task + claim persistence
5. open PR with task token

## CLI flow

```bash
node scripts/supaplan-skill.mjs inspect-migrations
node scripts/supaplan-skill.mjs pick-task --capability <capability> --agentId <agent_id>
node scripts/supaplan-skill.mjs update-status --taskId <task_id> --status running
# ... implement changes ...
node scripts/supaplan-skill.mjs update-status --taskId <task_id> --status ready_for_pr
node scripts/supaplan-skill.mjs task-status --taskId <task_id>
```

Verification checklist:
- `supaplan_tasks.status` is `ready_for_pr`
- at least one row exists in `supaplan_claims` for the task
- PR title includes `supaplan_task:<task_id>`
- PR description includes a standalone line: `supaplan_task: <task_id>`

`supaplan-skill.mjs` has REST fallback for environments where JS fetch fails.
