"use client";

// /app/franchize/components/FranchizeMonthPicker.tsx
//
// Shared month picker bar: ‹ [Август 2026 ▾] › — iterate one month at a time
// AND jump to any month/year directly via the popover grid.
//
// Why a custom popover instead of <input type="month">:
//   iOS Safari/WKWebView (Telegram WebApp on iPhone) does NOT support
//   type="month" — it degrades to a text input. A hand-rolled month grid
//   works identically on Android WebView, iOS, and desktop.
//
// Used by (iter21):
//   - profile «Заработок за месяц» (subrenter earnings counter)
//   - profile «Выплаты субарендаторам» (owner payout sheet)
// Any future month-scoped panel should reuse this instead of ‹ › buttons.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { currentMskMonthKey, monthKeyToLabelRu, normalizeMonthKey, shiftMonthKey } from "@/app/franchize/lib/subrenter-economics";

export interface MonthPickerBarProps {
  /** Current month key "YYYY-MM". */
  value: string;
  /** Fires with the new "YYYY-MM" whenever the user iterates or picks. */
  onChange: (next: string) => void;
  /** Explicit colors (works with both CrewTokens and analytics ThemeTokens). */
  accent: string;
  /** Text readable ON the accent fill (gold accents need dark text). */
  accentContrast?: string;
  bgCard: string;
  bgElevated: string;
  border: string;
  text: string;
  textMuted: string;
}

const MONTH_SHORT_RU = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export function MonthPickerBar({
  value,
  onChange,
  accent,
  accentContrast = "#ffffff",
  bgCard,
  bgElevated,
  border,
  text,
  textMuted,
}: MonthPickerBarProps) {
  const [open, setOpen] = useState(false);
  // Year shown in the popover grid — starts at the year of the current value.
  const [gridYear, setGridYear] = useState(() => Number(normalizeMonthKey(value)?.slice(0, 4)) || new Date().getFullYear());
  const rootRef = useRef<HTMLDivElement>(null);

  // iter22 rapid-tap fix: parents store the emitted key in React state, so two
  // taps inside one render batch would both compute from the SAME `value` and
  // one step would be lost. Track the last key we emitted in a ref so ‹ ›
  // always steps from the newest value, even before the parent re-renders.
  const lastEmittedRef = useRef<string>(normalizeMonthKey(value) || currentMskMonthKey());

  const norm = normalizeMonthKey(value) || currentMskMonthKey();
  useEffect(() => {
    lastEmittedRef.current = norm;
  }, [norm]);
  const iterate = (delta: number) => {
    const next = shiftMonthKey(lastEmittedRef.current, delta);
    lastEmittedRef.current = next;
    onChange(next);
  };

  const currentMonthNum = Number(norm.slice(5, 7));
  const currentYear = Number(norm.slice(0, 4));

  // Re-sync the popover year when the value changes while closed.
  useEffect(() => {
    if (!open) {
      const y = Number(normalizeMonthKey(value)?.slice(0, 4));
      if (Number.isFinite(y) && y > 0) setGridYear(y);
    }
  }, [value, open]);

  // Close on outside tap / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (monthNum: number) => {
    onChange(`${gridYear}-${String(monthNum).padStart(2, "0")}`);
    setOpen(false);
  };

  const chipBase: React.CSSProperties = {
    borderColor: border,
    backgroundColor: bgCard,
    color: text,
    minHeight: "36px",
    minWidth: "36px",
    cursor: "pointer",
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <button
        type="button"
        aria-label="Предыдущий месяц"
        onClick={() => iterate(-1)}
        className="rounded-lg border px-2.5 py-1 text-sm transition hover:opacity-80"
        style={chipBase}
      >
        ‹
      </button>

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Месяц: ${monthKeyToLabelRu(norm)}. Нажмите, чтобы выбрать произвольный месяц`}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-[132px] items-center justify-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition hover:opacity-80"
        style={chipBase}
      >
        <span className="truncate">{monthKeyToLabelRu(norm)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden style={{ color: textMuted }} />
      </button>

      <button
        type="button"
        aria-label="Следующий месяц"
        onClick={() => iterate(1)}
        className="rounded-lg border px-2.5 py-1 text-sm transition hover:opacity-80"
        style={chipBase}
      >
        ›
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Выбор месяца"
          className="absolute right-0 top-full z-50 mt-2 w-[272px] rounded-xl border p-3 shadow-2xl"
          style={{ backgroundColor: bgElevated, borderColor: border }}
        >
          {/* Year stepper */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Предыдущий год"
              onClick={() => setGridYear((y) => y - 1)}
              className="rounded-lg border p-1.5 transition hover:opacity-80"
              style={{ borderColor: border, color: text, backgroundColor: bgCard }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-sm font-bold tabular-nums" style={{ color: text }}>
              {gridYear}
            </span>
            <button
              type="button"
              aria-label="Следующий год"
              onClick={() => setGridYear((y) => y + 1)}
              className="rounded-lg border p-1.5 transition hover:opacity-80"
              style={{ borderColor: border, color: text, backgroundColor: bgCard }}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* 12-month grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_SHORT_RU.map((label, idx) => {
              const monthNum = idx + 1;
              const isActive = gridYear === currentYear && monthNum === currentMonthNum;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pick(monthNum)}
                  aria-label={`${monthKeyToLabelRu(`${gridYear}-${String(monthNum).padStart(2, "0")}`)}`}
                  className="rounded-lg border py-2 text-xs font-semibold lowercase transition hover:opacity-85"
                  style={{
                    borderColor: isActive ? accent : border,
                    backgroundColor: isActive ? accent : bgCard,
                    color: isActive ? accentContrast : text,
                    minHeight: "40px",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(currentMskMonthKey());
              setOpen(false);
            }}
            className="mt-2 w-full rounded-lg border py-2 text-xs font-semibold transition hover:opacity-85"
            style={{ borderColor: accent, backgroundColor: "transparent", color: accent, minHeight: "38px" }}
          >
            Текущий месяц
          </button>
        </div>
      )}
    </div>
  );
}
