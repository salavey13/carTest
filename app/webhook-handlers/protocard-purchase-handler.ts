// /app/webhook-handlers/protocard-purchase-handler.ts
"use server";

import type { WebhookHandler } from "./types";
import { supabaseAdmin, updateUserMetadata } from '@/hooks/supabase';
import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

type UserMetadata = Database["public"]["Tables"]["users"]["Row"]["metadata"];

interface UserProtoCard {
  type: string;                 
  purchased_at: string;         
  price_xtr: number;            
  status: "active" | "redeemed" | "voided"; 
  invoice_id: string;           
  data?: Record<string, any>;   
}

interface UserMetadataWithProtoCards extends UserMetadata { // Расширяем UserMetadata
  xtr_protocards?: {
    [cardId: string]: UserProtoCard;
  };
}

export const protocardPurchaseHandler: WebhookHandler = {
  canHandle: (invoice, payload) => {
    const typeMatch = invoice.type?.startsWith('protocard_');
    const payloadMatch = typeof payload === 'string' && payload.startsWith("protocard_");
    logger.debug(`[ProtoCardHandler canHandle] Checking invoice.type: ${invoice.type}, payload: ${payload}. TypeMatch: ${typeMatch}, PayloadMatch: ${payloadMatch}`);
    return !!(typeMatch || payloadMatch);
  },

  handle: async (invoice, userId, userData, totalAmountXTR, supabase, telegramToken, adminChatId, baseUrl) => {
    // totalAmountXTR здесь уже в XTR (например, 13), т.к. proxy.ts делит на 100
    logger.info(`[ProtoCardHandler] Processing ProtoCard purchase. UserID: ${userId}, InvoiceID: ${invoice.id}, Amount: ${totalAmountXTR} XTR.`);
    
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
      return; 
    }

    logger.debug(`[ProtoCardHandler] Extracted cardId: ${cardId}. Card metadata from invoice:`, cardMetadataFromInvoice);

    try {
      // 1. Пометить инвойс как 'paid'
      const { error: updateInvoiceError } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", invoice.id)
        .neq("status", "paid"); 

      if (updateInvoiceError) {
        logger.error(`[ProtoCardHandler] Error marking invoice ${invoice.id} as paid:`, updateInvoiceError);
      } else {
        logger.info(`[ProtoCardHandler] Invoice ${invoice.id} marked as paid or was already paid.`);
      }

      // 2. Обновить users.metadata
      const currentUserMetadata = (userData.metadata || {}) as UserMetadataWithProtoCards;
      const existingProtoCards = currentUserMetadata.xtr_protocards || {};

      const newProtoCardEntry: UserProtoCard = {
        type: cardMetadataFromInvoice?.original_card_type || invoice.type?.replace('protocard_', '') || 'unknown',
        purchased_at: new Date().toISOString(),
        price_xtr: totalAmountXTR, 
        status: "active",
        invoice_id: invoice.id,
        data: {
            title: cardMetadataFromInvoice?.card_title || "ПротоКарточка",
            description: cardMetadataFromInvoice?.card_description || "Доступ или поддержка",
            // Копируем специфичные метаданные, которые могли быть переданы
            ...(cardMetadataFromInvoice?.associated_lead_id && { lead_id: cardMetadataFromInvoice.associated_lead_id }),
            ...(cardMetadataFromInvoice?.lead_title && { lead_title: cardMetadataFromInvoice.lead_title }),
            ...(cardMetadataFromInvoice?.demo_link_param && { demo_link_param: cardMetadataFromInvoice.demo_link_param }),
            ...(cardMetadataFromInvoice?.simulator_page && { page_link: cardMetadataFromInvoice.simulator_page }),
        }
      };
      // Удаляем data, если оно пустое, чтобы не засорять метаданные
      if (Object.keys(newProtoCardEntry.data || {}).length === 0) {
          delete newProtoCardEntry.data;
      }

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
        await sendTelegramMessage(
          `⚠️ Произошла ошибка при добавлении ПротоКарточки в ваш профиль. Пожалуйста, свяжитесь с поддержкой, указав ID транзакции: ${invoice.id}`,
          [], undefined, userId, undefined
        );
        return;
      }
      logger.info(`[ProtoCardHandler] User ${userId} metadata updated successfully with ProtoCard ${cardId}.`);

      // 3. Уведомить пользователя и админа
      const cardTitleForNotification = cardMetadataFromInvoice?.card_title || `Карточка ${cardId}`;
      let userMessage = `✅ Спасибо за покупку ПротоКарточки "${cardTitleForNotification}"! Она добавлена в ваш инвентарь. VIBE ON!`;
      if (newProtoCardEntry.data?.page_link) {
        userMessage += `\nДоступ к симулятору: ${baseUrl}${newProtoCardEntry.data.page_link}`;
      } else if (newProtoCardEntry.data?.lead_id && newProtoCardEntry.data?.demo_link_param) {
        const demoUrl = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || 'webAnyBot'}/app?startapp=${newProtoCardEntry.data.demo_link_param}`;
        userMessage += `\nДоступ к демо для миссии "${newProtoCardEntry.data.lead_title || newProtoCardEntry.data.lead_id}": ${demoUrl}`;
      }

      await sendTelegramMessage(userMessage, [], undefined, userId, undefined);

      await sendTelegramMessage(
        `🔔 Пользователь ${userData.username || userId} (${userId}) приобрел ПротоКарточку "${cardTitleForNotification}" (ID: ${cardId}) за ${totalAmountXTR} XTR. Инвойс: ${invoice.id}.`,
        [], undefined, adminChatId, undefined
      );

    } catch (error) {
      logger.error(`[ProtoCardHandler] Critical error processing ProtoCard purchase for user ${userId}, card ${cardId}:`, error);
      await sendTelegramMessage( 
        `🚨 КРИТИЧЕСКАЯ ОШИБКА при обработке ПротоКарточки! User: ${userId}, CardID: ${cardId}, Invoice: ${invoice.id}. Ошибка: ${error instanceof Error ? error.message : String(error)}`,
        [], undefined, adminChatId, undefined
      );
    }
  },
};