"use server";

// app/franchize/server-actions/wheel.ts
// ─────────────────────────────────────────────────────────────────────────────
// Серверный экшен колеса фортуны (boss codereview 2026-10-11, B3):
// победитель крутки получает DM с промокодом, crew owner + админам уходит
// сводка. См. lib/wheel-winner-notify.ts (текст, транспорт, rate-limit).
//
// Гигиена:
//  · личность — ТОЛЬКО resolveWallActor (подписанный cookie или
//    HMAC-верифицированный initData); аноним из веба → тихий no-op, спамить
//    owner'а нельзя без подписанного ботом initData;
//  · promoCode перепроверяется по WHEEL_PROMO_CODES (клиенту не верим),
//    prizeLabel/description берём из серверных констант — единый источник
//    правды с BUILT_IN_PROMO_CODES;
//  · dedupe (slug, user, код) раз в сутки — in-memory (см. lib, honest
//    at-least-once между инстансами);
//  · self-DM не дублируется: победитель-админ получает только личный DM.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { resolveWallActor } from "@/app/franchize/lib/wall-access";
import { resolveLeadNotifyRecipients } from "@/app/franchize/lib/new-lead-notify";
import {
  WHEEL_PROMO_CODES,
  wheelPrizeForCode,
} from "@/app/franchize/lib/wheel-of-fortune";
import {
  claimWheelWinNotifySlot,
  notifyWheelWinners,
  resolveWheelWinnerDisplayName,
} from "@/app/franchize/lib/wheel-winner-notify";

const wheelWinNotifySchema = z.object({
  slug: z.string().trim().min(1).max(64),
  promoCode: z.string().trim().min(1).max(32),
  initData: z.string().trim().max(8192).optional(),
});

export type WheelWinNotifyActionResult =
  | { ok: true; notified: boolean; winnerNotified: boolean; crewNotifiedCount: number }
  | { ok: false; error: string };

export async function notifyFranchizeWheelWinnerAction(input: unknown): Promise<WheelWinNotifyActionResult> {
  const parsed = wheelWinNotifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Некорректный запрос о выигрыше." };
  }
  const { slug: rawSlug, initData } = parsed.data;
  const promoCode = parsed.data.promoCode.toUpperCase().replace(/\s+/g, "");
  const slug = rawSlug.toLowerCase();

  // Код обязан быть колесным (не доверяем клиенту) — иначе любой смог бы
  // дергать уведомления с произвольным «кодом».
  const prize = wheelPrizeForCode(promoCode);
  if (!prize) {
    return { ok: false, error: "Этот приз не относится к колесу фортуны." };
  }

  // Анонимные посетители (обычный веб без Telegram) — тихо выходим:
  // некому слать личный DM и некого показывать в сводке.
  const actor = await resolveWallActor(initData);
  if (!actor) {
    return { ok: true, notified: false, winnerNotified: false, crewNotifiedCount: 0 };
  }

  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, name, metadata")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) {
      return { ok: false, error: "Витрина не найдена." };
    }

    // Дедуп ЗАНИМАЕМ только когда всё валидно (boss round 2: «витрина не
    // найдена» не должна сжигать суточный слот пользователя).
    if (!claimWheelWinNotifySlot(slug, actor.userId, promoCode)) {
      return { ok: true, notified: false, winnerNotified: false, crewNotifiedCount: 0 };
    }

    // Свежий профиль из initData точнее, чем запись в users — но cookie-сессии
    // не несут tg-профиль вообще (resolveWallActor → tg: null), и в сводку
    // улетал сырой chat id («525838009 выиграл…»). Boss 2026-10-25: добираем
    // ник/имя из public.users, сырой id — самый последний фолбэк.
    const { data: winnerProfile } = await supabaseAdmin
      .from("users")
      .select("username, full_name")
      .eq("user_id", actor.userId)
      .maybeSingle();
    const display = resolveWheelWinnerDisplayName(actor.tg, winnerProfile, actor.userId);
    const winnerName = display.name;
    const winnerUsername = display.username;

    // owner + crew admin/co_owner (активные) + ADMIN_CHAT_ID — тот же состав,
    // что у lead-notify; победителя из списка убираем (self-DM не дублируем).
    const crewRecipients = (await resolveLeadNotifyRecipients(slug, { includeMembers: false }))
      .filter((chatId) => chatId !== actor.userId);

    const metadata = (crew.metadata && typeof crew.metadata === "object" ? crew.metadata : {}) as Record<string, unknown>;
    const franchizeMeta = (metadata.franchize && typeof metadata.franchize === "object" ? metadata.franchize : {}) as Record<string, unknown>;
    const brandName =
      (typeof franchizeMeta.brandName === "string" && franchizeMeta.brandName.trim()) ||
      (typeof crew.name === "string" && crew.name.trim()) ||
      slug;

    const delivery = await notifyWheelWinners({
      slug,
      crewBrandName: brandName,
      winnerId: actor.userId,
      winnerName,
      winnerUsername,
      prizeLabel: prize.label,
      promoCode,
      description: prize.description,
      crewRecipientIds: crewRecipients,
    });

    logger.info("[wheel] winner notify dispatched", {
      slug,
      promoCode,
      winnerNotified: delivery.winnerNotified,
      crewNotifiedCount: delivery.crewNotifiedCount,
    });
    return {
      ok: true,
      notified: delivery.winnerNotified || delivery.crewNotifiedCount > 0,
      winnerNotified: delivery.winnerNotified,
      crewNotifiedCount: delivery.crewNotifiedCount,
    };
  } catch (error) {
    logger.warn("[wheel] winner notify failed (spin unaffected)", error);
    return { ok: true, notified: false, winnerNotified: false, crewNotifiedCount: 0 };
  }
}

/** Призы колеса — для витрин/админки (то же перечисление, что на клиенте). */
export async function getFranchizeWheelPrizes(): Promise<ReadonlyArray<{ code: string; label: string; description: string }>> {
  return WHEEL_PROMO_CODES.map((promo) => ({
    code: promo.code,
    label: promo.label,
    description: `Промокод ${promo.code} — скидка ${promo.label} на аренду или покупку`,
  }));
}
