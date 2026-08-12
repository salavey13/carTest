// app/franchize/server-actions/commissions.ts
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
 * I5 — Commission rates server actions.
 * Plan: docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 2)
 */

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
}): Promise<ActionResponse<CommissionRate[]>> {
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

    return successResponse(formatted);
  } catch (err) {
    logger.error("[getCommissionRates] Exception:", err);
    return errorResponse(handleError(err, "getCommissionRates"));
  }
}

export async function upsertCommissionRate(params: {
  slug: string;
  actorUserId: string;
  operationType: string;
  commissionType: "percentage" | "fixed_amount";
  commissionValue: number;
  priority?: number;
}): Promise<ActionResponse<{ id: string }>> {
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

    return successResponse({ id: rate.id });
  } catch (err) {
    logger.error("[upsertCommissionRate] Exception:", err);
    return errorResponse(handleError(err, "upsertCommissionRate"));
  }
}

export async function deactivateCommissionRate(params: {
  slug: string;
  actorUserId: string;
  id: string;
}): Promise<ActionResponse> {
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

    return successResponse();
  } catch (err) {
    logger.error("[deactivateCommissionRate] Exception:", err);
    return errorResponse(handleError(err, "deactivateCommissionRate"));
  }
}
