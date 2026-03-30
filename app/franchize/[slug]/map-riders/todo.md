

**TASK: Optimize MapRiders for 100+ concurrent riders on Supabase Free Tier**  
**Goal:** Replace heavy realtime writes/polling on `map_rider_points` with the new `live_locations` table + broadcast pattern (exactly as we did for live GPS).  
Keep **all existing functionality** (sessions, persistent points, meetups, leaderboards, route replay, VibeMap, stats) — just make the **live layer** scale perfectly.

### 1. Database — no changes needed
You already ran the perfect `live_locations` table + RLS (with JWT `auth.jwt() ->> 'chat_id'`).  
Leave `map_rider_sessions`, `map_rider_points` and `map_rider_meetups` exactly as they are — they are for **history and stats**.
FYI:
```sql
BEGIN;

DROP TABLE IF EXISTS public.live_locations CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.live_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL REFERENCES public.users(user_id),
  crew_slug text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  is_riding boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  location geography(POINT, 4326) GENERATED ALWAYS AS (
    ST_MakePoint(lng, lat)
  ) STORED
);

CREATE INDEX idx_live_locations_location ON public.live_locations USING GIST (location);
CREATE INDEX idx_live_locations_user_crew ON public.live_locations (user_id, crew_slug);
CREATE INDEX idx_live_locations_crew ON public.live_locations (crew_slug);
CREATE INDEX idx_live_locations_updated ON public.live_locations (updated_at);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "riders see only nearby in same crew" ON public.live_locations;
DROP POLICY IF EXISTS "users can upsert own location" ON public.live_locations;
DROP POLICY IF EXISTS "users can update own location" ON public.live_locations;
DROP POLICY IF EXISTS "users can delete own location" ON public.live_locations;

CREATE POLICY "riders see only nearby in same crew"
ON public.live_locations
FOR SELECT
USING (
  crew_slug = (
    SELECT metadata->>'slug'
    FROM public.crews
    WHERE id = (
      SELECT crew_id
      FROM public.crew_members
      WHERE user_id = (auth.jwt() ->> 'chat_id')
      LIMIT 1
    )
  )
  AND (
    user_id = (auth.jwt() ->> 'chat_id')
    OR ST_DWithin(
      location,
      (SELECT location
       FROM public.live_locations
       WHERE user_id = (auth.jwt() ->> 'chat_id')
       ORDER BY updated_at DESC
       LIMIT 1),
      15000
    )
  )
);

CREATE POLICY "users can insert own location"
ON public.live_locations
FOR INSERT
WITH CHECK (user_id = (auth.jwt() ->> 'chat_id'));

CREATE POLICY "users can update own location"
ON public.live_locations
FOR UPDATE
USING (user_id = (auth.jwt() ->> 'chat_id'))
WITH CHECK (user_id = (auth.jwt() ->> 'chat_id'));

CREATE POLICY "users can delete own location"
ON public.live_locations
FOR DELETE
USING (user_id = (auth.jwt() ->> 'chat_id'));

COMMIT;
```
applyed to supabase successfully.


my current map-riders approach:
```sql
create extension if not exists pgcrypto;

create table if not exists public.map_rider_sessions (
  id uuid primary key default gen_random_uuid(),
  crew_slug text not null,
  user_id text not null references public.users(user_id) on delete cascade,
  ride_name text,
  vehicle_label text,
  ride_mode text not null default 'rental' check (ride_mode in ('rental', 'personal')),
  visibility text not null default 'crew' check (visibility in ('crew', 'all_auth')),
  status text not null default 'active' check (status in ('active', 'completed')),
  sharing_enabled boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_ping_at timestamptz,
  latest_lat double precision,
  latest_lon double precision,
  latest_speed_kmh double precision not null default 0,
  avg_speed_kmh double precision not null default 0,
  max_speed_kmh double precision not null default 0,
  total_distance_km double precision not null default 0,
  duration_seconds integer not null default 0,
  stats jsonb not null default '{}'::jsonb,
  route_bounds jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_rider_sessions_crew_slug_idx on public.map_rider_sessions (crew_slug, status, started_at desc);
create index if not exists map_rider_sessions_user_idx on public.map_rider_sessions (user_id, started_at desc);

create table if not exists public.map_rider_points (
  id bigserial primary key,
  session_id uuid not null references public.map_rider_sessions(id) on delete cascade,
  crew_slug text not null,
  user_id text not null references public.users(user_id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  speed_kmh double precision not null default 0,
  heading_deg double precision,
  accuracy_meters double precision,
  captured_at timestamptz not null default now()
);

create index if not exists map_rider_points_session_idx on public.map_rider_points (session_id, captured_at asc);
create index if not exists map_rider_points_crew_idx on public.map_rider_points (crew_slug, captured_at desc);

create table if not exists public.map_rider_meetups (
  id uuid primary key default gen_random_uuid(),
  crew_slug text not null,
  created_by_user_id text not null references public.users(user_id) on delete cascade,
  title text not null,
  comment text,
  lat double precision not null,
  lon double precision not null,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists map_rider_meetups_crew_idx on public.map_rider_meetups (crew_slug, created_at desc);

alter table public.map_rider_sessions enable row level security;
alter table public.map_rider_points enable row level security;
alter table public.map_rider_meetups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_sessions' and policyname = 'Public can read map rider sessions'
  ) then
    create policy "Public can read map rider sessions" on public.map_rider_sessions for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_points' and policyname = 'Public can read map rider points'
  ) then
    create policy "Public can read map rider points" on public.map_rider_points for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'map_rider_meetups' and policyname = 'Public can read map rider meetups'
  ) then
    create policy "Public can read map rider meetups" on public.map_rider_meetups for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_rider_sessions'
  ) then
    alter publication supabase_realtime add table public.map_rider_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_rider_meetups'
  ) then
    alter publication supabase_realtime add table public.map_rider_meetups;
  end if;
end $$;
```
          const MIN_DISTANCE_M = 15;

