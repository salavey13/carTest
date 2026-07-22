"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import type { LeadRow } from "@/app/franchize/server-actions/leads";
import type { LeadSignal } from "@/app/franchize/[slug]/leads/leads-constants";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
} from "@/app/franchize/[slug]/leads/lib/pipeline-stages";
import { getInitials, relativeTime } from "@/app/franchize/[slug]/leads/leads-utils";

interface Props {
  /**
   * Leads grouped by stageKey. The caller is responsible for bucketing —
   * we don't recompute stages here so the parent can pre-filter
   * (e.g. hide closed_lost, mode filter, etc.) before passing.
   */
  leadsByStage: Record<string, LeadRow[]>;
  selectedLeadId: string | null;
  onSelectLead: (lead: LeadRow) => void;
  getLeadSignals: (lead: LeadRow) => LeadSignal[];
  T: ThemeTokens;
}

/**
 * Kanban board with one column per pipeline stage (9 total).
 *
 * - Mobile: horizontal scroll (one column visible at a time)
 * - Desktop (lg+): all 9 columns side-by-side with equal flex
 *
 * Cards are NOT draggable in v1 — they are click targets that open the
 * detail drawer / mobile sheet. Each card is a compact variant of LeadCard
 * (just avatar, name, stage badge, SLA chip).
 */
export function LeadBoard({
  leadsByStage,
  selectedLeadId,
  onSelectLead,
  getLeadSignals,
  T,
}: Props) {
  // Total count for the header summary
  const totalCount = useMemo(
    () => Object.values(leadsByStage).reduce((sum, arr) => sum + arr.length, 0),
    [leadsByStage]
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold" style={{ color: T.textMuted }}>
          Воронка по стадиям
        </h3>
        <span className="text-xs" style={{ color: T.textFaint }}>
          {totalCount} {pluralize(totalCount, "лид", "лида", "лидов")}
        </span>
      </div>

      <div
        // Mobile: horizontal scroll, one column visible at a time.
        // Desktop (lg+): 9-column grid (PIPELINE_STAGES length), no overflow.
        // Previously this className had duplicate `gap-3 overflow-x-auto` tokens
        // AND a conflicting `lg:grid lg:flex` pair — the later `lg:flex` won and
        // broke the desktop grid layout (columns stacked instead of gridded).
        className="flex gap-3 overflow-x-auto pb-4 lg:grid lg:grid-cols-9 lg:gap-3 lg:overflow-visible lg:pb-0"
        style={{ scrollbarWidth: "thin" }}
      >
        {PIPELINE_STAGES.map((stage) => (
          <BoardColumn
            key={stage.key}
            stageKey={stage.key}
            label={STAGE_LABELS[stage.key] || stage.key}
            color={STAGE_COLORS[stage.key] || "#64748b"}
            leads={leadsByStage[stage.key] || []}
            selectedLeadId={selectedLeadId}
            onSelectLead={onSelectLead}
            getLeadSignals={getLeadSignals}
            T={T}
          />
        ))}
      </div>
    </section>
  );
}

interface ColumnProps {
  stageKey: string;
  label: string;
  color: string;
  leads: LeadRow[];
  selectedLeadId: string | null;
  onSelectLead: (lead: LeadRow) => void;
  getLeadSignals: (lead: LeadRow) => LeadSignal[];
  T: ThemeTokens;
}

