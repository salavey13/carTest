// /app/webhook-handlers/support.ts
import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";

export const supportHandler: WebhookHandler = {
  canHandle: (invoice, payload) => payload.startsWith("support_"),
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    await sendTelegramMessage(
      telegramToken,
      `🔔 Новая оплаченная заявка на поддержку!\nСумма: ${totalAmount} XTR\nОт: ${userData.username || userData.user_id}\nОписание: ${invoice.desсription}`,
      [],
      undefined,
      adminChatId
    );

    await sendTelegramMessage(
      telegramToken,
      "Спасибо за оплату! Ваша заявка на поддержку принята, я свяжусь с вами в ближайшее время.",
      [],
      undefined,
      userId
    );
  },
};
