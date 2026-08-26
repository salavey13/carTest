// lib/csv-builders/sales-csv.ts
//
// Sales-only variant of the operator finance sheet. Used by:
//   • /api/franchize/sales-csv-export   (direct file download)
//   • server-action sendAnalyticsCsvToTelegram (send via bot)
//
// Columns: Дата, ЗП Продажа, Наименование, Цена, Комментарий
//
// Salary (iter5, docs/PRD_SALARY_COEFFICIENTS.md): «ЗП Продажа» is the fixed
// category bonus (Эндуро/мопеды 5000 · Обычные 10000 · Премиум 15000 ₽ by
// default), configurable at /franchize/[slug]/salary-coefficients. Replaces
// the iter4 percentage-of-price model.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  getSalaryConfig,
  getBikeCategoryOverrides,
  resolveBikeCategories,
  computeSaleSalary,
} from "@/lib/salary-coefficients";

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

  // Salary engine: configurable coefficients + bike categories
  // (official document defaults when nothing configured / migration not applied).
  const [salaryConfig, bikeOverrides] = await Promise.all([
    getSalaryConfig(crew.id),
    getBikeCategoryOverrides(crew.id),
  ]);

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

    const categories = resolveBikeCategories(s.resolved_bike_id || "", bikeOverrides);
    const salary = computeSaleSalary({
      config: salaryConfig,
      saleCategory: categories.sale,
      salePrice: price,
    });
    totalSalary += salary.total;

    const comment = s.buyer_full_name || "";
    rows.push(rowOf([dateStr, String(salary.total), bikeName, price, comment]));
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
