"use client";

import { useMemo } from "react";
import { useVirtualList } from "../hooks/useVirtualList";
import { LeadCard } from "./LeadCard";
import { LeadDetailContent } from "./LeadDetailContent";
import { X } from "lucide-react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import { metaFor, getInitials } from "../leads-utils";

interface LeadListProps {
  leads: LeadRow[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onDismiss: (id: string) => void;
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  T: any;
  crewId: string;
  slug: string;
}

const ITEM_HEIGHT = 180; // Approximate height of a lead card

export function LeadList({
  leads,
  selectedId,
  setSelectedId,
  onDismiss,
  getTodosForLead,
  T,
  crewId,
  slug,
}: LeadListProps) {
  const { parentRef, virtualItems, totalHeight } = useVirtualList(leads, {
    itemHeight: ITEM_HEIGHT,
    containerHeight: 600, // Will be constrained by parent max-height
    overscan: 5,
  });

  const isSelected = useMemo(
    () => selectedId ? new Set([selectedId]) : new Set<string>(),
    [selectedId]
  );

  const handleSelect = (lead: LeadRow) => {
    setSelectedId(selectedId === lead.user_id ? null : lead.user_id);
  };

  return (
    <div ref={parentRef} className="h-full max-h-[calc(100vh-280px)] overflow-y-auto" style={{ width: "100%" }}>
      <div className="space-y-3" style={{ height: totalHeight, width: "100%" }}>
        {virtualItems.map((virtualRow) => {
          const lead = leads[virtualRow.index];
          const isThisSelected = isSelected.has(lead.user_id);
          return (
            <div key={lead.user_id} data-lead-id={lead.user_id} style={{ position: "absolute", top: virtualRow.start, left: 0, right: 0, height: virtualRow.size }}>
              <LeadCard
                lead={lead}
                T={T}
                isSelected={isThisSelected}
                onSelect={() => handleSelect(lead)}
                onDismiss={onDismiss}
                todos={getTodosForLead(lead)}
              />
              {isThisSelected && (
                <div className="lg:hidden rounded-2xl border p-4 mt-3" style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}>
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex shrink-0 items-center justify-center rounded-full font-bold" style={{ width: 48, height: 48, backgroundColor: metaFor(lead.source).bg, color: metaFor(lead.source).color, fontSize: "14px" }}>
                      {getInitials(lead.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold" style={{ color: T.text }}>{lead.full_name || "Без имени"}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: T.textMuted }}>
                        {lead.phone && <span>{lead.phone}</span>}
                        {lead.username && <span>@{lead.username}</span>}
                      </div>
                    </div>
                    <button onClick={() => setSelectedId(null)} aria-label="Свернуть карточку" className="rounded p-1 transition hover:bg-black/5" style={{ color: T.textFaint }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <LeadDetailContent lead={lead} todos={getTodosForLead(lead)} crewId={crewId} slug={slug} T={T} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}