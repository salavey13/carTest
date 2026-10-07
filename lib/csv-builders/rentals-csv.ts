// lib/csv-builders/rentals-csv.ts
//
// Shared CSV builder for the operator's finance export. Used by:
//   • /api/franchize/rentals-csv-export  (direct file download)
//   • server-action sendAnalyticsCsvToTelegram (send via bot to operator's chat)
//
// iter52 (2026-10-07, boss request): the sheet is now BLOCK-structured —
// separate «АРЕНДЫ», «ЭКИП», «СЕРВИС», «ПРОДАЖИ» blocks + «СВОДКА».
// Previously everything (bike rentals, gear docs, service works) was mixed
// into one 21-column grid whose «Итого» included service & gear — the boss
// asked for separate blocks with separate totals. See
// lib/csv-builders/rentals-csv-sections.ts for the block model.
//
// Salary semantics per block (docs/PRD_SALARY_COEFFICIENTS.md):
//   АРЕНДЫ  «ЗП Аренда» = категорийный бонус техники + бонус за экип
//            (₽ × количество единиц) + оверпрайс % × наценка над каталогом.
//            Gear issued WITH a bike is paid HERE (units are counted from
//            metadata.equipment) — not again in the ЭКИП block.
//   ЭКИП    — no salary column: standalone gear docs already have their bonus
//            counted in the paired bike rental row (double-count guard).
//   СЕРВИС  — no salary column: the official scheme has no service bonus.
//   ПРОДАЖИ «ЗП Продажа» = категорийный бонус продажи техники.
//
// Coefficients are configurable at /franchize/[slug]/salary-coefficients;
// defaults come from the official bonus document (lib/salary-coefficients.ts).

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
import {
  rentalNotesSummary,
  rentalPhotoCountsLabel,
  subrenterChatIdFromSpecs,
  subrenterCsvLabel,
} from "@/lib/csv-builders/rental-csv-columns";
// iter25: shared money split — stored moto/gear amounts first, unit-price
// estimate fallback; getSubrenterCut = partner share of the BIKE part.
import {
  getEquipmentCostPart,
  getSubrenterCut,
} from "@/app/franchize/lib/subrenter-economics";
import { CSV_SECTION_TITLES } from "@/lib/csv-builders/rentals-csv-sections";

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

/** Which block a rental row belongs to (drives the block split). */
type RentalKind = "rental" | "equipment" | "service";

function classifyRental(meta: Record<string, unknown> | null, vehicleType: string | null | undefined): RentalKind {
  if (meta?.item_type === "equipment" || vehicleType === "equipment") return "equipment";
  if (vehicleType === "service") return "service";
  return "rental";
}

/** Per-block money/count totals (returned in summary.blocks + used by СВОДКА). */
export interface CsvBlockTotals {
  count: number;
  revenue: number;
  salary: number;
}

export interface RentalsCsvSummary {
  /** Back-compat: bike-rental count (АРЕНДЫ block rows). */
  rentals: number;
  /** Back-compat: sale-artifact count. */
  sales: number;
  /** Σ revenue across all blocks (аренды + экип + сервис + продажи). */
  totalRevenue: number;
  /** Operator salary = ЗП аренды + ЗП продажи (экип/сервис pay no bonus). */
  totalSalary: number;
  /** Σ «Партнеру» column of the АРЕНДЫ block. */
  totalPartnerPayouts: number;
  /** Σ «Экип» column of the АРЕНДЫ block (gear revenue inside rentals). */
  totalEquipment: number;
  blocks: {
    rentals: CsvBlockTotals;
    equipment: CsvBlockTotals;
    service: CsvBlockTotals;
    sales: CsvBlockTotals;
  };
}

