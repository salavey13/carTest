import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function sauceCommand(chatId: number, userId: number) {
  logger.info(`[Sauce Command] User ${userId} triggered the /sauce command.`);
  await sendTelegramMessage("Sauce command received! System prompt/leadgen/psycho features in development...", [], undefined, chatId.toString());
}