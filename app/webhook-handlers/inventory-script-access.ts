import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";

export const inventoryScriptAccessHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "inventory_script_access",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    await supabase
      .from("users")
      .update({
        metadata: {
          ...userData.metadata,
          has_inventory_script_access: true,
        },
      })
      .eq("user_id", userId);

    const inventoryScripts = [
      { name: "Order Snatcher", url: "https://automa.site/workflow/16rZppoNhrm7HCJSncPJV" },
    ];

    const message =
      "Спасибо, что купил Automa скрипты для склада! Хватай заказы и синкай химию:\n" +
      inventoryScripts.map((script) => `- [${script.name}](${script.url})`).join("\n");

    await sendTelegramMessage(
      telegramToken,
      message,
      [],
      undefined,
      userId
    );

    await sendTelegramMessage(
      telegramToken,
      `🔔 ${userData.username || userData.user_id} схватил Automa скрипты для склада!`,
      [],
      undefined,
      adminChatId
    );
  },
};