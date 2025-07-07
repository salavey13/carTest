import { logger } from "@/lib/logger";
import { startCommand, handleStartCallback } from "./start";
import { rageCommand } from "./rage";
import { leadsCommand } from "./leads";
import { sauceCommand } from "./sauce";
import { fileCommand } from "./file";
import { offerCommand } from "./offer";
import { howtoCommand } from "./howto";
import { ctxCommand } from "./ctx";
import { profileCommand } from "./profile";
import { sendTelegramMessage } from "@/app/actions"; // We need this for the default case

/**
 * The main router for all incoming updates from the Telegram webhook.
 * It distinguishes between text commands and callback queries and routes them accordingly.
 * @param update The full update object from Telegram.
 */
export async function handleCommand(update: any) {
  
  // --- Case 1: User sends a text message (usually a command) ---
  if (update.message?.text) {
    const text: string = update.message.text;
    const chatId: number = update.message.chat.id;
    const userId: number = update.message.from.id;
    const username: string | undefined = update.message.from.username;

    logger.info(`[Command Handler] Received text command: '${text}' from User ID: ${userId}`);

    // Create a command map for clean routing
    const commandMap: { [key: string]: Function } = {
      "/start": () => startCommand(chatId, userId, username),
      "/rage": () => rageCommand(chatId, userId),
      "/leads": () => leadsCommand(chatId, userId),
      "/sauce": () => sauceCommand(chatId, userId),
      "/file": () => fileCommand(chatId, userId),
      "/offer": () => offerCommand(chatId, userId),
      "/howto": () => howtoCommand(chatId, userId),
      "/ctx": () => ctxCommand(chatId, userId),
      "/profile": () => profileCommand(chatId, userId, username),
    };

    const command = text.split(' ')[0].toLowerCase(); // Get the base command
    const commandFunction = commandMap[command];

    if (commandFunction) {
      await commandFunction();
    } else {
      logger.warn(`[Command Handler] Unknown command: '${text}' from User ID: ${userId}.`);
      await sendTelegramMessage(
        "Неизвестная команда, Агент. Проверь список доступных команд или начни с /start.",
        [], undefined, String(chatId)
      );
    }
    return;
  }

  // --- Case 2: User presses an inline keyboard button (callback query) ---
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const chatId: number = callbackQuery.message.chat.id;
    const userId: number = callbackQuery.from.id;
    const username: string | undefined = callbackQuery.from.username;
    const data: string = callbackQuery.data;

    logger.info(`[Command Handler] Received callback_query: '${data}' from User ID: ${userId}`);

    // Answer the callback query to remove the "loading" state on the button
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQuery.id }),
        });
    } catch (e) {
        logger.error(`[Command Handler] Failed to answer callback query:`, e);
    }
    

    // Route callbacks based on a prefix system
    if (data.startsWith("survey_")) {
      // This is a callback from our /start survey
      await startCommand(chatId, userId, username, callbackQuery);
    } else if (data === "request_howto") {
      // This is a callback from the final message of the /start survey
      await handleStartCallback(chatId, userId, data);
    } 
    // ... Add more 'else if' blocks here for other callback types in the future ...
    else {
      logger.warn(`[Command Handler] Unhandled callback_query data: '${data}' from User ID: ${userId}.`);
    }
    return;
  }

  // --- Default Case: Unhandled update type ---
  logger.warn("[Command Handler] Received unhandled update type.", { update_id: update.update_id });
}