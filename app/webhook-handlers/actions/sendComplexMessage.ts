"use server";

import { logger } from "@/lib/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const DEFAULT_FALLBACK_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/logo-4fd42ec1-ee7b-4ff1-8ee5-733030e376aa.jpg";
const TELEGRAM_MESSAGE_LIMIT = 4096;

export interface KeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

async function getRandomUnsplashImage(query: string): Promise<string> {
  if (!UNSPLASH_ACCESS_KEY) {
    logger.warn("[Unsplash] Access key not configured. Using fallback.");
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
    logger.error("[sendComplexMessage] Telegram bot token not configured.");
    return { success: false, error: "Telegram bot token not configured." };
  }
  
  if (text.length > TELEGRAM_MESSAGE_LIMIT) {
    logger.warn(`[sendComplexMessage] Message for chat ${chatId} is too long (${text.length}). Splitting.`);
    const chunks = [];
    for (let i = 0; i < text.length; i += TELEGRAM_MESSAGE_LIMIT) {
      chunks.push(text.substring(i, i + TELEGRAM_MESSAGE_LIMIT));
    }

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLastChunk = i === chunks.length - 1;
        const payload = {
            chat_id: String(chatId),
            parse_mode: 'Markdown',
            text: chunk,
            reply_markup: isLastChunk && buttons.length > 0 ? (keyboardType === 'inline' ? { inline_keyboard: buttons } : { keyboard: buttons, resize_keyboard: true, one_time_keyboard: true }) : (isLastChunk && removeKeyboard ? { remove_keyboard: true } : undefined),
        };
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!data.ok) throw new Error(`Failed to send chunk ${i + 1}: ${data.description}`);
      }
      return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error during chunk sending.";
        logger.error(`[sendComplexMessage-chunking] for chat ${chatId}:`, errorMessage);
        return { success: false, error: errorMessage };
    }
  }

  try {
    let imageUrl: string | null = imageQuery && !messageId ? await getRandomUnsplashImage(imageQuery) : null;
    const payload: any = { chat_id: String(chatId), parse_mode: 'Markdown' };

    if (removeKeyboard) payload.reply_markup = { remove_keyboard: true };
    else if (buttons.length > 0) {
      payload.reply_markup = keyboardType === 'inline' ? { inline_keyboard: buttons } : { keyboard: buttons, resize_keyboard: true, one_time_keyboard: true };
    }
    
    const endpoint = imageUrl ? 'sendPhoto' : 'sendMessage';
    if (imageUrl) {
      payload.photo = imageUrl;
      payload.caption = text;
    } else {
      payload.text = text;
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.description || `Failed to ${endpoint}`);
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    logger.error(`[sendComplexMessage-main] for chat ${chatId}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function deleteTelegramMessage(chatId: number, messageId: number): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
    return true;
  } catch (error) {
    return false;
  }
}

export async function editMessage(
    chatId: number, 
    messageId: number, 
    newText: string,
    buttons: KeyboardButton[][] = [],
    options: { imageQuery?: string; keyboardType?: 'inline' | 'reply'; } = {}
) {
    await deleteTelegramMessage(chatId, messageId);
    return await sendComplexMessage(chatId, newText, buttons, options);
}