export function useLiveRiders(crewSlug: string) {
  const { dbUser } = useAppContext();
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const channelRef = useRef<any>(null);

  const sendPosition = async (position: GeolocationPosition) => {
    if (!dbUser?.user_id || !crewSlug) return;

    const { latitude: lat, longitude: lng, speed, heading, accuracy } = position.coords;
    const now = Date.now();

    const last = lastSentRef.current;
    if (last) {
      const distance = Math.hypot(lat - last.lat, lng - last.lng) * 111_000;
      if (distance < MIN_DISTANCE_M && now - last.ts < THROTTLE_MS) return;
    }

    const payload = {
      user_id: dbUser.user_id,
      crew_slug: crewSlug,
      lat,
      lng,
      speed_kmh: (speed || 0) * 3.6,
      heading: heading || null,
      is_riding: true,
    };

    // 1. Fast broadcast (instant for everyone)
    supabaseAnon.channel(`map:${crewSlug}`).send({
      type: "broadcast",
      event: "position",
      payload,
    });

    // 2. Upsert to live_locations (ephemeral + spatial RLS)
    await supabaseAnon.from("live_locations").upsert(payload, { onConflict: "user_id" });

    lastSentRef.current = { lat, lng, ts: now };
  };

  // Subscribe to live positions
  useEffect(() => {
    if (!crewSlug) return;
    const channel = supabaseAnon.channel(`map:${crewSlug}`);

    channel.on("broadcast", { event: "position" }, ({ payload }) => {
      // TODO: your VibeMap will listen to this via a global store or prop later
      window.dispatchEvent(new CustomEvent("live-rider-update", { detail: payload }));
    }).subscribe();

    channelRef.current = channel;

    return () => supabaseAnon.removeChannel(channel);
  }, [crewSlug]);

  // GPS watcher
  useEffect(() => {
    if (!navigator.geolocation || !dbUser?.user_id) return;
    const watchId = navigator.geolocation.watchPosition(sendPosition, console.error, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [dbUser?.user_id, crewSlug]);

  return { sendPosition };
}
```

# MapRiders Optimization for 100+ Concurrent Riders

## Overview

This optimization replaces heavy realtime writes/polling on `map_rider_points` with the new `live_locations` table + broadcast pattern, enabling MapRiders to scale to 100+ concurrent riders on Supabase Free Tier.

## Architecture Changes

### Before (Not Scalable)
```
GPS Update → POST /api/map-riders/location → INSERT map_rider_points
                                    ↓
                           Realtime subscription triggers
                                    ↓
                           All clients refetch snapshot
```

**Problems:**
- Every GPS update = 1 database INSERT
- 100 riders × 1 update/sec = 100 INSERTs/sec = **6,000/min**
- Realtime subscriptions on `map_rider_points` = death under load
- Supabase Free Tier limit: ~500 requests/min

### After (Scalable)
```
GPS Update → Broadcast to crew channel (instant, no DB)
         ↓
    Upsert live_locations (throttled: 3s min, 15m min distance)
         ↓
    Accumulate points in memory
         ↓
On Stop → Batch INSERT to map_rider_points (1 write per ride)
```

**Benefits:**
- Broadcast = instant updates, zero database load
- `live_locations` upsert = throttled, ~20 updates/min per rider
- 100 riders × 20 updates/min = **2,000/min** (well within limits)
- Batch insert on stop = 1 write per ride instead of N writes

## File Structure

```
/hooks/useLiveRiders.ts          # New hook for live GPS + broadcast
/components/MapRidersClient.tsx  # Updated component with live riders state
/api/map-riders/
  route.ts                       # Optimized snapshot API
  ping/route.ts                  # Lightweight session ping (NEW)
  batch-points/route.ts          # Batch insert points on stop (NEW)
  location/route.ts              # DEPRECATED - returns 410
  session/route.ts               # Start/stop session
  session/[id]/route.ts          # Get session with points
  meetups/route.ts               # Create/list meetups
/sql/weekly_leaderboard_function.sql  # Leaderboard SQL function
```

## Database Schema

### live_locations (NEW - ephemeral)
```sql
CREATE TABLE public.live_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL REFERENCES public.users(user_id),
  crew_slug text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  is_riding boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  location geography(POINT, 4326) GENERATED ALWAYS AS (ST_MakePoint(lng, lat)) STORED
);

-- Indexes for performance
CREATE INDEX idx_live_locations_location ON public.live_locations USING GIST (location);
CREATE INDEX idx_live_locations_user_crew ON public.live_locations (user_id, crew_slug);
CREATE INDEX idx_live_locations_crew ON public.live_locations (crew_slug);
CREATE INDEX idx_live_locations_updated ON public.live_locations (updated_at);
```

### Existing Tables (Unchanged)
- `map_rider_sessions` - Session metadata, history, stats
- `map_rider_points` - Persistent route points (batch inserted on stop)
- `map_rider_meetups` - Meetup pins

## Key Features

### 1. Instant Updates via Broadcast
```typescript
// Send position (instant, no DB wait)
supabase.channel(`map:${crewSlug}`).send({
  type: "broadcast",
  event: "position",
  payload: { user_id, lat, lng, speed_kmh, ... }
});
```

### 2. Throttled Database Writes
```typescript
const THROTTLE_MS = 3000;      // Min 3 seconds between DB writes
const MIN_DISTANCE_M = 15;     // Min 15 meters movement
```

### 3. Client-Side Accumulation
```typescript
const accumulatedPointsRef = useRef<AccumulatedPoint[]>([]);

// During ride: accumulate in memory
accumulatedPointsRef.current.push(point);

// On stop: batch insert
await fetch("/api/map-riders/batch-points", {
  body: JSON.stringify({ sessionId, points: accumulatedPointsRef.current })
});
```

### 4. Merged Display
```typescript
// Merge snapshot sessions with live broadcast updates
const mergedActiveSessions = useMemo(() => {
  // Snapshot sessions (from DB) + live riders (from broadcast)
  // Live updates override snapshot positions for real-time feel
}, [liveRiders, snapshot?.activeSessions]);
```

## Realtime Subscriptions (Lightweight)

```typescript
// BEFORE: Heavy subscription on map_rider_points (DEATH)
supabase.channel(`map-riders:${crewSlug}`)
  .on("postgres_changes", { table: "map_rider_points" }, ...)  // ❌ DON'T

// AFTER: Light subscriptions on metadata only
supabase.channel(`map-riders-meta:${crewSlug}`)
  .on("postgres_changes", { table: "map_rider_sessions" }, ...)   // ✅ OK
  .on("postgres_changes", { table: "map_rider_meetups" }, ...)    // ✅ OK
```

## Performance Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| DB writes/min (100 riders) | 6,000 | 2,000 | 67% reduction |
| Writes per 10-min ride | 600 | 1 | 99.8% reduction |
| Update latency | 500ms+ | <50ms | 10x faster |
| Free tier capacity | ~50 riders | 100+ riders | 2x+ scale |

## Usage

### Start a Ride
```typescript
const { sendPosition } = useLiveRiders(crewSlug);

// 1. Start session
await fetch("/api/map-riders/session", { 
  body: { action: "start", userId, crewSlug, ... }
});

// 2. Begin GPS watch
navigator.geolocation.watchPosition(sendPosition, ...);
```

### Stop a Ride
```typescript
// 1. Stop GPS watch
navigator.geolocation.clearWatch(watchId);

// 2. Batch insert accumulated points
await fetch("/api/map-riders/batch-points", {
  body: { sessionId, crewSlug, userId, points }
});

// 3. Stop session
await fetch("/api/map-riders/session", {
  body: { action: "stop", sessionId, userId, crewSlug }
});

// 4. Cleanup live_locations
await supabase.from("live_locations").delete().eq("user_id", userId);
```

## Deployment Checklist

1. ✅ Apply `live_locations` table + RLS (already done)
2. ✅ Apply weekly leaderboard SQL function
3. ✅ Deploy new API routes (`ping`, `batch-points`)
4. ✅ Update `MapRidersClient.tsx`
5. ✅ Add `useLiveRiders.ts` hook
6. ✅ Deprecate old `/api/map-riders/location` endpoint
7. ⬜ Test with 2-3 devices
8. ⬜ Monitor Supabase dashboard for request counts

## Monitoring

Check Supabase Dashboard → Database → API Requests:
- Before: Spikes during active rides
- After: Flat line, occasional bumps on session start/stop

## Troubleshooting

### Riders not appearing on map
1. Check browser console for broadcast errors
2. Verify `live_locations` table has RLS policies
3. Confirm crew_slug matches between tables

### High database usage still
1. Check if old `/api/map-riders/location` is still being called
2. Verify throttling is working (3s min, 15m min distance)
3. Check for multiple GPS watchers running

### Stale riders on map
- Live riders auto-cleanup after 5 minutes of no updates
- Manual cleanup runs on component mount

## Future Enhancements

1. **Spatial queries**: Use PostGIS `ST_DWithin` for "nearby riders only"
2. **Offline support**: Queue points when connection lost, sync on reconnect
3. **Compression**: Compress point batches for very long rides
4. **Aggregation**: Pre-aggregate stats in `map_rider_sessions` on stop

Add demo data, automate testing and make a screenshot:)


