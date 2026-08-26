// app/franchize/server-actions/salary-calculations.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  verifyCrewAccess,
  handleError,
  successResponse,
  errorResponse,
  type ActionResponse,
} from "./shared/auth-helpers";
import {
  getSalaryConfig,
  getBikeCategoryOverrides,
  resolveBikeCategories,
  countEquipmentUnits,
  computeRentalSalary,
  computeSaleSalary,
  equipmentStandardCost,
  standardRentalPrice,
  hasSalaryCoefficients,
  RENTAL_CATEGORY_LABELS,
  type RentalEquipment,
} from "@/lib/salary-coefficients";

/**
 * I5 — Salary calculations server actions.
 * Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 3)
 */

// Cache для расчётов зарплаты (24 часа TTL для оптимизации повторных запросов)
const salaryCalcCache = new Map<string, { data: any; expiry: number }>();

/**
 * Category-bonus method (official scheme, docs/PRD_SALARY_COEFFICIENTS.md):
 * rental + sale bonuses computed directly from rentals / sale_contract_artifacts
 * credited to the member. Used by calculateSalaryForPeriod when the crew has
 * salary coefficients configured (crews.metadata.franchize.salaryCoefficients);
 * replaces the percentage commission for rental/sale income (prevents double counting).
 */
async function computeCategoryBonuses(params: {
  crewId: string;
  memberId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{
  total: number;
  details: Array<{ type: string; amount: number; description: string }>;
}> {
  const { crewId, memberId, periodStart, periodEnd } = params;
  const details: Array<{ type: string; amount: number; description: string }> = [];

  const [config, bikeOverrides] = await Promise.all([
    getSalaryConfig(crewId),
    getBikeCategoryOverrides(crewId),
  ]);

  // ── Rental bonuses: rentals credited to this operator in the period ──
  const { data: rentals, error: rentalsError } = await supabaseAdmin
    .from("rentals")
    .select(`
      rental_id, total_cost, metadata,
      requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
      vehicle:cars!inner(id, make, model, crew_id, specs, daily_price)
    `)
    .eq("vehicle.crew_id", crewId)
    .eq("created_by_operator_chat_id", memberId)
    .neq("status", "cancelled")
    .gte("requested_start_date", periodStart)
    .lt("requested_start_date", periodEnd);

  if (rentalsError) {
    logger.warn("[calculateSalaryForPeriod] category rentals query failed:", rentalsError);
  }

  const byRentalCategory = new Map<string, { count: number; amount: number }>();
  let rentalTotal = 0;
  for (const r of (rentals || []) as any[]) {
    const meta = r.metadata || {};
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    const categories = resolveBikeCategories(vehicle?.id || "", bikeOverrides);
    const eq = (meta.equipment || {}) as RentalEquipment;
    const price = Number(r.total_cost) || 0;
    const stdPrice =
      standardRentalPrice({
        specs: vehicle?.specs,
        startIso: r.requested_start_date || r.agreed_start_date,
        endIso: r.requested_end_date || r.agreed_end_date,
        dailyPrice: vehicle?.daily_price,
        fallbackTotalCost: price,
      }) + equipmentStandardCost(eq);
    const salary = computeRentalSalary({
      config,
      rentalCategory: categories.rental,
      equipmentUnits: countEquipmentUnits(eq),
      totalCost: price,
      standardPrice: stdPrice,
    });
    rentalTotal += salary.total;
    const label = RENTAL_CATEGORY_LABELS[categories.rental];
    const bucket = byRentalCategory.get(label) || { count: 0, amount: 0 };
    bucket.count += 1;
    bucket.amount += salary.total;
    byRentalCategory.set(label, bucket);
  }

  if (rentalTotal > 0 || byRentalCategory.size > 0) {
    for (const [label, agg] of byRentalCategory) {
      details.push({
        type: "rental_category_bonus",
        amount: agg.amount,
        description: `Аренда (${label}): ${agg.count} × бонусы`,
      });
    }
  }

  // ── Sale bonuses: sale contracts created in the member's chat ──
  const { data: crewBikes } = await supabaseAdmin
    .from("cars")
    .select("id")
    .eq("crew_id", crewId);
  const crewBikeIds = (crewBikes || []).map((b: any) => b.id);

  let saleTotal = 0;
  if (crewBikeIds.length > 0) {
    const { data: sales, error: salesError } = await (supabaseAdmin as any)
      .schema("private")
      .from("sale_contract_artifacts")
      .select("id, sale_price, resolved_bike_id, created_at")
      .in("resolved_bike_id", crewBikeIds)
      .eq("telegram_chat_id", memberId)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd);

    if (salesError) {
      logger.warn("[calculateSalaryForPeriod] category sales query failed:", salesError);
    }

    const bySaleCategory = new Map<string, { count: number; amount: number }>();
    for (const s of (sales || []) as any[]) {
      const categories = resolveBikeCategories(s.resolved_bike_id || "", bikeOverrides);
      const salary = computeSaleSalary({
        config,
        saleCategory: categories.sale,
        salePrice: Number(s.sale_price) || 0,
      });
      saleTotal += salary.total;
      const label = categories.sale === "enduro_moped" ? "эндуро/мопеды" : categories.sale === "premium" ? "премиум" : "обычные";
      const bucket = bySaleCategory.get(label) || { count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += salary.total;
      bySaleCategory.set(label, bucket);
    }

    for (const [label, agg] of bySaleCategory) {
      details.push({
        type: "sale_category_bonus",
        amount: agg.amount,
        description: `Продажа (${label}): ${agg.count} × бонусы`,
      });
    }
  }

  return { total: rentalTotal + saleTotal, details };
}

/**
 * Проверяет, пересекаются ли периоды дат.
 *
 * @param existingStart - Начало существующего периода
 * @param existingEnd - Конец существующего периода
 * @param newStart - Начало нового периода
 * @param newEnd - Конец нового периода
 * @returns true если периоды пересекаются
 */
function periodsOverlap(
  existingStart: string,
  existingEnd: string,
  newStart: string,
  newEnd: string
): boolean {
  const eStart = new Date(existingStart);
  const eEnd = new Date(existingEnd);
  const nStart = new Date(newStart);
  const nEnd = new Date(newEnd);

  // Периоды пересекаются если: (StartA <= EndB) и (EndA >= StartB)
  return eStart < nEnd && eEnd > nStart;
}

/**
 * Получает существующий план зарплаты или создаёт новый для указанного периода.
 *
 * @param params - Параметры для получения/создания плана
 * @param params.slug - Slug команды для доступа
 * @param params.actorUserId - ID пользователя, выполняющего действие
 * @param params.memberId - ID сотрудника, для которого создаётся план
 * @param params.periodStart - Начало периода в формате ISO
 * @param params.periodEnd - Конец периода в формате ISO
 * @returns Объект с success и id плана, или error
 *
 * @throws Возвращает ошибку, если пользователь не владелец или период некорректен
 */
export async function getOrCreateSalaryPlan(params: {
  slug: string;
  actorUserId: string;
  memberId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<ActionResponse<{ id: string }>> {
  const { slug, actorUserId, memberId, periodStart, periodEnd } = params;

  // Валидация периодов
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  if (startDate >= endDate) {
    return { success: false, error: "Дата начала должна быть раньше даты окончания." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    // Only owners can manage salary plans
    if (!access.allowed || !access.isOwner) {
      return { success: false, error: "Только владелец может управлять планами зарплаты." };
    }

    // Try to get existing plan
    const { data: existing } = await supabaseAdmin
      .from("salary_plans")
      .select("id")
      .eq("crew_id", access.crewId)
      .eq("member_id", memberId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (existing) {
      return { success: true, data: { id: existing.id } };
    }

    // Проверка на пересечение периодов с улучшенным сообщением (Priority 2 Fix 5)
    // Defensive (2026-08-19 review): the check_period_overlap RPC may be
    // missing on environments where migration 20260814000001_fix_salary_commission_flow.sql
    // wasn't applied (same class of issue as has_commission_rates). Fall back
    // to a direct query against salary_plans when the RPC errors out.
    let overlappingPlans: any[] | null = null;
    try {
      const { data, error: rpcErr } = await supabaseAdmin
        .rpc("check_period_overlap", {
          p_crew_id: access.crewId,
          p_member_id: memberId,
          p_period_start: periodStart,
          p_period_end: periodEnd,
        });
      if (rpcErr) {
        logger.warn("[getOrCreateSalaryPlan] check_period_overlap RPC failed, falling back to direct query:", rpcErr);
      } else {
        overlappingPlans = data;
      }
    } catch (rpcException) {
      logger.warn("[getOrCreateSalaryPlan] check_period_overlap RPC threw, falling back to direct query:", rpcException);
    }

    if (overlappingPlans === null) {
      // Fallback: a period overlaps if there's an existing plan for this
      // member where period_start < newEnd AND period_end > newStart.
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const { data: fallback, error: fallbackErr } = await supabaseAdmin
        .from("salary_plans")
        .select("id, period_start, period_end")
        .eq("crew_id", access.crewId)
        .eq("member_id", memberId)
        .lt("period_start", endDate.toISOString())
        .gt("period_end", startDate.toISOString());
      if (fallbackErr) {
        logger.warn("[getOrCreateSalaryPlan] Fallback overlap query failed:", fallbackErr);
      }
      overlappingPlans = (fallback || []).map((p: any) => ({
        ...p,
        conflict_description: `Период пересекается с планом ${p.period_start} → ${p.period_end}`,
      }));
    }

    if (overlappingPlans && overlappingPlans.length > 0) {
      const overlap = overlappingPlans[0];
      logger.warn("[getOrCreateSalaryPlan] Period overlap detected", {
        crewId: access.crewId,
        memberId,
        newPeriod: { start: periodStart, end: periodEnd },
      });
      return {
        success: false,
        error: overlap.conflict_description || "Период пересекается с существующим планом зарплаты."
      };
    }

    // Create new plan
    const { data: plan, error } = await supabaseAdmin
      .from("salary_plans")
      .insert({
        crew_id: access.crewId,
        member_id: memberId,
        period_start: periodStart,
        period_end: periodEnd,
        payout_schedule: ["10", "25"],
        balance_due: 0,
      })
      .select("id")
      .single();

    if (error || !plan) {
      logger.error("[getOrCreateSalaryPlan] Insert failed:", error);
      return { success: false, error: "Не удалось создать план." };
    }

    return successResponse({ id: plan.id });
  } catch (err) {
    logger.error("[getOrCreateSalaryPlan] Exception:", err);
    return errorResponse(handleError(err, "getOrCreateSalaryPlan"));
  }
}

/**
 * Рассчитывает доход сотрудника за указанный период.
 *
 * Integration with shifts and commissions:
 * - Shifts: Uses salary_amount from crew_member_shifts (auto-calculated as duration_minutes/60 * hourly_rate)
 * - Commissions: Looks up commission rates from commission_rates table based on operation_type
 *   Applies percentages to cash_transactions income types (rental, sale, equipment)
 *
 * @param params - Параметры для расчёта зарплаты
 * @param params.slug - Slug команды
 * @param params.actorUserId - ID пользователя, запрашивающего расчёт
 * @param params.memberId - ID сотрудника
 * @param params.periodStart - Начало периода
 * @param params.periodEnd - Конец периода
 * @returns Объект с breakdown доходов (смены, комиссии, бонусы) и итоговыми суммами
 *
 * Вычисляет доход от:
 * - Смены (salary_amount из crew_member_shifts)
 * - Комиссии (expense_commission транзакции + auto-calc from operation types)
 * - Бонусы (зарезервировано для будущего использования)
 */
export async function calculateSalaryForPeriod(params: {
  slug: string;
  actorUserId: string;
  memberId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<ActionResponse<{
  shiftIncome: number;
  commissionIncome: number;
  bonusIncome: number;
  totalIncome: number;
  breakdown: Array<{ type: string; amount: number; description: string }>;
}>> {
  const { slug, actorUserId, memberId, periodStart, periodEnd } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // CR fix (2026-08-19 review): owner-or-self check. Previously any active
    // crew member could call calculateSalaryForPeriod with any memberId and
    // read another member's full salary breakdown (IDOR). Owners (incl.
    // co_owner / admin roles per shared verifyCrewAccess) can query anyone;
    // regular members can only query their own.
    if (!access.isOwner && memberId !== access.actorUserId) {
      return {
        success: false,
        error: "Недостаточно прав для просмотра чужого расчёта зарплаты.",
      };
    }

    // Check if crew has commission rates configured (Priority 1 Fix 3)
    // Defensive: the has_commission_rates RPC may not be present on all
    // environments (migration 20260814000001 not yet applied). Fall back to
    // a direct count query on commission_rates instead of crashing.
    let useRateCalculation = false;
    try {
      const { data: hasRates, error: rpcError } = await supabaseAdmin
        .rpc("has_commission_rates", { p_crew_id: access.crewId });
      if (rpcError) {
        logger.warn("[calculateSalaryForPeriod] has_commission_rates RPC failed, falling back to direct count:", rpcError);
      } else {
        useRateCalculation = hasRates === true;
      }
      if (!useRateCalculation) {
        // Fallback: check commission_rates table directly
        const { count, error: countErr } = await supabaseAdmin
          .from("commission_rates")
          .select("id", { count: "exact", head: true })
          .eq("crew_id", access.crewId)
          .eq("is_active", true);
        if (!countErr && (count || 0) > 0) {
          useRateCalculation = true;
        }
      }
    } catch (err) {
      logger.warn("[calculateSalaryForPeriod] Failed to detect commission rates, defaulting to recorded method:", err);
    }

    // Category-bonus model (official scheme, PRD_SALARY_COEFFICIENTS.md):
    // active once the crew's metadata.franchize.salaryCoefficients block exists
    // (iter6 wrote the initial data for vip-bike).
    // Rental/sale income then uses fixed category bonuses computed from the
    // rentals / sale artifacts themselves; percentage rates keep applying only
    // to other income types (service, equipment, …) to avoid double counting.
    const useCategoryModel = await hasSalaryCoefficients(access.crewId!);

    // Get shift income
    // Проверяем кеш для расчётов зарплаты (оптимизация повторных запросов)
    // Priority 1 Fix 3: Include calculation method in cache key.
    // NOTE: cacheKey must be constructed AFTER `useRateCalculation` is
    // determined, otherwise referencing the const here triggers a
    // Temporal Dead Zone ReferenceError.
    const cacheKey = `${access.crewId}-${memberId}-${periodStart}-${periodEnd}-${useRateCalculation}-${useCategoryModel}`;
    const cached = salaryCalcCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      logger.debug("[calculateSalaryForPeriod] Cache hit", { cacheKey, useRateCalculation });
      return successResponse(cached.data);
    }

    // Query shifts using correct columns (clock_in_time / clock_out_time /
    // hourly_rate). `shift_start` and `bike_id` do NOT exist on
    // crew_member_shifts and previously caused the query to fail.
    const { data: shifts, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("clock_in_time, clock_out_time, hourly_rate, salary_amount")
      .eq("crew_id", access.crewId)
      .eq("member_id", memberId)
      .gte("clock_in_time", periodStart)
      .lt("clock_in_time", periodEnd);

    if (shiftError) {
      logger.warn("[calculateSalaryForPeriod] Shifts query failed:", shiftError);
    }

    const shiftIncome = (shifts || []).reduce((sum: number, s: any) => {
      // Prefer stored salary_amount (already rounded for completed shifts).
      // For active shifts where salary_amount is null, compute on the fly
      // from duration * hourly_rate so we don't report zero income.
      const stored = Number(s.salary_amount || 0);
      if (stored > 0) return sum + stored;

      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      if (!start) return sum;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : new Date();
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const rate = Number(s.hourly_rate || 0);
      return sum + (hours * rate);
    }, 0);

    // Get commission rates for this crew if using rate calculation
    let commissionRates: any[] | null = null;
    if (useRateCalculation) {
      const { data: rates, error: ratesError } = await supabaseAdmin
        .from("commission_rates")
        .select("*")
        .eq("crew_id", access.crewId)
        .eq("is_active", true);

      if (!ratesError) {
        commissionRates = rates;
      } else {
        logger.warn("[calculateSalaryForPeriod] Commission rates query failed:", ratesError);
      }
    }

    // Priority 1 Fix 3: Use calculated OR recorded commissions, not both
    let commissionIncome = 0;
    const breakdown: Array<{ type: string; amount: number; description: string }> = [];
    breakdown.push({ type: "shifts", amount: shiftIncome, description: "Смены" });

    // Category-bonus model (official scheme): fixed bonuses per equipment
    // category for rentals + sales, credited to the operator who closed them.
    if (useCategoryModel) {
      const categoryResult = await computeCategoryBonuses({
        crewId: access.crewId!,
        memberId,
        periodStart,
        periodEnd,
      });
      commissionIncome += categoryResult.total;
      breakdown.push(...categoryResult.details);
    }

    if (useRateCalculation && commissionRates && commissionRates.length > 0) {
      // Method 1: Calculate from commission rates (preferred when configured)
      // Build rate map: operation_type -> { commissionType, commissionValue }
      const rateMap = new Map();
      commissionRates.forEach((rate: any) => {
        // Use highest priority rate for each operation type
        const existing = rateMap.get(rate.operation_type);
        if (!existing || (rate.priority > existing.priority)) {
          rateMap.set(rate.operation_type, {
            commissionType: rate.commission_type,
            commissionValue: Number(rate.commission_value),
          });
        }
      });

      // Get all income transactions for this member to calculate commissions.
      // Under the category model, rental/sale income is already paid via fixed
      // category bonuses above — skip their percentage commissions to avoid
      // double counting (service/equipment percentages still apply).
      const txTypes = useCategoryModel
        ? ["income_equipment"]
        : ["income_rental", "income_sale", "income_equipment"];
      const { data: incomeTransactions, error: incomeError } = await supabaseAdmin
        .from("cash_transactions")
        .select("id, amount, transaction_type, flow_direction, description, transaction_date")
        .eq("crew_id", access.crewId)
        .eq("created_by", memberId)
        .in("transaction_type", txTypes)
        .gte("transaction_date", periodStart)
        .lt("transaction_date", periodEnd);

      if (!incomeError && incomeTransactions) {
        for (const tx of incomeTransactions) {
          const incomeAmount = Number(tx.amount);
          if (incomeAmount <= 0) continue;

          // Map transaction type to operation type
          let operationType: string | null = null;
          if (tx.transaction_type === "income_rental") {
            // Could be hourly or daily - for now assume daily
            operationType = "rental_daily";
          } else if (tx.transaction_type === "income_sale") {
            operationType = "sale";
          } else if (tx.transaction_type === "income_equipment") {
            operationType = "equipment_rental";
          }

          if (!operationType) continue;
          // Category model already paid rental/sale income via fixed bonuses.
          if (useCategoryModel && (operationType === "rental_daily" || operationType === "sale")) continue;

          const rate = rateMap.get(operationType);
          if (!rate) continue;

          let commissionAmount = 0;
          if (rate.commissionType === "percentage") {
            commissionAmount = (incomeAmount * rate.commissionValue) / 100;
          } else {
            commissionAmount = rate.commissionValue;
          }

          commissionIncome += commissionAmount;
          breakdown.push({
            type: `commission_${operationType}`,
            amount: commissionAmount,
            description: `Комиссия: ${tx.description || tx.transaction_type}`,
          });
        }
      }
    } else if (!useCategoryModel) {
      // Method 2: Use recorded expense_commission transactions (fallback when no
      // rates configured). Skipped under the category model — its fixed bonuses
      // already cover rental/sale income, and recorded commissions would double
      // count them.
      const { data: commissions, error: commError } = await supabaseAdmin
        .from("cash_transactions")
        .select("amount, description, transaction_date")
        .eq("crew_id", access.crewId)
        .eq("to_user_id", memberId)
        .eq("transaction_type", "expense_commission")
        .gte("transaction_date", periodStart)
        .lt("transaction_date", periodEnd);

      if (!commError && commissions) {
        commissionIncome = commissions.reduce((sum: number, c: any) => {
          const amount = Number(c.amount || 0);
          return sum + (amount > 0 ? amount : 0);
        }, 0);

        if (commissionIncome > 0) {
          breakdown.push({
            type: "commissions",
            amount: commissionIncome,
            description: "Комиссии (выплачено)"
          });
        }
      }
    }

    const totalIncome = shiftIncome + commissionIncome;

    const result = {
      shiftIncome,
      commissionIncome,
      bonusIncome: 0,
      totalIncome,
      breakdown,
    };

    // Кэшируем результат на 24 часа — но НЕ если there's an active (in-progress)
    // shift in the result. Active shifts compute their salary using `new Date()`
    // as the end time, so the cached value would freeze the live number for
    // 24h. Better to recompute on each request when a shift is still running.
    const hasActiveShift = (shifts || []).some((s: any) => !s.clock_out_time);
    if (!hasActiveShift) {
      salaryCalcCache.set(cacheKey, {
        data: result,
        expiry: Date.now() + 24 * 60 * 60 * 1000, // 24 часа
      });
    } else {
      logger.debug("[calculateSalaryForPeriod] Skipping cache (active shift present)", { cacheKey });
    }

    return successResponse(result);
  } catch (err) {
    logger.error("[calculateSalaryForPeriod] Exception:", err);
    return errorResponse(handleError(err, "calculateSalaryForPeriod"));
  }
}

/**
 * Регистрирует выплату зарплаты, создавая транзакцию и обновляя статус расчёта.
 *
 * @param params - Параметры для записи выплаты
 * @param params.slug - Slug команды
 * @param params.actorUserId - ID пользователя, выполняющего выплату
 * @param params.salaryCalcId - ID расчёта зарплаты
 * @returns Объект с success или error
 *
 * Процесс:
 * 1. Проверяет права доступа (владелец)
 * 2. Проверяет idempotency — если уже выплачено, возвращает success без изменений
 * 3. Создаёт транзакцию expense_salary
 * 4. Обновляет статус расчёта на "paid"
 */
export async function recordPayout(params: {
  slug: string;
  actorUserId: string;
  salaryCalcId: string;
}): Promise<ActionResponse> {
  const { slug, actorUserId, salaryCalcId } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed || !access.isOwner) {
      return { success: false, error: access.error || "Только владелец может выплачивать зарплату." };
    }

    // Get salary calculation with plan details in single query (optimization)
    const { data: calc, error: calcError } = await supabaseAdmin
      .from("salary_calculations")
      .select(`
        *,
        salary_plans!inner (
          member_id,
          crew_id
        )
      `)
      .eq("id", salaryCalcId)
      .maybeSingle();

    if (calcError || !calc) {
      return { success: false, error: "Расчёт не найден." };
    }

    const plan = calc.salary_plans;
    if (!plan) {
      return { success: false, error: "План не найден." };
    }

    // Idempotency: check if already paid
    if (calc.payout_status === "paid") {
      return { success: true }; // Already paid, no-op
    }

    // Create expense_salary transaction
    const { data: tx, error: txError } = await supabaseAdmin
      .from("cash_transactions")
      .insert({
        crew_id: plan.crew_id,
        salary_calc_id: calc.id,
        transaction_type: "expense_salary",
        flow_direction: "out",
        amount: calc.total_income,
        payment_method: "cash",
        category: "Зарплата",
        description: `Выплата зарплаты за период ${calc.period_start}`,
        transaction_date: new Date().toISOString(),
        to_user_id: plan.member_id,
        // CR fix (2026-19 review): use cookie-derived access.actorUserId for
        // created_by, NOT the client-supplied actorUserId param. Otherwise
        // an owner can attribute a payout to a different user in the audit
        // trail (c.f. CR fix H1 in createManualCashTransaction).
        created_by: access.actorUserId,
      })
      .select("id")
      .single();

    if (txError || !tx) {
      logger.error("[recordPayout] Failed to create transaction:", txError);
      return { success: false, error: "Не удалось создать транзакцию." };
    }

    // Update salary calculation
    const { error: updateError } = await supabaseAdmin
      .from("salary_calculations")
      .update({
        payout_status: "paid",
        paid_at: new Date().toISOString(),
        cash_transaction_id: tx.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", salaryCalcId);

    if (updateError) {
      logger.error("[recordPayout] Failed to update calculation:", updateError);
      return { success: false, error: "Не удалось обновить статус." };
    }

    logger.info("[recordPayout] Recorded payout", {
      salaryCalcId,
      transactionId: tx.id,
      amount: calc.total_income,
    });

    return successResponse();
  } catch (err) {
    logger.error("[recordPayout] Exception:", err);
    return errorResponse(handleError(err, "recordPayout"));
  }
}

/**
 * Records a salary payout for a member+period WITHOUT requiring a pre-existing
 * salary_calculations snapshot row. Computes the accrued amount dynamically
 * (same logic as getOwnerSalaryOverview / getMyEarnings), subtracts already-paid
 * amounts in the same period, and inserts an expense_salary transaction for the
 * remaining balance.
 *
 * Added 2026-08-19 review: previously the salary page's "Выплатить" button
 * called `recordPayout({ salaryCalcId })` — but salary_calculations is empty
 * for this crew, so the button always failed with "Расчёт не найден."
 *
 * Auth: owner / co_owner / admin only.
 */
export async function recordPayoutForPeriod(params: {
  slug: string;
  actorUserId?: string; // Deprecated: cookie-derived access.actorUserId is used
  memberId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<ActionResponse<{ transactionId: string; paidAmount: number }>> {
  const { slug, memberId, periodStart, periodEnd } = params;

  // Validate period
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { success: false, error: "Некорректный формат дат периода." };
  }
  if (startDate >= endDate) {
    return { success: false, error: "Дата начала должна быть раньше даты окончания." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed || !access.isOwner) {
      return {
        success: false,
        error: access.error || "Только владелец может выплачивать зарплату.",
      };
    }

    const periodStartIso = startDate.toISOString();
    const periodEndIso = endDate.toISOString();

    // Compute accrued for this member in this period (shifts + commissions)
    const { data: shifts } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("clock_in_time, clock_out_time, hourly_rate, salary_amount")
      .eq("crew_id", access.crewId)
      .eq("member_id", memberId)
      .gte("clock_in_time", periodStartIso)
      .lt("clock_in_time", periodEndIso);

    const shiftAccrued = (shifts || []).reduce((sum: number, s: any) => {
      const stored = Number(s.salary_amount || 0);
      if (stored > 0) return sum + stored;
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      if (!start) return sum;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : new Date();
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const rate = Number(s.hourly_rate || 0);
      return sum + hours * rate;
    }, 0);

    const { data: commissions } = await supabaseAdmin
      .from("cash_transactions")
      .select("amount")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", memberId)
      .eq("transaction_type", "expense_commission")
      .gte("transaction_date", periodStartIso)
      .lt("transaction_date", periodEndIso);
    const commissionAccrued = (commissions || []).reduce(
      (sum: number, c: any) => sum + (Number(c.amount) > 0 ? Number(c.amount) : 0),
      0,
    );

    const accrued = Math.round(shiftAccrued + commissionAccrued);

    // Already paid out for this period — crew-scoped.
    const { data: payouts } = await supabaseAdmin
      .from("cash_transactions")
      .select("amount")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", memberId)
      .eq("transaction_type", "expense_salary")
      .gte("transaction_date", periodStartIso)
      .lt("transaction_date", periodEndIso);
    const alreadyPaid = (payouts || []).reduce(
      (sum: number, p: any) => sum + (Number(p.amount) > 0 ? Number(p.amount) : 0),
      0,
    );

    const balanceDue = Math.max(0, accrued - alreadyPaid);
    if (balanceDue <= 0) {
      return {
        success: false,
        error: "Баланс к выплате равен нулю — payout уже зарегистрирован.",
      };
    }

    // Insert expense_salary transaction (no salary_calc_id — there's no
    // snapshot row, and the FK is nullable per migration 20260812000009).
    const { data: tx, error: txError } = await supabaseAdmin
      .from("cash_transactions")
      .insert({
        crew_id: access.crewId,
        transaction_type: "expense_salary",
        flow_direction: "out",
        amount: balanceDue,
        payment_method: "cash",
        category: "Зарплата",
        description: `Выплата зарплаты за период ${periodStartIso}`,
        transaction_date: new Date().toISOString(),
        to_user_id: memberId,
        created_by: access.actorUserId, // cookie-derived, not client-supplied
      })
      .select("id")
      .single();

    if (txError || !tx) {
      logger.error("[recordPayoutForPeriod] Failed to create transaction:", txError);
      return { success: false, error: "Не удалось создать транзакцию." };
    }

    logger.info("[recordPayoutForPeriod] Recorded payout", {
      memberId,
      amount: balanceDue,
      transactionId: tx.id,
    });

    return successResponse({ transactionId: tx.id, paidAmount: balanceDue });
  } catch (err) {
    logger.error("[recordPayoutForPeriod] Exception:", err);
    return errorResponse(handleError(err, "recordPayoutForPeriod"));
  }
}

/**
 * Получает сводку заработка текущего пользователя.
 *
 * @param params - Параметры запроса
 * @param params.slug - Slug команды
 * @param params.actorUserId - ID пользователя
 * @returns Текущий план зарплаты и последние комиссии
 *
 * Данные включают:
 * - currentPlan: начисленные суммы, баланс, следующая дата выплаты
 * - recentCommissions: до 10 последних комиссионных транзакций
 */
export async function getMyEarnings(params: {
  slug: string;
  actorUserId: string;
}): Promise<{
  success: boolean;
  data?: {
    currentPlan: { accrued: number; balanceDue: number; nextPayoutDate: string | null };
    recentCommissions: Array<{ amount: number; date: string; description: string }>;
  };
  error?: string;
}> {
  const { slug, actorUserId } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // CR fix H2: use access.actorUserId (from cookie) instead of client-supplied actorUserId.
    // Previously: any crew member could pass another member's user_id to read
    // their salary plan + commission payments (data exposure).
    const secureUserId = access.actorUserId;

    // Get current month plan
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: plan } = await supabaseAdmin
      .from("salary_plans")
      .select("*")
      .eq("crew_id", access.crewId)
      .eq("member_id", secureUserId)
      .eq("period_start", periodStart)
      .maybeSingle();

    // ── Compute current-month accrued DYNAMICALLY ──────────────────────────
    // The `salary_plans.total_accrued` column is only kept in sync by a trigger
    // that fires when `salary_calculations` records are inserted (which is a
    // manual owner action and rarely happens). As a result the profile page
    // was showing "Начислено (месяц) 0 ₽" and "К выплате 0 ₽" even when real
    // shifts existed in `crew_member_shifts` for the current month.
    //
    // We now compute the month-to-date accrued from `crew_member_shifts`
    // (using salary_amount when present, falling back to duration × hourly_rate
    // for active shifts without a stored amount) + recorded commissions
    // (expense_commission) in the same period. This mirrors the logic used by
    // `getMemberEarnings` in `team-earnings.ts`, so the monthly total and the
    // period-total shown in the date picker stay consistent.
    const { data: monthShifts, error: monthShiftErr } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("clock_in_time, clock_out_time, hourly_rate, salary_amount")
      .eq("crew_id", access.crewId)
      .eq("member_id", secureUserId)
      .gte("clock_in_time", periodStart)
      .lt("clock_in_time", periodEnd);
    if (monthShiftErr) {
      logger.warn("[getMyEarnings] Shifts query failed:", monthShiftErr);
    }
    const dynamicShiftAccrued = (monthShifts || []).reduce((sum: number, s: any) => {
      const stored = Number(s.salary_amount || 0);
      if (stored > 0) return sum + stored;
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      if (!start) return sum;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : new Date();
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const rate = Number(s.hourly_rate || 0);
      return sum + hours * rate;
    }, 0);

    // Month-to-date commissions recorded against this member.
    const { data: monthCommissions, error: monthCommErr } = await supabaseAdmin
      .from("cash_transactions")
      .select("amount")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", secureUserId)
      .eq("transaction_type", "expense_commission")
      .gte("transaction_date", periodStart)
      .lt("transaction_date", periodEnd);
    if (monthCommErr) {
      logger.warn("[getMyEarnings] Commissions query failed:", monthCommErr);
    }
    const dynamicCommissionAccrued = (monthCommissions || []).reduce(
      (sum: number, c: any) => sum + (Number(c.amount) > 0 ? Number(c.amount) : 0),
      0,
    );

    // Already-paid-out salary for this plan (so balanceDue excludes it).
    // Sums all `expense_salary` transactions for the member in the plan's
    // period (if a plan exists) — falls back to 0 if no plan.
    let alreadyPaidThisPeriod = 0;
    if (plan) {
      const { data: payouts, error: payoutsErr } = await supabaseAdmin
        .from("cash_transactions")
        .select("amount")
        .eq("crew_id", access.crewId)
        .eq("to_user_id", secureUserId)
        .eq("transaction_type", "expense_salary")
        .gte("transaction_date", periodStart)
        .lt("transaction_date", periodEnd);
      if (payoutsErr) {
        logger.warn("[getMyEarnings] Payouts query failed:", payoutsErr);
      }
      alreadyPaidThisPeriod = (payouts || []).reduce(
        (sum: number, p: any) => sum + (Number(p.amount) > 0 ? Number(p.amount) : 0),
        0,
      );
    }

    const dynamicAccrued = Math.round(dynamicShiftAccrued + dynamicCommissionAccrued);
    // balance_due reflects what the owner still owes for this period: the
    // higher of (dynamicAccrued − already paid, plan.balance_due). We prefer
    // the dynamic calc when it is non-zero (live data); otherwise fall back to
    // whatever the plan recorded.
    const dynamicBalanceDue = Math.max(0, dynamicAccrued - alreadyPaidThisPeriod);
    const planBalanceDue = plan ? Number(plan.balance_due || 0) : 0;
    const balanceDue = dynamicAccrued > 0 ? dynamicBalanceDue : planBalanceDue;

    const currentPlan = {
      accrued: dynamicAccrued > 0
        ? dynamicAccrued
        : (plan ? Number(plan.total_accrued || 0) : 0),
      balanceDue,
      nextPayoutDate: getNextPayoutDate(plan?.payout_schedule || ["10", "25"]),
    };

    // Get recent commissions
    const { data: commissions } = await supabaseAdmin
      .from("cash_transactions")
      .select("amount, description, transaction_date")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", secureUserId)  // CR fix H2: cookie-derived, not client-supplied
      .eq("transaction_type", "expense_commission")
      .order("transaction_date", { ascending: false })
      .limit(10);

    const recentCommissions = (commissions || []).map((c: any) => ({
      amount: Number(c.amount),
      date: c.transaction_date,
      description: c.description,
    }));

    return successResponse({ currentPlan, recentCommissions });
  } catch (err) {
    logger.error("[getMyEarnings] Exception:", err);
    return errorResponse(handleError(err, "getMyEarnings"));
  }
}

function getNextPayoutDate(schedule: string[]): string | null {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  for (const dayStr of [...schedule].sort()) {
    const day = parseInt(dayStr, 10);
    if (day > today) {
      return new Date(currentYear, currentMonth, day).toISOString();
    }
  }

  // Next month
  const firstDay = parseInt(schedule[0], 10);
  return new Date(currentYear, currentMonth + 1, firstDay).toISOString();
}
