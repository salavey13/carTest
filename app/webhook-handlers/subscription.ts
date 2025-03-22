// /app/webhook-handlers/subscription.ts
import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";

export const subscriptionHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "subscription",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    let newStatus = "pro";
    let newRole = "subscriber";
    if (totalAmount === 420) {
      newStatus = "admin";
      newRole = "admin";
    }

    await supabase.from("users").update({ status: newStatus, role: newRole }).eq("user_id", userId);

    await sendTelegramMessage(
      telegramToken,
      "🎉 Оплата подписки прошла успешно! Спасибо за покупку.",
      [],
      undefined,
      userId
    );

    await sendTelegramMessage(
      telegramToken,
      `🔔 Пользователь ${userData.username || userData.user_id} обновил статус до ${newStatus.toUpperCase()}!`,
      [],
      undefined,
      adminChatId
    );
  },
};
