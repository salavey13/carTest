"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export interface InlineButton {
  text: string;
  url: string;
}

export type TelegramApiResponse = {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
};

type SendPayloadBase = {
  chat_id: string;
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; url: string }>>;
  };
};

type SendTextPayload = SendPayloadBase & {
  text: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
};

type SendPhotoPayload = SendPayloadBase & {
  photo: string;
  caption: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
};

type SendPayload = SendTextPayload | SendPhotoPayload;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = "413553377";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || DEFAULT_CHAT_ID;

export async function sendTelegramMessageCore(
  message: string,
  buttons: InlineButton[] = [],
  imageUrl?: string,
  chatId?: string,
  carId?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }

  const finalChatId = chatId || ADMIN_CHAT_ID;

  try {
    let finalMessage = message;

    if (carId) {
      const { data: car, error } = await supabaseAdmin
        .from("cars")
        .select("make, model, daily_price")
        .eq("id", carId)
        .single();

      if (error) {
        logger.error(`Failed to fetch car ${carId} for message: ${error.message}`);
      } else if (car) {
        finalMessage += `\n\nCar: ${car.make} ${car.model}\nDaily Price: ${car.daily_price} ₽`;
      }
    }

    const payload: SendPayload = imageUrl
      ? { chat_id: finalChatId, photo: imageUrl, caption: finalMessage, parse_mode: "Markdown" }
      : { chat_id: finalChatId, text: finalMessage, parse_mode: "Markdown" };

    if (buttons.length > 0) {
      payload.reply_markup = {
        inline_keyboard: [buttons.map((button) => ({ text: button.text, url: button.url }))],
      };
    }

    const endpoint = imageUrl ? "sendPhoto" : "sendMessage";
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: TelegramApiResponse = await response.json();

    if (!data.ok) {
      logger.error(`Telegram API error (${endpoint}): ${data.description || "Unknown error"}`, {
        chatId: finalChatId,
        errorCode: data.error_code,
        payload,
      });
      throw new Error(data.description || `Failed to ${endpoint}`);
    }

    return { success: true, data: data.result };
  } catch (error) {
    logger.error(`Error in sendTelegramMessageCore (${chatId || ADMIN_CHAT_ID}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while sending Telegram message",
    };
  }
}

export async function sendTelegramDocumentCore(
  chatId: string,
  fileContent: string | Blob | Uint8Array,
  fileName: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }

  try {
    const blob =
      fileContent instanceof Blob
        ? fileContent
        : new Blob([fileContent], {
            type: fileName.toLowerCase().endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "text/plain;charset=utf-8",
          });

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", blob, fileName);

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    const data: TelegramApiResponse = await response.json();

    if (!data.ok) {
      logger.error(`Telegram API error (sendDocument): ${data.description || "Unknown error"}`, {
        chatId,
        errorCode: data.error_code,
      });
      throw new Error(data.description || "Failed to send document");
    }

    return { success: true, data: data.result };
  } catch (error) {
    logger.error(`Error in sendTelegramDocumentCore (${chatId}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while sending document",
    };
  }
}
