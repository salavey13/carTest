"use client";

import { withAlpha } from "@/app/franchize/lib/theme";

interface StatItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

interface RentalsStatsRowProps {
  stats: StatItem[];
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}

export function RentalsStatsRow({ stats, accentMain, bgCard, borderSoft, textPrimary, textSecondary }: RentalsStatsRowProps) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-1.5 md:gap-2 lg:gap-3">
      {stats.map((stat, i) => (
        <div key={i} className="relative group">
          <div
            className="absolute inset-0 rounded-lg md:rounded-xl blur-md group-hover:blur-lg transition-all duration-500"
            style={{ background: `radial-gradient(circle at center, ${withAlpha(stat.color, 0.15)}, transparent 70%)` }}
          />
          <div
            className="relative p-2.5 md:p-3.5 rounded-lg md:rounded-xl border text-center transition-all duration-300 group-hover:scale-[1.03]"
            style={{ backgroundColor: withAlpha(bgCard, 0.6), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(8px)" }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <div className="p-1 md:p-1.5 rounded-md" style={{ backgroundColor: withAlpha(stat.color, 0.15) }}>
                {stat.icon}
              </div>
            </div>
            <div className="text-base md:text-xl lg:text-2xl font-black tracking-tight" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[9px] md:text-[10px] lg:text-xs font-bold uppercase tracking-widest mt-1" style={{ color: textSecondary, opacity: 0.8 }}>{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
