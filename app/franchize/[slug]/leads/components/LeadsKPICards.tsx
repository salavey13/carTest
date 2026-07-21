"use client";

import { motion } from "framer-motion";
import { Users, Flame, TrendingUp, Wallet } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

export interface LeadsKpis {
  totalLeads: number;
  hotLeads: number;
  conversionRate: number;
  monthlyRevenue: number;
}

interface Props {
  kpis: LeadsKpis;
  T: ThemeTokens;
}

/**
 * 4-card KPI row (Всего лиды, Горячие, Конверсия, Выручка).
 * Glass-panel style with large numbers and small deltas.
 * Responsive: 1col mobile / 2col tablet / 4col desktop.
 */
export function LeadsKPICards({ kpis, T }: Props) {
  const cards: Array<{
    label: string;
    value: string;
    icon: typeof Users;
    color: string;
    delta: string | null;
  }> = [
    { label: "Всего лидов", value: String(kpis.totalLeads), icon: Users, color: "#facc15", delta: "за 7 дней" },
    { label: "Горячие", value: String(kpis.hotLeads), icon: Flame, color: "#ef4444", delta: "требуют внимания" },
    { label: "Конверсия", value: `${kpis.conversionRate}%`, icon: TrendingUp, color: "#22c55e", delta: "по пайплайну" },
    { label: "Выручка (мес.)", value: fmtMoney(kpis.monthlyRevenue), icon: Wallet, color: "#facc15", delta: "активные аренды" },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.article
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 240, delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            className="glass-panel rounded-[24px] p-5"
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-2xl"
                style={{ background: `${c.color}1a` }}
              >
                <Icon className="h-5 w-5" style={{ color: c.color }} />
              </div>
              <p className="text-sm" style={{ color: T.textMuted }}>
                {c.label}
              </p>
            </div>

            <motion.div
              key={c.value}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 + 0.1 }}
              className="truncate text-4xl font-bold tracking-tight"
              style={{ color: T.text }}
            >
              {c.value}
            </motion.div>

            {c.delta && (
              <div className="mt-2 text-xs" style={{ color: T.textFaint }}>
                {c.delta}
              </div>
            )}
          </motion.article>
        );
      })}
    </section>
  );
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "0 ₽";
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}
