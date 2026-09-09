// /app/franchize/lib/superlist-clear.ts
//
// СУПЕРЛИСТ ЗАКРЫТ — серверная оркестрация (запись снапшота, гранты,
// Telegram). Чистая логика (детекция/подписи/кулдаун) — в superlist-clear-core.ts
// (паттерн lead-event-core.ts / lead-events.ts): ядро без серверных импортов,
// чтобы его можно было тестировать и читать из браузера без пробуждения
// lib/supabase-server.
//
// Оркестрация — best-effort: НИКОГДА не бросает и не ломает выдачу страницы
// лидов. Все записи await'ятся — на serverless (Vercel) «void …» после
// ответа замораживается (см. фикс 2026-09-08 в lead-handling/route.ts).
//
// Поток maybeCelebrateSuperlistClear (точка входа из getFranchizeLeads):
//   1. read crews (metadata, updated_at, name) — снапшот + имя экипажа;
//   2. evaluateSuperlistClear (чистое ядро) → decision | null;
//   3. CAS-запись нового снапшота (мы владеем только ключом superlist);
//      праздник — ТОЛЬКО у победителя CAS: проигравший увидит свежий
//      lastClearAt и молча пропустит (антиспам при параллельных рефрешах);
//   4. celebrate: бейдж «Суперлист под ноль» (+вехи 5/15 по личным
//      закрытиям) через grantFranchizeAchievementAction (первый разблок сам
//      рассылает «Новое достижение» closer'у + владельцу + админам и
//      проверяет порог звания), журнал +25 очков closer'у, Telegram-сводка
//      closer + владелец + админы экипажа + глобальный ADMIN_CHAT_ID.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { recordLeadEvent } from "@/app/franchize/lib/lead-events";
import { grantFranchizeAchievementAction } from "@/app/franchize/profile-actions";
import {
  evaluateSuperlistClear,
  nextSuperlistSnapshot,
  pluralSuperlistItems,
  snapshotNeedsWrite,
  SUPERLIST_COOLDOWN_MS,
  SUPERLIST_MILESTONES,
  SUPERLIST_POINTS,
  type SuperlistClearDecision,
  type SuperlistEventRow,
  type SuperlistSnapshotState,
} from "@/app/franchize/lib/superlist-clear-core";
import type { NextAction } from "@/app/franchize/[slug]/leads/lib/lead-playbook";
import type { LeadsSuperlistState } from "@/app/franchize/[slug]/leads/leads-types";

export {
  evaluateSuperlistClear,
  nextSuperlistSnapshot,
  superlistActionSignature,
  snapshotNeedsWrite,
  SUPERLIST_COOLDOWN_MS,
  SUPERLIST_MIN_ITEMS,
  SUPERLIST_MIN_WORK_EVENTS,
  SUPERLIST_MILESTONES,
  SUPERLIST_POINTS,
  SUPERLIST_SNAPSHOT_MAX_AGE_MS,
} from "@/app/franchize/lib/superlist-clear-core";

const CAS_RETRIES = 3;

function parseSnapshot(metadata: Record<string, any> | null): SuperlistSnapshotState | null {
  const raw = metadata?.superlist;
  if (!raw || typeof raw !== "object") return null;
  const count = Number((raw as any).count);
  const at = typeof (raw as any).at === "string" ? (raw as any).at : "";
  if (!Number.isFinite(count) || !at) return null;
  return {
    count,
    at,
    items: Array.isArray((raw as any).items)
      ? (raw as any).items.filter((s: unknown): s is string => typeof s === "string")
      : [],
    lastClearAt: typeof (raw as any).lastClearAt === "string" ? (raw as any).lastClearAt : null,
    totalClears: Number.isFinite(Number((raw as any).totalClears)) ? Number((raw as any).totalClears) : 0,
  };
}

// snapshotNeedsWrite живёт в ядре (чистая) — см. re-export выше.

/** Имя оператора для сообщений: full_name → username → id. */
async function resolveOperatorName(userId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("username, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    const name = (data?.full_name as string) || (data?.username as string);
    return name && name.trim() ? name.trim() : userId;
  } catch {
    return userId;
  }
}

