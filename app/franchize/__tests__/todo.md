# Franchize test coverage foundation

Status: `ready_for_pr`
Task: `RENT-P3.2: Test coverage foundation for key server actions`

## Implemented in this slice

- Added Vitest coverage for `app/franchize/lib/navigation.ts` helper behavior, including trimmed category anchors.
- Added Vitest coverage for `app/franchize/lib/theme.ts` palette-to-style helpers and variant cycling.

## Next slices

- Add mocked Supabase tests for server action input validation.
- Add promo-code validation tests after `RENT-P1.2` replaces the UI stub with real logic.
- Add CI enforcement once coverage thresholds are stable across the existing suite.
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
