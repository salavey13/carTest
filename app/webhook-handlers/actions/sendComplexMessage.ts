"use server";

import { logger } from "@/lib/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const DEFAULT_FALLBACK_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/logo-4fd42ec1-ee7b-4ff1-8ee5-733030e376aa.jpg";

export interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

async function getRandomUnsplashImage(query: string): Promise<string> {
  if (!UNSPLASH_ACCESS_KEY) {
    logger.warn("[Unsplash] Access key not configured. Using default fallback image.");
    return DEFAULT_FALLBACK_IMAGE;
  }
  try {
    const response = await fetch(`https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`);
    if (!response.ok) {
      logger.error("[Unsplash] Failed to fetch image, using fallback", { status: response.status, text: await response.text() });
      return DEFAULT_FALLBACK_IMAGE;
    }
    const data = await response.json();
    return data.urls?.regular || DEFAULT_FALLBACK_IMAGE;
  } catch (error) {
    logger.error("[Unsplash] Error fetching random image, using fallback:", error);
    return DEFAULT_FALLBACK_IMAGE;
  }
}

export async function sendComplexMessage(
  chatId: string | number,
  text: string,
  buttons: InlineButton[][] = [],
  imageQuery?: string,
  messageId?: number // ID of the message to edit
): Promise<{ success: boolean; error?: string; data?: any }> { 
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured." };
  }

  let imageUrl: string | null = null;
  if (imageQuery && !messageId) {
    imageUrl = await getRandomUnsplashImage(imageQuery);
  }

  const payload: any = {
    chat_id: String(chatId),
    parse_mode: 'Markdown',
  };

  if (buttons.length > 0) {
    payload.reply_markup = { inline_keyboard: buttons };
  }

  let endpoint: string;

  if (messageId) {
    endpoint = 'editMessageText';
    payload.message_id = messageId;
    payload.text = text;
  } else {
    endpoint = imageUrl ? 'sendPhoto' : 'sendMessage';
    if (imageUrl) {
      payload.photo = imageUrl;
      payload.caption = text;
    } else {
      payload.text = text;
    }
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      logger.error(`Telegram API error (${endpoint}): ${data.description || "Unknown error"}`, { chatId, errorCode: data.error_code, payload });
      throw new Error(data.description || `Failed to ${endpoint}`);
    }

    logger.info(`Successfully performed ${endpoint} for chat ${chatId}.`);
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    logger.error(`Error in sendComplexMessage for chat ${chatId}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function deleteTelegramMessage(chatId: number, messageId: number): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN) {
        logger.error("[DeleteMessage] Telegram bot token not configured.");
        return false;
    }
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
        });
        const data = await response.json();
        if (!data.ok) {
            logger.warn(`[DeleteMessage] Failed to delete message ${messageId} for chat ${chatId}. Reason: ${data.description}`);
            return false;
        }
        logger.info(`[DeleteMessage] Successfully deleted message ${messageId} for chat ${chatId}.`);
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        logger.error(`[DeleteMessage] Critical error deleting message ${messageId}:`, errorMessage);
        return false;
    }
}