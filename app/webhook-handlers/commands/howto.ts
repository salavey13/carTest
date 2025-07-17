import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";

export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[HOWTO_V11_RENTAL] User ${userId} triggered /howto command.`);

  const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneSitePlsBot/app";

  const message = "Привет, гонщик! Добро пожаловать в **Paddock Protocol**. Это не просто аренда, это — твоя гоночная карьера. Вот основные точки входа в нашу экосистему:";

  // Curated buttons based on the "Trilogy" plan for the rental platform
  const buttons = [
    [
      { text: "🏍️ Арендовать Байк", url: `${botUrl}?startapp=rent-bike` },
      { text: "🏆 Таблица Лидеров", url: `${botUrl}?startapp=leaderboard` },
    ],
    [
      { text: "👥 Вступить в Экипаж", url: `${botUrl}?startapp=crews` },
      { text: "➕ Добавить свой Байк", url: `${botUrl}?startapp=admin` },
    ],
  ];

  try {
    const result = await sendComplexMessage(
      chatId,
      message,
      buttons,
      "motorcycle, neon, city, night, racing" // Updated image query for relevance
    );
    
    if (!result.success) {
      throw new Error(result.error || "Unknown error sending message.");
    }
    
    logger.info(`[HOWTO_V11_RENTAL] Rental-focused interactive guide sent successfully to user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO_V11_RENTAL] Failed to send interactive guide:", error);
    await sendComplexMessage(
        chatId,
        "🚨 Не удалось отправить инструктаж. Сервера, возможно, на перезарядке. Попробуй позже."
    );
  }
}