// /app/franchize/server-actions/lead-notify.ts
"use server";

// "Уведомить" action from the lead detail sheet — sends a follow-up Telegram
// message from the crew bot to the lead's chat. Uses the self-hosted
// /api/forward-telegram proxy (same path as the Avito webhook owner ping)
// with the internal cron secret so the origin check passes for server-to-
// server calls.

import { logger } from "@/lib/logger";
import { z } from "zod";

interface NotifyLeadInput {
  slug: string;
  /** The lead's Telegram chat id (numeric string). */
  chatId: string;
  /** Optional custom message; defaults to a polite follow-up template. */
  text?: string;
}

interface NotifyLeadResult {
  success: boolean;
  error?: string;
}

function defaultFollowupText(bikeTitle?: string | null): string {
  const bike = bikeTitle ? ` (${bikeTitle})` : "";
  return [
    "Здравствуйте! Это VIP BIKE 👋",
    `Вы интересовались арендой мото${bike} — подскажите, остались вопросы?`,
    "Можем забронировать технику на удобные даты.",
  ].join("\n");
}

export async function notifyLeadViaTelegram(input: NotifyLeadInput): Promise<NotifyLeadResult> {
  try {
    const parsed = z
      .object({
        slug: z.string().trim().min(1),
        chatId: z.string().trim().regex(/^\d{3,15}$/, "chatId must be a Telegram numeric id"),
        text: z.string().trim().max(4000).optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Некорректные параметры уведомления." };
    }
    const { chatId, text } = parsed.data;
    const message = text?.trim() || defaultFollowupText(null);

    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
    const cronSecret =
      process.env.CRON_SECRET || process.env.CODEX_BRIDGE_CALLBACK_SECRET || "";
    const res = await fetch(`${base}/api/forward-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
      },
      body: JSON.stringify({
        chat_id: chatId,
        method: "sendMessage",
        payload: { text: message },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("[notifyLeadViaTelegram] forward-telegram failed", res.status, body.slice(0, 300));
      return {
        success: false,
        error: `Не удалось отправить сообщение (код ${res.status}). Лид мог не начать чат с ботом.`,
      };
    }
    return { success: true };
  } catch (err) {
    logger.error("[notifyLeadViaTelegram] exception:", err);
    return { success: false, error: "Ошибка отправки уведомления." };
  }
}
