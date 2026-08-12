// app/franchize/server-actions/my-work.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { handleError } from "./shared/auth-helpers";

/**
 * I5 — My Work server actions for profile sections.
 * Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 5)
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

export async function getMyWorkTodayAction(params: {
  slug: string;
  userId: string;
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
  const { slug, userId } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // Get today's date in Europe/Moscow timezone
    const now = new Date();
    const moscowDate = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
    const startOfDay = new Date(moscowDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(moscowDate.setHours(23, 59, 59, 999)).toISOString();

    // Get rentals (from crew_member_shifts)
    const { data: shifts, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id, salary_amount")
      .eq("crew_id", access.crewId)
      .eq("member_id", userId)
      .gte("shift_start", startOfDay)
      .lte("shift_start", endOfDay);

    if (shiftError) {
      logger.warn("[getMyWorkTodayAction] Shifts query failed:", shiftError);
    }

    const rentalShifts = shifts || [];
    const rentalsTotal = rentalShifts.reduce((sum: number, s: any) => sum + Number(s.salary_amount || 0), 0);

    // Get sales (from cash_transactions with commission)
    const { data: salesCommissions, error: salesError } = await supabaseAdmin
      .from("cash_transactions")
      .select("id, amount, description")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", userId)
      .eq("transaction_type", "expense_commission")
      .gte("transaction_date", startOfDay)
      .lte("transaction_date", endOfDay)
      .like("description", "%продажа%");

    if (salesError) {
      logger.warn("[getMyWorkTodayAction] Sales commissions query failed:", salesError);
    }

    const salesTotal = (salesCommissions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

    // Get service returns (from cash_transactions with service/return)
    const { data: serviceCommissions, error: serviceError } = await supabaseAdmin
      .from("cash_transactions")
      .select("id, amount, description")
      .eq("crew_id", access.crewId)
      .eq("to_user_id", userId)
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
          total: rentalsTotal,
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