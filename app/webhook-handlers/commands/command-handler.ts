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
import { rageSettingsCommand } from "./rageSettings";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
// НОВЫЕ ИМПОРТЫ
import { simGodCommand } from "./sim_god";
import { simGoCommand } from "./sim_go";

/**
 * The main router for all incoming updates from the Telegram webhook.
 */
export async function handleCommand(update: any) {
  
  // --- Text Message Handling ---
  if (update.message?.text) {
    const text: string = update.message.text;
    const chatId: number = update.message.chat.id;
    const userId: number = update.message.from.id;
    const userIdStr = String(userId); // Используем строковый ID для консистентности
    const username: string | undefined = update.message.from.username;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    logger.info(`[Command Handler] Received text: '${text}' from User ID: ${userId}`);

    const commandMap: { [key: string]: Function } = {
      "/start": () => startCommand(chatId, userId, username, text),
      "/help": () => helpCommand(chatId, userId),
      "/rage": () => rageCommand(chatId, userId),
      "/settings": () => rageSettingsCommand(chatId, userId, text),
      "/leads": () => leadsCommand(chatId, userId),
      "/sauce": () => sauceCommand(chatId, userId),
      "/file": () => fileCommand(chatId, userId, args),
      "/offer": () => offerCommand(chatId, userId),
      "/howto": () => howtoCommand(chatId, userId),
      "/ctx": () => ctxCommand(chatId, userId),
      "/profile": () => profileCommand(chatId, userId, username),
      // НОВЫЕ КОМАНДЫ
      "/sim_god": () => simGodCommand(chatId, userIdStr, args),
      "/sim_go": () => simGoCommand(chatId, userIdStr, args),
    };
    
    const commandFunction = commandMap[command];

    if (commandFunction) {
      await commandFunction();
    } else {
      if (text.startsWith('Set Spread') || text.startsWith('Toggle') || text === 'Done') {
          await rageSettingsCommand(chatId, userId, text);
          return;
      }

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

  // --- Callback Query Handling ---
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const chatId: number = callbackQuery.message.chat.id;
    const userId: number = callbackQuery.from.id;
    const data: string = callbackQuery.data;

    logger.info(`[Command Handler] Received callback_query: '${data}' from User ID: ${userId}`);
    
    // Always answer the callback query to remove the loading state on the button
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: callbackQuery.id }), });
    } catch (e) {
        logger.error(`[Command Handler] Failed to answer callback query:`, e);
    }
    
    if (data === "request_howto") {
      await howtoCommand(chatId, userId, callbackQuery.message?.message_id);
    } else if (data === "rage_settings_prompt") {
      // Trigger the settings command with the specific sub-command text
      await rageSettingsCommand(chatId, userId, "/settings rage");
    } else {
      logger.warn(`[Command Handler] Unhandled callback_query data: '${data}' from User ID: ${userId}.`);
    }
    return;
  }

  logger.warn("[Command Handler] Received unhandled update type.", { update_id: update.update_id });
}