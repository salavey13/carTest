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
