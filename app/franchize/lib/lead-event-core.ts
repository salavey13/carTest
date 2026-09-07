// /app/franchize/lib/lead-event-core.ts
//
// ЧИСТАЯ логика Lead Game (без серверных импортов) — чтобы её можно было
// импортировать из тестов и клиентских компонентов без пробуждения
// lib/supabase-server (который бросает исключение в браузере/vitest).
// Серверная обёртка recordLeadEvent живёт в lead-events.ts.

export type LeadEventType =
  | "lead_created" // лид появился в CRM (вебхук, callback, форма)
  | "avito_message" // входящее сообщение покупателя (накопление контекста)
  | "analysis_attached" // AI-пасс приложил разбор/факты к лиду
  | "lead_handled" // «взял в работу / отработан»
  | "callback_set" // назначен перезвон
  | "callback_completed" // перезвон состоялся (звонок сделан)
  | "todo_created"
  | "todo_completed"
  | "note_added"
  | "notify_sent" // оператор отправил TG-уведомление клиенту
  | "stage_changed"
  | "closed_won"
  | "closed_lost";

/** Очки лидерборда за одно событие (атрибуция обязательна). */
export const LEAD_EVENT_POINTS: Record<LeadEventType, number> = {
  lead_created: 0, // канал, не заслуга оператора
  avito_message: 0,
  analysis_attached: 0,
  lead_handled: 3, // реакция на лид — главный «не только закрытия» прогресс
  callback_set: 1,
  callback_completed: 5, // состоявшийся звонок — дорого
  todo_created: 1,
  todo_completed: 2,
  note_added: 1,
  notify_sent: 1,
  stage_changed: 2, // движение по воронке
  closed_won: 10, // закрытие — вершина, но не единственное
  closed_lost: 0, // потери не штрафуем очками (причины важнее)
};

export interface LeadLeaderboardRow {
  id: string;
  name: string;
  points: number;
  handled: number;
  callbacks: number;
  todoDone: number;
  notes: number;
  closed: number;
  lastActionAt: string | null;
}

interface LeadEventRecord {
  type: string;
  actor: string | null;
  actorName: string | null;
  points: number;
  createdAt: string;
}

/**
 * Агрегация записанных событий в лидерборд. ПОЛНОСТЬЮ серверная — все
 * участники экипажа видят одинаковые цифры (не localStorage, как раньше).
 * events — уже crew-scoped строки из lead_events за период (форма LeadEventRow).
 */
export function computeLeadLeaderboard(
  events: LeadEventRecord[],
  operatorNames: Map<string, string>,
): LeadLeaderboardRow[] {
  const byId = new Map<string, LeadLeaderboardRow>();
  const ensure = (id: string): LeadLeaderboardRow => {
    let row = byId.get(id);
    if (!row) {
      row = {
        id,
        name: operatorNames.get(id) || id,
        points: 0,
        handled: 0,
        callbacks: 0,
        todoDone: 0,
        notes: 0,
        closed: 0,
        lastActionAt: null,
      };
      byId.set(id, row);
    }
    return row;
  };

  for (const ev of events) {
    if (!ev.actor || ev.actor === "avito-agent" || !/^\d{1,12}$/.test(ev.actor)) continue;
    const row = ensure(ev.actor);
    row.points += Number(ev.points || 0);
    switch (ev.type) {
      case "lead_handled":
        row.handled += 1;
        break;
      case "callback_completed":
        row.callbacks += 1;
        break;
      case "todo_completed":
        row.todoDone += 1;
        break;
      case "note_added":
        row.notes += 1;
        break;
      case "closed_won":
        row.closed += 1;
        break;
      default:
        break;
    }
    if (ev.createdAt && (!row.lastActionAt || ev.createdAt > row.lastActionAt)) {
      row.lastActionAt = ev.createdAt;
    }
  }

  // Имена, пришедшие с событиями (actor_name), — фолбэк если ростер неполон.
  for (const row of byId.values()) {
    if (row.name === row.id) {
      const withName = events.find((e) => e.actor === row.id && e.actorName);
      if (withName?.actorName) row.name = withName.actorName;
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name, "ru"),
  );
}
