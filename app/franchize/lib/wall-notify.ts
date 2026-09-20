// app/franchize/lib/wall-notify.ts
// ─────────────────────────────────────────────────────────────────────────────
// TG-уведомление «на стене экипажа новый пост».
//
// Переиспользует проверенную обвязку лид-уведомлений (new-lead-notify.ts):
//   · получатели — resolveLeadNotifyRecipients(slug): owner + админы экипажа
//     (owner/admin/co_owner, active) + все активные члены + глобальный
//     ADMIN_CHAT_ID, дедуп через Set;
//   · доставка — telegramDeliver (форвард через Vercel + прямой фолбэк);
//   · сообщение строит чистый buildWallPostNotifyHtml из lib/community-wall.ts
//     (юнит-тестируется отдельно);
//   · deeplink — startapp=wall_<slug>, useStartParamRouter роутит в
//     /franchize/<slug>/community.
//
// Вызывается из createCommunityPostAction ПОСЛЕ успешной вставки и
// ОБЯЗАТЕЛЬНО awaited: fire-and-forget в server action на Vercel
// подмораживается после ответа — доставка начинает пропадать
// (урок коммита d275c52/34a84e2: потерянный await → рандомные пропуски).
// Сама функция никогда не бросает: пост не должен «пропасть» из-за уведомления.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { telegramDeliver } from "@/lib/telegram-transport";
import { buildWallPostNotifyHtml } from "@/app/franchize/lib/community-wall";
import {
  buildTelegramAppLink,
  isUuidLike,
  wallPostStartParam,
  wallStartParam,
} from "@/lib/wall-deeplink";
import {
  resolveLeadNotifyRecipients,
  sanitizeLeadKey,
} from "@/app/franchize/lib/new-lead-notify";
import { filterWallNotifyRecipients } from "@/app/franchize/lib/wall-prefs";
import { normalizeBotUsername, resolveCrewBotUsername } from "@/app/franchize/lib/crew-bot";

// NOTE: leadDeeplinkUrl сознательно НЕ ре-экспортируется и НЕ используется:
// тот префиксует startapp как lead_… — кнопки стены на таком deeplink уводили
// роутер на СТРАНИЦУ ЛИДОВ (баг wall v2, найден boss-ревью v4). Только
// buildTelegramAppLink(bot, wall_/post_/wallp_…) + web-фолбэк.

export interface WallPostNotifyInput {
  /** Slug экипажа, например "vip-bike". */
  slug: string;
  /** Id поста — если есть, кнопка ведёт К ПОСТУ (startapp=post_<id>_<slug>),
   *  а не к верху стены (роутер FAST path + подсветка поста). */
  postId?: string | null;
  /** Имя автора для сообщения. */
  authorName: string;
  /** Текст поста (обрезается до превью внутри билдера). */
  body: string;
  /** Сколько фото прикреплено. */
  photoCount: number;
  /** Названия упомянутых байков из каталога. */
  bikeTitles: string[];
  /** Пост делится статистикой поездок (kind='stats'). */
  hasStats: boolean;
  /** Author получает уведомление о своём посте? Нет — исключаем его chat_id. */
  excludeUserId?: string | null;
  /** Сколько постов автор написал за последний час (бюджет рассылки). */
  recentAuthorPosts?: number;
}

export interface WallPostNotifyResult {
  recipients: string[];
  sent: number;
  failed: number;
}

/** Deeplink на стену экипажа: t.me/<bot>/app?startapp=wall_<slug>.
 *  ⚠️ НЕ через leadDeeplinkUrl: тот клал префикс lead_ → startapp=lead_wall_<slug>
 *  → роутер матчил lead_-ветку и уводил на СТРАНИЦУ ЛИДОВ (баг времён wall v2,
 *  найден boss-ревью v4). Плюс web-фолбэк, когда имя бота не настроено.
 *  Фикс 2026-09-21: botUsername резолвится из crew metadata
 *  (contacts.telegramBotUsername) вызывающим кодом; env — фолбэк. */
