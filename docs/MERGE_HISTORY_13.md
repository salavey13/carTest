# Merge History Note #13 — Franchize + MapRiders hardening wave

Date: 2026-05-04

## Why this merge matters
This wave closed multiple reliability/security loops across operator-critical surfaces:
- map-riders write-path ACL and subject binding,
- franchize cart sync stability,
- checkout duplicate-submit protection,
- shared speed-gradient visual contract,
- SupaPlan lifecycle notification hook,
- configurator contract skeleton for EV order-doc flow.

## Delivered slices

### 1) MapRiders ACL + identity hardening
- Added reusable `assertCrewMembership(userId, crewSlug)` helper.
- Enforced guard subject parity (`userId === guard.subject`) in write endpoints.
- Added structured denial reasons (`subject_mismatch`, `membership_required`) and `join_required` code.

Endpoints covered:
- `/api/map-riders/session`
- `/api/map-riders/location`
- `/api/map-riders/batch-points`
- `/api/map-riders/meetups`

Result:
- Non-members and spoofed user payloads are rejected deterministically.

### 2) Franchize checkout dedupe
- Added submit fingerprint lock in `OrderPageClient` to suppress duplicate in-flight checkout attempts.
- Lock resets on success/failure to keep retries possible.

Result:
- Better Telegram/WebApp UX under repeat taps or lag spikes.

### 3) Franchize cart semantic sync
- Replaced brittle JSON-string equality with semantic cart equality helpers.
- Suppressed redundant localStorage writes/events.
- Hardened option sanitization (`buyPriceDelta` must be finite).

Result:
- Noisy cross-tab ping-pong and unnecessary rerenders reduced.

### 4) Speed-gradient source-of-truth
- Added shared speed band utility for route segments + legend.
- Route rendering and UI legend now derive from the same bands.

Result:
- Visual coherence + easier future theme mapping.

### 5) SupaPlan status notification hook (opt-in)
- `update-status` can trigger `codex-notify` callback in best-effort mode.
- Added observability warnings when disabled or failed.

Result:
- Better lifecycle visibility without blocking task transitions.

### 6) Configurator contract scaffold
- Added phase-1 contract doc for EV config flow.
- Declared payload/response/lifecycle/doc-scope conventions.

Result:
- Clear baseline for next implementation slices.

## Task stream context
Primary task ids touched in this wave:
- `3e06c857-73be-40dc-9c1c-4ad30fbc20cc`
- `92b48f2c-9c24-451e-bd4e-7cc761a7fc68`
- `1548e9b7-bfe4-4da4-94b5-423b640ba47c`
- `0347b91a-73c1-4a24-837c-9c0d9f5dc987`
- `e837b793-3de3-49f9-b777-3294a58f36af`
- `d2b7e8e1-2234-4b2f-cdef-22220002bcde`

## Risk notes / follow-ups
- Validate callback delivery in a fully wired production env with secrets present.
- Complete read-path isolation audit for map-riders overview/leaderboard consistency.
- Move merged `ready_for_pr` tasks to `done` via merge workflow closure.

## Operator vibe stamp
"Favorite number 13" patch included on purpose. 🦾
