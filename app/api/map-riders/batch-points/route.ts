// /app/api/map-riders/batch-points/route.ts
// Batch write GPS points (flushed every 5s by client hook).
// Replaces per-tick writes to /api/map-riders/location.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardMapRidersWriteRequest, applyRateLimitHeaders } from "@/lib/map-riders-security";
import { enforceRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(320).default(0),
  headingDeg: z.number().min(0).max(360).nullable().optional(),
  accuracyMeters: z.number().min(0).max(5000).nullable().optional(),
  capturedAt: z.string().datetime(),
});

const batchSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().min(1),
  crewSlug: z.string().min(1).default("vip-bike"),
  points: z.array(pointSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  const guard = await guardMapRidersWriteRequest(request);
  if (!guard.ok) {
    return guard.response;
  }

  const body = await request.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { sessionId, userId, crewSlug, points } = parsed.data;
  const limit = enforceRateLimit(`map-riders:batch-points:${userId}`, 30, 60_000);
  if (!limit.allowed) {
    const response = NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
    applyRateLimitHeaders(response, limit.retryAfterSeconds, limit.remaining, limit.limit);
    return response;
  }

  // 1) Upsert live_locations with the LAST point (most recent position)
  const lastPoint = points[points.length - 1];
  const { error: liveError } = await supabaseAdmin.from("live_locations").upsert(
    {
      user_id: userId,
      crew_slug: crewSlug,
      lat: lastPoint.lat,
      lng: lastPoint.lon,
      speed_kmh: lastPoint.speedKmh,
      heading: lastPoint.headingDeg || null,
      is_riding: true,
      updated_at: lastPoint.capturedAt,
    },
    { onConflict: "user_id" },
  );

  if (liveError) {
    return NextResponse.json({ success: false, error: liveError.message }, { status: 500 });
  }

  // 2) Update session with latest position
  await supabaseAdmin
    .from("map_rider_sessions")
    .update({
      latest_lat: lastPoint.lat,
      latest_lon: lastPoint.lon,
      latest_speed_kmh: lastPoint.speedKmh,
      last_ping_at: lastPoint.capturedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "active");

  // 3) Insert points into map_rider_points (history) in chunks
  const rows = points.map((p) => ({
    session_id: sessionId,
    user_id: userId,
    crew_slug: crewSlug,
    lat: p.lat,
    lon: p.lon,
    speed_kmh: p.speedKmh,
    heading_deg: p.headingDeg || null,
    accuracy_meters: p.accuracyMeters || null,
    captured_at: p.capturedAt,
  }));

  // Chunk insert (max 1000 per Supabase)
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const { error: pointsError } = await supabaseAdmin.from("map_rider_points").insert(chunk);
    if (pointsError) {
      return NextResponse.json({ success: false, error: pointsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, data: { written: points.length } });
}
