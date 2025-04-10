// /app/webhook-handlers/disable-dummy-mode.ts
import { WebhookHandler } from "./types";
import { sendTelegramMessage, notifyAdmin } from "../actions"; // Import from main actions
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from '@/hooks/supabase'; // Direct import for admin client
import type { Database } from "@/types/database.types"; // Import Database type if needed for metadata

// Type alias for Supabase User Row for clarity
type User = Database["public"]["Tables"]["users"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

export const disableDummyModeHandler: WebhookHandler = {
  // Check only the invoice type from the DB record passed by the proxy
  canHandle: (invoice: Invoice | null | undefined) => {
    const can = invoice?.type === "disable_dummy_mode";
    debugLogger.log(`[DisableDummyModeHandler] canHandle check: invoice.type=${invoice?.type}, result=${can}`);
    return can;
  },

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    // Note: `userId` here is the ID of the user who *paid* the invoice (the requester).
    // The target user ID needs to be retrieved from the invoice metadata.
    const requesterUserId = userId;
    const requesterUsername = userData?.username || requesterUserId;

    debugLogger.log(`[DisableDummyModeHandler] Handling successful payment for disable_dummy_mode. Invoice ID: ${invoice.id}, Requester: ${requesterUserId}, Amount: ${totalAmount} XTR`);

    // Validate essential data
    if (!invoice || !invoice.metadata) {
        logger.error(`[DisableDummyModeHandler] Critical error: Invoice or metadata missing for ID ${invoice?.id}. Cannot process.`);
        await notifyAdmin(`🚨 Критическая ошибка: Не найдены данные инвойса ${invoice?.id} для отключения Dummy Mode.`);
        return; // Stop processing
    }

    // Extract target user ID from metadata (ensure it was stored correctly during invoice creation)
    const targetUserId = invoice.metadata.target_user_id as string | undefined;
     const targetUsername = invoice.metadata.target_username as string | undefined; // Get username if stored

    if (!targetUserId) {
        logger.error(`[DisableDummyModeHandler] Critical error: target_user_id missing in metadata for invoice ${invoice.id}.`);
        await notifyAdmin(`🚨 Критическая ошибка: Отсутствует target_user_id в инвойсе ${invoice.id} (отключение Dummy Mode). Платеж от ${requesterUsername}.`);
        // Optionally, notify the requester about the issue?
        await sendTelegramMessage(
            `⚠️ Возникла проблема с вашим платежом (${invoice.id}). Не удалось определить пользователя для отключения Dummy Mode. Свяжитесь с поддержкой.`,
            [], undefined, requesterUserId
        );
        return; // Stop processing
    }

     logger.info(`[DisableDummyModeHandler] Processing disable dummy mode for target user: ${targetUserId} (requested by ${requesterUserId})`);

    try {
      // 1. Fetch the target user's current metadata to merge safely
      const { data: targetUserData, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('metadata, username, full_name') // Select name for logs
        .eq('user_id', targetUserId)
        .single(); // Target user must exist

      if (fetchError || !targetUserData) {
        logger.error(`[DisableDummyModeHandler] Failed to fetch target user ${targetUserId} data:`, fetchError);
         await notifyAdmin(`⚠️ Ошибка отключения Dummy Mode! Не удалось найти целевого пользователя ${targetUserId} после оплаты ${invoice.id} (запросил ${requesterUsername}). Ошибка: ${fetchError?.message}`);
         await sendTelegramMessage(
            `⚠️ Не удалось применить отключение Dummy Mode: пользователь ${targetUsername || targetUserId} не найден. Пожалуйста, свяжитесь с поддержкой (инвойс ${invoice.id}).`,
             [], undefined, requesterUserId
         );
        // Consider refund? For now, just log and notify.
        return;
      }

      // 2. Update target user's metadata to disable dummy mode permanently
      const currentMetadata = targetUserData.metadata || {};
      // Check if already disabled (redundant check, but safe)
      if (currentMetadata.is_dummy_mode_disabled_by_parent === true) {
          logger.warn(`[DisableDummyModeHandler] Target user ${targetUserId} already had Dummy Mode disabled. Metadata unchanged.`);
          // Notify requester and admin that it was already done.
           await sendTelegramMessage(
               `💡 Режим подсказок для пользователя ${targetUserData.username || targetUserId} уже был отключен ранее. Ваш платеж (${invoice.id}) подтвержден.`,
               [], undefined, requesterUserId
           );
           await notifyAdmin(`ℹ️ Повторная оплата отключения Dummy Mode для ${targetUserData.username || targetUserId} (инвойс ${invoice.id}, запросил ${requesterUsername}). Статус уже был отключен.`);
           return; // Success, but no change needed
      }

      const updatedMetadata = {
        ...currentMetadata,
        is_dummy_mode_disabled_by_parent: true, // Set the flag
        disabled_by: requesterUserId, // Optional: record who disabled it
        disabled_at: new Date().toISOString(), // Optional: record when
      };

      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({ metadata: updatedMetadata })
        .eq("user_id", targetUserId);

      if (updateError) {
        logger.error(`[DisableDummyModeHandler] Failed to update metadata for target user ${targetUserId}:`, updateError);
        await notifyAdmin(`⚠️ Ошибка отключения Dummy Mode! Не удалось обновить метаданные пользователя ${targetUserData.username || targetUserId} после оплаты ${invoice.id} (запросил ${requesterUsername}). Ошибка: ${updateError.message}`);
         await sendTelegramMessage(
            `⚠️ Возникла проблема с применением отключения Dummy Mode для ${targetUserData.username || targetUserId} после оплаты (инвойс ${invoice.id}). Пожалуйста, свяжитесь с поддержкой.`,
             [], undefined, requesterUserId
         );
        // Don't throw, payment was successful, but the action failed. Needs admin intervention.
      } else {
        debugLogger.log(`[DisableDummyModeHandler] Target user ${targetUserId} metadata updated successfully. Dummy Mode permanently disabled.`);

        // 3. Notify the user (Parent/Requester) who paid
        await sendTelegramMessage(
            `✅ Оплата подтверждена! ✨ Режим подсказок для пользователя **${targetUserData.username || targetUserId}** теперь постоянно отключен.`,
            [], // Optional: Add button to go back to tests or settings?
            undefined,
            requesterUserId // Notify the user who paid
        );

        // 4. Notify the admin (using dedicated function)
        await notifyAdmin(
          `💰 Пользователь ${requesterUsername} (${requesterUserId}) оплатил ОТКЛЮЧЕНИЕ Режима Подсказок для **${targetUserData.username || targetUserId}**! Сумма: ${totalAmount} XTR (Инвойс: ${invoice.id}).`
        );
      }

    } catch (error) {
      logger.error(`[DisableDummyModeHandler] Unexpected error processing Disable Dummy Mode payment for invoice ${invoice.id}:`, error);
      await notifyAdmin(
        `🚨 Критическая ошибка при обработке платежа ${invoice.id} (отключение Dummy Mode для ${targetUserId}, запросил ${requesterUsername}). Детали: ${error instanceof Error ? error.message : String(error)}`
      );
       await sendTelegramMessage(
           `🆘 Произошла критическая ошибка при обработке вашего платежа ${invoice.id}. Мы уже уведомлены и разбираемся. Свяжитесь с поддержкой, если проблема не решится.`,
           [], undefined, requesterUserId
       );
    }
  },
};