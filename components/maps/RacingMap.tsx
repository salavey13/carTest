"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import React from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from "react-leaflet";
import type { DivIcon as LeafletDivIcon } from "leaflet";
import type { GeoJsonObject } from "geojson";
import { MapInteractionCapture } from "@/components/maps/MapInteractionCapture";
import type { PointOfInterest } from "@/lib/map-utils";
import type { TileLayerPreset } from "@/lib/maps/map-types";
import { buildPoiMarkerIcon, parsePoiIcon, safeCssColor } from "@/lib/map-poi-marker";

const TILE_LAYERS: Record<TileLayerPreset, string> = {
  "cartodb-dark": "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  "cartodb-light": "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
};

// Optional keyed-provider override (MapTiler / Stadia / Thunderforest…).
// The default CARTO/OSM basemaps need NO api key — the bottom bar is the
// license attribution, not a watermark. When a rider-owner wants premium
// basemaps (or a provider without the free-tier limits), set:
//   NEXT_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=KEY
//   NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=© MapTiler © OpenStreetMap contributors
// Both are build-time client envs (NEXT_PUBLIC_*) — set them in Vercel and
// redeploy. Invalid/empty values are ignored, the preset stays CARTO.
const CUSTOM_TILE_URL = (process.env.NEXT_PUBLIC_MAP_TILE_URL || "").trim();
const CUSTOM_TILE_ATTRIBUTION = (process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || "").trim();

