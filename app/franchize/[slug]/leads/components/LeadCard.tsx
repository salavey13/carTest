"use client";

import { Avatar } from "./Avatar";
import { SourceBadge } from "./SourceBadge";
import { CheckCircle, Trash2, ChevronDown, ChevronRight, AlertCircle, FileText, TrendingUp, Phone, Send } from "lucide-react";
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
      className="group relative overflow-hidden rounded-2xl border transition-all duration-200 hover:shadow-md active:scale-[0.99]"
      style={{
        backgroundColor: T.bgCard,
        borderColor: isSelected ? T.borderActive : T.border,
        boxShadow: isSelected ? `0 0 0 2px ${T.borderActive}33, ${T.shadow}` : undefined,
      }}
    >
      {/* Temperature stripe */}
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: tempColor }} />

      <button onClick={onSelect} className="w-full p-3 pl-4 text-left">
        <div className="flex items-start gap-3">
          <Avatar name={lead.full_name} source={lead.source} size={48} />

          <div className="min-w-0 flex-1">
            {/* Name row */}
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold" style={{ color: T.text }}>{displayName}</p>
              {lead.verified && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
              {pendingTodos > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                  {pendingTodos}
                </span>
              )}
            </div>

            {/* Contact row */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: T.textMuted }}>
              {lead.phone && <span className="truncate font-medium" style={{ color: T.text }}>{lead.phone}</span>}
              {lead.username && <span>@{lead.username}</span>}
              {relTime && <span>{relTime}</span>}
            </div>

            {/* Tags row */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SourceBadge source={lead.source} />
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${tempColor}15`, color: tempColor }}>
                {tempLabel}
              </span>
              {lead.troubled && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "rgba(220,38,38,0.15)", color: "#dc2626" }}>
                  <AlertCircle className="h-3 w-3" /> Проблемный
                </span>
              )}
            </div>

            {/* History row */}
            {(lead.totalSpent ?? 0) > 0 || lead.rentals.length > 0 || lead.sales.length > 0 ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]" style={{ color: T.textMuted }}>
                {lead.rentals.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" />{lead.rentals.length} аренд
                  </span>
                )}
                {lead.sales.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />{lead.sales.length} продаж
                  </span>
                )}
                {(lead.totalSpent ?? 0) > 0 && <span>{fmtMoney(lead.totalSpent)}</span>}
              </div>
            ) : null}
          </div>

          {/* Right column: actions + chevron */}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            {/* Quick actions — visible on hover */}
            <div className="flex flex-col gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg p-1.5 transition hover:bg-emerald-500/15 hover:text-emerald-400"
                  style={{ color: T.textFaint }}
                  aria-label={`Позвонить ${lead.phone}`}
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}
              {lead.username && (
                <a
                  href={`https://t.me/${lead.username}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg p-1.5 transition hover:bg-sky-500/15 hover:text-sky-400"
                  style={{ color: T.textFaint }}
                  aria-label={`Написать @${lead.username}`}
                >
                  <Send className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Убрать «${displayName}» из списка?`)) onDismiss(lead.user_id);
              }}
              className="rounded p-1.5 opacity-0 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
              style={{ color: T.textFaint }}
              aria-label={`Убрать ${displayName}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            {isSelected ? (
              <ChevronDown className="h-4 w-4 shrink-0" style={{ color: T.accent }} />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: T.textFaint }} />
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
