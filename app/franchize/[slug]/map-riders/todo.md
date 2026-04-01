# Map Riders — TODO

## Objective
Optimize live rider tracking for **100+ concurrent riders** on Supabase Free Tier by moving the realtime layer to `live_locations` + broadcast, while preserving all current features (`sessions`, `points`, `meetups`, `leaderboard`, replay, stats, VibeMap).

## Constraints
- Keep historical/stat tables as-is:
  - `map_rider_sessions`
  - `map_rider_points`
  - `map_rider_meetups`
- Use `live_locations` only for low-latency online presence.
- No service-role logic in client components.

## Implementation checklist

### 1) Data flow split (live vs history)
- [ ] Write current location updates to `live_locations` (upsert by rider).
- [ ] Stop high-frequency writes into `map_rider_points` for every GPS tick.
- [ ] Keep `map_rider_points` writes for sampled checkpoints/history only.

### 2) Broadcast channel
- [ ] Publish compact location payloads on rider movement via Supabase Realtime Broadcast.
- [ ] Subscribe per crew/room (`crew_slug`) in map client.
- [ ] Fallback to periodic pull from `live_locations` when broadcast packet loss is detected.

### 3) Read model for the map
- [ ] Build in-memory `onlineRiders` store keyed by `user_id`.
- [ ] Merge incoming broadcast packets by `updated_at` (ignore stale/out-of-order updates).
- [ ] Expire riders not updated for N seconds (`offline_timeout`).

### 4) Session/stat integrity
- [ ] Keep session lifecycle in `map_rider_sessions` (`active/completed`).
- [ ] Continue distance/speed aggregation from trusted checkpoints.
- [ ] On ride end, flush final sampled points + session totals.

### 5) Security + access boundaries
- [ ] Ensure RLS on `live_locations` remains crew-scoped + nearby filter.
- [ ] Ensure client only reads/writes own rider location.
- [ ] Keep privileged operations in server actions/routes.

### 6) Performance guardrails
- [ ] Client-side throttle GPS emits (e.g. every 1-2s or distance threshold).
- [ ] Deduplicate tiny coordinate jitter updates.
- [ ] Avoid app-wide rerenders: isolate map live state from global contexts.

### 7) QA scenarios
- [ ] 1 rider: start/stop/share toggle and reconnect.
- [ ] 10 riders: smooth live markers, no duplicate ghosts.
- [ ] 100+ synthetic riders: acceptable map FPS and no DB write burst errors.
- [ ] Telegram WebApp: taps/navigation remain SPA, no overlay click-blocking.

## Done criteria
- Live marker updates are near real-time under load.
- Free Tier write/read pressure reduced vs previous per-tick persistence model.
- Historical replay/stat features stay functionally unchanged.
- No regressions in Telegram-first UX and routing behavior.
