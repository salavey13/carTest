// /components/map-canvas/RiderMarker.tsx
// Custom rider marker with avatar, pulse ring, speed badge, heading arrow.
// Replaces the basic CircleMarker in RacingMap.tsx

"use client";

import { memo, useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { LiveRider } from "@/lib/map-riders-reducer";

const SPEED_COLORS: Record<string, string> = {
  slow: "#22c55e",    // <40 km/h
  medium: "#eab308",  // 40-80 km/h
  fast: "#ef4444",    // >80 km/h
};

function getSpeedColor(speedKmh: number): string {
  if (speedKmh > 80) return SPEED_COLORS.fast;
  if (speedKmh > 40) return SPEED_COLORS.medium;
  return SPEED_COLORS.slow;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "R";
}

interface RiderMarkerProps {
  rider: LiveRider;
  riderName: string;
  isSelected: boolean;
  onClick: () => void;
}

function createRiderIcon(rider: LiveRider, riderName: string, isSelected: boolean): L.DivIcon {
  const initials = getInitials(riderName);
  const speedColor = getSpeedColor(rider.speed_kmh);
  const borderColor = rider.isSelf ? "#facc15" : rider.status === "stale" ? "#6b7280" : "#60a5fa";
  const isStale = rider.status === "stale";
  const speed = Math.round(rider.speed_kmh);

  const html = `
    <div class="rider-marker ${isStale ? "rider-marker--stale" : ""} ${isSelected ? "rider-marker--selected" : ""}"
         style="--marker-border: ${borderColor}; --marker-speed-color: ${speedColor};">
      <div class="rider-marker__ring"></div>
      <div class="rider-marker__avatar">${initials}</div>
      ${speed > 0 ? `<div class="rider-marker__speed">${speed}</div>` : ""}
      ${!isStale ? '<div class="rider-marker__pulse"></div>' : ""}
    </div>
    <style>
      .rider-marker {
        position: relative;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .rider-marker__avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #111827;
        border: 3px solid var(--marker-border, #60a5fa);
        color: white;
        font-size: 13px;
        font-weight: 700;
        font-family: system-ui, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        position: relative;
        transition: border-color 0.3s, transform 0.3s;
      }
      .rider-marker--selected .rider-marker__avatar {
        transform: scale(1.2);
        box-shadow: 0 0 16px var(--marker-border);
      }
      .rider-marker__speed {
        position: absolute;
        top: -4px;
        right: -4px;
        background: var(--marker-speed-color, #22c55e);
        color: #000;
        font-size: 10px;
        font-weight: 700;
        font-family: system-ui, sans-serif;
        padding: 1px 5px;
        border-radius: 8px;
        z-index: 3;
        min-width: 20px;
        text-align: center;
      }
      .rider-marker__pulse {
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid var(--marker-border, #60a5fa);
        animation: rider-pulse 2s ease-out infinite;
        z-index: 1;
      }
      .rider-marker--stale .rider-marker__avatar {
        opacity: 0.4;
        border-color: #6b7280;
      }
      .rider-marker--stale .rider-marker__speed {
        background: #6b7280;
      }
      @keyframes rider-pulse {
        0% { transform: scale(1); opacity: 0.6; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    </style>
  `;

  return L.divIcon({
    html,
    className: "rider-div-icon",
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -32],
  });
}

export const RiderMarker = memo(function RiderMarker({ rider, riderName, isSelected, onClick }: RiderMarkerProps) {
  const icon = useMemo(() => createRiderIcon(rider, riderName, isSelected), [rider, riderName, isSelected]);

  return (
    <Marker
      position={[rider.lat, rider.lng]}
      icon={icon}
      eventHandlers={{ click: onClick }}
      zIndexOffset={isSelected ? 1000 : rider.isSelf ? 500 : 0}
    >
      <Popup>
        <div style={{ fontFamily: "system-ui, sans-serif", minWidth: 120 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{riderName}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            {Math.round(rider.speed_kmh)} км/ч • {rider.status === "stale" ? "⚠️ нет данных" : "🟢 в эфире"}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}, (prev, next) => {
  // Only re-render if position changed significantly or status changed
  const posEqual = Math.abs(prev.rider.lat - next.rider.lat) < 0.00005 &&
                   Math.abs(prev.rider.lng - next.rider.lng) < 0.00005;
  const speedEqual = Math.abs(prev.rider.speed_kmh - next.rider.speed_kmh) < 2;
  const statusEqual = prev.rider.status === next.rider.status;
  const selectedEqual = prev.isSelected === next.isSelected;
  return posEqual && speedEqual && statusEqual && selectedEqual;
});
