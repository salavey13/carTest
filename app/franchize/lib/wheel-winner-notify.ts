// app/franchize/lib/wheel-winner-notify.ts
// ─────────────────────────────────────────────────────────────────────────────
// TG-уведомления о выигрыше на колесе фортуны (boss codereview 2026-10-11, B3):
//   · победителю — DM с его промокодом и кнопкой «В корзину с промокодом»;
//   · crew owner + админам (owner/admin/co_owner) + ADMIN_CHAT_ID — сводка
//     «кто и что выиграл» (тот же состав получателей, что у lead-notify).
//
// Доставка — telegramDeliver (lib/telegram-transport): forward-first через
// /api/forward-telegram на Vercel, прямой фолбэк. Функции НИКОГДА не бросают:
// уведомление не должно ломать крутку.
//
// Антиспам (честно, без новой миграции):
//   · вызов серверного экшена возможен ТОЛЬКО с верифицированной
//     Telegram-личностью (resolveWallActor: подписанный cookie или
//     HMAC-проверенный initData) — анонимные крутки из веба молча не
//     уведомляют никого;
//   · in-memory rate-limit: один пакет «победитель + экипаж» на
//     (slug, user, код) в сутки — повторные вызовы в пределах 24 ч
//     игнорируются. Multi-instance deployment может задублировать (at-least-
//     once) — осознанный трейд-офф против новой таблицы; клиентская крутка
//     и так ограничена 1/24 ч, а коды публичны и переиспользуемы.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { telegramDeliver } from "@/lib/telegram-transport";

/** Кулдаун повторных уведомлений по одному (slug, user, код) — окно = календарные UTC-сутки (как крутка 1/24ч, честно округлённая до границы дня). */
export const WHEEL_WIN_NOTIFY_TTL_MS = 24 * 60 * 60 * 1000;

/** Максимальный размер in-memory реестра (анти-утечка в долгоживущем лямбда-процессе). */
export const WHEEL_WIN_NOTIFY_MAX_ENTRIES = 1000;

/** module-level rate-limit registry — экспортируется ТОЛЬКО для спеков. */
const recentNotifies = new Map<string, number>();

export function __resetWheelWinNotifyLimiterForTests(): void {
  recentNotifies.clear();
}

/** Pure: dedupe-ключ «один пакет уведомлений на пользователя/код/сутки». */
export function wheelWinNotifyKey(slug: string, userId: string, promoCode: string, dayUtc: string): string {
  return `${slug}:${userId}:${promoCode}:${dayUtc}`;
}

