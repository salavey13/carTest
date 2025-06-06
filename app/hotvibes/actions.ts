"use server";

import { supabaseAdmin } from '@/hooks/supabase'; // Используем существующий supabaseAdmin
import { sendTelegramInvoice as tgSendInvoice } from '@/app/actions'; // Оригинальная функция для отправки инвойса
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

type User = Database["public"]["Tables"]["users"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

export interface ProtoCardDetails {
  cardId: string; 
  title: string;
  description: string;
  amountXTR: number;
  type: string; // e.g., "simulation_access", "mission_support"
  metadata?: Record<string, any>; // e.g., { page_link: "/elon" } or { associated_lead_id: "..." }
}

/**
 * Инициирует покупку "ПротоКарточки": записывает инвойс в БД и отправляет его пользователю в Telegram.
 */
export async function sendAndRecordProtoCardInvoice(
  userId: string,
  cardDetails: ProtoCardDetails
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  if (!userId || !cardDetails || !cardDetails.cardId || !cardDetails.title || cardDetails.amountXTR <= 0) {
    logger.error("[HotVibesActions] Invalid parameters for sendAndRecordProtoCardInvoice", { userId, cardDetails });
    return { success: false, error: "Неверные параметры для создания счета ПротоКарточки." };
  }

  const invoicePayload = `protocard_${cardDetails.type}_${cardDetails.cardId}_${userId}_${Date.now()}`;
  const invoiceTypeForDb = `protocard_${cardDetails.type}`;

  logger.info(`[HotVibesActions] Preparing to create ProtoCard invoice. UserID: ${userId}, CardID: ${cardDetails.cardId}, Amount: ${cardDetails.amountXTR} XTR, TypeInDB: ${invoiceTypeForDb}, Payload: ${invoicePayload}`);

  try {
    // Шаг 1: Запись Инвойса в БД
    const dbInvoiceData: Database["public"]["Tables"]["invoices"]["Insert"] = {
        id: invoicePayload,
        user_id: userId,
        type: invoiceTypeForDb,
        amount: cardDetails.amountXTR,
        status: 'pending',
        currency: 'XTR',
        subscription_id: cardDetails.cardId, // invoices.subscription_id (TEXT) хранит cardId
        metadata: {
            card_title: cardDetails.title,
            card_description: cardDetails.description,
            original_card_type: cardDetails.type, 
            ...(cardDetails.metadata || {}),
        },
        // created_at and updated_at will be set by default by DB
    };
    
    const { data: createdInvoice, error: dbError } = await supabaseAdmin
        .from('invoices')
        .insert(dbInvoiceData)
        .select()
        .single();

    if (dbError || !createdInvoice) {
      logger.error("[HotVibesActions] Failed to record ProtoCard invoice in DB:", dbError);
      return { success: false, error: `Ошибка БД при создании счета: ${dbError?.message || 'Не удалось сохранить счет'}` };
    }
    logger.info(`[HotVibesActions] ProtoCard invoice ${createdInvoice.id} recorded in DB. DB invoice.subscription_id (should be cardId): ${createdInvoice.subscription_id}`);

    // Шаг 2: Отправка Инвойса в Telegram
    const tgInvoiceResult = await tgSendInvoice(
      userId,
      cardDetails.title,
      cardDetails.description,
      invoicePayload, 
      cardDetails.amountXTR,
      0, // Фиктивный числовой subscription_id для функции tgSendInvoice
      (cardDetails.metadata?.photo_url as string) || undefined
    );

    if (!tgInvoiceResult.success) {
      logger.error("[HotVibesActions] Failed to send ProtoCard invoice via Telegram:", tgInvoiceResult.error);
      return { success: false, error: `Ошибка Telegram при отправке счета: ${tgInvoiceResult.error || 'Не удалось отправить счет'}` };
    }

    logger.info(`[HotVibesActions] ProtoCard invoice ${invoicePayload} sent to user ${userId} via Telegram successfully.`);
    return { success: true, invoiceId: createdInvoice.id };

  } catch (error) {
    logger.error("[HotVibesActions] Critical error in sendAndRecordProtoCardInvoice:", error);
    const errorMsg = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { success: false, error: `Критическая ошибка: ${errorMsg}` };
  }
}