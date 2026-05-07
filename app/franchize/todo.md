# /app/franchize TODO

## Current status
- Status: `in_progress`
- Owner: Codex / franchize integration lane
- Franchize is a formal app plugin with manifest, contract, hydration docs, slug routes, and stable compatibility exports.
- Public server actions now route through focused server-only modules while preserving `app/franchize/actions.ts` imports.
- Archive/changelog: `app/franchize/CHANGELOG.md`.

## Next action
- Continue extracting duplicated business logic into shared cores where it is reused outside franchize.
- Add focused TODO entries for remaining payments/items-sync work only when those scopes become active.
- Add or finish a minimal wrapper route registration if plugin registry wiring requires it.

## Blockers
- Core extraction depends on stable shared contracts in `/app/core`.
- Live payment/items-sync verification requires configured Supabase and Telegram runtime credentials.

## Links
- Plugin manifest: `app/franchize/plugin.ts`
- Public contract: `app/franchize/CONTRACT.md`
- Hydration notes: `app/franchize/hydration.md`
- Core extraction tracker: `app/core/todo.md`
