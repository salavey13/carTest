"use client";

import { motion } from "framer-motion";
import { Users, Star, Flame, CheckCircle, Clock, Banknote } from "lucide-react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
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

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 22, stiffness: 240, delay: i * 0.04 },
  }),
};

export function LeadsKPICards({ leads, hot, verified, todos, T }: LeadsKPICardsProps) {
  const today = leads.filter((l) => isToday(l.createdAt) || isToday(l.lastSeenAt)).length;
  const pending = todos.filter((t) => t.status !== "done").length;
  const totalSpent = leads.reduce((s, l) => s + (l.totalSpent || 0), 0);

  const cards = [
    { label: "Всего лидов", value: leads.length, icon: Users, color: T.textMuted },
    { label: "Активность сегодня", value: today, icon: Star, color: T.accent },
    { label: "Горячие", value: hot.length, icon: Flame, color: "#ef4444" },
    { label: "Клиенты", value: verified.length, icon: CheckCircle, color: "#10b981" },
    { label: "Задач в работе", value: pending, icon: Clock, color: "#f59e0b" },
    { label: "Выручка", value: fmtMoney(totalSpent), icon: Banknote, color: "#10b981" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.div
            key={c.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="relative overflow-hidden rounded-2xl border p-3 transition-shadow hover:shadow-lg"
            style={{ borderColor: T.border, backgroundColor: T.bgCard }}
          >
            {/* Subtle glow on accent */}
            <div
              className="absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-[0.04]"
              style={{ backgroundColor: c.color }}
            />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: T.textFaint }}>
                  {c.label}
                </p>
                <motion.p
                  className="mt-1 text-xl font-black tracking-tight"
                  style={{ color: T.text }}
                  key={typeof c.value === "string" ? c.value : `val-${c.value}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.04 + 0.1 }}
                >
                  {c.value}
                </motion.p>
              </div>
              <div className="rounded-lg p-1.5" style={{ backgroundColor: T.borderSoft }}>
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
