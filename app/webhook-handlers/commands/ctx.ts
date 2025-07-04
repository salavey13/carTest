import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function ctxCommand(chatId: number, userId: number) {
  logger.info(`[Ctx Command] User ${userId} triggered the /ctx command.`);
  await sendTelegramMessage("Ctx command received!  Retrieving the whole context as one big ass file...", [], undefined, chatId.toString());
}