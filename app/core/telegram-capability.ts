/**
 * Telegram Notification Capability
 *
 * Consolidated module for all Telegram notification patterns.
 * Replaces scattered notification code across:
 * - app/actions.ts (sendTelegramDocument, sendTelegramInvoice, notifyAdmin)
 * - app/franchize/server-actions/orders.ts (order notifications)
 * - app/franchize/server-actions/buy-print.ts (PDF delivery)
 * - app/webhook-handlers/actions/sendComplexMessage.ts
 *
 * Usage:
 *   import { telegram } from '@/app/core/telegram-capability';
 *   await telegram.sendMessage({ chatId, text, buttons });
 *   await telegram.sendDocument({ chatId, file, filename });
 */

"use server";

import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export type TelegramChatId = string | number;

export type TelegramParseMode = "Markdown" | "MarkdownV2" | "HTML";

export interface TelegramButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramKeyboardButton {
  text: string;
  url?: string;
}

export type TelegramKeyboard = TelegramKeyboardButton[][];

export interface SendMessageOptions {
  chatId: TelegramChatId;
  text: string;
  parseMode?: TelegramParseMode;
  buttons?: TelegramButton[];
  keyboard?: TelegramKeyboard;
  removeKeyboard?: boolean;
  imageUrl?: string;
  imageQuery?: string; // For Unsplash fallback
}

export interface SendDocumentOptions {
  chatId: TelegramChatId;
  file: Buffer | Blob | Uint8Array | string;
  filename: string;
  caption?: string;
  parseMode?: TelegramParseMode;
  buttons?: TelegramButton[];
}

export interface SendPhotoOptions {
  chatId: TelegramChatId;
  photo: string; // URL or file_id
  caption?: string;
  parseMode?: TelegramParseMode;
  buttons?: TelegramButton[];
}

export interface SendInvoiceOptions {
  chatId: TelegramChatId;
  title: string;
  description: string;
  payload: string;
  currency: string;
  prices: Array<{ label: string; amount: number }>;
  providerToken?: string;
  photoUrl?: string;
  needName?: boolean;
  needPhoneNumber?: boolean;
  needEmail?: boolean;
  needShippingAddress?: boolean;
}

export interface NotificationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface NotificationOptions {
  parseMode?: TelegramParseMode;
  buttons?: TelegramButton[];
  imageUrl?: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "413553377";
const TELEGRAM_MESSAGE_LIMIT = 4096;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const DEFAULT_FALLBACK_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/logo-4fd42ec1-ee7b-4ff1-8ee5-733030e376aa.jpg";

// ============================================================================
// HELPERS
// ============================================================================

function escapeTelegramMarkdown(text: string): string {
  if (!text) return "";
  const charsToEscape = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  return text.replace(new RegExp(`[${charsToEscape.join('\\')}]`, 'g'), '\\$&');
}

function truncateText(text: string, limit: number = TELEGRAM_MESSAGE_LIMIT): string {
  if (text.length <= limit) return text;
  return text.substring(0, limit) + "\n... (сообщение обрезано)";
}

async function getRandomUnsplashImage(query: string): Promise<string> {
  if (!UNSPLASH_ACCESS_KEY) {
    logger.warn("[TelegramCapability] Unsplash access key not configured. Using fallback.");
    return DEFAULT_FALLBACK_IMAGE;
  }
  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
    );
    if (!response.ok) {
      return DEFAULT_FALLBACK_IMAGE;
    }
    const data = await response.json();
    return data.urls?.regular || DEFAULT_FALLBACK_IMAGE;
  } catch (error) {
    logger.error("[TelegramCapability] Unsplash fetch failed:", error);
    return DEFAULT_FALLBACK_IMAGE;
  }
}

function buildInlineKeyboard(buttons: TelegramButton[]): { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> } {
  if (buttons.length === 0) return {};
  return {
    inline_keyboard: [
      buttons.map((btn) => ({
        text: btn.text,
        ...(btn.url ? { url: btn.url } : {}),
        ...(btn.callback_data ? { callback_data: btn.callback_data } : {}),
      })),
    ],
  };
}

function buildReplyKeyboard(keyboard: TelegramKeyboard, removeKeyboard = false): any {
  if (removeKeyboard) return { remove_keyboard: true };
  if (keyboard.length === 0) return {};
  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: true,
    selective: true,
  };
}

