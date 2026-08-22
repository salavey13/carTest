# MapRiders API backlog

Scope: `app/api/map-riders/*` plus Telegram webhook bridge code that writes MapRiders live-location records.

## RENT-P2.4 — Telegram live-location bridge (native GPS)

- [x] Detect Telegram `message.location` and `edited_message.location` payloads from native live-location sharing.
- [x] Prefer an active `map_rider_sessions` row for the Telegram `from.id` before legacy crew-shift location handling.
- [x] Mirror native Telegram GPS into `live_locations`, `map_rider_sessions.latest_*`, and `map_rider_points` so replay/history stays complete.
- [x] Broadcast `rider:move` on the existing `map-riders:{crewSlug}` realtime channel.
- [x] Keep duplicate burst filtering for low-distance Telegram edit storms.
- [x] Guard one-off Telegram locations: only live-period/edited-message updates short-circuit into MapRiders, so SOS/drop-off geotags still fall through to legacy state handlers.

SupaPlan task: `696922bd-8186-4903-ab7b-ef999d7ac11b`
