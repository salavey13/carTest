"use client";

// /analytics/components/AnalyticsKPICards.tsx
//
// 7-card KPI row (iter25): Аренд сегодня | Выручка | Компании | Партнёрам
//                          | Экипировка | Активных | Возвратов
// Mobile: 2-col grid. Desktop: 1x7 horizontal.
// Semantic status colors allowed (PRD §0.6); everything else from T.*.
//
// iter25 — the money cards now answer the owner's question
// («была видна прибыль компании и партнёра»):
//   Выручка    — the day's headline total (unchanged super-total)
//   Компании   — revenue MINUS partner cuts: what the crew keeps
//   Партнёрам  — owner cuts for subrented bikes (gear excluded — outgoing)
//   Экипировка — gear part of the revenue (100% crew money)

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
  /** One-line explainer under the value (mobile tooltip substitute). */
  hint?: string;
}

export function AnalyticsKPICards({ kpis, T }: AnalyticsKPICardsProps) {
  const cards: KpiCard[] = [
    { label: "Аренд сегодня", value: kpis.totalToday,                  color: T.text },
    { label: "Выручка",       value: `${kpis.revenueToday.toLocaleString("ru-RU")} ₽`, color: "#22c55e", hint: "все аренды, начатые в этот день" },
    {
      label: "Компании",
      value: `${kpis.companyPartToday.toLocaleString("ru-RU")} ₽`,
      color: "#22c55e",
      hint: "выручка минус доли партнёров — остаётся нам",
    },
    {
      label: "Партнёрам",
      value: `${kpis.owedToSubrentersToday.toLocaleString("ru-RU")} ₽`,
      color: "#f59e0b",
      hint: "доли владельцев субарендованных байков (экип не делится)",
    },
    {
      label: "Экипировка",
      value: `${kpis.equipmentPartToday.toLocaleString("ru-RU")} ₽`,
      color: "#8b5cf6",
      hint: "часть выручки за экипировку — целиком наша",
    },
    { label: "Активных",      value: kpis.activeCount,                  color: "#22c55e" },
    {
      label: "Возвратов",
      value: kpis.returnsDue,
      color: kpis.returnsDue > 0 ? "#ef4444" : T.textMuted,
    },
  ];

  return (
    <div
      className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-7 lg:gap-3"
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
          title={kpi.hint}
        >
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: T.textFaint }}
          >
            {kpi.label}
          </p>
          <p
            className="mt-1 text-lg font-bold tabular-nums md:text-2xl"
            style={{ color: kpi.color }}
          >
            {kpi.value}
          </p>
          {kpi.hint && (
            <p
              className="mt-0.5 hidden text-[10px] leading-tight lg:block"
              style={{ color: T.textFaint }}
            >
              {kpi.hint}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
