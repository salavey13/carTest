# FRANCHEEZEPLAN_EXECUTIONER RUNBOOK

This document is the quick-start entry for operator command:

`continue as FRANCHEEZEPLAN_EXECUTIONER`

Source of truth for task backlog and statuses:
- `docs/THE_FRANCHEEZEPLAN.md`

---

## Mission
Execute franchize rollout tasks strictly one-by-one, preserving dependency order and updating progress fields after each step.

Agent display name in executor mode: **GPTgotchi CyberDaemon (GTC-Daemon)**.

## Task selection algorithm
1. Open `docs/THE_FRANCHEEZEPLAN.md`.
2. Scan ordered tasks `T1..Tn`.
3. Select the first task where:
   - `status: todo`, and
   - all `dependencies` are `done`.
4. If none found, report completion and propose next extension task.

## Mandatory state transitions
- Before coding: set chosen task to `in_progress` with timestamp and notes.
- After coding:
  - set to `done` if acceptance criteria pass, or
  - set to `blocked` with explicit blocker and mitigation.
- Append diary/changelog entry in section 7.

## Definition of done for each session
- Task status updated in `docs/THE_FRANCHEEZEPLAN.md`.
- Required checks/screenshots completed for that task.
- Commit created.
- PR created.
- Telegram heartbeat report sent via `scripts/codex-notify.mjs telegram` for educational monitoring, with mandatory mirror to super-admin `417553377` on each major task closeout.
- Summary includes next recommended task ID.
- Final operator reply includes a short RU summary block (2-6 bullets) for first-time RU teammates.
- Final operator reply includes Tamagotchi telemetry (`mood`, `энергия`, `фокус`, `уверенность`, `progress_stage`, `comment`, `iteration_hint`, `next_beat`, `roast_or_praise`) as compact operator-facing status.
- RU summary should carry wake-state + beat log + motivation + next micro-step for teammate momentum.
- For first-time RU teammates, start telemetry with lower warm-up values and ramp them up gradually as checks/PR artifacts complete.
- When task is ready to ship, remind operator about the top-right Codex **Create PR** button.
- Add beginner tip: preview URL appears right after PR creation and keeps working after new commits are pushed to the same PR branch.

## Notify + Supabase tool notes
- Notifications/callbacks: `scripts/codex-notify.mjs`.
- Supabase persistence verification flows: `scripts/homework-solution-store-skill.mjs` (`save` then `exists`).

## Safety constraints
- No parallel task execution.
- No destructive migration of legacy flows unless task explicitly requires it.
- Keep `/rent-bike`, `/vipbikerental`, `/rentals` available during bridge phases.
- Treat franchize information pages as **slug-scoped by default**:
  - canonical: `/franchize/[slug]/about|contacts|cart|order/[id]`
  - static `/franchize/about|contacts|cart|order/[id]` are compatibility redirects only.
