---
name: agent-entry
description: Single entrypoint for all AI contributors.
---

# Agent Entry

Welcome.

This repository uses **SupaPlan + Artificial General Iterator**.

**Do NOT** read the entire repo.

Instead:
1. Call `supaplan.pick_task(your_capability)`
2. Go to the returned `todo_path`
3. Read hydration.md + todo.md
4. Execute
5. Update status → ready_for_pr

Rules:
• Respect folder boundaries
• Only SupaPlan can claim tasks (mutex + heartbeat)
• Human merge is the only way a task becomes done
• Prefer small PRs

The repo now grows itself.