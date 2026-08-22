"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export interface DatePickerProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  dateRange?: { minDate: string; maxDate: string } | null;
  className?: string;
}

export function DatePicker({ selectedDate, onDateChange, dateRange, className = "" }: DatePickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const minDate = dateRange?.minDate || "2020-01-01";
  const maxDate = dateRange?.maxDate || today;

  const goToPrevDay = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const iso = d.toISOString().split("T")[0];
    if (iso >= minDate) onDateChange(iso);
  }, [selectedDate, minDate, onDateChange]);

  const goToNextDay = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().split("T")[0];
    if (iso <= maxDate) onDateChange(iso);
  }, [selectedDate, maxDate, onDateChange]);

  const goToToday = useCallback(() => {
    if (today >= minDate && today <= maxDate) onDateChange(today);
  }, [today, minDate, maxDate, onDateChange]);

  const formatDisplayDate = useCallback((iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }, []);

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={goToPrevDay}
        disabled={selectedDate <= minDate}
        className="rounded-lg p-2 transition hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Предыдущий день"
        style={{ color: selectedDate <= minDate ? "#9ca3af" : "#1f2937" }}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        onClick={() => setPickerOpen(!pickerOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-gray-100"
        style={{ color: "#1f2937", backgroundColor: "#f3f4f6" }}
        aria-haspopup="true"
        aria-expanded={pickerOpen}
      >
        <Calendar className="h-4 w-4" />
        {formatDisplayDate(selectedDate)}
        <ChevronDown className="h-4 w-4 transition transform" style={{ transform: pickerOpen ? "rotate(180deg)" : "rotate(0)" }} />
      </button>

      <button
        onClick={goToNextDay}
        disabled={selectedDate >= maxDate}
        className="rounded-lg p-2 transition hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Следующий день"
        style={{ color: selectedDate >= maxDate ? "#9ca3af" : "#1f2937" }}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <button
        onClick={goToToday}
        disabled={selectedDate === today || today < minDate || today > maxDate}
        className="rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ color: selectedDate === today ? "#9ca3af" : "#3b82f6" }}
      >
        Сегодня
      </button>

      {pickerOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

// Helper for date navigation
export function useDateNavigation(initialDate: string, dateRange?: { minDate: string; maxDate: string } | null) {
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const minDate = dateRange?.minDate || "2020-01-01";
  const maxDate = dateRange?.maxDate || today;

  const goToDate = useCallback((delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    const iso = d.toISOString().split("T")[0];
    if (iso >= minDate && iso <= maxDate) setSelectedDate(iso);
  }, [selectedDate, minDate, maxDate]);

  const goToToday = useCallback(() => {
    if (today >= minDate && today <= maxDate) setSelectedDate(today);
  }, [today, minDate, maxDate]);

  const goToDateDirect = useCallback((iso: string) => {
    if (iso >= minDate && iso <= maxDate) setSelectedDate(iso);
  }, [minDate, maxDate]);

  return {
    selectedDate,
    setSelectedDate,
    goToDate,
    goToToday,
    goToDateDirect,
    minDate,
    maxDate,
    today,
  };
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";