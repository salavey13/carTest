"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

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
 * Each chip shows icon + label + count. Active chip highlighted with accent ring.
 * Mobile: scroll-x with hidden scrollbar. Desktop: wrap or single row.
 */
export function SegmentChips({ segments, activeSegment, onChange, T }: Props) {
  return (
    <section
      aria-label="Сегменты"
      className="-mx-4 px-4 lg:mx-0 lg:px-0"
    >
      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0 scrollbar-none">
        {segments.map((seg, i) => {
          const Icon = seg.icon;
          const color = seg.color || T.accent;
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
              className="inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition"
              style={
                active
                  ? {
                      borderColor: color,
                      background: `${color}1f`,
                      color,
                      boxShadow: `0 0 0 1px ${color}40, 0 6px 18px ${color}22`,
                    }
                  : {
                      borderColor: "rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                      color: T.textMuted,
                    }
              }
              aria-pressed={active}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className="whitespace-nowrap">{seg.label}</span>
              <span
                className="grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                style={
                  active
                    ? { background: color, color: "#0a0a0a" }
                    : { background: "rgba(255,255,255,0.06)", color: T.textFaint }
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
