import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { logger } from "@/lib/logger"; 
import { updateUserSubscription } from "@/hooks/supabase"; // Import the hook

export const subscriptionHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "subscription_cyberfitness",

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, _baseUrl) => {
    logger.log(`[SubscriptionHandler] Processing for user ${userId}, invoice ID: ${invoice.id}, type: ${invoice.type}`);

    const purchasedSubscriptionId = invoice.metadata?.subscription_id as string | undefined;
    const purchasedSubscriptionName = invoice.metadata?.subscription_name as string | undefined;
    const expectedPriceXTR = invoice.metadata?.subscription_price_stars as number | undefined;

    if (!purchasedSubscriptionId || !purchasedSubscriptionName) {
      logger.error(`[SubscriptionHandler] Critical: subscription_id or subscription_name missing in invoice metadata for invoice ${invoice.id}. Metadata:`, invoice.metadata);
      await sendTelegramMessage(
        telegramToken,
        `🚨 ОШИБКА ОБРАБОТКИ ПОДПИСКИ для ${userData.username || userId}! ID подписки не найден в метаданных инвойса ${invoice.id}. Свяжитесь с поддержкой.`,
        [], undefined, userId
      );
      await sendTelegramMessage(
        telegramToken,
        `🚫 КРИТИЧЕСКАЯ ОШИБКА: ID/Имя подписки не найдены в метаданных инвойса ${invoice.id} для пользователя ${userId}. Сумма: ${totalAmount} XTR. Metadata: ${JSON.stringify(invoice.metadata)}`,
        [], undefined, adminChatId
      );
      return; 
    }

    if (expectedPriceXTR !== undefined && totalAmount !== expectedPriceXTR) {
        logger.warn(`[SubscriptionHandler] Price mismatch for invoice ${invoice.id}! Expected ${expectedPriceXTR} XTR, got ${totalAmount} XTR. Proceeding with ID: ${purchasedSubscriptionId}`);
    }

    // Update user's subscription_id using the hook
    const updateResult = await updateUserSubscription(userId, purchasedSubscriptionId);

    if (!updateResult.success || !updateResult.data) {
      logger.error(`[SubscriptionHandler] Failed to update user ${userId} with subscription ${purchasedSubscriptionId}:`, updateResult.error);
      await sendTelegramMessage(
        telegramToken,
        `⚠️ Произошла ошибка при обновлении вашей CyberVibe OS до "${purchasedSubscriptionName}". Пожалуйста, свяжитесь с поддержкой, указав ID транзакции: ${invoice.id}`,
        [], undefined, userId
      );
      await sendTelegramMessage(
        telegramToken,
        `🚫 ОШИБКА ОБНОВЛЕНИЯ ПОЛЬЗОВАТЕЛЯ ${userId} после оплаты подписки ${purchasedSubscriptionId} (${purchasedSubscriptionName}). Инвойс: ${invoice.id}. Ошибка: ${updateResult.error}`,
        [], undefined, adminChatId
      );
      return; 
    }
    
    // Optionally, update role/status if needed, based on updateResult.data (the updated user object)
    // For example, if roles are tied to subscription IDs:
    let userStatusUpdatePayload: { role?: string; status?: string } = {};
    if (purchasedSubscriptionId === "vibe_launch_co_pilot_intro") {
      userStatusUpdatePayload.role = "co_pilot_subscriber";
      userStatusUpdatePayload.status = "active_paid";
    } else if (purchasedSubscriptionId === "qbi_matrix_mastery_wowtro") {
      userStatusUpdatePayload.role = "qbi_master";
      userStatusUpdatePayload.status = "active_premium";
    }
     if (totalAmount === 420 && purchasedSubscriptionId === "qbi_matrix_mastery_wowtro") {
      logger.warn(`[SubscriptionHandler] Admin override triggered for user ${userId} with amount 420 XTR on QBI plan.`);
      userStatusUpdatePayload.role = "admin";
      userStatusUpdatePayload.status = "admin";
    }

    if (Object.keys(userStatusUpdatePayload).length > 0) {
        const { error: updateStatusError } = await supabase
            .from("users")
            .update(userStatusUpdatePayload)
            .eq("user_id", userId);
        if (updateStatusError) {
             logger.error(`[SubscriptionHandler] Failed to update user ${userId} role/status for subscription ${purchasedSubscriptionId}:`, updateStatusError);
             // Non-critical, subscription_id is set, but log it.
        } else {
            logger.log(`[SubscriptionHandler] User ${userId} role/status updated for subscription ${purchasedSubscriptionId}.`);
        }
    }


    logger.log(`[SubscriptionHandler] User ${userId} successfully upgraded to subscription: ${purchasedSubscriptionName} (ID: ${purchasedSubscriptionId}).`);

    await sendTelegramMessage(
      telegramToken,
      `🎉 VIBE Активирован! Ваша CyberVibe OS успешно обновлена до уровня: "${purchasedSubscriptionName}"! Погружайтесь в новые возможности, Агент!`,
      [],
      undefined,
      userId
    );

    await sendTelegramMessage(
      telegramToken,
      `🔔 Апгрейд! Пользователь ${userData.username || userId} (${userId}) успешно обновил CyberVibe OS до: "${purchasedSubscriptionName}" (Сумма: ${totalAmount} XTR).`,
      [],
      undefined,
      adminChatId
    );
  },
};