// lib/csv-builders/rentals-csv.ts
//
// Shared CSV builder for the operator's finance-sheet format. Used by:
//   • /api/franchize/rentals-csv-export  (direct file download)
//   • server-action sendAnalyticsCsvToTelegram (send via bot to operator's chat)
//
// Salary columns (iter5, docs/PRD_SALARY_COEFFICIENTS.md):
//   «ЗП Аренда»  = категорийный бонус техники (официальная схема)
//                + бонус за экип (₽ × количество единиц)
//                + оверпрайс % × наценка над каталогом
//   «ЗП Продажа» = категорийный бонус продажи техники
// Coefficients are configurable at /franchize/[slug]/salary-coefficients;
// defaults come from the official bonus document (lib/salary-coefficients.ts).
//
// Columns (17 total):
//   Дата, ЗП Аренда, Партнеру, Цена, Экип, Залог, Марка, (spacer),
//   Пробег до, Пробег после, Время, Комментарий,
//   дата, ЗП Продажа, Наименование, Цена, Комментарий

import { supabaseAdmin } from "@/lib/supabase-server";
import {
  getSalaryConfig,
  getBikeCategoryOverrides,
  resolveBikeCategories,
  countEquipmentUnits,
  computeRentalSalary,
  computeSaleSalary,
  equipmentStandardCost,
  standardRentalPrice,
  type RentalEquipment,
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

  // Salary engine: configurable coefficients + bike categories (official
  // document defaults when nothing configured / migration not applied).
  const [salaryConfig, bikeOverrides] = await Promise.all([
    getSalaryConfig(crew.id),
    getBikeCategoryOverrides(crew.id),
  ]);

  const fromIso = `${from}T00:00:00+03:00`;
  const toIso = `${to}T23:59:59+03:00`;

  const { data: rentals, error } = await supabaseAdmin
    .from("rentals")
    .select(`
      rental_id, status, total_cost, payment_status,
      requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
      metadata, created_at,
      vehicle:cars!inner(id, make, model, crew_id, specs, daily_price)
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
    const endDate = r.requested_end_date || r.agreed_end_date;
    const dateStr = startDate
      ? new Date(startDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
      : "";

    const price = r.total_cost || 0;
    totalRevenue += price;

    // ── ЗП Аренда: категория техники + экип + оверпрайс ──
    const categories = resolveBikeCategories(vehicle?.id || "", bikeOverrides);
    const eq = (meta.equipment || {}) as RentalEquipment;
    const equipmentUnits = countEquipmentUnits(eq);
    const stdPrice =
      standardRentalPrice({
        specs: vehicle?.specs,
        startIso: startDate,
        endIso: endDate,
        dailyPrice: vehicle?.daily_price,
        fallbackTotalCost: price,
      }) + equipmentStandardCost(eq);
    const salary = computeRentalSalary({
      config: salaryConfig,
      rentalCategory: categories.rental,
      equipmentUnits,
      totalCost: price,
      standardPrice: stdPrice,
    });
    const salaryStr = String(salary.total);
    totalSalary += salary.total;

    // Equipment (FIX F2-iter2): charger is free
    const equipCost = equipmentStandardCost(eq);
    const equipParts: string[] = [];
    if (Number(eq.helmets) > 0) equipParts.push(`${eq.helmets}шл`);
    if (Number(eq.gloves) > 0) equipParts.push(`${eq.gloves}перч`);
    if (eq.jacket) equipParts.push("курт");
    if (eq.pants) equipParts.push("шт");
    if (eq.boots) equipParts.push("бот");
    if (eq.net) equipParts.push("сет");
    if (eq.backpack) equipParts.push("рюк");
    if (eq.charger) equipParts.push("заряд↔");
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

  // ── Sales rows (cols 13-17) — ЗП Продажа по категории техники ──
  let totalSalesSalary = 0;
  for (const s of (sales || []) as any[]) {
    const dateStr = s.created_at
      ? new Date(s.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
      : "";
    const bikeName = bikeNameById.get(s.resolved_bike_id) || "";
    const price = s.sale_price || "";
    const comment = s.buyer_full_name || "";

    const saleCategories = resolveBikeCategories(s.resolved_bike_id || "", bikeOverrides);
    const saleSalary = computeSaleSalary({
      config: salaryConfig,
      saleCategory: saleCategories.sale,
    });
    totalSalesSalary += saleSalary.total;

    rows.push(rowOf([
      "", "", "", "", "", "",
      "", "", "", "", "", "",
      dateStr, String(saleSalary.total), bikeName, price, comment,
    ]));
  }
  totalSalary += totalSalesSalary;

  // Totals row
  rows.push("");
  const totalEquip = (rentals || []).reduce((sum: number, r: any) => {
    return sum + equipmentStandardCost((r.metadata?.equipment) || {});
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