function BoardColumn({
  stageKey,
  label,
  color,
  leads,
  selectedLeadId,
  onSelectLead,
  getLeadSignals,
  T,
}: ColumnProps) {
  return (
    <div
      className="flex w-[280px] shrink-0 flex-col rounded-[20px] border lg:w-auto lg:min-w-0"
      style={{
        borderColor: `${color}33`,
        background: `${color}0a`,
        maxHeight: "calc(100vh - 280px)",
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-3"
        style={{ borderColor: `${color}26` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
          />
          <span
            className="truncate text-xs font-semibold uppercase tracking-wide"
            style={{ color: T.text }}
          >
            {label}
          </span>
        </div>
        <span
          className="grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
          style={{ background: `${color}26`, color }}
        >
          {leads.length}
        </span>
      </div>

      {/* Scrollable card list */}
      <div
        className="flex-1 space-y-2 overflow-y-auto p-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {leads.length === 0 ? (
          <EmptyColumnPlaceholder color={color} T={T} />
        ) : (
          leads.map((lead, idx) => (
            <BoardCard
              key={lead.user_id}
              lead={lead}
              stageLabel={label}
              stageColor={color}
              selected={selectedLeadId === lead.user_id}
              onSelect={() => onSelectLead(lead)}
              signals={getLeadSignals(lead)}
              T={T}
              index={idx}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CardProps {
  lead: LeadRow;
  stageLabel: string;
  stageColor: string;
  selected: boolean;
  onSelect: () => void;
  signals: LeadSignal[];
  T: ThemeTokens;
  index: number;
}

function BoardCard({
  lead,
  stageColor,
  selected,
  onSelect,
  signals,
  T,
  index,
}: CardProps) {
  const initials = getInitials(lead.full_name);
  const rel = relativeTime(lead.lastSeenAt || lead.createdAt);
  const topSignal = signals[0];
  const sigTone = topSignal?.tone || "neutral";
  const sigColor =
    sigTone === "danger"
      ? "#ef4444"
      : sigTone === "warning"
        ? "#f59e0b"
        : sigTone === "good"
          ? "#22c55e"
          : "#a1a1aa";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.1), duration: 0.18 }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      className="relative w-full overflow-hidden rounded-2xl border p-3 text-left transition"
      style={{
        borderColor: selected ? stageColor : "rgba(255,255,255,0.08)",
        background: selected
          ? `linear-gradient(180deg, ${stageColor}1a, rgba(255,255,255,0.02))`
          : "rgba(255,255,255,0.025)",
        boxShadow: selected ? `0 0 0 1px ${stageColor}55, 0 8px 22px ${stageColor}22` : "none",
      }}
    >
      {/* Left edge color stripe */}
      <div
        className="absolute left-0 top-0 h-full w-0.5"
        style={{ background: stageColor }}
      />

      <div className="flex items-center gap-2.5 pl-1">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold"
          style={{ background: `${stageColor}26`, color: stageColor }}
        >
          {initials}
        </div>
        {/* min-w-0 + flex-1 lets the name truncate properly inside the 280px
            column. Previously this was min-w-[280px] flex-shrink-0 which forced
            the inner block to 280px+ and made the chevron + avatar overflow /
            overlap the next card. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className="truncate text-xs font-semibold"
              style={{ color: T.text }}
            >
              {lead.full_name || "Без имени"}
            </p>
            {lead.verified && (
              <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: "#22c55e" }} />
            )}
          </div>
          <p
            className="truncate text-[10px]"
            style={{ color: T.textMuted }}
          >
            {lead.phone || (lead.username ? `@${lead.username}` : "") || rel || "—"}
          </p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: T.textFaint }} />
      </div>

      {/* SLA chip */}
      {topSignal && (
        <div className="mt-2 flex flex-wrap items-center gap-1 pl-1">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
            style={{ background: `${sigColor}1f`, color: sigColor }}
          >
            {topSignal.label}: <span className="font-bold tabular-nums">{topSignal.value}</span>
          </span>
        </div>
      )}
    </motion.button>
  );
}

function EmptyColumnPlaceholder({ color, T }: { color: string; T: ThemeTokens }) {
  return (
    <div
      className="grid place-items-center rounded-2xl border border-dashed py-8 text-center"
      style={{ borderColor: `${color}26` }}
    >
      <div
        className="grid h-8 w-8 place-items-center rounded-full"
        style={{ background: `${color}1a` }}
      >
        <ChevronRight className="h-4 w-4" style={{ color: `${color}aa` }} />
      </div>
      <p className="mt-2 text-[10px]" style={{ color: T.textFaint }}>
        Нет лидов
      </p>
    </div>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
