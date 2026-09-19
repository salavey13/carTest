// app/franchize/lib/ride-share-notify.ts
// ─────────────────────────────────────────────────────────────────────────────
// «Поездка завершена» — финальное сообщение арендатору + cc экипажу (wall v4).
//
// Что уходит арендатору (после чека и review-nudge из confirmVehicleReturn):
//   🏁 сводка поездки (байк, время в седле, км по одометру, депозит)
//   + ГОТОВЫЙ ТЕКСТ ПОСТА для стены (summary baked in — редактируется),
//   + кнопка «Поделиться на стене» → startapp=wallp_<rentalId>_<slug>
//     → роутер ведёт на /franchize/<slug>/community?compose=<rentalId>,
//     композер открывается уже с этим текстом, упомянутым байком и
//     привязанной арендой (арендаторам постить разрешено — canWriteOnWall).
//
// cc экипажу (owner + админы, БЕЗ фанфаера всем членам): закрытая аренда с
// той же сводкой + пометка, что райдеру отправлено предложение поста.
//
// Чистые билдеры (summarizeRide / buildSuggestedWallPost / …) юнит-тестируются;
// доставка никогда не бросает. Ожидается await от caller'а (урок d275c52).
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { telegramDeliver } from "@/lib/telegram-transport";
import { escapeTelegramHtml } from "@/app/franchize/lib/community-wall";
import { rentalHours } from "@/app/franchize/lib/community-wall";
import {
  buildTelegramAppLink,
  sanitizeWallSlug,
  wallComposeStartParam,
  wallStartParam,
} from "@/lib/wall-deeplink";
import {
  leadDeeplinkUrl,
  resolveLeadNotifyRecipients,
} from "@/app/franchize/lib/new-lead-notify";

export { leadDeeplinkUrl as wallCrewDeeplinkUrl };

// ── pure summary ─────────────────────────────────────────────────────────────

export interface RideSummaryInput {
  bikeTitle: string;
  startIso: string | null;
  endIso: string | null;
  totalCost: number | string | null;
  odometerBefore: number | null;
  odometerAfter: number | null;
  depositReturned: boolean | null;
  crewName: string | null;
  crewSlug: string | null;
}

export interface RideSummary {
  bikeTitle: string;
  /** ceil(end − start) часов, минимум 1 (тот же расчёт, что у stats-постов). */
  hours: number;
  /** Сутки, если поездка длиннее 23 ч. */
  days: number | null;
  /** Км по одометру, только если обе отсечки валидны и дельта ≥ 0. */
  km: number | null;
  totalCost: number;
  depositReturned: boolean | null;
  crewName: string;
  crewSlug: string | null;
}

function toNum(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

export function summarizeRide(input: RideSummaryInput): RideSummary {
  const hours = Math.max(1, rentalHours(input.startIso, input.endIso));
  const kmRaw =
    input.odometerBefore != null && input.odometerAfter != null
      ? Math.round(Number(input.odometerAfter) - Number(input.odometerBefore))
      : Number.NaN;
  const km = Number.isFinite(kmRaw) && kmRaw >= 0 && kmRaw < 100000 ? kmRaw : null;
  return {
    bikeTitle: (input.bikeTitle || "").trim() || "байк",
    hours,
    days: hours >= 24 ? Math.floor(hours / 24) : null,
    km,
    totalCost: Math.round(toNum(input.totalCost)),
    depositReturned: input.depositReturned,
    crewName: (input.crewName || "").trim() || "экипаж",
    crewSlug: sanitizeWallSlug(input.crewSlug ?? null),
  };
}

/** «12 ч» / «3 дня 4 ч» — человекочитаемая длительность. */
export function formatRideDuration(summary: Pick<RideSummary, "hours" | "days">): string {
  if (summary.days && summary.days > 0) {
    const rest = summary.hours - summary.days * 24;
    return rest > 0 ? `${summary.days} д ${rest} ч` : `${summary.days} д`;
  }
  return `${summary.hours} ч`;
}

/**
 * Готовый текст поста: только факты из аренды, тёплый тон, без выдумок.
 * Теги в хвосте кормят discovery стены (#OnlyBike + бренд байка одним словом).
 */
export function buildSuggestedWallPost(summary: RideSummary): string {
  const parts: string[] = [];
  const duration = formatRideDuration(summary);
  const kmPart = summary.km && summary.km > 0 ? ` — ${summary.km} км за спиной` : "";
  parts.push(`Откатал ${duration} на ${summary.bikeTitle}${kmPart} 🏍💨`);
  if (summary.totalCost > 0) {
    parts.push(`Итого ${summary.totalCost.toLocaleString("ru-RU")} ₽ — впечатлений на все деньги.`);
  }
  if (summary.depositReturned === true) {
    parts.push(`Депозит вернули без танцев с бубном 👌`);
  }
  parts.push(`${summary.crewName} — рекомендую, катаю дальше!`);
  parts.push(`#OnlyBike`);
  return parts.join("\n");
}

// ── TG message builders (pure) ───────────────────────────────────────────────

export function buildRideFinishedRenterHtml(summary: RideSummary, suggestedPost: string): string {
  const lines: string[] = [
    `🏁 <b>Поездка завершена</b>`,
    ``,
    `🏍 ${escapeTelegramHtml(summary.bikeTitle)} · ${formatRideDuration(summary)} в седле`,
  ];
  if (summary.km && summary.km > 0) lines.push(`📏 ${summary.km} км за спиной`);
  if (summary.totalCost > 0) lines.push(`💰 Итого: ${summary.totalCost.toLocaleString("ru-RU")} ₽`);
  if (summary.depositReturned === true) lines.push(`✅ Депозит возвращён`);
  if (summary.depositReturned === false) lines.push(`⚠️ Депозит удержан — детали у оператора`);
  lines.push(
    ``,
    `Расскажи экипажу, как прокатился — пост уже составлен, можешь поправить и отправить:`,
    ``,
    `<i>${escapeTelegramHtml(suggestedPost).replace(/\n/g, "<br>")}</i>`,
  );
  return lines.join("\n");
}

export function buildRideFinishedCrewHtml(summary: RideSummary): string {
  const lines: string[] = [
    `✅ <b>Аренда закрыта</b>`,
    ``,
    `🏍 ${escapeTelegramHtml(summary.bikeTitle)} · ${formatRideDuration(summary)} в седле`,
  ];
  if (summary.km && summary.km > 0) lines.push(`📏 ${summary.km} км`);
  if (summary.totalCost > 0) lines.push(`💰 ${summary.totalCost.toLocaleString("ru-RU")} ₽`);
  lines.push(``, `Райдеру отправлено предложение поделиться постом на стене экипажа 🟣`);
  return lines.join("\n");
}

// ── delivery (never throws) ──────────────────────────────────────────────────

export interface RideFinishedNotifyInput {
  rentalId: string;
  crewSlug: string | null;
  summary: RideSummary;
  /** Арендатор (TG chat id) — может отсутствовать у бот-flow аренд. */
  renterChatId: string | null;
  /** CC экипажу без рядовых членов (owner + админы). */
  ccCrew?: boolean;
  /** Не слать cc-копию этому chat_id (например, если owner сам арендатор). */
  excludeCrewUserId?: string | null;
}

export interface RideFinishedNotifyResult {
  renterSent: boolean;
  crewRecipients: string[];
  crewSent: number;
  crewFailed: number;
}

function botUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME || null;
}

