import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

export async function rageCommand(chatId: number, userId: number) {
 logger.info(`[Rage Command] User ${userId} triggered the /rage command.`);
 await sendTelegramMessage("Rage command received! Opportunities check coming soon...", [], undefined, chatId.toString());
}
