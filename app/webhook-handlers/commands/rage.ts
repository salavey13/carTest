import { sendTelegramMessage } from "@/app/actions";
import { logger } from "@/lib/logger";

/**
 * Handles the /rage command. Provides an emotional release and a "panic button"
 * that deep-links to a high-volatility trading pair on a partner exchange.
 * @param chatId The chat ID to send the message to.
 * @param userId The ID of the user who triggered the command.
 */
export async function rageCommand(chatId: number, userId: number) {
  logger.info(`[RageCommandV2] User ${userId} is feeling the pressure.`);

  const message = "🔥 **RAGE MODE ACTIVATED** 🔥\n\nЧувствуешь, как рынок пытается тебя поиметь? Не поддавайся. Направь ярость в действие. Вот твоя красная кнопка. Один клик — и ты на поле боя, где волатильность зашкаливает. Преврати ярость в альфу... или в поучительный опыт. No guts, no glory.";

  // This is a deep link to the Bybit app, directly to a volatile trading pair.
  // This can be customized or randomized in the future.
  const panicButtonUrl = "https://www.bybit.com/trade/spot/1000PEPE/USDT";
  
  const buttons = [
    [
      { text: "🚨 КРАСНАЯ КНОПКА (1000PEPE)", url: panicButtonUrl }
    ]
  ];

  try {
    // Send the message with the panic button.
    await sendTelegramMessage(
      message,
      buttons,
      "https://media1.tenor.com/m/2T6_d3v2l4IAAAAd/anakin-skywalker-rage.gif", // A fitting GIF
      String(chatId),
      undefined,
      'Markdown'
    );
    
    logger.info(`[RageCommandV2] Panic button delivered to user ${userId}.`);

  } catch (error) {
    logger.error("[RageCommandV2] Failed to send rage response:", error);
    // Fallback in case of error
    await sendTelegramMessage(
        "Даже моя ярость не может пробиться через сервера. Попробуй позже.",
        [], undefined, String(chatId)
    );
  }
}