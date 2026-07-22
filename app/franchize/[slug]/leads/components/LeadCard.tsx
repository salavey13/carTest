"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Phone, Clock, MoreVertical } from "lucide-react";
import type { LeadRow } from "@/app/franchize/server-actions/leads";
import type { LeadSignal } from "@/app/franchize/[slug]/leads/leads-constants";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";
import {
  STAGE_LABELS,
  STAGE_COLORS,
} from "@/app/franchize/[slug]/leads/lib/pipeline-stages";
import { SOURCE_META } from "@/app/franchize/[slug]/leads/leads-constants";
import {
  getInitials,
  relativeTime,
  fmtMoney,
  formatDate,
} from "@/app/franchize/[slug]/leads/leads-utils";

interface Props {
  lead: LeadRow;
  signals: LeadSignal[];
  selected: boolean;
  onSelect: () => void;
  onDismiss: (id: string) => void;
  T: ThemeTokens;
}

const TONE_COLOR: Record<LeadSignal["tone"], string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  neutral: "#a1a1aa",
  good: "#22c55e",
};

/**
 * Lead card v2 — operational dashboard card.
 * - Left edge color stripe (stage color)
 * - Avatar + name + verified check + task count badge
 * - Stage badge (right-aligned)
 * - Phone + time-ago
 * - Source / temperature tags
 * - Bike title + rental count + revenue + return date
 * - SLA block (right-aligned, shows top signal)
 * - Chevron + overflow menu
 */
export function LeadCard({ lead, signals, selected, onSelect, onDismiss, T }: Props) {
  const stageKey = (lead as { stageKey?: string }).stageKey || "new";
  const stageColor = STAGE_COLORS[stageKey] || "#64748b";
  const stageLabel = STAGE_LABELS[stageKey] || stageKey;
  const displayName = lead.full_name || "Без имени";
  const initials = getInitials(lead.full_name);
  const rel = relativeTime(lead.lastSeenAt || lead.createdAt);
  const topSignal = signals[0];
  const slaColor = topSignal ? TONE_COLOR[topSignal.tone] : "#a1a1aa";

  const rental = lead.rentals[0];
  const rentalCount = lead.rentals.length;
  const revenue = lead.totalSpent || (rental?.totalCost ?? 0);
  const returnDate = rental?.endDate ? formatDate(rental.endDate) : null;
  const pending = signals.filter((s) => s.tone === "warning" || s.tone === "danger").length;

  return (
    <motion.article
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      onClick={onSelect}
      className="relative cursor-pointer overflow-hidden rounded-[24px] p-5 pl-6"
      style={{
        background: "T.bgCard",
        border: `1px solid ${selected ? stageColor : "T.border"}`,
        boxShadow: selected
          ? `0 0 0 2px ${stageColor}40, 0 18px 50px rgba(0,0,0,0.35)`
          : "0 18px 50px rgba(0,0,0,0.35)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Left edge color stripe */}
      <div className="absolute left-0 top-0 h-full w-1" style={{ background: stageColor }} />

      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-lg font-bold"
          style={{ background: `${stageColor}26`, color: stageColor }}
        >
          {initials}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Name + stage badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold" style={{ color: T.text }}>
                  {displayName}
                </h3>
                {lead.verified && (
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#22c55e" }} />
                )}
                {pending > 0 && (
                  <span
                    className="grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold"
                    style={{ background: "#f59e0b26", color: "#f59e0b" }}
                  >
                    {pending}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: T.textMuted }}>
                {lead.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </span>
                )}
                {rel && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {rel}
                  </span>
                )}
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium"
              style={{ background: `${stageColor}1a`, color: stageColor }}
            >
              {stageLabel}
            </span>
          </div>

          {/* Source + temperature tags */}
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{ background: "#3b82f620", color: "#93c5fd" }}
            >
              {SOURCE_META[lead.source]?.label || lead.source}
            </span>
            {topSignal && (
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                style={{ background: `${slaColor}26`, color: slaColor }}
              >
                {topSignal.label}
              </span>
            )}
          </div>

          {/* Bike + rental summary */}
          {(lead.bikeTitle || rental) && (
            <div
              className="rounded-2xl border p-3 text-sm"
              style={{
                borderColor: "T.border",
                background: T.bgElevated,
                color: T.textMuted,
              }}
            >
              {lead.bikeTitle && (
                <>
                  Байк: <span style={{ color: T.text }}>{lead.bikeTitle}</span>
                </>
              )}
              <div className="mt-1.5 flex flex-wrap gap-3 text-[11px]" style={{ color: T.textFaint }}>
                {rentalCount > 0 && <span>{rentalCount} аренд</span>}
                {revenue > 0 && <span>{fmtMoney(revenue)}</span>}
                {returnDate && <span>Возврат: {returnDate}</span>}
              </div>
            </div>
          )}

          {/* SLA block — right aligned */}
          {topSignal && (
            <div className="flex justify-end">
              <div
                className="rounded-2xl border p-3 text-right"
                style={{ borderColor: `${slaColor}40`, background: `${slaColor}1a`, minWidth: 160 }}
              >
                <div className="text-[10px] uppercase tracking-wide" style={{ color: slaColor }}>
                  SLA
                </div>
                <div className="mt-1 text-2xl font-bold" style={{ color: slaColor }}>
                  {topSignal.value}
                </div>
                <div className="text-[11px]" style={{ color: T.textMuted }}>
                  {topSignal.detail || topSignal.label}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chevron + overflow */}
        <div className="flex shrink-0 flex-col items-end justify-between">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(lead.user_id);
            }}
            className="rounded-lg p-1.5 transition"
            style={{ color: T.textFaint }}
            aria-label="Закрыть лид"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = T.textFaint;
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          <ChevronRight className="h-5 w-5" style={{ color: T.accent }} />
        </div>
      </div>
    </motion.article>
  );
}
