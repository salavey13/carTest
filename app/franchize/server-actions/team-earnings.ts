// app/franchize/server-actions/team-earnings.ts
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
 * Get team members' earnings for a period.
 * Used by owner to see all employees' salaries in one place.
 */
export async function getTeamEarnings(params: {
  slug: string;
  actorUserId?: string;
  from: string;
  to: string;
}): Promise<ActionResponse<Array<{
  memberId: string;
  memberName: string;
  shifts: number;
  shiftIncome: number;
  commissionIncome: number;
  total: number;
}>>> {
  const { slug, from, to } = params;

  // Validate dates
  if (!from || isNaN(new Date(from).getTime())) {
    return { success: false, error: "Некорректная дата начала." };
  }
  if (!to || isNaN(new Date(to).getTime())) {
    return { success: false, error: "Некорректная дата окончания." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    if (!access.isOwner) {
      return { success: false, error: "Только владелец может видеть зарплаты команды." };
    }

    const crewId = access.crewId;
    const fromDate = new Date(from).toISOString();
    const toDate = new Date(to);

    // Set to end of day
    toDate.setHours(23, 59, 59, 999);
    const toDateIso = toDate.toISOString();

    // Get all crew members
    const { data: members, error: membersError } = await supabaseAdmin
      .from("crew_members")
      .select(`
        user_id,
        users (
          metadata
        )
      `)
      .eq("crew_id", crewId)
      .eq("membership_status", "active");

    if (membersError) {
      logger.error("[getTeamEarnings] Failed to load members:", membersError);
      return { success: false, error: "Не удалось загрузить сотрудников." };
    }

    // For each member, calculate earnings
    const earnings = await Promise.all(
      (members || []).map(async (member: any) => {
        const memberId = member.user_id;
        const metadata = member.users?.metadata || {};
        const memberName = metadata?.name || metadata?.username || `Member ${memberId.slice(0, 6)}`;

        // Get shifts for period
        const { data: shifts } = await supabaseAdmin
          .from("crew_member_shifts")
          .select("clock_in_time, clock_out_time, hourly_rate")
          .eq("member_id", memberId)
          .gte("clock_in_time", fromDate)
          .lte("clock_in_time", toDateIso);

        // Calculate shift income
        let shiftHours = 0;
        let shiftIncome = 0;

        (shifts || []).forEach((shift: any) => {
          const start = new Date(shift.clock_in_time);
          const end = shift.clock_out_time ? new Date(shift.clock_out_time) : new Date();
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          shiftHours += hours;
          shiftIncome += hours * (shift.hourly_rate || 169);
        });

        // Get commissions for period (expense_commission: money flowing OUT to employees)
        const { data: commissions } = await supabaseAdmin
          .from("cash_transactions")
          .select("amount")
          .eq("to_user_id", memberId)
          .eq("transaction_type", "expense_commission")
          .gte("transaction_date", fromDate)
          .lte("transaction_date", toDateIso);

        const commissionIncome = (commissions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

        return {
          memberId,
          memberName,
          shifts: Math.round(shiftHours * 10) / 10,
          shiftIncome: Math.round(shiftIncome),
          commissionIncome: Math.round(commissionIncome),
          total: Math.round(shiftIncome + commissionIncome),
        };
      })
    );

    return successResponse(earnings);
  } catch (err) {
    logger.error("[getTeamEarnings] Exception:", err);
    return errorResponse(handleError(err, "getTeamEarnings"));
  }
}

/**
 * Get member's own earnings for a period.
 * Used by profile page to show earnings with date range.
 */
export async function getMemberEarnings(params: {
  slug: string;
  actorUserId?: string;
  memberId?: string; // If not provided, use actorUserId
  from: string;
  to: string;
}): Promise<ActionResponse<{
  shifts: number;
  shiftIncome: number;
  commissionIncome: number;
  total: number;
  breakdown: Array<{ date: string; description: string; amount: number }>;
}>> {
  const { slug, from, to, memberId } = params;

  // Validate dates
  if (!from || isNaN(new Date(from).getTime())) {
    return { success: false, error: "Некорректная дата начала." };
  }
  if (!to || isNaN(new Date(to).getTime())) {
    return { success: false, error: "Некорректная дата окончания." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const targetMemberId = memberId || access.actorUserId;

    // For non-owners, only allow querying their own earnings
    if (!access.isOwner && targetMemberId !== access.actorUserId) {
      return { success: false, error: "Недостаточно прав для просмотра чужих доходов." };
    }
    const crewId = access.crewId;
    const fromDate = new Date(from).toISOString();
    const toDate = new Date(to);

    // Set to end of day
    toDate.setHours(23, 59, 59, 999);
    const toDateIso = toDate.toISOString();

    // Verify the member belongs to this crew
    const { data: memberCheck } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crewId)
      .eq("user_id", targetMemberId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: "Сотрудник не найден в этом экипаже." };
    }

    // Get shifts for period
    const { data: shifts } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("clock_in_time, clock_out_time, hourly_rate")
      .eq("member_id", targetMemberId)
      .gte("clock_in_time", fromDate)
      .lte("clock_in_time", toDateIso)
      .order("clock_in_time", { ascending: false });

    // Calculate shift income and build breakdown
    let shiftHours = 0;
    let shiftIncome = 0;
    const breakdown: Array<{ date: string; description: string; amount: number }> = [];

    (shifts || []).forEach((shift: any) => {
      const start = new Date(shift.clock_in_time);
      const end = shift.clock_out_time ? new Date(shift.clock_out_time) : new Date();
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      shiftHours += hours;
      const amount = hours * (shift.hourly_rate || 169);
      shiftIncome += amount;

      breakdown.push({
        date: shift.clock_in_time,
        description: `Смена (${Math.round(hours * 10) / 10}ч)`,
        amount: Math.round(amount),
      });
    });

    // Get commissions for period (expense_commission: money flowing OUT to employees)
    const { data: commissions } = await supabaseAdmin
      .from("cash_transactions")
      .select("amount, transaction_date, description")
      .eq("to_user_id", targetMemberId)
      .eq("transaction_type", "expense_commission")
      .gte("transaction_date", fromDate)
      .lte("transaction_date", toDateIso)
      .order("transaction_date", { ascending: false });

    const commissionIncome = (commissions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

    // Add commission breakdown
    (commissions || []).forEach((c: any) => {
      breakdown.push({
        date: c.transaction_date,
        description: c.description || "Комиссия",
        amount: Number(c.amount || 0),
      });
    });

    // Sort breakdown by date (newest first)
    breakdown.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return successResponse({
      shifts: Math.round(shiftHours * 10) / 10,
      shiftIncome: Math.round(shiftIncome),
      commissionIncome: Math.round(commissionIncome),
      total: Math.round(shiftIncome + commissionIncome),
      breakdown: breakdown.map((b) => ({
        ...b,
        amount: Math.round(b.amount),
      })),
    });
  } catch (err) {
    logger.error("[getMemberEarnings] Exception:", err);
    return errorResponse(handleError(err, "getMemberEarnings"));
  }
}

/**
 * Get the owner-facing salary overview for a period — same data shape the
 * salary page table renders, computed dynamically (NOT from
 * salary_calculations which is empty for this crew). For each member we
 * also fetch their already-paid-out amount so we can show balanceDue.
 *
 * Auth: owner / co_owner / admin only (per shared verifyCrewAccess).
 *
 * This action was added in the 2026-08-19 review to remove the broken
 * `supabaseAdmin` import from SalaryClient.tsx ("use client" file that
 * can't import the server-only module at runtime) and to compute the
 * table from live data instead of the never-populated salary_calculations
 * snapshot table.
 */
export async function getOwnerSalaryOverview(params: {
  slug: string;
  actorUserId?: string; // Deprecated: unused, derived from cookie
  from: string;
  to: string;
}): Promise<ActionResponse<Array<{
  memberId: string;
  memberName: string;
  role: string;
  periodStart: string;
  periodEnd: string;
  accrued: number;
  paid: number;
  balanceDue: number;
  status: "pending" | "partial" | "paid";
}>>> {
  const { slug, from, to } = params;

  // Validate dates
  if (!from || isNaN(new Date(from).getTime())) {
    return { success: false, error: "Некорректная дата начала." };
  }
  if (!to || isNaN(new Date(to).getTime())) {
    return { success: false, error: "Некорректная дата окончания." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }
    if (!access.isOwner) {
      return { success: false, error: "Только владелец, со-владелец или администратор может видеть зарплаты команды." };
    }

    const crewId = access.crewId;
    const fromDate = new Date(from).toISOString();
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const toDateIso = toDate.toISOString();

    // Get all active crew members (with role for display)
    const { data: members, error: membersError } = await supabaseAdmin
      .from("crew_members")
      .select(`
        user_id,
        role,
        users (
          metadata
        )
      `)
      .eq("crew_id", crewId)
      .eq("membership_status", "active");

    if (membersError) {
      logger.error("[getOwnerSalaryOverview] Failed to load members:", membersError);
      return { success: false, error: "Не удалось загрузить сотрудников." };
    }

    const periodStartIso = fromDate;
    const periodEndIso = toDateIso;

    // For each member: compute shifts + commissions in parallel, then fetch
    // their already-paid-out amount (cash_transactions.expense_salary) for
    // the same period.
    const overview = await Promise.all(
      (members || []).map(async (member: any) => {
        const memberId = member.user_id;
        const metadata = member.users?.metadata || {};
        const memberName = metadata?.name || metadata?.username || `Member ${memberId.slice(0, 6)}`;
        const role = member.role || "member";

        // Shifts for period — same logic as getMemberEarnings / my-work
        const { data: shifts } = await supabaseAdmin
          .from("crew_member_shifts")
          .select("clock_in_time, clock_out_time, hourly_rate, salary_amount")
          .eq("member_id", memberId)
          .gte("clock_in_time", periodStartIso)
          .lte("clock_in_time", periodEndIso);

        let shiftIncome = 0;
        (shifts || []).forEach((shift: any) => {
          const stored = Number(shift.salary_amount || 0);
          if (stored > 0) {
            shiftIncome += stored;
            return;
          }
          const start = shift.clock_in_time ? new Date(shift.clock_in_time) : null;
          if (!start) return;
          const end = shift.clock_out_time ? new Date(shift.clock_out_time) : new Date();
          const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
          const rate = Number(shift.hourly_rate || 0);
          shiftIncome += hours * rate;
        });

        // Commissions for period (expense_commission to this member)
        const { data: commissions } = await supabaseAdmin
          .from("cash_transactions")
          .select("amount")
          .eq("to_user_id", memberId)
          .eq("transaction_type", "expense_commission")
          .gte("transaction_date", periodStartIso)
          .lte("transaction_date", periodEndIso);
        const commissionIncome = (commissions || []).reduce(
          (sum: number, c: any) => sum + (Number(c.amount) > 0 ? Number(c.amount) : 0),
          0,
        );

        // Already-paid-out salary in same period
        const { data: payouts } = await supabaseAdmin
          .from("cash_transactions")
          .select("amount")
          .eq("to_user_id", memberId)
          .eq("transaction_type", "expense_salary")
          .gte("transaction_date", periodStartIso)
          .lte("transaction_date", periodEndIso);
        const paid = (payouts || []).reduce(
          (sum: number, p: any) => sum + (Number(p.amount) > 0 ? Number(p.amount) : 0),
          0,
        );

        const accrued = Math.round(shiftIncome + commissionIncome);
        const balanceDue = Math.max(0, accrued - paid);
        const status: "pending" | "partial" | "paid" =
          balanceDue <= 0 ? "paid" : paid > 0 ? "partial" : "pending";

        return {
          memberId,
          memberName,
          role,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          accrued,
          paid,
          balanceDue,
          status,
        };
      }),
    );

    return successResponse(overview);
  } catch (err) {
    logger.error("[getOwnerSalaryOverview] Exception:", err);
    return errorResponse(handleError(err, "getOwnerSalaryOverview"));
  }
}
