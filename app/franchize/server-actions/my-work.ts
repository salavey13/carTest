// app/franchize/server-actions/my-work.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  verifyCrewAccess,
  handleError,
} from "./shared/auth-helpers";

/**
 * I5 — My Work server actions for profile sections.
 * Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 5)
 *
 * 2026-08-19 code review fixes:
 *  - Drop the local copy of `verifyCrewAccess` — use the shared helper from
 *    `./shared/auth-helpers` so `co_owner` / `admin` roles get owner-tier
 *    treatment consistent with every other salary-subsystem action.
 *  - Use `access.actorUserId` (cookie-derived) instead of the client-supplied
 *    `userId` param to prevent IDOR (any member could previously pass another
 *    member's user_id to read their daily work totals).
 *  - Query `crew_member_shifts` by the actual columns (`clock_in_time`,
 *    `clock_out_time`, `hourly_rate`) — `shift_start` did not exist and the
 *    query was silently failing, making `rentalsTotal` always 0.
 *  - Compute salary for active shifts on the fly (duration × hourly_rate) so
 *    an in-progress shift shows up in the "today's rentals" total instead of
 *    zero (mirrors the fix already applied in `salary-calculations.ts`).
 *  - Use UTC end-of-day literal (`<date>T23:59:59.999Z`) instead of
 *    `setHours(23, 59, 59, 999)` which used the server's local timezone.
 */

export async function getMyWorkTodayAction(params: {
  slug: string;
  userId: string; // Deprecated: kept for backward compat. Cookie-derived
                  // identity is used instead; this param is ignored.
}): Promise<{
  success: boolean;
  data?: {
    date: string;
    rentals: { count: number; total: number };
    sales: { count: number; total: number };
    serviceReturns: { count: number; total: number };
  };
  error?: string;
}> {
  const { slug } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // CR fix: ignore client-supplied `userId` — use cookie-derived identity
    // so non-owners cannot query another member's daily work totals.
    const secureUserId = access.actorUserId;
    if (!secureUserId) {
      return { success: false, error: "Не авторизовано." };
    }

    // Today's date in Europe/Moscow timezone (server runs UTC).
    // We compute the day boundary in Moscow and then convert to UTC ISO
    // strings so the Supabase query (which compares against UTC timestamptz)
    // matches what the user considers "today".
    const now = new Date();
    const moscowOffsetMs = 3 * 60 * 60 * 1000; // UTC+3
    const moscowNow = new Date(now.getTime() + moscowOffsetMs);
    const y = moscowNow.getUTCFullYear();
    const m = moscowNow.getUTCMonth();
    const d = moscowNow.getUTCDate();
    const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(y, m, d, 23, 59, 59, 999)).toISOString();

    // Get shifts for today (from crew_member_shifts) — using correct columns.
    const { data: shifts, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id, clock_in_time, clock_out_time, hourly_rate, salary_amount")
      .eq("crew_id", access.crewId)
      .eq("member_id", secureUserId)
      .gte("clock_in_time", startOfDay)
      .lte("clock_in_time", endOfDay);

    if (shiftError) {
      logger.warn("[getMyWorkTodayAction] Shifts query failed:", shiftError);
    }

    const rentalShifts = shifts || [];
    // Prefer stored salary_amount (already rounded for completed shifts).
    // For active shifts where salary_amount is null, compute on the fly
    // from duration × hourly_rate so an in-progress shift is reflected
    // in today's rentals total.
    const rentalsTotal = rentalShifts.reduce((sum: number, s: any) => {
      const stored = Number(s.salary_amount || 0);
      if (stored > 0) return sum + stored;
      const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
      if (!start) return sum;
      const end = s.clock_out_time ? new Date(s.clock_out_time) : new Date();
      const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const rate = Number(s.hourly_rate || 0);
      return sum + hours * rate;
    }, 0);

    // Get sales (from cash_transactions with commission + 'продажа' keyword)
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
      logger.warn("[getMyWorkTodayAction] Sales commissions query failed:", salesError);
    }

    const salesTotal = (salesCommissions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

    // Get service returns (from cash_transactions with service/return keyword)
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
      logger.warn("[getMyWorkTodayAction] Service commissions query failed:", serviceError);
    }

    const serviceTotal = (serviceCommissions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

    return {
      success: true,
      data: {
        date: startOfDay.split('T')[0],
        rentals: {
          count: rentalShifts.length,
          total: Math.round(rentalsTotal),
        },
        sales: {
          count: salesCommissions?.length || 0,
          total: salesTotal,
        },
        serviceReturns: {
          count: serviceCommissions?.length || 0,
          total: serviceTotal,
        },
      },
    };
  } catch (err) {
    logger.error("[getMyWorkTodayAction] Exception:", err);
    return { success: false, error: handleError(err, "getMyWorkTodayAction") };
  }
}
