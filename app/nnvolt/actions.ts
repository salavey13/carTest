"use server";

import { sendMessage } from "@/gateway/telegram/sendMessage";

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "6216799537";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export interface ContactFormData {
  name: string;
  phone: string;
  message?: string;
}

export async function submitContactForm(data: ContactFormData): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.error("Missing Telegram configuration");
    return { success: false, error: "Service not configured" };
  }

  try {
    // Format the message for Telegram
    const message = `
⚡ <b>НОВАЯ ЗАЯВКА — NN VOLT</b>

👤 <b>Имя:</b> ${data.name}
📱 <b>Телефон:</b> ${data.phone}
${data.message ? `💬 <b>Сообщение:</b>\n${data.message}` : ""}

🔗 <b>Источник:</b> nnvolt.рф
📅 <b>Дата:</b> ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
    `.trim();

    await sendMessage(ADMIN_CHAT_ID, message, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