function composeDeepLinkUrl(slug: string, rentalId: string): string | null {
  const bot = botUsername();
  try {
    if (bot) return buildTelegramAppLink(bot, wallComposeStartParam(rentalId, slug));
    return null;
  } catch {
    return null;
  }
}

/**
 * Отправить арендатору сводку + предложение поста и cc экипажу.
 * Никогда не бросает; возвращаем счётчики для логов.
 */
export async function notifyRideFinishedAndSuggestPost(
  input: RideFinishedNotifyInput,
): Promise<RideFinishedNotifyResult> {
  const result: RideFinishedNotifyResult = {
    renterSent: false,
    crewRecipients: [],
    crewSent: 0,
    crewFailed: 0,
  };
  try {
    const slug = sanitizeWallSlug(input.crewSlug);
    const suggestedPost = buildSuggestedWallPost(input.summary);

    // ── renter: сводка + готовый пост + кнопка «Поделиться на стене» ──
    if (input.renterChatId) {
      const payload: Record<string, unknown> = {
        text: buildRideFinishedRenterHtml(input.summary, suggestedPost),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      const url = slug ? composeDeepLinkUrl(slug, input.rentalId) : null;
      if (url) {
        payload.reply_markup = {
          inline_keyboard: [[{ text: "🟣 Поделиться на стене экипажа", url }]],
        };
      }
      try {
        const res = await telegramDeliver("sendMessage", input.renterChatId, payload);
        result.renterSent = res.ok;
        if (!res.ok) logger.warn("[ride-share-notify] renter delivery failed", { error: res.error });
      } catch (error) {
        logger.warn("[ride-share-notify] renter delivery exception", error);
      }
    }

    // ── crew cc: owner + админы ──
    if (input.ccCrew !== false && slug) {
      const recipients = (await resolveLeadNotifyRecipients(slug, { includeMembers: false }))
        .filter((id) => id && id !== input.renterChatId && id !== input.excludeCrewUserId);
      result.crewRecipients = recipients;
      if (recipients.length > 0) {
        const crewText = buildRideFinishedCrewHtml(input.summary);
        const wallUrl = leadDeeplinkUrl(wallStartParam(slug));
        const crewPayload: Record<string, unknown> = {
          text: crewText,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: "🟣 Открыть стену", url: wallUrl }]],
          },
        };
        await Promise.allSettled(
          recipients.map(async (chatId) => {
            try {
              const res = await telegramDeliver("sendMessage", chatId, crewPayload);
              if (res.ok) result.crewSent += 1;
              else {
                result.crewFailed += 1;
                logger.warn("[ride-share-notify] crew delivery failed", { chatId, error: res.error });
              }
            } catch (error) {
              result.crewFailed += 1;
              logger.warn("[ride-share-notify] crew delivery exception", { chatId, error });
            }
          }),
        );
      }
    }
  } catch (error) {
    logger.warn("[ride-share-notify] crashed (rental closure unaffected)", error);
  }
  return result;
}
