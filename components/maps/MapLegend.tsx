"use client";

import type { PointOfInterest } from '@/lib/map-utils';

export function MapLegend({ points }: { points: PointOfInterest[] }) {
  const routes = points.filter((point) => point.type !== 'point');
  const pois = points.filter((point) => point.type === 'point');

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Routes</div>
      {routes.map((route) => (
        <div key={route.id} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: route.color }} />
          <span>{route.name}</span>
        </div>
      ))}

      <div className="pt-2 text-xs uppercase tracking-wide text-muted-foreground">POI</div>
      {pois.map((poi) => (
        <div key={poi.id} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: poi.color }} />
          <span>{poi.name}</span>
        </div>
      ))}
    </div>
  );
}
