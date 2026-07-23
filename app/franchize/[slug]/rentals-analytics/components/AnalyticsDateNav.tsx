"use client";

// /analytics/components/AnalyticsDateNav.tsx
//
// Horizontal date navigator: ← date → | Сегодня
// Mobile-first: 44px touch targets, ARIA labels, focus rings.

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import { formatDateLong, shiftDateIso, todayLocalIso } from "./lib/analytics-utils";

interface AnalyticsDateNavProps {
  date: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  T: ThemeTokens;
  isToday: boolean;
}

export function AnalyticsDateNav({ date, onChange, T, isToday }: AnalyticsDateNavProps) {
  const btnBase: React.CSSProperties = {
    borderColor: T.border,
    backgroundColor: T.bgCard,
    color: T.text,
    cursor: "pointer",
    minHeight: "44px",
    minWidth: "44px",
    borderRadius: "12px",
    border: `1px solid ${T.border}`,
  };

  return (
    <div
      className="flex items-center justify-between gap-3"
      role="group"
      aria-label="Навигация по датам"
    >
      <button
        type="button"
        onClick={() => onChange(shiftDateIso(date, -1))}
        aria-label="Предыдущий день"
        className="rounded-xl p-2.5 transition focus:outline-none focus-visible:ring-2"
        style={btnBase}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>

      <div
        className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5"
        style={{
          borderColor: T.border,
          backgroundColor: T.bgCard,
          minHeight: "44px",
        }}
      >
        <Calendar className="h-4 w-4 shrink-0" aria-hidden style={{ color: T.textMuted }} />
        <span
          className="truncate text-sm font-medium"
          style={{ color: T.text }}
        >
          {formatDateLong(date)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onChange(shiftDateIso(date, 1))}
        aria-label="Следующий день"
        className="rounded-xl p-2.5 transition focus:outline-none focus-visible:ring-2"
        style={btnBase}
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => onChange(todayLocalIso())}
        disabled={isToday}
        aria-label="Перейти к сегодняшней дате"
        className="rounded-xl border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 disabled:opacity-50"
        style={{
          borderColor: T.border,
          backgroundColor: isToday ? "transparent" : T.bgCard,
          color: isToday ? T.textFaint : T.textMuted,
          cursor: isToday ? "default" : "pointer",
          minHeight: "44px",
        }}
      >
        Сегодня
      </button>
    </div>
  );
}
