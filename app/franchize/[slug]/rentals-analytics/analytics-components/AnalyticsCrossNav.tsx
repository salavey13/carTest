"use client";

import { Calendar, Tag, FileText, BarChart3 } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";

interface AnalyticsCrossNavProps {
  activePage: "rentals" | "sales" | "commercial";
  basePath: string;
  bgCard: string;
  borderSoft: string;
  accentMain: string;
  textSecondary: string;
}

const NAV_ITEMS = [
  { key: "rentals" as const, label: "Аренды", icon: Calendar, suffix: "/rentals-analytics" },
  { key: "sales" as const, label: "Продажи", icon: Tag, suffix: "/sales-analytics" },
  { key: "commercial" as const, label: "КП", icon: FileText, suffix: "/commercial-offers-analytics" },
];

export function AnalyticsCrossNav({
  activePage,
  basePath,
  bgCard,
  borderSoft,
  accentMain,
  textSecondary,
}: AnalyticsCrossNavProps) {
  return (
    <div
      className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl border"
      style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
    >
      <BarChart3 className="w-3.5 h-3.5 ml-1.5 flex-shrink-0" style={{ color: textSecondary }} />
      <span className="text-[10px] uppercase font-bold tracking-wide mr-1" style={{ color: textSecondary }}>
        Аналитика:
      </span>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.key;
        return isActive ? (
          <span
            key={item.key}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
            style={{ backgroundColor: withAlpha(accentMain, 0.2), color: accentMain, border: `1px solid ${withAlpha(accentMain, 0.4)}` }}
          >
            <Icon className="w-3 h-3" /> {item.label}
          </span>
        ) : (
          <a
            key={item.key}
            href={`${basePath}${item.suffix}`}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all hover:opacity-80"
            style={{ color: textSecondary, border: `1px solid ${borderSoft}` }}
          >
            <Icon className="w-3 h-3" /> {item.label}
          </a>
        );
      })}
    </div>
  );
}
