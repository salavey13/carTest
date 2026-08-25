// lib/csv-builders/sales-csv.ts
//
// Sales-only variant of the operator finance sheet. Used by:
//   • /api/franchize/sales-csv-export   (direct file download)
//   • server-action sendAnalyticsCsvToTelegram (send via bot)
//
// Columns: Дата, ЗП Продажа, Наименование, Цена, Комментарий
//
// FIX (iter4): now fills the "ЗП Продажа" column (col 2) using the crew's
// commission_rates table for operation_type = 'sale'. Defaults to 5% (the
// seed value in CommissionsClient presets).

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

// Resolve the crew's commission rate for sales.
// Returns { type, value } or null if no rate configured.
export async function resolveSaleCommissionRate(
  crewId: string,
): Promise<{ type: "percentage" | "fixed_amount"; value: number } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("commission_rates")
      .select("commission_type, commission_value, priority")
      .eq("crew_id", crewId)
      .eq("operation_type", "sale")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      logger.warn("[sales-csv] commission_rates query failed:", error);
      return null;
    }
    if (!data || data.length === 0) return null;
    const top = data[0];
    return {
      type: top.commission_type as "percentage" | "fixed_amount",
      value: Number(top.commission_value) || 0,
    };
  } catch (e) {
    logger.warn("[sales-csv] resolveSaleCommissionRate exception:", e);
    return null;
  }
}

function calcSaleSalary(
  price: number,
  rate: { type: "percentage" | "fixed_amount"; value: number } | null,
): string {
  if (!rate) return "";
  if (rate.type === "percentage") {
    return String(Math.round((price * rate.value) / 100));
  }
  return String(rate.value);
}

export async function buildSalesCsv(
  slug: string,
  from: string,
  to: string,
): Promise<{ csv: string; filename: string; summary: { sales: number; totalRevenue: number; totalSalary: number } }> {
  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!crew) throw new Error("Crew not found");

  const commissionRate = await resolveSaleCommissionRate(crew.id);

  const { data: crewBikes } = await supabaseAdmin
    .from("cars")
    .select("id, make, model")
    .eq("crew_id", crew.id);
  const crewBikeIds = (crewBikes || []).map((b: any) => b.id);
  const bikeNameById = new Map<string, string>(
    (crewBikes || []).map((b: any) => [b.id, `${b.make || ""} ${b.model || ""}`.trim()]),
  );

  const fromIso = `${from}T00:00:00+03:00`;
  const toIso = `${to}T23:59:59+03:00`;

  const { data: sales } = await privateSchema()
    .from("sale_contract_artifacts")
    .select("id, buyer_full_name, sale_price, created_at, resolved_bike_id")
    .in("resolved_bike_id", crewBikeIds.length ? crewBikeIds : ["__none__"])
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: true });

  const headers = ["Дата", "ЗП Продажа", "Наименование", "Цена", "Комментарий"];
  const rows: string[] = [headers.join(",")];

  let totalSales = 0;
  let totalSalary = 0;

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
    const salaryStr = calcSaleSalary(price, commissionRate);
    if (salaryStr !== "") totalSalary += Number(salaryStr);
    const comment = s.buyer_full_name || "";
    rows.push(rowOf([dateStr, salaryStr, bikeName, price, comment]));
  }

  rows.push("");
  rows.push(rowOf(["", totalSalary, "Итого:", totalSales, ""]));

  const csv = "\uFEFF" + rows.join("\n");
  const filename = `${slug}-sales-${from}-to-${to}.csv`;

  return {
    csv,
    filename,
    summary: {
      sales: (sales || []).length,
      totalRevenue: totalSales,
      totalSalary,
    },
  };
}
