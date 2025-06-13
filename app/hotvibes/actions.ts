"use server";

import { supabaseAdmin } from '@/hooks/supabase'; 
import { sendTelegramMessage, sendTelegramInvoice as tgSendInvoice } from '@/app/actions'; 
import { spendKiloVibes, updateUserCyberFitnessProfile, fetchUserCyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';
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

/**
 * Grants access to a ProtoCard for a user and sends notification.
 * This is a helper function to be called after a successful transaction (KV or XTR).
 */
async function grantProtoCardAccess(
  userId: string,
  cardDetails: ProtoCardDetails,
  paymentMethod: 'XTR' | 'KV',
  transactionId: string
): Promise<{success: boolean; error?: string}> {
    logger.info(`[grantProtoCardAccess] Granting access for user ${userId}, card ${cardDetails.cardId} via ${paymentMethod}`);
    
    // Using a DB function to handle the metadata update atomically is safer.
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

/**
 * Инициирует покупку "ПротоКарточки": 
 * Сначала проверяет, не куплена ли уже.
 * Затем пытается списать KiloVibes. Если не хватает, отправляет инвойс в Telegram.
 */
export async function purchaseProtoCardAction(
  userId: string,
  cardDetails: ProtoCardDetails
): Promise<{ success: boolean; invoiceId?: string; error?: string; purchaseMethod?: 'KV' | 'XTR' | 'ALREADY_OWNED' | 'INSUFFICIENT_FUNDS' }> {
  if (!userId || !cardDetails || !cardDetails.cardId || !cardDetails.title) {
    logger.error("[HotVibesActions purchase] Invalid parameters", { userId, cardDetails });
    return { success: false, error: "Неверные параметры для покупки." };
  }

  // --- 0. Check if user already owns the card ---
  const { data: userData, error: userError } = await supabaseAdmin.from('users').select('metadata').eq('user_id', userId).single();
  if (userError) {
      logger.error(`[purchaseProtoCardAction] Failed to fetch user data for pre-check:`, userError);
      return { success: false, error: "Не удалось проверить ваш профиль." };
  }
  if (userData.metadata?.xtr_protocards?.[cardDetails.cardId]?.status === 'active') {
      logger.info(`[purchaseProtoCardAction] User ${userId} already owns card ${cardDetails.cardId}.`);
      return { success: false, error: "У вас уже есть доступ к этой возможности.", purchaseMethod: 'ALREADY_OWNED' };
  }

  // --- 1. Попытка покупки за KiloVibes ---
  if (cardDetails.amountKV && cardDetails.amountKV > 0) {
    logger.info(`[HotVibesActions purchase] Attempting to purchase card ${cardDetails.cardId} for ${cardDetails.amountKV} KV.`);
    const spendResult = await spendKiloVibes(userId, cardDetails.amountKV, `Purchase ProtoCard: ${cardDetails.cardId}`);
    
    if (spendResult.success) {
      logger.info(`[HotVibesActions purchase] Successfully spent KV for card ${cardDetails.cardId}.`);
      const grantResult = await grantProtoCardAccess(userId, cardDetails, 'KV', `kv_purchase_${Date.now()}`);
      
      if (!grantResult.success) {
          await updateUserCyberFitnessProfile(userId, { kiloVibes: cardDetails.amountKV }); // Refund
          logger.error(`[HotVibesActions purchase] CRITICAL: Spent KV but failed to grant access for card ${cardDetails.cardId}. KV Refunded. Manual check needed.`);
          return { success: false, error: `KV were spent, but access grant failed. Your KiloVibes have been refunded. Please contact support.`, purchaseMethod: 'KV' };
      }
      return { success: true, purchaseMethod: 'KV' };

    } else if (spendResult.error && spendResult.error.includes("Insufficient")) {
        logger.info(`[HotVibesActions purchase] Insufficient KV for user ${userId}. Falling back to XTR payment.`);
    } else {
        logger.error(`[HotVibesActions purchase] Error spending KV for user ${userId}:`, spendResult.error);
        return { success: false, error: `An error occurred with KiloVibe balance: ${spendResult.error}` };
    }
  }

  // --- 2. Фолбэк на оплату XTR ---
  if (!cardDetails.amountXTR || cardDetails.amountXTR <= 0) {
    logger.warn(`[HotVibesActions purchase] No XTR price provided for card ${cardDetails.cardId}, and KV purchase failed or was not possible. Aborting.`);
    return { success: false, error: "Недостаточно KiloVibes, и оплата в XTR недоступна.", purchaseMethod: 'INSUFFICIENT_FUNDS' };
  }
  
  logger.info(`[HotVibesActions purchase] Proceeding with XTR payment for card ${cardDetails.cardId}.`);
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
      logger.error("[HotVibesActions purchase] Failed to record ProtoCard invoice in DB:", dbError);
      return { success: false, error: `Ошибка БД при создании счета: ${dbError?.message || 'Не удалось сохранить счет'}` };
    }
    logger.info(`[HotVibesActions purchase] ProtoCard invoice ${createdInvoice.id} recorded in DB for XTR payment.`);

    const tgInvoiceResult = await tgSendInvoice(
      userId, cardDetails.title, cardDetails.description,
      invoicePayload, cardDetails.amountXTR, 0, 
      (cardDetails.metadata?.photo_url as string) || undefined
    );

    if (!tgInvoiceResult.success) {
      logger.error("[HotVibesActions purchase] Failed to send ProtoCard invoice via Telegram:", tgInvoiceResult.error);
      return { success: false, error: `Ошибка Telegram при отправке счета: ${tgInvoiceResult.error || 'Не удалось отправить счет'}` };
    }

    logger.info(`[HotVibesActions purchase] ProtoCard invoice ${invoicePayload} sent to user ${userId} via Telegram successfully.`);
    return { success: true, invoiceId: createdInvoice.id, purchaseMethod: 'XTR' };

  } catch (error) {
    logger.error("[HotVibesActions purchase] Critical error during XTR flow:", error);
    return { success: false, error: `Критическая ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}` };
  }
}