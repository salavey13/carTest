# Franchize test coverage foundation

Status: `in_progress`
Task: `RENT-P3.2: Test coverage foundation for key server actions`

## Implemented in this slice

- Added Vitest coverage for `app/franchize/lib/navigation.ts` helper behavior.
- Added Vitest coverage for `app/franchize/lib/theme.ts` palette-to-style helpers and variant cycling.

## Next slices

- Add mocked Supabase tests for server action input validation.
- Add promo-code validation tests after `RENT-P1.2` replaces the UI stub with real logic.
- Add CI enforcement once coverage thresholds are stable across the existing suite.
