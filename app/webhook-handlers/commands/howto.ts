import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";
import { sendComplexMessage } from "../actions/sendComplexMessage"; // Import our new action

export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[HOWTO_V7_RICH] User ${userId} triggered /howto command.`);

  const baseUrl = getBaseUrl();
  const message = "Агент, вот твои основные инструктажи. Выбери нужный раздел, чтобы погрузиться в Vibe:";
  
  // The button structure is now a 2D array, as expected by the Telegram API
  const buttons = [
    [ { text: "📜 Нейро-Кухня (Создание)", url: `${baseUrl}/nutrition` } ],
    [ { text: "🇯🇲 Гайд Растодева (Основы)", url: `${baseUrl}/rastabot` } ],
    [ { text: "🧠 Арбитраж: Deep Dive", url: `${baseUrl}/arbitrage-notdummies` } ]
  ];

  try {
    // Send the message with buttons AND a cool image
    const result = await sendComplexMessage(
      chatId,
      message,
      buttons,
      "library ancient scroll" // Image query for Unsplash
    );

    if (!result.success) {
      throw new Error(result.error || "Unknown error sending message with buttons.");
    }
    
    logger.info(`[HOWTO_V7_RICH] Rich guide sent successfully to user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO_V7_RICH] Failed to send rich guide:", error);
    // Fallback message if something goes wrong
    await sendComplexMessage(
        chatId,
        "🚨 Не удалось отправить инструктаж. Сервера, возможно, на перезарядке. Попробуй позже."
    );
  }
}