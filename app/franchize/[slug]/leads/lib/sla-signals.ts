import type { LeadRow, LeadTodoRow } from "../leads-types";
import { matchTodosToLead } from "./pipeline-stages";
import { getLeadHandling, isHandlingTodo, isCallbackOverdue, callbackInMinutes } from "./lead-handling";

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

/** Позднейшая из ISO-дат (null — ни одной валидной). Битые строки игнорируем. */
function maxIso(...vals: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const v of vals) {
    if (!v) continue;
    const ms = new Date(v).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = v;
    }
  }
  return best;
}

/**
 * «Последняя активность» по лиду = max(lastSeenAt, lastModifiedAt).
 *
 * Босс: SLA-счётчик «не трогали N» не сбрасывался, когда лида обновляли
 * (заметка, смена стадии, туду), потому что он читал только lastSeenAt —
 * входящую активность КЛИЕНТА. Отдельный счётчик касаний lastModifiedAt
 * («изм. N назад») операторские касания уже учитывает; теперь и SLA-сигналы
 * сбрасываются любым касанием: и ответ клиента, и работа оператора
 * обнуляют «простой» — счётчик больше не вводит в заблуждение.
 */
function lastActivityAtOf(lead: LeadRow): string | null {
  return maxIso(lead.lastSeenAt, lead.lastModifiedAt);
}

export function computeLeadSignals(lead: LeadRow, allTodos: LeadTodoRow[]): LeadSignal[] {
  const signals: LeadSignal[] = [];
  const now = Date.now();
  const todos = matchTodosToLead(lead, allTodos);
  const handling = getLeadHandling(todos);
  const lastActivityAt = lastActivityAtOf(lead);

  if (lead.createdAt) {
    const ms = now - new Date(lead.createdAt).getTime(), h = ms / 36e5;
    signals.push({ key: "time_since_first_contact", label: "С первого контакта", value: fmt(ms), tone: h < 24 ? "neutral" : h < 72 ? "warning" : "danger", priority: h < 24 ? 0 : h < 72 ? 1 : 2 });
  }
  // «Без активности» — простой по лиду: ни ответа клиента (lastSeenAt),
  // ни касания оператора (lastModifiedAt — заметка/стадия/туду). Раньше
  // сигнал тикал от lastSeenAt и после работы оператора показывал
  // «не трогали 2 д» — misleading; теперь любое касание сбрасывает счётчик.
  if (lastActivityAt) {
    const ms = now - new Date(lastActivityAt).getTime(), h = ms / 36e5;
    signals.push({ key: "time_since_last_action", label: "Без активности", value: fmt(ms), detail: h > 24 ? "АКТИВНОСТИ НЕТ" : undefined, tone: h < 1 ? "good" : h < 4 ? "neutral" : h < 24 ? "warning" : "danger", priority: h < 1 ? 0 : h < 4 ? 1 : h < 24 ? 2 : 4 });
  }
  // Handling-строки («отработан»/«перезвонить») не считаются «задачами» —
  // у перезвона собственный сигнал ниже + собственные плашки в списках.
  const overdue = todos.filter((t) => t.due_date && new Date(t.due_date).getTime() < now && t.status !== "done" && !isHandlingTodo(t));
  if (overdue.length > 0) {
    signals.push({ key: "overdue_todo_count", label: "Просроченные задачи", value: String(overdue.length), detail: "просроч. задачи", tone: overdue.length >= 2 ? "danger" : "warning", priority: overdue.length >= 2 ? 4 : 2 });
  }
  // 📞 Назначенный перезвон: просрочен (danger, верхний приоритет) или
  // подоспел (warning) — сигнал виден в SLA-блоке карточки и в шторке.
  if (handling.callback) {
    const inMin = callbackInMinutes(handling.callback, now);
    const od = isCallbackOverdue(handling.callback, now);
    const hm = new Date(handling.callback.dueAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (od) {
      signals.push({ key: "callback_overdue", label: "Перезвон ПРОСРОЧЕН", value: hm, detail: handling.callback.note || "нужно позвонить", tone: "danger", priority: 5 });
    } else if (inMin !== null && inMin <= 180) {
      signals.push({ key: "callback_due_soon", label: "Перезвонить", value: hm, detail: handling.callback.note || `через ${inMin} мин`, tone: "warning", priority: 3 });
    }
  }
  const future = lead.rentals.filter((r) => r.startDate && new Date(r.startDate).getTime() > now).sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());
  if (future.length > 0) {
    const ms = new Date(future[0].startDate!).getTime() - now, d = ms / 864e5;
    signals.push({ key: "rental_start_proximity", label: "До начала аренды", value: fmt(ms), tone: d > 7 ? "neutral" : d > 1 ? "warning" : "danger", priority: d > 7 ? 0 : d > 1 ? 2 : 4 });
  }
  // 2026-09-09 (решение босса): сигналы «QR не принят» (unclaimed_qr_age) и
  // «Документы отсутствуют» (document_missing_age) УДАЛЕНЫ — QR-скан и
  // фото-чеклист больше не являются состоянием/срочностью: клиент не сканил
  // код «на лету» → это деталь диалога, а не красная плашка; документы
  // упоминаются только когда аренда успешно состоялась.
  const active = lead.rentals.filter((r) => r.status === "active" && r.endDate).sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
  if (active.length > 0) {
    const ms = new Date(active[0].endDate!).getTime() - now, d = ms / 864e5;
    signals.push({ key: "time_until_return", label: "До возврата", value: fmt(ms), tone: d > 3 ? "good" : d > 1 ? "warning" : "danger", priority: d > 3 ? 0 : d > 1 ? 2 : 4 });
  }
  // days_since_stage_change («Без движения») — та же политика честного
  // простоя: прокси считаем от ПОСЛЕДНЕЙ АКТИВНОСТИ (max(lastSeenAt,
  // lastModifiedAt)), а не от lastSeenAt, иначе лид, который активно
  // ведут, висел с «Без движения» по неделям без смены стадии.
  if (lastActivityAt && lead.stageKey && lead.stageKey !== "new" && lead.stageKey !== "closed_won" && lead.stageKey !== "closed_lost") {
    const ms = now - new Date(lastActivityAt).getTime();
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
