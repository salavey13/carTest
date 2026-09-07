// /app/franchize/[slug]/leads/components/LeadsKPICards.tsx
"use client";

import { motion } from "framer-motion";
import { Users, Star, Flame, CheckCircle, Clock, Banknote, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type {LeadRow, LeadTodoRow} from "../leads-types";
import { fmtMoney } from "../leads-utils";

interface LeadsKPICardsProps {
  leads: LeadRow[];
  hot: LeadRow[];
  verified: LeadRow[];
  todos: LeadTodoRow[];
  T: any;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ── 7-дневные тренды (референс-дизайн: «↑ 12% за 7 дней» под значением) ──
// Считаем окно «последние 7 дней» против «предыдущие 7 дней» по createdAt
// лида (выручка — по startDate аренды / createdAt продажи, потому что
// totalSpent — пожизненная сумма без дат). Чистая функция без side-effects.
const MS_7D = 7 * 24 * 60 * 60 * 1000;

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

function computeWindowStats(leads: LeadRow[], todos: LeadTodoRow[], now: number) {
  let leadsCur = 0, leadsPrev = 0, hotCur = 0, verCur = 0;
  let revCur = 0, revPrev = 0;
  for (const l of leads) {
    const created = l.createdAt ? new Date(l.createdAt).getTime() : NaN;
    const inCur = Number.isFinite(created) && created > now - MS_7D;
    const inPrev = Number.isFinite(created) && created <= now - MS_7D && created > now - 2 * MS_7D;
    if (inCur) {
      leadsCur++;
      if (l.avito?.analysis?.temperature === "hot") hotCur++;
      if (l.verified) verCur++;
    }
    if (inPrev) leadsPrev++;
    // Выручка окна: аренды по дате старта, продажи по дате создания.
    for (const r of l.rentals || []) {
      const s = r.startDate ? new Date(r.startDate).getTime() : NaN;
      if (!Number.isFinite(s)) continue;
      if (s > now - MS_7D) revCur += r.totalCost || 0;
      else if (s > now - 2 * MS_7D) revPrev += r.totalCost || 0;
    }
    for (const s of l.sales || []) {
      const cs = s.createdAt ? new Date(s.createdAt).getTime() : NaN;
      if (!Number.isFinite(cs)) continue;
      if (cs > now - MS_7D) revCur += s.salePrice || 0;
      else if (cs > now - 2 * MS_7D) revPrev += s.salePrice || 0;
    }
  }
  // Задачи «в работе»: открытые, созданные за окно (created_at есть у туду).
  const todosCur = todos.filter((t) => {
    if (t.status === "done") return false;
    const c = t.created_at ? new Date(t.created_at).getTime() : NaN;
    return Number.isFinite(c) && c > now - MS_7D;
  }).length;
  return { leadsCur, leadsPrev, hotCur, verCur, revCur, revPrev, todosCur };
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 22, stiffness: 240, delay: i * 0.04 },
  }),
};

export function LeadsKPICards({ leads, hot, verified, todos, T }: LeadsKPICardsProps) {
  const now = Date.now();
  const today = leads.filter((l) => isToday(l.createdAt) || isToday(l.lastSeenAt)).length;
  const pending = todos.filter((t) => t.status !== "done").length;
  const totalSpent = leads.reduce((s, l) => s + (l.totalSpent || 0), 0);
  const stats = computeWindowStats(leads, todos, now);

  // Тренды по референсу: у каждой плитки строка-дельта «за 7 дней».
  // «Активность сегодня» — метрика самого дня, вместо тренда — подпись.
  const trends: Array<Trend | "today" | null> = [
    pctTrend(stats.leadsCur, stats.leadsPrev),
    "today",
    countTrend(stats.hotCur),
    countTrend(stats.verCur),
    countTrend(stats.todosCur),
    pctTrend(stats.revCur, stats.revPrev) ??
      (stats.revCur > 0 ? { label: `+${fmtMoney(stats.revCur)} за 7 дней`, dir: "up" as const } : null),
  ];

  const cards = [
    { label: "Всего лидов", value: leads.length, icon: Users, color: "#3b82f6" },
    { label: "Активность сегодня", value: today, icon: Star, color: T.accent },
    { label: "Горячие", value: hot.length, icon: Flame, color: "#ef4444" },
    { label: "Клиенты", value: verified.length, icon: CheckCircle, color: "#10b981" },
    { label: "Задач в работе", value: pending, icon: Clock, color: "#f59e0b" },
    { label: "Выручка", value: fmtMoney(totalSpent), icon: Banknote, color: "#10b981" },
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
