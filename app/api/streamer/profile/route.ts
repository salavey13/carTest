import { NextResponse } from "next/server";
import { getStreamerProfile } from "../actions";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const streamerId = url.searchParams.get("streamerId");
    
    if (!streamerId) {
        return NextResponse.json({ success: false, error: "streamerId required" }, { status: 400 });
    }

    const res = await getStreamerProfile(streamerId);
    
    if (!res.success) {
      return NextResponse.json(res, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data: res.data });
  } catch (e: any) {
    logger.error("[/api/streamer/profile] error", e);
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 });
  }
}