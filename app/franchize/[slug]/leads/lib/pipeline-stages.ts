import type {LeadRow, LeadRentalRow, LeadTodoRow} from "../leads-types";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";
import { parseTodoDesc } from "./lead-identity";

// 2026-09-09 (решение босса): стадии «QR не принят» (awaiting_qr_claim) и
// «Документы отсутствуют» (documents_missing) УДАЛЕНЫ из пайплайна.
//   • QR: если клиент не сканил код «на лету» — это не стадия, а деталь
//     диалога; оператор просто связывается и помогает принять договор.
//   • Документы: состояние «нет фото» больше не считается проблемой стадии —
//     документы упоминаются в UI ТОЛЬКО когда аренда успешно состоялась
//     (active/completed), иначе — молчание.
export const PIPELINE_STAGES = [
  { key: "new", label: "Новые", tone: "gray", color: "#64748b" },
  { key: "needs_contact", label: "Нужен контакт", tone: "blue", color: "#3b82f6" },
  { key: "contract_sent", label: "Договор отправлен", tone: "cyan", color: "#06b6d4" },
  { key: "active_rental", label: "Активные", tone: "green", color: "#22c55e" },
  { key: "return_due", label: "Возврат", tone: "orange", color: "#f97316" },
  { key: "closed_won", label: "Закрыто", tone: "darkgreen", color: "#166534" },
  { key: "closed_lost", label: "Потеряно", tone: "darkgray", color: "#1f2937" },
] as const;

export type StageKey = (typeof PIPELINE_STAGES)[number]["key"];

export const STAGE_LABELS: Record<StageKey, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.key, s.label]),
);
export const STAGE_COLORS: Record<StageKey, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.key, s.color]),
);

/**
 * The bottleneck for each stage — the ONE thing blocking transition to the
 * next stage. Shown as a "Next Step" pill on LeadCard so operators don't
 * have to think "what do I do next?"
 */
export const STAGE_BOTTLENECK: Record<StageKey, { label: string; action: string; color: string }> = {
  // /doc flow: operator hasn't reached out to renter yet
  // Web-app flow: renter browsed but didn't complete checkout
  new:               { label: "Связаться",         action: "telegram",  color: "#ef4444" },

  // Operator contacted lead, but no contract yet.
  // Bottleneck: need to generate contract (via /doc or web form)
  needs_contact:     { label: "Создать договор",    action: "create_doc", color: "#f59e0b" },

  // Договор отправлен (оба потока: /doc и веб). 2026-09-09: узкое место —
  // НЕ QR и НЕ документы: клиент не сканил код «на лету» → оператор просто
  // связывается и помогает принять договор в диалоге (код/детали доступны
  // в шторке лида, когда понадобятся).
  contract_sent:     { label: "Связаться",          action: "telegram", color: "#eab308" },

  // Rental is active. Bottleneck: monitor return date.
  active_rental:     { label: "Открыть аренду",     action: "open_rental", color: "#22c55e" },

  // Return due within 24h or overdue. Bottleneck: close rental.
  return_due:        { label: "Закрыть аренду",     action: "close_rental", color: "#ef4444" },

  // Completed. Bottleneck: request review for repeat business.
  closed_won:        { label: "Запросить отзыв",    action: "request_review", color: "#22c55e" },

  // Lost. Bottleneck: reactivate.
  closed_lost:       { label: "Открыть повторно",   action: "reopen",    color: "#64748b" },
};

/**
 * Приоритет статусов аренды для выбора «релевантной» сделки лида.
 */
const RENTAL_STATUS_PRIORITY: Record<string, number> = {
  active: 5, confirmed: 4, pending_confirmation: 3, completed: 2, cancelled: 1,
};

/**
 * САМАЯ РЕЛЕВАНТНАЯ аренда лида: сначала по приоритету статуса
 * (active > confirmed > pending > completed > cancelled), при равенстве —
 * более поздняя дата начала. Заменяет повсюду чтение rentals[0]: после
 * серверного дедупа артефактов/аренд порядок массива не гарантирован, а
 * логика стадии/верификации/возврата должна смотреть на «живую» сделку.
 */
export function pickRelevantRental(lead: LeadRow): LeadRentalRow | null {
  if (!lead.rentals || lead.rentals.length === 0) return null;
  return [...lead.rentals].sort((a, b) => {
    const pa = RENTAL_STATUS_PRIORITY[a.status] ?? 0;
    const pb = RENTAL_STATUS_PRIORITY[b.status] ?? 0;
    if (pa !== pb) return pb - pa;
    return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
  })[0];
}

/**
 * Verification status лида — 2026-09-09 (решение босса): «only mention that
 * docs are fine in case rental was successful, otherwise just don't mention
 * docs». Единственный статус с текстом — «Документы проверены», и он
 * ставится ТОЛЬКО когда аренда фактически состоялась/успешна
 * (active/completed: активация требует проверенных документов — иначе
 * байк не уехал бы). Все прочие состояния → not_needed: в UI нет ни красного
 * «Фото не загружены», ни янтарного «Фото на проверке» — дожимать клиента
 * фото-чеклистом не наша работа, сделки это не приближает.
 */
