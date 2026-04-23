import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { haversineKm, safeAverageSpeed } from "@/lib/map-riders";
import { guardMapRidersWriteRequest, applyRateLimitHeaders } from "@/lib/map-riders-security";
import { enforceRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";

const routePointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(320).default(0),
  headingDeg: z.number().min(0).max(360).nullable().optional(),
  accuracyMeters: z.number().min(0).max(5000).nullable().optional(),
  capturedAt: z.string().datetime(),
});

const startSchema = z.object({
  action: z.enum(["start", "stop"]),
  userId: z.string().min(1),
  crewSlug: z.string().min(1).default("vip-bike"),
  sessionId: z.string().uuid().optional(),
  rideName: z.string().trim().max(120).optional(),
  vehicleLabel: z.string().trim().max(120).optional(),
  rideMode: z.enum(["rental", "personal"]).default("rental"),
  visibility: z.enum(["crew", "all_auth"]).default("crew"),
  routePoints: z.array(routePointSchema).max(20000).optional().default([]),
});

export async function POST(request: NextRequest) {
  const guard = await guardMapRidersWriteRequest(request);
  if (!guard.ok) {
    return guard.response;
  }

  const body = await request.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const limit = enforceRateLimit(`map-riders:session:${payload.userId}`, 10, 60_000);
  if (!limit.allowed) {
    const response = NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
    applyRateLimitHeaders(response, limit.retryAfterSeconds, limit.remaining, limit.limit);
    return response;
  }

  if (payload.action === "start") {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("map_rider_sessions")
      .update({ status: "completed", sharing_enabled: false, ended_at: now, updated_at: now })
      .eq("user_id", payload.userId)
      .eq("crew_slug", payload.crewSlug)
      .eq("status", "active");

    const { data, error } = await supabaseAdmin
      .from("map_rider_sessions")
      .insert({
        user_id: payload.userId,
        crew_slug: payload.crewSlug,
        ride_name: payload.rideName || null,
        vehicle_label: payload.vehicleLabel || null,
        ride_mode: payload.rideMode,
        visibility: payload.visibility,
        status: "active",
        sharing_enabled: true,
        started_at: now,
        last_ping_at: now,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  }

  const sessionId = payload.sessionId;
  if (!sessionId) {
    return NextResponse.json({ success: false, error: "sessionId is required for stop action" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("map_rider_sessions")
    .select("id, started_at")
    .eq("id", sessionId)
    .eq("user_id", payload.userId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ success: false, error: existingError?.message || "Session not found" }, { status: 404 });
  }

  const sortedPoints = [...payload.routePoints].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

  let totalDistanceKm = 0;
  let maxSpeedKmh = 0;
  let latestLat: number | null = null;
  let latestLon: number | null = null;
  let latestSpeedKmh = 0;
  let routeBounds: { top: number; bottom: number; left: number; right: number } | null = null;

  for (let index = 0; index < sortedPoints.length; index += 1) {
    const point = sortedPoints[index];
    if (index > 0) {
      const prev = sortedPoints[index - 1];
      totalDistanceKm += haversineKm({ lat: prev.lat, lon: prev.lon }, { lat: point.lat, lon: point.lon });
    }

    maxSpeedKmh = Math.max(maxSpeedKmh, Number(point.speedKmh || 0));
    latestLat = point.lat;
    latestLon = point.lon;
    latestSpeedKmh = Number(point.speedKmh || 0);

    routeBounds = routeBounds
      ? {
          top: Math.max(routeBounds.top, point.lat),
          bottom: Math.min(routeBounds.bottom, point.lat),
          left: Math.min(routeBounds.left, point.lon),
          right: Math.max(routeBounds.right, point.lon),
        }
      : {
          top: point.lat,
          bottom: point.lat,
          left: point.lon,
          right: point.lon,
        };
  }

  if (sortedPoints.length) {
    const chunkSize = 1000;
    for (let i = 0; i < sortedPoints.length; i += chunkSize) {
      const chunk = sortedPoints.slice(i, i + chunkSize);
      const { error: pointsError } = await supabaseAdmin.from("map_rider_points").insert(
        chunk.map((point) => ({
          session_id: sessionId,
          user_id: payload.userId,
          crew_slug: payload.crewSlug,
          lat: point.lat,
          lon: point.lon,
          speed_kmh: point.speedKmh,
          heading_deg: point.headingDeg || null,
          accuracy_meters: point.accuracyMeters || null,
          captured_at: point.capturedAt,
        })),
      );

      if (pointsError) {
        return NextResponse.json({ success: false, error: pointsError.message }, { status: 500 });
      }
    }
  }

  const endedAt = new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(existing.started_at).getTime()) / 1000));
  const avgSpeedKmh = safeAverageSpeed(totalDistanceKm, durationSeconds);

  const { error } = await supabaseAdmin
    .from("map_rider_sessions")
    .update({
      status: "completed",
      sharing_enabled: false,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      total_distance_km: Number(totalDistanceKm.toFixed(3)),
      avg_speed_kmh: Number(avgSpeedKmh.toFixed(2)),
      max_speed_kmh: Number(maxSpeedKmh.toFixed(2)),
      latest_lat: latestLat,
      latest_lon: latestLon,
      latest_speed_kmh: Number(latestSpeedKmh.toFixed(2)),
      route_bounds: routeBounds || {},
      updated_at: endedAt,
    })
    .eq("id", sessionId)
    .eq("user_id", payload.userId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("live_locations").delete().eq("user_id", payload.userId).eq("crew_slug", payload.crewSlug);

  return NextResponse.json({ success: true });
}
