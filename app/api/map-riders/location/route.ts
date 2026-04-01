import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-server";

const locationSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().min(1),
  crewSlug: z.string().min(1).default("vip-bike"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(320).default(0),
  headingDeg: z.number().min(0).max(360).nullable().optional(),
  accuracyMeters: z.number().min(0).max(5000).nullable().optional(),
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

  const liveLocationUpsert = supabaseAdmin.from("live_locations").upsert(
    {
      user_id: payload.userId,
      crew_slug: payload.crewSlug,
      lat: payload.lat,
      lng: payload.lon,
      speed_kmh: payload.speedKmh,
      heading: payload.headingDeg || null,
      is_riding: true,
      updated_at: capturedAt,
    },
    { onConflict: "user_id" },
  );

  const sessionUpdate = supabaseAdmin
    .from("map_rider_sessions")
    .update({
      latest_lat: payload.lat,
      latest_lon: payload.lon,
      latest_speed_kmh: payload.speedKmh,
      last_ping_at: capturedAt,
      updated_at: new Date().toISOString(),
      stats: {
        lastAccuracyMeters: payload.accuracyMeters || null,
        lastHeadingDeg: payload.headingDeg || null,
      },
    })
    .eq("id", payload.sessionId)
    .eq("user_id", payload.userId)
    .eq("crew_slug", payload.crewSlug)
    .eq("status", "active");

  const [{ error: liveError }, { error: sessionError }] = await Promise.all([liveLocationUpsert, sessionUpdate]);

  if (liveError) {
    return NextResponse.json({ success: false, error: liveError.message }, { status: 500 });
  }

  if (sessionError) {
    return NextResponse.json({ success: false, error: sessionError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { capturedAt } });
}
