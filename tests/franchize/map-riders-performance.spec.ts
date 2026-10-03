import { describe, expect, it } from 'vitest';

import { formatRideDuration } from '@/lib/map-riders';
import {
  initialMapRidersState,
  mapRidersReducer,
  type ActiveSession,
  type LiveRider,
  type MapRidersState,
  type SnapshotData,
} from '@/lib/map-riders-reducer';

function rider(overrides: Partial<LiveRider> = {}): LiveRider {
  return {
    user_id: 'rider-1',
    crew_slug: 'vip-bike',
    lat: 56.204245,
    lng: 43.798905,
    speed_kmh: 0,
    heading: null,
    updated_at: new Date().toISOString(),
    status: 'live',
    isSelf: false,
    ...overrides,
  };
}

function stateWithRiders(liveRiders: Map<string, LiveRider>): MapRidersState {
  return {
    ...initialMapRidersState,
    liveRiders,
  };
}

function activeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    id: 'session-1',
    user_id: 'rider-1',
    crew_slug: 'vip-bike',
    ride_name: 'Вечерний выезд',
    vehicle_label: 'VIP bike',
    ride_mode: 'personal',
    status: 'active',
    sharing_enabled: true,
    started_at: new Date().toISOString(),
    latest_lat: 56.204245,
    latest_lon: 43.798905,
    latest_speed_kmh: 0,
    total_distance_km: 0,
    ...overrides,
  };
}

describe('map riders eviction tick', () => {
  it('keeps the same state and rider map reference when no rider changes', () => {
    const liveRiders = new Map([['rider-1', rider()]]);
    const state = stateWithRiders(liveRiders);

    const nextState = mapRidersReducer(state, { type: 'eviction/tick' });

    expect(nextState).toBe(state);
    expect(nextState.liveRiders).toBe(liveRiders);
  });

  it('keeps empty rider maps stable on idle ticks', () => {
    const state = stateWithRiders(new Map());

    const nextState = mapRidersReducer(state, { type: 'eviction/tick' });

    expect(nextState).toBe(state);
    expect(nextState.liveRiders).toBe(state.liveRiders);
  });

  it('clones the rider map only when a rider becomes stale', () => {
    const liveRiders = new Map([
      [
        'rider-1',
        rider({
          updated_at: new Date(Date.now() - 45_000).toISOString(),
        }),
      ],
    ]);
    const state = stateWithRiders(liveRiders);

    const nextState = mapRidersReducer(state, { type: 'eviction/tick' });

    expect(nextState).not.toBe(state);
    expect(nextState.liveRiders).not.toBe(liveRiders);
    expect(nextState.liveRiders.get('rider-1')?.status).toBe('stale');
  });
});

describe('formatRideDuration', () => {
  it('handles just-started and invalid durations without dead-looking zero minute labels', () => {
    expect(formatRideDuration(0)).toBe('Только что начали!');
    expect(formatRideDuration(Number.NaN)).toBe('Меньше минуты');
    expect(formatRideDuration(-1)).toBe('Меньше минуты');
    expect(formatRideDuration(30)).toBe('Меньше минуты');
  });
});

