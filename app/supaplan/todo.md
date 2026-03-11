# SupaPlan Extension

SupaPlan is a minimal orchestration system for coordinating AI agents working on a repository.

It converts GitHub + Supabase into a distributed execution system.

Supabase = coordination brain  
GitHub = execution substrate

---

# Task lifecycle

open → claimed → running → ready_for_pr → done

Agents may only move tasks forward.

Human merge is the only way a task becomes **done**.

---

# Phase 1 — Core extension

## TASK: SupaPlan migration

Create database schema for:

supaplan_tasks  
supaplan_claims  
supaplan_events

Implement atomic claim RPC.

---

## TASK: SupaPlan status page

Create:

/app/supaplan/page.tsx  
/app/supaplan/StatusClient.tsx

Page must show realtime task list.

---

## TASK: SupaPlan server actions

Create server actions:

claimTask  
updateTaskStatus  
logEvent

Use supabaseAdmin.

---

# Phase 2 — Agent integration

## TASK: Codex skill contract

Define minimal agent API:

supaplan.pick_task(capability)  
supaplan.update_status(task_id,status)  
supaplan.log_event(type,payload)

Document in SKILL.md.

---

## TASK: Agent heartbeat

Add heartbeat mechanism.

If claim heartbeat expires → release task.

---

## TASK: Task progress events

Allow agents to log progress events to supaplan_events.

---

# Phase 3 — GitHub integration

## TASK: Merge workflow

Create:

.github/workflows/supaplan-merge.yml

Workflow should:

1 detect merged PR  
2 read task id from PR description  
3 update supaplan_tasks.status → done

---

## TASK: ready_for_pr state

Agents must move tasks to:

ready_for_pr

before human opens PR.

---

# Phase 4 — Observability

## TASK: Telegram notifications

Send task status changes to Telegram.

---

## TASK: Markdown export

Allow exporting tasks into markdown.

---

## TASK: Advanced dashboards

Show:

agents  
active claims  
task throughput