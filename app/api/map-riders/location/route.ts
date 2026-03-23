import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-server";
import { haversineKm, safeAverageSpeed } from "@/lib/map-riders";

const locationSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().min(1),
  crewSlug: z.string().min(1).default("vip-bike"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(320).default(0),
  headingDeg: z.number().min(0).max(360).optional(),
  accuracyMeters: z.number().min(0).max(5000).optional(),
  capturedAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const capturedAt = payload.capturedAt || new Date().toISOString();

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("map_rider_sessions")
    .select("id, started_at, latest_lat, latest_lon, total_distance_km, max_speed_kmh, route_bounds, stats")
    .eq("id", payload.sessionId)
    .eq("user_id", payload.userId)
    .eq("crew_slug", payload.crewSlug)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ success: false, error: sessionError?.message || "Session not found" }, { status: 404 });
  }

  let totalDistanceKm = Number(session.total_distance_km || 0);
  if (typeof session.latest_lat === "number" && typeof session.latest_lon === "number") {
    totalDistanceKm += haversineKm({ lat: session.latest_lat, lon: session.latest_lon }, { lat: payload.lat, lon: payload.lon });
  }

  const startedAtMs = new Date(session.started_at).getTime();
  const durationSeconds = Math.max(0, Math.round((new Date(capturedAt).getTime() - startedAtMs) / 1000));
  const avgSpeedKmh = safeAverageSpeed(totalDistanceKm, durationSeconds);
  const maxSpeedKmh = Math.max(Number(session.max_speed_kmh || 0), payload.speedKmh || 0);
  const prevBounds = (session.route_bounds || {}) as Record<string, number>;
  const nextBounds = {
    top: Math.max(prevBounds.top ?? payload.lat, payload.lat),
    bottom: Math.min(prevBounds.bottom ?? payload.lat, payload.lat),
    left: Math.min(prevBounds.left ?? payload.lon, payload.lon),
    right: Math.max(prevBounds.right ?? payload.lon, payload.lon),
  };

  const { error: pointError } = await supabaseAdmin.from("map_rider_points").insert({
    session_id: payload.sessionId,
    user_id: payload.userId,
    crew_slug: payload.crewSlug,
    lat: payload.lat,
    lon: payload.lon,
    speed_kmh: payload.speedKmh,
    heading_deg: payload.headingDeg || null,
    accuracy_meters: payload.accuracyMeters || null,
    captured_at: capturedAt,
  });

  if (pointError) {
    return NextResponse.json({ success: false, error: pointError.message }, { status: 500 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("map_rider_sessions")
    .update({
      latest_lat: payload.lat,
      latest_lon: payload.lon,
      latest_speed_kmh: payload.speedKmh,
      last_ping_at: capturedAt,
      total_distance_km: Number(totalDistanceKm.toFixed(3)),
      duration_seconds: durationSeconds,
      avg_speed_kmh: Number(avgSpeedKmh.toFixed(2)),
      max_speed_kmh: Number(maxSpeedKmh.toFixed(2)),
      route_bounds: nextBounds,
      stats: {
        ...(session.stats || {}),
        lastAccuracyMeters: payload.accuracyMeters || null,
        lastHeadingDeg: payload.headingDeg || null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.sessionId);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { totalDistanceKm, durationSeconds, avgSpeedKmh, maxSpeedKmh } });
}