/** Фанфары: бейдж + веха closer'у, журнал +25 очков, Telegram всем главным. */
async function celebrateSuperlistClear(params: {
  slug: string;
  crewId: string;
  crewName: string;
  decision: SuperlistClearDecision;
}): Promise<void> {
  const { slug, crewId, crewName, decision } = params;
  const { closerId, itemsCount, workEvents, totalClears } = decision;

  // Личный счётчик закрытий ДО гранта (вехи по личным закрытиям).
  let prevPersonal = 0;
  try {
    const { data: closerRow } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", closerId)
      .maybeSingle();
    const profiles = ((closerRow?.metadata as any)?.franchizeProfiles || {}) as Record<string, any>;
    prevPersonal = Number(profiles[slug]?.counters?.superlistClears || 0);
  } catch (counterErr) {
    logger.warn("[superlist] personal counter read failed (milestones may lag)", counterErr);
  }

  // 1. Бейдж closer'у (+1 в counters.superlistClears). Первый разблок — сам
  //    разошлёт «Новое достижение» closer'у + владельцу + админам (см.
  //    notifyAchievementUnlocked) и проверит пересечение порога звания.
  const grant = await grantFranchizeAchievementAction({
    slug,
    userId: closerId,
    achievementId: "superlist_clear",
    source: "leads:superlist_cleared",
    context: { itemsCount, workEvents, totalClears },
    incrementCounters: { superlistClears: 1 },
  });
  if (grant.success) {
    const nextPersonal = prevPersonal + 1;
    const milestone = SUPERLIST_MILESTONES.find((m) => m.at === nextPersonal);
    if (milestone) {
      await grantFranchizeAchievementAction({
        slug,
        userId: closerId,
        achievementId: milestone.achievementId,
        source: "leads:superlist_cleared",
        context: { itemsCount, totalClears, personalClears: nextPersonal },
      });
    }
  } else {
    logger.warn("[superlist] badge grant failed (celebration continues)", grant.error);
  }

  // 2. Журнал + очки лидерборда (+25 closer'у по LEAD_EVENT_POINTS —
  //    очки подставляются автоматически для живого актора).
  await recordLeadEvent({
    crewSlug: slug,
    leadId: "superlist",
    type: "superlist_cleared",
    actor: closerId,
    label: "Суперлист закрыт полностью",
    detail: `позиций в списке: ${itemsCount} · закрытие №${totalClears} экипажа`,
  });

  // 3. Telegram: closer + владелец + админы экипажа + глобальный ADMIN_CHAT_ID.
  try {
    const closerName = await resolveOperatorName(closerId);
    const { sendComplexMessage } = await import("@/app/webhook-handlers/actions/sendComplexMessage");
    const lines = [
      `🏆 <b>Суперлист закрыт полностью!</b>`,
      "",
      `Экипаж <b>${crewName}</b> разобрал весь список «что делать сейчас» — ${itemsCount} ${pluralSuperlistItems(itemsCount)} под ноль: горячие отвечены, перезвоны сделаны, молчуны реанимированы.`,
      "",
      `🥇 Финальный аккорд — <b>${closerName}</b> (+${SUPERLIST_POINTS} очков в лидерборде)`,
      `📊 Полных закрытий суперлиста у экипажа: ${totalClears}`,
    ];
    const text = lines.join("\n");

    const recipients = new Set<string>([closerId]);
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", crewId)
      .maybeSingle();
    if (crew?.owner_id) recipients.add(String(crew.owner_id));
    const { data: admins } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crewId)
      .in("role", ["owner", "admin", "co_owner"])
      .eq("membership_status", "active");
    for (const a of (admins ?? []) as Array<{ user_id: string | number }>) {
      recipients.add(String(a.user_id));
    }
    if (process.env.ADMIN_CHAT_ID) recipients.add(String(process.env.ADMIN_CHAT_ID));

    for (const chatId of recipients) {
      try {
        await sendComplexMessage(chatId, text, [], { parseMode: "HTML" });
      } catch (sendErr) {
        logger.warn("[superlist] tg send failed (non-fatal)", { chatId, sendErr });
      }
    }
  } catch (notifyErr) {
    logger.warn("[superlist] notify failed (non-fatal)", notifyErr);
  }
}

/** Клиентское состояние для agg.superlist / баннера панели. */
function buildClientState(
  snapshot: SuperlistSnapshotState | null,
  justCleared: boolean,
): LeadsSuperlistState {
  return {
    justCleared,
    lastClearedAt: snapshot?.lastClearAt ?? null,
    totalClears: Number.isFinite(snapshot?.totalClears) ? Number(snapshot?.totalClears) : 0,
  };
}

