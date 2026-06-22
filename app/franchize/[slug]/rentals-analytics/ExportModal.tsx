"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (startDate: string, endDate: string) => Promise<void>;
  minDate?: string;
  maxDate?: string;
  defaultDaysBack?: number;
}

export function ExportModal({
  isOpen,
  onClose,
  onExport,
  minDate,
  maxDate,
  defaultDaysBack = 7,
}: ExportModalProps) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - defaultDaysBack);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport(startDate, endDate);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  // Validate date range
  const isDateRangeValid = startDate && endDate && new Date(startDate) <= new Date(endDate);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Экспорт в Excel</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Дата начала</label>
            <input
              type="date"
              value={startDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Дата конца</label>
            <input
              type="date"
              value={endDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
            />
          </div>

          {!isDateRangeValid && startDate && endDate && (
            <p className="text-xs text-rose-500">
              Дата начала должна быть раньше даты конца
            </p>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={exporting}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={exporting || !isDateRangeValid}
            >
              {exporting ? (
                <span>Экспорт...</span>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Экспортировать
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