// ============================================================================
// CORE API
// ============================================================================

async function telegramApiCall(
  endpoint: string,
  payload: any,
  useFormData = false
): Promise<NotificationResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: useFormData ? undefined : { "Content-Type": "application/json" },
      body: useFormData ? payload : JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.ok) {
      logger.error(`[TelegramCapability] API error (${endpoint}): ${data.description || "Unknown error"}`, {
        errorCode: data.error_code,
        payload: useFormData ? "[FormData]" : payload,
      });
      return { success: false, error: data.description || `Failed to ${endpoint}` };
    }

    return { success: true, data: data.result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    logger.error(`[TelegramCapability] Request failed (${endpoint}):`, error);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Send a text message or photo with optional buttons.
 */
export async function sendMessage(options: SendMessageOptions): Promise<NotificationResult> {
  const {
    chatId,
    text,
    parseMode = "Markdown",
    buttons = [],
    keyboard = [],
    removeKeyboard = false,
    imageUrl,
    imageQuery,
  } = options;

  let sanitizedText = text;
  if (parseMode === "MarkdownV2") {
    sanitizedText = escapeTelegramMarkdown(text);
  }
  sanitizedText = truncateText(sanitizedText);

  // Get image URL if query provided
  let finalImageUrl = imageUrl;
  if (imageQuery && !finalImageUrl) {
    finalImageUrl = await getRandomUnsplashImage(imageQuery);
  }

  const basePayload = {
    chat_id: String(chatId),
    parse_mode: parseMode,
  };

  // Build keyboard markup
  const inlineMarkup = buildInlineKeyboard(buttons);
  const replyMarkup = buildReplyKeyboard(keyboard, removeKeyboard);

  const payload: any = {
    ...basePayload,
    ...(inlineMarkup.inline_keyboard ? { reply_markup: inlineMarkup } : {}),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };

  const endpoint = finalImageUrl ? "sendPhoto" : "sendMessage";

  if (finalImageUrl) {
    payload.photo = finalImageUrl;
    payload.caption = sanitizedText;
  } else {
    payload.text = sanitizedText;
  }

  return telegramApiCall(endpoint, payload);
}

/**
 * Send a document (PDF, DOCX, etc.) to a chat.
 */
export async function sendDocument(options: SendDocumentOptions): Promise<NotificationResult> {
  const { chatId, file, filename, caption = "", parseMode, buttons = [] } = options;

  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "Telegram bot token not configured" };
  }

  try {
    const blob =
      file instanceof Blob
        ? file
        : new Blob([file], {
            type: filename.toLowerCase().endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : filename.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : "text/plain;charset=utf-8",
          });

    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    formData.append("document", blob, filename);

    if (caption) {
      formData.append("caption", truncateText(caption));
    }
    if (parseMode) {
      formData.append("parse_mode", parseMode);
    }

    const markup = buildInlineKeyboard(buttons);
    if (markup.inline_keyboard) {
      formData.append("reply_markup", JSON.stringify(markup));
    }

    return telegramApiCall("sendDocument", formData, true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to prepare document";
    logger.error("[TelegramCapability] sendDocument failed:", error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send a photo by URL or file_id.
 */
export async function sendPhoto(options: SendPhotoOptions): Promise<NotificationResult> {
  const { chatId, photo, caption = "", parseMode = "Markdown", buttons = [] } = options;

  let sanitizedCaption = caption;
  if (parseMode === "MarkdownV2") {
    sanitizedCaption = escapeTelegramMarkdown(caption);
  }
  sanitizedCaption = truncateText(sanitizedCaption);

  const payload: any = {
    chat_id: String(chatId),
    photo,
    caption: sanitizedCaption,
    parse_mode: parseMode,
    ...buildInlineKeyboard(buttons),
  };

  return telegramApiCall("sendPhoto", payload);
}

/**
 * Send an invoice for XTR (Telegram Stars) payments.
 */
export async function sendInvoice(options: SendInvoiceOptions): Promise<NotificationResult> {
  const {
    chatId,
    title,
    description,
    payload,
    currency = "XTR",
    prices,
    providerToken,
    photoUrl,
    needName = false,
    needPhoneNumber = false,
    needEmail = false,
    needShippingAddress = false,
  } = options;

  const invoicePayload: any = {
    chat_id: String(chatId),
    title,
    description: truncateText(description, 255), // Telegram limit
    payload,
    currency,
    prices,
    need_name: needName,
    need_phone_number: needPhoneNumber,
    need_email: needEmail,
    need_shipping_address: needShippingAddress,
  };

  if (providerToken) {
    invoicePayload.provider_token = providerToken;
  }

  if (photoUrl) {
    invoicePayload.photo_url = photoUrl;
  }

  return telegramApiCall("sendInvoice", invoicePayload);
}

/**
 * Send a notification to the admin chat.
 */
export async function notifyAdmin(
  message: string,
  options: NotificationOptions = {}
): Promise<NotificationResult> {
  return sendMessage({
    chatId: ADMIN_CHAT_ID,
    text: message,
    parseMode: options.parseMode,
    imageUrl: options.imageUrl,
    buttons: options.buttons,
  });
}

/**
 * Delete a message.
 */
export async function deleteMessage(chatId: TelegramChatId, messageId: number): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chatId), message_id: messageId }),
    });
    return true;
  } catch (error) {
    logger.error("[TelegramCapability] deleteMessage failed:", error);
    return false;
  }
}

