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
import { simCommand } from "./sim"; 
import { simGoCommand } from "./sim_go";
import { seedMarketCommand } from "./seed_market"; // <-- НОВАЯ КОМАНДА

export async function handleCommand(update: any) {
  if (update.message?.text) {
    const text: string = update.message.text;
    const chatId: number = update.message.chat.id;
    const userId: number = update.message.from.id;
    const userIdStr = String(userId); 
    const username: string | undefined = update.message.from.username;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    logger.info(`[Command Handler] Received: '${text}' from User: ${userIdStr}`);

    const commandMap: { [key: string]: Function } = {
      "/start": () => startCommand(chatId, userId, username, text),
      "/help": () => helpCommand(chatId, userId),
      "/rage": () => rageCommand(chatId, userId),
      "/settings": () => rageSettingsCommand(chatId, userId, text),
      "/sim": () => simCommand(chatId, userIdStr, args),
      "/sim_god": () => simCommand(chatId, userIdStr, args), 
      "/sim_go": () => simGoCommand(chatId, userIdStr, args),
      "/seed_market": () => seedMarketCommand(chatId, userIdStr), // <-- НОВАЯ КОМАНДА
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
  
  // ... (остальная часть файла без изменений)
}