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

/**
 * I5 — Salary calculations server actions.
 * Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 3)
 */

// Cache для расчётов зарплаты (24 часа TTL для оптимизации повторных запросов)
const salaryCalcCache = new Map<string, { data: any; expiry: number }>();

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
    const { data: overlappingPlans } = await supabaseAdmin
      .rpc("check_period_overlap", {
        p_crew_id: access.crewId,
        p_member_id: memberId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

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

    // Get shift income
    // Проверяем кеш для расчётов зарплаты (оптимизация повторных запросов)
    // Priority 1 Fix 3: Include calculation method in cache key
    const cacheKey = `${access.crewId}-${memberId}-${periodStart}-${periodEnd}-${useRateCalculation}`;
    const cached = salaryCalcCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      logger.debug("[calculateSalaryForPeriod] Cache hit", { cacheKey, useRateCalculation });
      return successResponse(cached.data);
    }

    const { data: shifts, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("salary_amount, shift_start, bike_id")
      .eq("crew_id", access.crewId)
      .eq("member_id", memberId)
      .gte("shift_start", periodStart)
      .lt("shift_start", periodEnd);

    if (shiftError) {
      logger.warn("[calculateSalaryForPeriod] Shifts query failed:", shiftError);
    }

    const shiftIncome = (shifts || []).reduce((sum: number, s: any) => {
      const amount = Number(s.salary_amount || 0);
      return sum + (amount > 0 ? amount : 0); // Защита от отрицательных значений
    }, 0);

    // Check if crew has commission rates configured (Priority 1 Fix 3)
    const { data: hasRates } = await supabaseAdmin
      .rpc("has_commission_rates", { p_crew_id: access.crewId });

    const useRateCalculation = hasRates === true;

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

      // Get all income transactions for this member to calculate commissions
      const { data: incomeTransactions, error: incomeError } = await supabaseAdmin
        .from("cash_transactions")
        .select("id, amount, transaction_type, flow_direction, description, transaction_date")
        .eq("crew_id", access.crewId)
        .eq("created_by", memberId)
        .in("transaction_type", ["income_rental", "income_sale", "income_equipment"])
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
    } else {
      // Method 2: Use recorded expense_commission transactions (fallback when no rates configured)
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

    // Кэшируем результат на 24 часа
    salaryCalcCache.set(cacheKey, {
      data: result,
      expiry: Date.now() + 24 * 60 * 60 * 1000, // 24 часа
    });

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
        created_by: actorUserId,
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

    const currentPlan = plan
      ? {
          accrued: Number(plan.total_accrued || 0),
          balanceDue: Number(plan.balance_due || 0),
          nextPayoutDate: getNextPayoutDate(plan.payout_schedule),
        }
      : {
          accrued: 0,
          balanceDue: 0,
          nextPayoutDate: getNextPayoutDate(["10", "25"]),
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
