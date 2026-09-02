import type {LeadRow, LeadTodoRow} from "../leads-types";
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
  // /doc flow: operator hasn't reached out to renter yet
  // Web-app flow: renter browsed but didn't complete checkout
  new:               { label: "Связаться",         action: "telegram",  color: "#ef4444" },

  // Operator contacted lead, but no contract yet.
  // Bottleneck: need to generate contract (via /doc or web form)
  needs_contact:     { label: "Создать договор",    action: "create_doc", color: "#f59e0b" },

  // /doc flow: contract generated, QR code created.
  // QR can ONLY be shown manually (no auto-reshow). Operator must:
  // - Open the contract-draft page in TG WebApp
  // - Show QR to renter in person, OR
  // - If renter's phone is known: send QR as a TG message to that phone number
  // Web-app flow: this stage doesn't apply (no QR needed — TG chat_id auto-shared)
  contract_sent:     { label: "Показать QR",        action: "show_qr",  color: "#eab308" },

  // /doc flow: QR was shown/sent but renter hasn't opened TG WebApp yet.
  // Cannot auto-reshow — operator must physically show QR again or
  // send it via TG to the renter's phone (if known).
  // Web-app flow: this stage doesn't apply (renter already authed)
  awaiting_qr_claim: { label: "Переслать QR лично",  action: "show_qr",  color: "#f97316" },

  // WEB-APP FLOW ONLY: renter authed via TG (chat_id auto-shared, no QR needed).
  // Bottleneck: renter needs to fill in text info (ФИО, passport, license)
  // AND upload photos. Photos can be auto-OCR'd via /api/docphotoocr endpoint.
  // /doc flow: this stage doesn't apply (docs already verified by operator)
  documents_missing: { label: "Загрузить фото",     action: "upload_photos", color: "#f97316" },

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
 * Verification status for each flow type.
 * /doc flow: verified on creation (operator saw physical docs)
 * Web-app flow: unverified until operator checks uploaded photos
 */
export function getVerificationStatus(lead: LeadRow): "verified" | "unverified" | "pending" | "not_needed" {
  if (lead.rentals.length === 0) return "not_needed";

  const r = lead.rentals[0] as any;

  // RULE 1: Active rentals are ALWAYS verified.
  // If the bike was handed off (status=active), docs were checked —
  // either by the operator via /doc (saw physical docs) or via photo
  // verification before activation. You can't activate without verifying.
  if (r.status === "active" || r.status === "completed") {
    return "verified";
  }

  // RULE 2: /doc flow = always verified (operator saw physical docs).
  // This covers pending_confirmation/confirmed rentals created via /doc.
  if (lead.originalOperatorChatId) {
    return "verified";
  }

  // RULE 3: Web-app flow, not yet active = needs verification.
  // These rentals were created by the renter via web form.
  // Unverified state only applies here — until operator checks photos.
  const hasPhotos = r.passportMainpagePhoto || r.passportRegistrationPhoto || r.driversLicenceFrontalPhoto;
  const verified = r.metadata?.contract_verifier?.status === "verified";
  if (verified) return "verified";
  if (hasPhotos) return "pending";  // photos uploaded, awaiting operator check
  return "unverified";               // no photos yet — renter needs to upload
}

export const VERIFICATION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  verified:    { label: "Документы проверены",   color: "#22c55e", icon: "✓" },
  unverified:  { label: "Фото не загружены",     color: "#ef4444", icon: "✗" },
  pending:     { label: "Фото на проверке",       color: "#f59e0b", icon: "⏳" },
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
 * Get the flow-specific bottleneck for a lead.
 * Different flows have different bottlenecks at the same stage:
 *
 * Stage "contract_sent":
 *   - doc flow: "Показать QR" (QR must be shown manually, no auto-reshow)
 *   - webapp flow: N/A (web-app flow skips QR entirely)
 *
 * Stage "awaiting_qr_claim":
 *   - doc flow: "Переслать QR лично" (can't auto-reshow — must show in person
 *     or send via TG to renter's phone if known)
 *   - webapp flow: N/A
 *
 * Stage "documents_missing":
 *   - doc flow: N/A (docs already verified during /doc)
 *   - webapp flow: "Загрузить фото" (photos can be auto-OCR'd)
 */
export function getStageBottleneck(lead: LeadRow): { label: string; action: string; color: string } {
  const stage = (lead as { stageKey?: string }).stageKey as StageKey || "new";
  const flow = getFlowType(lead);
  const defaultBottleneck = STAGE_BOTTLENECK[stage] || STAGE_BOTTLENECK.new;

  // Flow-specific overrides
  if (flow === "webapp") {
    // Web-app flow: QR stages don't apply (chat_id auto-shared)
    if (stage === "contract_sent" || stage === "awaiting_qr_claim") {
      // Web-app flow skips QR → bottleneck is photo upload
      return { label: "Загрузить фото", action: "upload_photos", color: "#f97316" };
    }
  }

  if (flow === "doc") {
    // /doc flow: documents_missing stage doesn't apply (already verified)
    if (stage === "documents_missing") {
      return { label: "Ожидает QR", action: "show_qr", color: "#eab308" };
    }
  }

  return defaultBottleneck;
}

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
    // BUG 1 fix: find the MOST RELEVANT rental by status priority, not just rentals[0].
    // Was: const r = lead.rentals[0] → if first rental is old/confirmed, stage was wrong
    // even when a newer active rental exists. Now we sort by status priority.
    const statusPriority: Record<string, number> = {
      active: 5, confirmed: 4, pending_confirmation: 3, completed: 2, cancelled: 1,
    };
    const relevantRental = [...lead.rentals].sort((a, b) =>
      (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0)
    )[0];
    const r = relevantRental;
    if (r.status === "completed") return "closed_won";
    if (r.status === "cancelled") return "closed_lost";
    if (r.status === "active") return isPastOrDueSoon(r.endDate) ? "return_due" : "active_rental";
    if (r.status === "confirmed" || r.status === "pending_confirmation") {
      const qrClaimed = lead.identityState === "claimed_user" || lead.identityState === "merged";
      const hasUnclaimed = !!lead.originalOperatorChatId && !qrClaimed;
      // FIX: was only checking photo paths — but verification deletes photos (152-ФЗ).
      // Now also checks metadata.checklist flags + active/completed status.
      const meta = (r as any).metadata as Record<string, unknown> | null;
      const checklist = (meta?.checklist as Record<string, unknown>) || {};
      const docsVerified = !!checklist.passport_verified || !!checklist.license_verified;
      const docsMissing = !docsVerified && (!(r as any).passportMainpagePhoto || !(r as any).passportRegistrationPhoto || !(r as any).driversLicenceFrontalPhoto);
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
      const d = JSON.parse(todo.description);
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
