import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { logger } from "@/lib/logger"; // Added logger

export const supportHandler: WebhookHandler = {
    // Checks if payload starts with "support_" prefix
    canHandle: (invoice, payload) => typeof payload === 'string' && payload.startsWith("support_"),

    handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
        logger.log(`[SupportHandler] Handling support payment for user ${userId}. Invoice:`, invoice);

        // Ensure description exists, provide fallback
        const description = invoice?.description || invoice?.metadata?.description || "Описание не указано"; // Get description from invoice or metadata
        logger.log(`[SupportHandler] Support description: ${description}`);

        try {
            // Notify admin
            await sendTelegramMessage(
                telegramToken,
                `🔔 Новая оплаченная заявка на поддержку!\nСумма: ${totalAmount} XTR\nОт: ${userData.username || userData.user_id} (${userId})\nОписание: ${description}`,
                [],
                undefined,
                adminChatId
            );
            logger.log(`[SupportHandler] Notified admin about support request from user ${userId}.`);

            // Notify user
            await sendTelegramMessage(
                telegramToken,
                "Спасибо за оплату! 🙏 Ваша заявка на поддержку принята, скоро свяжусь с вами.",
                [],
                undefined,
                userId
            );
            logger.log(`[SupportHandler] Sent confirmation to user ${userId}.`);

        } catch (error) {
            logger.error(`[SupportHandler] Error processing support payment for user ${userId}:`, error);
            // Re-throw error to be handled by the main proxy handler
            throw error;
        }
    },
};