import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

/**
 * Handles the /howto command by sending an interactive message with buttons
 * linking to the core guide and tutorial pages on the web app.
 * @param chatId The chat ID to send the message to.
 * @param userId The ID of the user who triggered the command.
 */
export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[HOWTO_V9_INTERACTIVE] User ${userId} triggered /howto command.`);

  const baseUrl = getBaseUrl();
  const howtoImageUrl = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250624_022941_951-e1a38f36-963e-4251-8d26-72eb98b98b9a.png"; // Your image URL

  const message = "Агент, вот твои **интерактивные инструктажи**. Выбери нужный раздел, чтобы погрузиться в Vibe и начать свою первую миссию:";

  // A more comprehensive and structured button layout
  const buttons = [
    [ // Row 1: Core Guides
      { text: "🧠 Нейро-Кухня (Создание)", url: `${baseUrl}/nutrition` },
      { text: "🇯🇲 Гайд Растодева (Основы)", url: `${baseUrl}/rastabot` },
    ],
    [ // Row 2: Training & Deep Dives
      { text: "🚀 VIBE Тренировка (Миссии)", url: `${baseUrl}/start-training` },
      { text: "💸 Арбитраж: Deep Dive", url: `${baseUrl}/arbitrage-notdummies` },
    ],
    [ // Row 3: Direct Action Link
      { text: "🛠️ В SUPERVIBE Studio", url: `${baseUrl}/repo-xml` }
    ]
  ];

  try {
    const result = await sendTelegramMessage(
      message,
      buttons,
      howtoImageUrl, // The image URL you provided
      String(chatId),
      undefined,
      'Markdown'
    );
    
    if (!result.success) {
      throw new Error(result.error || "Unknown error sending message with buttons.");
    }
    
    logger.info(`[HOWTO_V9_INTERACTIVE] Interactive guide sent successfully to user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO_V9_INTERACTIVE] Failed to send interactive guide:", error);
    await sendTelegramMessage(
        "🚨 Не удалось отправить инструктаж. Сервера, возможно, на перезарядке. Попробуй позже.",
        [], undefined, String(chatId)
    );
  }
}