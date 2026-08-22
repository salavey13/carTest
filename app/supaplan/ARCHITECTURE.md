# SupaPlan Architecture

SupaPlan consists of three layers.

## Coordination layer

Supabase tables:

supaplan_tasks  
supaplan_claims  
supaplan_events

RPC:

supaplan_claim_task()

This ensures atomic task locking.

---

## Execution layer

GitHub repository.

Agents modify files and open PRs.

Human merge is the final confirmation.

---

## Interface layer

/app/supaplan page

Realtime dashboard of tasks.

---

# Design principles

Minimal state machine.

Atomic claim.

Human merge authority.

Agent autonomy.