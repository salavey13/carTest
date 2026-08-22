"use client";

import { ReactNode } from "react";
import { withAlpha } from "@/app/franchize/lib/theme";

export interface AnalyticsTab {
  key: string;
  label: string;
  icon: ReactNode;
  count?: number;
}

interface AnalyticsTabNavProps {
  tabs: AnalyticsTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}

export function AnalyticsTabNav({
  tabs,
  activeTab,
  onTabChange,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: AnalyticsTabNavProps) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl border overflow-x-auto"
      style={{ backgroundColor: withAlpha(bgCard, 0.3), borderColor: borderSoft }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
            style={{
              backgroundColor: isActive ? withAlpha(accentMain, 0.2) : "transparent",
              color: isActive ? accentMain : textSecondary,
              border: isActive ? `1px solid ${withAlpha(accentMain, 0.3)}` : "1px solid transparent",
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count != null && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black"
                style={{
                  backgroundColor: isActive ? withAlpha(accentMain, 0.15) : withAlpha(borderSoft, 0.5),
                  color: isActive ? accentMain : textSecondary,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
