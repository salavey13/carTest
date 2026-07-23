"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";

export interface SegmentChip {
  key: string;
  label: string;
  count: number;
  icon?: LucideIcon;
  color?: string;
}

interface Props {
  segments: SegmentChip[];
  activeSegment: string;
  onChange: (key: string) => void;
  T: ThemeTokens;
}

/**
 * Horizontal scrollable pill chips for segment filtering.
 * Default segments: All / Hot / Overdue / Clients.
 *
 * Active chip: solid accent background (T.accent) with accent-contrast text +
 * a subtle accent ring. The active chip's count badge uses the segment's own
 * color so the user can still tell hot vs overdue apart at a glance.
 *
 * Inactive chip: T.bgCard background with T.border, text in T.textMuted.
 *
 * Mobile: scroll-x with hidden scrollbar so the row never wraps and pushes
 * the layout wider than the viewport. Desktop: single row, no overflow.
 */
export function SegmentChips({ segments, activeSegment, onChange, T }: Props) {
  return (
    <section aria-label="Сегменты" className="-mx-4 px-4 lg:mx-0 lg:px-0">
      <div
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0"
        style={{ scrollbarWidth: "none" }}
      >
        {segments.map((seg, i) => {
          const Icon = seg.icon;
          const segColor = seg.color || T.accent;
          const active = seg.key === activeSegment;
          return (
            <motion.button
              key={seg.key}
              type="button"
              onClick={() => onChange(seg.key)}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -1 }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, type: "spring", damping: 22, stiffness: 280 }}
              aria-pressed={active}
              className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
              style={
                active
                  ? {
                      borderColor: T.accent,
                      background: T.accent,
                      color: T.accentContrast,
                      boxShadow: `0 6px 18px ${T.accent}40`,
                    }
                  : {
                      borderColor: T.border,
                      background: T.bgCard,
                      color: T.textMuted,
                    }
              }
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
              <span className="whitespace-nowrap">{seg.label}</span>
              <span
                className="grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                style={
                  active
                    ? {
                        background: T.accentContrast,
                        color: segColor,
                      }
                    : { background: T.bgElevated, color: T.textFaint }
                }
              >
                {seg.count}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
