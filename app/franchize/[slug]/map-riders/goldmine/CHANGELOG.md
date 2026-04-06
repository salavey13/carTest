# MapRiders Refactor — Changelog

## v3.0 — The Megadoc Drop (2026-04-06)

### 🔴 Breaking Changes
- **New API endpoints:** `/api/map-riders/overview`, `/leaderboard`, `/health`, `/batch-points`
- **New state management:** `useReducer` replaces 20+ `useState` calls
- **Broadcast-first realtime:** `rider:move`, `rider:stop`, `meetup:created`, `session:ended` events
- **Old `MapRidersClient` replaced by `MapRidersClientRefactored`**

### ✅ New Features
- **Custom rider markers:** Avatar initials + pulse ring + speed badge + heading
- **Viewport culling:** Only render markers in visible bounds (+20% buffer)
- **Grid clustering:** Auto-cluster at zoom <14 when >20 riders
- **Stale rider eviction:** 30s fade → 120s auto-remove
- **GPS throttle:** 3s interval + 10m distance threshold
- **Batch GPS writes:** Queue + flush every 5s (vs per-tick)
- **Bottom sheet (mobile):** Riders/Meetups/History tabs via vaul
- **Floating action button:** Gold start / red pulsing stop
- **Status overlay:** LIVE indicator with timer + distance + speed
- **Telegram integration:** MainButton + HapticFeedback hooks
- **Health endpoint:** Ops counters for monitoring
- **Demo seed SQL:** 5 synthetic riders around Strigininsky Boulevard
- **Leaderboard materialized view:** Cached weekly stats

### 🐛 Bugs Fixed
- **Ghost markers:** Double state merge (snapshot + realtime both writing liveRiders)
- **Zombie riders:** No eviction meant dead markers stayed forever
- **Full refetch on every event:** postgres_changes on sessions/meetups triggered 3x Supabase queries
- **No loading state:** Blank screen until first fetch (now skeleton)

### 📊 Performance Targets
| Metric | Before | After |
|--------|--------|-------|
| Snapshot payload | ~30KB | ~3-5KB |
| GPS writes/min | ~60 | ~12 |
| DOM nodes (100 riders) | 100+ | 10-20 (culled) |
| State variables | 20+ useState | 1 reducer |

### 📁 Files Added (18)
```
lib/map-riders-reducer.ts
hooks/useMapRidersContext.tsx
hooks/useLiveRiders.ts
hooks/useTelegram.ts
components/map-riders/MapRidersClientRefactored.tsx
components/map-riders/RiderFAB.tsx
components/map-riders/RiderMarkerLayer.tsx
components/map-riders/RidersDrawer.tsx
components/map-riders/StatusOverlay.tsx
components/map-riders/LoadingSkeleton.tsx
components/map-canvas/RiderMarker.tsx
app/api/map-riders/overview/route.ts
app/api/map-riders/leaderboard/route.ts
app/api/map-riders/health/route.ts
app/api/map-riders/batch-points/route.ts
sql/001-live-locations.sql
sql/002-leaderboard-materialized-view.sql
sql/003-demo-seed.sql
```

### 🔄 Migration Effort
- 2 import changes in page.tsx
- 1 line added to RacingMap.tsx
- ~30-60 minutes total including testing
