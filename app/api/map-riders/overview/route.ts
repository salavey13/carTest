import { NextRequest, NextResponse } from "next/server";
import { fetchOverviewData, fetchWeeklyLeaderboard, totalWeeklyDistance } from "../_lib/shared";

export async function GET(request: NextRequest) {
  const crewSlug = request.nextUrl.searchParams.get("slug") || "vip-bike";

  try {
    const overview = await fetchOverviewData(crewSlug);
    const weeklyLeaderboard = await fetchWeeklyLeaderboard(crewSlug, overview.sessions);

    return NextResponse.json({
      success: true,
      data: {
        activeSessions: overview.activeSessions,
        liveLocations: overview.liveLocations,
        meetups: overview.meetups,
        latestCompleted: overview.latestCompleted,
        stats: {
          ...overview.stats,
          totalWeeklyDistanceKm: totalWeeklyDistance(weeklyLeaderboard),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to fetch map riders overview" }, { status: 500 });
  }
}
