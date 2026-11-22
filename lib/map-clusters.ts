// lib/map-clusters.ts
// ─────────────────────────────────────────────────────────────────────────────
// Zoom-aware icon declutter (2026-10-05, boss: «too many icons, looks messy —
// group and ungroup depending on zoom»):
//   · LOW zoom  → nearby point-POIs collapse into cluster bubbles (count +
//     dominant color/icon), the map reads at a glance;
//   · HIGH zoom → bubbles ungroup back into the real markers (popups intact).
//
// Best-practice notes (mapbox-gl supercluster semantics, grid flavor):
//   · clusters form in LAT/LNG space with a zoom-derived cell size (~68 px on
//     screen) so the result is viewport-independent and deterministic;
//   · important pins survive clustering longer via `keepZoom` — a wall post
//     stays individual from z10 while riders only from z14 (post points are
//     the distribution layer — boss: «highlight points related to posts
//     more»);
//   · `keepZoom: 99` (HQ) never clusters; single-occupant cells stay as is;
//   · pure + no deps + no randomness → same inputs, same output, SSR-safe.
// ─────────────────────────────────────────────────────────────────────────────

import type { PointOfInterest } from "@/lib/map-utils";

/** Cluster bubble target size on screen (px) — ~2× a 34px marker. */
const CLUSTER_CELL_PX = 68;
/** Web-mercator world width at zoom 0 (Leaflet's 256px tiles). */
const WORLD_PX_Z0 = 256;
/** Zoom cap for the fly-in from a cluster bubble tap. */
export const CLUSTER_FLY_ZOOM_CAP = 17;

export interface ClusterOptions {
  /**
   * Center latitude for the mercator cos() correction — the map container
   * passes its current center; Nizhny Novgorod (≈56.3°) needs lng cells
   * ~1.8× wider than lat cells or the grid turns lopsided.
   */
  centerLat?: number;
}

/**
 * Collapse type==="point" POIs into cluster bubbles below their keepZoom.
 * Path/loop POIs and every POI with keepZoom ≥ zoom pass through untouched.
 * Clusters carry `id: "cl-…"` and `count ≥ 2` (RacingMap intercepts the tap
 * and flies in instead of opening a popup).
 */
export function clusterPoiPoints(
  points: PointOfInterest[],
  zoom: number,
  opts?: ClusterOptions,
): PointOfInterest[] {
  const z = Number.isFinite(zoom) ? Math.max(0, Math.min(22, zoom)) : null;
  if (z == null) return points;

  const degPerPx = 360 / (WORLD_PX_Z0 * Math.pow(2, z));
  const cosLat = Math.cos(((opts?.centerLat ?? 0) * Math.PI) / 180);
  const cellLat = Math.max(1e-9, CLUSTER_CELL_PX * degPerPx * Math.max(0.2, cosLat));
  const cellLng = Math.max(1e-9, CLUSTER_CELL_PX * degPerPx);

  const cells = new Map<
    string,
    { pois: PointOfInterest[]; lat: number; lng: number; weight: number }
  >();
  const passed: PointOfInterest[] = [];

  for (const poi of points) {
    if (poi.type !== "point") {
      passed.push(poi);
      continue;
    }
    const center = poi.coords?.[0];
    if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
      passed.push(poi);
      continue;
    }
    // keepZoom: the zoom level from which the pin must stay individual.
    // 99 = never cluster (HQ); wall posts get 10 (visible longer), riders 14.
    const keepZoom = typeof poi.keepZoom === "number" ? poi.keepZoom : 13;
    if (z >= keepZoom) {
      passed.push(poi);
      continue;
    }
    const gx = Math.floor(center[1] / cellLng);
    const gy = Math.floor(center[0] / cellLat);
    const key = `${gx}:${gy}`;
    const cell = cells.get(key);
    if (cell) {
      cell.pois.push(poi);
      cell.lat += center[0];
      cell.lng += center[1];
      cell.weight += 1;
    } else {
      cells.set(key, { pois: [poi], lat: center[0], lng: center[1], weight: 1 });
    }
  }

  const clustered: PointOfInterest[] = [...cells.values()].map((cell) => {
    const n = cell.pois.length;
    if (n === 1) return cell.pois[0]; // sparse cell — nothing to group
    // dominant color = the most frequent color in the cell (ties → first
    // seen, deterministic by input order)
    const colorCounts = new Map<string, number>();
    for (const poi of cell.pois) {
      const c = poi.color || "#f97316";
      colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
    }
    let dominant = "#f97316";
    let dominantN = 0;
    for (const [color, count] of colorCounts) {
      if (count > dominantN) {
        dominant = color;
        dominantN = count;
      }
    }
    const avgLat = cell.lat / n;
    const avgLng = cell.lng / n;
    const hasWallPost = cell.pois.some((p) => p.id.startsWith("wallpost-"));
    return {
      id: `cl-${Math.floor(avgLat * 10000)}-${Math.floor(avgLng * 10000)}`,
      name: `${n} ${pluralRuRu(n, ["точка", "точки", "точек"])} — тапни, чтобы раскрыть`,
      type: "point" as const,
      icon: hasWallPost ? "::FaCameraRetro::" : "::FaLayerGroup::",
      color: dominant,
      coords: [[avgLat, avgLng]] as [number, number][],
      count: n,
      markerSize: n >= 6 ? ("lg" as const) : ("md" as const),
      markerClassName: "mr-poi--cluster",
      // cluster of a cluster never happens (keepZoom 99)
      keepZoom: 99,
    };
  });

  return [...passed, ...clustered];
}

/** Local plural (duplicate-free of the app's helper to keep this file pure). */
function pluralRuRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
