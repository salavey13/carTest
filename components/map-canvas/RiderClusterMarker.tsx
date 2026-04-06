"use client";

import { memo, useMemo } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";

interface RiderClusterMarkerProps {
  lat: number;
  lng: number;
  count: number;
  onClick: () => void;
}

function createClusterIcon(count: number): L.DivIcon {
  const size = count >= 20 ? 52 : count >= 10 ? 46 : 40;
  const fontSize = count >= 100 ? 11 : 12;

  const html = `
    <div class="rider-cluster" style="width:${size}px;height:${size}px;">
      <span>${count}</span>
    </div>
    <style>
      .rider-cluster {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: radial-gradient(circle at 35% 30%, rgba(250, 204, 21, 0.95), rgba(217, 119, 6, 0.9));
        border: 2px solid rgba(17, 24, 39, 0.9);
        color: #111827;
        font-weight: 800;
        font-size: ${fontSize}px;
        font-family: system-ui, sans-serif;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35), 0 0 16px rgba(250, 204, 21, 0.35);
      }
    </style>
  `;

  return L.divIcon({
    html,
    className: "rider-cluster-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export const RiderClusterMarker = memo(function RiderClusterMarker({
  lat,
  lng,
  count,
  onClick,
}: RiderClusterMarkerProps) {
  const icon = useMemo(() => createClusterIcon(count), [count]);

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      title={`Cluster: ${count} riders`}
      alt={`Cluster of ${count} riders`}
      keyboard
      eventHandlers={{ click: onClick }}
      zIndexOffset={800}
    />
  );
});
