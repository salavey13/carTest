// app/franchize/server-actions/salary-calculations.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/**
 * I5 — Salary calculations server actions.
 * Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 3)
 */

async function verifyCrewAccess(
  slug: string,
): Promise<{ allowed: boolean; crewId?: string; actorUserId?: string; isOwner?: boolean; error?: string }> {
  const { cookies } = await import("next/headers");
  const { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } = await import("@/lib/telegram-actor-cookie");

  const cookieUserId = verifyTelegramActorCookieValue(
    (await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (cookieUserId) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin" || userMetadata?.status === "admin";

    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!crew) {
      return { allowed: false, error: "Экипаж не найден." };
    }

    const isOwner = crew.owner_id === cookieUserId || isAdmin;

    if (isOwner) {
      return { allowed: true, crewId: crew.id, actorUserId: cookieUserId, isOwner: true };
    }

    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", cookieUserId)
      .maybeSingle();

    if (membership?.membership_status === "active") {
      return { allowed: true, crewId: crew.id, actorUserId: cookieUserId, isOwner: false };
    }

    return { allowed: false, error: "Недостаточно прав." };
  }

  return { allowed: false, error: "Не авторизовано." };
}

export async function getOrCreateSalaryPlan(params: {
  slug: string;
  actorUserId: string;
  memberId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  const { slug, actorUserId, memberId, periodStart, periodEnd } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed || !access.isOwner) {
      return { success: false, error: access.error || "Только владелец." };
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

    return { success: true, data: { id: plan.id } };
  } catch (err: any) {
    logger.error("[getOrCreateSalaryPlan] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

export async function calculateSalaryForPeriod(params: {
  slug: string;
  actorUserId: string;
  memberId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{
  success: boolean;
  data?: {
    shiftIncome: number;
    commissionIncome: number;
    bonusIncome: number;
    totalIncome: number;
    breakdown: Array<{ type: string; amount: number; description: string }>;
  };
  error?: string;
}> {
  const { slug, actorUserId, memberId, periodStart, periodEnd } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // Get shift income
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

    const shiftIncome = (shifts || []).reduce((sum: number, s: any) => sum + Number(s.salary_amount || 0), 0);

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

    const commissionIncome = (commissions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

    // Build breakdown
    const breakdown: Array<{ type: string; amount: number; description: string }> = [];
    breakdown.push({ type: "shifts", amount: shiftIncome, description: "Смены" });
    breakdown.push({ type: "commissions", amount: commissionIncome, description: "Комиссии" });

    const totalIncome = shiftIncome + commissionIncome;

    return {
      success: true,
      data: {
        shiftIncome,
        commissionIncome,
        bonusIncome: 0,
        totalIncome,
        breakdown,
      },
    };
  } catch (err: any) {
    logger.error("[calculateSalaryForPeriod] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

export async function recordPayout(params: {
  slug: string;
  actorUserId: string;
  salaryCalcId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { slug, actorUserId, salaryCalcId } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed || !access.isOwner) {
      return { success: false, error: access.error || "Только владелец." };
    }

    // Get salary calculation details
    const { data: calc, error: calcError } = await supabaseAdmin
      .from("salary_calculations")
      .select("*")
      .eq("id", salaryCalcId)
      .maybeSingle();

    if (calcError || !calc) {
      return { success: false, error: "Расчёт не найден." };
    }

    // Get salary plan to find member_id
    const { data: plan } = await supabaseAdmin
      .from("salary_plans")
      .select("member_id, crew_id")
      .eq("id", calc.salary_plan_id)
      .single();

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

    return { success: true };
  } catch (err: any) {
    logger.error("[recordPayout] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

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

    return {
      success: true,
      data: { currentPlan, recentCommissions },
    };
  } catch (err: any) {
    logger.error("[getMyEarnings] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

function getNextPayoutDate(schedule: string[]): string | null {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  for (const dayStr of schedule.sort()) {
    const day = parseInt(dayStr, 10);
    if (day > today) {
      return new Date(currentYear, currentMonth, day).toISOString();
    }
  }

  // Next month
  const firstDay = parseInt(schedule[0], 10);
  return new Date(currentYear, currentMonth + 1, firstDay).toISOString();
}
