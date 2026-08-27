// /app/api/franchize/sales-csv-export/route.ts
// Export SALES as CSV — sales-only variant of the operator finance sheet.
//
// Query params:
//   ?slug=vip-bike&from=2026-08-01&to=2026-08-31
//
// FIX (iter4): now delegates the CSV building to lib/csv-builders/sales-csv.ts
// so that both the route AND the send-to-Telegram server-action share the same
// logic. The route is now a thin auth + serialization shim.

import { NextRequest, NextResponse } from "next/server";
import { verifyCrewAccess } from "../_auth";
import { buildSalesCsv } from "@/lib/csv-builders/sales-csv";

// Reads request.url (searchParams) + cookies-based crew auth → must never be
// statically prerendered (Vercel build fails with DYNAMIC_SERVER_USAGE otherwise).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!slug || !from || !to) {
      return NextResponse.json(
        { error: "slug, from, to are required" },
        { status: 400 },
      );
    }

    const auth = await verifyCrewAccess(request);
    if (auth.ok === false) return auth.response;

    const { csv, filename } = await buildSalesCsv(slug, from, to);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[sales-csv-export] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
