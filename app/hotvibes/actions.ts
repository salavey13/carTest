"use server";

import { supabaseAdmin } from '@/hooks/supabase'; 
import { sendTelegramMessage, sendTelegramInvoice as tgSendInvoice } from '@/app/actions'; 
// FIXED: Importing from the new server-only actions file.
import { spendKiloVibes, addKiloVibes } from '@/app/cyberfitness/actions';
import { logger } from "@/lib/logger"; 
import type { Database } from "@/types/database.types";
import { getBaseUrl } from '@/lib/utils';

type User = Database["public"]["Tables"]["users"]["Row"];

export interface ProtoCardDetails {
  cardId: string; 
  title: string;
  description: string;
  amountXTR: number;
  amountKV?: number;
  type: string; 
  metadata?: Record<string, any>; 
}

async function grantProtoCardAccess(
  userId: string,
  cardDetails: ProtoCardDetails,
  paymentMethod: 'XTR' | 'KV',
  transactionId: string
): Promise<{success: boolean; error?: string}> {
    logger.info(`[grantProtoCardAccess] Granting card '${cardDetails.cardId}' to user ${userId} via ${paymentMethod}.`);
    
    const { error: rpcError } = await supabaseAdmin.rpc('grant_protocard_access', {
        p_user_id: userId,
        p_card_id: cardDetails.cardId,
        p_card_details: {
            type: cardDetails.type,
            purchased_at: new Date().toISOString(),
            price: paymentMethod === 'XTR' ? `${cardDetails.amountXTR} XTR` : `${cardDetails.amountKV} KV`,
            status: "active",
            transaction_id: transactionId,
            data: {
                title: cardDetails.title,
                description: cardDetails.description,
                ...(cardDetails.metadata || {}),
            }
        }
    });

    if(rpcError) {
        logger.error(`[grantProtoCardAccess] RPC grant_protocard_access failed for user ${userId}:`, rpcError);
        return { success: false, error: "Database error while granting card access." };
    }
    
    logger.info(`[grantProtoCardAccess] Successfully granted ProtoCard ${cardDetails.cardId} to user ${userId} via RPC.`);
    
    const cardTitleForNotification = cardDetails.title || `Карточка ${cardDetails.cardId}`;
    let userMessage = `✅ Спасибо за покупку ПротоКарточки "${cardTitleForNotification}"! Она добавлена в ваш инвентарь. VIBE ON!`;
    const baseUrl = getBaseUrl();
    const pageLink = cardDetails.metadata?.page_link;
    const demoLinkParam = cardDetails.metadata?.demo_link_param;

    if (pageLink) {
      userMessage += `\nДоступ открыт: ${baseUrl}${pageLink}`;
    } else if (demoLinkParam) {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'oneSitePlsBot';
      const demoUrl = `https://t.me/${botUsername}/app?startapp=${demoLinkParam}`;
      userMessage += `\nДоступ к демо для миссии: ${demoUrl}`;
    }
    
    await sendTelegramMessage(userMessage, [], undefined, userId, undefined);

    await sendTelegramMessage(
      `🔔 [${paymentMethod}] Пользователь ${userId} приобрел ПротоКарточку "${cardTitleForNotification}" (ID: ${cardDetails.cardId}). Транзакция: ${transactionId}.`,
      [], undefined, process.env.ADMIN_CHAT_ID, undefined
    );
    
    return { success: true };
}

