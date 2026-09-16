// app/franchize/lib/new-lead-notify.ts
// ─────────────────────────────────────────────────────────────────────────
// Единое TG-уведомление «появился новый лид» для вебхуков, создающих лиды
// (Avito webhook, callback-lead с сайта). До этого каждый источник собирал
// свою рассылку: авито-вебхук звал /api/forward-telegram с НЕправильным
// payload ({chatId,text} вместо {chat_id,method,payload} — все уведомления
// падали с 400 незаметно, fire-and-forget), callback-lead слал только owner'у.
//
// Теперь:
//   · получатели — владелец экипажа + админы экипажа (role owner/admin/
//     co_owner, active) + опционально все активные члены + глобальный
//     ADMIN_CHAT_ID (тот же паттерн, что в superlist-clear.ts);
//   · доставка — telegramDeliver (либеральный транспорт: форвард через
//     Vercel + прямой фолбэк; на VPS api.telegram.org недоступен);
//   · к сообщению прикладывается deeplink в Mini App:
//       https://t.me/<bot>/app?startapp=lead_<leadKey>
//     useStartParamRouter роутит lead_ → /franchize/<slug>/leads?leadId=<key>,
//     LeadsClient открывает шторку лида (с поиском на сервере, если лид
//     вне загруженного окна).
//
// leadKey — СТАБИЛЬНЫЙ КЛЮЧ ЛИДА НА СТРАНИЦЕ ЛИДОВ, а не UUID строки:
//   · Avito-лид → id чата Авито (на странице ключ = "avito:<chatId>" или
//     нормализованный телефон, если он был найден в тексте; resolver на
//     клиенте проверяет оба варианта + metadata.avitoChatId);
//   · Заявка с сайта → цифры нормализованного телефона.
// Ключ санитизируется под допустимый charset startapp (A-Za-z0-9_-).

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { telegramDeliver } from "@/lib/telegram-transport";

/** Ссылка на Mini App бота (deeplink-база). */
export function telegramWebAppUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
  return base.replace(/\/+$/, "");
}

/**
 * startapp принимает ограниченный charset (A-Za-z0-9_-). Avito-чат — цифры,
 * bot_forward — "fwd-<hex>" (дефис допустим), телефон передаём цифрами.
 * Всё лишнее заменяем на "_", чтобы ссылка не умерла на ровном месте.
 */
export function sanitizeLeadKey(leadKey: string | null | undefined): string {
  return String(leadKey || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 60);
}

/** Deeplink на карточку лида: t.me/<bot>/app?startapp=lead_<key>. */
export function leadDeeplinkUrl(leadKey: string): string {
  const key = sanitizeLeadKey(leadKey);
  return `${telegramWebAppUrl()}?startapp=lead_${key}`;
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Получатели уведомления о новом лиде: owner экипажа + админы (owner/admin/
 * co_owner, active) + опционально все активные члены + глобальный ADMIN_CHAT_ID.
 * Дедуп через Set. Никогда не бросает — максимум пустой массив.
 */
export async function resolveLeadNotifyRecipients(
  slug: string,
  opts?: { includeMembers?: boolean },
): Promise<string[]> {
  const includeMembers = opts?.includeMembers !== false;
  const recipients = new Set<string>();
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (crew?.owner_id) recipients.add(String(crew.owner_id));
    if (crew?.id) {
      // Админы экипажа: role owner/admin/co_owner + active.
      const { data: admins } = await supabaseAdmin
        .from("crew_members")
        .select("user_id, role, membership_status")
        .eq("crew_id", crew.id)
        .in("role", ["owner", "admin", "co_owner"])
        .eq("membership_status", "active");
      for (const a of admins ?? []) {
        if (a?.user_id) recipients.add(String(a.user_id));
      }
      // Прежнее поведение авито-вебхука: все активные члены тоже в курсе.
      if (includeMembers) {
        const { data: members } = await supabaseAdmin
          .from("crew_members")
          .select("user_id")
          .eq("crew_id", crew.id)
          .eq("membership_status", "active");
        for (const m of members ?? []) {
          if (m?.user_id) recipients.add(String(m.user_id));
        }
      }
    }
  } catch (error) {
    logger.warn("[new-lead-notify] recipient lookup failed", error);
  }
  if (process.env.ADMIN_CHAT_ID) {
    recipients.add(String(process.env.ADMIN_CHAT_ID));
  }
  return Array.from(recipients);
}

export interface NewLeadNotifyInput {
  /** Slug экипажа (получатели ищутся по нему), например "vip-bike". */
  slug: string;
  /** Заголовок уведомления, например "Новый лид из Авито". */
  title: string;
  /** Ключ лида для deeplink (см. шапку файла). Обязателен. */
  leadKey: string;
  /** Имя покупателя/заявителя. */
  name?: string | null;
  /** Телефон, если известен. */
  phone?: string | null;
  /** Объявление/байк. */
  bikeTitle?: string | null;
  /** Первое сообщение покупателя / деталь заявки. */
  message?: string | null;
  /** Дополнительные строки перед ссылкой (уже без HTML-тегов). */
  extraLines?: string[];
  /** Подпись кнопки. */
  buttonLabel?: string;
  /** Все активные члены экипажа тоже получают (по умолчанию ДА). */
  includeMembers?: boolean;
}

export interface NewLeadNotifyResult {
  /** Кому пытались доставить (до дедупа). */
  recipients: string[];
  sent: number;
  failed: number;
}

/**
 * Разослать уведомление о новом лиде. Сообщение — HTML c кнопкой-ссылкой
 * на лид в Mini App. Никогда не бросает: неудачи доставки логируются и
 * считаются в failed (вебхук источника не должен падать из-за рассылки).
 */
export async function notifyNewLead(
  input: NewLeadNotifyInput,
): Promise<NewLeadNotifyResult> {
  const recipients = await resolveLeadNotifyRecipients(input.slug, {
    includeMembers: input.includeMembers,
  });
  const result: NewLeadNotifyResult = { recipients, sent: 0, failed: 0 };
  if (recipients.length === 0) {
    logger.warn("[new-lead-notify] no recipients, skipping", { slug: input.slug });
    return result;
  }

  const deeplink = leadDeeplinkUrl(input.leadKey);
  const lines: string[] = [`🟡 <b>${escHtml(input.title)}</b>`, ""];
  if (input.bikeTitle) lines.push(`📦 Объявление: ${escHtml(input.bikeTitle)}`);
  if (input.name) lines.push(`👤 ${escHtml(input.name)}`);
  if (input.phone) lines.push(`📞 ${escHtml(input.phone)}`);
  const extra = (input.extraLines ?? []).filter(Boolean);
  for (const line of extra) lines.push(escHtml(line));
  if (input.message) {
    const text = input.message.trim().slice(0, 300);
    if (text) lines.push(`💬 «${escHtml(text)}»`);
  }
  lines.push("");
  lines.push(`👉 <a href="${escHtml(deeplink)}">Открыть лид</a>`);
  const text = lines.join("\n");

  const payload: Record<string, unknown> = {
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: input.buttonLabel || "🟡 Открыть лид", url: deeplink }],
      ],
    },
  };

  await Promise.allSettled(
    recipients.map(async (chatId) => {
      try {
        const res = await telegramDeliver("sendMessage", chatId, payload);
        if (res.ok) {
          result.sent += 1;
        } else {
          result.failed += 1;
          logger.warn("[new-lead-notify] delivery failed", {
            chatId,
            error: res.error,
          });
        }
      } catch (error) {
        result.failed += 1;
        logger.warn("[new-lead-notify] delivery exception", { chatId, error });
      }
    }),
  );
  return result;
}
