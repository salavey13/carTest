"use client";

import { Avatar } from "./Avatar";
import { SourceBadge } from "./SourceBadge";
import { CheckCircle, Trash2, ChevronDown, ChevronRight, AlertCircle, FileText, TrendingUp } from "lucide-react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import { SOURCE_META, STAGE_LABELS } from "../leads-constants";
import { getInitials, relativeTime, metaFor, fmtMoney, temperatureColor, temperatureLabel } from "../leads-utils";

interface LeadCardProps {
  lead: LeadRow;
  T: any;
  isSelected: boolean;
  onSelect: () => void;
  onDismiss: (id: string) => void;
  todos: LeadTodoRow[];
}

export function LeadCard({ lead, T, isSelected, onSelect, onDismiss, todos }: LeadCardProps) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.unknown;
  const relTime = relativeTime(lead.lastSeenAt || lead.createdAt);
  const pendingTodos = todos.filter((t) => t.status !== "done").length;
  const tempColor = temperatureColor(lead.urgencyScore, pendingTodos);
  const tempLabel = temperatureLabel(lead.urgencyScore, pendingTodos);
  const displayName = lead.full_name || "Без имени";

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border transition-all duration-200"
      style={{
        backgroundColor: T.bgCard,
        borderColor: isSelected ? T.borderActive : T.border,
        boxShadow: isSelected ? `0 0 0 2px ${T.borderActive}33, ${T.shadow}` : undefined,
      }}
    >
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: tempColor }} />
      <button onClick={onSelect} className="w-full p-3 pl-4 text-left">
        <div className="flex items-start gap-3">
          <Avatar name={lead.full_name} source={lead.source} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold" style={{ color: T.text }}>{displayName}</p>
              {lead.verified && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
              {pendingTodos > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-400">
                  {pendingTodos}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: T.textMuted }}>
              {lead.phone && <span className="truncate font-medium" style={{ color: T.text }}>{lead.phone}</span>}
              {lead.username && <span>@{lead.username}</span>}
              {relTime && <span>{relTime}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SourceBadge source={lead.source} />
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: tempColor + "15", color: tempColor }}>{tempLabel}</span>
              {lead.troubled && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "#dc262615", color: "#dc2626" }}>
                  <AlertCircle className="h-3 w-3" /> Проблемный
                </span>
              )}
            </div>
            {((lead.totalSpent || 0) > 0 || lead.rentals.length > 0 || lead.sales.length > 0) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]" style={{ color: T.textMuted }}>
                {lead.rentals.length > 0 && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{lead.rentals.length} аренд</span>}
                {lead.sales.length > 0 && <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{lead.sales.length} продаж</span>}
                {(lead.totalSpent || 0) > 0 && <span>{fmtMoney(lead.totalSpent)}</span>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`Убрать «${displayName}» из списка?`)) onDismiss(lead.user_id); }}
              className="rounded p-1.5 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
              style={{ color: T.textFaint }}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {isSelected ? <ChevronDown className="h-4 w-4" style={{ color: T.textFaint }} /> : <ChevronRight className="h-4 w-4" style={{ color: T.textFaint }} />}
          </div>
        </div>
      </button>
    </div>
  );
}