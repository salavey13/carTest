import type { WebhookHandler } from "./types";
import { supabaseAnon, updateUserMetadata } from '@/hooks/supabase';
import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

type UserMetadata = Database["public"]["Tables"]["users"]["Row"]["metadata"];

interface UserProtoCard {
  type: string;                 
  purchased_at: string;         
  price: string; // Changed to string to accommodate "13 XTR" or "100 KV"         
  status: "active" | "redeemed" | "voided"; 
  transaction_id: string; // Changed from invoice_id to be more generic         
  data?: Record<string, any>;   
}

interface UserMetadataWithProtoCards extends UserMetadata {
  xtr_protocards?: {
    [cardId: string]: UserProtoCard;
  };
}

// THIS HANDLER IS NOW ONLY FOR XTR PAYMENTS. KV purchases are handled directly.
export const protocardPurchaseHandler: WebhookHandler = {
  canHandle: (invoice, payload) => {
    const typeMatch = invoice.type?.startsWith('protocard_');
    const payloadMatch = typeof payload === 'string' && payload.startsWith("protocard_");
    logger.debug(`[ProtoCardHandler canHandle] Checking invoice.type: ${invoice.type}, payload: ${payload}. TypeMatch: ${typeMatch}, PayloadMatch: ${payloadMatch}`);
    return !!(typeMatch || payloadMatch);
  },

  handle: async (invoice, userId, userData, totalAmountXTR, supabase, telegramToken, adminChatId, baseUrl) => {
    logger.info(`[ProtoCardHandler] Processing XTR-based ProtoCard purchase. UserID: ${userId}, InvoiceID: ${invoice.id}, Amount: ${totalAmountXTR} XTR.`);
    
    const cardId = invoice.subscription_id; 
    const cardMetadataFromInvoice = invoice.metadata;

    if (!cardId) {
      logger.error(`[ProtoCardHandler] Critical: cardId (from invoice.subscription_id) is missing for invoice ${invoice.id}.`);
      // User is already notified by the payment system, but admin needs to know.
      await sendTelegramMessage(
        `🚫 КРИТИЧЕСКАЯ ОШИБКА: ID карточки (invoice.subscription_id) не найден в инвойсе ${invoice.id} для пользователя ${userId}. Платеж прошел!`,
        [], undefined, adminChatId, undefined
      );
      return; 
    }

    try {
      // Step 1: Grant Access. This function encapsulates updating the user metadata.
      const grantResult = await supabaseAnon.rpc('grant_protocard_access', {
          p_user_id: userId,
          p_card_id: cardId,
          p_card_details: { // Constructing the card details based on invoice
            type: cardMetadataFromInvoice?.original_card_type || invoice.type?.replace('protocard_', '') || 'unknown',
            purchased_at: new Date().toISOString(),
            price: `${totalAmountXTR} XTR`,
            status: "active",
            transaction_id: invoice.id,
            data: {
              title: cardMetadataFromInvoice?.card_title || "ПротоКарточка",
              description: cardMetadataFromInvoice?.card_description || "Доступ или поддержка",
              ...(cardMetadataFromInvoice || {}), // Add all other metadata from invoice
            }
          }
      });
      
      if (grantResult.error) {
          logger.error(`[ProtoCardHandler] RPC grant_protocard_access failed for user ${userId}, card ${cardId}:`, grantResult.error);
          await sendTelegramMessage(
            `⚠️ Произошла ошибка при добавлении ПротоКарточки в ваш профиль после оплаты. Пожалуйста, свяжитесь с поддержкой, указав ID транзакции: ${invoice.id}`,
            [], undefined, userId, undefined
          );
          return;
      }
      
      logger.info(`[ProtoCardHandler] User ${userId} metadata updated successfully via RPC with ProtoCard ${cardId}.`);

      // Step 2: Mark invoice as paid
      const { error: updateInvoiceError } = await supabaseAnon
        .from("invoices")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", invoice.id)
        .neq("status", "paid"); 

      if (updateInvoiceError) {
        logger.error(`[ProtoCardHandler] Error marking invoice ${invoice.id} as paid (but access was granted):`, updateInvoiceError);
        // Don't stop here, user already has access.
      }

      // Step 3: Notify user and admin
      const cardTitleForNotification = cardMetadataFromInvoice?.card_title || `Карточка ${cardId}`;
      let userMessage = `✅ Спасибо за покупку ПротоКарточки "${cardTitleForNotification}"! Она добавлена в ваш инвентарь. VIBE ON!`;
      const pageLink = cardMetadataFromInvoice?.page_link || (cardMetadataFromInvoice?.data as any)?.page_link;
      const demoLinkParam = cardMetadataFromInvoice?.demo_link_param || (cardMetadataFromInvoice?.data as any)?.demo_link_param;

      if (pageLink) {
        userMessage += `\nДоступ открыт: ${baseUrl}${pageLink}`;
      } else if (demoLinkParam) {
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'webAnyBot';
        const demoUrl = `https://t.me/${botUsername}/app?startapp=${demoLinkParam}`;
        userMessage += `\nДоступ к демо для миссии: ${demoUrl}`;
      }

      await sendTelegramMessage(userMessage, [], undefined, userId, undefined);

      await sendTelegramMessage(
        `🔔 [XTR] Пользователь ${userData.username || userId} (${userId}) приобрел ПротоКарточку "${cardTitleForNotification}" (ID: ${cardId}) за ${totalAmountXTR} XTR. Инвойс: ${invoice.id}.`,
        [], undefined, adminChatId, undefined
      );

    } catch (error) {
      logger.error(`[ProtoCardHandler] Critical error processing XTR purchase for user ${userId}, card ${cardId}:`, error);
      await sendTelegramMessage( 
        `🚨 КРИТИЧЕСКАЯ ОШИБКА при обработке XTR платежа! User: ${userId}, CardID: ${cardId}, Invoice: ${invoice.id}. Ошибка: ${error instanceof Error ? error.message : String(error)}`,
        [], undefined, adminChatId, undefined
      );
    }
  },
};