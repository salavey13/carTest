import { calcDurationSeconds, riderDisplayName, safeAverageSpeed } from "@/lib/map-riders";
import { supabaseAdmin } from "@/lib/supabase-server";

type SessionRow = Record<string, any>;
type MeetupRow = Record<string, any>;
type LiveLocationRow = Record<string, any>;

export type WeeklyLeaderboardRow = {
  rank: number;
  userId: string;
  riderName: string;
  distanceKm: number;
  sessions: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
};

export async function fetchOverviewData(crewSlug: string) {
  const [sessionsRes, meetupsRes, liveRes] = await Promise.all([
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
    supabaseAdmin
      .from("live_locations")
      .select("user_id, crew_slug, lat, lng, speed_kmh, updated_at")
      .eq("crew_slug", crewSlug)
      .order("updated_at", { ascending: false })
      .limit(150),
  ]);

  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (meetupsRes.error) throw new Error(meetupsRes.error.message);
  if (liveRes.error) throw new Error(liveRes.error.message);

  const sessions = (sessionsRes.data || []) as SessionRow[];
  const meetups = (meetupsRes.data || []) as MeetupRow[];
  const liveLocations = (liveRes.data || []) as LiveLocationRow[];

  const activeSessions = sessions.filter((session) => session.status === "active" && session.sharing_enabled);
  const completedSessions = sessions.filter((session) => session.status === "completed");

  const latestCompleted = completedSessions.slice(0, 8).map((session) => ({
    ...session,
    rider_name: riderDisplayName(session.users, session.user_id),
    duration_seconds: session.duration_seconds || calcDurationSeconds(session.started_at, session.ended_at),
    avg_speed_kmh:
      session.avg_speed_kmh ||
      safeAverageSpeed(Number(session.total_distance_km || 0), Number(session.duration_seconds || calcDurationSeconds(session.started_at, session.ended_at))),
  }));

  return {
    sessions,
    meetups,
    liveLocations,
    activeSessions,
    latestCompleted,
    stats: {
      activeRiders: Math.max(activeSessions.length, liveLocations.length),
      meetupCount: meetups.length,
    },
  };
}

function computeWeeklyLeaderboardFromSessions(sessions: SessionRow[]): WeeklyLeaderboardRow[] {
  const weeklyCutoff = new Date();
  weeklyCutoff.setUTCDate(weeklyCutoff.getUTCDate() - 7);

  const weeklyMap = new Map<
    string,
    { userId: string; riderName: string; distanceKm: number; sessions: number; avgSpeedAccumulator: number; maxSpeed: number }
  >();

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

  return Array.from(weeklyMap.values())
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
}

export async function fetchWeeklyLeaderboard(crewSlug: string, sessionsForFallback?: SessionRow[]): Promise<WeeklyLeaderboardRow[]> {
  const leaderboardRes = await supabaseAdmin
    .from("mv_map_riders_weekly_leaderboard")
    .select("rank, user_id, rider_name, distance_km, sessions, avg_speed_kmh, max_speed_kmh")
    .eq("crew_slug", crewSlug)
    .order("rank", { ascending: true })
    .limit(100);

  if (!leaderboardRes.error && leaderboardRes.data) {
    return leaderboardRes.data.map((row: any) => ({
      rank: Number(row.rank || 0),
      userId: row.user_id,
      riderName: row.rider_name,
      distanceKm: Number(row.distance_km || 0),
      sessions: Number(row.sessions || 0),
      avgSpeedKmh: Number(row.avg_speed_kmh || 0),
      maxSpeedKmh: Number(row.max_speed_kmh || 0),
    }));
  }

  if (sessionsForFallback) {
    return computeWeeklyLeaderboardFromSessions(sessionsForFallback);
  }

  const fallbackSessionRes = await supabaseAdmin
    .from("map_rider_sessions")
    .select("*, users:user_id(username, full_name, avatar_url)")
    .eq("crew_slug", crewSlug)
    .order("started_at", { ascending: false })
    .limit(150);

  if (fallbackSessionRes.error) {
    throw new Error(fallbackSessionRes.error.message);
  }

  return computeWeeklyLeaderboardFromSessions((fallbackSessionRes.data || []) as SessionRow[]);
}

export function totalWeeklyDistance(weeklyLeaderboard: WeeklyLeaderboardRow[]) {
  return Number(weeklyLeaderboard.reduce((sum, row) => sum + row.distanceKm, 0).toFixed(1));
}
