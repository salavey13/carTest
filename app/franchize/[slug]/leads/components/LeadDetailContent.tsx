"use client";

import { useMemo } from "react";
import type {LeadRow, LeadTodoRow} from "../leads-types";
import type {
  LeadSignal,
  LeadHistoryEvent,
} from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";
import {
  computeLeadStage,
  computeQrStatus,
  pickRelevantRental,
  getFlowType,
} from "../lib/pipeline-stages";
import { computeLeadSignals } from "../lib/sla-signals";
import { computeLeadHistory } from "../lib/lead-history";
import { computeLeadPriority, type LeadPriority } from "../lib/lead-priority";
import {
  LeadDetailDrawer,
  type LeadDrawerNote,
  type DrawerTodo,
} from "./LeadDetailDrawer";
import type { DocumentItem } from "./LeadDocumentsSection";

export interface LeadDetailContentNote {
  id: string;
  text: string;
  created_at: string;
  created_by: string | null;
}

interface Props {
  lead: LeadRow;
  todos: LeadTodoRow[];
  notes?: LeadDetailContentNote[];
  slug: string;
  T: ThemeTokens;
  onClose: () => void;
  onAction: (action: string) => void;
  /** M2 fix: "Открыть" → rental page (photos live there); "Запросить" →
   *  creates a follow-up todo. Previously the buttons rendered but did
   *  nothing (onAction was never attached). */
  onDocumentAction: (docKey: string, action: "open" | "request") => void;
  onCreateTodo: (title: string) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onAddNote: (text: string) => void;
  onDismissLead: () => void;
  /** «Отработан» / «Перезвонить в ...» — проксируется в LeadHandlingSection. */
  onMarkHandled?: (handled: boolean) => void;
  onSetCallback?: (iso: string, note: string) => void;
  onCompleteCallback?: () => void;
  onClearCallback?: () => void;
  handlingBusy?: boolean;
  /** m4 fix: true while a Telegram notify is in flight — disables the button. */
  notifyBusy?: boolean;
  /** When true, render as the inner content of a parent sheet (no backdrop). */
  asSheetChild?: boolean;
  /** «Прочитать заметки» — раскрыть и прокрутить к секции заметок. */
  focusNotesSignal?: number;
}

/**
 * Integration wrapper that bridges LeadsClient state → LeadDetailDrawer.
 *
 * Responsibilities:
 *   1. Compute the lead's pipeline stage on-the-fly (computeLeadStage) and
 *      inject it as `stageKey` so LeadDetailDrawer can read it.
 *   2. Compute QR status (computeQrStatus) and inject as `qrStatus` so
 *      computeLeadSignals can read it.
 *   3. Compute the SLA signals array (computeLeadSignals).
 *   4. Compute the history timeline (computeLeadHistory) from lead + todos + notes.
 *   5. Build the documents checklist from the lead's first rental's photo fields.
 *   6. Cast todos to DrawerTodo (adds optional `due_date` column used by sla-signals).
 *
 * This is a thin layer — all rendering is delegated to LeadDetailDrawer.
 */
export function LeadDetailContent({
  lead,
  todos,
  notes = [],
  slug,
  T,
  onClose,
  onAction,
  onDocumentAction,
  onCreateTodo,
  onToggleTodo,
  onDeleteTodo,
  onAddNote,
  onDismissLead,
  onMarkHandled,
  onSetCallback,
  onCompleteCallback,
  onClearCallback,
  handlingBusy = false,
  notifyBusy = false,
  asSheetChild = false,
  focusNotesSignal = 0,
}: Props) {
  // NOTE: We CANNOT early-return before hooks (React rules-of-hooks).
  // All hooks below handle null `lead` gracefully via try/catch + null-safe
  // accessors. The actual null-guard render happens at the bottom of this
  // component, after all hooks have been called.

  // ── 1. Inject computed stage + qr status onto the lead ──
  // Wrap computeLeadStage/computeQrStatus in try/catch — they iterate over
  // lead.rentals / lead.sales which may have unexpected shape.
  const enrichedLead = useMemo(() => {
    let stageKey: string;
    try {
      stageKey = (lead as { stageKey?: string }).stageKey || computeLeadStage(lead);
    } catch {
      stageKey = "new";
    }
    let qrStatus: string;
    try {
      qrStatus = (lead as { qrStatus?: string }).qrStatus || computeQrStatus(lead);
    } catch {
      qrStatus = "unclaimed";
    }
    return { ...lead, stageKey, qrStatus } as LeadRow & {
      stageKey: string;
      qrStatus: string;
    };
  }, [lead]);

  // ── 2. Compute SLA signals (uses the enriched lead with qrStatus set) ──
  const signals: LeadSignal[] = useMemo(() => {
    try {
      return computeLeadSignals(enrichedLead, todos);
    } catch {
      return [];
    }
  }, [enrichedLead, todos]);

  // ── 3. Compute history timeline ──
  const history: LeadHistoryEvent[] = useMemo(() => {
    try {
      return computeLeadHistory(enrichedLead, todos, notes);
    } catch {
      return [];
    }
  }, [enrichedLead, todos, notes]);

  // ── 4. Build documents checklist from the first rental ──
  const docs: DocumentItem[] = useMemo(() => {
    try {
      return buildDocuments(enrichedLead, onDocumentAction);
    } catch {
      return [];
    }
  }, [enrichedLead, onDocumentAction]);

  // ── 5. Cast todos to DrawerTodo (adds optional due_date) ──
  // LeadTodoRow now includes due_date — no cast needed
  const drawerTodos = useMemo(() => todos, [todos]);

  // ── 6. Cast notes to LeadDrawerNote ──
  const drawerNotes = useMemo(
    () => notes as LeadDrawerNote[],
    [notes]
  );

  // ── 7. Priority Score (ТЗ: индекс 0–100) — плашка в шапке шторки ──
  // «now» фиксируется на мемо — индекс стабилен между рендерами и не
  // «дёргается» лишними пересчётами; пересчёт происходит при смене лида/задач.
  const priority: LeadPriority = useMemo(() => {
    const pending = todos.filter((t) => t.status !== "done").length;
    return computeLeadPriority(enrichedLead, pending, Date.now());
  }, [enrichedLead, todos]);

  // ── Null-guard render ──
  // Now that all hooks have been called, we can safely bail if lead is null.
  // This happens AFTER hooks so React's rules-of-hooks are satisfied.
  if (!lead || typeof lead !== "object") {
    return null;
  }

  return (
    <LeadDetailDrawer
      lead={enrichedLead}
      todos={drawerTodos}
      notes={drawerNotes}
      signals={signals}
      history={history}
      docs={docs}
      priority={priority}
      slug={slug}
      T={T}
      onClose={onClose}
      onAction={onAction}
      onCreateTodo={onCreateTodo}
      onToggleTodo={onToggleTodo}
      onDeleteTodo={onDeleteTodo}
      onAddNote={onAddNote}
      onDismissLead={onDismissLead}
      onMarkHandled={onMarkHandled}
      onSetCallback={onSetCallback}
      onCompleteCallback={onCompleteCallback}
      onClearCallback={onClearCallback}
      handlingBusy={handlingBusy}
      notifyBusy={notifyBusy}
      asSheetChild={asSheetChild}
      focusNotesSignal={focusNotesSignal}
    />
  );
}

