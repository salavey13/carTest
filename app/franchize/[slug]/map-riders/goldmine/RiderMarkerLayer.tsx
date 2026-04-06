// /components/map-riders/RiderMarkerLayer.tsx
// Manages all rider markers with viewport culling + clustering.
// Drop into <RacingMap> as a child.

"use client";

import { useMemo, useState, useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { RiderMarker } from "@/components/map-canvas/RiderMarker";
import { useMapRiders } from "@/hooks/useMapRidersContext";
import { riderDisplayName } from "@/lib/map-riders";

const CLUSTER_ZOOM_THRESHOLD = 14; // Below this zoom, cluster markers

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
  const displayRiders = useMemo(() => {
    if (zoom >= CLUSTER_ZOOM_THRESHOLD || visibleRiders.length <= 20) return visibleRiders;

    const cellPx = 60;
    const zoomScale = Math.pow(2, zoom);
    const grid = new Map<string, typeof visibleRiders>();

    for (const rider of visibleRiders) {
      const px = map.latLngToContainerPoint([rider.lat, rider.lng]);
      const cellKey = `${Math.floor(px.x / cellPx)},${Math.floor(px.y / cellPx)}`;
      if (!grid.has(cellKey)) grid.set(cellKey, []);
      grid.get(cellKey)!.push(rider);
    }

    // For single-rider cells, return the rider directly
    // For multi-rider cells, return the first rider (cluster rendering TODO)
    return Array.from(grid.values()).map((cell) => cell[0]);
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
      {displayRiders.map((rider) => {
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
