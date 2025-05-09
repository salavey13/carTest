import { WebhookHandler } from "./types";
import { sendTelegramMessage, notifyAdmin } from "../actions"; 
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger"; // This logger is for server-side/build logs
import { supabaseAdmin } from '@/hooks/supabase'; 
import type { Database } from "@/types/database.types"; 

type User = Database["public"]["Tables"]["users"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

export const disableDummyModeHandler: WebhookHandler = {
  canHandle: (invoice: Invoice | null | undefined) => {
    const can = invoice?.type === "disable_dummy_mode";
    debugLogger.log(`[DisableDummyModeHandler] canHandle check: invoice.type=${invoice?.type}, result=${can}`);
    return can;
  },

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const requesterUserId = userId;
    const requesterUsername = userData?.username || requesterUserId;

    debugLogger.log(`[DisableDummyModeHandler] Handling successful payment for disable_dummy_mode. Invoice ID: ${invoice.id}, Requester: ${requesterUserId}, Amount: ${totalAmount} XTR`);

    if (!invoice || !invoice.metadata) {
        logger.error(`[DisableDummyModeHandler] Critical error: Invoice or metadata missing for ID ${invoice?.id}. Cannot process.`);
        await notifyAdmin(`🚨 Критическая ошибка: Не найдены данные инвойса ${invoice?.id} для отключения Dummy Mode.`);
        return; 
    }

    const targetUserId = invoice.metadata.target_user_id as string | undefined;
    const targetUsername = invoice.metadata.target_username as string | undefined; 

    if (!targetUserId) {
        logger.error(`[DisableDummyModeHandler] Critical error: target_user_id missing in metadata for invoice ${invoice.id}.`);
        await notifyAdmin(`🚨 Критическая ошибка: Отсутствует target_user_id в инвойсе ${invoice.id} (отключение Dummy Mode). Платеж от ${requesterUsername}.`);
        await sendTelegramMessage(
            `⚠️ Возникла проблема с вашим платежом (${invoice.id}). Не удалось определить пользователя для отключения Dummy Mode. Свяжитесь с поддержкой.`,
            [], undefined, requesterUserId
        );
        return; 
    }

    logger.info(`[DisableDummyModeHandler] Processing disable dummy mode for target user: ${targetUserId} (requested by ${requesterUserId})`);

    try {
      const { data: targetUserData, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('metadata, username, full_name') 
        .eq('user_id', targetUserId)
        .single(); 

      if (fetchError || !targetUserData) {
        logger.error(`[DisableDummyModeHandler] Failed to fetch target user ${targetUserId} data:`, fetchError);
         await notifyAdmin(`⚠️ Ошибка отключения Dummy Mode! Не удалось найти целевого пользователя ${targetUserId} после оплаты ${invoice.id} (запросил ${requesterUsername}). Ошибка: ${fetchError?.message}`);
         await sendTelegramMessage(
            `⚠️ Не удалось применить отключение Dummy Mode: пользователь ${targetUsername || targetUserId} не найден. Пожалуйста, свяжитесь с поддержкой (инвойс ${invoice.id}).`,
             [], undefined, requesterUserId
         );
        return;
      }

      const currentMetadata = targetUserData.metadata || {};
      if (currentMetadata.is_dummy_mode_disabled_by_parent === true) {
          logger.warn(`[DisableDummyModeHandler] Target user ${targetUserId} already had Dummy Mode disabled. Metadata unchanged.`);
           await sendTelegramMessage(
               `💡 Режим подсказок для пользователя ${targetUserData.username || targetUserId} уже был отключен ранее. Ваш платеж (${invoice.id}) подтвержден.`,
               [], undefined, requesterUserId
           );
           await notifyAdmin(`ℹ️ Повторная оплата отключения Dummy Mode для ${targetUserData.username || targetUserId} (инвойс ${invoice.id}, запросил ${requesterUsername}). Статус уже был отключен.`);
           return; 
      }

      const updatedMetadata = {
        ...currentMetadata,
        is_dummy_mode_disabled_by_parent: true, 
        disabled_by: requesterUserId, 
        disabled_at: new Date().toISOString(), 
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
      } else {
        debugLogger.log(`[DisableDummyModeHandler] Target user ${targetUserId} metadata updated successfully. Dummy Mode permanently disabled.`);

        await sendTelegramMessage(
            `✅ Оплата подтверждена! ✨ Режим подсказок для пользователя **${targetUserData.username || targetUserId}** теперь постоянно отключен.`,
            [], 
            undefined,
            requesterUserId 
        );

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