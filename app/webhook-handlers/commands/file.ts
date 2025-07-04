import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function fileCommand(chatId: number, userId: number) {
  logger.info(`[File Command] User ${userId} triggered the /file command.`);
  await sendTelegramMessage("File command received! Fetching file from GitHub...", [], undefined, chatId.toString());
}