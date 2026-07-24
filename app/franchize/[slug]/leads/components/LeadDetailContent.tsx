"use client";

import { useMemo } from "react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import type {
  LeadSignal,
  LeadHistoryEvent,
} from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";
import {
  computeLeadStage,
  computeQrStatus,
} from "../lib/pipeline-stages";
import { computeLeadSignals } from "../lib/sla-signals";
import { computeLeadHistory } from "../lib/lead-history";
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
  T: ThemeTokens;
  onClose: () => void;
  onAction: (action: string) => void;
  onCreateTodo: (title: string) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onAddNote: (text: string) => void;
  onDismissLead: () => void;
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
  T,
  onClose,
  onAction,
  onCreateTodo,
  onToggleTodo,
  onDeleteTodo,
  onAddNote,
  onDismissLead,
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
      return buildDocuments(enrichedLead);
    } catch {
      return [];
    }
  }, [enrichedLead]);

  // ── 5. Cast todos to DrawerTodo (adds optional due_date) ──
  // LeadTodoRow now includes due_date — no cast needed
  const drawerTodos = useMemo(() => todos, [todos]);

  // ── 6. Cast notes to LeadDrawerNote ──
  const drawerNotes = useMemo(
    () => notes as LeadDrawerNote[],
    [notes]
  );

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
      T={T}
      onClose={onClose}
      onAction={onAction}
      onCreateTodo={onCreateTodo}
      onToggleTodo={onToggleTodo}
      onDeleteTodo={onDeleteTodo}
      onAddNote={onAddNote}
      onDismissLead={onDismissLead}
    />
  );
}

/**
 * Build a 5-row document checklist from the first rental's photo fields.
 * Each row gets a status (missing/pending/verified/sent) based on field presence.
 */
function buildDocuments(lead: LeadRow): DocumentItem[] {
  const rental = lead.rentals[0];
  if (!rental) return [];

  const items: DocumentItem[] = [
    {
      key: "passport_main",
      name: "Паспорт — основная страница",
      status: rental.passportMainpagePhoto ? "verified" : "missing",
      actionLabel: rental.passportMainpagePhoto ? "Открыть" : "Запросить",
    },
    {
      key: "passport_registration",
      name: "Паспорт — прописка",
      status: rental.passportRegistrationPhoto ? "verified" : "missing",
      actionLabel: rental.passportRegistrationPhoto ? "Открыть" : "Запросить",
    },
    {
      key: "licence_front",
      name: "Водительское удостоверение",
      status: rental.driversLicenceFrontalPhoto ? "verified" : "missing",
      actionLabel: rental.driversLicenceFrontalPhoto ? "Открыть" : "Запросить",
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
