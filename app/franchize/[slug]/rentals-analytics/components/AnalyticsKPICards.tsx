"use client";

// /analytics/components/AnalyticsKPICards.tsx
//
// 4-card KPI row: Аренд сегодня | Выручка | Активных | Возвратов
// Mobile: 2x2 grid. Desktop: 1x4 horizontal.
// Semantic status colors allowed (PRD §0.6); everything else from T.*.

import { motion } from "framer-motion";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsKpis } from "./types";

interface AnalyticsKPICardsProps {
  kpis: AnalyticsKpis;
  T: ThemeTokens;
}

interface KpiCard {
  label: string;
  value: string | number;
  color: string;
}

export function AnalyticsKPICards({ kpis, T }: AnalyticsKPICardsProps) {
  const cards: KpiCard[] = [
    { label: "Аренд сегодня", value: kpis.totalToday,                  color: T.text },
    { label: "Выручка",       value: `${kpis.revenueToday.toLocaleString("ru-RU")} ₽`, color: "#22c55e" },
    { label: "Активных",      value: kpis.activeCount,                  color: "#22c55e" },
    {
      label: "Возвратов",
      value: kpis.returnsDue,
      color: kpis.returnsDue > 0 ? "#ef4444" : T.textMuted,
    },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      role="region"
      aria-label="Ключевые показатели"
    >
      {cards.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25 }}
          className="rounded-2xl border p-3 md:p-4"
          style={{
            borderColor: T.border,
            backgroundColor: T.bgCard,
          }}
        >
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: T.textFaint }}
          >
            {kpi.label}
          </p>
          <p
            className="mt-1 text-xl font-bold tabular-nums md:text-2xl"
            style={{ color: kpi.color }}
          >
            {kpi.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
