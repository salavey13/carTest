import type { GeoBounds, PointOfInterest } from '@/lib/map-utils';

export type TileLayerPreset = 'cartodb-dark' | 'cartodb-light' | 'osm';

export type MapCapabilityConfig = {
  mapId?: string;
  crewSlug?: string;
  defaultTileLayer?: TileLayerPreset;
  showRoutes?: boolean;
  showPOIs?: boolean;
  enableRouting?: boolean;
};

export type RacingMapData = {
  mapId: string;
  mapName: string;
  bounds: GeoBounds;
  points: PointOfInterest[];
  routes: PointOfInterest[];
  pois: PointOfInterest[];
  meta: {
    tileLayer: TileLayerPreset;
    defaultZoom: number;
    minZoom: number;
    maxZoom: number;
    lastUpdated: string;
    source: 'map-id' | 'crew-slug' | 'default';
  };
};
