import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

/**
 * Handles the /howto command by sending a message with navigation buttons
 * to the relevant guide pages and a deep link to the arbitrage app.
 * @param chatId The chat ID to send the message to.
 * @param userId The ID of the user who triggered the command.
 */
export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[HOWTO_V8_FINAL] User ${userId} triggered /howto command.`);

  const baseUrl = getBaseUrl();

  const message = "Агент, вот твои основные **интерактивные инструктажи**. Выбери нужный раздел, чтобы погрузиться в Vibe и начать свою первую миссию:";

  // Using a 2x2 grid for better mobile experience
  const buttons = [
    [ // Row 1
      { text: "🚀 Миссия 1: Замена Картинки", url: `${baseUrl}/tutorials/image-swap` },
      { text: "💣 Миссия 2: Разминирование Иконок", url: `${baseUrl}/tutorials/icon-swap` },
    ],
    [ // Row 2
      { text: "🧠 Нейро-Кухня (Создание)", url: `${baseUrl}/nutrition` },
      { text: "🇯🇲 Гайд Растодева (Основы)", url: `${baseUrl}/rastabot` },
    ],
    [ // Row 3: The Arbitrage Hub deep link
      { text: "💸 Арбитраж-Хаб (Симуляторы)", url: `https://t.me/oneSitePlsBot/app?startapp=elon` }
    ]
  ];

  try {
    await sendTelegramMessage(
      message,
      buttons,
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250624_022941_951-e1a38f36-963e-4251-8d26-72eb98b98b9a.png",
      String(chatId),
      undefined,
      'Markdown'
    );
    
    logger.info(`[HOWTO_V8_FINAL] Interactive guide sent successfully to user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO_V8_FINAL] Failed to send interactive guide:", error);
    await sendTelegramMessage(
        "🚨 Не удалось отправить инструктаж. Попробуй позже.",
        [], undefined, String(chatId)
    );
  }
}