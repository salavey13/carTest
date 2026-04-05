"use client";

import { useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Popup, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import type { PointOfInterest } from '@/lib/map-utils';
import type { TileLayerPreset } from '@/lib/maps/map-types';

const TILE_LAYERS: Record<TileLayerPreset, string> = {
  'cartodb-dark': 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  'cartodb-light': 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

function MapClickCapture({ onMapClick }: { onMapClick?: (coords: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onMapClick?.([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

export function RacingMap({
  points,
  bounds,
  className,
  onMapClick,
  tileLayer = 'cartodb-dark',
}: {
  points: PointOfInterest[];
  bounds: { top: number; bottom: number; left: number; right: number };
  className?: string;
  onMapClick?: (coords: [number, number]) => void;
  tileLayer?: TileLayerPreset;
}) {
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  const mapBounds = useMemo(
    () =>
      [
        [bounds.bottom, bounds.left],
        [bounds.top, bounds.right],
      ] as [[number, number], [number, number]],
    [bounds.bottom, bounds.left, bounds.right, bounds.top],
  );

  const source = TILE_LAYERS[tileLayer] || TILE_LAYERS['cartodb-dark'];

  return (
    <div className={className}>
      <MapContainer
        bounds={mapBounds}
        className="h-full w-full"
        zoomControl
        attributionControl
        preferCanvas
      >
        <TileLayer
          url={source}
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        />

        {points.map((poi) => {
          if (poi.type === 'point') {
            const center = poi.coords?.[0];
            if (!center) return null;
            return (
              <CircleMarker
                key={poi.id}
                center={center}
                radius={8}
                pathOptions={{ color: poi.color, fillColor: poi.color, fillOpacity: 0.9, weight: 2 }}
              >
                <Popup>
                  <div className="font-medium">{poi.name}</div>
                </Popup>
              </CircleMarker>
            );
          }

          const isActive = activeRouteId === poi.id;
          const baseWeight = poi.roadHighlight?.weight || (poi.type === 'loop' ? 6 : 4);

          if (poi.geojson) {
            return (
              <GeoJSON
                key={poi.id}
                data={poi.geojson as any}
                style={{
                  color: poi.color,
                  weight: isActive ? baseWeight + 2 : baseWeight,
                  opacity: isActive ? 1 : 0.9,
                  dashArray: poi.roadHighlight?.dashArray,
                  className: poi.roadHighlight?.glow ? 'leaflet-road-glow' : undefined,
                } as any}
                eventHandlers={{
                  click: () => setActiveRouteId((prev) => (prev === poi.id ? null : poi.id)),
                  mouseover: (event) => event.target.setStyle({ weight: baseWeight + 2 }),
                  mouseout: (event) => event.target.setStyle({ weight: isActive ? baseWeight + 2 : baseWeight }),
                }}
              />
            );
          }

          return (
            <Polyline
              key={poi.id}
              positions={poi.coords}
              pathOptions={{
                color: poi.color,
                weight: isActive ? baseWeight + 2 : baseWeight,
                opacity: isActive ? 1 : 0.9,
                dashArray: poi.roadHighlight?.dashArray || (poi.type === 'loop' ? undefined : '10, 10'),
                className: poi.roadHighlight?.glow ? 'leaflet-road-glow' : undefined,
              }}
              eventHandlers={{
                click: () => setActiveRouteId((prev) => (prev === poi.id ? null : poi.id)),
                mouseover: (event) => event.target.setStyle({ weight: baseWeight + 2 }),
                mouseout: (event) => event.target.setStyle({ weight: isActive ? baseWeight + 2 : baseWeight }),
              }}
            />
          );
        })}

        <MapClickCapture onMapClick={onMapClick} />
      </MapContainer>
    </div>
  );
}