export function getVerificationStatus(lead: LeadRow): "verified" | "unverified" | "pending" | "not_needed" {
  if (lead.rentals.length === 0) return "not_needed";

  // FIX: читать РЕЛЕВАНТНУЮ аренду, а не rentals[0] — после серверного дедупа
  // порядок массива произволен, и заглушка-артефакт больше не может
  // заслонить реальную строку из rentals.
  const r = (pickRelevantRental(lead) ?? lead.rentals[0]) as any;

  if (r.status === "active" || r.status === "completed") {
    return "verified";
  }

  // Договор отправлен / подтверждён, но аренда ещё не состоялась —
  // о документах МОЛЧИМ (ни verified, ни unverified).
  return "not_needed";
}

/**
 * Ярлыки верификации. unverified/pending сохранены для совместимости типа,
 * но getVerificationStatus их больше не возвращает — в UI они не встретятся.
 */
export const VERIFICATION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  verified:    { label: "Документы проверены",   color: "#22c55e", icon: "✓" },
  unverified:  { label: "",                        color: "#64748b", icon: "" },
  pending:     { label: "",                        color: "#64748b", icon: "" },
  not_needed:  { label: "",                        color: "#64748b", icon: "" },
};

/**
 * Flow type for a lead — determines which stages apply and what the
 * bottleneck is at each stage.
 *
 * "doc": operator-initiated via /doc TG command.
 *   - Docs verified in person (passport + license OCR'd during /doc)
 *   - QR code generated for renter to claim their TG identity
 *   - Bottleneck: QR claim (renter needs to open TG WebApp)
 *   - No photo upload needed (already verified)
 *
 * "webapp": renter-initiated via web catalog.
 *   - TG chat_id auto-shared (no QR needed)
 *   - Renter fills text fields (ФИО, phone) — may be inaccurate
 *   - Photos needed for verification (auto-OCR via /api/docphotoocr)
 *   - Bottleneck: photo upload + operator verification
 *
 * "none": no rental yet (pre-contract stage)
 */
export function getFlowType(lead: LeadRow): "doc" | "webapp" | "none" {
  if (!lead.rentals.length) return "none";
  if (lead.originalOperatorChatId) return "doc";
  // Synthetic keys (opdoc:/oprental:/opsale:/optestdrive:/opsecret:) are
  // assigned ONLY to operator-created rows whose renter has neither phone
  // nor ФИО — by construction they are doc-flow, even when the operator
  // column wasn't preserved on the source row.
  if (
    lead.user_id.startsWith("opdoc:") ||
    lead.user_id.startsWith("oprental:") ||
    lead.user_id.startsWith("opsale:") ||
    lead.user_id.startsWith("optestdrive:") ||
    lead.user_id.startsWith("opsecret:")
  ) {
    return "doc";
  }
  return "webapp";
}

/**
 * Bottleneck for a lead's stage (единая таблица STAGE_BOTTLENECK).
 * 2026-09-09: потокозависимость убрана — QR и документы больше не являются
 * узкими местами ни для одного потока (см. комментарий у PIPELINE_STAGES).
 */
export function getStageBottleneck(lead: LeadRow): { label: string; action: string; color: string } {
  const stage = (lead as { stageKey?: string }).stageKey as StageKey || "new";
  return STAGE_BOTTLENECK[stage] || STAGE_BOTTLENECK.new;
}

export const STAGE_NEXT_ACTION: Record<StageKey, string> = {
  new: "Написать в Telegram",
  needs_contact: "Написать в Telegram",
  contract_sent: "Написать в Telegram",
  active_rental: "Открыть договор",
  return_due: "Назначить возврат",
  closed_won: "Создать аренду",
  closed_lost: "Открыть повторно",
};

function isPastOrDueSoon(endDate: string | null): boolean {
  if (!endDate) return false;
  const end = new Date(endDate).getTime();
  const now = Date.now();
  return end - now < 24 * 60 * 60 * 1000;
}

export function computeLeadStage(lead: LeadRow): StageKey {
  if (lead.intentStage === "dismissed") return "closed_lost";
  if (lead.sales.length > 0 && lead.rentals.length === 0) return "closed_won";
  if (lead.rentals.length > 0) {
    // BUG 1 fix: find the MOST RELEVANT rental by status priority, not just rentals[0].
    // Was: const r = lead.rentals[0] → if first rental is old/confirmed, stage was wrong
    // even when a newer active rental exists. Now we sort by status priority
    // (pickRelevantRental — shared with verification/bottleneck logic).
    const r = pickRelevantRental(lead)!;
    if (r.status === "completed") return "closed_won";
    if (r.status === "cancelled") return "closed_lost";
    if (r.status === "active") return isPastOrDueSoon(r.endDate) ? "return_due" : "active_rental";
    if (r.status === "confirmed" || r.status === "pending_confirmation") {
      // 2026-09-09 (решение босса): QR-скан и фото-чеклист больше не влияют
      // на стадию. Раньше лид висел в «QR не принят»/«Документы отсутствуют»
      // неделями — вечное ожидание скана/фото вместо живой работы. Теперь:
      // договор отправлен — оператор связывается и ведёт сделку; статус QR
      // по-прежнему виден в шторке (computeQrStatus), но ничего не блокирует.
      return "contract_sent";
    }
  }
  if (lead.intentStage === "contract_generated") return "contract_sent";
  if (["contacted", "offer_sent", "manual_reserved", "alternative_offered"].includes(lead.intentStage || "")) return "needs_contact";
  if (lead.intentStage === "closed") return "closed_lost";
  return "new";
}

