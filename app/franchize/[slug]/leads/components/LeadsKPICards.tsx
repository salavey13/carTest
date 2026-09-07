// /app/franchize/[slug]/leads/components/LeadsKPICards.tsx
"use client";

import { motion } from "framer-motion";
import { Users, Star, Flame, CheckCircle, Clock, Banknote, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { fmtMoney } from "../leads-utils";
import type { LeadsKpiCardsStats } from "../lib/leads-query-core";

interface LeadsKPICardsProps {
  /**
   * ГОТОВЫЕ ЧИСЛА с сервера (agg.kpiCards): компонент стал презентационным.
   * Раньше он считал плитки из ПОЛНОГО массива лидов — при оконной выдаче
   * «лучшие сверху» у клиента просто нет всех лидов, поэтому числа считает
   * сервер (computeLeadsKpiCardsStats по ПОЛНОМУ набору) и присылает в agg.
   * undefined — первая загрузка ещё идёт: рисуем скелетные плитки.
   */
  stats?: LeadsKpiCardsStats;
  T: any;
}

interface Trend {
  label: string;
  dir: "up" | "down" | "flat";
}

function pctTrend(cur: number, prev: number, suffix = "за 7 дней"): Trend | null {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return { label: `+${cur} ${suffix}`, dir: "up" };
  if (cur === prev) return { label: `±0 ${suffix}`, dir: "flat" };
  const pct = Math.round(Math.abs((cur - prev) / prev) * 100);
  return { label: `${pct}% ${suffix}`, dir: cur > prev ? "up" : "down" };
}

function countTrend(cur: number, suffix = "за 7 дней"): Trend {
  return cur > 0
    ? { label: `+${cur} ${suffix}`, dir: "up" }
    : { label: `0 ${suffix}`, dir: "flat" };
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 22, stiffness: 240, delay: i * 0.04 },
  }),
};

const SKELETON_CARDS = [
  { label: "Всего лидов", icon: Users, color: "#3b82f6" },
  { label: "Активность сегодня", icon: Star, color: "#f59e0b" },
  { label: "Горячие", icon: Flame, color: "#ef4444" },
  { label: "Клиенты", icon: CheckCircle, color: "#10b981" },
  { label: "Задач в работе", icon: Clock, color: "#f59e0b" },
  { label: "Выручка", icon: Banknote, color: "#10b981" },
];

export function LeadsKPICards({ stats, T }: LeadsKPICardsProps) {
  // Первая загрузка: сервер ещё не прислал agg — честный скелет вместо нулей
  // (нули «Всего лидов: 0» читались как «сделок нет», а не «грузится»).
  if (!stats) {
    return (
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
        {SKELETON_CARDS.map((c) => (
          <div
            key={c.label}
            className="relative min-w-[140px] snap-start animate-pulse overflow-hidden rounded-2xl border p-3 sm:min-w-0"
            style={{ borderColor: T.border, backgroundColor: T.bgCard }}
            aria-hidden
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${c.color}1a` }}>
                <c.icon className="h-[18px] w-[18px]" style={{ color: c.color }} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-wider" style={{ color: T.textFaint }}>{c.label}</p>
                <div className="mt-1 h-5 w-12 rounded" style={{ backgroundColor: T.borderSoft }} />
              </div>
            </div>
            <div className="mt-1.5 h-2.5 w-16 rounded" style={{ backgroundColor: T.borderSoft }} />
          </div>
        ))}
      </div>
    );
  }

  const tr = stats.trends;
  // Тренды по референсу: у каждой плитки строка-дельта «за 7 дней».
  // «Активность сегодня» — метрика самого дня, вместо тренда — подпись.
  const trends: Array<Trend | "today" | null> = [
    pctTrend(tr.leadsCur, tr.leadsPrev),
    "today",
    countTrend(tr.hotCur),
    countTrend(tr.verCur),
    countTrend(tr.todosCur),
    pctTrend(tr.revCur, tr.revPrev) ??
      (tr.revCur > 0 ? { label: `+${fmtMoney(tr.revCur)} за 7 дней`, dir: "up" as const } : null),
  ];

  const cards = [
    { label: "Всего лидов", value: stats.totalLeads, icon: Users, color: "#3b82f6" },
    { label: "Активность сегодня", value: stats.todayActive, icon: Star, color: T.accent },
    { label: "Горячие", value: stats.hot, icon: Flame, color: "#ef4444" },
    { label: "Клиенты", value: stats.verified, icon: CheckCircle, color: "#10b981" },
    { label: "Задач в работе", value: stats.pendingTodos, icon: Clock, color: "#f59e0b" },
    { label: "Выручка", value: fmtMoney(stats.revenue), icon: Banknote, color: "#10b981" },
  ];

  return (
    // MOBILE: одна снап-полоса вместо сетки 2×3 — 6 плиток высотой в одну
    // строку (~90px вместо ~260px), листаются свайпом с подсечкой колонок.
    // sm+ — прежняя сетка 3/6 колонок. Полоса чуть выходит за поля страницы
    // (-mx-4 px-4), чтобы карточки бежали от края до края экрана.
    <div
      className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden"
      aria-label="Сводка дня"
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        const trend = trends[i];
        return (
          <motion.div
            key={c.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="relative min-w-[140px] snap-start overflow-hidden rounded-2xl border p-3 transition-shadow hover:shadow-lg sm:min-w-0"
            style={{ borderColor: T.border, backgroundColor: T.bgCard }}
          >
            {/* Subtle glow on accent */}
            <div
              className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-[0.04]"
              style={{ backgroundColor: c.color }}
            />
            {/* Референс-дизайн: иконка в цветном квадрате СЛЕВА, подпись и
                значение справа; под ними строка тренда «за 7 дней». */}
            <div className="flex items-center gap-2.5">
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: `${c.color}1a` }}
                aria-hidden
              >
                <Icon className="h-[18px] w-[18px]" style={{ color: c.color }} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-wider" style={{ color: T.textFaint }}>
                  {c.label}
                </p>
                <motion.p
                  className="truncate text-lg font-black tracking-tight sm:text-xl"
                  style={{ color: T.text }}
                  key={typeof c.value === "string" ? c.value : `val-${c.value}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.04 + 0.1 }}
                >
                  {c.value}
                </motion.p>
              </div>
            </div>
            {/* Строка тренда: зелёный рост / красное падение / серый флэт.
                «Активность сегодня» получает подпись «сегодня» на том же месте —
                плитки остаются одной высоты в сетке. */}
            <p
              className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold"
              style={{
                color:
                  trend === "today"
                    ? T.textFaint
                    : trend?.dir === "down"
                      ? "#ef4444"
                      : trend?.dir === "up"
                        ? "#22c55e"
                        : T.textFaint,
              }}
            >
              {trend && trend !== "today" && trend.dir === "up" && (
                <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
              )}
              {trend && trend !== "today" && trend.dir === "down" && (
                <ArrowDownRight className="h-3 w-3 shrink-0" aria-hidden />
              )}
              {trend && trend !== "today" && trend.dir === "flat" && (
                <Minus className="h-3 w-3 shrink-0" aria-hidden />
              )}
              {trend === "today" ? "сегодня" : trend?.label}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
