import { NextRequest, NextResponse } from "next/server";
import { fetchOverviewData } from "../_lib/shared";

const LIVE_STALE_THRESHOLD_SECONDS = 120;

export async function GET(request: NextRequest) {
  const crewSlug = request.nextUrl.searchParams.get("slug") || "vip-bike";

  try {
    const overview = await fetchOverviewData(crewSlug);

    const now = Date.now();
    const freshness = overview.liveLocations.map((item) => {
      const updatedAt = new Date(item.updated_at).getTime();
      const lagSeconds = Number.isNaN(updatedAt) ? null : Math.max(0, Math.floor((now - updatedAt) / 1000));
      return {
        userId: item.user_id,
        updatedAt: item.updated_at,
        lagSeconds,
        isStale: lagSeconds === null ? true : lagSeconds > LIVE_STALE_THRESHOLD_SECONDS,
      };
    });

    const staleCount = freshness.filter((item) => item.isStale).length;
    const healthyCount = freshness.length - staleCount;
    const maxLagSeconds = freshness.reduce((max, item) => Math.max(max, item.lagSeconds ?? 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        crewSlug,
        activeSessionsCount: overview.activeSessions.length,
        liveLocationsCount: overview.liveLocations.length,
        healthyLiveCount: healthyCount,
        staleLiveCount: staleCount,
        staleThresholdSeconds: LIVE_STALE_THRESHOLD_SECONDS,
        maxLagSeconds,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to fetch map riders health" }, { status: 500 });
  }
}
