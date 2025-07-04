import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[Howto Command] User ${userId} triggered the /howto command.`);
  await sendTelegramMessage("Howto command received!  Fetching PDF with howto + prompt + context...", [], undefined, chatId.toString());
}