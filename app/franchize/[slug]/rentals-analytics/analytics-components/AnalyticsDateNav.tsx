"use client";

// /analytics-components/AnalyticsDateNav.tsx
//
// Horizontal date navigator for the sales & commercial-offers analytics
// pages: ‹ [📅 30 авг 2026] › | Сегодня
//
// iter22 (code-review polish): the date chip is now a PICKER, not just a
// label — it wraps a hidden native <input type="date"> and opens the system
// date sheet via showPicker() (focus fallback for older webviews). This
// mirrors the rentals-analytics v2 AnalyticsDateNav so ALL analytics pages
// share the same pick+iterate pattern (owner request iter21: "use such date
// picker/iterator in analytics pages instead of current date iterator").
//
// Also fixed vs the old implementation:
//   - «Сегодня» used `new Date().toISOString()` — UTC! For MSK users
//     (UTC+3) between 00:00 and 03:00 local it jumped to YESTERDAY. Now
//     uses todayLocalIso() (Europe/Moscow), matching the server-side day
//     scoping rule.
//   - day stepping uses shiftDateIso() (UTC-deterministic) instead of
//     local-time Date math.
//   - buttons are type="button" (no accidental form submits).
//   - mid-edit "" values from the native input are never committed.
//   - keyboard: the hidden input is Tab-reachable, Enter/Space open the
//     picker (the old popover-only chip was mouse/touch-only).

import { useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatRussianDateOnly } from "../analytics-utils";
import { shiftDateIso, todayLocalIso } from "../components/lib/analytics-utils";
import { withAlpha } from "@/app/franchize/lib/theme";

interface AnalyticsDateNavProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}

export function AnalyticsDateNav({
  selectedDate,
  onDateChange,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: AnalyticsDateNavProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const today = todayLocalIso();
  const isToday = selectedDate === today;

  // Open the system date sheet while the user-gesture activation is still
  // warm (showPicker requires it); fall back to focus() which opens the
  // native sheet on most mobile webviews.
  const openPicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
      // showPicker throws when transient activation expired — fall through.
    }
    input.focus();
    input.click();
  };

  const btnStyle: React.CSSProperties = {
    backgroundColor: withAlpha(bgCard, 0.5),
    borderColor: borderSoft,
    minHeight: "40px",
    minWidth: "40px",
  };

  return (
    <div className="flex items-center gap-2 md:gap-3">
      <button
        type="button"
        onClick={() => onDateChange(shiftDateIso(selectedDate, -1))}
        className="p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all"
        style={btnStyle}
        aria-label="Предыдущий день"
      >
        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" style={{ color: textSecondary }} />
      </button>

      {/* Date chip = label for the hidden native input: the whole chip is
          tappable and opens the system date picker. */}
      <label
        className="flex min-w-0 cursor-pointer select-none items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl border px-3 md:px-4 py-1.5 md:py-2 transition-all"
        style={{
          backgroundColor: withAlpha(bgCard, 0.5),
          borderColor: borderSoft,
          minHeight: "40px",
        }}
        title="Выбрать дату"
      >
        <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" style={{ color: accentMain }} />
        <span
          className="truncate text-xs md:text-sm font-medium"
          style={{ color: textPrimary }}
        >
          {formatRussianDateOnly(selectedDate)}
        </span>
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          onChange={(e) => {
            // Native inputs emit "" while the user is mid-edit; only commit
            // complete YYYY-MM-DD values.
            if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
              onDateChange(e.target.value);
            }
          }}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          aria-label="Выбор даты аналитики"
          className="sr-only"
        />
      </label>

      <button
        type="button"
        onClick={() => onDateChange(shiftDateIso(selectedDate, 1))}
        className="p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all"
        style={btnStyle}
        aria-label="Следующий день"
      >
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" style={{ color: textSecondary }} />
      </button>

      <button
        type="button"
        onClick={() => onDateChange(today)}
        disabled={isToday}
        className="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-50"
        style={{
          backgroundColor: withAlpha(bgCard, 0.5),
          borderColor: borderSoft,
          color: textSecondary,
          minHeight: "40px",
        }}
      >
        Сегодня
      </button>
    </div>
  );
}
