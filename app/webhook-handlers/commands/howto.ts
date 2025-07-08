import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[HOWTO_V10_FINAL] User ${userId} triggered /howto command.`);

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
      "library, futuristic, neon" // Image query for Unsplash
    );
    
    if (!result.success) {
      throw new Error(result.error || "Unknown error sending message.");
    }
    
    logger.info(`[HOWTO_V10_FINAL] Interactive guide sent successfully to user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO_V10_FINAL] Failed to send interactive guide:", error);
    await sendComplexMessage(
        chatId,
        "🚨 Не удалось отправить инструктаж. Сервера, возможно, на перезарядке. Попробуй позже."
    );
  }
}