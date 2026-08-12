// app/franchize/server-actions/cash-transactions.ts
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
 * I5 — Cash ledger server actions.
 * Plan: docs/superpowers/plans/2026-08-12-i5-cash-ledger.md (Task 4)
 */

export interface CashTransaction {
  id: string;
  crewId: string;
  rentalId?: string;
  saleContractId?: string;
  equipmentRentalId?: string;
  salaryCalcId?: string;
  transactionType: string;
  flowDirection: string;
  amount: number;
  paymentMethod?: string;
  fromUserId?: string;
  toUserId?: string;
  category?: string;
  description?: string;
  transactionDate: string;
  createdBy?: string;
}

/**
 * Получает транзакции кассы с фильтрацией и подсчётом итогов.
 *
 * @param params - Параметры для получения транзакций
 * @param params.slug - Slug команды
 * @param params.actorUserId - ID пользователя
 * @param params.from - Начало периода (ISO string)
 * @param params.to - Конец периода (ISO string)
 * @param params.transactionType - Фильтр по типу транзакции
 * @returns Транзакции и сводка (входящие, исходящие, чистый поток)
 *
 * Возвращает:
 * - data: массив транзакций
 * - summary: итоги по incoming/outgoing/net потокам
 */
export async function getCashTransactions(params: {
  slug: string;
  actorUserId: string;
  from?: string;
  to?: string;
  transactionType?: string;
}): Promise<{
  success: boolean;
  data?: CashTransaction[];
  summary?: { totalIn: number; totalOut: number; net: number };
  error?: string;
}> {
  const { slug, actorUserId, from, to, transactionType } = params;

  // Валидация формата дат
  if (from && isNaN(new Date(from).getTime())) {
    return { success: false, error: "Некорректный формат даты начала." };
  }
  if (to && isNaN(new Date(to).getTime())) {
    return { success: false, error: "Некорректный формат даты окончания." };
  }
  if (from && to && new Date(from) > new Date(to)) {
    return { success: false, error: "Дата начала должна быть раньше даты окончания." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    let query = supabaseAdmin
      .from("cash_transactions")
      .select("*")
      .eq("crew_id", access.crewId);

    if (from) {
      query = query.gte("transaction_date", from);
    }
    if (to) {
      query = query.lte("transaction_date", to);
    }
    if (transactionType) {
      query = query.eq("transaction_type", transactionType);
    }

    query = query.order("transaction_date", { ascending: false });

    const { data: transactions, error } = await query;

    if (error) {
      logger.error("[getCashTransactions] Query failed:", error);
      return { success: false, error: "Не удалось загрузить транзакции." };
    }

    const formatted = (transactions || []).map((t: any) => {
      const amount = Number(t.amount || 0);
      return {
        id: t.id,
        crewId: t.crew_id,
        rentalId: t.rental_id,
        saleContractId: t.sale_contract_id,
        equipmentRentalId: t.equipment_rental_id,
        salaryCalcId: t.salary_calc_id,
        transactionType: t.transaction_type,
        flowDirection: t.flow_direction,
        amount: amount > 0 ? amount : 0, // Защита от отрицательных сумм
        paymentMethod: t.payment_method,
        fromUserId: t.from_user_id,
        toUserId: t.to_user_id,
        category: t.category,
        description: t.description,
        transactionDate: t.transaction_date,
        createdBy: t.created_by,
      };
    });

    // Calculate summary
    const totalIn = formatted
      .filter((t) => t.flowDirection === "in")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalOut = formatted
      .filter((t) => t.flowDirection === "out")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      success: true,
      data: formatted,
      summary: {
        totalIn,
        totalOut,
        net: totalIn - totalOut,
      },
    };
  } catch (err) {
    logger.error("[getCashTransactions] Exception:", err);
    return errorResponse(handleError(err, "getCashTransactions"));
  }
}

/**
 * Создаёт ручную транзакцию кассы.
 *
 * @param params - Параметры для создания транзакции
 * @param params.slug - Slug команды
 * @param params.actorUserId - ID пользователя
 * @param params.transactionType - Тип транзакции (например, 'income_other', 'expense_other')
 * @param params.amount - Сумма (должна быть > 0)
 * @param params.paymentMethod - Способ оплаты (по умолчанию 'cash')
 * @param params.category - Категория для отчётности
 * @param params.description - Описание транзакции
 * @returns Объект с success и id созданной транзакции
 *
 * Валидация:
 * - Сумма должна быть положительной
 * - Только владелец или администратор может создавать записи
 * - flow_direction определяется автоматически из префикса transaction_type
 */
