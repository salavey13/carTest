import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import { matchTodosToLead } from "./pipeline-stages";

export interface LeadSignal {
  key: string;
  label: string;
  value: string;
  tone: "neutral" | "good" | "warning" | "danger";
  priority: number;
  detail?: string;
}

function fmt(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d} д ${h % 24} ч`;
  if (h > 0) return `${h} ч ${m % 60} м`;
  return `${m} м`;
}

export function computeLeadSignals(lead: LeadRow, allTodos: LeadTodoRow[]): LeadSignal[] {
  const signals: LeadSignal[] = [];
  const now = Date.now();
  const todos = matchTodosToLead(lead, allTodos);

  if (lead.createdAt) {
    const ms = now - new Date(lead.createdAt).getTime(), h = ms / 36e5;
    signals.push({ key: "time_since_first_contact", label: "С первого контакта", value: fmt(ms), tone: h < 24 ? "neutral" : h < 72 ? "warning" : "danger", priority: h < 24 ? 0 : h < 72 ? 1 : 2 });
  }
  if (lead.lastSeenAt) {
    const ms = now - new Date(lead.lastSeenAt).getTime(), h = ms / 36e5;
    signals.push({ key: "time_since_last_action", label: "Без отклика", value: fmt(ms), detail: h > 24 ? "ОТКЛИКА НЕТ" : undefined, tone: h < 1 ? "good" : h < 4 ? "neutral" : h < 24 ? "warning" : "danger", priority: h < 1 ? 0 : h < 4 ? 1 : h < 24 ? 2 : 4 });
  }
  const overdue = todos.filter((t) => t.due_date && new Date(t.due_date).getTime() < now && t.status !== "done");
  if (overdue.length > 0) {
    signals.push({ key: "overdue_todo_count", label: "Просроченные задачи", value: String(overdue.length), detail: "просроч. задачи", tone: overdue.length >= 2 ? "danger" : "warning", priority: overdue.length >= 2 ? 4 : 2 });
  }
  const future = lead.rentals.filter((r) => r.startDate && new Date(r.startDate).getTime() > now).sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
  if (future.length > 0) {
    const ms = new Date(future[0].startDate!).getTime() - now, d = ms / 864e5;
    signals.push({ key: "rental_start_proximity", label: "До начала аренды", value: fmt(ms), tone: d > 7 ? "neutral" : d > 1 ? "warning" : "danger", priority: d > 7 ? 0 : d > 1 ? 2 : 4 });
  }
  if (lead.qrStatus === "unclaimed" || lead.qrStatus === "sent") {
    if (lead.createdAt) {
      const ms = now - new Date(lead.createdAt).getTime(), h = ms / 36e5;
      signals.push({ key: "unclaimed_qr_age", label: "QR не принят", value: fmt(ms), tone: h < 17 ? "neutral" : h < 48 ? "warning" : "danger", priority: h < 17 ? 1 : h < 48 ? 2 : 4 });
    }
  }
  const active = lead.rentals.filter((r) => r.status === "active" && r.endDate).sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
  if (active.length > 0) {
    const ms = new Date(active[0].endDate!).getTime() - now, d = ms / 864e5;
    signals.push({ key: "time_until_return", label: "До возврата", value: fmt(ms), tone: d > 3 ? "good" : d > 1 ? "warning" : "danger", priority: d > 3 ? 0 : d > 1 ? 2 : 4 });
  }
  // document_missing_age
  if (lead.stageKey === "documents_missing" && lead.rentals.length > 0) {
    const r = lead.rentals[0];
    const docsMissing = !(r as any).passportMainpagePhoto || !(r as any).passportRegistrationPhoto || !(r as any).driversLicenceFrontalPhoto;
    if (docsMissing) {
      signals.push({ key: "document_missing_age", label: "Документы отсутствуют", value: "⚠", tone: "warning", priority: 2 });
    }
  }
  // days_since_stage_change (proxy: time since lastSeenAt when stage hasn't changed)
  if (lead.lastSeenAt && lead.stageKey && lead.stageKey !== "new" && lead.stageKey !== "closed_won" && lead.stageKey !== "closed_lost") {
    const ms = now - new Date(lead.lastSeenAt).getTime();
    const d = ms / 864e5;
    if (d > 3) {
      signals.push({ key: "days_since_stage_change", label: "Без движения", value: fmt(ms), tone: d > 7 ? "warning" : "neutral", priority: d > 7 ? 2 : 1 });
    }
  }
  return signals.sort((a, b) => b.priority - a.priority);
}

export function isHotLead(lead: LeadRow, todos: LeadTodoRow[]): boolean {
  if ((lead.urgencyScore ?? 0) >= 80) return true;
  return computeLeadSignals(lead, todos).some((s) => s.tone === "danger");
}
