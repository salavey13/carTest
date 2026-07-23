"use client";

import { useMemo, useRef, useCallback, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import type { LeadSignal } from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";
import { LeadCard } from "./LeadCard";

interface Props {
  leads: LeadRow[];
  selectedLeadId: string | null;
  onSelectLead: (lead: LeadRow) => void;
  onDismissLead: (leadId: string) => void;
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  getLeadSignals: (lead: LeadRow) => LeadSignal[];
  T: ThemeTokens;
  crewId: string;
  slug: string;
  /** Optional empty-state renderer (defaults to a generic Inbox empty card). */
  emptyState?: ReactNode;
}

/** Approximate card height — the virtualizer measures actual height via measureElement. */
const ESTIMATED_ITEM_HEIGHT = 192;
const OVERSCAN = 6;

/**
 * Virtualized lead list.
 *
 * Uses @tanstack/react-virtual for windowed rendering — only the visible
 * LeadCards (+ OVERSCAN above/below) are mounted, so the list stays smooth
 * with thousands of leads.
 *
 * Each row is absolutely positioned (transform: translateY) inside a tall
 * container. measureElement keeps heights accurate when content reflows.
 */
export function LeadList({
  leads,
  selectedLeadId,
  onSelectLead,
  onDismissLead,
  getTodosForLead: _getTodosForLead,
  getLeadSignals,
  T,
  crewId: _crewId,
  slug: _slug,
  emptyState,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: OVERSCAN,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  const handleSelect = useCallback(
    (lead: LeadRow) => {
      onSelectLead(lead);
    },
    [onSelectLead]
  );

  const handleDismiss = useCallback(
    (leadId: string) => {
      onDismissLead(leadId);
    },
    [onDismissLead]
  );

  // Stable id set for fast selection lookup.
  const selectedSet = useMemo(
    () => (selectedLeadId ? new Set([selectedLeadId]) : new Set<string>()),
    [selectedLeadId]
  );

  if (leads.length === 0) {
    return (
      <div
        className="grid place-items-center rounded-[24px] border border-dashed p-10 text-center"
        style={{ borderColor: T.border }}
      >
        {emptyState ?? (
          <div className="space-y-2">
            <Inbox className="mx-auto h-10 w-10" style={{ color: T.textFaint }} aria-hidden />
            <p className="text-sm" style={{ color: T.textMuted }}>
              Лиды не найдены
            </p>
            <p className="text-xs" style={{ color: T.textFaint }}>
              Измените фильтры или поисковый запрос
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[calc(100vh-280px)] overflow-y-auto overflow-x-hidden pr-1"
      style={{
        // Thin scrollbar tinted with the theme border color so it adapts to
        // light/dark. Smooth scrolling for anchor jumps (selected lead
        // scrollIntoView).
        scrollbarWidth: "thin",
        scrollbarColor: `${T.border} transparent`,
        scrollBehavior: "smooth",
      }}
    >
      <div style={{ position: "relative", height: totalHeight, width: "100%" }}>
        {virtualItems.map((virtualRow) => {
          const lead = leads[virtualRow.index];
          if (!lead) return null;
          const isSelected = selectedSet.has(lead.user_id);
          const signals = getLeadSignals(lead);
          return (
            <motion.div
              key={lead.user_id}
              data-lead-id={lead.user_id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              // IMPORTANT: we animate ONLY opacity (not `y`) here. Framer-motion's
              // `y` motion value would override the inline `transform: translateY(...)`
              // used by @tanstack/react-virtual for absolute positioning, which
              // previously caused every virtualized row to collapse to top:0 and
              // visually stack on top of each other.
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, delay: Math.min(virtualRow.index * 0.01, 0.06) }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: 12,
              }}
            >
              <LeadCard
                lead={lead}
                signals={signals}
                selected={isSelected}
                onSelect={() => handleSelect(lead)}
                onDismiss={handleDismiss}
                T={T}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
