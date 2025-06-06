"use server";

import type { WebhookHandler } from "./types";
import { supabaseAdmin, updateUserMetadata } from '@/hooks/supabase';
import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

// Определение структуры для хранения ПротоКарточек в metadata пользователя
interface UserProtoCard {
  type: string;                 // Тип карточки, например "simulation_access" или "mission_support"
  purchased_at: string;         // ISO timestamp покупки
  price_xtr: number;            // Цена покупки в XTR
  status: "active" | "redeemed" | "voided"; // Статус карточки
  invoice_id: string;           // ID инвойса, по которому куплена
  data?: Record<string, any>;   // Дополнительные данные (page_link, lead_id, title и т.д.)
}

interface UserMetadataWithProtoCards {
  xtr_protocards?: {
    [cardId: string]: UserProtoCard;
  };
  // ...другие поля metadata...
}

export const protocardPurchaseHandler: WebhookHandler = {
  canHandle: (invoice, payload) => {
    // Проверяем по типу инвойса в БД или по префиксу payload, если тип еще не записан
    const typeMatch = invoice.type?.startsWith('protocard_');
    const payloadMatch = typeof payload === 'string' && payload.startsWith("protocard_");
    return !!(typeMatch || payloadMatch);
  },

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    logger.info(`[ProtoCardHandler] Processing ProtoCard purchase. UserID: ${userId}, InvoiceID: ${invoice.id}, Amount: ${totalAmount} XTR.`);
    
    // cardId мы сохранили в invoices.subscription_id
    const cardId = invoice.subscription_id; 
    const cardMetadataFromInvoice = invoice.metadata;

    if (!cardId) {
      logger.error(`[ProtoCardHandler] Critical: cardId (from invoice.subscription_id) is missing for invoice ${invoice.id}. Cannot update user metadata.`);
      await sendTelegramMessage(
        `🚨 ОШИБКА ОБРАБОТКИ ПРОТОКАРТЫ для ${userData.username || userId}! ID карточки не найден в инвойсе ${invoice.id}. Свяжитесь с поддержкой.`,
        [], undefined, userId, undefined
      );
      await sendTelegramMessage(
        `🚫 КРИТИЧЕСКАЯ ОШИБКА: ID карточки (invoice.subscription_id) не найден в инвойсе ${invoice.id} для пользователя ${userId}.`,
        [], undefined, adminChatId, undefined
      );
      return; // Прекращаем обработку, если нет cardId
    }

    logger.debug(`[ProtoCardHandler] Extracted cardId: ${cardId}. Card metadata from invoice:`, cardMetadataFromInvoice);

    try {
      // 1. Пометить инвойс как 'paid' (если еще не сделано в proxy, но лучше убедиться)
      const { error: updateInvoiceError } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", invoice.id)
        .neq("status", "paid"); // Обновляем, только если статус еще не 'paid'

      if (updateInvoiceError) {
        logger.error(`[ProtoCardHandler] Error marking invoice ${invoice.id} as paid:`, updateInvoiceError);
        // Не критично, если уже было сделано, но логируем
      }

      // 2. Обновить users.metadata
      const currentUserMetadata = (userData.metadata || {}) as UserMetadataWithProtoCards;
      const existingProtoCards = currentUserMetadata.xtr_protocards || {};

      const newProtoCardEntry: UserProtoCard = {
        type: cardMetadataFromInvoice?.original_card_type || invoice.type || 'unknown', // Используем original_card_type если есть
        purchased_at: new Date().toISOString(),
        price_xtr: totalAmount, // totalAmount уже в XTR
        status: "active",
        invoice_id: invoice.id,
        data: {
            title: cardMetadataFromInvoice?.card_title || "ПротоКарточка",
            description: cardMetadataFromInvoice?.card_description || "Доступ или поддержка",
            ...(cardMetadataFromInvoice?.associated_lead_id && { lead_id: cardMetadataFromInvoice.associated_lead_id }),
            ...(cardMetadataFromInvoice?.simulator_page && { page_link: cardMetadataFromInvoice.simulator_page }),
            // Копируем все остальные метаданные из cardDetails.metadata, которые были сохранены в инвойсе
            ...Object.fromEntries(
                Object.entries(cardMetadataFromInvoice || {})
                      .filter(([key]) => !['card_title', 'card_description', 'original_card_type', 'associated_lead_id', 'simulator_page'].includes(key))
            )
        }
      };

      const updatedProtoCards = {
        ...existingProtoCards,
        [cardId]: newProtoCardEntry,
      };

      const finalMetadataUpdate: UserMetadataWithProtoCards = {
        ...currentUserMetadata,
        xtr_protocards: updatedProtoCards,
      };
      
      const metadataUpdateResult = await updateUserMetadata(userId, finalMetadataUpdate);

      if (!metadataUpdateResult.success) {
        logger.error(`[ProtoCardHandler] Failed to update user ${userId} metadata with ProtoCard ${cardId}:`, metadataUpdateResult.error);
        // Отправить пользователю сообщение об ошибке, но не админу, т.к. админ уже должен был получить уведомление об ошибке от updateUserMetadata
        await sendTelegramMessage(
          `⚠️ Произошла ошибка при добавлении ПротоКарточки в ваш профиль. Пожалуйста, свяжитесь с поддержкой, указав ID транзакции: ${invoice.id}`,
          [], undefined, userId, undefined
        );
        return;
      }
      logger.info(`[ProtoCardHandler] User ${userId} metadata updated successfully with ProtoCard ${cardId}.`);

      // 3. Уведомить пользователя и админа
      const cardTitleForNotification = cardMetadataFromInvoice?.card_title || `Карточка ${cardId}`;
      await sendTelegramMessage(
        `✅ Спасибо за покупку ПротоКарточки "${cardTitleForNotification}"! Она добавлена в ваш инвентарь. VIBE ON!`,
        [], undefined, userId, undefined
      );

      await sendTelegramMessage(
        `🔔 Пользователь ${userData.username || userId} (${userId}) приобрел ПротоКарточку "${cardTitleForNotification}" (ID: ${cardId}) за ${totalAmount} XTR. Инвойс: ${invoice.id}.`,
        [], undefined, adminChatId, undefined
      );

    } catch (error) {
      logger.error(`[ProtoCardHandler] Critical error processing ProtoCard purchase for user ${userId}, card ${cardId}:`, error);
      await sendTelegramMessage( // Уведомляем админа о критической ошибке
        `🚨 КРИТИЧЕСКАЯ ОШИБКА при обработке ПротоКарточки! User: ${userId}, CardID: ${cardId}, Invoice: ${invoice.id}. Ошибка: ${error instanceof Error ? error.message : String(error)}`,
        [], undefined, adminChatId, undefined
      );
      // Пользователя можно не уведомлять об ошибке здесь, если это уже сделано на предыдущих этапах
    }
  },
};