"use server";

import { logger } from "@/lib/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

// Fetches a random image from Unsplash based on a query
async function getRandomUnsplashImage(query: string): Promise<string | null> {
  if (!UNSPLASH_ACCESS_KEY) {
    logger.warn("[Unsplash] Access key is not configured. Skipping image fetch.");
    return null;
  }
  try {
    const response = await fetch(`https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`);
    if (!response.ok) {
      logger.error("[Unsplash] Failed to fetch image", { status: response.status, text: await response.text() });
      return null;
    }
    const data = await response.json();
    // Use a high-quality but not full-size version for speed
    return data.urls?.regular || null;
  } catch (error) {
    logger.error("[Unsplash] Error fetching random image:", error);
    return null;
  }
}

/**
 * Sends a rich Telegram message, potentially with a photo and an inline keyboard.
 * Handles both sendPhoto and sendMessage endpoints.
 */
export async function sendComplexMessage(
  chatId: string | number,
  caption: string,
  buttons: InlineButton[][] = [],
  imageQuery?: string // e.g., "library", "code", "rage"
): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.error("TELEGRAM_BOT_TOKEN is not configured.");
    return { success: false, error: "Telegram bot token not configured." };
  }

  let imageUrl: string | null = null;
  if (imageQuery) {
    imageUrl = await getRandomUnsplashImage(imageQuery);
  }

  const payload: any = {
    chat_id: String(chatId),
    parse_mode: 'Markdown',
  };

  if (buttons.length > 0) {
    payload.reply_markup = { inline_keyboard: buttons };
  }

  const endpoint = imageUrl ? 'sendPhoto' : 'sendMessage';
  
  if (imageUrl) {
    payload.photo = imageUrl;
    payload.caption = caption;
  } else {
    payload.text = caption;
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

    logger.info(`Successfully sent complex message via ${endpoint} to chat ${chatId}.`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    logger.error(`Error in sendComplexMessage for chat ${chatId}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}