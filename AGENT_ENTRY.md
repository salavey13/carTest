# Agent Entry — SupaPlan + Artificial General Iterator

Welcome, AI contributor.

This repository now uses **SupaPlan** as the single source of truth for tasks.

Do NOT read the entire repository.

Instead:

1. Start with AI_MAP.md
2. Call supaplan.pick_task(your_capability) — it returns the next task + todo_path
3. Read the linked todo.md for context
4. Execute
5. Update status → ready_for_pr
6. Open small PR (include “supaplan_task:<id>” in description)

Rules:
• Respect folder boundaries
• Only SupaPlan can claim tasks (mutex + heartbeat)
• Human merge is the only way a task becomes done
• Prefer small PRs

The repo now grows itself through SupaPlan.