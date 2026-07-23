"use client";

// /analytics/components/AnalyticsEmptyState.tsx
//
// Centered empty state with optional icon. Used when no rentals/sales/services
// for the selected date.

import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";

interface AnalyticsEmptyStateProps {
  label: string;
  T: ThemeTokens;
  icon?: LucideIcon;
  hint?: string;
}

export function AnalyticsEmptyState({
  label,
  T,
  icon: Icon = Inbox,
  hint,
}: AnalyticsEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border p-8 text-center"
      style={{
        borderColor: T.border,
        backgroundColor: T.bgCard,
        minHeight: "200px",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="grid h-12 w-12 place-items-center rounded-full"
        style={{
          backgroundColor: T.bgElevated,
          color: T.textFaint,
        }}
        aria-hidden
      >
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium" style={{ color: T.text }}>
        {label}
      </p>
      {hint && (
        <p className="text-xs" style={{ color: T.textMuted }}>
          {hint}
        </p>
      )}
    </div>
  );
}
