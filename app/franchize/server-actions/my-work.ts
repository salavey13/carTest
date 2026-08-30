// app/franchize/server-actions/my-work.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  verifyCrewAccess,
  handleError,
} from "./shared/auth-helpers";
import {
  getSalaryConfig,
  getBikeCategoryOverrides,
  resolveBikeCategories,
  countEquipmentUnits,
  computeRentalSalary,
  equipmentStandardCost,
  standardRentalPrice,
  type RentalEquipment,
} from "@/lib/salary-coefficients";
import {
  resolveRentalOperator,
  ATTRIBUTION_SOURCE_LABELS,
  type AttributionSource,
  type ShiftLike,
} from "@/app/franchize/lib/operator-attribution";

/**
 * I5 — My Work server actions for profile sections.
 * Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 5)
 *
 * iter26 REWORK (client request 2026-08-30):
 *  «в профиле нет date picker — видно только сегодня, и цифры не сходятся
 *   с таблицей на rentals-analytics». Причина: карточка «Аренды» показывала
 *   СМЕНЫ (crew_member_shifts), а не аренды — 1 смена 1375₽ ≠ 2 аренды с ЗП
 *   1600 + 1150. Теперь:
 *   • date picker — любой день (MSK), по умолчанию сегодня;
 *   • «Аренды» = реальные аренды, начавшиеся в выбранный день и
 *     атрибутированные оператору (та же цепочка resolveRentalOperator, что в
 *     зарплатной модели), ЗП считается тем же computeRentalSalary, что и в
 *     CSV/таблице аналитики → цифры совпадают 1:1;
 *   • отменённые аренды исключаются (как в CSV и calculateSalaryForPeriod);
 *   • смены показываются отдельной карточкой «Смены»;
 *   • итог дня = смены + ЗП аренд + продажи + сервис/возвраты.
 *
 * 2026-08-19 fixes kept:
 *  • IDOR: cookie-derived actorUserId (client `userId` param ignored).
 *  • crew_member_shifts queried by real columns (clock_in_time / hourly_rate).
 *  • UTC day literals (not server-local setHours).
 */

export interface MyWorkRentalDetail {
  rentalId: string;
  bikeLabel: string;
  status: string;
  /** Revenue of the rental (total_cost), ₽. */
  revenue: number;
  /** Operator salary for this rental (computeRentalSalary), ₽. */
  salary: number;
  /** How the rental was credited to the operator (label like «/doc»). */
  sourceLabel: string;
}

