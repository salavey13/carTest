# /app/franchize — convert to extension (OpenClaw style)

Purpose
Turn current proto-franchize into formal extension living under /app/franchize with manifest.

Tasks
- [ ] Create /app/franchize/plugin.ts (manifest: id, capabilities, uses)
- [ ] Add /app/franchize/hydration.md (context, public surface)
- [ ] Add /app/franchize/CONTRACT.md (what API it guarantees)
- [ ] Extract business logic into cores where duplicated (refer to /app/core/todo.md)
- [ ] Add todo.md entries for leftover features (payments, items sync)
- [ ] Minimal UI wrapper: /app/franchize/layout.tsx & page.tsx to register route

Notes
- Do not move files out of /app — keep plugin in place, formalize with manifest.