// app/franchize/server-actions/commissions.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/**
 * I5 — Commission rates server actions.
 * Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 2)
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

export interface CommissionRate {
  id: string;
  crewId: string;
  operationType: string;
  commissionType: string;
  commissionValue: number;
  priority: number;
  isActive: boolean;
}

export async function getCommissionRates(params: {
  slug: string;
  actorUserId: string;
}): Promise<{ success: boolean; data?: CommissionRate[]; error?: string }> {
  const { slug, actorUserId } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const { data: rates, error } = await supabaseAdmin
      .from("commission_rates")
      .select("*")
      .eq("crew_id", access.crewId)
      .order("priority", { ascending: false });

    if (error) {
      logger.error("[getCommissionRates] Query failed:", error);
      return { success: false, error: "Не удалось загрузить ставки." };
    }

    const formatted = (rates || []).map((r: any) => ({
      id: r.id,
      crewId: r.crew_id,
      operationType: r.operation_type,
      commissionType: r.commission_type,
      commissionValue: Number(r.commission_value),
      priority: r.priority,
      isActive: r.is_active,
    }));

    return { success: true, data: formatted };
  } catch (err: any) {
    logger.error("[getCommissionRates] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

export async function upsertCommissionRate(params: {
  slug: string;
  actorUserId: string;
  operationType: string;
  commissionType: "percentage" | "fixed_amount";
  commissionValue: number;
  priority?: number;
}): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  const { slug, actorUserId, operationType, commissionType, commissionValue, priority = 0 } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    if (!access.isOwner) {
      return { success: false, error: "Только владелец может настраивать комиссии." };
    }

    // Validate percentage <= 100
    if (commissionType === "percentage" && commissionValue > 100) {
      return { success: false, error: "Процент не может превышать 100%." };
    }

    // Upsert: insert or update on conflict
    const { data: rate, error } = await supabaseAdmin
      .from("commission_rates")
      .upsert(
        {
          crew_id: access.crewId,
          operation_type: operationType,
          commission_type: commissionType,
          commission_value: commissionValue,
          priority,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "crew_id,operation_type,priority",
        }
      )
      .select("id")
      .single();

    if (error || !rate) {
      logger.error("[upsertCommissionRate] Upsert failed:", error);
      return { success: false, error: "Не удалось сохранить ставку." };
    }

    logger.info("[upsertCommissionRate] Upserted commission rate", {
      id: rate.id,
      crewId: access.crewId,
      operationType,
    });

    return { success: true, data: { id: rate.id } };
  } catch (err: any) {
    logger.error("[upsertCommissionRate] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

export async function deactivateCommissionRate(params: {
  slug: string;
  actorUserId: string;
  id: string;
}): Promise<{ success: boolean; error?: string }> {
  const { slug, actorUserId, id } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    if (!access.isOwner) {
      return { success: false, error: "Только владелец может управлять ставками." };
    }

    const { error } = await supabaseAdmin
      .from("commission_rates")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("crew_id", access.crewId);

    if (error) {
      logger.error("[deactivateCommissionRate] Update failed:", error);
      return { success: false, error: "Не удалось деактивировать ставку." };
    }

    logger.info("[deactivateCommissionRate] Deactivated commission rate", { id });

    return { success: true };
  } catch (err: any) {
    logger.error("[deactivateCommissionRate] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}
