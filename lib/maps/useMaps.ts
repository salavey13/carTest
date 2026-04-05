"use client";

import { useEffect, useMemo, useState } from 'react';
import type { MapCapabilityConfig, RacingMapData } from '@/lib/maps/map-types';

type UseMapsState = {
  mapData: RacingMapData | null;
  isLoading: boolean;
  error: string | null;
};

export function useMaps(config: MapCapabilityConfig): UseMapsState {
  const [state, setState] = useState<UseMapsState>({
    mapData: null,
    isLoading: true,
    error: null,
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (config.mapId) params.set('mapId', config.mapId);
    if (config.crewSlug) params.set('crewSlug', config.crewSlug);
    if (config.defaultTileLayer) params.set('defaultTileLayer', config.defaultTileLayer);
    return params.toString();
  }, [config.crewSlug, config.defaultTileLayer, config.mapId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const response = await fetch(`/api/maps/capability?${query}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Failed to load map capability');
        }

        if (!cancelled) {
          setState({ mapData: result.data as RacingMapData, isLoading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            mapData: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load map capability',
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return state;
}
