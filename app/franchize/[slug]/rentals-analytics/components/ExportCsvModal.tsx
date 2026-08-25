"use client";

// /analytics/components/ExportCsvModal.tsx
//
// FIX (F9): CSV export modal for the v2 analytics dashboard.
// Lets the operator pick a start/end date range and triggers the CSV export
// (columns mapped to the operator finance sheet — /api/franchize/rentals-csv-export).
// Mobile-first: full-width sheet on small screens, centered dialog on desktop.

import { useEffect, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (from: string, to: string) => Promise<void>;
  T: ThemeTokens;
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExportCsvModal({ isOpen, onClose, onExport, T }: ExportCsvModalProps) {
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [exporting, setExporting] = useState(false);

  // Reset to defaults each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setFrom(firstDayOfMonthIso());
      setTo(todayIso());
      setExporting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isValid = from && to && from <= to;

  const handleExport = async () => {
    if (!isValid || exporting) return;
    setExporting(true);
    try {
      await onExport(from, to);
      onClose();
    } catch {
      // error toast handled by the caller
    } finally {
      setExporting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    borderColor: T.border,
    backgroundColor: T.bgElevated,
    color: T.text,
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={exporting ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Экспорт CSV за период"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl"
        style={{ backgroundColor: T.bgCard, borderColor: T.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: T.text }}>
            Экспорт CSV за период
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="cursor-pointer rounded-lg p-2 transition focus:outline-none focus-visible:ring-2"
            style={{ color: T.textMuted, minHeight: "44px", minWidth: "44px" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-xs" style={{ color: T.textMuted }}>
          Аренды за выбранный период экспортируются в формате финансовой таблицы
          (Дата, Цена, Экип, Залог, Марка, Пробег до/после, Время, Комментарий).
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium" style={{ color: T.text }} htmlFor="csv-from">
              Дата начала
            </label>
            <input
              id="csv-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
            />
            {from && (
              <p className="mt-1 text-[10px] tabular-nums" style={{ color: T.textFaint }}>
                ({formatDateRu(from)})
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: T.text }} htmlFor="csv-to">
              Дата конца
            </label>
            <input
              id="csv-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              style={inputStyle}
            />
            {to && (
              <p className="mt-1 text-[10px] tabular-nums" style={{ color: T.textFaint }}>
                ({formatDateRu(to)})
              </p>
            )}
          </div>

          {!isValid && from && to && (
            <p className="text-xs" style={{ color: "#ef4444" }}>
              Дата начала должна быть не позже даты конца
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 disabled:opacity-50"
              style={{ borderColor: T.border, color: T.textMuted, backgroundColor: "transparent", minHeight: "44px" }}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !isValid}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 disabled:opacity-50"
              style={{ backgroundColor: "#3b82f6", color: "#ffffff", minHeight: "44px" }}
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Экспорт…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" aria-hidden />
                  Скачать CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
