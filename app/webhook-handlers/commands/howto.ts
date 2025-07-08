import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

export async function howtoCommand(chatId: number, userId: number, messageId?: number) {
  logger.info(`[HOWTO] User ${userId} triggered /howto. MessageID: ${messageId || 'N/A'}`);

  const baseUrl = getBaseUrl();

  const message = "Агент, вот твои основные **интерактивные инструктажи**. Выбери нужный раздел, чтобы погрузиться в Vibe и начать свою первую миссию:";

  const buttons = [
    [
      { text: "🚀 Миссии (Начать здесь!)", url: `${baseUrl}/start-training` },
      { text: "🇯🇲 Гайд Растодева (Основы)", url: `${baseUrl}/rastabot` },
    ],
    [
      { text: "🧠 Нейро-Кухня (Создание)", url: `${baseUrl}/nutrition` },
      { text: "💸 Арбитраж: Deep Dive", url: `${baseUrl}/arbitrage-notdummies` },
    ],
    [
      { text: "🛠️ В SUPERVIBE Studio", url: `${baseUrl}/repo-xml` },
      { text: "✨ Гайд по Стилю", url: `${baseUrl}/style-guide` },
    ],
  ];

  try {
    const result = await sendComplexMessage(
      chatId,
      message,
      buttons,
      // Only fetch a new image if we are sending a new message, not editing.
      messageId ? undefined : "library, futuristic, neon",
      messageId // Pass the messageId to edit the existing message.
    );
    
    if (!result.success) {
      throw new Error(result.error || "Unknown error sending/editing message.");
    }
    
    logger.info(`[HOWTO] Guide ${messageId ? 'edited' : 'sent'} successfully for user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO] Failed to send/edit interactive guide:", error);
    // Avoid sending an error message if the primary action failed, as it might also fail.
  }
}