/** Pure: UTC-дата YYYYMMDD для dedupe-ключа (окно = календарные сутки UTC). */
export function wheelWinNotifyDay(now = Date.now()): string {
  const d = new Date(now);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}${mm}${dd}`;
}

/**
 * Claim права на уведомление (in-memory). true — мы первые за сутки,
 * false — уже уведомляли этот (slug, user, код) сегодня.
 */
export function claimWheelWinNotifySlot(slug: string, userId: string, promoCode: string, now = Date.now()): boolean {
  const key = wheelWinNotifyKey(slug, userId, promoCode, wheelWinNotifyDay(now));
  const previous = recentNotifies.get(key);
  if (previous !== undefined && now - previous < WHEEL_WIN_NOTIFY_TTL_MS) {
    return false;
  }
  if (recentNotifies.size >= WHEEL_WIN_NOTIFY_MAX_ENTRIES) {
    // Простая чистка просроченных записей; если после неё всё ещё тесно —
    // чистим целиком (дубликаты уведомлений лучше полной тишины).
    for (const [k, ts] of recentNotifies) {
      if (now - ts >= WHEEL_WIN_NOTIFY_TTL_MS) recentNotifies.delete(k);
    }
    if (recentNotifies.size >= WHEEL_WIN_NOTIFY_MAX_ENTRIES) recentNotifies.clear();
  }
  recentNotifies.set(key, now);
  return true;
}

// ── message builders (pure, юнит-тестируются) ────────────────────────────────

export interface WheelWinnerDmInfo {
  prizeLabel: string;
  promoCode: string;
  description: string;
  crewBrandName: string;
}

/** DM победителю — промокод ОБЯЗАТЕЛЬНО в тексте (boss checklist). */
export function buildWheelWinnerDmHtml(info: WheelWinnerDmInfo): string {
  const brand = escapeHtml(info.crewBrandName);
  const lines = [
    `🎰 <b>Колесо фортуны ${brand} — твой выигрыш!</b>`,
    ``,
    `🏆 <b>${escapeHtml(info.prizeLabel)}</b>`,
    `🎟 Промокод: <code>${escapeHtml(info.promoCode)}</code>`,
  ];
  if (info.description) lines.push(`ℹ️ ${escapeHtml(info.description)}`);
  lines.push(``, `Примени его в корзине — сервер проверит и применит скидку автоматически.`);
  return lines.join("\n");
}

export interface WheelCrewNotifyInfo {
  winnerName: string;
  winnerUsername: string | null;
  prizeLabel: string;
  promoCode: string;
  crewBrandName: string;
}

/** Сводка owner/админам: кто и что выиграл + промокод (boss checklist). */
export function buildWheelCrewNotifyHtml(info: WheelCrewNotifyInfo): string {
  const who = escapeHtml(info.winnerUsername ? `@${info.winnerUsername}` : info.winnerName);
  return [
    `🎁 <b>Колесо фортуны ${escapeHtml(info.crewBrandName)}</b>`,
    ``,
    `${who} выиграл <b>${escapeHtml(info.prizeLabel)}</b>`,
    `🎟 Промокод: <code>${escapeHtml(info.promoCode)}</code>`,
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── delivery (never throws) ──────────────────────────────────────────────────

function wheelCartUrl(slug: string, promoCode: string): string {
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
    return `${site.replace(/\/+$/, "")}/franchize/${encodeURIComponent(slug)}/cart?promo=${encodeURIComponent(promoCode)}`;
  } catch {
    return "";
  }
}

async function sendWheelDm(chatId: string, text: string, cartUrl: string): Promise<boolean> {
  const payload: Record<string, unknown> = {
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(cartUrl
      ? { reply_markup: { inline_keyboard: [[{ text: "🛒 В корзину с промокодом", url: cartUrl }]] } }
      : {}),
  };
  try {
    const res = await telegramDeliver("sendMessage", chatId, payload);
    if (!res.ok) {
      logger.warn("[wheel-winner-notify] delivery failed", { chatId, error: res.error });
    }
    return res.ok;
  } catch (error) {
    logger.warn("[wheel-winner-notify] delivery exception", { chatId, error });
    return false;
  }
}

export interface WheelWinNotifyInput {
  slug: string;
  crewBrandName: string;
  /** Верифицированный победитель (users.user_id = TG chat id) или null. */
  winnerId: string | null;
  winnerName: string;
  winnerUsername: string | null;
  prizeLabel: string;
  promoCode: string;
  description: string;
  /** owner + админы экипажа (users.user_id), уже без победителя. */
  crewRecipientIds: string[];
}

export interface WheelWinNotifyResult {
  winnerNotified: boolean;
  crewNotifiedCount: number;
}

/**
 * Разослать уведомления о выигрыше. Ждём от caller'а await (урок d275c52:
 * fire-and-forget на Vercel подмораживается после ответа). Никогда не бросает.
 */
export async function notifyWheelWinners(input: WheelWinNotifyInput): Promise<WheelWinNotifyResult> {
  const result: WheelWinNotifyResult = { winnerNotified: false, crewNotifiedCount: 0 };
  try {
    const cartUrl = wheelCartUrl(input.slug, input.promoCode);

    if (input.winnerId) {
      const winnerHtml = buildWheelWinnerDmHtml({
        prizeLabel: input.prizeLabel,
        promoCode: input.promoCode,
        description: input.description,
        crewBrandName: input.crewBrandName,
      });
      result.winnerNotified = await sendWheelDm(input.winnerId, winnerHtml, cartUrl);
    }

    const crewHtml = buildWheelCrewNotifyHtml({
      winnerName: input.winnerName,
      winnerUsername: input.winnerUsername,
      prizeLabel: input.prizeLabel,
      promoCode: input.promoCode,
      crewBrandName: input.crewBrandName,
    });
    for (const chatId of input.crewRecipientIds) {
      const ok = await sendWheelDm(chatId, crewHtml, cartUrl);
      if (ok) result.crewNotifiedCount += 1;
    }
  } catch (error) {
    logger.warn("[wheel-winner-notify] notify crashed (spin unaffected)", error);
  }
  return result;
}
