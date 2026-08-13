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

    // Проверка на пересечение периодов (защита от дублирования)
    const { data: overlappingPlans } = await supabaseAdmin
      .from("salary_plans")
      .select("id, period_start, period_end")
      .eq("crew_id", access.crewId)
      .eq("member_id", memberId);

    if (overlappingPlans && overlappingPlans.length > 0) {
      const hasOverlap = overlappingPlans.some(plan =>
        periodsOverlap(plan.period_start, plan.period_end, periodStart, periodEnd)
      );

      if (hasOverlap) {
        logger.warn("[getOrCreateSalaryPlan] Period overlap detected", {
          crewId: access.crewId,
          memberId,
          newPeriod: { start: periodStart, end: periodEnd },
        });
        return { success: false, error: "Период пересекается с существующим планом зарплаты." };
      }
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
 * - Комиссии (expense_commission транзакции)
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
    const cacheKey = `${access.crewId}-${memberId}-${periodStart}-${periodEnd}`;
    const cached = salaryCalcCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      logger.debug("[calculateSalaryForPeriod] Cache hit", { cacheKey });
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

    // Get commission income
    const { data: commissions, error: commError } = await supabaseAdmin
      .from("cash_transactions")
      .select("amount, description, transaction_date")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", memberId)
      .eq("transaction_type", "expense_commission")
      .gte("transaction_date", periodStart)
      .lt("transaction_date", periodEnd);

    if (commError) {
      logger.warn("[calculateSalaryForPeriod] Commissions query failed:", commError);
    }

    const commissionIncome = (commissions || []).reduce((sum: number, c: any) => {
      const amount = Number(c.amount || 0);
      return sum + (amount > 0 ? amount : 0); // Защита от отрицательных значений
    }, 0);

    // Build breakdown
    const breakdown: Array<{ type: string; amount: number; description: string }> = [];
    breakdown.push({ type: "shifts", amount: shiftIncome, description: "Смены" });
    breakdown.push({ type: "commissions", amount: commissionIncome, description: "Комиссии" });

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

    // Get current month plan
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: plan } = await supabaseAdmin
      .from("salary_plans")
      .select("*")
      .eq("crew_id", access.crewId)
      .eq("member_id", actorUserId)
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
      .eq("to_user_id", actorUserId)
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