/**
 * Edit a message (by deleting and resending - Telegram API limitation for bots).
 */
export async function editMessage(
  chatId: TelegramChatId,
  messageId: number,
  newText: string,
  keyboard: TelegramKeyboard = [],
  options: NotificationOptions = {}
): Promise<NotificationResult> {
  await deleteMessage(chatId, messageId);
  return sendMessage({
    chatId,
    text: newText,
    parseMode: options.parseMode,
    imageUrl: options.imageUrl,
    buttons: options.buttons,
    keyboard,
  });
}

// ============================================================================
// EXPORT OBJECT
// ============================================================================

export const telegram = {
  sendMessage,
  sendDocument,
  sendPhoto,
  sendInvoice,
  notifyAdmin,
  deleteMessage,
  editMessage,
};

// Re-export individual functions for convenience
export { sendMessage, sendDocument, sendPhoto, sendInvoice, notifyAdmin, deleteMessage, editMessage };

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use telegram.sendMessage() instead
 */
export async function sendComplexMessage(
  chatId: TelegramChatId,
  text: string,
  buttons: TelegramButton[][] = [],
  options: {
    imageQuery?: string;
    messageId?: number;
    keyboardType?: "reply";
    removeKeyboard?: boolean;
    parseMode?: TelegramParseMode;
    attachment?: { type: "document"; content: string; filename: string };
  } = {}
): Promise<NotificationResult> {
  const { imageQuery, messageId, removeKeyboard = false, parseMode = "Markdown", attachment } = options;

  // Flatten buttons for sendMessage
  const flatButtons: TelegramButton[] = buttons.flat();

  if (attachment?.type === "document") {
    return sendDocument({
      chatId,
      file: attachment.content,
      filename: attachment.filename,
      caption: text,
      parseMode,
    });
  }

  if (messageId) {
    return editMessage(chatId, messageId, text, buttons, { parseMode, imageUrl: imageQuery });
  }

  return sendMessage({
    chatId,
    text,
    parseMode,
    buttons: flatButtons,
    removeKeyboard,
    imageQuery,
  });
}

/**
 * @deprecated Use telegram.sendDocument() instead
 */
export async function sendTelegramDocumentCore(
  chatId: string,
  fileContent: string | Blob | Uint8Array,
  fileName: string
): Promise<NotificationResult> {
  return sendDocument({ chatId, file: fileContent, filename: fileName });
}

/**
 * @deprecated Use telegram.sendMessage() instead
 */
export async function sendTelegramMessageCore(
  message: string,
  buttons: TelegramButton[] = [],
  imageUrl?: string,
  chatId?: string,
  carId?: string
): Promise<NotificationResult> {
  // Note: carId parameter was used in legacy code to append car details
  // This functionality should be handled by the caller now
  return sendMessage({
    chatId: chatId || ADMIN_CHAT_ID,
    text: message,
    buttons,
    imageUrl,
  });
}
