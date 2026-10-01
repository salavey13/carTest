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
//   · caption обрезается до лимита Telegram (1024) ТАК, чтобы не разорвать
//     HTML-тег: в конечном HTML любой «<» — это настоящий тег (литеральные
//     «<» экранированы escapeTelegramHtml), поэтому хвост, оборванный внутри
//     тега, отрезается до «<» целиком (code review 2026-10-02);
//   · Telegram 429 (flood control) с parameters.retry_after ≤
//     WALL_NOTIFY_RETRY_AFTER_MAX_S → ОДНА повторная попытка после паузы
//     (code review 2026-10-02: 429 раньше считался окончательным отказом).
// Никогда не бросает — вызывающие fanout'ы считают ok/failed сами.
// ─────────────────────────────────────────────────────────────────────────────

import { telegramDeliver } from "@/lib/telegram-transport";
import { logger } from "@/lib/logger";

/** Telegram caption limit — 1024; режем с запасом на HTML-сущности. */
export const WALL_NOTIFY_CAPTION_LIMIT = 1000;

/**
 * Максимальный retry_after (сек), при котором делаем одну повторную попытку.
 * Держим маленьким: fanout живёт в бюджете 50с, долгий flood-control — это
 * «не сейчас», получателя добьют следующие kick/крон.
 */
export const WALL_NOTIFY_RETRY_AFTER_MAX_S = 5;

/** Пакет отправки: 20 × 1.1с ≈ 18 сообщений/сек — под потолком Bot API 30/сек.
 *  Единый дом для ОБЕИХ рассылок (renter-fanout и crew-fanout): раньше темп
 *  держал только renter-fanout, crew-fanout стрелял всем списком за раз. */
export const WALL_NOTIFY_BATCH_SIZE = 20;
export const WALL_NOTIFY_BATCH_PAUSE_MS = 1100;

/** Shape of the inline keyboard shared by both wall fanouts. */
export type WallNotifyKeyboard = { inline_keyboard: { text: string; url: string }[][] };

export interface WallNotifyDeliverResult {
  ok: boolean;
  /** Каким методом реально доставлено: фото-сообщение или текст-фолбэк. */
  via: "sendPhoto" | "sendMessage";
  messageId?: number;
  error?: string;
}

/** Pure: caption guard — обрезка под лимит Telegram без разрыва HTML-тега. */
export function capWallNotifyCaption(text: string, limit: number = WALL_NOTIFY_CAPTION_LIMIT): string {
  if (text.length <= limit) return text;
  let cut = `${text.slice(0, limit - 1).trimEnd()}…`;
  // В финальном HTML каждый «<» — открывающий тег (литеральные экранированы).
  // Если после последнего «<» нет «>», мы разрезали тег посередине — Telegram
  // ответил бы 400 «can't parse entities» на ВСЁ сообщение. Отрезаем хвост
  // вместе с недобранным тегом (плюс возможный «…» сразу за ним).
  const lastOpen = cut.lastIndexOf("<");
  if (lastOpen > cut.lastIndexOf(">")) {
    cut = `${cut.slice(0, lastOpen).trimEnd()}…`;
  }
  return cut;
}

/** Pure: разбить список получателей на пакеты фиксированного размера. */
export function batched<T>(items: readonly T[], size: number = WALL_NOTIFY_BATCH_SIZE): T[][] {
  if (size <= 0) return [[...items]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Один вызов telegramDeliver с уважением к 429: при flood-control с малым
 * retry_after (≤ WALL_NOTIFY_RETRY_AFTER_MAX_S) ждём и пробуем ещё РАЗ.
 * Один ретрай — НЕ цикл: долгий flood-control решает следующий kick/крон.
 */
async function deliverWithFloodRetry(
  method: "sendPhoto" | "sendMessage",
  chatId: string | number,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; messageId?: number; error?: string; retried?: boolean }> {
  const first = await telegramDeliver(method, chatId, payload);
  if (first.ok) return first;
  const retryAfter = first.retryAfter ?? 0;
  if (retryAfter > 0 && retryAfter <= WALL_NOTIFY_RETRY_AFTER_MAX_S) {
    logger.warn("[wall-notify-deliver] 429 flood control — retrying once after retry_after", {
      method,
      chatId: String(chatId),
      retryAfter,
    });
    await sleep(retryAfter * 1000 + 250);
    const second = await telegramDeliver(method, chatId, payload);
    if (second.ok) return { ...second, retried: true };
    return second;
  }
  return first;
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
      const res = await deliverWithFloodRetry("sendPhoto", chatId, payload);
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
    const res = await deliverWithFloodRetry("sendMessage", chatId, payload);
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
