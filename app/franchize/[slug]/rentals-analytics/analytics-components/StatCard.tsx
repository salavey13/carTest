"use client";

import { ReactNode } from "react";
import { withAlpha } from "@/app/franchize/lib/theme";

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`p-3 rounded-xl border ${className}`}
      style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: borderSoft }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div style={{ color: accentMain }}>{icon}</div>
        <span className="text-[10px] md:text-xs uppercase tracking-wide font-bold" style={{ color: textSecondary }}>
          {label}
        </span>
      </div>
      <div className="text-lg md:text-xl font-black" style={{ color: textPrimary }}>
        {value}
      </div>
    </div>
  );
}
