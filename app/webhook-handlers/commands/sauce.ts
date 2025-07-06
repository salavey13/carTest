import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import { ULTIMATE_VIBE_MASTER_PROMPT } from '@/components/repo/prompt';

export async function sauceCommand(chatId: number, userId: number) {
  logger.info(`[Sauce Command] User ${userId} triggered the /sauce command.`);
  
  const sauceMessage = "*Секретный Соус (Системный Промпт):*\n\n" +
                       "```\n" +
                       ULTIMATE_VIBE_MASTER_PROMPT.substring(0, 3800) + // Обрезаем, чтобы влезть в лимит ТГ
                       "\n... (полный промпт в студии)\n" +
                       "```";

  await sendTelegramMessage(sauceMessage, [], undefined, chatId.toString(), undefined, "Markdown");
}