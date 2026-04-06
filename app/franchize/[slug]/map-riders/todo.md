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
- [ ] Add `/api/map-riders/batch-points` endpoint and queue-based client flush.
- [ ] Keep `/api/map-riders/location` as fallback with deprecation header.
- [ ] Add stale rider eviction policy in client state (fade then remove).

### I4 — UI porting (slice-by-slice)
- [ ] Introduce provider/reducer from goldmine without breaking current page contract.
- [ ] Port `RiderMarker` + `RiderMarkerLayer` with viewport culling.
- [ ] Port `RidersDrawer`, `RiderFAB`, `StatusOverlay`, `LoadingSkeleton`.

### I5 — QA + rollout
- [ ] Two-phone live test, stale/offline test, meetup persistence test.
- [ ] Screenshot evidence for `vip-bike` slug.
- [ ] Cut final switch: legacy snapshot polling → split APIs + broadcast-first.

## Risks to watch
- Race conditions from mixed snapshot + realtime updates.
- Live locations policy drift between local SQL and production RLS.
- Telegram webview tap reliability when introducing new floating layers.

## Definition of done (port stream)
- Live map remains stable with high rider count.
- Historical/stat flows remain intact (`sessions`, `points`, `meetups`, replay).
- SQL migrations are additive and reviewable in `supabase/migrations/*`.
- SupaPlan + `docs/THE_FRANCHEEZEPLAN.md` reflect actual progress.
