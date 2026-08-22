# SupaPlan State Audit (2026-03)

## Proposed idea (target)

SupaPlan should coordinate many agents through one source of truth:
- Supabase = task/claim/event state machine
- GitHub = execution + PR merge authority
- Agents = claim -> run -> ready_for_pr
- Merge workflow = only entity that sets `done`

Lifecycle contract:
`open -> claimed -> running -> ready_for_pr -> done`

## Current status

### Working now

- Core tables exist: `supaplan_tasks`, `supaplan_claims`, `supaplan_events`, `supaplan_agents`.
- Atomic claim RPC exists: `supaplan_claim_task`.
- App/server runtime API exists in `app/supaplan/skill.ts`.
- UI visibility exists in `/app/supaplan` dashboard files.
- Task seeds from todo surfaces exist in `supabase/migrations/supaplan/seed_*.sql`.

### Partial / pending

- Heartbeat lifecycle is not fully wired end-to-end in app flow.
- Merge-to-done automation needs explicit workflow wiring in repo execution path.
- Agent runbook/CLI needed a practical local skill package for Codex operations.

## Fake doors found (and fixed)

1. `cleanup_stale_function.sql` referenced non-existent fields/state values:
   - `pending`, `claimed_by`, `heartbeat`, `in_progress`.
2. Existing schema uses:
   - task statuses: `open|claimed|running|ready_for_pr|done`
   - heartbeat fields on `supaplan_claims`: `last_heartbeat`, `ttl_seconds`.
3. File was rewritten to a schema-correct stale-release function:
   - expire stale claims
   - reopen claimed/running tasks to `open`
   - return number of released tasks.

## Operating recommendation

Use this deterministic loop:
1. `pick-task`
2. `update-status running`
3. patch/commit
4. `log-event`
5. `update-status ready_for_pr`
6. send callback notification

This is now captured in `skills/supaplan-supabase-operator/SKILL.md` and `scripts/supaplan-skill.mjs`.


## First live smoke evidence

Validated with `scripts/supaplan-skill.mjs smoke-flow --capability agent --agentId codex-smoke-01`:
- task `d4d41ce0-bb81-4c94-936d-27fc17c39fb3` moved `open -> claimed -> running -> ready_for_pr`,
- claim row inserted in `supaplan_claims`,
- progress event inserted in `supaplan_events` (`type=task_progress`, `source=codex-smoke`).

This confirms first-run SupaPlan loop works against real Supabase data.
