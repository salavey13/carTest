import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import { matchTodosToLead } from "./pipeline-stages";

export interface LeadHistoryEvent {
  type: string;
  timestamp: string;
  label: string;
  icon?: string;
  detail?: string;
}

export function computeLeadHistory(
  lead: LeadRow,
  allTodos: LeadTodoRow[],
  notes: Array<{ text: string; created_at: string; created_by: string | null }>,
): LeadHistoryEvent[] {
  const events: LeadHistoryEvent[] = [];

  if (lead.createdAt) events.push({ type: "lead_created", timestamp: lead.createdAt, label: "Лид создан", icon: "📥", detail: lead.source });
  if (lead.intentStage === "contacted" && lead.lastSeenAt) events.push({ type: "first_contact", timestamp: lead.lastSeenAt, label: "Первый контакт", icon: "📞" });

  for (const r of lead.rentals) {
    events.push({ type: "rental_created", timestamp: (r as any).createdAt || lead.createdAt || new Date().toISOString(), label: "Аренда создана", icon: "🏍", detail: r.bikeTitle || undefined });
    if (r.status === "active") events.push({ type: "rental_active", timestamp: new Date().toISOString(), label: "Аренда активирована", icon: "▶️" });
    if (r.status === "completed") events.push({ type: "return_completed", timestamp: new Date().toISOString(), label: "Возврат завершён", icon: "✓" });
  }

  const todos = matchTodosToLead(lead, allTodos);
  for (const t of todos) {
    events.push({ type: "todo_created", timestamp: t.created_at, label: "Задача: " + t.title, icon: "✚" });
    if (t.completed_at) events.push({ type: "todo_completed", timestamp: t.completed_at, label: "Задача выполнена: " + t.title, icon: "✓" });
  }

  for (const n of notes) events.push({ type: "note_added", timestamp: n.created_at, label: "Заметка: " + (n.text.length > 50 ? n.text.slice(0, 50) + "…" : n.text), icon: "📝" });

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
