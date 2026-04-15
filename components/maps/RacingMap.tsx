"use client";

import { useMemo, useState, type ReactNode } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Popup, Polyline, TileLayer } from 'react-leaflet';
import { MapInteractionCapture } from '@/components/maps/MapInteractionCapture';
import type { PointOfInterest } from '@/lib/map-utils';
import type { TileLayerPreset } from '@/lib/maps/map-types';

const TILE_LAYERS: Record<TileLayerPreset, string> = {
  'cartodb-dark': 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  'cartodb-light': 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

function collectLatLng(points: PointOfInterest[]): Array<[number, number]> {
  const collected: Array<[number, number]> = [];
  for (const poi of points) {
    for (const coord of poi.coords || []) {
      if (Array.isArray(coord) && coord.length >= 2) {
        collected.push([Number(coord[0]), Number(coord[1])]);
      }
    }

    if (poi.geojson?.geometry?.coordinates) {
      const stack: any[] = [poi.geojson.geometry.coordinates];
      while (stack.length) {
        const current = stack.pop();
        if (!Array.isArray(current)) continue;
        if (current.length >= 2 && typeof current[0] === 'number' && typeof current[1] === 'number') {
          collected.push([Number(current[1]), Number(current[0])]);
          continue;
        }
        for (const child of current) stack.push(child);
      }
    }

    if (poi.geojson?.features?.length) {
      for (const feature of poi.geojson.features) {
        const stack: any[] = [feature.geometry?.coordinates];
        while (stack.length) {
          const current = stack.pop();
          if (!Array.isArray(current)) continue;
          if (current.length >= 2 && typeof current[0] === 'number' && typeof current[1] === 'number') {
            collected.push([Number(current[1]), Number(current[0])]);
            continue;
          }
          for (const child of current) stack.push(child);
        }
      }
    }
  }
  return collected;
}

export function RacingMap({
  points,
  bounds,
  className,
  onMapClick,
  onMapLongPress,
  tileLayer = 'cartodb-dark',
  children,
}: {
  points: PointOfInterest[];
  bounds: { top: number; bottom: number; left: number; right: number };
  className?: string;
  onMapClick?: (coords: [number, number]) => void;
  onMapLongPress?: (coords: [number, number]) => void;
  tileLayer?: TileLayerPreset;
  children?: ReactNode;
}) {
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  const mapBounds = useMemo(
    () => {
      const latLng = collectLatLng(points);
      if (latLng.length) {
        const lats = latLng.map((entry) => entry[0]);
        const lngs = latLng.map((entry) => entry[1]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const latPad = Math.max(0.015, (maxLat - minLat) * 0.2);
        const lngPad = Math.max(0.015, (maxLng - minLng) * 0.2);
        return [
          [minLat - latPad, minLng - lngPad],
          [maxLat + latPad, maxLng + lngPad],
        ] as [[number, number], [number, number]];
      }
      return [
        [bounds.bottom, bounds.left],
        [bounds.top, bounds.right],
      ] as [[number, number], [number, number]];
    },
    [bounds.bottom, bounds.left, bounds.right, bounds.top, points],
  );

  const source = TILE_LAYERS[tileLayer] || TILE_LAYERS['cartodb-dark'];

  return (
    <div className={`relative z-0 ${className || ''}`}>
      <MapContainer
        bounds={mapBounds}
        className="z-0 h-full w-full"
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

        {children}
        <MapInteractionCapture onMapClick={onMapClick} onMapLongPress={onMapLongPress} />
      </MapContainer>
    </div>
  );
}
