import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils"; // We need this to build full URLs

/**
 * Handles the /howto command by sending a message with navigation buttons
 * to the relevant guide pages.
 * @param chatId The chat ID to send the message to.
 * @param userId The ID of the user who triggered the command.
 */
export async function howtoCommand(chatId: number, userId: number) {
  logger.info(`[HOWTO_V6_BUTTONS] User ${userId} triggered /howto command.`);

  const baseUrl = getBaseUrl(); // e.g., https://v0-car-test.vercel.app

  // 1. Define the message content.
  const message = "Агент, вот твои основные инструктажи. Выбери нужный раздел, чтобы погрузиться в Vibe:";

  // 2. Define the interactive buttons.
  const buttons = [
    [ // First row of buttons
      {
        text: "📜 Нейро-Кухня (Создание)",
        url: `${baseUrl}/nutrition`,
      },
    ],
    [ // Second row of buttons
      {
        text: "🇯🇲 Гайд Растодева (Основы)",
        url: `${baseUrl}/rastabot`,
      }
    ],
    [ // Third row for more advanced guides
      {
        text: "🧠 Арбитраж: Deep Dive",
        url: `${baseUrl}/arbitrage-notdummies`
      }
    ]
  ];

  try {
    // 3. Send the message with the button keyboard.
    const result = await sendTelegramMessage(
      message,
      buttons,      // Pass the buttons array here
      undefined,    // No image
      String(chatId)
    );

    if (!result.success) {
      // If sending fails, we still need to inform the user.
      throw new Error(result.error || "Unknown error sending message with buttons.");
    }
    
    logger.info(`[HOWTO_V6_BUTTONS] Interactive guide sent successfully to user ${userId}.`);

  } catch (error) {
    logger.error("[HOWTO_V6_BUTTONS] Failed to send interactive guide:", error);
    
    // Fallback message if the primary one fails
    await sendTelegramMessage(
        "🚨 Не удалось отправить инструктаж. Сервера, возможно, на перезарядке. Попробуй позже.",
        [],
        undefined,
        String(chatId)
    );
  }
}