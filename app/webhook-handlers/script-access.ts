import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";

export const scriptAccessHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "script_access",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    await supabase
      .from("users")
      .update({ has_script_access: true })
      .eq("user_id", userId);

    const scripts = [
      { name: "Block'em All", url: "https://automa.app/marketplace/blockemall" },
      { name: "Purge'em All", url: "https://automa.app/marketplace/purgeemall" },
      { name: "Hunter", url: "https://automa.app/marketplace/hunter" },
    ];

    const message =
      "Спасибо за покупку Automa Bot-Hunting Scripts! Вот ваши ссылки:\n" +
      scripts.map((script) => `- [${script.name}](${script.url})`).join("\n");

    await sendTelegramMessage(
      telegramToken,
      message,
      [],
      undefined,
      userId
    );

    await sendTelegramMessage(
      telegramToken,
      `🔔 Пользователь ${userData.username || userData.user_id} приобрел доступ к Automa скриптам!`,
      [],
      undefined,
      adminChatId
    );
  },
};