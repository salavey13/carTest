"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Phone, Clock, MoreVertical } from "lucide-react";
import type { LeadRow } from "@/app/franchize/server-actions/leads";
import type { LeadSignal } from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";
import {
  STAGE_LABELS,
  STAGE_COLORS,
} from "../lib/pipeline-stages";
import { SOURCE_META } from "../leads-constants";
import {
  getInitials,
  relativeTime,
  fmtMoney,
  formatDate,
} from "../leads-utils";

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
 * - Left edge color stripe (3px wide, stage color)
 * - Avatar (40px mobile / 48px desktop) + name + verified check + task count badge
 * - Stage badge (right-aligned)
 * - Phone + time-ago
 * - Source / temperature tags
 * - Bike title + rental count + revenue + return date
 * - SLA block (right-aligned, compact)
 * - Chevron + overflow menu
 *
 * Mobile sizing: padding p-3 (12px) / md:p-4 (16px); name 14px / md:16px;
 * metadata 11px / md:13px. Left stripe is 3px (w-[3px]) so it reads as an
 * accent indicator without eating into the card content.
 */
export function LeadCard({ lead, signals, selected, onSelect, onDismiss, T }: Props) {
  const stageKey = (lead as { stageKey?: string }).stageKey || "new";
  const stageColor = STAGE_COLORS[stageKey] || "#64748b";
  const stageLabel = STAGE_LABELS[stageKey] || stageKey;
  const displayName = lead.full_name || "Без имени";
  const initials = getInitials(lead.full_name);
  const rel = relativeTime(lead.lastSeenAt || lead.createdAt);
  const topSignal = signals[0];
  const slaColor = topSignal ? TONE_COLOR[topSignal.tone] : T.textFaint;

  const rental = lead.rentals[0];
  const rentalCount = lead.rentals.length;
  const revenue = lead.totalSpent || (rental?.totalCost ?? 0);
  const returnDate = rental?.endDate ? formatDate(rental.endDate) : null;
  const pending = signals.filter((s) => s.tone === "warning" || s.tone === "danger").length;

  return (
    <motion.article
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: "spring", damping: 22, stiffness: 320 }}
      onClick={onSelect}
      // pl-[18px] reserves space for the 3px left color stripe + breathing room.
      // p-3 (12px) on mobile, md:p-4 (16px) on desktop.
      className="relative cursor-pointer overflow-hidden rounded-[24px] p-3 pl-[18px] md:p-4 md:pl-[22px]"
      style={{
        background: T.bgCard,
        border: `1px solid ${selected ? stageColor : T.border}`,
        boxShadow: selected
          ? `0 0 0 2px ${stageColor}40, ${T.shadow}`
          : T.shadow,
        backdropFilter: "blur(12px)",
      }}
      aria-label={`Лид: ${displayName}${lead.phone ? `, ${lead.phone}` : ""}`}
    >
      {/* Left edge color stripe — 3px wide */}
      <div
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: stageColor }}
        aria-hidden
      />

      <div className="flex gap-3">
        {/* Avatar — 40px mobile, 48px desktop */}
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold md:h-12 md:w-12 md:text-base"
          style={{ background: `${stageColor}26`, color: stageColor }}
          aria-hidden
        >
          {initials}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Name + stage badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {/* Name: 14px mobile / 16px desktop */}
                <h3
                  className="truncate text-sm font-semibold md:text-base"
                  style={{ color: T.text }}
                >
                  {displayName}
                </h3>
                {lead.verified && (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0"
                    style={{ color: "#22c55e" }}
                    aria-label="Подтверждён"
                  />
                )}
                {pending > 0 && (
                  <span
                    className="grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold"
                    style={{ background: "#f59e0b26", color: "#f59e0b" }}
                    aria-label={`${pending} активных сигналов`}
                  >
                    {pending}
                  </span>
                )}
              </div>
              {/* Metadata: 11px mobile / 13px desktop */}
              <div
                className="mt-1 flex flex-wrap items-center gap-2 text-[11px] md:text-[13px]"
                style={{ color: T.textMuted }}
              >
                {lead.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" aria-hidden />
                    {lead.phone}
                  </span>
                )}
                {rel && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {rel}
                  </span>
                )}
              </div>
            </div>
            {/* Stage badge — right-aligned, compact */}
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium md:px-3 md:text-[11px]"
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
              className="rounded-2xl border p-2.5 text-sm md:p-3"
              style={{
                borderColor: T.border,
                background: T.bgElevated,
                color: T.textMuted,
              }}
            >
              {lead.bikeTitle && (
                <>
                  Байк: <span style={{ color: T.text }}>{lead.bikeTitle}</span>
                </>
              )}
              <div
                className="mt-1.5 flex flex-wrap gap-3 text-[11px]"
                style={{ color: T.textFaint }}
              >
                {rentalCount > 0 && <span>{rentalCount} аренд</span>}
                {revenue > 0 && <span>{fmtMoney(revenue)}</span>}
                {returnDate && <span>Возврат: {returnDate}</span>}
              </div>
            </div>
          )}

          {/* SLA block — right aligned, compact */}
          {topSignal && (
            <div className="flex justify-end">
              <div
                className="rounded-xl border p-2.5 text-right md:rounded-2xl md:p-3"
                style={{
                  borderColor: `${slaColor}40`,
                  background: `${slaColor}1a`,
                  minWidth: 140,
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: slaColor }}
                >
                  SLA
                </div>
                <div
                  className="mt-0.5 text-base font-bold md:text-xl"
                  style={{ color: slaColor }}
                >
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
            className="cursor-pointer rounded-lg p-1.5 transition"
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
          <ChevronRight className="h-5 w-5" style={{ color: T.accent }} aria-hidden />
        </div>
      </div>
    </motion.article>
  );
}
