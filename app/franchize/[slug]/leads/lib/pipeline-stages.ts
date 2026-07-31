import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";

export const PIPELINE_STAGES = [
  { key: "new", label: "Новые", tone: "gray", color: "#64748b" },
  { key: "needs_contact", label: "Нужен контакт", tone: "blue", color: "#3b82f6" },
  { key: "contract_sent", label: "Договор отправлен", tone: "cyan", color: "#06b6d4" },
  { key: "awaiting_qr_claim", label: "QR не принят", tone: "yellow", color: "#eab308" },
  { key: "documents_missing", label: "Документы отсутствуют", tone: "orange", color: "#f97316" },
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
  new:               { label: "Связаться",         action: "telegram",  color: "#ef4444" },
  needs_contact:     { label: "Создать договор",    action: "create_doc", color: "#f59e0b" },
  contract_sent:     { label: "Отправить QR",       action: "resend_qr", color: "#eab308" },
  awaiting_qr_claim: { label: "Переслать QR",       action: "resend_qr", color: "#f97316" },
  documents_missing: { label: "Проверить фото",     action: "verify_photos", color: "#f97316" },
  active_rental:     { label: "Открыть аренду",     action: "open_rental", color: "#22c55e" },
  return_due:        { label: "Закрыть аренду",     action: "close_rental", color: "#ef4444" },
  closed_won:        { label: "Запросить отзыв",    action: "request_review", color: "#22c55e" },
  closed_lost:       { label: "Открыть повторно",   action: "reopen",    color: "#64748b" },
};

/**
 * Verification status for each flow type.
 * /doc flow: verified on creation (operator saw physical docs)
 * Web-app flow: unverified until operator checks uploaded photos
 */
export function getVerificationStatus(lead: LeadRow): "verified" | "unverified" | "pending" | "not_needed" {
  // /doc flow: if the lead has a rental with originalOperatorChatId,
  // it was created by an operator via /doc command → docs were verified in person
  if (lead.originalOperatorChatId && lead.rentals.length > 0) {
    return "verified";
  }
  // Web-app flow: if the lead has a rental but no operator chat ID,
  // it was created by the renter via web app → needs photo verification
  if (lead.rentals.length > 0 && !lead.originalOperatorChatId) {
    const r = lead.rentals[0] as any;
    const hasPhotos = r.passportMainpagePhoto || r.passportRegistrationPhoto || r.driversLicenceFrontalPhoto;
    const verified = r.metadata?.contract_verifier?.status === "verified";
    if (verified) return "verified";
    if (hasPhotos) return "pending";
    return "unverified";
  }
  // No rental yet — verification not needed
  return "not_needed";
}

export const VERIFICATION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  verified:    { label: "Документы проверены",   color: "#22c55e", icon: "✓" },
  unverified:  { label: "Фото не загружены",     color: "#ef4444", icon: "✗" },
  pending:     { label: "Фото на проверке",       color: "#f59e0b", icon: "⏳" },
  not_needed:  { label: "",                        color: "#64748b", icon: "" },
};

export const STAGE_NEXT_ACTION: Record<StageKey, string> = {
  new: "Написать в Telegram",
  needs_contact: "Написать в Telegram",
  contract_sent: "Переслать QR",
  awaiting_qr_claim: "Переслать QR",
  documents_missing: "Запросить документы",
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
    const r = lead.rentals[0];
    if (r.status === "completed") return "closed_won";
    if (r.status === "cancelled") return "closed_lost";
    if (r.status === "active") return isPastOrDueSoon(r.endDate) ? "return_due" : "active_rental";
    if (r.status === "confirmed" || r.status === "pending_confirmation") {
      const qrClaimed = lead.identityState === "claimed_user" || lead.identityState === "merged";
      const hasUnclaimed = !!lead.originalOperatorChatId && !qrClaimed;
      const docsMissing = !(r as any).passportMainpagePhoto || !(r as any).passportRegistrationPhoto || !(r as any).driversLicenceFrontalPhoto;
      if (hasUnclaimed) return r.status === "confirmed" ? "awaiting_qr_claim" : "contract_sent";
      if (docsMissing && qrClaimed) return "documents_missing";
      return "awaiting_qr_claim";
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

export function getPrimaryActions(lead: LeadRow): Array<{ type: string; label: string }> {
  const stage = lead.stageKey || computeLeadStage(lead);
  const map: Record<string, Array<{ type: string; label: string }>> = {
    new: [{ type: "telegram", label: "Написать в TG" }, { type: "call", label: "Позвонить" }, { type: "more", label: "Ещё" }],
    needs_contact: [{ type: "telegram", label: "Написать в TG" }, { type: "call", label: "Позвонить" }, { type: "more", label: "Ещё" }],
    contract_sent: [{ type: "resend_qr", label: "Переслать QR" }, { type: "call", label: "Позвонить" }, { type: "telegram", label: "Написать в TG" }, { type: "more", label: "Ещё" }],
    awaiting_qr_claim: [{ type: "resend_qr", label: "Переслать QR" }, { type: "call", label: "Позвонить" }, { type: "telegram", label: "Написать в TG" }, { type: "more", label: "Ещё" }],
    documents_missing: [{ type: "request_docs", label: "Запросить документы" }, { type: "call", label: "Позвонить" }, { type: "telegram", label: "Написать в TG" }, { type: "more", label: "Ещё" }],
    active_rental: [{ type: "open_contract", label: "Открыть договор" }, { type: "call", label: "Позвонить" }, { type: "telegram", label: "Написать в TG" }, { type: "more", label: "Ещё" }],
    return_due: [{ type: "schedule_return", label: "Назначить возврат" }, { type: "open_contract", label: "Открыть договор" }, { type: "verify_photos", label: "Проверить фото" }, { type: "more", label: "Ещё" }],
    closed_won: [{ type: "create_rental", label: "Создать аренду" }, { type: "more", label: "Ещё" }],
    closed_lost: [{ type: "reopen", label: "Открыть повторно" }, { type: "more", label: "Ещё" }],
  };
  return map[stage] || map.new;
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
        const d = JSON.parse(t.description);
        if (d.rental_id && rentalIds.has(d.rental_id)) return true;
      } catch {}
    }
    const id = extractTodoLeadId(t);
    if (id && identitySet.has(id)) return true;
    return false;
  });
}

function extractTodoLeadId(todo: LeadTodoRow): string | null {
  if (todo.user_id && /^\d{1,12}$/.test(todo.user_id)) return todo.user_id;
  if (todo.phone) { const n = normalizePhone(todo.phone); if (n) return n; }
  if (todo.lead_id) {
    if (/^\d{1,12}$/.test(todo.lead_id)) return todo.lead_id;
    const n = normalizePhone(todo.lead_id); if (n) return n;
    if (todo.lead_id.includes("-")) return todo.lead_id;
  }
  if (todo.description) {
    try {
      const d = JSON.parse(todo.description);
      if (typeof d.user_id === 'string' && /^\d{1,12}$/.test(d.user_id)) return d.user_id;
      if (typeof d.phone === 'string') { const n = normalizePhone(d.phone); if (n) return n; }
      if (typeof d.lead_id === 'string' && d.lead_id) {
        if (/^\d{1,12}$/.test(d.lead_id)) return d.lead_id;
        const n = normalizePhone(d.lead_id); if (n) return n;
        if (d.lead_id.includes("-")) return d.lead_id;
      }
    } catch {}
  }
  return null;
}
