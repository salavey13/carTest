"use client";

import { useMemo } from "react";
import { Avatar } from "./Avatar";
import { relativeTime, metaFor, getInitials } from "../leads-utils";
import { BOARD_COLUMNS } from "../leads-constants";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";

interface LeadBoardProps {
  leads: LeadRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDismiss: (id: string) => void;
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  T: any;
}

export function LeadBoard({ leads, selectedId, onSelect, onDismiss, getTodosForLead, T }: LeadBoardProps) {
  const columns = useMemo(() => {
    const map: Record<string, LeadRow[]> = { new: [], contacted: [], configured: [], contract_generated: [], completed: [] };
    for (const l of leads) {
      const key = l.intentStage || "new";
      const col = map[key] ? key : "new";
      map[col].push(l);
    }
    return map;
  }, [leads]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {BOARD_COLUMNS.map(({ key, label, color }) => {
        const colLeads = columns[key] || [];
        return (
          <div key={key} className="flex max-h-[calc(100vh-280px)] flex-col rounded-2xl border" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
            <div className="flex items-center justify-between border-b p-3" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-bold" style={{ color: T.text }}>{label}</span>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: T.borderSoft, color: T.text }}>{colLeads.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {colLeads.map((lead) => {
                const pending = getTodosForLead(lead).filter((t) => t.status !== "done").length;
                const meta = metaFor(lead.source);
                return (
                  <div
                    key={lead.user_id}
                    onClick={() => onSelect(selectedId === lead.user_id ? "" : lead.user_id)}
                    className="cursor-pointer rounded-xl border p-2.5 transition hover:shadow-sm"
                    style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: selectedId === lead.user_id ? `0 0 0 2px ${T.borderActive}33` : undefined }}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={lead.full_name} source={lead.source} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold" style={{ color: T.text }}>{lead.full_name || "Без имени"}</p>
                        <p className="truncate text-[10px]" style={{ color: T.textMuted }}>{lead.phone || lead.username || relativeTime(lead.createdAt)}</p>
                      </div>
                      {pending > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 text-[9px] font-bold text-amber-400">{pending}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}