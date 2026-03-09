Purpose
Split core logic into focused modules and remove monolithic files.

Tasks
- Identify monolithic files such as `/app/actions.ts`.
- Split them into domain-specific action modules:
  - `/app/core/telegram_actions.ts`
  - `/app/core/supabase_actions.ts`
  - `/app/core/garden_actions.ts`
- Ensure each action module exports only server actions related to its domain.
- Add index file `/app/core/index.ts` that re-exports core actions.

Constraints
- Do NOT introduce cross-dependencies between action modules.
- Shared utilities must move to `/infrastructure/utils`.