export function wallDeeplinkUrl(slug: string, botUsername?: string | null): string {
  const safeSlug = sanitizeLeadKey(slug);
  const bot = normalizeBotUsername(botUsername) ?? normalizeBotUsername(process.env.TELEGRAM_BOT_USERNAME);
  if (bot) {
    try {
      return buildTelegramAppLink(bot, wallStartParam(safeSlug));
    } catch {
      // fall through to web
    }
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
  return `${site.replace(/\/+$/, "")}/franchize/${encodeURIComponent(safeSlug)}/community`;
}

/**
 * Разослать экипажу уведомление о новом посте на стене. Никогда не бросает.
 * Ожидается await от caller'а (см. шапку файла).
 *
 * Антиспам-бюджет: автор, который уже завалил стену (≥3 постов за час),
 * будит только owner'а и админов — активные члены получают DM максимум
 * от первых трёх постов автора в час.
 */
export const WALL_NOTIFY_MEMBER_FANOUT_THRESHOLD = 3;

export async function notifyNewWallPost(
  input: WallPostNotifyInput,
): Promise<WallPostNotifyResult> {
  const result: WallPostNotifyResult = { recipients: [], sent: 0, failed: 0 };
  try {
    const quietMode = (input.recentAuthorPosts ?? 0) >= WALL_NOTIFY_MEMBER_FANOUT_THRESHOLD;
    const resolved = await resolveLeadNotifyRecipients(input.slug, {
      includeMembers: !quietMode,
    });
    // Preference-aware fanout (wall v6): «Стена экипажа» opt-out wins —
    // owner/admins included (a mute is a mute). Never throws.
    const targets = (await filterWallNotifyRecipients(resolved, input.slug)).filter(
      (id) => id && id !== input.excludeUserId,
    );
    result.recipients = targets;
    if (targets.length === 0) {
      logger.warn("[wall-notify] no recipients, skipping", { slug: input.slug });
      return result;
    }

    // Фикс 2026-09-21: бот из crew metadata, а не только env (в проде пуст →
    // кнопки уводили на web-страницу вместо Mini App).
    const crewBot = await resolveCrewBotUsername(input.slug);

    const deeplink =
      input.postId && isUuidLike(input.postId)
        ? // Точный пост: Mini App открывается сразу на нём (wall v4).
          // ⚠️ Без crewBot НЕ хардкодим «oneBikePlsBot»: у экипажа может быть
          // СВОЙ бот (oneCrossPlsBot) — неверный бот = битая ссылка.
          crewBot
          ? (() => {
              try {
                return buildTelegramAppLink(crewBot, wallPostStartParam(input.postId!, input.slug));
              } catch {
                return wallDeeplinkUrl(input.slug, crewBot);
              }
            })()
          : wallDeeplinkUrl(input.slug, crewBot)
        : wallDeeplinkUrl(input.slug, crewBot);
    const text = buildWallPostNotifyHtml({
      authorName: input.authorName,
      body: input.body,
      photoCount: input.photoCount,
      bikeTitles: input.bikeTitles,
      hasStats: input.hasStats,
    });
    const payload: Record<string, unknown> = {
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: "🟣 Открыть стену", url: deeplink }]],
      },
    };

    await Promise.allSettled(
      targets.map(async (chatId) => {
        try {
          const res = await telegramDeliver("sendMessage", chatId, payload);
          if (res.ok) {
            result.sent += 1;
          } else {
            result.failed += 1;
            logger.warn("[wall-notify] delivery failed", { chatId, error: res.error });
          }
        } catch (error) {
          result.failed += 1;
          logger.warn("[wall-notify] delivery exception", { chatId, error });
        }
      }),
    );
  } catch (error) {
    logger.warn("[wall-notify] notify crashed (post unaffected)", error);
  }
  return result;
}
