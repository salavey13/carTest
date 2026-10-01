// app/franchize/lib/wall-notify-deliver.ts
// ─────────────────────────────────────────────────────────────────────────────
// Доставка уведомления о посте стены — С ФОТО, если пост несёт фотографии.
//
// BOSS 2026-10-01: «Notification didn't contain the image from post … for
// sending notifications and messages with photos you can employ our
// forwarding api (deployed to v0-car-test.vercel.app)».
//
// Транспорт — telegramDeliver (lib/telegram-transport.ts): FORWARD mode по
// умолчанию бьёт в https://v0-car-test.vercel.app/api/forward-telegram,
// который поддерживает sendPhoto (и files base64, но публичный URL из
// бакета wallphoto проще — Telegram сам скачает картинку). Прямой фолбэк на
// api.telegram.org остаётся внутри транспорта.
//
// Контракт:
//   · photoUrl === null → обычный sendMessage (прежнее поведение, бюджет
//     подписчиков не меняется);
//   · photoUrl !== null → sendPhoto(photo=url, caption=text, HTML, same
//     reply_markup) — кнопки «Арендовать <байк>» / «Открыть пост» живут на
//     ФОТО-сообщении, а не вторым сообщением;
//   · sendPhoto упал (хост не скачался, URL протух, лимит) → ОДИН откат на
//     sendMessage — текст с кнопками доходит всегда, фото best-effort;
//   · caption обрезается до 1024 символов (лимит Telegram) с запасом —
//     buildWallPostNotifyHtml и так короткий (превью 220), но гвард в коде.
// Никогда не бросает — вызывающие fanout'ы считают ok/failed сами.
// ─────────────────────────────────────────────────────────────────────────────

import { telegramDeliver } from "@/lib/telegram-transport";
import { logger } from "@/lib/logger";

/** Telegram caption limit — 1024; режем с запасом на HTML-сущности. */
export const WALL_NOTIFY_CAPTION_LIMIT = 1000;

/** Shape of the inline keyboard shared by both wall fanouts. */
export type WallNotifyKeyboard = { inline_keyboard: { text: string; url: string }[][] };

export interface WallNotifyDeliverResult {
  ok: boolean;
  /** Каким методом реально доставлено: фото-сообщение или текст-фолбэк. */
  via: "sendPhoto" | "sendMessage";
  messageId?: number;
  error?: string;
}

/** Pure: caption guard — обрезка под лимит Telegram (не ломая HTML-теги
 *  impossible в общем случае, поэтому режем только «хвост» превью: билдеры
 *  стены кладут теги в ШАПКУ (до текста поста), хвост — чистый текст. */
export function capWallNotifyCaption(text: string, limit: number = WALL_NOTIFY_CAPTION_LIMIT): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Доставить уведомление о посте: фото-сообщение когда есть картинка,
 * текст otherwise. Никогда не бросает.
 */
export async function deliverWallPostNotify(
  chatId: string | number,
  text: string,
  replyMarkup: WallNotifyKeyboard | null,
  photoUrl: string | null | undefined,
): Promise<WallNotifyDeliverResult> {
  const url = (photoUrl ?? "").trim();
  if (url) {
    try {
      const payload: Record<string, unknown> = {
        photo: url,
        caption: capWallNotifyCaption(text),
        parse_mode: "HTML",
      };
      if (replyMarkup) payload.reply_markup = replyMarkup;
      const res = await telegramDeliver("sendPhoto", chatId, payload);
      if (res.ok) {
        return { ok: true, via: "sendPhoto", messageId: res.messageId };
      }
      logger.warn("[wall-notify-deliver] sendPhoto failed — falling back to sendMessage", {
        chatId: String(chatId),
        error: res.error,
      });
    } catch (error) {
      logger.warn("[wall-notify-deliver] sendPhoto crashed — falling back to sendMessage", { chatId: String(chatId), error });
    }
  }

  const payload: Record<string, unknown> = {
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  try {
    const res = await telegramDeliver("sendMessage", chatId, payload);
    return {
      ok: Boolean(res.ok),
      via: "sendMessage",
      messageId: res.messageId,
      error: res.ok ? undefined : res.error,
    };
  } catch (error) {
    return { ok: false, via: "sendMessage", error: error instanceof Error ? error.message : String(error) };
  }
}
