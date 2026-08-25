// /app/api/franchize/sales-csv-export/route.ts
// Export SALES as CSV — sales-only variant of the operator finance sheet.
//
// Query params:
//   ?slug=vip-bike&from=2026-08-01&to=2026-08-31
//
// Columns (matches the sales block from the rentals CSV export —
// "дата, ЗП Продажа, Наименование, Цена, Комментарий"):
//   Дата, ЗП Продажа, Наименование, Цена, Комментарий
//
// FIX (F16): the rentals-csv-export endpoint lumps sales into a single
// combined sheet (rentals + sales). Operators on the Sales Analytics tab
// wanted the same "Export CSV" button there — this endpoint serves a
// sales-only file so it stays focused and loadable in Excel standalone.
//
// Auth: same verifyCrewAccess path as rentals-csv-export (signed cookie
// primary, x-telegram-user-id header fallback, x-auth-password header).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCrewAccess } from "../_auth";

type SupabaseSchemaClient = {
  schema: (schema: string) => {
    from: (table: string) => any;
  };
};

function privateSchema() {
  return (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
}

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

    // Auth: verify crew access
    const auth = await verifyCrewAccess(request);
    if (auth.ok === false) return auth.response;

    // Fetch crew + bikes (so we can resolve resolved_bike_id → bike name)
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) return NextResponse.json({ error: "Crew not found" }, { status: 404 });

    const { data: crewBikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model")
      .eq("crew_id", crew.id);
    const crewBikeIds = (crewBikes || []).map((b) => b.id);
    const bikeNameById = new Map<string, string>(
      (crewBikes || []).map((b) => [b.id, `${b.make || ""} ${b.model || ""}`.trim()]),
    );

    // Date range — Europe/Moscow (+03:00) so the operator's "today" matches
    // what they see on the dashboard.
    const fromIso = `${from}T00:00:00+03:00`;
    const toIso = `${to}T23:59:59+03:00`;

    const { data: sales } = await privateSchema()
      .from("sale_contract_artifacts")
      .select("id, buyer_full_name, sale_price, created_at, resolved_bike_id")
      .in("resolved_bike_id", crewBikeIds.length ? crewBikeIds : ["__none__"])
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: true });

    // Headers — focused sales-only sheet
    const headers = ["Дата", "ЗП Продажа", "Наименование", "Цена", "Комментарий"];
    const rows: string[] = [headers.join(",")];

    const formatCell = (v: unknown): string => {
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rowOf = (cells: unknown[]): string => cells.map(formatCell).join(",");

    let totalSales = 0;
    for (const s of (sales || []) as any[]) {
      const dateStr = s.created_at
        ? new Date(s.created_at).toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            timeZone: "Europe/Moscow",
          })
        : "";
      const bikeName = bikeNameById.get(s.resolved_bike_id) || "";
      const price = Number(s.sale_price) || 0;
      totalSales += price;
      const comment = s.buyer_full_name || "";
      rows.push(rowOf([dateStr, "", bikeName, price, comment]));
    }

    // Totals row
    rows.push("");
    rows.push(rowOf(["", "", "Итого:", totalSales, ""]));

    const csv = "\uFEFF" + rows.join("\n"); // BOM for Excel UTF-8

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-sales-${from}-to-${to}.csv"`,
      },
    });
  } catch (err) {
    console.error("[sales-csv-export] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
