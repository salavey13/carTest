import { logger } from "@/lib/logger";
import { startCommand } from "./start";
import { rageCommand } from "./rage";
import { leadsCommand } from "./leads";
import { sauceCommand } from "./sauce";
import { fileCommand } from "./file";
import { offerCommand } from "./offer";
import { howtoCommand } from "./howto";
import { ctxCommand } from "./ctx";
import { profileCommand } from "./profile";
import { helpCommand } from "./help";
import { rageSettingsCommand } from "./rageSettings"; // New import
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";

/**
 * The main router for all incoming updates from the Telegram webhook.
 */
export async function handleCommand(update: any) {
  
  if (update.message?.text) {
    const text: string = update.message.text;
    const chatId: number = update.message.chat.id;
    const userId: number = update.message.from.id;
    const username: string | undefined = update.message.from.username;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    logger.info(`[Command Handler] Received text: '${text}' from User ID: ${userId}`);

    const commandMap: { [key: string]: Function } = {
      "/start": () => startCommand(chatId, userId, username, text),
      "/help": () => helpCommand(chatId, userId),
      "/rage": () => rageCommand(chatId, userId),
      "/settings": () => rageSettingsCommand(chatId, userId, text), // Route /settings to the new handler
      "/leads": () => leadsCommand(chatId, userId),
      "/sauce": () => sauceCommand(chatId, userId),
      "/file": () => fileCommand(chatId, userId, args),
      "/offer": () => offerCommand(chatId, userId),
      "/howto": () => howtoCommand(chatId, userId),
      "/ctx": () => ctxCommand(chatId, userId),
      "/profile": () => profileCommand(chatId, userId, username),
    };
    
    const commandFunction = commandMap[command];

    if (commandFunction) {
      await commandFunction();
    } else {
      // Check for rage settings commands
      if (text.startsWith('Set Spread') || text.startsWith('Toggle') || text === 'Done') {
          await rageSettingsCommand(chatId, userId, text);
          return;
      }

      // Check for active survey
      const { data: activeSurvey } = await supabaseAdmin.from("user_survey_state").select('user_id').eq('user_id', String(userId)).maybeSingle();
      if (activeSurvey) {
        logger.info(`[Command Handler] Text is not a command, routing to survey handler for user ${userId}`);
        await startCommand(chatId, userId, username, text);
      } else {
        logger.warn(`[Command Handler] Unknown command and no active survey for user ${userId}. Text: '${text}'`);
        await sendComplexMessage(chatId, "Неизвестная команда, Агент. Используй /help, чтобы увидеть список доступных директив.", []);
      }
    }
    return;
  }

  // NOTE: Callback query handling is left here for future use
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const chatId: number = callbackQuery.message.chat.id;
    const userId: number = callbackQuery.from.id;
    const data: string = callbackQuery.data;

    logger.info(`[Command Handler] Received callback_query: '${data}' from User ID: ${userId}`);
    
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: callbackQuery.id }), });
    } catch (e) {
        logger.error(`[Command Handler] Failed to answer callback query:`, e);
    }
    
    if (data === "request_howto") {
      await howtoCommand(chatId, userId, callbackQuery.message?.message_id);
    } else {
      logger.warn(`[Command Handler] Unhandled callback_query data: '${data}' from User ID: ${userId}.`);
    }
    return;
  }

  logger.warn("[Command Handler] Received unhandled update type.", { update_id: update.update_id });
}