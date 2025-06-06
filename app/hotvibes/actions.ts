"use server";

import { supabaseAdmin, createInvoice as dbCreateInvoice } from '@/hooks/supabase';
import { sendTelegramInvoice as tgSendInvoice } from '@/app/actions'; // Original function
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

type User = Database["public"]["Tables"]["users"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

export interface ProtoCardDetails {
  cardId: string; // Уникальный идентификатор карточки, напр. "elon_tweet_dip_v1" или "lead_xyz_support"
  title: string;
  description: string;
  amountXTR: number;
  type: string; // напр. "simulation_access", "mission_support"
  metadata?: Record<string, any>; // для доп. данных типа page_link или lead_id
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
  const invoiceTypeForDb = `protocard_${cardDetails.type}`; // e.g., protocard_simulation_access

  logger.info(`[HotVibesActions] Preparing to create ProtoCard invoice. UserID: ${userId}, CardID: ${cardDetails.cardId}, Amount: ${cardDetails.amountXTR} XTR, Payload: ${invoicePayload}`);

  try {
    // Шаг 1: Запись Инвойса в БД
    // Используем dbCreateInvoice из hooks/supabase.ts, который должен использовать supabaseAdmin
    // Важно: dbCreateInvoice должен корректно обработать text для subscription_id
    const dbInvoiceData: Partial<Invoice> = {
        id: invoicePayload,
        user_id: userId,
        type: invoiceTypeForDb,
        amount: cardDetails.amountXTR,
        status: 'pending',
        currency: 'XTR',
        // `subscription_id` в таблице invoices - TEXT, сюда пишем cardId
        subscription_id: cardDetails.cardId,
        metadata: {
            card_title: cardDetails.title,
            card_description: cardDetails.description,
            original_card_type: cardDetails.type, // Store the original, more granular type
            ...(cardDetails.metadata || {}),
        },
    };
    
    // Вместо вызова SQL функции create_invoice, используем прямой insert через supabaseAdmin, если dbCreateInvoice не подходит
    // Это даст больше контроля над полями, особенно над subscription_id как TEXT.
    const { data: createdInvoice, error: dbError } = await supabaseAdmin
        .from('invoices')
        .insert(dbInvoiceData as Database["public"]["Tables"]["invoices"]["Insert"]) // Type assertion if needed
        .select()
        .single();

    if (dbError || !createdInvoice) {
      logger.error("[HotVibesActions] Failed to record ProtoCard invoice in DB:", dbError);
      return { success: false, error: `Ошибка БД при создании счета: ${dbError?.message || 'Не удалось сохранить счет'}` };
    }
    logger.info(`[HotVibesActions] ProtoCard invoice ${createdInvoice.id} recorded in DB. Subscription ID (CardID) in DB: ${createdInvoice.subscription_id}`);

    // Шаг 2: Отправка Инвойса в Telegram
    // Используем существующую tgSendInvoice из /app/actions.ts
    // Она ожидает subscription_id как number, передаем 0 или фиктивное число.
    // Главное, что в нашей БД invoices.subscription_id уже сохранен правильный текстовый cardId.
    const tgInvoiceResult = await tgSendInvoice(
      userId,
      cardDetails.title,
      cardDetails.description,
      invoicePayload, // Этот payload будет использован Telegram
      cardDetails.amountXTR,
      0, // Фиктивный числовой subscription_id для старой функции tgSendInvoice
      cardDetails.metadata?.photo_url // Если есть фото для карточки
    );

    if (!tgInvoiceResult.success) {
      logger.error("[HotVibesActions] Failed to send ProtoCard invoice via Telegram:", tgInvoiceResult.error);
      // Попытаться откатить запись в БД или пометить инвойс как ошибочный? Для MVP можно пропустить.
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