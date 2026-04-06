# MapRiders — Goldmine Porting Backlog

## Mission
Port AGI handoff from `./goldmine` into production `MapRiders` in controlled iterations:
- keep current user-visible flow stable,
- ship additive migrations only,
- reduce live-load pressure for 100+ riders,
- track every slice in SupaPlan + FrancHeeze diary.

## What was analyzed in iteration 1 (2026-04-06)
- Goldmine implementation artifacts: reducer/context/hooks/components (`MapRidersClientRefactored.tsx`, `useMapRidersContext.tsx`, `useLiveRiders.ts`, marker/drawer/FAB overlays).
- AGI progress + changelog: `goldmine/PROGRESS.md`, `goldmine/CHANGELOG.md`.
- Deep research synthesis: `goldmine/mr_MEGA.md`, `goldmine/mr_gpt.md`, `goldmine/mr_grok.txt`, `goldmine/mr_qwen.txt`, `goldmine/mr_mimo*.txt`.
- Design spec `.docx`: `goldmine/MapRiders_Design_Document_v2_zai.docx`.

## Porting principles (agreed)
1. **Contract-first:** stabilize DB/API contract before swapping UI tree.
2. **No destructive SQL:** convert AGI SQL to idempotent Supabase migrations.
3. **Split snapshot API:** `/overview`, `/leaderboard`, `/health` to avoid full refetch storms.
4. **Local-first live state:** merge broadcast by `updated_at`; reject stale packets.
5. **Telegram-safe UX:** preserve SPA taps + avoid overlay pointer-event traps.

## Iteration plan

### I1 — Analysis + contract prep (done)
- [x] Analyze goldmine + deep research corpus.
- [x] Create migration draft for live layer + weekly leaderboard read model.
- [x] Create SupaPlan task decomposition for phased port.

### I2 — Backend contract (next)
- [x] Add `/api/map-riders/overview` (sessions + meetups + live locations).
- [x] Add `/api/map-riders/leaderboard` (read from materialized/aggregation view).
- [x] Add `/api/map-riders/health` (ops counters + freshness).
- [x] Keep legacy `/api/map-riders` endpoint backward-compatible during transition.

### I3 — Write-path hardening
- [x] Add `/api/map-riders/batch-points` endpoint and queue-based client flush.
- [x] Keep `/api/map-riders/location` as fallback with deprecation header.
- [x] Add stale rider eviction policy in client state (fade then remove).

### I4 — UI porting (slice-by-slice)
- [x] Introduce provider/reducer from goldmine without breaking current page contract.
- [x] Port `RiderMarker` + `RiderMarkerLayer` with viewport culling.
- [x] Port `RidersDrawer`, `RiderFAB`, `StatusOverlay`, `LoadingSkeleton`.
- [x] Replace cluster TODO fallback (first rider only) with explicit cluster markers + tap-to-zoom drill-down.

### I5 — QA + rollout
- [x] Add repeatable smoke-check script for page + split API routes (`npm run qa:map-riders`).
- [x] Add accessibility polish on map markers (`title/alt/keyboard`) to align with deep-research a11y checklist.
- [ ] Two-phone live test, stale/offline test, meetup persistence test.
- [ ] Screenshot evidence for `vip-bike` slug.
- [ ] Cut final switch: legacy snapshot polling → split APIs + broadcast-first.

## AGI gold port review notes (I1→I5)
- ✅ Preserved contract-first order from goldmine (`overview`/`leaderboard`/`health` + legacy compatibility).
- ✅ Preserved write-path hardening (`batch-points`, queue flush, stale/eviction state machine).
- ✅ Preserved modular UI slices (provider/reducer, drawer/FAB/overlay layers).
- 🔍 Gap closed in this iteration: low-zoom clustering now shows explicit aggregate markers (instead of rendering only first rider in cell).
- 🔍 Gap closed in this iteration: marker accessibility metadata (title/alt/keyboard) now provided for screen-reader/keyboard-friendly map interaction.

## Next SupaPlan seed (post-I5)
- `MapRiders I5 field QA evidence pack` — execute two-phone stale/offline + meetup persistence run and attach `vip-bike` screenshots + short failure matrix. (SupaPlan task: `492d4564-1f97-4b49-b61f-a979bc4019fb`)

## Risks to watch
- Race conditions from mixed snapshot + realtime updates.
- Live locations policy drift between local SQL and production RLS.
- Telegram webview tap reliability when introducing new floating layers.

## Definition of done (port stream)
- Live map remains stable with high rider count.
- Historical/stat flows remain intact (`sessions`, `points`, `meetups`, replay).
- SQL migrations are additive and reviewable in `supabase/migrations/*`.
- SupaPlan + `docs/THE_FRANCHEEZEPLAN.md` reflect actual progress.
