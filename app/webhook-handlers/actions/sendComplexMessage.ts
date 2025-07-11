"use server";

import { logger } from "@/lib/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const DEFAULT_FALLBACK_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/logo-4fd42ec1-ee7b-4ff1-8ee5-733030e376aa.jpg";

export interface KeyboardButton {
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
  buttons: KeyboardButton[][] = [],
  options: {
    imageQuery?: string,
    messageId?: number,
    keyboardType?: 'inline' | 'reply',
    removeKeyboard?: boolean
  } = {}
): Promise<{ success: boolean; error?: string; data?: any }> {
  const { imageQuery, messageId, keyboardType = 'inline', removeKeyboard = false } = options;
  
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
  
  if (removeKeyboard) {
    payload.reply_markup = { remove_keyboard: true };
  } else if (buttons.length > 0) {
    if (keyboardType === 'inline') {
      payload.reply_markup = { inline_keyboard: buttons };
    } else {
      payload.reply_markup = {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: true,
      };
    }
  }

  let endpoint: string;
  // IMPORTANT: The logic for editing messages with photos is different.
  // `editMessageText` cannot edit a message that has a photo (it has a caption, not text).
  // The robust solution is to use `editMessageCaption` or delete and resend.
  // We are now handling editing in a separate, smarter function.
  
  if (messageId) {
    logger.warn(`[sendComplexMessage] Attempted to edit message ${messageId} via sendComplexMessage. This is deprecated. Use editMessage instead.`);
    // Fallback to deleting and sending a new one.
    await deleteTelegramMessage(Number(chatId), messageId);
  }
  
  endpoint = imageUrl ? 'sendPhoto' : 'sendMessage';
  if (imageUrl) {
    payload.photo = imageUrl;
    payload.caption = text;
  } else {
    payload.text = text;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      if (data.description?.includes('message is not modified')) {
          logger.info(`[sendComplexMessage] Message not modified for chat ${chatId}.`);
          return { success: false, error: data.description };
      }
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
        // Don't treat "message to delete not found" as a critical error.
        if (!data.ok && !data.description?.includes('message to delete not found')) {
            logger.warn(`[DeleteMessage] Failed to delete message ${messageId} for chat ${chatId}. Reason: ${data.description}`);
            return false;
        }
        logger.info(`[DeleteMessage] Successfully deleted message ${messageId} for chat ${chatId} (or it was already gone).`);
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        logger.error(`[DeleteMessage] Critical error deleting message ${messageId}:`, errorMessage);
        return false;
    }
}

/**
 * A more robust function to "update" a message. It deletes the old one and sends a new one.
 * This avoids issues with editing photo captions vs. text messages.
 */
export async function editMessage(
    chatId: number, 
    messageId: number, 
    newText: string,
    buttons: KeyboardButton[][] = [],
    options: {
        imageQuery?: string;
        keyboardType?: 'inline' | 'reply';
    } = {}
) {
    // 1. Delete the old message. We don't care much if it fails (it might be already gone).
    await deleteTelegramMessage(chatId, messageId);
    
    // 2. Send a brand new message with the updated content.
    return await sendComplexMessage(chatId, newText, buttons, options);
}