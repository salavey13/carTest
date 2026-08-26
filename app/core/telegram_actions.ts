"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { telegramDeliver, bufferToForwardFile } from "@/lib/telegram-transport";

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
  try {
    const contentType = fileName.toLowerCase().endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : fileName.toLowerCase().endsWith(".png")
        ? "image/png"
        : "text/plain;charset=utf-8";

    // Normalize input → Buffer for the transport layer (Blob is async-read).
    let buffer: Buffer;
    if (fileContent instanceof Blob) {
      buffer = Buffer.from(await fileContent.arrayBuffer());
    } else if (typeof fileContent === "string") {
      buffer = Buffer.from(fileContent, "utf8");
    } else {
      buffer = Buffer.from(fileContent);
    }

    // iter8: documents (rental contracts, CSV exports) are delivered via the
    // forwarding API on the Vercel deployment (token stays there) with an
    // automatic direct-API fallback when a local TELEGRAM_BOT_TOKEN exists.
    const file = bufferToForwardFile(buffer, fileName, contentType);
    const result = await telegramDeliver("sendDocument", chatId, {}, { document: file });

    if (!result.ok) {
      logger.error(`Telegram delivery error (sendDocument, via=${result.via}): ${result.error || "Unknown error"}`, { chatId, fileName });
      return {
        success: false,
        error: result.error || "Failed to send document",
      };
    }

    return { success: true, data: result.result };
  } catch (error) {
    logger.error(`Error in sendTelegramDocumentCore (${chatId}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred while sending document",
    };
  }
}
