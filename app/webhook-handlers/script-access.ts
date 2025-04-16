import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { logger } from "@/lib/logger"; // Added logger

export const scriptAccessHandler: WebhookHandler = {
  // Ensure canHandle checks specifically for 'script_access' type
  canHandle: (invoice) => invoice.type === "script_access",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
     logger.log(`[ScriptAccessHandler] Handling script access purchase for user ${userId}.`);
    try {
        const { error: updateError } = await supabase
          .from("users")
          .update({ has_script_access: true })
          .eq("user_id", userId);

        if (updateError) {
            logger.error(`[ScriptAccessHandler] Error updating user ${userId} access:`, updateError);
            throw updateError; // Re-throw to be caught by the main proxy handler
        }
        logger.log(`[ScriptAccessHandler] Updated user ${userId} access successfully.`);

        const scripts = [
          { name: "Block'em All", url: "https://automa.app/marketplace/blockemall" },
          { name: "Purge'em All", url: "https://automa.app/marketplace/purgeemall" },
          { name: "Hunter", url: "https://automa.app/marketplace/hunter" },
        ];

        const message =
          "Спасибо за покупку Automa Bot-Hunting Scripts! 🏹 Вот ваши ссылки:\n" +
          scripts.map((script) => `- [${script.name}](${script.url})`).join("\n") +
          "\n\nИнструкции и поддержка в @automahq.";

        await sendTelegramMessage(
          telegramToken,
          message,
          [],
          undefined,
          userId
        );
        logger.log(`[ScriptAccessHandler] Sent script links to user ${userId}.`);

        await sendTelegramMessage(
          telegramToken,
          `🔔 Пользователь ${userData.username || userData.user_id} (${userId}) приобрел доступ к Automa скриптам!`,
          [],
          undefined,
          adminChatId
        );
        logger.log(`[ScriptAccessHandler] Notified admin about script access purchase for user ${userId}.`);

    } catch (error) {
         logger.error(`[ScriptAccessHandler] Error processing script access for user ${userId}:`, error);
         // Optional: Send error message to user? Maybe not necessary.
         // Re-throw the error so the main proxy handler logs it and notifies admin about the processing failure.
         throw error;
    }
  },
};