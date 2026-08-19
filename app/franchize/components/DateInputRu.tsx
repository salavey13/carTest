// app/franchize/components/DateInputRu.tsx
//
// 2026-08-19 review: native <input type="date"> displays the date using the
// browser's locale. For users with en-US locale (e.g. Telegram WebApp in
// English), it shows "08/07/2026" which the Russian user reads as
// "8th of July" instead of "7th of August". This component wraps the
// native input and shows an unambiguous Russian "(dd.mm.yyyy)" label
// next to it so the user always knows which date they're selecting.
//
// The native input is kept (not replaced with a custom date picker) because:
//   - It's accessible (keyboard nav, screen reader support)
//   - It's mobile-friendly (native iOS / Android date pickers)
//   - It's internationalizable (each user sees their own locale's picker UI)
//
// Usage:
//   <DateInputRu value={periodStart} onChange={setPeriodStart} />
//   <DateInputRu value={periodEnd} onChange={setPeriodEnd} label="По" />
//
// The `value` is a YYYY-MM-DD string (ISO date-only, same as <input type=date>).
// The `onChange` callback receives a YYYY-MM-DD string.

import type { CSSProperties } from "react";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";

interface DateInputRuProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  min?: string;
  max?: string;
}

/**
 * Format a YYYY-MM-DD ISO date string as "dd.mm.yyyy" for Russian display.
 * Returns the original string if it can't be parsed (defensive — never throws).
 */
export function formatDateRu(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/**
 * Format a YYYY-MM-DD ISO date string as "7 авг." (Russian short month +
 * day) — used when we want a more readable "what date is selected"
 * indicator next to the date input.
 */
export function formatDateRuLong(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00Z");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return formatDateRu(iso);
  }
}

export function DateInputRu({
  value,
  onChange,
  label,
  className = "",
  style,
  disabled,
  min,
  max,
}: DateInputRuProps) {
  const T = useCrewTokens();
  const accentColor = (style as any)?.color || T.textMuted;
  const borderColor = (style as any)?.borderColor || T.borderSoft;
  const bg = (style as any)?.backgroundColor ||
    "color-mix(in srgb, var(--franchize-shell-card) 50%, transparent)";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-xs" style={{ color: T.textMuted }}>
          {label}
        </span>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        className="rounded border px-2 py-1 text-xs"
        style={{
          borderColor,
          backgroundColor: bg,
          color: T.text,
          ...style,
        }}
      />
      {/* Unambiguous Russian-format display next to the input.
          Hidden if the value is empty. */}
      {value && (
        <span
          className="text-xs tabular-nums"
          style={{ color: accentColor, opacity: 0.8 }}
          aria-label={`Выбрана дата: ${formatDateRu(value)}`}
        >
          ({formatDateRu(value)})
        </span>
      )}
    </div>
  );
}
