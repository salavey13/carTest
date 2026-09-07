// /app/franchize/lib/lead-events.ts
//
// LEAD GAME — серверная обёртка журнала истории (запись в БД).
// Чистая логика (типы, веса очков, агрегация лидерборда) живёт в
// lead-event-core.ts и реэкспортируется отсюда для серверных потребителей.
//
// «Обслуживание лидов — соревнование» (owner, 2026-09-07): каждое действие
// над лидом записывается фактом в public.lead_events — история переживает
// производные строки, видна всей команде (как у мото в «Мотопарке») и
// кормит прозрачный лидерборд. Прогресс засчитывается НЕ только за
// закрытия: быстрый ответ, перезвон, задача, заметка — всё в очках.
//
// Правила:
//   * recordLeadEvent — best-effort: НИКОГДА не бросает и не блокирует
//     основной маршрут (история важна, но работа с клиентом важнее).
//   * Очки — только за действия с атрибуцией (actor). Служебные события
//     без оператора ('avito-agent') очков не дают — иначе ingest-поток
//     Авито «накрутит» лидерборд без людей.
//   * Веса в ОДНОМ месте (LEAD_EVENT_POINTS в core) — UI и тесты читают.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  LEAD_EVENT_POINTS,
  computeLeadLeaderboard,
  type LeadEventType,
  type LeadLeaderboardRow,
} from "@/app/franchize/lib/lead-event-core";

export { LEAD_EVENT_POINTS, computeLeadLeaderboard };
export type { LeadEventType, LeadLeaderboardRow };

export interface LeadEventInput {
  crewSlug: string;
  /** Ключ лида — тот же, что в crew_todos.lead_id (TG id / телефон / "avito:<chat_id>"). */
  leadId: string;
  type: LeadEventType;
  /** Telegram user_id оператора или служебный источник ("avito-agent"). */
  actor?: string | null;
  /** Человекочитаемое имя оператора (резолвится вызывающим, если известно). */
  actorName?: string | null;
  label: string;
  detail?: string | null;
  /** Переопределение очков (например, снятие отметки — событие есть, очков нет). */
  pointsOverride?: number;
}

/**
 * Best-effort запись события в журнал. Возвращает true, если строка записана.
 * Очки подставляются из LEAD_EVENT_POINTS автоматически, но ТОЛЬКО для
 * реальных операторов — служебный actor "avito-agent" очков не получает.
 */
export async function recordLeadEvent(input: LeadEventInput): Promise<boolean> {
  const { crewSlug, leadId, type, actor, actorName, label, detail, pointsOverride } = input;
  if (!crewSlug || !leadId || !type || !label) return false;
  const isHumanActor = !!actor && actor !== "avito-agent" && /^\d{1,12}$/.test(actor);
  const points = pointsOverride ?? (isHumanActor ? (LEAD_EVENT_POINTS[type] ?? 0) : 0);
  try {
    const { error } = await supabaseAdmin.from("lead_events").insert({
      crew_slug: crewSlug,
      lead_id: String(leadId).slice(0, 200),
      type,
      actor: actor ? String(actor).slice(0, 60) : null,
      actor_name: actorName ? String(actorName).slice(0, 120) : null,
      label: String(label).slice(0, 300),
      detail: detail ? String(detail).slice(0, 1000) : null,
      points: isHumanActor ? Math.max(0, Math.round(points)) : 0,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    // Журнал не должен ломать основной поток: webhook обязан отвечать Авито
    // за 2с, операторские маршруты — не видеть 500 из-за истории.
    logger.warn(`[lead-events] record ${type} failed (best-effort)`, error);
    return false;
  }
}
