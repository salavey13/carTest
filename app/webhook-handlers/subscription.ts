import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { logger } from "@/lib/logger"; // Assuming you have a logger

export const subscriptionHandler: WebhookHandler = {
  // Ensure the 'type' in createInvoice matches this.
  // In BuySubscriptionPage, it's "subscription_cyberfitness".
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
 ядер        `🚨 ОШИБКА ОБРАБОТКИ ПОДПИСКИ для ${userData.username || userId}! ID подписки не найден в метаданных инвойса ${invoice.id}. Свяжитесь с поддержкой.`,
        [], undefined, userId
      );
      await sendTelegramMessage(
        telegramToken,
        `🚫 КРИТИЧЕСКАЯ ОШИБКА: ID/Имя подписки не найдены в метаданных инвойса ${invoice.id} для пользователя ${userId}. Сумма: ${totalAmount} XTR. Metadata: ${JSON.stringify(invoice.metadata)}`,
        [], undefined, adminChatId
      );
      return; // Stop processing if essential metadata is missing
    }

    // Optional: Verify totalAmount matches expectedPriceXTR if it's reliable
    if (expectedPriceXTR !== undefined && totalAmount !== expectedPriceXTR) {
        logger.warn(`[SubscriptionHandler] Price mismatch for invoice ${invoice.id}! Expected ${expectedPriceXTR} XTR, got ${totalAmount} XTR. Proceeding with ID: ${purchasedSubscriptionId}`);
        // You might choose to send an admin alert here too.
    }

    // Define user updates based on purchasedSubscriptionId
    let userUpdatePayload: {
      subscription_id: string;
      subscription_name?: string; // Optional: store the name too
      role?: string;              // Optional: adjust role based on subscription
      status?: string;            // Optional: adjust status based on subscription
      // Add any other fields you want to update
    } = {
      subscription_id: purchasedSubscriptionId,
      subscription_name: purchasedSubscriptionName,
    };

    // Example: Assigning roles based on subscription tier
    // This logic needs to match your actual tier IDs from BuySubscriptionPage.tsx
    if (purchasedSubscriptionId === "vibe_launch_co_pilot_intro") {
      userUpdatePayload.role = "co_pilot_subscriber"; // Example role
      userUpdatePayload.status = "active_paid"; // Example status
    } else if (purchasedSubscriptionId === "qbi_matrix_mastery_wowtro") {
      userUpdatePayload.role = "qbi_master"; // Example role
      userUpdatePayload.status = "active_premium"; // Example status
    }
    // Note: The free tier "cyber_initiate_free_demo" doesn't involve payment,
    // so it won't come through this webhook. Its status might be set on user creation or a different trigger.

    // Special override for an "admin" price (if you still want this backdoor)
    // Be very careful with hardcoded amounts for admin status.
    // It's better to have a separate, secure way to grant admin rights.
    if (totalAmount === 420 && purchasedSubscriptionId === "qbi_matrix_mastery_wowtro") { // Example: 420 XTR for QBI makes admin
      logger.warn(`[SubscriptionHandler] Admin override triggered for user ${userId} with amount 420 XTR on QBI plan.`);
      userUpdatePayload.role = "admin";
      userUpdatePayload.status = "admin";
    }

    const { error: updateUserError } = await supabase
      .from("users")
      .update(userUpdatePayload)
      .eq("user_id", userId);

    if (updateUserError) {
      logger.error(`[SubscriptionHandler] Failed to update user ${userId} with subscription ${purchasedSubscriptionId}:`, updateUserError);
      await sendTelegramMessage(
        telegramToken,
        `⚠️ Произошла ошибка при обновлении вашей CyberVibe OS до "${purchasedSubscriptionName}". Пожалуйста, свяжитесь с поддержкой, указав ID транзакции: ${invoice.id}`,
        [], undefined, userId
      );
      await sendTelegramMessage(
        telegramToken,
        `🚫 ОШИБКА ОБНОВЛЕНИЯ ПОЛЬЗОВАТЕЛЯ ${userId} после оплаты подписки ${purchasedSubscriptionId} (${purchasedSubscriptionName}). Инвойс: ${invoice.id}. Ошибка: ${updateUserError.message}`,
        [], undefined, adminChatId
      );
      return; // Stop if user update fails
    }

    logger.log(`[SubscriptionHandler] User ${userId} successfully upgraded to subscription: ${purchasedSubscriptionName} (ID: ${purchasedSubscriptionId}). Role/Status may also be updated.`);

    // Notify user of successful upgrade
    await sendTelegramMessage(
      telegramToken,
      `🎉 VIBE Активирован! Ваша CyberVibe OS успешно обновлена до уровня: "${purchasedSubscriptionName}"! Погружайтесь в новые возможности, Агент!`,
      [],
      undefined,
      userId
    );

    // Notify admin of successful upgrade
    await sendTelegramMessage(
      telegramToken,
      `🔔 Апгрейд! Пользователь ${userData.username || userId} (${userId}) успешно обновил CyberVibe OS до: "${purchasedSubscriptionName}" (Сумма: ${totalAmount} XTR).`,
      [],
      undefined,
      adminChatId
    );
  },
};