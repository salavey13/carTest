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
node scripts/supaplan-skill.mjs pick-task --capability <real_capability_from_inspect> --agentId <agent_id>
node scripts/supaplan-skill.mjs update-status --taskId <task_id> --status running
# ... implement changes ...
node scripts/supaplan-skill.mjs update-status --taskId <task_id> --status ready_for_pr
node scripts/supaplan-skill.mjs task-status --taskId <task_id>
```

Notes:
- `inspect-migrations` now includes capability discovery from live `supaplan_tasks` rows in Supabase (JS client first, REST fallback second). It is not limited to seed migration files.
- Pick `--capability` only from the capabilities shown there; do not invent one manually.
- If notification context exists, use `node scripts/codex-notify.mjs ...` instead of skipping notification behavior. If context is missing, say so explicitly.
- If the change is visual or easier to validate with an image, capture a screenshot proactively with the available screenshot/browser tooling.
- Prefer repo-provided scripts/skills before manual workarounds whenever they already cover the workflow.
- Treat `vip-bike`, `vip bike`, `franchize`, and `FRANCHEEZEPLAN` as the same client/teammate stream unless the operator explicitly separates them.

Verification checklist:
- `supaplan_tasks.status` is `ready_for_pr`
- at least one row exists in `supaplan_claims` for the task
- PR title includes `supaplan_task:<task_id>`
- PR description includes a standalone line: `supaplan_task: <task_id>` (mandatory for merge parser, must be explicit)

`supaplan-skill.mjs` has REST fallback for environments where JS fetch fails.
