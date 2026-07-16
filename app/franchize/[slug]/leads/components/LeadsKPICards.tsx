"use client";

import { Users, Star, Flame, CheckCircle, Clock, Banknote } from "lucide-react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";

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

function fmtMoney(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "0 ₽";
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}

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
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label}
            className="relative overflow-hidden rounded-2xl border p-3 transition hover:shadow-md"
            style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: T.textFaint }}>{c.label}</p>
                <p className="mt-1 text-xl font-black tracking-tight" style={{ color: T.text }}>{c.value}</p>
              </div>
              <div className="rounded-lg p-1.5" style={{ backgroundColor: T.borderSoft }}>
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}