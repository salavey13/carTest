import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function profileCommand(chatId: number, userId: number, username:string | undefined) {
  logger.info(`[Profile Command] User ${userId} (${username}) triggered the /profile command.`);
  
  const botUsername = process.env.BOT_USERNAME || 'oneSitePlsBot';
  const profileLink = `https://t.me/${botUsername}/app?startapp=profile`;

  const message = `Агент, твой кибернетический профиль готов к просмотру. Здесь ты найдешь свою статистику, достижения и перки.\n\n[Открыть Профиль](${profileLink})`;
  await sendTelegramMessage(message, [], undefined, chatId.toString(), undefined, 'Markdown');
}