// /app/api/franchize/rentals-csv-export/route.ts
// Export rentals as CSV matching the operator's finance spreadsheet format.
//
// Query params:
//   ?slug=vip-bike&from=2026-08-01&to=2026-08-31
//
// FIX (F9): columns now mirror the operator finance sheet exactly
// (ВипБайк Финансы - Август.csv):
//   Дата, ЗП Аренда, Партнеру, Цена, Экип, Залог, Марка, (empty), Пробег до,
//   Пробег после, Время, Комментарий, дата, ЗП Продажа, Наименование, Цена, Комментарий
//
// The rental section (columns 1-12) is filled per rental; the sales section
// (columns 13-17) is filled from private.sale_contract_artifacts created in
// the same period. A day's rentals are included by the START of the rent
// (requested_start_date), matching the dashboard day-scoping rule (F7).
// Комментарий carries the renter ФИО + phone + payment method (F1/F2).

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

    // Fetch rentals in date range (by requested_start_date = START of rent)
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

    // Fetch sales artifacts for the same period (finance sheet has a sales
    // section: дата, ЗП Продажа, Наименование, Цена, Комментарий).
    const { data: crewBikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model")
      .eq("crew_id", crew.id);
    const crewBikeIds = (crewBikes || []).map((b) => b.id);
    const bikeNameById = new Map<string, string>(
      (crewBikes || []).map((b) => [b.id, `${b.make || ""} ${b.model || ""}`.trim()]),
    );

    const { data: sales } = await privateSchema()
      .from("sale_contract_artifacts")
      .select("id, buyer_full_name, sale_price, created_at, resolved_bike_id")
      .in("resolved_bike_id", crewBikeIds.length ? crewBikeIds : ["__none__"])
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: true });

    // Build CSV — 17 columns matching the operator finance sheet
    const headers = [
      "Дата", "ЗП Аренда", "Партнеру", "Цена", "Экип", "Залог",
      "Марка", "", "Пробег до", "Пробег после", "Время", "Комментарий",
      "дата", "ЗП Продажа", "Наименование", "Цена", "Комментарий",
    ];

    const rows: string[] = [headers.join(",")];

    const formatCell = (v: unknown): string => {
      const s = String(v ?? "");
      // Escape cells containing commas, quotes or newlines (RFC 4180)
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rowOf = (cells: unknown[]): string => cells.map(formatCell).join(",");

    // ── Rental rows (columns 1-12) ──────────────────────────────────────────
    for (const r of (rentals || []) as any[]) {
      const meta = r.metadata || {};
      const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
      const bikeName = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim();

      const startDate = r.requested_start_date || r.agreed_start_date || r.created_at;
      const dateStr = startDate
        ? new Date(startDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
        : "";

      const price = r.total_cost || 0;

      // Equipment (FIX F4): readable shorthand + estimated cost part
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

      // Deposit (FIX F3): metadata.deposit_amount with method label
      const depositAmount = Number(meta.deposit_amount || 0);
      const depositMethod =
        meta.deposit_method === "cash" ? " нал"
        : meta.deposit_method === "tbank" ? " ТБанк"
        : meta.deposit_method === "sber" ? " Сбербанк"
        : "";
      const depositStr = depositAmount > 0 ? `${depositAmount}${depositMethod}` : "";

      const odoBefore = meta.odometer_before ?? "";
      const odoAfter = meta.odometer_after ?? "";

      const startTime = startDate
        ? new Date(startDate).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" })
        : "";
      const endDate = r.requested_end_date || r.agreed_end_date;
      const endTime = endDate
        ? new Date(endDate).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" })
        : "";
      const timeStr = startTime && endTime ? `${startTime}-${endTime}` : "";

      // Комментарий: renter ФИО + phone + payment method (FIX F1/F2)
      const renterName = meta.renter_name || "";
      const renterPhone = meta.renter_phone || "";
      const paymentMethod = meta.payment_split?.card_destination
        ? `карта ${meta.payment_split.card_destination}`
        : meta.payment_split?.cash > 0
          ? "нал"
          : "";
      const freeReason = meta.free_rental_reason || "";
      const comment = [renterName, renterPhone, paymentMethod, freeReason].filter(Boolean).join(" ");

      rows.push(rowOf([
        dateStr, "", "", price, equipStr, depositStr,
        bikeName, "", odoBefore, odoAfter, timeStr, comment,
        "", "", "", "", "",
      ]));
    }

    // ── Sales rows (columns 13-17) ──────────────────────────────────────────
    for (const s of (sales || []) as any[]) {
      const dateStr = s.created_at
        ? new Date(s.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
        : "";
      const bikeName = bikeNameById.get(s.resolved_bike_id) || "";
      const price = s.sale_price || "";
      const comment = s.buyer_full_name || "";
      rows.push(rowOf([
        "", "", "", "", "", "",
        "", "", "", "", "", "",
        dateStr, "", bikeName, price, comment,
      ]));
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
    const totalSales = (sales || []).reduce((sum, s) => sum + (Number((s as any).sale_price) || 0), 0);
    rows.push(rowOf([
      "", "", "", totalRevenue, totalEquip, totalDeposit,
      "", "", "", "", "", "",
      "", "", "", totalSales, "",
    ]));

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
