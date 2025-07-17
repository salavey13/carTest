import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";

export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[HOWTO_V12_COMBO] User ${userId} triggered /howto command.`);

  const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneSitePlsBot/app";

  const message = `Агент, это не просто платформа. Это **комбо-вомбо**: ты можешь быть **Звездой Трека** или **Архитектором Цифры**. Или и тем, и другим.

--- 🏆 **ПУТЬ ГОНЩИКА** ---
Доминируй на улицах, создавай экипажи, впиши свое имя в историю.

--- 🛠️ **ПУТЬ АРХИТЕКТОРА** ---
Создавай такие же приложения, прокачивай VIBE, стань легендой-разработчиком.

Выбери свой путь. Или пройди оба.`;

  const buttons = [
    // Racer's Path
    [
      { text: "🏍️ Арендовать Байк", url: `${botUrl}?startapp=rent-bike` },
      { text: "🏆 Таблица Лидеров", url: `${botUrl}?startapp=leaderboard` },
    ],
    [
      { text: "👥 Мои Экипажи", url: `${botUrl}?startapp=crews` },
      { text: "⛽ Мой Гараж", url: `${botUrl}?startapp=paddock` },
    ],
    // Architect's Path
    [
      { text: "📱 VIBE Studio (IDE)", url: `${botUrl}?startapp=repo-xml` },
      { text: "🚀 Прокачка (CyberDev OS)", url: `${botUrl}?startapp=start-training` },
    ],
    [
      { text: "🎨 Гайд по Стилю", url: `${botUrl}?startapp=style-guide` },
      { text: "⚙️ Настройки OS", url: `${botUrl}?startapp=settings` },
    ]
  ];

  try {
    const result = await sendComplexMessage(
      chatId,
      message,
      buttons,
      "cyberpunk motorcycle, racing, neon city, data streams, code" // Combo image query
    );
    
    if (!result.success) {
      throw new Error(result.error || "Unknown error sending message.");
    }
    
    logger.info(`[HOWTO_V12_COMBO] Combo Racer/Architect guide sent successfully to user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO_V12_COMBO] Failed to send interactive guide:", error);
    await sendComplexMessage(
        chatId,
        "🚨 Не удалось отправить инструктаж. Сервера, возможно, на перезарядке. Попробуй позже."
    );
  }
}