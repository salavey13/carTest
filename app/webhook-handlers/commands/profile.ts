import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function profileCommand(chatId: number, userId: number, username:string | undefined) {
  logger.info(`[Profile Command] User ${userId} (${username}) triggered the /profile command.`);

  const profileLink = `t.me/oneSitePlsBot/app?startapp=profile`;
  const message = `Profile command received!  \nYour profile link: ${profileLink}\nStats coming soon...`;
  await sendTelegramMessage(message, [], undefined, chatId.toString());
}