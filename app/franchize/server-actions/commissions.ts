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

/**
 * Получает все активные ставки комиссии команды.
 *
 * @param params - Параметры запроса
 * @param params.slug - Slug команды
 * @param params.actorUserId - ID пользователя
 * @returns Массив ставок комиссии, отсортированных по приоритету
 *
 * Ставки включают:
 * - operationType: тип операции (например, 'rental', 'sale')
 * - commissionType: тип комиссии ('percentage' или 'fixed_amount')
 * - commissionValue: значение процента или фиксированной суммы
 * - priority: приоритет применения (выше = применяется первым)
 */
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

/**
 * Создаёт или обновляет ставку комиссии.
 *
 * @param params - Параметры для создания/обновления ставки
 * @param params.slug - Slug команды
 * @param params.actorUserId - ID пользователя
 * @param params.operationType - Тип операции (например, 'rental', 'sale')
 * @param params.commissionType - Тип комиссии ('percentage' или 'fixed_amount')
 * @param params.commissionValue - Значение (процент или фиксированная сумма)
 * @param params.priority - Приоритет (по умолчанию 0)
 * @returns Объект с success и id созданной/обновлённой ставки
 *
 * Валидация:
 * - Для percentage: значение должно быть > 0 и <= 100
 * - Для fixed_amount: значение должно быть > 0
 * - Только владелец может настраивать комиссии
 */
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

    // Priority 2 Fix 4: Validation is now handled by database trigger trg_validate_commission_rate
    // Client-side validation removed to avoid duplication - database provides authoritative validation
    // Trigger checks: percentage ≤ 100, no negatives, warns on large fixed amounts (>1M RUB)
    // Any constraint violation will return proper error from database

    // Валидация operationType
    if (!operationType || operationType.trim() === "") {
      return { success: false, error: "Тип операции обязателен для создания комиссии." };
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
