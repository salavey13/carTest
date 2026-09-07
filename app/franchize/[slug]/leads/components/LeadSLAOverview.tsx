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
  neutral: "#64748b",
  good: "#22c55e",
};

/**
 * SLA / риск-чипы (референс-дизайн §5): компактные горизонтальные чипы
 * «иконка + значение + подпись» в тоне серьёзности (danger → красный,
 * warning → янтарный). Раньше каждый сигнал был крупной круглой карточкой
 * с кольцом (48px круг + значение + label + detail столбиком) — на 4 сигнала
 * это съедало пол-экрана шторки до контента. Чипы той же семантики, но в
 * 3 раза ниже; на мобиле — снап-полоса, на sm+ — перенос строкой.
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
    <section
      aria-label="SLA и риски"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 md:flex-wrap md:snap-none md:overflow-visible"
      style={{ scrollbarWidth: "none" }}
    >
      {top4.map((s, i) => {
        const Icon = SIGNAL_ICONS[s.key] || Clock;
        const color = TONE_COLORS[s.tone] || TONE_COLORS.neutral;
        return (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 280, delay: i * 0.05 }}
            className="flex shrink-0 snap-start items-center gap-2.5 rounded-2xl border px-3 py-2.5 md:min-w-[190px] md:flex-1"
            style={{
              borderColor: `${color}40`,
              background: `${color}12`,
            }}
            title={s.detail ? `${s.label} · ${s.detail}` : s.label}
          >
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{ background: `${color}1f` }}
              aria-hidden
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight tabular-nums" style={{ color }}>
                {s.value}
              </div>
              <div className="truncate text-[11px] leading-tight" style={{ color: T.textMuted }}>
                {s.label}
              </div>
            </div>
          </motion.div>
        );
      })}
    </section>
  );
}
