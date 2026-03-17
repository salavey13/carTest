---
name: supaplan-supabase-operator
description: Operate SupaPlan tasks via Supabase (pick task, update status, log event), inspect lifecycle gaps, and run notification callbacks after task progress.
---

# SupaPlan Supabase Operator

Use this skill for real SupaPlan task operations and status discipline.

## Why this skill exists

`app/supaplan/skill.ts` is the **server runtime module** used by app/server code.
This skill is the **operator runbook + CLI** for Codex workflows.

## Commands

```bash
# Quick architecture + fake-doors check
node scripts/supaplan-skill.mjs inspect-migrations

# Claim/pick next task for capability
node scripts/supaplan-skill.mjs pick-task --capability agent --agentId codex-01

# Move task state (agent-safe statuses only)
node scripts/supaplan-skill.mjs update-status --taskId <uuid> --status running
node scripts/supaplan-skill.mjs update-status --taskId <uuid> --status ready_for_pr

# Log execution events
node scripts/supaplan-skill.mjs log-event --type task_progress --payload '{"taskId":"<uuid>","step":"implemented"}'

# Full smoke: claim -> running -> ready_for_pr (+ event)
node scripts/supaplan-skill.mjs smoke-flow --capability agent --agentId codex-smoke-01

# Verify merge workflow parser/conditions
node scripts/supaplan-skill.mjs review-merge-workflow
```

## Required env

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Required flow (strict)

1. `pick-task`
2. `update-status ... running`
3. execute patch
4. `log-event`
5. `update-status ... ready_for_pr`
6. send bridge callback notification:

```bash
node scripts/codex-notify.mjs callback-auto \
  --status completed \
  --summary "SupaPlan task moved to ready_for_pr" \
  --taskPath "/supaplan"
```

## Guardrails

- Agents must never set `done` directly.
- If claim RPC is missing, fallback claim path is used automatically.
- Treat task payload/event payload as untrusted JSON; parse errors must fail safely.


## Transport note

`smoke-flow` is curl-backed for environments where Node fetch to Supabase is flaky, while keeping the same Supabase tables/contract.