export async function createManualCashTransaction(params: {
  slug: string;
  actorUserId: string;
  transactionType: string;
  amount: number;
  paymentMethod?: string;
  category?: string;
  description?: string;
}): Promise<ActionResponse<{ id: string }>> {
  const { slug, actorUserId, transactionType, amount, paymentMethod, category, description } = params;

  // Валидация суммы
  if (amount <= 0) {
    return { success: false, error: "Сумма должна быть больше нуля." };
  }

  // Валидация типа транзакции
  if (!transactionType || transactionType.trim() === "") {
    return { success: false, error: "Тип транзакции обязателен." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // Only owner/admin can create manual transactions
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin" || userMetadata?.status === "admin";

    if (!isAdmin) {
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("owner_id")
        .eq("id", access.crewId)
        .maybeSingle();

      if (crew?.owner_id !== actorUserId) {
        return { success: false, error: "Только владелец может создавать записи." };
      }
    }

    // Determine flow_direction from transaction_type prefix
    const flowDirection = transactionType.startsWith("income_") ? "in" : "out";

    const { data: transaction, error } = await supabaseAdmin
      .from("cash_transactions")
      .insert({
        crew_id: access.crewId,
        transaction_type: transactionType,
        flow_direction: flowDirection,
        amount,
        payment_method: paymentMethod || "cash",
        category: category || "Прочее",
        description: description || "Ручная запись",
        transaction_date: new Date().toISOString(),
        created_by: actorUserId,
      })
      .select("id")
      .single();

    if (error || !transaction) {
      logger.error("[createManualCashTransaction] Insert failed:", error);
      return { success: false, error: "Не удалось создать запись." };
    }

    logger.info("[createManualCashTransaction] Created manual transaction", {
      id: transaction.id,
      crewId: access.crewId,
      amount,
    });

    return successResponse({ id: transaction.id });
  } catch (err) {
    logger.error("[createManualCashTransaction] Exception:", err);
    return errorResponse(handleError(err, "createManualCashTransaction"));
  }
}

/**
 * Получает ежедневный отчёт по кассе.
 *
 * @param params - Параметры для ежедневного отчёта
 * @param params.slug - Slug команды
 * @param params.actorUserId - ID пользователя
 * @param params.date - Дата для отчёта (ISO string)
 * @returns Сводка за день и детальные транзакции
 *
 * Возвращает:
 * - totalIn: входящий поток за день
 * - totalOut: исходящий поток за день
 * - net: чистое изменение
 * - transactions: все транзакции за день
 */
export async function getDailyCashReport(params: {
  slug: string;
  actorUserId: string;
  date: string;
}): Promise<ActionResponse<{
  date: string;
  totalIn: number;
  totalOut: number;
  net: number;
  transactions: CashTransaction[];
}>> {
  const { slug, actorUserId, date } = params;

  // Валидация формата даты
  if (!date || isNaN(new Date(date).getTime())) {
    return { success: false, error: "Некорректный формат даты. Используйте формат ISO (YYYY-MM-DD)." };
  }

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    // Get daily summary from view
    const { data: summary, error: summaryError } = await supabaseAdmin
      .from("daily_cash_flow")
      .select("*")
      .eq("crew_id", access.crewId)
      .eq("date", date)
      .maybeSingle();

    if (summaryError) {
      logger.warn("[getDailyCashReport] View query failed:", summaryError);
    }

    // Get detailed transactions for the day
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: transactions, error: txError } = await supabaseAdmin
      .from("cash_transactions")
      .select("*")
      .eq("crew_id", access.crewId)
      .gte("transaction_date", startOfDay.toISOString())
      .lte("transaction_date", endOfDay.toISOString())
      .order("transaction_date", { ascending: false });

    if (txError) {
      logger.error("[getDailyCashReport] Transactions query failed:", txError);
      return { success: false, error: "Не удалось загрузить отчёт." };
    }

    const formatted = (transactions || []).map((t: any) => {
      const amount = Number(t.amount || 0);
      return {
        id: t.id,
        crewId: t.crew_id,
        rentalId: t.rental_id,
        saleContractId: t.sale_contract_id,
        equipmentRentalId: t.equipment_rental_id,
        salaryCalcId: t.salary_calc_id,
        transactionType: t.transaction_type,
        flowDirection: t.flow_direction,
        amount: amount > 0 ? amount : 0, // Защита от отрицательных сумм
        paymentMethod: t.payment_method,
        fromUserId: t.from_user_id,
        toUserId: t.to_user_id,
        category: t.category,
        description: t.description,
        transactionDate: t.transaction_date,
        createdBy: t.created_by,
      };
    });

    const totalIn = formatted
      .filter((t) => t.flowDirection === "in")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalOut = formatted
      .filter((t) => t.flowDirection === "out")
      .reduce((sum, t) => sum + t.amount, 0);

    return successResponse({
      date,
      totalIn: summary?.total_in ? Number(summary.total_in) : totalIn,
      totalOut: summary?.total_out ? Number(summary.total_out) : totalOut,
      net: summary?.net_flow ? Number(summary.net_flow) : totalIn - totalOut,
      transactions: formatted,
    });
  } catch (err) {
    logger.error("[getDailyCashReport] Exception:", err);
    return errorResponse(handleError(err, "getDailyCashReport"));
  }
}
