// app/franchize/lib/crew-bot.ts
// ─────────────────────────────────────────────────────────────────────────────
// Единый резолвер Telegram-бота экипажа (crew v1 / notifications fix).
//
// Баг (сообщён boss'ом 2026-09-21): уведомление о закрытии аренды уводило
// райдера на WEB-ссылку https://v0-car-test.vercel.app/franchize/<slug>/community
// вместо Mini App deeplink t.me/<bot>/app?startapp=wall_<slug>. Причина:
// notify-либы читали только process.env.TELEGRAM_BOT_USERNAME, а он в проде
// не задан — при этом имя бота лежит в METADATA ЭКИПАЖА
// (crews.contacts.telegramBotUsername = "oneBikePlsBot" для vip-bike).
//
// Цепочка приоритетов (везде одинаковая):
//   1. contacts экипажа (crews.contacts.telegramBotUsername) — источник правды;
//   2. process.env.TELEGRAM_BOT_USERNAME — глобальный дефолт;
//   3. null → вызывающий код рендерит web-фолбэк (стена публичная).
//
// Резолвер кэшируется на 5 минут (позитивно и негативно) — фанкоуты стены
// вызывают его по несколько раз за_action, а crews — горячая таблица.
// Никогда не бросает: уведомления не должны падать из-за метаданных.
//
// NOTE: supabase-server импортируется ДИНАМИЧЕСКИ внутри try — pure-хелперы
// (normalizeBotUsername / botUsernameFromContacts) остаются безопасными для
// клиентских бандлов и тестовых сред (jsdom), где статический импорт
// supabase-server кидает «must only be imported on the server».
// ─────────────────────────────────────────────────────────────────────────────

/** Telegram username: 5–32, буквы/цифры/подчёркивания, начинается с буквы. */
const BOT_USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** Нормализовать username (@X → X, мусор → null). Принимает unknown — JSONB. */
export function normalizeBotUsername(value: unknown): string | null {
  const s = String(value ?? "")
    .trim()
    .replace(/^@+/, "");
  return BOT_USERNAME_RE.test(s) ? s : null;
}

/** Достать бота из contacts-объекта экипажа (crews.contacts.telegramBotUsername). */
export function botUsernameFromContacts(contacts: unknown): string | null {
  if (!contacts || typeof contacts !== "object") return null;
  return normalizeBotUsername((contacts as Record<string, unknown>).telegramBotUsername);
}

function envBotUsername(): string | null {
  return normalizeBotUsername(process.env.TELEGRAM_BOT_USERNAME);
}

// ── TTL-cache: slug → username | null (null = «нет бота», тоже кэшируем) ─────

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const botCache = new Map<string, CacheEntry>();

function cachedLookup(slug: string): CacheEntry | null {
  const hit = botCache.get(slug);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    botCache.delete(slug);
    return null;
  }
  return hit;
}

/**
 * Резолвить бота экипажа по slug: contacts.telegramBotUsername → env → null.
 * Никогда не бросает; 1 лёгкий select по индексированному slug (TTL-кэш 5 мин).
 */
export async function resolveCrewBotUsername(slug: string | null | undefined): Promise<string | null> {
  const safeSlug = String(slug ?? "")
    .trim()
    .slice(0, 64);
  if (!safeSlug) return envBotUsername();

  const hit = cachedLookup(safeSlug);
  if (hit) return hit.value;

  let value: string | null = null;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase-server");
    const { data } = await supabaseAdmin
      .from("crews")
      .select("contacts")
      .eq("slug", safeSlug)
      .maybeSingle();
    value = botUsernameFromContacts((data as { contacts?: unknown } | null)?.contacts);
  } catch {
    // metadata недоступна — падаем на env ниже
  }
  value = value ?? envBotUsername();

  // Негативный ответ кэшим короче (60 с): бот могли только что прописать.
  botCache.set(safeSlug, { value, expiresAt: Date.now() + (value ? CACHE_TTL_MS : 60_000) });
  return value;
}

/** Сброс TTL-кэша. Для тестов (изоляция между кейсами) и для админ-флоу
 *  «только что прописали бота — не ждём 5 минут». */
export function clearCrewBotCache(): void {
  botCache.clear();
}

/**
 * Собрать deep link на Mini App бота экипажа.
 * botUsername === null → null: ссылки НЕ существует, вызывающий код грейсфулly
 * скрывает CTA (кнопку/строку), а не рендерит битую t.me/null/app.
 * startapp у Telegram — ограниченный charset (A-Za-z0-9_-), encodeURIComponent
 * на него не влияет, но страхует произвольные ключи (uuid, телефоны).
 */
export function crewBotAppLink(botUsername: string | null | undefined, startapp: string): string | null {
  const bot = normalizeBotUsername(botUsername);
  const safeParam = String(startapp ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 64);
  if (!bot || !safeParam) return null;
  return `https://t.me/${bot}/app?startapp=${encodeURIComponent(safeParam)}`;
}

/** База для кнопок-ссылок вида t.me/<bot>/app?startapp=... (без startapp). */
export function crewBotAppBase(botUsername: string | null | undefined): string | null {
  const bot = normalizeBotUsername(botUsername);
  return bot ? `https://t.me/${bot}/app` : null;
}
