// lib/csv-builders/rentals-csv.ts
//
// Shared CSV builder for the operator's finance-sheet format. Used by:
//   • /api/franchize/rentals-csv-export  (direct file download)
//   • server-action sendAnalyticsCsvToTelegram (send via bot to operator's chat)
//
// FIX (iter4): now fills the "ЗП Аренда" column (col 2) using the crew's
// commission_rates table — defaults to 10% (rental_hourly seed). The variant
// 'rental_daily' is preferred when present (matches how SalaryClient computes
// earnings); falls back to 'rental_hourly'. If neither exists, the column
// stays empty (preserves old behaviour).
//
// Columns (17 total):
//   Дата, ЗП Аренда, Партнеру, Цена, Экип, Залог, Марка, (spacer),
//   Пробег до, Пробег после, Время, Комментарий,
//   дата, ЗП Продажа, Наименование, Цена, Комментарий

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

type SupabaseSchemaClient = {
  schema: (schema: string) => {
    from: (table: string) => any;
  };
};

function privateSchema() {
  return (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
}

function formatCell(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const rowOf = (cells: unknown[]): string => cells.map(formatCell).join(",");

// Resolve the crew's commission rate for rentals.
// Priority: rental_daily > rental_hourly (matches SalaryClient behaviour).
// Returns { type, value } or null if no rate configured.
export async function resolveRentalCommissionRate(
  crewId: string,
): Promise<{ type: "percentage" | "fixed_amount"; value: number } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("commission_rates")
      .select("operation_type, commission_type, commission_value, priority")
      .eq("crew_id", crewId)
      .in("operation_type", ["rental_daily", "rental_hourly"])
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      logger.warn("[rentals-csv] commission_rates query failed:", error);
      return null;
    }
    if (!data || data.length === 0) return null;

    const sorted = (data as any[]).slice().sort((a, b) => {
      const rank = (r: any) =>
        r.operation_type === "rental_daily" ? 2 : r.operation_type === "rental_hourly" ? 1 : 0;
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return rb - ra;
      return Number(b.priority || 0) - Number(a.priority || 0);
    });
    const top = sorted[0];
    if (!top) return null;
    return {
      type: top.commission_type as "percentage" | "fixed_amount",
      value: Number(top.commission_value) || 0,
    };
  } catch (e) {
    logger.warn("[rentals-csv] resolveRentalCommissionRate exception:", e);
    return null;
  }
}

// Calculate salary for a single rental row.
//   • percentage: salary = price * value / 100 (rounded to whole ₽)
//   • fixed_amount: salary = value (flat per rental)
//   • null rate: salary = "" (empty column — preserves backwards compat)
function calcSalary(
  price: number,
  rate: { type: "percentage" | "fixed_amount"; value: number } | null,
): string {
  if (!rate) return "";
  if (rate.type === "percentage") {
    return String(Math.round((price * rate.value) / 100));
  }
  return String(rate.value);
}

export async function buildRentalsCsv(
  slug: string,
  from: string,
  to: string,
): Promise<{ csv: string; filename: string; summary: { rentals: number; sales: number; totalRevenue: number; totalSalary: number } }> {
  // Fetch crew
  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!crew) throw new Error("Crew not found");

  // Resolve commission rate once for the whole sheet
  const commissionRate = await resolveRentalCommissionRate(crew.id);

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

  if (error) throw new Error(error.message);

  // Fetch sales artifacts for the same period
  const { data: crewBikes } = await supabaseAdmin
    .from("cars")
    .select("id, make, model")
    .eq("crew_id", crew.id);
  const crewBikeIds = (crewBikes || []).map((b: any) => b.id);
  const bikeNameById = new Map<string, string>(
    (crewBikes || []).map((b: any) => [b.id, `${b.make || ""} ${b.model || ""}`.trim()]),
  );

  const { data: sales } = await privateSchema()
    .from("sale_contract_artifacts")
    .select("id, buyer_full_name, sale_price, created_at, resolved_bike_id")
    .in("resolved_bike_id", crewBikeIds.length ? crewBikeIds : ["__none__"])
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: true });

  const headers = [
    "Дата", "ЗП Аренда", "Партнеру", "Цена", "Экип", "Залог",
    "Марка", "", "Пробег до", "Пробег после", "Время", "Комментарий",
    "дата", "ЗП Продажа", "Наименование", "Цена", "Комментарий",
  ];
  const rows: string[] = [headers.join(",")];

  let totalRevenue = 0;
  let totalSalary = 0;

  // ── Rental rows (cols 1-12) ──
  for (const r of (rentals || []) as any[]) {
    const meta = r.metadata || {};
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    const bikeName = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim();

    const startDate = r.requested_start_date || r.agreed_start_date || r.created_at;
    const dateStr = startDate
      ? new Date(startDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
      : "";

    const price = r.total_cost || 0;
    totalRevenue += price;

    const salaryStr = calcSalary(price, commissionRate);
    if (salaryStr !== "") totalSalary += Number(salaryStr);

    // Equipment (FIX F2-iter2): charger is free
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
    if (eq.charger) { equipParts.push("заряд↔"); }
    const equipStr = equipParts.length > 0 ? `${equipParts.join("+")} (${equipCost})` : "";

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
      dateStr, salaryStr, "", price, equipStr, depositStr,
      bikeName, "", odoBefore, odoAfter, timeStr, comment,
      "", "", "", "", "",
    ]));
  }

  // ── Sales rows (cols 13-17) ──
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
  const totalEquip = (rentals || []).reduce((sum: number, r: any) => {
    const eq = (r.metadata?.equipment) || {};
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
  const totalDeposit = (rentals || []).reduce((sum: number, r: any) => sum + Number(r.metadata?.deposit_amount || 0), 0);
  const totalSales = (sales || []).reduce((sum: number, s: any) => sum + (Number(s.sale_price) || 0), 0);
  rows.push(rowOf([
    "", totalSalary, "", totalRevenue, totalEquip, totalDeposit,
    "", "", "", "", "", "",
    "", "", "", totalSales, "",
  ]));

  const csv = "\uFEFF" + rows.join("\n");
  const filename = `${slug}-rentals-${from}-to-${to}.csv`;

  return {
    csv,
    filename,
    summary: {
      rentals: (rentals || []).length,
      sales: (sales || []).length,
      totalRevenue,
      totalSalary,
    },
  };
}
