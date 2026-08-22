Purpose
Define plugin boundaries and migration path for proto-plugins.

Tasks
- Convert directories under `/app` (strikeball, bio30, franchize, etc.) into formal plugins.
- For each plugin create:
  - `plugin.ts`
  - `todo.md`
  - `hydration.md`
- Ensure plugin manifests declare dependencies on cores rather than importing files directly.

Constraints
- Plugins must not import other plugins directly.
- Shared functionality belongs in `/core`.