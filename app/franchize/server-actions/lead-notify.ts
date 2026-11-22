// /app/franchize/server-actions/lead-notify.ts
"use server";

// "Уведомить" action from the lead detail sheet — sends a follow-up Telegram
// message from the crew bot to the lead's chat. Uses the self-hosted
// /api/forward-telegram proxy (same path as the Avito webhook owner ping)
// with the internal cron secret so the origin check passes for server-to-
// server calls.
//
// 2026-09-02 security fix (SA-003): server actions are publicly invokable
// endpoints. The previous version sent an arbitrary client-supplied text to
// an arbitrary client-supplied chat id — a free spam/phishing relay through
// the crew bot. Now:
//   1. the actor must be verified server-side (signed cookie / initData),
//   2. the actor must belong to the crew (owner / active member / admin),
//   3. the chat id must belong to a franchize_intents row of THIS crew,
//   4. the message body is built SERVER-side from a fixed template — the
//      client can only add the lead's bike title for context.

import { logger } from "@/lib/logger";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-server";
import { resolveServerActorUserId } from "./shared/auth-helpers";

interface NotifyLeadInput {
  slug: string;
  /** The lead's Telegram chat id (numeric string). */
  chatId: string;
  /** Lead's bike title — optional context woven into the fixed template. */
  bikeTitle?: string;
  /** Telegram WebApp initData — HMAC-verified fallback when cookies are blocked. */
  initData?: string;
}

interface NotifyLeadResult {
  success: boolean;
  error?: string;
}

function followupTemplate(bikeTitle?: string | null): string {
  const bike = bikeTitle?.trim() ? ` (${bikeTitle.trim()})` : "";
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
        bikeTitle: z.string().trim().max(200).optional(),
        initData: z.string().trim().optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Некорректные параметры уведомления." };
    }
    const { slug, chatId, bikeTitle, initData } = parsed.data;

    // ── SA-003: verify the actor server-side ──
    const actorUserId = await resolveServerActorUserId({
      claimedActorUserId: undefined,
      initData,
    });
    if (!actorUserId) {
      return { success: false, error: "Не авторизовано." };
    }

    // ── and check he belongs to this crew (owner / active member / admin) ──
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) return { success: false, error: "Экипаж не найден." };

    const isOwner = crew.owner_id === actorUserId;
    if (!isOwner) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("role, status, metadata")
        .eq("user_id", actorUserId)
        .maybeSingle();
      const meta = user?.metadata as Record<string, unknown> | null;
      const isGlobalAdmin =
        user?.role === "admin" || user?.role === "vprAdmin" || user?.status === "admin" ||
        meta?.role === "admin" || meta?.status === "admin";
      if (!isGlobalAdmin) {
        const { data: membership } = await supabaseAdmin
          .from("crew_members")
          .select("user_id")
          .eq("crew_id", crew.id)
          .eq("user_id", actorUserId)
          .eq("membership_status", "active")
          .maybeSingle();
        if (!membership) return { success: false, error: "Недостаточно прав." };
      }
    }

    // ── the lead's chat must belong to THIS crew's intents ──
    const { data: intent, error: intentErr } = await supabaseAdmin
      .from("franchize_intents")
      .select("id")
      .eq("slug", slug)
      .eq("telegram_user_id", chatId)
      .limit(1)
      .maybeSingle();
    if (intentErr) {
      logger.warn("[notifyLeadViaTelegram] intent lookup failed:", intentErr.message);
      return { success: false, error: "Не удалось проверить лида." };
    }
    if (!intent) {
      return { success: false, error: "Лид не найден в этом экипаже." };
    }

    const message = followupTemplate(bikeTitle);

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
