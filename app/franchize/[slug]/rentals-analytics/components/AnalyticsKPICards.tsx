"use client";

// /analytics/components/AnalyticsKPICards.tsx
//
// 7-card KPI row (iter25): Аренд сегодня | Выручка | Компании | Партнёрам
//                          | Экипировка | Активных | Возвратов
// Desktop (lg+): 1x7 grid — как и было.
// Mobile fix (task143, boss: «верхняя часть занимает большую часть экрана»):
//   2-col grid складывал 7 карточек в 4 ряда ≈ 360px — весь первый экран
//   телефона уходил на статы, до списка аренд приходилось листать.
//   Теперь на <lg это одна горизонтальная snap-полоса ≈ 64px (скролл пальцем,
//   тонкий скроллбар как у рейла в CrewHeader). Desktop не тронут.
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
      className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto pb-1.5 [overscroll-behavior-x:contain] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-current/20 lg:grid lg:grid-cols-7 lg:gap-3 lg:overflow-visible lg:pb-0"
      role="region"
      aria-label="Ключевые показатели"
    >
      {cards.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25 }}
          className="min-w-[7.5rem] shrink-0 snap-start rounded-2xl border p-2.5 md:p-3 lg:min-w-0 lg:snap-none lg:p-4"
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
            className="mt-1 whitespace-nowrap text-base font-bold tabular-nums sm:text-lg lg:text-2xl"
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
