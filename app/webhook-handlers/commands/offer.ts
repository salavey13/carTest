import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function offerCommand(chatId: number, userId: number) {
  logger.info(`[Offer Command] User ${userId} triggered the /offer command.`);
  await sendTelegramMessage("Offer command received! Generating offer prompt...", [], undefined, chatId.toString());
}