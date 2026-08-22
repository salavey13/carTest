import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { calcDurationSeconds, riderDisplayName, safeAverageSpeed } from "@/lib/map-riders";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [sessionRes, pointsRes] = await Promise.all([
    supabaseAdmin
      .from("map_rider_sessions")
      .select("*, users:user_id(username, full_name, avatar_url)")
      .eq("id", id)
      .single(),
    supabaseAdmin
      .from("map_rider_points")
      .select("lat, lon, speed_kmh, captured_at")
      .eq("session_id", id)
      .order("captured_at", { ascending: true })
      .limit(1500),
  ]);

  if (sessionRes.error) {
    return NextResponse.json({ success: false, error: sessionRes.error.message }, { status: 404 });
  }
  if (pointsRes.error) {
    return NextResponse.json({ success: false, error: pointsRes.error.message }, { status: 500 });
  }

  const session = sessionRes.data as any;
  const points = (pointsRes.data || []).map((point: any) => ({
    lat: point.lat,
    lon: point.lon,
    speedKmh: point.speed_kmh || 0,
    capturedAt: point.captured_at,
  }));

  const durationSeconds = Number(session.duration_seconds || calcDurationSeconds(session.started_at, session.ended_at));
  const totalDistanceKm = Number(session.total_distance_km || 0);

  return NextResponse.json({
    success: true,
    data: {
      session: {
        ...session,
        rider_name: riderDisplayName(session.users, session.user_id),
        duration_seconds: durationSeconds,
        avg_speed_kmh: Number((session.avg_speed_kmh || safeAverageSpeed(totalDistanceKm, durationSeconds)).toFixed(1)),
        total_distance_km: Number(totalDistanceKm.toFixed(1)),
        max_speed_kmh: Number(Number(session.max_speed_kmh || 0).toFixed(1)),
      },
      points,
    },
  });
}
