# /app/core — refactor core actions and shared logic

Purpose
Split monolithic server/client logic into focused, agent-friendly cores.

Goals
- Move business/server actions from monolith into small domain modules under /app/core.
- Each module has hydration.md, todo.md, CONTRACT.md.

Tasks (priority order)
- [ ] Extract /app/actions.ts -> /app/core/supabase_actions.ts (DB helpers, migrations)
- [ ] Extract telegram-specific logic -> /app/core/telegram_actions.ts (sendMessage wrapper)
- [ ] Create /app/core/garden_actions.ts (createGarden, seedGarden, plant updates)
- [ ] Add /app/core/index.ts to re-export all core actions as named exports
- [ ] Move shared utilities -> /infrastructure/utils (date/uuid/logging)
- [ ] Add hydration.md and CONTRACT.md for core (describe public stable API)
- [ ] Add tests / simple smoke actions (server-side tests)

Notes
- Cores must NOT import plugin internals.
- Keep functions small & well typed for Codex consumption.