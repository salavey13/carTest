import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions"; // Import from main actions
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; // Import logger for consistency
import { supabaseAdmin } from '@/hooks/supabase'
import type { Database } from "@/types/database.types"; // Import Database type







export const disableDummyModeHandler: WebhookHandler = {
  canHandle: (invoice, payload) => {
    // Check both the invoice type from DB and the raw payload prefix
    const isCorrectType = invoice?.type === "disable_dummy_mode";
    const isCorrectPayload = typeof payload === 'string' && payload.startsWith("disable_dummy_");
    debugLogger.log(`[disableDummyModeHandler] Checking canHandle: type=${invoice?.type}, payload=${payload}, isCorrectType=${isCorrectType}, isCorrectPayload=${isCorrectPayload}`);
    // Rely primarily on the DB invoice type
    return isCorrectType;
  },

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    // Note: totalAmount received from proxy is already in XTR (not smallest unit)
    debugLogger.log(`[disableDummyModeHandler] Handling successful payment to DISABLE Dummy Mode. Invoice ID: ${invoice.id}, User: ${userId}, Amount: ${totalAmount} XTR`);

    try {
      // 1. Update user's metadata to disable dummy mode permanently
      // Use the passed supabase client (which is supabaseAdmin from proxy.ts)
      

      // Fetch the current metadata first to merge safely
      const { data: currentUserData, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        logger.error(`[disableDummyModeHandler] Failed to fetch user ${userId} metadata before update:`, fetchError);
        throw new Error(`Failed to fetch user metadata: ${fetchError.message}`);
      }

      // Merge new flag into existing metadata, handling null case
      const currentMetadata = currentUserData?.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        is_dummy_mode_disabled_by_parent: true,
      };

      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({ metadata: updatedMetadata })
        .eq("user_id", userId);

      if (updateError) {
        debugLogger.error(`[disableDummyModeHandler] Failed to update user ${userId} metadata to disable dummy mode:`, updateError);
        // Notify admin about the failure
        await sendTelegramMessage(
          telegramToken,
          `⚠️ Ошибка отключения Dummy Mode! Не удалось обновить метаданные пользователя ${userId} (${userData?.username || 'N/A'}) после оплаты ${invoice.id}. Ошибка: ${updateError.message}`,
          [],
          undefined,
          adminChatId
        );
        // Don't throw here, try to notify user anyway
      } else {
        debugLogger.log(`[disableDummyModeHandler] User ${userId} metadata updated successfully. Dummy Mode permanently disabled.`);
      }

      // 2. Notify the user (Parent) who paid
      await sendTelegramMessage(
        telegramToken,
        "✅ Опция отключения Режима Подсказок успешно приобретена! ✨ Возможность использовать подсказки в тестах для этого пользователя теперь отключена.",
        [], // Optional: Add button to go back to tests or settings?
        undefined,
        userId // Notify the user who paid
      );

      // 3. Notify the admin
      await sendTelegramMessage(
        telegramToken,
        `💰 Пользователь ${userData.username || userId} (${userId}) оплатил ОТКЛЮЧЕНИЕ Режима Подсказок (Dummy Mode)! Сумма: ${totalAmount} XTR.`,
        [],
        undefined,
        adminChatId
      );

    } catch (error) {
      debugLogger.error(`[disableDummyModeHandler] Error processing Disable Dummy Mode payment for invoice ${invoice.id}:`, error);
      // Send a generic error message to admin if something unexpected happened
      await sendTelegramMessage(
        telegramToken,
        `🚨 Критическая ошибка при обработке платежа на ОТКЛЮЧЕНИЕ Dummy Mode для инвойса ${invoice.id}, пользователя ${userId}. Детали: ${error instanceof Error ? error.message : String(error)}`,
        [],
        undefined,
        adminChatId
      );
    }
  },
};