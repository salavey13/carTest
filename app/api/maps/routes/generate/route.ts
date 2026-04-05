import { NextRequest, NextResponse } from "next/server";
import { buildRoadGeojsonFromWaypoints } from "@/lib/map-actions";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rawWaypoints = Array.isArray(body?.waypoints) ? body.waypoints : [];
  const waypoints = rawWaypoints
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => [Number(point[0]), Number(point[1])] as [number, number])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));

  if (waypoints.length < 2) {
    return NextResponse.json({ success: false, error: "Need at least two [lat, lon] waypoints" }, { status: 400 });
  }

  const result = await buildRoadGeojsonFromWaypoints(waypoints);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || "Failed to generate road route" }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
