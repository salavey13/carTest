import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { calcDurationSeconds, riderDisplayName, safeAverageSpeed } from "@/lib/map-riders";

export async function GET(request: NextRequest) {
  const crewSlug = request.nextUrl.searchParams.get("slug") || "vip-bike";

  const [sessionsRes, meetupsRes] = await Promise.all([
    supabaseAdmin
      .from("map_rider_sessions")
      .select("*, users:user_id(username, full_name, avatar_url)")
      .eq("crew_slug", crewSlug)
      .order("started_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("map_rider_meetups")
      .select("*, users:created_by_user_id(username, full_name)")
      .eq("crew_slug", crewSlug)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (sessionsRes.error) {
    return NextResponse.json({ success: false, error: sessionsRes.error.message }, { status: 500 });
  }
  if (meetupsRes.error) {
    return NextResponse.json({ success: false, error: meetupsRes.error.message }, { status: 500 });
  }

  const sessions = (sessionsRes.data || []) as any[];
  const meetups = (meetupsRes.data || []) as any[];
  const activeSessions = sessions.filter((session) => session.status === "active" && session.sharing_enabled);
  const completedSessions = sessions.filter((session) => session.status === "completed");

  const weeklyCutoff = new Date();
  weeklyCutoff.setUTCDate(weeklyCutoff.getUTCDate() - 7);

  const weeklyMap = new Map<string, { userId: string; riderName: string; distanceKm: number; sessions: number; avgSpeedAccumulator: number; maxSpeed: number }>();
  for (const session of sessions) {
    if (new Date(session.started_at) < weeklyCutoff) continue;
    const current = weeklyMap.get(session.user_id) || {
      userId: session.user_id,
      riderName: riderDisplayName(session.users, session.user_id),
      distanceKm: 0,
      sessions: 0,
      avgSpeedAccumulator: 0,
      maxSpeed: 0,
    };
    current.distanceKm += Number(session.total_distance_km || 0);
    current.sessions += 1;
    current.avgSpeedAccumulator += Number(session.avg_speed_kmh || 0);
    current.maxSpeed = Math.max(current.maxSpeed, Number(session.max_speed_kmh || 0));
    weeklyMap.set(session.user_id, current);
  }

  const weeklyLeaderboard = Array.from(weeklyMap.values())
    .map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      riderName: row.riderName,
      distanceKm: Number(row.distanceKm.toFixed(1)),
      sessions: row.sessions,
      avgSpeedKmh: Number((row.avgSpeedAccumulator / Math.max(row.sessions, 1)).toFixed(1)),
      maxSpeedKmh: Number(row.maxSpeed.toFixed(1)),
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const latestCompleted = completedSessions.slice(0, 8).map((session) => ({
    ...session,
    rider_name: riderDisplayName(session.users, session.user_id),
    duration_seconds: session.duration_seconds || calcDurationSeconds(session.started_at, session.ended_at),
    avg_speed_kmh:
      session.avg_speed_kmh || safeAverageSpeed(Number(session.total_distance_km || 0), Number(session.duration_seconds || calcDurationSeconds(session.started_at, session.ended_at))),
  }));

  return NextResponse.json({
    success: true,
    data: {
      activeSessions,
      meetups,
      weeklyLeaderboard,
      latestCompleted,
      stats: {
        activeRiders: activeSessions.length,
        meetupCount: meetups.length,
        totalWeeklyDistanceKm: Number(weeklyLeaderboard.reduce((sum, row) => sum + row.distanceKm, 0).toFixed(1)),
      },
    },
  });
}
