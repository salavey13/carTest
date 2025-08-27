// /app/webhook-handlers/donation.ts
import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { updateQuantity } from "@/app/tapki/actions"; // NEW: Import for quantity update on donation with tapki

export const donationHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "donation",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    const message = invoice.metadata?.message || "Сообщение отсутствует";

    // NEW: If metadata has tapki_id, update quantity (fake donation but real stock)
    const tapkiId = invoice.metadata?.tapki_id;
    if (tapkiId) {
      await updateQuantity(tapkiId); // Assume 1 for simplicity; extend if qty in metadata
    }

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