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
- [x] Add heading indicator + smooth marker interpolation to reduce "teleport" jumps on rider updates.
- [ ] Two-phone live test, stale/offline test, meetup persistence test.
- [ ] Screenshot evidence for `vip-bike` slug.
- [ ] Cut final switch: legacy snapshot polling → split APIs + broadcast-first.

### I6 — Production-hardening backlog (new)
- [ ] Privacy controls: visibility mode (`crew/public`) + home-blur option + auto-expire presets (1/5/15/60).
- [ ] Route replay full-screen UI with timeline scrubber.
- [ ] Speed-gradient route polyline rendering (segment color by speed).
- [ ] Long-press meetup creation mode (keep tap safe for exploration UX).
- [x] Realtime ordering guardrails (drop stale/out-of-order move packets).
- [x] Anti-spoof sanity checks for impossible speed/location jumps.

### I6.1 — Screenshot + demo artifacts (new)
- [x] Add screenshot policy note: for PR evidence use browser-container/playwright artifacts, avoid committing binary screenshots; `scripts/page-screenshot-skill.mjs` is fallback for public one-off capture only.
- [ ] Capture and attach one "live map with riders" screenshot and one "drawer+leaderboard" screenshot.

## AGI gold port review notes (I1→I5)
- ✅ Preserved contract-first order from goldmine (`overview`/`leaderboard`/`health` + legacy compatibility).
- ✅ Preserved write-path hardening (`batch-points`, queue flush, stale/eviction state machine).
- ✅ Preserved modular UI slices (provider/reducer, drawer/FAB/overlay layers).
- 🔍 Gap closed in this iteration: low-zoom clustering now shows explicit aggregate markers (instead of rendering only first rider in cell).
- 🔍 Gap closed in this iteration: marker accessibility metadata (title/alt/keyboard) now provided for screen-reader/keyboard-friendly map interaction.

## Next SupaPlan seed (post-I5)
- `MapRiders I5 field QA evidence pack` — execute two-phone stale/offline + meetup persistence run and attach `vip-bike` screenshots + short failure matrix. (SupaPlan task: `492d4564-1f97-4b49-b61f-a979bc4019fb`)

## Next SupaPlan seed (I6 production hardening)
- `MapRiders I6 privacy controls + auto-expire presets` — add visibility mode + home blur + auto-expire presets and enforce in write APIs. (SupaPlan task: `3edabd9c-6f88-4491-aa31-2f11566e3059`)
- `MapRiders I6 route replay full-screen scrubber UI` — ship full-screen replay panel + scrubber + play/pause. (SupaPlan task: `b2fb8b78-dc2d-4913-b379-caf22eb1c4e5`)
- `MapRiders I6 speed-gradient route visualization` — render speed-colored polyline segments on replay/live detail. (SupaPlan task: `92b48f2c-9c24-451e-bd4e-7cc761a7fc68`)
- `MapRiders I6 realtime ordering + anti-spoof guardrails` — ✅ implemented in reducer: monotonic packet filtering + unrealistic jump reject guard. (SupaPlan task: `2d2c9b4a-ca83-4f41-9bf6-75f7bc475830`)
- `MapRiders I6 two-phone QA + screenshot evidence pack (vip-bike)` — two-phone pass with stale/offline/meetup persistence matrix + screenshot pack. (SupaPlan task: `e9c8f76f-0863-4f20-a871-6a09dd3bf7f8`)

## Risks to watch
- Race conditions from mixed snapshot + realtime updates.
- Live locations policy drift between local SQL and production RLS.
- Telegram webview tap reliability when introducing new floating layers.

## Investigation notes (2026-04-17)
- Reviewed Telegram-first location flow end-to-end:
  - `useLiveRiders` tries `WebApp.requestLocation` first, then falls back to browser geolocation.
  - Prior implementation could return `false` too early when Telegram only delivers async callback later.
  - Updated hook to wait briefly for callback-mode `requestLocation` responses before fallback.
- Confirmed webhook ingestion path:
  - regular location comes in `update.message.location`,
  - live location updates come in `update.edited_message.location`.
  - We now process `edited_message.location` again in `app/api/telegramWebhook/route.ts` so repeated Telegram live-location updates are ingested.
- Rentals availability warning root cause:
  - `getFranchizeBySlug` queried non-existent `rentals.end_date`;
  - switched to `requested_end_date` fallback with `agreed_end_date` priority.
- Remaining checklist status:
  - I5/I6 still have open field QA + screenshot evidence tasks; these are still pending and were not auto-closed in this patch.

## Definition of done (port stream)
- Live map remains stable with high rider count.
- Historical/stat flows remain intact (`sessions`, `points`, `meetups`, replay).
- SQL migrations are additive and reviewable in `supabase/migrations/*`.
- SupaPlan + `docs/THE_FRANCHEEZEPLAN.md` reflect actual progress.
