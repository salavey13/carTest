// /components/map-riders/RiderMarkerLayer.tsx
// Manages all rider markers with viewport culling + clustering.
// Drop into <RacingMap> as a child.

"use client";

import { useMemo, useState, useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { RiderMarker } from "@/components/map-canvas/RiderMarker";
import { RiderClusterMarker } from "@/components/map-canvas/RiderClusterMarker";
import { useMapRiders } from "@/hooks/useMapRidersContext";
import type { LiveRider } from "@/lib/map-riders-reducer";
import { riderDisplayName } from "@/lib/map-riders";

const CLUSTER_ZOOM_THRESHOLD = 14; // Below this zoom, cluster markers
const CLUSTER_CELL_PX = 60;

type DisplayItem =
  | { type: "rider"; rider: LiveRider }
  | { type: "cluster"; id: string; lat: number; lng: number; count: number };

export function RiderMarkerLayer() {
  const { state, fetchSessionDetail } = useMapRiders();
  const map = useMap();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Track viewport bounds for culling
  const [bounds, setBounds] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null);
  useMapEvents({
    moveend() {
      const b = map.getBounds();
      setBounds({ top: b.getNorth(), bottom: b.getSouth(), left: b.getWest(), right: b.getEast() });
    },
    zoomend() {
      const b = map.getBounds();
      setBounds({ top: b.getNorth(), bottom: b.getSouth(), left: b.getWest(), right: b.getEast() });
    },
  });

  const zoom = map.getZoom();

  // ── Viewport culling ──
  const visibleRiders = useMemo(() => {
    const allRiders = Array.from(state.liveRiders.values()).filter((r) => r.status !== "evicted");
    if (!bounds) return allRiders;

    const latPad = (bounds.top - bounds.bottom) * 0.2;
    const lngPad = (bounds.right - bounds.left) * 0.2;

    return allRiders.filter(
      (r) =>
        r.lat >= bounds.bottom - latPad &&
        r.lat <= bounds.top + latPad &&
        r.lng >= bounds.left - lngPad &&
        r.lng <= bounds.right + lngPad,
    );
  }, [state.liveRiders, bounds]);

  // ── Simple grid clustering at low zoom ──
  const displayItems = useMemo<DisplayItem[]>(() => {
    if (zoom >= CLUSTER_ZOOM_THRESHOLD || visibleRiders.length <= 20) {
      return visibleRiders.map((rider) => ({ type: "rider", rider }));
    }

    const grid = new Map<string, LiveRider[]>();

    for (const rider of visibleRiders) {
      const px = map.latLngToContainerPoint([rider.lat, rider.lng]); // stable during current viewport
      const cellKey = `${Math.floor(px.x / CLUSTER_CELL_PX)},${Math.floor(px.y / CLUSTER_CELL_PX)}`;
      if (!grid.has(cellKey)) grid.set(cellKey, []);
      grid.get(cellKey)!.push(rider);
    }

    const next: DisplayItem[] = [];
    for (const [id, cell] of grid) {
      if (cell.length === 1) {
        next.push({ type: "rider", rider: cell[0] });
        continue;
      }
      const avgLat = cell.reduce((sum, rider) => sum + rider.lat, 0) / cell.length;
      const avgLng = cell.reduce((sum, rider) => sum + rider.lng, 0) / cell.length;
      next.push({ type: "cluster", id, lat: avgLat, lng: avgLng, count: cell.length });
    }

    return next;
  }, [visibleRiders, zoom, map]);

  const handleRiderClick = useCallback(
    (rider: (typeof visibleRiders)[0]) => {
      setSelectedUserId(rider.user_id);
      map.flyTo([rider.lat, rider.lng], Math.max(map.getZoom(), 15), { duration: 0.5 });

      // Load session detail if we have a session
      const session = state.sessions.find((s) => s.user_id === rider.user_id);
      if (session) fetchSessionDetail(session.id);
    },
    [map, state.sessions, fetchSessionDetail],
  );

  return (
    <>
      {displayItems.map((item) => {
        if (item.type === "cluster") {
          return (
            <RiderClusterMarker
              key={`cluster:${item.id}`}
              lat={item.lat}
              lng={item.lng}
              count={item.count}
              onClick={() => {
                const nextZoom = Math.min(Math.max(map.getZoom(), 13) + 1, 16);
                map.flyTo([item.lat, item.lng], nextZoom, { duration: 0.45 });
              }}
            />
          );
        }

        const rider = item.rider;
        const session = state.sessions.find((s) => s.user_id === rider.user_id);
        const name = riderDisplayName(session?.users, rider.user_id);
        return (
          <RiderMarker
            key={rider.user_id}
            rider={rider}
            riderName={name}
            isSelected={rider.user_id === selectedUserId}
            onClick={() => handleRiderClick(rider)}
          />
        );
      })}
    </>
  );
}
