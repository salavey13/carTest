---
name: agent-entry
description: Single entrypoint for all AI contributors.
---

# Agent Entry

Welcome.

This repository uses **SupaPlan + Artificial General Iterator**.

**Do NOT** read the entire repo.

Instead:
1. Call `node scripts/supaplan-skill.mjs pick-task --capability <your_capability> --agentId <agent_id>`
2. Go to the returned `todo_path`
3. Read hydration.md + todo.md
4. Execute
5. Update status → running → ready_for_pr
6. Verify both:
   - `node scripts/supaplan-skill.mjs task-status --taskId <task_id>`
   - claim row exists in `supaplan_claims` for `<task_id>`

If JS client fetch fails in this environment, use the same script commands (they now auto-fallback to REST).

Rules:
• Respect folder boundaries
• Only SupaPlan can claim tasks (mutex + heartbeat)
• Human merge is the only way a task becomes done
• Prefer small PRs

The repo now grows itself.
