import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";

export const donationHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "donation",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    const message = invoice.metadata?.message || "Сообщение отсутствует";
    await sendTelegramMessage(
      telegramToken,
      `🎉 Поступило новое пожертвование!\nСумма: ${totalAmount} XTR\nОт кого: ${userData.username || userData.user_id}\nСообщение: ${message}\nМы искренне благодарны за вашу щедрость!`,
      [],
      undefined,
      adminChatId
    );

    await sendTelegramMessage(
      telegramToken,
      "Большое спасибо за ваше пожертвование! 🌟 Ваша поддержка вдохновляет нас и помогает двигаться вперёд. Вы — часть нашего успеха!",
      [],
      undefined,
      userId
    );
  },
};