export async function getMyWorkDayAction(params: {
  slug: string;
  /** Kept for backward compat — ignored (cookie identity used instead). */
  userId?: string;
  /** MSK calendar day "YYYY-MM-DD". Defaults to today (Moscow). */
  date?: string;
}): Promise<{
  success: boolean;
  data?: {
    date: string;
    isToday: boolean;
    shifts: { count: number; total: number };
    rentals: { count: number; revenue: number; salary: number };
    sales: { count: number; total: number };
    serviceReturns: { count: number; total: number };
    /** Итого за день: смены + ЗП аренд + продажи + сервис/возвраты. */
    totalDay: number;
    rentalDetails: MyWorkRentalDetail[];
  };
  error?: string;
}> {
  const { slug } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const secureUserId = access.actorUserId;
    if (!secureUserId) {
      return { success: false, error: "Не авторизовано." };
    }

    // ── Day window in Europe/Moscow (server runs UTC) ──
    const now = new Date();
    const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
    const moscowNow = new Date(now.getTime() + MOSCOW_OFFSET_MS);
    const todayKey = moscowNow.toISOString().slice(0, 10);

    const requested = (params.date || "").trim();
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayKey;
    // Guard against nonsense dates (e.g. 2026-02-31) — Date.UTC rolls them
    // over, so normalize back and fall back to today when they differ.
    const [ry, rm, rd] = dateKey.split("-").map(Number);
    const normalizedKey = new Date(Date.UTC(ry, rm - 1, rd)).toISOString().slice(0, 10);
    const dayKey = normalizedKey === dateKey ? dateKey : todayKey;

    // MSK calendar-day window (Europe/Moscow = UTC+3) — matches the analytics
    // view's localDateOnly() scoping, so "my rentals for Aug 30" is the same
    // set on the profile and on the rentals-analytics day page. (A plain UTC
    // day window would leak 21:00Z–00:00Z rentals into the wrong day.)
    const startOfDay = new Date(`${dayKey}T00:00:00.000+03:00`).toISOString();
    const endOfDay = new Date(`${dayKey}T23:59:59.999+03:00`).toISOString();

    // ── My shifts for the day ──
    const { data: myShifts, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id, clock_in_time, clock_out_time, hourly_rate, salary_amount")
      .eq("crew_id", access.crewId)
      .eq("member_id", secureUserId)
      .gte("clock_in_time", startOfDay)
      .lte("clock_in_time", endOfDay);

    if (shiftError) {
      logger.warn("[getMyWorkDayAction] Shifts query failed:", shiftError);
    }

    const shiftRows = myShifts || [];
    // Prefer stored salary_amount; for the running shift compute duration × rate.
    const shiftsTotal = shiftRows.reduce((sum: number, s: any) => {
      const stored = Number(s.salary_amount || 0);
      if (stored > 0) return sum + stored;
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      if (!start) return sum;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : new Date();
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const rate = Number(s.hourly_rate || 0);
      return sum + hours * rate;
    }, 0);

    // ── Rentals started this day, attributed to me (same math as the
    //    analytics CSV «ЗП Аренда» + the salary model attribution) ──
    // Crew-wide shifts with a ±1 day margin — attribution cross-reference
    // (mirrors computeCategoryBonuses: a rental created at 23:50 can match
    // an operator clocked in the previous day).
    const marginStart = new Date(Date.parse(startOfDay) - 24 * 3600 * 1000).toISOString();
    const marginEnd = new Date(Date.parse(endOfDay) + 24 * 3600 * 1000).toISOString();
    const { data: crewShiftRows } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("member_id, clock_in_time, clock_out_time")
      .eq("crew_id", access.crewId)
      .gte("clock_in_time", marginStart)
      .lte("clock_in_time", marginEnd);
    const allShifts: ShiftLike[] = (crewShiftRows || []).map((s: any) => ({
      member_id: s.member_id,
      clock_in_time: s.clock_in_time,
      clock_out_time: s.clock_out_time ?? null,
    }));

    const { data: dayRentals, error: rentalsError } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id, status, total_cost, metadata, created_at,
        created_by_operator_chat_id,
        requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
        vehicle:cars!inner(id, make, model, crew_id, specs, daily_price)
      `)
      .eq("vehicle.crew_id", access.crewId)
      .neq("status", "cancelled")
      .gte("requested_start_date", startOfDay)
      .lte("requested_start_date", endOfDay)
      .order("requested_start_date", { ascending: true });

    if (rentalsError) {
      logger.warn("[getMyWorkDayAction] Rentals query failed:", rentalsError);
    }

    // Salary engine — same config path as buildRentalsCsv so the profile
    // numbers are IDENTICAL to the analytics table view «ЗП Аренда».
    const [salaryConfig, bikeOverrides] = await Promise.all([
      getSalaryConfig(access.crewId!),
      getBikeCategoryOverrides(access.crewId!),
    ]);

    const rentalDetails: MyWorkRentalDetail[] = [];
    let rentalsRevenue = 0;
    let rentalsSalary = 0;
    for (const r of (dayRentals || []) as any[]) {
      const attribution = resolveRentalOperator(r, allShifts);
      if (attribution.operatorId !== secureUserId) continue;

      const meta = r.metadata || {};
      const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
      const bikeLabel = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim() || "Байк";
      const eq = (meta.equipment || {}) as RentalEquipment;
      const price = Number(r.total_cost) || 0;
      const startDate = r.requested_start_date || r.agreed_start_date;
      const endDate = r.requested_end_date || r.agreed_end_date;
      const stdPrice =
        standardRentalPrice({
          specs: vehicle?.specs,
          startIso: startDate,
          endIso: endDate,
          dailyPrice: vehicle?.daily_price,
          fallbackTotalCost: price,
        }) + equipmentStandardCost(eq);
      const categories = resolveBikeCategories(vehicle?.id || "", bikeOverrides);
      const salary = computeRentalSalary({
        config: salaryConfig,
        rentalCategory: categories.rental,
        equipmentUnits: countEquipmentUnits(eq),
        totalCost: price,
        standardPrice: stdPrice,
      });

      rentalsRevenue += price;
      rentalsSalary += salary.total;
      rentalDetails.push({
        rentalId: String(r.rental_id),
        bikeLabel,
        status: r.status || "unknown",
        revenue: price,
        salary: salary.total,
        sourceLabel: ATTRIBUTION_SOURCE_LABELS[attribution.source as AttributionSource] || "—",
      });
    }

    // ── Sales commissions (cash_transactions, «продажа») ──
    const { data: salesCommissions, error: salesError } = await supabaseAdmin
      .from("cash_transactions")
      .select("id, amount, description")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", secureUserId)
      .eq("transaction_type", "expense_commission")
      .gte("transaction_date", startOfDay)
      .lte("transaction_date", endOfDay)
      .like("description", "%продажа%");

    if (salesError) {
      logger.warn("[getMyWorkDayAction] Sales commissions query failed:", salesError);
    }

    const salesTotal = (salesCommissions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

    // ── Service / returns commissions ──
    const { data: serviceCommissions, error: serviceError } = await supabaseAdmin
      .from("cash_transactions")
      .select("id, amount, description")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", secureUserId)
      .eq("transaction_type", "expense_commission")
      .gte("transaction_date", startOfDay)
      .lte("transaction_date", endOfDay)
      .or("description.ilike.%сервис%,description.ilike.%возврат%");

    if (serviceError) {
      logger.warn("[getMyWorkDayAction] Service commissions query failed:", serviceError);
    }

    const serviceTotal = (serviceCommissions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

    const totalDay =
      Math.round(shiftsTotal) + rentalsSalary + salesTotal + serviceTotal;

    return {
      success: true,
      data: {
        date: dayKey,
        isToday: dayKey === todayKey,
        shifts: {
          count: shiftRows.length,
          total: Math.round(shiftsTotal),
        },
        rentals: {
          count: rentalDetails.length,
          revenue: rentalsRevenue,
          salary: rentalsSalary,
        },
        sales: {
          count: salesCommissions?.length || 0,
          total: salesTotal,
        },
        serviceReturns: {
          count: serviceCommissions?.length || 0,
          total: serviceTotal,
        },
        totalDay,
        rentalDetails,
      },
    };
  } catch (err) {
    logger.error("[getMyWorkDayAction] Exception:", err);
    return { success: false, error: handleError(err, "getMyWorkDayAction") };
  }
}

/**
 * Backward-compatible alias — the profile used to call this name.
 * Kept so any stale imports keep working (it now accepts the same params).
 */
export const getMyWorkTodayAction = getMyWorkDayAction;
