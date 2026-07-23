"use client";

// /analytics/components/AnalyticsTabNav.tsx
//
// Segmented tab bar for Аренда / Продажа / Сервис.
// Mobile-first: full-width, 44px touch targets, ARIA tablist.
// Active tab uses T.accent; inactive tabs use T.textMuted.

import { motion } from "framer-motion";
import type { ThemeTokens } from "../hooks/useTheme";
import type { AnalyticsTab } from "./types";

interface TabConfig {
  key: AnalyticsTab;
  label: string;
}

const DEFAULT_TABS: TabConfig[] = [
  { key: "rentals",  label: "Аренда" },
  { key: "sales",    label: "Продажа" },
  { key: "services", label: "Сервис" },
];

interface AnalyticsTabNavProps {
  activeTab: AnalyticsTab;
  onChange: (tab: AnalyticsTab) => void;
  T: ThemeTokens;
  tabs?: TabConfig[];
}

export function AnalyticsTabNav({ activeTab, onChange, T, tabs = DEFAULT_TABS }: AnalyticsTabNavProps) {
  return (
    <div
      role="tablist"
      aria-label="Разделы аналитики"
      className="flex gap-1 rounded-2xl border p-1"
      style={{ borderColor: T.border, backgroundColor: T.bgCard }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`analytics-panel-${tab.key}`}
            id={`analytics-tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className="relative flex-1 rounded-xl py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0"
            style={{
              backgroundColor: isActive ? T.accent : "transparent",
              color: isActive ? T.accentContrast : T.textMuted,
              minHeight: "44px",
              cursor: "pointer",
              ...(isActive
                ? { boxShadow: `0 1px 2px ${T.shadow}` }
                : {}),
            }}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="analytics-tab-underline"
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{ border: `1px solid ${T.borderActive}` }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
