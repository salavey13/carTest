# Franchize test TODO

## Current status
- Status: `in_progress`
- Owner: Codex / franchize quality lane
- Pure helper coverage exists for navigation/theme helpers.
- Mocked Supabase validation coverage now exists for key franchize server actions.
- Archive/changelog: `app/franchize/__tests__/CHANGELOG.md`.

## Next action
- Add promo-code happy-path and inactive/expired-code tests with mocked crew metadata.
- Add deeper server-action persistence tests once payment/items-sync contracts stabilize.
- Add CI enforcement once coverage thresholds are stable across the existing suite.

## Blockers
- Promo-code production logic should be finalized before locking broad fixtures.
- Full-suite CI enforcement is blocked by unrelated existing Vitest/typecheck failures outside this slice.
