"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  color: string;
}

interface Props {
  stages: PipelineStage[];
  activeStage: string | null;
  onStageSelect: (key: string) => void;
  T: ThemeTokens;
}

/**
 * Horizontal stage strip with 9 connected segments.
 *
 * Mobile: horizontal scroll with hidden scrollbar, each segment ≥80px so they
 * stay readable but more than one fits on screen.
 * Desktop (lg+): 9-column grid, segments share width evenly.
 *
 * Active stage gets a colored glow + ring border to make the filter state
 * obvious. Inactive stages use a tinted background of their own color.
 */
export function PipelineFunnelBar({ stages, activeStage, onStageSelect, T }: Props) {
  return (
    <section className="glass-panel rounded-[24px] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs" style={{ color: T.textMuted }}>
            Воронка пайплайна
          </p>
          <h2 className="text-lg font-semibold" style={{ color: T.text }}>
            Стадии лида
          </h2>
        </div>
      </div>

      <div
        // Mobile: horizontal scroll with hidden scrollbar.
        // Desktop: 9-col grid, no overflow.
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-9 lg:gap-0 lg:overflow-visible lg:pb-0"
        style={{ scrollbarWidth: "none" }}
      >
        {stages.map((stage, i) => {
          const active = stage.key === activeStage;
          const bg = hexA(stage.color, 0.15);
          const bgActive = hexA(stage.color, 0.28);
          return (
            <motion.button
              key={stage.key}
              type="button"
              onClick={() => onStageSelect(stage.key)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", damping: 24, stiffness: 280 }}
              aria-pressed={active}
              // Mobile: min-w-[80px] so segments stay readable but compact.
              // Desktop: full-width column with no min-width constraint.
              className="group relative flex min-w-[80px] flex-1 items-center gap-2 rounded-2xl px-3 py-3 text-left transition-colors lg:min-w-0 lg:flex-col lg:items-start lg:gap-1 lg:rounded-none lg:px-3 lg:py-4 lg:first:rounded-l-2xl lg:last:rounded-r-2xl"
              style={{
                background: active ? bgActive : bg,
                border: `1px solid ${active ? stage.color : hexA(stage.color, 0.18)}`,
                // Active glow: ring + tinted shadow. Inactive: no shadow.
                boxShadow: active
                  ? `0 0 0 2px ${hexA(stage.color, 0.25)}, 0 12px 28px ${hexA(stage.color, 0.18)}`
                  : "none",
              }}
            >
              <div
                className="text-[11px] font-medium uppercase tracking-wide"
                style={{ color: stage.color }}
              >
                {stage.label}
              </div>
              <div
                className="text-2xl font-bold tabular-nums"
                style={{ color: T.text }}
              >
                {stage.count}
              </div>

              {/* Chevron divider between segments — desktop only */}
              {i < stages.length - 1 && (
                <ChevronRight
                  className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 lg:block"
                  style={{ color: T.border }}
                  aria-hidden
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

/** Convert #rrggbb + alpha → rgba() string. Falls back to the raw color if parsing fails. */
function hexA(hex: string, alpha: number): string {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
