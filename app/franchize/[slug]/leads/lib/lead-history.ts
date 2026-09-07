import type { LeadRow, LeadTodoRow, LeadEventRow } from "../leads-types";
import type { LeadHistoryEvent } from "../leads-constants";
import { matchTodosToLead } from "./pipeline-stages";

/** Конверсия записанного события журнала → элемент таймлайна. */
function recordedToHistoryEvent(e: LeadEventRecord): LeadHistoryEvent {
  return {
    type: e.type,
    timestamp: e.createdAt,
    label: e.label,
    detail: e.detail ?? undefined,
    actor: e.actor,
    actorName: e.actorName,
    recorded: true,
  };
}

/** Форма строки журнала, которую принимает computeLeadHistory. */
export type LeadEventRecord = {
  id: string;
  createdAt: string;
  leadId: string;
  type: string;
  actor: string | null;
  actorName: string | null;
  label: string;
  detail: string | null;
  points: number;
};

export function computeLeadHistory(
  lead: LeadRow,
  allTodos: LeadTodoRow[],
  notes: Array<{ text: string; created_at: string; created_by: string | null }>,
  recordedEvents: LeadEventRecord[] = [],
): LeadHistoryEvent[] {
  const events: LeadHistoryEvent[] = [];

  // ── Записанные факты (public.lead_events) идут первыми: они переживают
  // производные данные и содержат атрибуцию «кто сделал». Производные
  // события ниже добавляются только если такого факта НЕТ (дедуп по
  // типу+времени в минутном окне) — т.е. журнал, а не дубль.
  const recorded = recordedEvents.map(recordedToHistoryEvent);

  if (lead.createdAt) events.push({ type: "lead_created", timestamp: lead.createdAt, label: "Лид создан", icon: "📥", detail: lead.source });
  if (lead.intentStage === "contacted" && lead.lastSeenAt) events.push({ type: "first_contact", timestamp: lead.lastSeenAt, label: "Первый контакт", icon: "📞" });

  for (const r of lead.rentals) {
    events.push({ type: "rental_created", timestamp: (r as any).createdAt || lead.createdAt || new Date().toISOString(), label: "Аренда создана", icon: "🏍", detail: r.bikeTitle || undefined });
    if (r.status === "active" && r.startDate) events.push({ type: "rental_active", timestamp: r.startDate, label: "Аренда активирована", icon: "▶️", detail: r.bikeTitle || undefined });
    if (r.status === "completed" && r.endDate) events.push({ type: "return_completed", timestamp: r.endDate, label: "Возврат завершён", icon: "✓", detail: r.bikeTitle || undefined });
  }

  const todos = matchTodosToLead(lead, allTodos);
  for (const t of todos) {
    events.push({ type: "todo_created", timestamp: t.created_at, label: "Задача: " + t.title, icon: "✚" });
    if (t.completed_at) events.push({ type: "todo_completed", timestamp: t.completed_at, label: "Задача выполнена: " + t.title, icon: "✓" });
  }

  // Автор заметки (после серверного резолва — человекочитаемое имя) →
  // в деталях таймлайна: сразу видно, кто из операторов работал с лидом.
  for (const n of notes) {
    events.push({
      type: "note_added",
      timestamp: n.created_at,
      label: "Заметка: " + (n.text.length > 50 ? n.text.slice(0, 50) + "…" : n.text),
      icon: "📝",
      detail: n.created_by ? `Автор: ${n.created_by}` : undefined,
    });
  }

  if (lead.stageKey === "closed_won") events.push({ type: "closed_won", timestamp: lead.lastSeenAt || new Date().toISOString(), label: "Лид закрыт (выигран)", icon: "🎉" });
  if (lead.stageKey === "closed_lost" && lead.lastSeenAt) events.push({ type: "closed_lost", timestamp: lead.lastSeenAt, label: "Лид закрыт (потерян)", icon: "✗" });

  // ── Дедуп: производное событие пропускается, если в журнале уже есть
  // записанный факт того же типа в пределах 90 секунд (один и тот же факт,
  // например «Задача: …» пишется и маршрутом, и выводится из todos).
  const sameMinute = (a: string, b: string): boolean => {
    const ta = new Date(a).getTime();
    const tb = new Date(b).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
    return Math.abs(ta - tb) <= 90_000;
  };
  const derived = events.filter(
    (e) =>
      !recorded.some(
        (r) => r.type === e.type && sameMinute(r.timestamp, e.timestamp),
      ),
  );

  return [...recorded, ...derived].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
