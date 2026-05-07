# Franchize tests changelog / archive

## 2026-05-07 — Server action validation tests
- Added mocked Supabase validation coverage for focused franchize server actions.
- Covered empty crew availability slugs, malformed XTR invoice payloads, malformed promo payloads, and invalid rental availability date ranges.

## Earlier foundation slice
- Added Vitest coverage for `app/franchize/lib/navigation.ts` helper behavior, including trimmed category anchors.
- Added Vitest coverage for `app/franchize/lib/theme.ts` palette-to-style helpers and variant cycling.
