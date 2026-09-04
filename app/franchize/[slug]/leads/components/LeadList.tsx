// /app/franchize/[slug]/leads/components/LeadList.tsx
"use client";

import { useMemo, useCallback } from "react";
import { useVirtualList } from "../hooks/useVirtualList";
import { LeadCard } from "./LeadCard";
import type {LeadRow, LeadTodoRow} from "../leads-types";
import { computeLeadSignals } from "../lib/sla-signals";
import { getLeadHandling, type LeadHandling } from "../lib/lead-handling";
import type { LeadSignal } from "../lib/sla-signals";
import type { LeadPriority } from "../lib/lead-priority";

interface LeadListProps {
  leads: LeadRow[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onDismiss: (id: string) => void;
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  /** Priority Score (ТЗ): карта индексов 0–100 для лайбочек на карточках. */
  priorityMap?: Map<string, LeadPriority>;
  /** «Прочитать заметки» — открывает шторку лида сразу на заметках. */
  onReadNotes?: (leadId: string) => void;
  T: any;
  crewId: string;
  slug: string;
  /**
   * Optional callback fired when a lead is selected (desktop: detail panel,
   * mobile: bottom sheet). Lets parent own the detail entirely.
   */
  onSelectLead?: (lead: LeadRow | null) => void;
}

/** Approximate card height for the virtualizer's FIRST estimate.
 * Real height is measured per-element (measureElement); this is only the
 * seed for not-yet-rendered items. Was 128 — a flag-heavy LeadCard
 * (callback + notes + SLA + next-step + verification rows) is 260–400px,
 * so freshly rendered items got estimate-based offsets and briefly
 * RENDERED ON TOP of the cards above them (the "flags overlap other
 * flags" report). 280 keeps the initial error small; the per-item gap is
 * paddingBottom on the wrapper (included in the measured height).
 */
const ITEM_HEIGHT = 280;

export function LeadList({
  leads,
  selectedId,
  setSelectedId,
  onDismiss,
  getTodosForLead,
  priorityMap,
  onReadNotes,
  T,
  crewId,
  slug,
  onSelectLead,
}: LeadListProps) {
  const { parentRef, virtualItems, totalHeight, measureElement } = useVirtualList(leads, {
    itemHeight: ITEM_HEIGHT,
    containerHeight: 600,
    overscan: 6,
  });

  const isSelected = useMemo(
    () => (selectedId ? new Set([selectedId]) : new Set<string>()),
    [selectedId]
  );

  const handleSelect = useCallback(
    (lead: LeadRow) => {
      const nextId = selectedId === lead.user_id ? null : lead.user_id;
      setSelectedId(nextId);
      onSelectLead?.(nextId ? lead : null);
    },
    [selectedId, setSelectedId, onSelectLead]
  );

  return (
    <div
      ref={parentRef}
      // MOBILE: dvh-высота под статичные KPI-полосу + тулбар — список занимает
      // экран, не заставляя крутить страницу ради пары карточек (и наоборот).
      // sm+ — прежняя vh-оценка. dvh вместо vh — браузерные панели телефона
      // (адресная строка) не обрезают последнюю карточку.
      className="h-full max-h-[calc(100dvh-190px)] overflow-y-auto sm:max-h-[calc(100vh-280px)]"
      style={{ width: "100%" }}
    >
      <div style={{ position: "relative", height: totalHeight, width: "100%" }}>
        {virtualItems.map((virtualRow) => {
          const lead = leads[virtualRow.index];
          const isThisSelected = isSelected.has(lead.user_id);
          // getTodosForLead is a required prop — the old `getTodosForLead ? … : []`
          // tripped TS2774 (condition always true).
          const leadTodos = getTodosForLead(lead);
          return (
            <div
              key={lead.user_id}
              data-index={virtualRow.index}
              // FIX (codereview): the parent's «scroll to selected lead» effect
              // queries [data-lead-id="…"] — only LeadTableView had it, so the
              // list view never scrolled the selection into view. Same anchor
              // here; the LeadDetailSheet reads it too.
              data-lead-id={lead.user_id}
              ref={measureElement}
              className="virtual-item"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualRow.start}px)`,
                // Gap between cards — paddingBottom is part of the element's
                // measured height, so the virtualizer positions the NEXT card
                // below the gap: cards never visually collide.
                paddingBottom: 12,
              }}
            >
              <LeadCard
                lead={lead}
                T={T}
                selected={isThisSelected}
                onSelect={() => handleSelect(lead)}
                onDismiss={onDismiss}
                priority={priorityMap?.get(lead.user_id)}
                handling={getLeadHandling(leadTodos)}
                onReadNotes={onReadNotes}
                signals={computeLeadSignals(lead, leadTodos)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
