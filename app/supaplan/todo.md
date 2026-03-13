# SupaPlan Extension — coordination brain for the entire repo

Purpose
Turn GitHub + Supabase into a distributed execution system for AI agents (autoresearch style, zero GPU).

## Iterator Instructions (now active)
Goal: Keep the whole repo self-iterating.
- On any “новый уровень” or genie-lamp trigger → pick_task from SupaPlan.
- Execute → ready_for_pr.
- GitHub Action on merge → done.

Phase 1 — Core extension (already seeded)
- [x] Database schema (supaplan_tasks, claims, events)
- [x] Atomic claim RPC
- [x] Server actions (claimTask, heartbeat, updateTaskStatus, logEvent)
- [x] UI: /app/supaplan/page.tsx + StatusClient.tsx (realtime)
- [x] Seed tasks from all local todo.md files

Phase 2 — Agent integration (iterator live)
- [x] Codex SKILL.md + full skill contract (pick_task, update_status, log_event)
- [ ] Heartbeat + auto-release on expiry
- [ ] Task progress events + Telegram notifications
- [x] ready_for_pr state + merge workflow

Phase 3 — Observability & scaling
- [ ] Markdown export / snapshot
- [ ] Advanced dashboards (agents, throughput, claims)
- [ ] Agent leasing (multiple agents in parallel on different capabilities)

Notes
- Agents may only set status up to ready_for_pr.
- Human merge is the only way a task becomes done.
- Every other todo.md (greenbox, franchize, core, etc.) is now a mirror — SupaPlan is the single source of truth.