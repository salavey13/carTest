"use client";

// /analytics/components/AnalyticsDateNav.tsx
//
// Horizontal date navigator: ← date → | Сегодня
// Mobile-first: 44px touch targets, ARIA labels, focus rings.
//
// iter21: the date chip is now a PICKER, not just a label — tapping it opens
// the system date sheet (native <input type="date"> + showPicker()). The ‹ ›
// iterator and «Сегодня» stay for one-tap stepping. Requested by the owner:
// "use such date picker/iterator in analytics pages instead of current date
// iterator" — same pick+iterate pattern as the profile's MonthPickerBar.
//
// Why the hidden-native-input trick instead of a custom calendar popover:
//   - type="date" works on Android WebView AND iOS WKWebView (Telegram WebApp
//     on both platforms) and gives the familiar system calendar sheet.
//   - type="month" would NOT work on iOS, which is why the profile's month
//     switcher (FranchizeMonthPicker) uses a hand-rolled grid instead.

import { useRef } from "react";
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
  const dateInputRef = useRef<HTMLInputElement>(null);

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

  // Open the system date sheet. Called directly from the click handler so the
  // user-gesture activation is still warm (showPicker requires it).
  const openPicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
      // showPicker can throw when transient activation expired — fall through
      // to focus; on mobile webviews focus alone opens the native sheet.
    }
    input.focus();
    input.click();
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
        className="rounded-xl p-2 transition focus:outline-none focus-visible:ring-2 md:p-2.5"
        style={btnBase}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>

      {/* Date chip = label for the hidden native input: the whole chip is
          tappable and opens the system date picker. */}
      <label
        className="flex min-w-0 flex-1 cursor-pointer select-none items-center justify-center gap-2 rounded-xl border px-3 py-2.5 transition focus-within:outline focus-within:outline-2"
        style={{
          borderColor: T.border,
          backgroundColor: T.bgCard,
          minHeight: "44px",
        }}
        title="Выбрать дату"
      >
        <Calendar className="h-4 w-4 shrink-0" aria-hidden style={{ color: T.textMuted }} />
        <span
          className="truncate text-xs font-medium md:text-sm"
          style={{ color: T.text }}
        >
          {formatDateLong(date)}
        </span>
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          onChange={(e) => {
            // Native inputs emit "" while the user is mid-edit in the field;
            // only commit complete YYYY-MM-DD values.
            if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
              onChange(e.target.value);
            }
          }}
          onClick={openPicker}
          onKeyDown={(e) => {
            // iter22 a11y: keyboard users Tab into the hidden input — Enter
            // and Space should open the picker, same as a tap on the chip.
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
        onClick={() => onChange(shiftDateIso(date, 1))}
        aria-label="Следующий день"
        className="rounded-xl p-2 transition focus:outline-none focus-visible:ring-2 md:p-2.5"
        style={btnBase}
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => onChange(todayLocalIso())}
        disabled={isToday}
        aria-label="Перейти к сегодняшней дате"
        className="rounded-xl border px-2.5 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 disabled:opacity-50 md:px-3 md:py-2.5 md:text-sm"
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
