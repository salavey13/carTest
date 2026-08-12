// /app/api/franchize/[slug]/dashboard/daily-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDailyCashReport } from "@/app/franchize/server-actions/cash-transactions";
import { logger } from "@/lib/logger";

/**
 * API route for daily cash report.
 * GET: Daily cash summary for specific date
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const actorUserId = searchParams.get("actorUserId");
    const date = searchParams.get("date");

    if (!slug || !actorUserId) {
      return NextResponse.json(
        { success: false, error: "Missing slug or actorUserId" },
        { status: 400 }
      );
    }

    // Default to today if no date provided
    const reportDate = date || new Date().toISOString().split("T")[0];

    const result = await getDailyCashReport({
      slug,
      actorUserId,
      date: reportDate,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes("не найден") ? 404 : 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error("[daily-report GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}