export async function buildRentalsCsv(
  slug: string,
  from: string,
  to: string,
): Promise<{ csv: string; filename: string; summary: RentalsCsvSummary }> {
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

  // iter52: `type` is selected so rows can be routed to the АРЕНДЫ / ЭКИП /
  // СЕРВИС blocks (service works and equipment items are cars too).
  const { data: rentals, error } = await supabaseAdmin
    .from("rentals")
    .select(`
      rental_id, status, total_cost, payment_status,
      requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
      metadata, created_at, start_photo_count, end_photo_count,
      vehicle:cars!inner(id, make, model, crew_id, specs, daily_price, type)
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

  // ── Split rentals into blocks ─────────────────────────────────────────────
  const rentalRows: any[] = [];
  const equipmentRows: any[] = [];
  const serviceRows: any[] = [];
  for (const r of (rentals || []) as any[]) {
    const meta = (r.metadata || {}) as Record<string, unknown>;
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    const kind = classifyRental(meta, vehicle?.type);
    if (kind === "equipment") equipmentRows.push(r);
    else if (kind === "service") serviceRows.push(r);
    else rentalRows.push(r);
  }

  // ── Batched users lookup — subrenter labels (АРЕНДЫ) + «Выдал»/«Принял»
  //    (ЭКИП) resolve in ONE query. ─────────────────────────────────────────
  const userIds = new Set<string>();
  for (const r of rentalRows) {
    const id = subrenterChatIdFromSpecs(r.vehicle?.specs);
    if (id) userIds.add(id);
    const meta = r.metadata || {};
    const snapshot = typeof meta.subrenter_chat_id === "string" && meta.subrenter_chat_id.trim()
      ? meta.subrenter_chat_id.trim()
      : typeof meta.subrenter_chat_id === "number" ? String(meta.subrenter_chat_id) : null;
    if (snapshot) userIds.add(snapshot);
  }
  for (const r of equipmentRows) {
    const meta = r.metadata || {};
    for (const key of ["issued_by", "received_by"] as const) {
      const v = meta[key];
      if (typeof v === "string" && v.trim()) userIds.add(v.trim());
      else if (typeof v === "number" && Number.isFinite(v)) userIds.add(String(v));
    }
  }
  const userById = new Map<string, { user_id: string; full_name: string | null; username: string | null }>();
  if (userIds.size > 0) {
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("user_id, full_name, username")
      .in("user_id", Array.from(userIds));
    for (const u of (users || []) as any[]) {
      userById.set(u.user_id, {
        user_id: u.user_id,
        full_name: u.full_name ?? null,
        username: u.username ?? null,
      });
    }
  }

  /** Compact operator label for «Выдал»/«Принял» (column stays narrow). */
  const compactUserLabel = (id: string | null | undefined): string => {
    if (!id) return "";
    const u = userById.get(id);
    if (!u) return id;
    return u.username ? `@${u.username}` : u.full_name || u.user_id;
  };

  const rows: string[] = [];

  // ══ Block 1: АРЕНДЫ (bike rentals) ═══════════════════════════════════════
  // 15 columns — the classic finance-sheet rental columns; the sale columns
  // moved to their own block (previously shared the same rows via col 13-17).
  rows.push(CSV_SECTION_TITLES.rentals);
  rows.push(rowOf([
    "Дата", "ЗП Аренда", "Партнеру", "Цена", "Экип", "Залог",
    "Марка", "Пробег до", "Пробег после", "Время", "Комментарий",
    "Заметки", "Субарендатор", "Фото", "ID",
  ]));

  const blockRentals: CsvBlockTotals = { count: 0, revenue: 0, salary: 0 };
  let totalPartnerPayouts = 0;
  let totalEquipment = 0;

  for (const r of rentalRows) {
    const meta = r.metadata || {};
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    const bikeName = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim();

    const startDate = r.requested_start_date || r.agreed_start_date || r.created_at;
    const endDate = r.requested_end_date || r.agreed_end_date;
    const dateStr = startDate
      ? new Date(startDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
      : "";

    const price = r.total_cost || 0;
    blockRentals.revenue += price;

    // iter25: moto/gear split of THIS rental — stored amounts (exact) when the
    // row carries them (iter25+ writers), unit-price estimate for legacy rows.
    // 2026-10-03: duration-aware window — legacy rows pro-rate the gear part
    // from the real rental window (half price <24h), matching every report.
    const equipmentPartRub = getEquipmentCostPart(meta, price, {
      startIso: startDate,
      endIso: endDate,
    });
    totalEquipment += equipmentPartRub;

    // iter25: partner payout — subrented bikes only. The metadata snapshot
    // (deal-time truth) wins over the current bike specs, so historical rows
    // stay correct after a bike is re-assigned to another partner.
    const subrenterIdSnapshot =
      typeof meta.subrenter_chat_id === "string" && meta.subrenter_chat_id.trim()
        ? meta.subrenter_chat_id.trim()
        : typeof meta.subrenter_chat_id === "number"
          ? String(meta.subrenter_chat_id)
          : null;
    const subrenterId = subrenterIdSnapshot ?? subrenterChatIdFromSpecs(r.vehicle?.specs);
    const partnerPayout = subrenterId ? getSubrenterCut(price, equipmentPartRub) : 0;
    if (partnerPayout > 0) totalPartnerPayouts += partnerPayout;

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
    blockRentals.salary += salary.total;
    blockRentals.count += 1;

    // Equipment (FIX F2-iter2): charger is free. iter25: the charged amount
    // (stored split) is the source of truth; the estimate (~) only for legacy
    // rows. The "~" marker matches the analytics drawer convention.
    const equipCost = equipmentPartRub;
    const equipExact = Number(meta.equipment_price) >= 0 && meta.equipment_price != null;
    const equipParts: string[] = [];
    if (Number(eq.helmets) > 0) equipParts.push(`${eq.helmets}шл`);
    if (Number(eq.gloves) > 0) equipParts.push(`${eq.gloves}перч`);
    if (eq.jacket) equipParts.push("курт");
    if (eq.pants) equipParts.push("шт");
    if (eq.boots) equipParts.push("бот");
    if (eq.net) equipParts.push("сет");
    if (eq.backpack) equipParts.push("рюк");
    if (eq.charger) equipParts.push("заряд↔");
    const equipStr = equipParts.length > 0 ? `${equipParts.join("+")} (${equipCost}${equipExact ? "" : "~"})` : "";

    const depositAmount = Number(meta.deposit_amount || 0);
    // iter20: deposit method — direct metadata, else derived from the payment
    // split (the split always routes the deposit into its cash part), same
    // backfill rule the analytics sheet uses in getDepositInfo().
    const split = (meta.payment_split || {}) as { cash?: number; card_destination?: string | null };
    const depositMethodRaw =
      meta.deposit_method === "cash" || meta.deposit_method === "tbank" || meta.deposit_method === "sber"
        ? meta.deposit_method
        : depositAmount > 0 && Number(split.cash ?? 0) >= depositAmount
          ? "cash"
          : depositAmount > 0 && typeof split.card_destination === "string" && split.card_destination
            ? split.card_destination
            : null;
    const depositMethod =
      depositMethodRaw === "cash" ? " нал"
      : depositMethodRaw === "tbank" ? " ТБанк"
      : depositMethodRaw === "sber" ? " Сбербанк"
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

    // iter20: notes / subrenter / photos.
    const notesStr = rentalNotesSummary(meta);
    const subrenterStr = subrenterId
      ? subrenterCsvLabel(userById.get(subrenterId) ?? { user_id: subrenterId, full_name: null, username: null })
      : "";
    const photosStr = rentalPhotoCountsLabel(r.start_photo_count, r.end_photo_count);

    rows.push(rowOf([
      dateStr, salaryStr, partnerPayout > 0 ? String(partnerPayout) : "", price, equipStr, depositStr,
      bikeName, odoBefore, odoAfter, timeStr, comment,
      notesStr, subrenterStr, photosStr, r.rental_id || "",
    ]));
  }

  rows.push(rowOf([
    "Итого аренды",
    blockRentals.salary,
    totalPartnerPayouts > 0 ? totalPartnerPayouts : "",
    blockRentals.revenue,
    totalEquipment,
    (rentalRows as any[]).reduce((sum, r) => sum + Number(r.metadata?.deposit_amount || 0), 0),
    "", "", "", "", "", "", "", "", "",
  ]));
  rows.push("");

  // ══ Block 2: ЭКИП (standalone equipment docs) ════════════════════════════
  // NO ЗП column — the gear bonus is already counted in the paired bike
  // rental's «ЗП Аренда» (equipmentUnits × 200 ₽). Paying it here too would
  // double-pay the operator for the same units (boss request, iter52).
  rows.push(CSV_SECTION_TITLES.equipment);
  rows.push(rowOf([
    "Дата", "Наименование", "Цена", "Выдал", "Принял", "Комментарий", "ID",
  ]));

  const blockEquipment: CsvBlockTotals = { count: 0, revenue: 0, salary: 0 };
  for (const r of equipmentRows) {
    const meta = r.metadata || {};
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;

    const startDate = r.requested_start_date || r.agreed_start_date || meta.issued_at || r.created_at;
    const dateStr = startDate
      ? new Date(startDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
      : "";

    // Item label — snapshot title first, then the linked item card name.
    const eqItems = Array.isArray(meta.equipment_items) ? meta.equipment_items : [];
    let title = "";
    if (eqItems.length > 0) {
      title = eqItems.map((i: any) => i.title || i.id).join("+");
      if (eqItems.length > 1) title += ` (${eqItems.length} шт.)`;
    } else if (typeof meta.equipment_title === "string" && meta.equipment_title.trim()) {
      title = meta.equipment_title.trim();
    } else {
      title = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim() || "экип";
    }
    const size = typeof meta.equipment_size === "string" && meta.equipment_size.trim()
      ? meta.equipment_size.trim()
      : "";
    const qty = Number(meta.quantity) > 0 ? Number(meta.quantity) : 0;
    const nameStr = [title + (size ? ` (${size})` : ""), qty > 1 ? `×${qty}` : ""].filter(Boolean).join(" ");

    const price = r.total_cost || 0;
    blockEquipment.revenue += price;
    blockEquipment.count += 1;

    const issuedBy = typeof meta.issued_by === "string" ? meta.issued_by : meta.issued_by != null ? String(meta.issued_by) : "";
    const receivedBy = typeof meta.received_by === "string" ? meta.received_by : meta.received_by != null ? String(meta.received_by) : "";
    const renterName = typeof meta.renter_name === "string" ? meta.renter_name : "";
    const condition = typeof meta.equipment_condition === "string" && meta.equipment_condition.trim() && meta.equipment_condition.trim() !== "Норм"
      ? meta.equipment_condition.trim()
      : "";
    const comment = [renterName, condition].filter(Boolean).join(", ");

    rows.push(rowOf([
      dateStr, nameStr, price, compactUserLabel(issuedBy), compactUserLabel(receivedBy), comment,
      r.rental_id || "",
    ]));
  }

  rows.push(rowOf([
    "Итого экип", "", blockEquipment.revenue, "", "", "", "",
  ]));
  rows.push("");

  // ══ Block 3: СЕРВИС (service works) ══════════════════════════════════════
  // NO ЗП column — the official bonus scheme (docs/PRD_SALARY_COEFFICIENTS.md)
  // pays operators only for rentals, gear units and sales; service works are
  // tracked for revenue only (boss request, iter52: «итого включало сервис»).
  rows.push(CSV_SECTION_TITLES.service);
  rows.push(rowOf([
    "Дата", "Услуга", "Байк", "Цена", "ID",
  ]));

  const blockService: CsvBlockTotals = { count: 0, revenue: 0, salary: 0 };
  for (const r of serviceRows) {
    const meta = r.metadata || {};
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;

    const startDate = r.requested_start_date || r.agreed_start_date || meta.performed_at || r.created_at;
    const dateStr = startDate
      ? new Date(startDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
      : "";

    const svcName = typeof meta.service_name === "string" && meta.service_name.trim()
      ? meta.service_name.trim()
      : `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim() || "работа";
    const bikeName = typeof meta.bike === "string" ? meta.bike : "";
    const price = r.total_cost || 0;
    blockService.revenue += price;
    blockService.count += 1;

    rows.push(rowOf([
      dateStr, svcName, bikeName, price, r.rental_id || "",
    ]));
  }

  rows.push(rowOf([
    "Итого сервис", "", "", blockService.revenue, "",
  ]));
  rows.push("");

  // ══ Block 4: ПРОДАЖИ (sale artifacts) ════════════════════════════════════
  rows.push(CSV_SECTION_TITLES.sales);
  rows.push(rowOf([
    "Дата", "ЗП Продажа", "Наименование", "Цена", "Комментарий", "ID",
  ]));

  const blockSales: CsvBlockTotals = { count: 0, revenue: 0, salary: 0 };
  for (const s of (sales || []) as any[]) {
    const dateStr = s.created_at
      ? new Date(s.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" })
      : "";
    const bikeName = bikeNameById.get(s.resolved_bike_id) || "";
    const price = Number(s.sale_price) || 0;
    const comment = s.buyer_full_name || "";

    const saleCategories = resolveBikeCategories(s.resolved_bike_id || "", bikeOverrides);
    const saleSalary = computeSaleSalary({
      config: salaryConfig,
      saleCategory: saleCategories.sale,
    });
    blockSales.salary += saleSalary.total;
    blockSales.revenue += price;
    blockSales.count += 1;

    rows.push(rowOf([
      dateStr, String(saleSalary.total), bikeName, price, comment,
      s.id || "",
    ]));
  }

  rows.push(rowOf([
    "Итого продажи", blockSales.salary, "", blockSales.revenue, "", "",
  ]));
  rows.push("");

  // ══ Block 5: СВОДКА (per-block totals) ═══════════════════════════════════
  rows.push(CSV_SECTION_TITLES.summary);
  rows.push(rowOf(["Блок", "Записей", "Выручка", "ЗП", "Примечание"]));
  const totalRevenue =
    blockRentals.revenue + blockEquipment.revenue + blockService.revenue + blockSales.revenue;
  const totalSalary = blockRentals.salary + blockSales.salary;
  const totalCount =
    blockRentals.count + blockEquipment.count + blockService.count + blockSales.count;

  rows.push(rowOf([
    "Аренды", blockRentals.count, blockRentals.revenue, blockRentals.salary,
    "категория техники + экип при аренде + оверпрайс",
  ]));
  rows.push(rowOf([
    "Экип", blockEquipment.count, blockEquipment.revenue, 0,
    "ЗП не начисляется — бонус за экип уже учтён в ЗП аренд",
  ]));
  rows.push(rowOf([
    "Сервис", blockService.count, blockService.revenue, 0,
    "по официальной схеме ЗП за сервис не начисляется",
  ]));
  rows.push(rowOf([
    "Продажи", blockSales.count, blockSales.revenue, blockSales.salary,
    "категория техники",
  ]));
  rows.push(rowOf([
    "ВСЕГО", totalCount, totalRevenue, totalSalary, "",
  ]));

  const csv = "\uFEFF" + rows.join("\n");
  const filename = `${slug}-rentals-${from}-to-${to}.csv`;

  return {
    csv,
    filename,
    summary: {
      rentals: blockRentals.count,
      sales: blockSales.count,
      totalRevenue,
      totalSalary,
      // iter25: partner payouts of the period (Σ «Партнеру» column)
      totalPartnerPayouts,
      totalEquipment,
      blocks: {
        rentals: blockRentals,
        equipment: blockEquipment,
        service: blockService,
        sales: blockSales,
      },
    },
  };
}