/**
 * Build a 5-row document checklist from the RELEVANT rental's photo fields +
 * verification metadata. Each row gets a status (missing/pending/verified/sent)
 * based on, in priority order:
 * 1. metadata.checklist.passport_verified / license_verified (set by
 *    /api/verify-rental-checklist when the operator confirms the photos)
 * 2. metadata.contract_verifier.status === "verified" — written by BOTH
 *    creation flows: /doc (operator saw the physical docs) and the web-app
 *    checkout (doc-verifier record). A rental created through either flow
 *    is docs-complete BY CONSTRUCTION — the flag must not fire.
 * 3. active/completed rental status (activation requires verification)
 * 4. photo field presence (rental.passportMainpagePhoto etc.)
 *
 * FIX: was only checking photo paths on rentals[0] — but (a) verification
 * DELETES photos (152-ФЗ compliance) so verified docs showed as "missing",
 * and (b) rentals[0] could be the artifact stub with no data at all. Now
 * reads the relevant rental (pickRelevantRental) and honors all verifiers.
 */
function buildDocuments(
  lead: LeadRow,
  onDocumentAction: (docKey: string, action: "open" | "request") => void,
): DocumentItem[] {
  const rental = pickRelevantRental(lead) ?? lead.rentals[0];
  if (!rental) return [];

  // /doc flow: the operator collected and checked the physical documents
  // in person when creating the contract — verified by construction.
  const isDocFlow = getFlowType(lead) === "doc";

  // Read verification checklist from rental metadata (set by /api/verify-rental-checklist)
  const meta = (rental as Record<string, unknown>).metadata as Record<string, unknown> | null;
  const checklist = (meta?.checklist as Record<string, unknown>) || {};
  const verifier = (meta?.contract_verifier as Record<string, unknown> | null) || null;
  const passportVerified = !!checklist.passport_verified || verifier?.status === "verified" || isDocFlow;
  const licenseVerified = !!checklist.license_verified || verifier?.status === "verified" || isDocFlow;

  // Active/completed rentals are always verified (activation requires verification todos done)
  const isActivated = rental.status === "active" || rental.status === "completed";

  const items: DocumentItem[] = [
    {
      key: "passport_main",
      name: "Паспорт — основная страница",
      status: (passportVerified || isActivated || rental.passportMainpagePhoto) ? "verified" : "missing",
      actionLabel: rental.passportMainpagePhoto ? "Открыть" : (passportVerified || isActivated ? "" : "Запросить"),
      onAction: () => onDocumentAction("passport_main", rental.passportMainpagePhoto ? "open" : "request"),
    },
    {
      key: "passport_registration",
      name: "Паспорт — прописка",
      status: (passportVerified || isActivated || rental.passportRegistrationPhoto) ? "verified" : "missing",
      actionLabel: rental.passportRegistrationPhoto ? "Открыть" : (passportVerified || isActivated ? "" : "Запросить"),
      onAction: () => onDocumentAction("passport_registration", rental.passportRegistrationPhoto ? "open" : "request"),
    },
    {
      key: "licence_front",
      name: "Водительское удостоверение",
      status: (licenseVerified || isActivated || rental.driversLicenceFrontalPhoto) ? "verified" : "missing",
      actionLabel: rental.driversLicenceFrontalPhoto ? "Открыть" : (licenseVerified || isActivated ? "" : "Запросить"),
      onAction: () => onDocumentAction("licence_front", rental.driversLicenceFrontalPhoto ? "open" : "request"),
    },
  ];

  // If the rental is pending_confirmation, mark docs as "pending" instead of "missing"
  if (rental.status === "pending_confirmation") {
    return items.map((it) =>
      it.status === "missing" ? { ...it, status: "pending" as const } : it
    );
  }

  return items;
}
