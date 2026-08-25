"use client";

// /analytics/components/ExportCsvModal.tsx
//
// FIX (F9 iter3): the "Export CSV" button now opens a TABLE VIEW (same
// columns as the CSV file) instead of a date-picker-only dialog. The user
// can scroll the table horizontally on mobile, change the date range at
// the top, and tap the download icon to actually download the visible
// data as a CSV file.
//
// Variant "rentals" renders the 17-column finance sheet (Дата, ЗП Аренда,
// Партнеру, Цена, Экип, Залог, Марка, "", Пробег до, Пробег после, Время,
// Комментарий, дата, ЗП Продажа, Наименование, Цена, Комментарий).
// Variant "sales" renders the 5-column sales sheet (Дата, ЗП Продажа,
// Наименование, Цена, Комментарий).

import { useCallback, useEffect, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fetch CSV text for the given range — used to render the in-modal table. */
  fetchCsvText?: (from: string, to: string) => Promise<string>;
  /** Trigger the actual file download (blob + anchor / TG fallback). */
  onExport: (from: string, to: string) => Promise<void>;
  T: ThemeTokens;
  /** Column set: "rentals" (17 cols) or "sales" (5 cols). */
  variant?: "rentals" | "sales";
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// RFC-4180-lite CSV parser — handles quoted cells with "" escapes, commas
// inside quotes, and CRLF / LF line endings. Returns rows of cells.
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let i = 0;
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // CRLF or lone CR — flush on next \n or here
      if (text[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      out.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush trailing field/row if file did not end with newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.length > 0);
}

export function ExportCsvModal({
  isOpen,
  onClose,
  fetchCsvText,
  onExport,
  T,
  variant = "rentals",
}: ExportCsvModalProps) {
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTable = useCallback(async () => {
    if (!fetchCsvText || !from || !to || from > to) return;
    setLoading(true);
    setError(null);
    try {
      const text = await fetchCsvText(from, to);
      setRows(parseCsv(text));
    } catch {
      setError("Не удалось загрузить данные");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetchCsvText, from, to]);

  // Reset + initial fetch each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setFrom(firstDayOfMonthIso());
      setTo(todayIso());
      setRows([]);
      setError(null);
      setDownloading(false);
    }
  }, [isOpen]);

  // Re-fetch when from/to changes while open (debounced by render).
  useEffect(() => {
    if (!isOpen || !fetchCsvText) return;
    if (!from || !to || from > to) return;
    void loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, isOpen]);

  if (!isOpen) return null;

  const isValid = from && to && from <= to;

  const handleDownload = async () => {
    if (!isValid || downloading) return;
    setDownloading(true);
    try {
      await onExport(from, to);
    } catch {
      // toast handled in caller
    } finally {
      setDownloading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    borderColor: T.border,
    backgroundColor: T.bgElevated,
    color: T.text,
  };

  // First row = headers. Skip the empty divider row the API emits before the
  // totals row (an empty string row → parseCsv filters those out, but a row
  // of all empty strings can still sneak through — drop those for display).
  const headerRow = rows[0] ?? [];
  const bodyRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  const totalRowIdx = bodyRows.findIndex((r) =>
    r.some((c) => c.trim().toLowerCase().startsWith("итого")),
  );
  const dataRows = totalRowIdx === -1 ? bodyRows : bodyRows.slice(0, totalRowIdx);
  const totalsRow = totalRowIdx === -1 ? null : bodyRows[totalRowIdx];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      onClick={downloading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр таблицы и экспорт CSV"
    >
      <div
        className="flex h-full w-full flex-col sm:h-auto sm:max-h-[88vh] sm:max-w-5xl sm:rounded-2xl border shadow-2xl"
        style={{ backgroundColor: T.bgCard, borderColor: T.border }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky date pickers + actions */}
        <div
          className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: T.border }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold" style={{ color: T.text }}>
              {variant === "sales" ? "Продажи — таблица" : "Аренды — таблица"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="cursor-pointer rounded-lg p-2 transition focus:outline-none focus-visible:ring-2 sm:hidden"
              style={{ color: T.textMuted, minHeight: "44px", minWidth: "44px" }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col">
              <label
                className="mb-1 text-[10px] font-medium uppercase tracking-wide"
                style={{ color: T.textMuted }}
                htmlFor="csv-from"
              >
                С даты
              </label>
              <input
                id="csv-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
                style={inputStyle}
              />
              {from && (
                <p className="mt-0.5 text-[10px] tabular-nums" style={{ color: T.textFaint }}>
                  {formatDateRu(from)}
                </p>
              )}
            </div>
            <div className="flex flex-col">
              <label
                className="mb-1 text-[10px] font-medium uppercase tracking-wide"
                style={{ color: T.textMuted }}
                htmlFor="csv-to"
              >
                По дату
              </label>
              <input
                id="csv-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
                style={inputStyle}
              />
              {to && (
                <p className="mt-0.5 text-[10px] tabular-nums" style={{ color: T.textFaint }}>
                  {formatDateRu(to)}
                </p>
              )}
            </div>
            {/* Download icon button — exports the currently visible data range */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!isValid || downloading || loading}
              aria-label="Скачать видимые данные в CSV"
              title="Скачать видимые данные в CSV"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 disabled:opacity-50"
              style={{ backgroundColor: "#3b82f6", color: "#ffffff", minHeight: "36px" }}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="hidden cursor-pointer rounded-lg p-2 transition focus:outline-none focus-visible:ring-2 sm:inline-flex"
              style={{ color: T.textMuted, minHeight: "36px", minWidth: "36px" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table — horizontal scroll on mobile, sticky header */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full min-h-[200px] items-center justify-center p-8">
              <div className="flex items-center gap-2 text-sm" style={{ color: T.textMuted }}>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Загрузка…
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[200px] items-center justify-center p-8 text-sm" style={{ color: "#ef4444" }}>
              {error}
            </div>
          ) : headerRow.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center p-8 text-sm" style={{ color: T.textMuted }}>
              Нет данных за выбранный период
            </div>
          ) : (
            <table
              className="w-full border-collapse text-left text-xs"
              style={{ color: T.text, minWidth: "max-content" }}
            >
              <thead className="sticky top-0 z-10">
                <tr style={{ backgroundColor: T.bgElevated }}>
                  {headerRow.map((h, i) => (
                    <th
                      key={i}
                      className="whitespace-nowrap border-b border-r px-2.5 py-2 font-semibold"
                      style={{
                        borderColor: T.border,
                        color: T.textMuted,
                        // Index 7 (the empty column in rentals sheet) gets squished
                        minWidth: i === 7 ? "1.5rem" : undefined,
                      }}
                    >
                      {h || "\u00A0"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((r, ri) => (
                  <tr
                    key={ri}
                    style={{ backgroundColor: ri % 2 === 1 ? T.bgElevated : "transparent" }}
                  >
                    {headerRow.map((_, ci) => (
                      <td
                        key={ci}
                        className="whitespace-nowrap border-b border-r px-2.5 py-1.5 tabular-nums"
                        style={{ borderColor: T.border }}
                      >
                        {r[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
                {totalsRow && (
                  <tr style={{ backgroundColor: T.bgElevated, fontWeight: 700 }}>
                    {headerRow.map((_, ci) => (
                      <td
                        key={ci}
                        className="whitespace-nowrap border-t-2 border-r px-2.5 py-2 tabular-nums"
                        style={{ borderColor: T.border, fontWeight: 700 }}
                      >
                        {totalsRow[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer — count + range summary */}
        {!loading && !error && headerRow.length > 0 && (
          <div
            className="border-t px-4 py-2 text-[11px] tabular-nums"
            style={{ borderColor: T.border, color: T.textMuted }}
          >
            {dataRows.length} строк · {formatDateRu(from)} — {formatDateRu(to)}
          </div>
        )}
      </div>
    </div>
  );
}