function collectLatLng(points: PointOfInterest[]): Array<[number, number]> {
  const collected: Array<[number, number]> = [];
  for (const poi of points) {
    for (const coord of poi.coords || []) {
      if (Array.isArray(coord) && coord.length >= 2) {
        collected.push([Number(coord[0]), Number(coord[1])]);
      }
    }

    if (poi.geojson?.geometry?.coordinates) {
      const stack: unknown[] = [poi.geojson.geometry.coordinates];
      while (stack.length) {
        const current = stack.pop();
        if (!Array.isArray(current)) continue;
        if (current.length >= 2 && typeof current[0] === "number" && typeof current[1] === "number") {
          collected.push([Number(current[1]), Number(current[0])]);
          continue;
        }
        for (const child of current) stack.push(child);
      }
    }

    if (poi.geojson?.features?.length) {
      for (const feature of poi.geojson.features) {
        const stack: unknown[] = [feature.geometry?.coordinates];
        while (stack.length) {
          const current = stack.pop();
          if (!Array.isArray(current)) continue;
          if (current.length >= 2 && typeof current[0] === "number" && typeof current[1] === "number") {
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

/**
 * Route-trailhead helpers (dirt-routes edition 2026-09-23): each path/loop POI
 * gets a small start-badge marker with a popup (name · length · surface note),
 * so trails are discoverable without tracing polylines on a phone.
 * Length = haversine sum over the first LineString (or coords fallback) —
 * “crow-fly” between vertices, close enough for a ~1 km/human label.
 */
function routeStartPoint(poi: PointOfInterest): [number, number] | null {
  const firstLine = poi.geojson?.geometry?.type === "LineString"
    ? poi.geojson.geometry.coordinates
    : poi.geojson?.features?.find((f) => f.geometry?.type === "LineString")?.geometry?.coordinates;
  if (Array.isArray(firstLine) && firstLine.length > 0) {
    const c = firstLine[0];
    if (Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number") {
      return [c[1], c[0]]; // geojson lon,lat → leaflet lat,lng
    }
  }
  const head = poi.coords?.[0];
  if (Array.isArray(head) && head.length >= 2 && Number.isFinite(head[0]) && Number.isFinite(head[1])) {
    return [head[0], head[1]];
  }
  return null;
}

function routeLengthKm(poi: PointOfInterest): number | null {
  let line: unknown[] | null = null;
  if (poi.geojson?.geometry?.type === "LineString" && Array.isArray(poi.geojson.geometry.coordinates)) {
    line = poi.geojson.geometry.coordinates as unknown[];
  } else if (poi.geojson?.features?.length) {
    const f = poi.geojson.features.find((feat) => feat.geometry?.type === "LineString");
    if (f && Array.isArray(f.geometry?.coordinates)) line = f.geometry.coordinates as unknown[];
  }
  let latlngs: Array<[number, number]> | null = null;
  if (line && line.length > 1) {
    latlngs = (line as Array<[number, number]>)
      .filter((c) => Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number")
      .map((c) => [c[1], c[0]] as [number, number]);
  } else if (poi.coords && poi.coords.length > 1) {
    latlngs = poi.coords as Array<[number, number]>;
  }
  if (!latlngs) return null;
  const R = 6371000;
  let total = 0;
  for (let i = 1; i < latlngs.length; i++) {
    const [lat1, lng1] = latlngs[i - 1];
    const [lat2, lng2] = latlngs[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total / 1000;
}

// Badge icons are stable per color (react-leaflet calls setIcon whenever the
// icon identity changes; the points array re-identifies on every rider tick,
// so building icons inline would churn the DOM each tick). Small LRU-ish cap
// guards against hostile-color cache growth from DB POIs.
const routeBadgeIconCache = new Map<string, LeafletDivIcon | null>();
const ROUTE_BADGE_CACHE_MAX = 32;
function routeBadgeIcon(color: string): LeafletDivIcon | null {
  const key = safeCssColor(color);
  if (routeBadgeIconCache.has(key)) return routeBadgeIconCache.get(key) ?? null;
  const icon = buildPoiMarkerIcon({ color: key, faName: "FaFlag", markerSize: "sm" });
  if (routeBadgeIconCache.size >= ROUTE_BADGE_CACHE_MAX) routeBadgeIconCache.clear();
  routeBadgeIconCache.set(key, icon);
  return icon;
}

function getPoiRenderKey(poi: PointOfInterest) {
  const pointCount = poi.coords?.length || 0;
  const first = poi.coords?.[0];
  const last = poi.coords?.[pointCount - 1];
  const geojsonFingerprint = poi.geojson
    ? JSON.stringify({
        type: poi.geojson.type,
        featureCount: poi.geojson.features?.length || 0,
        geometryType: poi.geojson.geometry?.type,
      })
    : "plain";

  const revisionCandidate =
    (poi as { updatedAt?: string }).updatedAt ||
    (poi as { meta?: { updatedAt?: string } }).meta?.updatedAt ||
    `${pointCount}:${first?.[0] ?? "na"}:${first?.[1] ?? "na"}:${last?.[0] ?? "na"}:${last?.[1] ?? "na"}:${geojsonFingerprint}`;

  return `${poi.id}:${revisionCandidate}`;
}

/**
 * Imperative focus request: {lat, lng, key}. `key` is a monotonic counter —
 * re-focusing the SAME point must re-fly, so the effect depends on the whole
 * object identity, not just coordinates. Zoom never zooms OUT (min 14: close
 * enough to see the pin's context, far enough to keep street names readable).
 */
export interface RacingMapFocusPoint {
  lat: number;
  lng: number;
  key: number;
}

function MapFocusFlyer({ focus }: { focus: RacingMapFocusPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    if (!Number.isFinite(focus.lat) || !Number.isFinite(focus.lng)) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [focus, map]);
  return null;
}

export function RacingMap({
  points,
  bounds,
  className,
  onMapClick,
  onMapLongPress,
  onPointClick,
  tileLayer = "cartodb-dark",
  focusPoint,
  children,
}: {
  points: PointOfInterest[];
  bounds: { top: number; bottom: number; left: number; right: number };
  className?: string;
  onMapClick?: (coords: [number, number]) => void;
  onMapLongPress?: (coords: [number, number]) => void;
  onPointClick?: (poi: PointOfInterest) => void;
  tileLayer?: TileLayerPreset;
  /** Wall × map: fly to a geotagged post's marker (see MapFocusFlyer). */
  focusPoint?: RacingMapFocusPoint | null;
  children?: ReactNode;
}) {
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  // Route-start badges: small trailhead marker per path/loop POI (skips the
  // live session route — it follows the rider and needs no badge — and skips
  // every non-note route: only the dirt-* DB routes carry `note`, so other
  // RacingMap consumers (VPR geography quiz zones etc.) never get flags).
  const routeBadges = useMemo(
    () =>
      points
        .filter((poi) => poi.type !== "point" && !poi.id.startsWith("route-") && Boolean(poi.note))
        .map((poi) => {
          const start = routeStartPoint(poi);
          if (!start) return null;
          const icon = routeBadgeIcon(poi.color);
          if (!icon) return null;
          return { poi, start, km: routeLengthKm(poi), icon };
        })
        .filter((badge): badge is { poi: PointOfInterest; start: [number, number]; km: number | null; icon: LeafletDivIcon } => badge !== null),
    [points],
  );

  const mapBounds = useMemo(() => {
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
  }, [bounds.bottom, bounds.left, bounds.right, bounds.top, points]);

  const source = CUSTOM_TILE_URL || TILE_LAYERS[tileLayer] || TILE_LAYERS["cartodb-dark"];
  const attribution = CUSTOM_TILE_URL
    ? CUSTOM_TILE_ATTRIBUTION || "© OpenStreetMap contributors"
    : "© OpenStreetMap contributors © CARTO";

  return (
    <div className={`relative z-0 ${className || ""}`} style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
      <MapContainer
        bounds={mapBounds}
        className="z-0 h-full w-full"
        zoomControl
        attributionControl
        preferCanvas
        dragging
        touchZoom
        scrollWheelZoom
        doubleClickZoom
      >
        <TileLayer url={source} attribution={attribution} />

        {points.map((poi) => {
          if (poi.type === "point") {
            const center = poi.coords?.[0];
            if (!center) return null;
            // Security guard: only REAL React elements (built client-side from
            // in-repo constants) render as rich popups. A DB-authored `popup`
            // value (JSONB string/object) can never smuggle markup — it is
            // ignored and the plain name fallback is used.
            const richPopup = React.isValidElement(poi.popup) ? poi.popup : null;
            const popupNode = (
              <Popup className={richPopup ? "mr-spot-popup-wrapper" : undefined}>
                {richPopup ?? <div className="font-medium">{poi.name}</div>}
              </Popup>
            );

            // «Instead of simple dots show real icons with round pictures if
            // available» (map-riders feedback): image URLs (crew logos, catalog
            // photos, wall pins) become round avatars, `::FaXxx::` icons become
            // real glyph badges, `initials:XX` becomes a local offline badge.
            // Unparseable/missing icons keep the classic dot.
            // buildPoiMarkerIcon validates URL schemes and escapes attributes;
            // FA names are lookup keys, never interpolated markup.
            const parsedIcon = parsePoiIcon(poi.icon);
            const imageUrl =
              poi.imageUrl && poi.imageUrl.trim()
                ? poi.imageUrl
                : parsedIcon.kind === "image"
                  ? parsedIcon.url
                  : null;
            // The glyph doubles as the broken-photo fallback layer UNDER the
            // picture (pure CSS), so it is passed even when an image exists.
            const faName = parsedIcon.kind === "fa" ? parsedIcon.name : null;
            const initials = parsedIcon.kind === "initials" ? parsedIcon.text : null;
            const poiMarkerIcon = buildPoiMarkerIcon({
              color: poi.color,
              imageUrl,
              faName,
              initials: poi.initials ?? initials,
              markerSize: poi.markerSize,
              halo: poi.markerHalo,
              markerClassName: poi.markerClassName,
            });

            if (poiMarkerIcon) {
              return (
                <Marker
                  key={poi.id}
                  position={center}
                  icon={poiMarkerIcon}
                  eventHandlers={{
                    click: () => onPointClick?.(poi),
                  }}
                >
                  {popupNode}
                </Marker>
              );
            }

            return (
              <CircleMarker
                key={poi.id}
                center={center}
                radius={8}
                pathOptions={{
                  color: poi.color,
                  fillColor: poi.color,
                  fillOpacity: 0.9,
                  weight: 2,
                  className: poi.markerClassName,
                }}
                eventHandlers={{
                  click: () => onPointClick?.(poi),
                }}
              >
                {/* poi.popup comes only from client-side in-repo constants
                    (spots/meetups) — DB JSON can't carry a React node, so
                    rendering it is safe (React renders strings as text). */}
                {popupNode}
              </CircleMarker>
            );
          }

          const isActive = activeRouteId === poi.id;
          const baseWeight = poi.roadHighlight?.weight || (poi.type === "loop" ? 6 : 4);

          if (poi.geojson) {
            return (
              <GeoJSON
                key={getPoiRenderKey(poi)}
                data={poi.geojson as GeoJsonObject}
                style={{
                  color: poi.color,
                  weight: isActive ? baseWeight + 2 : baseWeight,
                  opacity: isActive ? 1 : 0.9,
                  dashArray: poi.roadHighlight?.dashArray,
                  className: poi.roadHighlight?.glow ? "leaflet-road-glow" : undefined,
                }}
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
              key={getPoiRenderKey(poi)}
              positions={poi.coords}
              pathOptions={{
                color: poi.color,
                weight: isActive ? baseWeight + 2 : baseWeight,
                opacity: isActive ? 1 : 0.9,
                dashArray: poi.roadHighlight?.dashArray || (poi.type === "loop" ? undefined : "10, 10"),
                className: poi.roadHighlight?.glow ? "leaflet-road-glow" : undefined,
              }}
              eventHandlers={{
                click: () => setActiveRouteId((prev) => (prev === poi.id ? null : poi.id)),
                mouseover: (event) => event.target.setStyle({ weight: baseWeight + 2 }),
                mouseout: (event) => event.target.setStyle({ weight: isActive ? baseWeight + 2 : baseWeight }),
              }}
            />
          );
        })}

        {routeBadges.map(({ poi, start, km, icon }) => {
          return (
            <Marker
              key={`badge-${poi.id}`}
              position={start}
              icon={icon}
              eventHandlers={{ click: () => setActiveRouteId((prev) => (prev === poi.id ? null : poi.id)) }}
            >
              <Popup>
                <div className="min-w-[180px] max-w-[240px] space-y-1 p-1 text-[var(--mr-text)]">
                  <div className="text-sm font-semibold" style={{ color: poi.color }}>
                    {poi.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--mr-muted)]">
                    {poi.type === "loop" ? "Петля" : "Трек"}
                    {km != null && km >= 0.1 ? ` · ≈ ${km < 10 ? km.toFixed(1) : Math.round(km)} км` : ""}
                  </div>
                  {poi.note ? <div className="text-xs leading-snug opacity-80">{poi.note}</div> : null}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {children}
        <MapInteractionCapture onMapClick={onMapClick} onMapLongPress={onMapLongPress} />
        <MapFocusFlyer focus={focusPoint ?? null} />
      </MapContainer>
    </div>
  );
}
