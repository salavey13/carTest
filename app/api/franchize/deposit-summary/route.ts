// /app/api/franchize/deposit-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDepositSummary } from "@/app/franchize/server-actions/deposit-entries";

/**
 * GET /api/franchize/deposit-summary?rentalId=<uuid>
 *
 * Returns deposit entries summary for a rental.
 * Used by DepositBadge component on rental cards.
 *
 * No auth on this route — the data is deposit amounts + destinations (not PII).
 * If needed, add crew access verification here.
 */
export async function GET(request: NextRequest) {
  const rentalId = request.nextUrl.searchParams.get("rentalId");

  if (!rentalId) {
    return NextResponse.json({ error: "rentalId is required" }, { status: 400 });
  }

  try {
    const summary = await getDepositSummary(rentalId);
    return NextResponse.json(summary || { totalCollected: 0, totalReturned: 0, totalPenalty: 0, balance: 0, destinations: [], entries: [] });
  } catch (error) {
    console.error("[deposit-summary] Error:", error);
    return NextResponse.json({ error: "Failed to fetch deposit summary" }, { status: 500 });
  }
}
