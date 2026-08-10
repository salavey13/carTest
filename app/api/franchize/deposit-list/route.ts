// /app/api/franchize/deposit-list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/franchize/deposit-list?date=YYYY-MM-DD&slug=<slug>
 *
 * Returns deposit entries for a date + daily summary per destination.
 * Used by the admin deposits page.
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  const slug = request.nextUrl.searchParams.get("slug");

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  try {
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    const { data, error } = await supabaseAdmin
      .from("deposit_entries")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[deposit-list] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = data || [];

    // Aggregate by destination
    const destMap = new Map<string, { collected: number; returned: number; penalty: number }>();
    for (const e of entries) {
      const dest = e.destination;
      if (!destMap.has(dest)) {
        destMap.set(dest, { collected: 0, returned: 0, penalty: 0 });
      }
      const d = destMap.get(dest)!;
      if (e.entry_type === "deposit_collected") d.collected += Number(e.amount);
      else if (e.entry_type === "deposit_returned") d.returned += Number(e.amount);
      else if (e.entry_type === "penalty") d.penalty += Number(e.amount);
    }

    const summaries = Array.from(destMap.entries()).map(([dest, d]) => ({
      destination: dest,
      collected: d.collected,
      returned: d.returned,
      penalty: d.penalty,
      net: d.collected - d.returned - d.penalty,
    }));

    return NextResponse.json({ entries, summaries });
  } catch (error) {
    console.error("[deposit-list] Error:", error);
    return NextResponse.json({ error: "Failed to fetch deposit entries" }, { status: 500 });
  }
}
