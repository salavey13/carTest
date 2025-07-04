import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function leadsCommand(chatId: number, userId: number) {
  logger.info(`[Leads Command] User ${userId} triggered the /leads command.`);
  await sendTelegramMessage("Leads command received! Top hottest/recent leads are coming soon...", [], undefined, chatId.toString());
}