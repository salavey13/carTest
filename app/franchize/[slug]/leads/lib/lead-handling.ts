// /app/franchize/[slug]/leads/lib/lead-handling.ts
//
// LEAD HANDLING STATE — «Отработан» + «Перезвонить в ...»
// =====================================================================
//
// Просьба босса: «Add possibility to mark particular leads as kinda handled
// — and maybe add special note "make another call at particular time later"
// and make this note prominently visible right in leads list».
//
// ХРАНЕНИЕ. Отдельной таблицы под это состояние нет (и DDL для прод-БД из
// приложения недоступен), поэтому состояние живёт в crew_todos под
// выделенной категорией LEAD_HANDLING_CATEGORY — таблица уже проходит
// сквозь весь конвейер данных (getFranchizeLeads → todos → getTodosForLead),
// а API-роут /api/franchize/lead-handling пишет/читает только эти строки.
// Обычные задачи оператора не пересекаются с ними по category.
//
// МОДЕЛЬ (одна строка = один факт):
//   • «Отработан»     : title=HANDLED_TITLE,     status="done",
//                       completed_at=момент отметки, description={kind:"handled"}
//   • «Перезвонить в …»: title=CALLBACK_TITLE,   status="pending",
//                       due_date=время перезвона,  description={kind:"callback", note}
//
// Ключ лида кладётся в lead_id (+ user_id/phone, если лид телефонный/TG),
// так что строки матчатся к лиду тем же механизмом, что и обычные задачи
// (getTodosForLead). Для авито-лидов (user_id="avito:…") см. фикс
// extractTodoLeadId в leads-utils / pipeline-stages / useLeadsData.
//
// Модуль объявляет только чистые функции + константы — используется и на
// клиенте (UI-плашки), и на сервере (API-роут), импортов React нет.

import type { LeadTodoRow } from "../leads-types";

/** Категория в crew_todos, под которой живут все handling-строки. */
export const LEAD_HANDLING_CATEGORY = "lead_handling";

/** Заголовок строки «лид отработан». */
export const HANDLED_TITLE = "✅ Лид обработан";

/** Заголовок строки «перезвонить». */
export const CALLBACK_TITLE = "📞 Перезвонить";

export interface LeadHandling {
  /** Лид отмечен «отработан» (кем-то из операторов). */
  handled: boolean;
  /** Когда отметили (ISO), если известно. */
  handledAt: string | null;
  /** Активный (pending) перезвон, если назначен. */
  callback: {
    /** Когда перезвонить (ISO) — due_date строки. */
    dueAt: string;
    /** Заметка оператора («после 18:00», «по факту наличия», …). */
    note: string | null;
    /** id строки crew_todos (для завершения/удаления). */
    todoId: string;
  } | null;
}

/** Проверка: строка todo относится к handling-состоянию лида. */
export function isHandlingTodo(todo: LeadTodoRow): boolean {
  return todo?.category === LEAD_HANDLING_CATEGORY;
}

function parseDesc(todo: LeadTodoRow): Record<string, unknown> {
  if (!todo.description) return {};
  try {
    const d = JSON.parse(todo.description);
    return typeof d === "object" && d !== null ? (d as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Проверка: строка — маркер «отработан». */
export function isHandledTodo(todo: LeadTodoRow): boolean {
  if (!isHandlingTodo(todo)) return false;
  return parseDesc(todo).kind === "handled" || todo.title === HANDLED_TITLE;
}

/** Проверка: строка — напоминание «перезвонить». */
export function isCallbackTodo(todo: LeadTodoRow): boolean {
  if (!isHandlingTodo(todo)) return false;
  return parseDesc(todo).kind === "callback" || todo.title === CALLBACK_TITLE;
}

/**
 * Собрать handling-состояние лида из его todo-строк.
 * Берём последний активный (pending) callback и любую done-строку «отработан».
 */
export function getLeadHandling(todos: LeadTodoRow[]): LeadHandling {
  let handled = false;
  let handledAt: string | null = null;
  let callback: LeadHandling["callback"] = null;
  for (const t of todos || []) {
    if (!isHandlingTodo(t)) continue;
    if (isHandledTodo(t)) {
      handled = true;
      if (!handledAt || (t.completed_at || "") > handledAt) handledAt = t.completed_at || t.created_at || null;
      continue;
    }
    if (isCallbackTodo(t) && t.status !== "done") {
      // самая поздняя по due_date активная строка побеждает
      if (!callback || (t.due_date || "") > callback.dueAt) {
        const desc = parseDesc(t);
        callback = {
          dueAt: t.due_date || t.created_at || "",
          note: typeof desc.note === "string" && desc.note ? desc.note : null,
          todoId: t.id,
        };
      }
    }
  }
  return { handled, handledAt, callback };
}

// ── Форматирование для UI ───────────────────────────────────────────────────

/**
 * «14:30» / «завтра 09:00» / «02.09, 14:30» — компактная подпись времени
 * перезвона для плашки в списке. today → только время, иначе дата+время.
 */
export function formatCallbackTime(dueAt: string): string {
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return dueAt;
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const isTomorrow = d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();
  const hm = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return hm;
  if (isTomorrow) return `завтра ${hm}`;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + `, ${hm}`;
}

/** Просрочен ли перезвон (время пришло, а звонка ещё не было). */
export function isCallbackOverdue(callback: LeadHandling["callback"], now: number = Date.now()): boolean {
  if (!callback) return false;
  const t = new Date(callback.dueAt).getTime();
  return Number.isFinite(t) && t < now;
}

/**
 * Через сколько перезвон (для плашки). now передаётся снаружи — функция
 * остаётся чистой и стабильно мемоизируется.
 */
export function callbackInMinutes(callback: LeadHandling["callback"], now: number = Date.now()): number | null {
  if (!callback) return null;
  const t = new Date(callback.dueAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round((t - now) / 60000);
}
