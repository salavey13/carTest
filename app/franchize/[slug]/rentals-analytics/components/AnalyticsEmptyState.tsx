"use client";
import { motion } from "framer-motion";
import type { ThemeTokens } from "../hooks/useTheme";

// AnalyticsEmptyState — Analytics page component
// Mobile-first, T: ThemeTokens, ../ relative imports, ФИО primary

export function AnalyticsEmptyState({ T }: { T: ThemeTokens }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
      <p className="text-sm" style={{ color: T.textMuted }}>AnalyticsEmptyState — TODO: implement</p>
    </div>
  );
}
