import { describe, expect, it } from 'vitest';

import { formatRideDuration } from '@/lib/map-riders';
import { initialMapRidersState, mapRidersReducer, type LiveRider, type MapRidersState } from '@/lib/map-riders-reducer';

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