export async function purchaseProtoCardAction(
  userId: string,
  cardDetails: ProtoCardDetails,
  paymentMethodHint?: 'KV' | 'XTR'
): Promise<{ success: boolean; invoiceId?: string; error?: string; purchaseMethod?: 'KV' | 'XTR' | 'ALREADY_OWNED' | 'INSUFFICIENT_FUNDS' }> {
  logger.info(`[purchaseProtoCardAction] Initiating purchase for user ${userId}, card: ${cardDetails.cardId}, hint: ${paymentMethodHint || 'none'}`);

  if (!userId || !cardDetails || !cardDetails.cardId || !cardDetails.title) {
    logger.error("[purchaseProtoCardAction] Invalid parameters", { userId, cardDetails });
    return { success: false, error: "Неверные параметры для покупки." };
  }

  const { data: userData, error: userError } = await supabaseAdmin.from('users').select('metadata').eq('user_id', userId).single();
  if (userError) {
      logger.error(`[purchaseProtoCardAction] Failed to fetch user data for pre-check:`, userError);
      return { success: false, error: "Не удалось проверить ваш профиль." };
  }
  if (userData.metadata?.xtr_protocards?.[cardDetails.cardId]?.status === 'active') {
      logger.warn(`[purchaseProtoCardAction] User ${userId} already owns card ${cardDetails.cardId}. Purchase aborted.`);
      return { success: false, error: "У вас уже есть доступ к этой возможности.", purchaseMethod: 'ALREADY_OWNED' };
  }

  // --- KV Payment Logic ---
  const attemptKvPayment = (paymentMethodHint === 'KV' || !paymentMethodHint) && cardDetails.amountKV && cardDetails.amountKV > 0;
  if (attemptKvPayment) {
    logger.info(`[purchaseProtoCardAction] Attempting KV payment for card ${cardDetails.cardId} (${cardDetails.amountKV} KV).`);
    const spendResult = await spendKiloVibes(userId, cardDetails.amountKV, `Purchase ProtoCard: ${cardDetails.cardId}`);
    
    if (spendResult.success) {
      logger.info(`[purchaseProtoCardAction] KV payment successful for card ${cardDetails.cardId}.`);
      const grantResult = await grantProtoCardAccess(userId, cardDetails, 'KV', `kv_purchase_${Date.now()}`);
      
      if (!grantResult.success) {
          const refundReason = `Refund for failed ProtoCard grant: ${cardDetails.cardId}`;
          await addKiloVibes(userId, cardDetails.amountKV, refundReason);
          logger.error(`[purchaseProtoCardAction] CRITICAL: Spent KV but failed to grant access for card ${cardDetails.cardId}. KV Refunded.`);
          return { success: false, error: `KV were spent, but access grant failed. Your KiloVibes have been refunded. Please contact support.`, purchaseMethod: 'KV' };
      }
      return { success: true, purchaseMethod: 'KV' };

    } else if (paymentMethodHint === 'KV') {
        // If user explicitly chose KV and it failed, do NOT fall back to XTR. Return the error directly.
        logger.warn(`[purchaseProtoCardAction] KV purchase failed for user ${userId} with explicit 'KV' hint. Error: ${spendResult.error}`);
        return { success: false, error: spendResult.error, purchaseMethod: 'INSUFFICIENT_FUNDS' };
    } else if (spendResult.error && spendResult.error.includes("Insufficient")) {
        logger.warn(`[purchaseProtoCardAction] Insufficient KV for user ${userId}. Falling back to XTR payment.`);
    } else {
        logger.error(`[purchaseProtoCardAction] Error during KV payment for user ${userId}:`, spendResult.error);
        return { success: false, error: `An error occurred with KiloVibe balance: ${spendResult.error}` };
    }
  }

  // --- XTR Payment Logic ---
  const attemptXtrPayment = paymentMethodHint === 'XTR' || !paymentMethodHint; // Attempt if hint is XTR, or if it's a fallback
  if(attemptXtrPayment) {
      if (!cardDetails.amountXTR || cardDetails.amountXTR <= 0) {
        logger.warn(`[purchaseProtoCardAction] No XTR price, and KV purchase failed or was skipped. Aborting.`);
        return { success: false, error: "Недостаточно KiloVibes, и оплата в XTR недоступна.", purchaseMethod: 'INSUFFICIENT_FUNDS' };
      }
      
      logger.info(`[purchaseProtoCardAction] Proceeding with XTR payment for card ${cardDetails.cardId}.`);
      const invoicePayload = `protocard_${cardDetails.type}_${cardDetails.cardId}_${userId}_${Date.now()}`;
      const invoiceTypeForDb = `protocard_${cardDetails.type}`;

      try {
        const dbInvoiceData: Database["public"]["Tables"]["invoices"]["Insert"] = {
            id: invoicePayload, user_id: userId, type: invoiceTypeForDb,
            amount: cardDetails.amountXTR, status: 'pending', currency: 'XTR',
            subscription_id: cardDetails.cardId, 
            metadata: {
                card_title: cardDetails.title,
                card_description: cardDetails.description,
                original_card_type: cardDetails.type, 
                ...(cardDetails.metadata || {}),
            },
        };
        
        const { data: createdInvoice, error: dbError } = await supabaseAdmin.from('invoices').insert(dbInvoiceData).select().single();

        if (dbError || !createdInvoice) {
          logger.error("[purchaseProtoCardAction] DB error creating invoice:", dbError);
          return { success: false, error: `Ошибка БД при создании счета: ${dbError?.message || 'Не удалось сохранить счет'}` };
        }
        logger.info(`[purchaseProtoCardAction] Invoice ${createdInvoice.id} created in DB for XTR payment.`);

        const tgInvoiceResult = await tgSendInvoice(
          userId, cardDetails.title, cardDetails.description,
          invoicePayload, cardDetails.amountXTR, 0, 
          (cardDetails.metadata?.photo_url as string) || undefined
        );

        if (!tgInvoiceResult.success) {
          logger.error("[purchaseProtoCardAction] Telegram error sending invoice:", tgInvoiceResult.error);
          return { success: false, error: `Ошибка Telegram при отправке счета: ${tgInvoiceResult.error || 'Не удалось отправить счет'}` };
        }

        logger.info(`[purchaseProtoCardAction] Invoice ${invoicePayload} sent to user ${userId} via Telegram.`);
        return { success: true, invoiceId: createdInvoice.id, purchaseMethod: 'XTR' };

      } catch (error) {
        logger.error("[purchaseProtoCardAction] Critical error during XTR flow:", error);
        return { success: false, error: `Критическая ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}` };
      }
  }
  
  // This should only be reached if no payment path was taken, which indicates a logic error.
  logger.error(`[purchaseProtoCardAction] Reached end of function without a payment path for card ${cardDetails.cardId}`);
  return { success: false, error: "Не удалось определить метод оплаты." };
}