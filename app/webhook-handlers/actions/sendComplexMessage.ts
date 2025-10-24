"use server";

import { logger } from "@/lib/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const DEFAULT_FALLBACK_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/logo-4fd42ec1-ee7b-4ff1-8ee5-733030e376aa.jpg";
const TELEGRAM_MESSAGE_LIMIT = 4096;

export interface KeyboardButton {
  text: string;
  url?: string;
  // No callback_data—reply-only
}

function escapeTelegramMarkdown(text: string): string {
    if (!text) return "";
    const charsToEscape = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    return text.replace(new RegExp(`[${charsToEscape.join('\\')}]`, 'g'), '\\$&');
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
    imageQuery?: string;
    messageId?: number;
    keyboardType?: 'reply'; // Fixed to reply
    removeKeyboard?: boolean;
    parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
    attachment?: { type: 'document'; content: string; filename: string };
  } = {}
): Promise<{ success: boolean; error?: string; data?: any }> {
  const { imageQuery, messageId, keyboardType = 'reply', removeKeyboard = false, parseMode = 'Markdown', attachment } = options;

  if (!TELEGRAM_BOT_TOKEN) {
    logger.error("[sendComplexMessage] Telegram bot token not configured.");
    return { success: false, error: "Telegram bot token not configured." };
  }
  
  // Auto-escape for MarkdownV2
  let sanitizedText = text;
  if (parseMode === 'MarkdownV2') {
    sanitizedText = escapeTelegramMarkdown(text);
  } else if (sanitizedText.length > TELEGRAM_MESSAGE_LIMIT) {
    sanitizedText = sanitizedText.substring(0, TELEGRAM_MESSAGE_LIMIT) + "\n... (сообщение обрезано)";
    logger.warn("[sendComplexMessage] Text truncated to limit");
  }

  try {
    let imageUrl: string | null = null;
    if (imageQuery && !messageId) {
      imageUrl = await getRandomUnsplashImage(imageQuery);
      if (imageUrl === DEFAULT_FALLBACK_IMAGE) {
        logger.info(`[Unsplash] Used fallback for query: ${imageQuery}`);
      }
    }
    const payload: any = { chat_id: String(chatId), parse_mode: parseMode };

    if (removeKeyboard) payload.reply_markup = { remove_keyboard: true };
    else if (buttons.length > 0) {
      // Reply keyboard: Text buttons, one-time, resizable
      payload.reply_markup = { 
        keyboard: buttons, 
        resize_keyboard: true, 
        one_time_keyboard: true,
        selective: true // Show only to this chat
      };
    }
    
    let endpoint = imageUrl ? 'sendPhoto' : 'sendMessage';
    if (attachment?.type === 'document') {
      endpoint = 'sendDocument';
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      formData.append('document', new Blob([attachment.content], { type: 'text/csv;charset=utf-8' }), attachment.filename);
      formData.append('caption', sanitizedText);
      if (payload.reply_markup) formData.append('reply_markup', JSON.stringify(payload.reply_markup));
      if (parseMode) formData.append('parse_mode', parseMode);

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
        method: "POST", body: formData
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.description || `Failed to ${endpoint}`);
      return { success: true, data };
    } else if (imageUrl) {
      payload.photo = imageUrl;
      payload.caption = sanitizedText;
    } else {
      payload.text = sanitizedText;
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.description || `Failed to ${endpoint}`);
    logger.info(`[sendComplexMessage] Success for chat ${chatId}: ${endpoint} with ${buttons.length ? `${buttons.length} reply buttons` : 'no buttons'}`);
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    logger.error(`[sendComplexMessage-main] for chat ${chatId}:`, errorMessage, { text: sanitizedText.substring(0, 100), parseMode });
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
    logger.error("[deleteTelegramMessage] Failed:", error);
    return false;
  }
}

export async function editMessage(
    chatId: number, 
    messageId: number, 
    newText: string,
    buttons: KeyboardButton[][] = [],
    options: { imageQuery?: string; keyboardType?: 'reply'; parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown' } = {}
) {
    const deleted = await deleteTelegramMessage(chatId, messageId);
    if (!deleted) {
      logger.warn("[editMessage] Delete failed, sending fresh");
    }
    return await sendComplexMessage(chatId, newText, buttons, { ...options, keyboardType: 'reply', parseMode: options.parseMode || 'Markdown' });
}