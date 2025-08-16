import { NextResponse } from "next/server";
import { getLeaderboard } from "@/app/streamer/actions";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const streamerId = url.searchParams.get("streamerId");
    if (!streamerId) return NextResponse.json({ success: false, error: "streamerId required" }, { status: 400 });

    const res = await getLeaderboard({ streamerId, limit: 20 });
    if (!res.success) {
      return NextResponse.json(res, { status: 500 });
    }
    return NextResponse.json({ success: true, data: res.data });
  } catch (e: any) {
    logger.error("[/api/streamer/leaderboard] error", e);
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 });
  }
}