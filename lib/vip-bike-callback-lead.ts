import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

const marketingTouchSchema = z
  .object({
    utm_source: optionalText(500),
    utm_medium: optionalText(500),
    utm_campaign: optionalText(500),
    utm_content: optionalText(500),
    utm_term: optionalText(500),
    yclid: optionalText(500),
    campaign_id: optionalText(500),
    ad_id: optionalText(500),
    adgroup_id: optionalText(500),
    gbid: optionalText(500),
    keyword: optionalText(500),
    device: optionalText(500),
    region_name: optionalText(500),
    landing_path: z.string().trim().min(1).max(500),
    referrer_host: optionalText(500),
    captured_at: z.string().datetime(),
  })
  .strict();

export const callbackLeadRequestSchema = z
  .object({
    slug: z.literal("vip-bike").default("vip-bike"),
    bikeId: optionalText(160),
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(10).max(40),
    consent: z.literal(true),
    /** Telegram-ник клиента (форма на маркетинговом сайте, поле «@username»). */
    nick: optionalText(80),
    /**
     * Метка формы-источника с маркетингового сайта (data-ym-form-source,
     * например "home-final"). Только для отображения — атрибуция живёт в
     * attribution/utm.
     */
    formSource: optionalText(80),
    /**
     * Реальная посадочная страница клиента с сайта-источника. Сервер
     * подставляет её в source_route, т.к. server-to-server POST не несёт
     * Referer браузера. Пропускаем только path+query-подобные строки.
     */
    landingPath: optionalText(500),
    /**
     * Название модели с формы маркетингового сайта (поле «model», свободный
     * текст — НЕ id каталога). Падает в metadata.bikeTitle для отображения.
     */
    bikeTitle: optionalText(160),
    /**
     * Ответы квиза с формы сайта ({"права": "есть", ...}) — только примитивы,
     * кладётся в metadata.quiz. Санитизация — в normalizeSiteLeadPayload.
     */
    quiz: z
      .record(z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
      .optional(),
    attribution: z
      .object({
        first_touch: marketingTouchSchema,
        last_touch: marketingTouchSchema,
        expires_at: z.string().datetime(),
      })
      .strict()
      .nullable()
      .optional(),
    website: z.string().max(0).optional(),
  })
  .strict();

export type CallbackLeadRequest = z.infer<typeof callbackLeadRequestSchema>;

const TELEGRAM_MESSAGE_MAX_LENGTH = 4_096;
const TELEGRAM_MESSAGE_SAFE_LENGTH = 3_900;

function line(label: string, value: unknown): string | null {
  const text =
    typeof value === "string"
      ? value
          .replace(/[\u0000-\u001F\u007F]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  return text ? `${label}: ${text}` : null;
}

export function buildVipBikeCallbackMessage(input: {
  name: string;
  phone: string;
  bikeTitle?: string;
  sourceRoute?: string;
  nick?: string;
  formSource?: string;
  attribution?: CallbackLeadRequest["attribution"];
  createdAt: string;
}): string {
  const touch = input.attribution?.last_touch;
  // Заявки, проксируемые с маркетингового сайта, помечаем отдельным заголовком,
  // чтобы оператор сразу видел источник (форма сайта ≠ лендинг аренды).
  const header = input.formSource
    ? "Новая заявка с сайта vip-bike.ru"
    : "Новая заявка с rental.vip-bike.ru";
  const message = [
    header,
    "",
    line("Байк", input.bikeTitle || "Не выбран"),
    line("Имя", input.name),
    line("Телефон", input.phone),
    line("Ник", input.nick),
    line("Форма", input.formSource),
    line("Страница", input.sourceRoute || touch?.landing_path || "/"),
    line("Источник", touch?.utm_source || touch?.referrer_host || "прямой переход"),
    line("Канал", touch?.utm_medium),
    line("Кампания", touch?.utm_campaign || touch?.campaign_id),
    line("Группа", touch?.adgroup_id || touch?.gbid),
    line("Объявление", touch?.ad_id || touch?.utm_content),
    line("Запрос", touch?.utm_term || touch?.keyword),
    line("yclid", touch?.yclid),
    line("Время", input.createdAt),
  ]
    .filter((value): value is string => value !== null)
    .join("\n");

  if (message.length <= TELEGRAM_MESSAGE_MAX_LENGTH) return message;
  return `${message.slice(0, TELEGRAM_MESSAGE_SAFE_LENGTH).trimEnd()}\n[сообщение сокращено]`;
}
