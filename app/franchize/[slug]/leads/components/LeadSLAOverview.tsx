"use client";

import { motion } from "framer-motion";
import { Clock, QrCode, Bike, AlertCircle, Activity } from "lucide-react";
import type { LeadSignal } from "../leads-constants";
import type { ThemeTokens } from "../hooks/useTheme";

interface Props {
  signals: LeadSignal[];
  T: ThemeTokens;
}

const SIGNAL_ICONS: Record<string, typeof Clock> = {
  no_response: Clock,
  first_contact: Clock,
  overdue_todos: AlertCircle,
  qr_age: QrCode,
  rental_start: Bike,
  until_return: Bike,
};

// Semantic tone colors — fixed hexes for severity indicators.
const TONE_COLORS: Record<LeadSignal["tone"], string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  neutral: "#a1a1aa",
  good: "#22c55e",
};

/**
 * 4 circular SLA indicators in an evenly-spaced horizontal row.
 *
 * Each indicator:
 *   - 48px circle (h-12 w-12) with a colored ring matching the signal tone.
 *   - Icon + bold value below.
 *   - Label + optional detail below the value.
 *
 * Layout: 2x2 grid on mobile, 4-col on desktop. Items use `place-items-center`
 * and equal `gap-3` so the spacing stays even regardless of content length.
 */
export function LeadSLAOverview({ signals, T }: Props) {
  const top4 = signals.slice(0, 4);

  if (top4.length === 0) {
    return (
      <section className="glass-panel rounded-[24px] p-5">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5" style={{ color: "#22c55e" }} aria-hidden />
          <p className="text-sm" style={{ color: T.textMuted }}>
            Нет активных SLA сигналов
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {top4.map((s, i) => {
        const Icon = SIGNAL_ICONS[s.key] || Clock;
        const color = TONE_COLORS[s.tone] || TONE_COLORS.neutral;
        return (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 22, stiffness: 260, delay: i * 0.05 }}
            className="glass-panel flex flex-col items-center gap-2 rounded-2xl p-4 text-center"
          >
            {/* Circular icon with colored ring */}
            <div
              className="relative grid h-12 w-12 place-items-center rounded-full"
              style={{ background: `${color}1a` }}
              aria-hidden
            >
              <Icon className="h-5 w-5" style={{ color }} />
              <motion.div
                className="absolute inset-0 rounded-full"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: i * 0.05 + 0.1 }}
                style={{ border: `2px solid ${color}66` }}
              />
            </div>
            {/* Bold value — uses tabular-nums so values align across cards */}
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: T.text }}
            >
              {s.value}
            </div>
            <div className="text-[11px]" style={{ color: T.textMuted }}>
              {s.label}
            </div>
            {s.detail && (
              <div className="text-[10px] font-medium" style={{ color }}>
                {s.detail}
              </div>
            )}
          </motion.div>
        );
      })}
    </section>
  );
}