export function computeQrStatus(lead: LeadRow): "unclaimed" | "sent" | "claimed" | "expired" {
  if (!lead.originalOperatorChatId) return "claimed";
  const qrClaimed = lead.identityState === "claimed_user" || lead.identityState === "merged";
  if (qrClaimed) return "claimed";
  return "unclaimed";
}

export function computeAssignee(lead: LeadRow, todos: LeadTodoRow[]): string | null {
  const leadTodos = matchTodosToLead(lead, todos);
  const pending = leadTodos.filter((t) => t.status !== "done").sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (pending.length > 0 && pending[0].assigned_to) return pending[0].assigned_to;
  const done = leadTodos.filter((t) => t.status === "done").sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
  if (done.length > 0 && done[0].assigned_to) return done[0].assigned_to;
  return lead.originalOperatorChatId || null;
}

export function matchTodosToLead(lead: LeadRow, todos: LeadTodoRow[]): LeadTodoRow[] {
  const identitySet = new Set([lead.user_id, lead.phone, normalizePhone(lead.phone)].filter(Boolean) as string[]);
  const rentalIds = new Set(lead.rentals.map((r) => r.rentalId).filter(Boolean));
  return todos.filter((t) => {
    if (t.rental_id && rentalIds.has(t.rental_id)) return true;
    if (t.description) {
      try {
        const d = parseTodoDesc(t);
        if (d.rental_id && rentalIds.has(d.rental_id)) return true;
      } catch {}
    }
    // Multi-candidate identity match (2026-09-02): operator-created todos carry
    // user_id = operator AND phone = renter — the phone candidate matches the
    // renter-keyed lead, the operator id candidate matches nothing.
    const ids = extractTodoLeadIds(t);
    if (ids.some((id) => identitySet.has(id))) return true;
    return false;
  });
}

function extractTodoLeadIds(todo: LeadTodoRow): string[] {
  const ids: string[] = [];
  const push = (v: string | null | undefined): void => {
    if (v && v.length > 0 && !ids.includes(v)) ids.push(v);
  };
  const pushWithPhone = (v: string | null | undefined): void => {
    if (!v) return;
    push(v);
    const n = normalizePhone(v);
    if (n) push(n);
  };
  if (todo.user_id && /^\d{1,12}$/.test(todo.user_id)) {
    push(todo.user_id);
    if (/^[78]\d{10}$/.test(todo.user_id)) push(normalizePhone(todo.user_id));
  }
  pushWithPhone(todo.phone);
  if (todo.lead_id) {
    if (/^\d{1,12}$/.test(todo.lead_id)) {
      push(todo.lead_id);
      if (/^[78]\d{10}$/.test(todo.lead_id)) push(normalizePhone(todo.lead_id));
    } else if (/^[+\d\s\-()]+$/.test(todo.lead_id)) {
      // phone-shaped ("8 999…") → raw + normalized candidates
      pushWithPhone(todo.lead_id);
    } else {
      // FIX (lead-handling, kept): non-phone keys ("avito:…", UUIDs) compare
      // AS-IS — normalizePhone() mangles them into "+avito:…" which matches
      // nothing. Push raw only, never a mangled twin.
      push(todo.lead_id);
    }
  }
  if (todo.description) {
    try {
      const d = parseTodoDesc(todo);
      if (typeof d.user_id === 'string' && /^\d{1,12}$/.test(d.user_id)) {
        push(d.user_id);
        if (/^[78]\d{10}$/.test(d.user_id)) push(normalizePhone(d.user_id));
      }
      if (typeof d.phone === 'string') pushWithPhone(d.phone);
      if (typeof d.lead_id === 'string' && d.lead_id) {
        if (/^\d{1,12}$/.test(d.lead_id)) {
          push(d.lead_id);
          if (/^[78]\d{10}$/.test(d.lead_id)) push(normalizePhone(d.lead_id));
        } else if (/^[+\d\s\-()]+$/.test(d.lead_id)) {
          pushWithPhone(d.lead_id);
        } else {
          // non-phone keys (avito:…) compare as-is — see fix above
          push(d.lead_id);
        }
      }
    } catch {}
  }
  return ids;
}
