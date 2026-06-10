// /app/api/franchize/[slug]/buy/print-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendFranchizeBuyPrintPdf } from "@/app/franchize/server-actions/buy-print";

/**
 * API wrapper for buy-sheet PDF generation.
 * Allows external scripts to generate PDFs without Next.js context.
 *
 * Usage:
 *   POST /api/franchize/{slug}/buy/print-pdf
 *   Body: { slug, bikeId, pageSize, serviceRoleKey }
 *
 * Authentication via service role key (for internal scripts only).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, bikeId, pageSize, serviceRoleKey } = body;

    // Validate service role key for security
    const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!expectedKey || serviceRoleKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!slug || !bikeId) {
      return NextResponse.json(
        { success: false, error: "Missing slug or bikeId" },
        { status: 400 }
      );
    }

    // Call the server action
    const result = await sendFranchizeBuyPrintPdf({
      slug,
      bikeId,
      pageSize: pageSize || "A4",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // The server action sends to Telegram and returns success
    // For the API route, we just return the success status
    return NextResponse.json(result);
  } catch (error) {
    console.error("[buy/print-pdf API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
