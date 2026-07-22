"use client";

import { motion } from "framer-motion";
import { Users, Flame, TrendingUp, Wallet, ArrowUp, ArrowDown } from "lucide-react";
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
 *
 * Each card has:
 *   - A subtle hover lift (y: -2px) for affordance.
 *   - Large bold numbers (text-2xl mobile / text-3xl desktop).
 *   - A tiny colored delta indicator (green up / red down / muted neutral)
 *     that uses semantic tone colors so the direction is glanceable.
 *
 * Responsive: 1col mobile / 2col tablet / 4col desktop.
 */
export function LeadsKPICards({ kpis, T }: Props) {
  const cards: Array<{
    label: string;
    value: string;
    icon: typeof Users;
    color: string;
    delta: string | null;
    deltaDir: "up" | "down" | "neutral";
  }> = [
    {
      label: "Всего лидов",
      value: String(kpis.totalLeads),
      icon: Users,
      color: "#facc15",
      delta: "за 7 дней",
      deltaDir: "neutral",
    },
    {
      label: "Горячие",
      value: String(kpis.hotLeads),
      icon: Flame,
      color: "#ef4444",
      delta: kpis.hotLeads > 0 ? "требуют внимания" : "всё под контролем",
      deltaDir: kpis.hotLeads > 0 ? "up" : "neutral",
    },
    {
      label: "Конверсия",
      value: `${kpis.conversionRate}%`,
      icon: TrendingUp,
      color: "#22c55e",
      delta: kpis.conversionRate >= 30 ? "+тренд" : "по пайплайну",
      deltaDir: kpis.conversionRate >= 30 ? "up" : "neutral",
    },
    {
      label: "Выручка (мес.)",
      value: fmtMoney(kpis.monthlyRevenue),
      icon: Wallet,
      color: "#facc15",
      delta: "активные аренды",
      deltaDir: "neutral",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const deltaColor =
          c.deltaDir === "up" ? "#22c55e" : c.deltaDir === "down" ? "#ef4444" : T.textFaint;
        const DeltaIcon = c.deltaDir === "up" ? ArrowUp : c.deltaDir === "down" ? ArrowDown : null;
        return (
          <motion.article
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 240, delay: i * 0.04 }}
            whileHover={{ y: -2 }}
            className="glass-panel rounded-[24px] p-4 sm:p-5"
          >
            <div className="mb-3 flex items-center gap-3 sm:mb-4">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl sm:h-11 sm:w-11"
                style={{ background: `${c.color}1a` }}
                aria-hidden
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
              // Large bold number: text-2xl mobile / text-3xl desktop
              className="truncate text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: T.text }}
            >
              {c.value}
            </motion.div>

            {/* Tiny colored delta indicator */}
            {c.delta && (
              <div
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium"
                style={{ color: deltaColor }}
              >
                {DeltaIcon && <DeltaIcon className="h-3 w-3" aria-hidden />}
                <span>{c.delta}</span>
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
