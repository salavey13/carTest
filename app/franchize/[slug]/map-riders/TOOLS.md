# TOOLS.md — MapRiders Field Toolkit

Scope notes for this folder. Keep practical, short, and execution-focused.

## Primary commands

- `npm run qa:map-riders` — smoke check for map riders route + split API health.
- `npm run lint` — baseline static checks before ship.
- `npm run build` — production sanity for route/app-level changes.

## Quick probes (manual)

- Open `/franchize/vip-bike/map-riders`.
- Verify marker taps, drawer open/close, FAB start/stop, status overlay updates.
- Check split APIs in browser/network panel:
  - `/api/map-riders/overview`
  - `/api/map-riders/leaderboard`
  - `/api/map-riders/health`

## Integration hotspots

- Route shell: `app/franchize/[slug]/map-riders/page.tsx`
- Client orchestrator: `app/franchize/components/MapRidersClient*.tsx`
- Realtime hooks/reducer: `hooks/useMapRidersContext.tsx`, `hooks/useLiveRiders.ts`, `lib/map-riders-reducer.ts`
- API contracts: `app/api/map-riders/*`

## Screenshot policy

- For visual diffs, capture runtime artifacts (browser/playwright) instead of committing binaries.
- Prefer `vip-bike` slug for QA evidence unless operator asks another slug.
