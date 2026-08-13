// app/api/franchize/[slug]/dashboard/daily-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDailyCashReport } from "@/app/franchize/server-actions/cash-transactions";

/**
 * API route for daily cash report.
 * GET: Daily cash summary for specific date
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    // Default to today if no date provided
    const dateParam = searchParams.get("date");
    const reportDate = dateParam || new Date().toISOString().split("T")[0];

    const result = await getDailyCashReport({
      slug,
      date: reportDate,
    });

    if (!result.success) {
      const status = result.error?.includes("не найден") ? 404 : result.error?.includes("Не авторизовано") || result.error?.includes("Недостаточно прав") ? 401 : 400;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[daily-report GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
