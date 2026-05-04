"use client";

import { Fragment, useMemo } from "react";
import { Polyline } from "react-leaflet";

type RoutePoint = { lat: number; lon: number; speedKmh: number; capturedAt: string };

import { speedToSegmentColor } from "@/components/map-riders/speedGradient";

export function SpeedGradientRoute({ points }: { points: RoutePoint[] }) {
  const segments = useMemo(() => {
    if (points.length < 2) return [];
    const out: Array<{ id: string; positions: [number, number][]; color: string }> = [];
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const current = points[i];
      out.push({
        id: `${current.capturedAt}-${i}`,
        positions: [
          [prev.lat, prev.lon],
          [current.lat, current.lon],
        ],
        color: speedToSegmentColor(current.speedKmh),
      });
    }
    return out;
  }, [points]);

  if (!segments.length) return null;

  return (
    <Fragment>
      {segments.map((segment) => (
        <Polyline
          key={segment.id}
          positions={segment.positions}
          pathOptions={{
            color: segment.color,
            weight: 5,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ))}
    </Fragment>
  );
}