/**
 * Точка входа из getFranchizeLeads: сравнивает текущую очередь плейбука со
 * снапшотом, при полном покрытии празднует и в любом случае обновляет
 * снапшот (CAS). НИКОГДА не бросает. Возвращает состояние для UI-баннера
 * (agg.superlist) или null, если суперлист-механика ничего не меняла.
 */
export async function maybeCelebrateSuperlistClear(params: {
  slug: string;
  crewId: string;
  queue: NextAction[];
  /** Журнал lead_events экипажа (уже прочитан getFranchizeLeads — 30 суток). */
  events: SuperlistEventRow[];
  nowMs?: number;
}): Promise<LeadsSuperlistState | null> {
  const { slug, crewId, queue, events } = params;
  const nowMs = params.nowMs ?? Date.now();
  try {
    const { data: crewRow } = await supabaseAdmin
      .from("crews")
      .select("metadata, updated_at, name")
      .eq("id", crewId)
      .maybeSingle();
    if (!crewRow) return null;
    const crewName = (crewRow.name as string) || slug;

    const metadata = ((crewRow.metadata || {}) as Record<string, any>) || {};
    const snapshot = parseSnapshot(metadata);
    const decision = evaluateSuperlistClear({ snapshot, queue, events, nowMs });
    const nowIso = new Date(nowMs).toISOString();
    const next = nextSuperlistSnapshot(snapshot, queue, decision, nowIso);

    // Ничего не изменилось (тихий рефреш той же очереди) — и писать нечего.
    if (!snapshotNeedsWrite(snapshot, next)) {
      return buildClientState(snapshot, false);
    }

    // CAS-запись снапшота (мы владеем только ключом superlist в metadata).
    for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
      const seenUpdatedAt = (crewRow as { updated_at?: string | null }).updated_at ?? null;
      const nextMetadata = { ...metadata, superlist: next };
      const baseUpdate = supabaseAdmin
        .from("crews")
        .update({ metadata: nextMetadata, updated_at: nowIso }, { count: "exact" })
        .eq("id", crewId);
      const { error: updateError, count } =
        seenUpdatedAt == null
          ? await baseUpdate.is("updated_at", null)
          : await baseUpdate.eq("updated_at", seenUpdatedAt);

      if (updateError) {
        logger.warn("[superlist] snapshot write failed (best-effort)", updateError);
        return decision ? null : buildClientState(snapshot, false);
      }
      if ((count ?? 1) > 0) {
        // Наш снапшот записан. Празднуем ТОЛЬКО если CAS выигран — второй
        // конкурент увидит свежий lastClearAt/кулдаун и молча пропустит.
        if (decision) {
          await celebrateSuperlistClear({ slug, crewId, crewName, decision });
          return buildClientState(next, true);
        }
        return buildClientState(next, false);
      }

      // CAS проигран: чей-то параллельный record. Перечитываем metadata;
      // если там уже свежий праздник — наша очередь молчать (празднует
      // победитель гонки). Иначе повторяем слияние на свежем metadata
      // (конфигуратор мог писать между попытками).
      const { data: freshRow } = await supabaseAdmin
        .from("crews")
        .select("metadata, updated_at")
        .eq("id", crewId)
        .maybeSingle();
      if (!freshRow) return null;
      const freshMetadata = ((freshRow.metadata || {}) as Record<string, any>) || {};
      const freshSnapshot = parseSnapshot(freshMetadata);
      if (
        decision &&
        freshSnapshot?.lastClearAt &&
        nowMs - new Date(freshSnapshot.lastClearAt).getTime() < SUPERLIST_COOLDOWN_MS
      ) {
        return buildClientState(freshSnapshot, false);
      }
      const retryNext = nextSuperlistSnapshot(freshSnapshot, queue, decision, nowIso);
      if (!snapshotNeedsWrite(freshSnapshot, retryNext)) {
        return decision ? null : buildClientState(freshSnapshot, false);
      }
      Object.assign(metadata, freshMetadata);
      (crewRow as any).updated_at = (freshRow as any).updated_at;
      continue;
    }

    logger.warn("[superlist] CAS retries exhausted (skip, next cycle retries)");
    return decision ? null : buildClientState(snapshot, false);
  } catch (error) {
    logger.warn("[superlist] detection failed (non-fatal)", error);
    return null;
  }
}