// ── LIVE-STATS FIX (2026-10-03): the floating top bar (StatusOverlay) reads
// total_distance_km / latest_speed_kmh from state.sessions. The reducer must
// advance the rider's ACTIVE session row on every accepted packet, must not
// let a mid-ride snapshot regress the accumulated distance, and must seed the
// session row on share/started so the bar never reads "undefined → zeroes". ──
describe('live ride stats in reducer sessions', () => {
  const move = (lat: number, lng: number, speedKmh: number, updatedAt: string) => ({
    type: 'rider/moved' as const,
    payload: { user_id: 'rider-1', lat, lng, speed_kmh: speedKmh, heading: null, updated_at: updatedAt },
    selfUserId: 'rider-1',
  });

  it('rider/moved advances the matching active session (speed + accumulated distance)', () => {
    const t0 = new Date('2026-10-02T12:00:00Z').toISOString();
    const t1 = new Date('2026-10-02T12:00:10Z').toISOString();
    let state: MapRidersState = {
      ...stateWithRiders(new Map([['rider-1', rider({ updated_at: t0 })]])),
      sessions: [activeSession({ latest_speed_kmh: 0, total_distance_km: 0 })],
    };

    // ~10 s at ~90 km/h ≈ 250 m south-east → both speed and distance move.
    state = mapRidersReducer(state, move(56.2020, 43.8020, 88, t1));

    const session = state.sessions.find((s) => s.id === 'session-1');
    expect(session).toBeDefined();
    expect(session?.latest_speed_kmh).toBe(88);
    expect(session?.latest_lat).toBeCloseTo(56.202, 5);
    expect(session?.latest_lon).toBeCloseTo(43.802, 5);
    expect(session?.total_distance_km).toBeGreaterThan(0.1);
    expect(session?.total_distance_km).toBeLessThan(1);
  });

  it('rider/moved leaves other riders and completed sessions untouched', () => {
    const t0 = new Date('2026-10-02T12:00:00Z').toISOString();
    const t1 = new Date('2026-10-02T12:00:10Z').toISOString();
    const state: MapRidersState = {
      ...stateWithRiders(new Map([['rider-2', rider({ user_id: 'rider-2', updated_at: t0 })]])),
      sessions: [
        activeSession({ id: 'someone-else', user_id: 'rider-2', total_distance_km: 5 }),
        activeSession({ id: 'old-ride', user_id: 'rider-1', status: 'completed', total_distance_km: 9 }),
      ],
    };

    const nextState = mapRidersReducer(state, move(56.202, 43.802, 60, t1));

    // rider-1 has no ACTIVE row → sessions array must keep its old reference.
    expect(nextState.sessions).toBe(state.sessions);
    expect(nextState.sessions.find((s) => s.id === 'someone-else')?.total_distance_km).toBe(5);
    expect(nextState.sessions.find((s) => s.id === 'old-ride')?.total_distance_km).toBe(9);
  });

  it('snapshot/loaded never regresses client-accumulated distance for active sessions', () => {
    const state: MapRidersState = {
      ...stateWithRiders(new Map()),
      sessions: [activeSession({ total_distance_km: 12.345 })],
    };
    const snapshot: SnapshotData = {
      activeSessions: [activeSession({ total_distance_km: 0 })],
      meetups: [],
      liveLocations: [],
      weeklyLeaderboard: [],
      latestCompleted: [],
      stats: { activeRiders: 1, meetupCount: 0, totalWeeklyDistanceKm: 0 },
    };

    const nextState = mapRidersReducer(state, { type: 'snapshot/loaded', payload: snapshot, selfUserId: 'rider-1' });

    expect(nextState.sessions.find((s) => s.id === 'session-1')?.total_distance_km).toBe(12.345);
  });

  it('share/started seeds the bar session row immediately (idempotent)', () => {
    const empty = mapRidersReducer(initialMapRidersState, {
      type: 'share/started',
      payload: { sessionId: 'session-9', rideName: 'Тест', vehicleLabel: 'R7', rideMode: 'personal' },
      selfUserId: 'rider-1',
    });
    expect(empty.sessionId).toBe('session-9');
    const seeded = empty.sessions.find((s) => s.id === 'session-9');
    expect(seeded).toBeDefined();
    expect(seeded?.user_id).toBe('rider-1');
    expect(seeded?.status).toBe('active');
    expect(seeded?.total_distance_km).toBe(0);

    const again = mapRidersReducer(empty, {
      type: 'share/started',
      payload: { sessionId: 'session-9', rideName: 'Тест', vehicleLabel: 'R7', rideMode: 'personal' },
      selfUserId: 'rider-1',
    });
    expect(again.sessions.filter((s) => s.id === 'session-9')).toHaveLength(1);
  });
});
