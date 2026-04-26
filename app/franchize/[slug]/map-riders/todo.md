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
- [x] Privacy controls: visibility mode (`crew/public`) + home-blur option + auto-expire presets (1/5/15/60).
- [ ] Route replay full-screen UI with timeline scrubber.
- [ ] Speed-gradient route polyline rendering (segment color by speed).
- [ ] Long-press meetup creation mode (keep tap safe for exploration UX).
- [x] Write API hardening: CSRF-style guards (`Authorization` + `Origin` + `X-Requested-With`) and per-user in-memory rate limits for session/meetups/batch writes.
- [x] Auth compatibility fix: write API guard now accepts Supabase bearer **and** app JWT (`/api/auth/jwt`) so Telegram-only sessions continue to write map events.
- [x] Telegram-safe meetup dialogs: replaced native `window.prompt/window.confirm` in MapRiders flow with custom franchize modals.
- [x] Realtime ordering guardrails (drop stale/out-of-order move packets).
- [x] Anti-spoof sanity checks for impossible speed/location jumps.

### I6.1 — Screenshot + demo artifacts (new)
- [x] Add screenshot policy note: for PR evidence use browser-container/playwright artifacts, avoid committing binary screenshots; `scripts/page-screenshot-skill.mjs` is fallback for public one-off capture only.
- [x] Capture and attach one "live map with riders" screenshot and one "drawer+leaderboard" screenshot.



### I5 field QA evidence run (2026-04-23)

| Проверка | Статус | Доказательство | Комментарий |
|---|---|---|---|
| Smoke route + split APIs (`vip-bike`) | ✅ PASS | `npm run qa:map-riders` (все 200) | Проверены `/franchize/vip-bike/map-riders`, `/api/map-riders/overview`, `/leaderboard`, `/health`, legacy `/api/map-riders`. |
| Скриншот live map (`vip-bike`) | ✅ PASS | `artifacts/map-riders-vip-bike-i5.png` | Получен fallback-движком `thum.io` после падения Playwright из-за системных библиотек в раннере. |
| Two-phone live + stale/offline + meetup persistence | ⚠️ BLOCKED (env) | N/A | В текущем CI/CLI окружении недоступны две Telegram-мобилки и ручные действия в WebApp; вынесено в отдельный полевой прогон. |
| Screenshot drawer + leaderboard | ⚠️ BLOCKED (env) | N/A | Для этого нужен интерактивный UI прогон (открыть drawer на мобильном), невозможен через headless smoke без пользовательского взаимодействия. |

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
  - Added tap-first meetup fallback UX: selected map point now has quick `+` publish action, so meetup creation no longer depends only on long-press behavior in Telegram WebApp.
  - Added migration slice for Supabase `maps.points_of_interest`: replaced river-point defaults, synced VIP base with active demo rider location, and appended `Площадь Комсомольская 2` as third default meetup point.

## Investigation notes (2026-04-24)
- Completed privacy hardening slice for SupaPlan `3edabd9c-6f88-4491-aa31-2f11566e3059`:
  - Added rider privacy controls in UI: visibility mode, auto-expire presets (1/5/15/60), home-blur toggle, pause/resume sharing.
  - Wired privacy payload from client GPS pipeline into `/api/map-riders/batch-points` and fallback `/api/map-riders/location`.
  - Added server-side expire enforcement: expired sessions auto-stop and return 409 to client writes.
  - Added location blur transform when home-blur is enabled and persisted privacy metadata in session stats.

## Investigation notes (2026-04-26)
- SupaPlan task `e9c8f76f-0863-4f20-a871-6a09dd3bf7f8` (I6.1 evidence pack) progressed with fresh `vip-bike` smoke + screenshot refresh:
  - Re-ran `npm run qa:map-riders` with PASS for route + split APIs + legacy endpoint.
  - Captured `artifacts/map-riders-vip-bike-i6-live-map.png`.
  - Captured `artifacts/map-riders-vip-bike-i6-drawer-leaderboard.png`.
  - Playwright engines (Chromium/Firefox/WebKit) failed in runner because system browser libs are missing; fallback `thum.io` capture succeeded for both artifacts.
- SupaPlan task batch (code-quality/perf/a11y):
  - `d8b4e4e7-8234-4b8d-2345-88880008f345`: meetup creation deduped into shared hook `useMeetupCreator`.
  - `da6d6a09-0234-4ade-4567-aaa000aaf567`: GPS race mitigated with source lock (`telegram`/`browser`) + source-switch debounce.
  - `db7e7b1a-1234-4bef-5678-bbb000bbf678`: drawer got dialog semantics, reduced-motion handling, and keyboard focus-trap behavior.

## Definition of done (port stream)
- Live map remains stable with high rider count.
- Historical/stat flows remain intact (`sessions`, `points`, `meetups`, replay).
- SQL migrations are additive and reviewable in `supabase/migrations/*`.
- SupaPlan + `docs/THE_FRANCHEEZEPLAN.md` reflect actual progress.
