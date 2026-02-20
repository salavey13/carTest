"use client";

import { VibeMap } from "@/components/VibeMap";
import type { MapBounds, PointOfInterest } from "@/lib/map-utils";

interface FranchizeContactsMapProps {
  gps: string;
  address: string;
  mapImageUrl?: string;
  mapBounds?: MapBounds;
}

const DEFAULT_BOUNDS: MapBounds = {
  top: 56.42,
  bottom: 56.08,
  left: 43.66,
  right: 44.12,
};

function toPoint(gps: string, address: string): PointOfInterest[] {
  const [latRaw, lonRaw] = gps.split(",").map((value) => value.trim());
  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return [];
  }

  return [
    {
      id: "franchize-hq",
      name: address || "HQ",
      type: "point",
      icon: "::FaLocationDot::",
      color: "bg-brand-yellow",
      coords: [[lat, lon]],
    },
  ];
}

export function FranchizeContactsMap({ gps, address, mapImageUrl, mapBounds }: FranchizeContactsMapProps) {
  const points = toPoint(gps, address);

  if (points.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Карта появится после добавления coordinates в metadata.contacts.map.gps
      </div>
    );
  }

  return (
    <div className="h-[420px] overflow-hidden rounded-xl border border-border/70">
      <VibeMap points={points} bounds={mapBounds ?? DEFAULT_BOUNDS} imageUrl={mapImageUrl} />
    </div>
  );
}
