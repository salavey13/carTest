import { NextRequest, NextResponse } from "next/server";
import { fetchWeeklyLeaderboard } from "../_lib/shared";

export async function GET(request: NextRequest) {
  const crewSlug = request.nextUrl.searchParams.get("slug") || "vip-bike";

  try {
    const leaderboard = await fetchWeeklyLeaderboard(crewSlug);
    return NextResponse.json({ success: true, data: { leaderboard } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to fetch map riders leaderboard" }, { status: 500 });
  }
}
