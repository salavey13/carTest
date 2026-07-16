"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatRussianDateOnly } from "@/app/franchize/[slug]/leads/leads-utils";
import { withAlpha } from "@/app/franchize/lib/theme";

interface AnalyticsDateNavProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}

export function AnalyticsDateNav({
  selectedDate,
  onDateChange,
  minDate,
  maxDate,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: AnalyticsDateNavProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false);
      }
    };
    if (datePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [datePickerOpen]);

  const today = new Date().toISOString().split("T")[0];
  const effectiveMin = minDate || "2020-01-01";
  const effectiveMax = maxDate || today;

  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    const iso = d.toISOString().split("T")[0];
    if (iso >= effectiveMin && iso <= effectiveMax) onDateChange(iso);
  };

  return (
    <div className="flex items-center gap-2 md:gap-3" ref={datePickerRef}>
      <button
        onClick={() => navigateDate(-1)}
        disabled={selectedDate <= effectiveMin}
        className="p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all"
        style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, opacity: selectedDate <= effectiveMin ? 0.5 : 1 }}
        aria-label="Предыдущий день"
      >
        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" style={{ color: textSecondary }} />
      </button>

      <button
        onClick={() => setDatePickerOpen(!datePickerOpen)}
        className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border transition-all hover:scale-105"
        style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
      >
        <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: accentMain }} />
        <span className="text-xs md:text-sm font-medium" style={{ color: textPrimary }}>
          {formatRussianDateOnly(selectedDate)}
        </span>
      </button>

      <button
        onClick={() => navigateDate(1)}
        disabled={selectedDate >= effectiveMax}
        className="p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all"
        style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, opacity: selectedDate >= effectiveMax ? 0.5 : 1 }}
        aria-label="Следующий день"
      >
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" style={{ color: textSecondary }} />
      </button>

      <button
        onClick={() => onDateChange(today)}
        disabled={today < effectiveMin || today > effectiveMax}
        className="px-3 py-1.5 rounded-lg border text-xs font-bold"
        style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }}
      >
        Сегодня
      </button>

      {datePickerOpen && (
        <div
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-[100000] rounded-xl md:rounded-2xl border shadow-2xl p-3 md:p-4"
          style={{ backgroundColor: bgCard, borderColor: withAlpha(accentMain, 0.3), backdropFilter: "blur(16px)" }}
        >
          <input
            type="date"
            value={selectedDate}
            min={effectiveMin}
            max={effectiveMax}
            onChange={(e) => {
              if (e.target.value) {
                onDateChange(e.target.value);
                setDatePickerOpen(false);
              }
            }}
            className="px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2"
            style={{ backgroundColor: withAlpha(bgCard, 0.5), color: textPrimary, border: `1px solid ${borderSoft}` }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setDatePickerOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: withAlpha(borderSoft, 0.3), color: textSecondary }}
            >
              Отмена
            </button>
            <button
              onClick={() => { onDateChange(today); setDatePickerOpen(false); }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: withAlpha(accentMain, 0.2), color: accentMain, border: `1px solid ${withAlpha(accentMain, 0.3)}` }}
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
}