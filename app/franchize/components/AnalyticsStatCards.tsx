"use client";

import { TrendingUp, DollarSign, Users, Calendar, Clock, ShieldCheck, AlertCircle, XCircle, CheckCircle2, BarChart3 } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";
import { formatRubles, formatRussianDateOnly } from "@/app/franchize/[slug]/leads/leads-utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ label, value, icon, color, bgColor, textColor, borderColor, trend, className = "" }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border p-4 md:p-6 transition-all hover:shadow-lg ${className}`}
      style={{ backgroundColor: bgColor, borderColor: borderColor }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium uppercase tracking-wider mb-2" style={{ color: withAlpha(textColor, 0.6) }}>
            {label}
          </p>
          <p className="text-2xl md:text-3xl lg:text-4xl font-black" style={{ color: textColor }}>
            {value}
          </p>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-xs font-bold" style={{ color: trend.value >= 0 ? "#10b981" : "#ef4444" }}>
                {trend.value >= 0 ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs" style={{ color: withAlpha(textColor, 0.6) }}>{trend.label}</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: withAlpha(color, 0.15) }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function RentalsStatsRow({
  summary,
  selectedDate,
  dateRange,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: {
  summary: { count: number; revenue: number; date: string } | null;
  selectedDate: string;
  dateRange: { minDate: string; maxDate: string } | null;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      <StatCard
        label="Аренд за день"
        value={summary?.count || 0}
        icon={<Calendar className="w-6 h-6 md:w-7 md:h-7" style={{ color: accentMain }} />}
        color={accentMain}
        bgColor={bgCard}
        textColor={textPrimary}
        borderColor={borderSoft}
      />
      <StatCard
        label="Выручка"
        value={formatRubles(summary?.revenue || 0)}
        icon={<DollarSign className="w-6 h-6 md:w-7 md:h-7" style={{ color: "#10b981" }} />}
        color="#10b981"
        bgColor={bgCard}
        textColor={textPrimary}
        borderColor={borderSoft}
      />
      <StatCard
        label="Дата"
        value={formatRussianDateOnly(selectedDate)}
        icon={<Clock className="w-6 h-6 md:w-7 md:h-7" style={{ color: "#f59e0b" }} />}
        color="#f59e0b"
        bgColor={bgCard}
        textColor={textPrimary}
        borderColor={borderSoft}
      />
    </div>
  );
}