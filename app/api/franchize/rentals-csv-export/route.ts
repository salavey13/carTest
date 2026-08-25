// /app/api/franchize/rentals-csv-export/route.ts
// Export rentals as CSV matching the operator's finance spreadsheet format.
//
// Query params:
//   ?slug=vip-bike&from=2026-08-01&to=2026-08-31
//
// CSV columns (matching ВипБайк Финансы - Август.csv):
// Дата,ЗП Аренда,Партнеру,Цена,Экип,Залог,Марка,Комментарий,Пробег до,Пробег после,Время

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCrewAccess } from "../_auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!slug || !from || !to) {
      return NextResponse.json({ error: "slug, from, to are required" }, { status: 400 });
    }

    // Auth: verify crew access
    const auth = await verifyCrewAccess(request);
    if (auth.ok === false) return auth.response;

    // Fetch crew
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) return NextResponse.json({ error: "Crew not found" }, { status: 404 });

    // Fetch rentals in date range (by requested_start_date)
    const fromIso = `${from}T00:00:00+03:00`;
    const toIso = `${to}T23:59:59+03:00`;

    const { data: rentals, error } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id, status, total_cost, payment_status,
        requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
        metadata, created_at,
        vehicle:cars!inner(id, make, model, crew_id)
      `)
      .eq("vehicle.crew_id", crew.id)
      .gte("requested_start_date", fromIso)
      .lte("requested_start_date", toIso)
      .neq("status", "cancelled")
      .order("requested_start_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build CSV
    const headers = [
      "Дата", "ЗП Аренда", "Партнеру", "Цена", "Экип", "Залог",
      "Марка", "Комментарий", "Пробег до", "Пробег после", "Время", "Фото"
    ];

    const rows: string[] = [headers.join(",")];

    for (const r of (rentals || [])) {
      const meta = (r as any).metadata || {};
      const vehicle = Array.isArray((r as any).vehicle) ? (r as any).vehicle[0] : (r as any).vehicle;
      const bikeName = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim();

      const startDate = (r as any).requested_start_date || (r as any).agreed_start_date || (r as any).created_at;
      const dateStr = startDate ? new Date(startDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" }) : "";

      const price = (r as any).total_cost || 0;

      // Equipment
      const eq = meta.equipment || {};
      let equipCost = 0;
      const equipParts: string[] = [];
      if (eq.helmets > 0) { equipCost += eq.helmets * 1000; equipParts.push(`${eq.helmets}шл`); }
      if (eq.gloves > 0) { equipCost += eq.gloves * 500; equipParts.push(`${eq.gloves}перч`); }
      if (eq.jacket) { equipCost += 500; equipParts.push("курт"); }
      if (eq.pants) { equipCost += 500; equipParts.push("шт"); }
      if (eq.boots) { equipCost += 500; equipParts.push("бот"); }
      if (eq.net) { equipCost += 500; equipParts.push("сет"); }
      if (eq.backpack) { equipCost += 500; equipParts.push("рюк"); }
      const equipStr = equipParts.length > 0 ? `${equipParts.join("+")} (${equipCost})` : "";

      const deposit = meta.deposit_amount || meta.deposit_rub || 0;
      const odoBefore = meta.odometer_before || "";
      const odoAfter = meta.odometer_after || "";

      const startTime = startDate ? new Date(startDate).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }) : "";
      const endDate = (r as any).requested_end_date || (r as any).agreed_end_date;
      const endTime = endDate ? new Date(endDate).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }) : "";
      const timeStr = startTime && endTime ? `${startTime}-${endTime}` : "";

      const renterName = meta.renter_name || "";
      const paymentMethod = meta.payment_split?.card_destination ? `карта ${meta.payment_split.card_destination}` : (meta.payment_split?.cash > 0 ? "нал" : "");
      const freeReason = meta.free_rental_reason || "";
      const comment = [renterName, paymentMethod, freeReason].filter(Boolean).join(" ");

      // Photo links (rental detail page on the web app)
      const rentalId = (r as any).rental_id || "";
      const photoLink = rentalId ? `https://vip-bike.ru/franchize/${slug}/rental/${rentalId}` : "";

      const row = [
        dateStr, "", "", price, equipStr, deposit,
        bikeName, comment, odoBefore, odoAfter, timeStr, photoLink
      ].map(v => {
        const s = String(v ?? "");
        return s.includes(",") ? `"${s}"` : s;
      });
      rows.push(row.join(","));
    }

    // Totals row
    rows.push("");
    const totalRevenue = (rentals || []).reduce((sum, r) => sum + ((r as any).total_cost || 0), 0);
    const totalEquip = (rentals || []).reduce((sum, r) => {
      const eq = (r as any).metadata?.equipment || {};
      let c = 0;
      if (eq.helmets > 0) c += eq.helmets * 1000;
      if (eq.gloves > 0) c += eq.gloves * 500;
      if (eq.jacket) c += 500;
      if (eq.pants) c += 500;
      if (eq.boots) c += 500;
      if (eq.net) c += 500;
      if (eq.backpack) c += 500;
      return sum + c;
    }, 0);
    const totalDeposit = (rentals || []).reduce((sum, r) => sum + Number((r as any).metadata?.deposit_amount || 0), 0);
    rows.push(`,,,${totalRevenue},${totalEquip},${totalDeposit},,,,,,`);

    const csv = "\uFEFF" + rows.join("\n"); // BOM for Excel UTF-8

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-rentals-${from}-to-${to}.csv"`,
      },
    });
  } catch (err) {
    console.error("[rentals-csv-export] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
