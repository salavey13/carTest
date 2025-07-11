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
import { simCommand } from "./sim"; // <-- НОВАЯ КОМАНДА
import { simGoCommand } from "./sim_go"; // <-- ОБНОВЛЕННАЯ КОМАНДА

export async function handleCommand(update: any) {
  if (update.message?.text) {
    const text: string = update.message.text;
    const chatId: number = update.message.chat.id;
    const userIdStr = String(update.message.from.id);
    const username: string | undefined = update.message.from.username;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    logger.info(`[Command Handler] Received: '${text}' from User: ${userIdStr}`);

    const commandMap: { [key: string]: Function } = {
      "/start": () => startCommand(chatId, Number(userIdStr), username, text),
      "/help": () => helpCommand(chatId, Number(userIdStr)),
      "/rage": () => rageCommand(chatId, Number(userIdStr)),
      "/settings": () => rageSettingsCommand(chatId, Number(userIdStr), text),
      "/sim": () => simCommand(chatId, userIdStr, args), // <-- НОВЫЙ /sim
      "/sim_god": () => simCommand(chatId, userIdStr, args), // <-- Алиас для обратной совместимости
      "/sim_go": () => simGoCommand(chatId, userIdStr, args), // <-- ОБНОВЛЕННЫЙ /sim_go
      "/leads": () => leadsCommand(chatId, Number(userIdStr)),
      "/sauce": () => sauceCommand(chatId, Number(userIdStr)),
      "/file": () => fileCommand(chatId, Number(userIdStr), args),
      "/offer": () => offerCommand(chatId, Number(userIdStr)),
      "/howto": () => howtoCommand(chatId, Number(userIdStr)),
      "/ctx": () => ctxCommand(chatId, Number(userIdStr)),
      "/profile": () => profileCommand(chatId, Number(userIdStr), username),
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
