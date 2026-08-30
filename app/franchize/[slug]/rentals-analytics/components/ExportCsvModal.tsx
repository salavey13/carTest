"use client";

// /analytics/components/ExportCsvModal.tsx
//
// FIX (F9 iter3, polished iter4): the "Export CSV" button opens a TABLE VIEW
// (same columns as the CSV file). The user can scroll the table horizontally
// on mobile, change the date range at the top, search/filter rows, send the
// file to their Telegram chat, or download it as CSV.
//
// Variant "rentals" renders the 17-column finance sheet (Дата, ЗП Аренда,
// Партнеру, Цена, Экип, Залог, Марка, "", Пробег до, Пробег после, Время,
// Комментарий, дата, ЗП Продажа, Наименование, Цена, Комментарий).
// Variant "sales" renders the 5-column sales sheet (Дата, ЗП Продажа,
// Наименование, Цена, Комментарий).
//
// Polish (iter4):
//  • Sticky first column (Дата) so the row context stays visible while
//    scrolling horizontally on mobile.
//  • Search input — fuzzy row filter across all cells.
//  • Totals card above the table — row count + sum of "Цена" + sum of
//    "ЗП Аренда" (when rentals variant).
//  • Numeric cells right-aligned + tabular-nums; date cells centre-aligned;
//    text cells left-aligned with truncation + tooltip.
//  • Hover highlight + zebra striping for readability.
//  • Send-to-Telegram button next to download — fires `onSendTelegram`
//    callback (the parent wires this to sendTelegramDocument helper).
//  • Keyboard support — ESC closes the modal; Enter in the search box is
//    a no-op (live filter).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Download, Loader2, Send, Search, Table2, Camera } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";
// iter26: money-cell parser for the totals row (Σ Цена / Σ ЗП / Σ Партнёрам / Σ Экип+Залог).
import { toNumber } from "./lib/csv-money";

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fetch CSV text for the given range — used to render the in-modal table. */
  fetchCsvText?: (from: string, to: string) => Promise<string>;
  /** Trigger the actual file download (blob + anchor / TG fallback). */
  onExport: (from: string, to: string) => Promise<void>;
  /** Send the same data as a TG document to the operator's chat. */
  onSendTelegram?: (from: string, to: string) => Promise<void>;
  T: ThemeTokens;
  /** Column set: "rentals" (21 cols incl. hidden ID) or "sales" (5 cols). */
  variant?: "rentals" | "sales";
  /** iter20: crew slug — used for the row tap-through to the rental page. */
  slug?: string;
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// RFC-4180-lite CSV parser — handles BOM, quoted cells, "" escapes, CRLF/LF.
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
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
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.length > 0);
}

// Column-kind heuristic — drives alignment + parsing for the totals card.
// Index 7 in rentals variant is the empty spacer column.
// iter20: index 20 is the rental UUID (hidden — powers the row tap-through).
const RENTALS_NUMERIC_COLS = new Set([1, 3, 4, 5, 8, 9, 15]); // ЗП, Цена, Экип, Залог, odo, odo, Цена продажи
const RENTALS_DATE_COLS = new Set([0, 12]); // Дата (rental), дата (sale)
const RENTALS_HIDE_COLS = new Set([7, 20]); // empty spacer + hidden rental id
const RENTALS_NOTES_COL = 17;   // «Заметки» — wider, wrapped
const RENTALS_SUBRENTER_COL = 18; // «Субарендатор» — amber-tinted
const RENTALS_PHOTOS_COL = 19; // «Фото» — camera icon + green when present
const RENTALS_ID_COL = 20;     // hidden rental uuid
const SALES_NUMERIC_COLS = new Set([3]); // Цена
const SALES_DATE_COLS = new Set([0]); // Дата

function isNumericLike(s: string): boolean {
  if (!s) return false;
  const t = s.trim().replace(/\s+/g, "").replace(",", ".").replace(/[₽$€]/g, "");
  return t !== "" && !Number.isNaN(Number(t));
}

export function ExportCsvModal({
  isOpen,
  onClose,
  fetchCsvText,
  onExport,
  onSendTelegram,
  T,
  variant = "rentals",
  slug,
}: ExportCsvModalProps) {
  const router = useRouter();
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadTable = useCallback(async () => {
    if (!fetchCsvText || !from || !to || from > to) return;
    setLoading(true);
    setError(null);
    try {
      const text = await fetchCsvText(from, to);
      setRows(parseCsv(text));
    } catch (e) {
      // FIX (iter6): show the ACTUAL error next to the generic message so the
      // operator can tell a 500 from an offline device from a bad date range.
      const detail = e instanceof Error ? e.message : String(e);
      setError(`Не удалось загрузить данные — ${detail}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetchCsvText, from, to]);

  useEffect(() => {
    if (isOpen) {
      setFrom(firstDayOfMonthIso());
      setTo(todayIso());
      setRows([]);
      setError(null);
      setDownloading(false);
      setSending(false);
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !fetchCsvText) return;
    if (!from || !to || from > to) return;
    void loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, isOpen]);

  // ESC closes the modal
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !downloading && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, downloading, sending]);

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

  const handleSendTelegram = async () => {
    if (!isValid || sending || !onSendTelegram) return;
    setSending(true);
    try {
      await onSendTelegram(from, to);
    } catch {
      // toast handled in caller
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    borderColor: T.border,
    backgroundColor: T.bgElevated,
    color: T.text,
  };

  const headerRow = rows[0] ?? [];
  const bodyRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

  // Detect totals row by scanning for "Итого" cell OR a row whose only
  // non-empty cells are in known numeric column positions with no date/bike.
  const totalsRowIdx = bodyRows.findIndex((r) =>
    r.some((c) => c.trim().toLowerCase().startsWith("итого")),
  );

  const dataRowsAll = totalsRowIdx === -1 ? bodyRows : bodyRows.slice(0, totalsRowIdx);
  const totalsRow = totalsRowIdx === -1 ? null : bodyRows[totalsRowIdx];

  // Apply search filter.
  // NOTE: intentionally NOT useMemo — this sits after the `if (!isOpen) return null`
  // early return, and a conditional hook violates rules-of-hooks (broke the build).
  // The filter is cheap (a few hundred rows max) and recomputed per render.
  const q = query.trim().toLowerCase();
  const dataRows = !q
    ? dataRowsAll
    : dataRowsAll.filter((r) => r.some((c) => (c || "").toLowerCase().includes(q)));

  // Column-kind lookup
  const numericCols = variant === "rentals" ? RENTALS_NUMERIC_COLS : SALES_NUMERIC_COLS;
  const dateCols = variant === "rentals" ? RENTALS_DATE_COLS : SALES_DATE_COLS;
  const hideCols = variant === "rentals" ? RENTALS_HIDE_COLS : new Set<number>();

  // iter20: visible column count for the header badge (21 cols − 2 hidden).
  const visibleColCount = Math.max(headerRow.length - hideCols.size, 0);

  // iter20: row tap-through — rental rows carry the rental uuid in the hidden
  // last column; tapping a row opens the rental page (photos gallery, deposit
  // tracking, handoff flow) exactly like the item sheet's «Открыть аренду».
  const openRentalForRow = (row: string[]) => {
    if (variant !== "rentals" || !slug) return;
    const rentalId = (row[RENTALS_ID_COL] || "").trim();
    if (!rentalId) return;
    router.push(`/franchize/${slug}/rental/${rentalId}`);
  };

  // Totals card — sum of price column (col 3 for rentals, col 3 for sales)
  // and salary column (col 1 for rentals).
  const priceCol = 3;
  const salaryCol = variant === "rentals" ? 1 : -1;
  const partnerCol = variant === "rentals" ? 2 : -1;
  const equipCol = variant === "rentals" ? 4 : -1;
  const depositCol = variant === "rentals" ? 5 : -1;

  const sumOf = (colIdx: number, source: string[][]): number =>
    colIdx < 0 ? 0 : source.reduce((acc, r) => acc + toNumber(r[colIdx] || ""), 0);

  const sumPrice = sumOf(priceCol, dataRows);
  const sumSalary = sumOf(salaryCol, dataRows);
  const sumPartner = sumOf(partnerCol, dataRows);
  const sumEquip = sumOf(equipCol, dataRows);
  const sumDeposit = sumOf(depositCol, dataRows);

  const formatMoney = (n: number): string =>
    n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

  const colAlign = (i: number): React.CSSProperties => ({
    textAlign: numericCols.has(i) ? "right" : dateCols.has(i) ? "center" : "left",
  });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      onClick={downloading || sending ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр таблицы и экспорт CSV"
    >
      <div
        className="flex h-full w-full flex-col sm:h-auto sm:max-h-[88vh] sm:max-w-5xl sm:rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: T.bgCard, borderColor: T.border }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header — title + close + date pickers + actions ────────────────── */}
        <div
          className="flex flex-col gap-3 border-b p-3 sm:p-4"
          style={{ borderColor: T.border, background: T.bgElevated }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Table2 className="h-5 w-5" style={{ color: T.accent }} aria-hidden />
              <h2 className="text-base font-semibold" style={{ color: T.text }}>
                {variant === "sales" ? "Продажи — таблица" : "Аренды — таблица"}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: `color-mix(in srgb, ${T.accent} 15%, transparent)`,
                  color: T.accent,
                }}
              >
                {variant === "sales" ? "5 столбцов" : `${visibleColCount} столбцов`}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="cursor-pointer rounded-lg p-2 transition hover:opacity-80 focus:outline-none focus-visible:ring-2"
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
            </div>

            <div className="ml-auto flex items-end gap-2">
              {/* Search input — fuzzy filter across all cells */}
              <div
                className="relative flex items-center rounded-lg border px-2"
                style={inputStyle}
              >
                <Search className="h-3.5 w-3.5 opacity-60" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск…"
                  aria-label="Поиск по таблице"
                  className="ml-1.5 w-24 bg-transparent py-1.5 text-xs outline-none sm:w-40"
                  style={{ color: T.text }}
                />
              </div>

              {/* Send to Telegram — fires onSendTelegram */}
              {onSendTelegram && (
                <button
                  type="button"
                  onClick={handleSendTelegram}
                  disabled={!isValid || sending || loading}
                  aria-label="Отправить в Telegram"
                  title="Отправить CSV в Telegram"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 disabled:opacity-50"
                  style={{
                    backgroundColor: "#22c55e",
                    color: "#ffffff",
                    minHeight: "36px",
                  }}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                </button>
              )}

              {/* Download icon button — exports the visible range */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={!isValid || downloading || loading}
                aria-label="Скачать видимые данные в CSV"
                title="Скачать CSV"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 disabled:opacity-50"
                style={{ backgroundColor: "#3b82f6", color: "#ffffff", minHeight: "36px" }}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Totals card — row count + sum of money columns ─────────────────── */}
        {!loading && !error && headerRow.length > 0 && (
          <div
            className={variant === "rentals" ? "grid grid-cols-2 gap-px border-b sm:grid-cols-5" : "grid grid-cols-2 gap-px border-b sm:grid-cols-4"}
            style={{
              borderColor: T.border,
              backgroundColor: T.border,
            }}
          >
            <TotalsTile
              label="Записей"
              value={String(dataRows.length)}
              T={T}
            />
            <TotalsTile
              label="Σ Цена"
              value={`${formatMoney(sumPrice)} ₽`}
              T={T}
              accent
            />
            {variant === "rentals" && (
              <TotalsTile
                label="Σ ЗП Аренда"
                value={`${formatMoney(sumSalary)} ₽`}
                T={T}
              />
            )}
            {/* iter26: partner payouts total — mirrors the admin panel's
                «Партнёрам» KPI (same 50%-of-bike-part math) so the owner can
                cross-check the sheet against the owner/admin page. */}
            {variant === "rentals" && (
              <TotalsTile
                label="Σ Партнёрам"
                value={`${formatMoney(sumPartner)} ₽`}
                T={T}
              />
            )}
            {variant === "rentals" ? (
              <TotalsTile
                label="Σ Экип + Залог"
                value={`${formatMoney(sumEquip + sumDeposit)} ₽`}
                T={T}
              />
            ) : (
              <TotalsTile
                label="Период"
                value={`${formatDateRu(from)} — ${formatDateRu(to)}`}
                T={T}
                small
              />
            )}
          </div>
        )}

        {/* ── Table — horizontal scroll, sticky first column + header ────────── */}
        <div className="flex-1 overflow-auto" style={{ backgroundColor: T.bg }}>
          {loading ? (
            <div className="flex h-full min-h-[200px] items-center justify-center p-8">
              <div className="flex items-center gap-2 text-sm" style={{ color: T.textMuted }}>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Загрузка…
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-8 text-center">
              <div
                className="max-w-md break-words rounded-lg border px-4 py-3 text-sm"
                style={{ color: "#ef4444", borderColor: "#ef444455", backgroundColor: "#ef444410" }}
              >
                {error}
              </div>
              <button
                type="button"
                onClick={() => void loadTable()}
                className="cursor-pointer rounded-lg border px-4 py-2 text-xs font-medium transition hover:opacity-80"
                style={{ borderColor: T.border, color: T.text, backgroundColor: T.bgElevated }}
              >
                Повторить
              </button>
            </div>
          ) : headerRow.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-1 p-8 text-center text-sm" style={{ color: T.textMuted }}>
              <Table2 className="h-8 w-8 opacity-40" aria-hidden />
              <p>Нет данных за выбранный период</p>
              <p className="text-[11px]">Измените диапазон дат выше</p>
            </div>
          ) : dataRows.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-1 p-8 text-center text-sm" style={{ color: T.textMuted }}>
              <Search className="h-6 w-6 opacity-40" aria-hidden />
              <p>Ничего не найдено</p>
              <p className="text-[11px]">Попробуйте другой запрос</p>
            </div>
          ) : (
            <table
              className="w-full border-collapse text-left text-xs"
              style={{ color: T.text, minWidth: "max-content" }}
            >
              <thead className="sticky top-0 z-20">
                {headerRow.map((h, i) => (
                  <th
                    key={i}
                    className="whitespace-nowrap border-b-2 border-r px-2.5 py-2.5 font-semibold"
                    style={{
                      borderColor: T.border,
                      color: T.textMuted,
                      backgroundColor: T.bgElevated,
                      textAlign: numericCols.has(i)
                        ? "right"
                        : dateCols.has(i)
                          ? "center"
                          : "left",
                      // Sticky first column (date) — sticky left + z-index above body cells
                      ...(i === 0
                        ? {
                            position: "sticky",
                            left: 0,
                            zIndex: 21,
                            boxShadow: "2px 0 4px rgba(0,0,0,0.08)",
                          }
                        : {}),
                      // Hidden spacer column
                      ...(hideCols.has(i) ? { minWidth: "0.5rem", padding: "0 0" } : {}),
                    }}
                  >
                    {hideCols.has(i) ? "" : h || "\u00A0"}
                  </th>
                ))}
              </thead>
              <tbody>
                {dataRows.map((r, ri) => {
                  const isAlt = ri % 2 === 1;
                  // iter20: rental rows (hidden uuid present) are tappable —
                  // opens the rental page like the item sheet's «Открыть аренду».
                  const rowRentalId =
                    variant === "rentals" ? (r[RENTALS_ID_COL] || "").trim() : "";
                  const rowClickable = !!rowRentalId && !!slug;
                  return (
                    <tr
                      key={ri}
                      className="transition-colors hover:brightness-95"
                      style={{
                        backgroundColor: isAlt ? T.bgElevated : T.bgCard,
                        ...(rowClickable
                          ? { cursor: "pointer" }
                          : {}),
                      }}
                      onClick={rowClickable ? () => openRentalForRow(r) : undefined}
                      title={rowClickable ? "Открыть аренду" : undefined}
                    >
                      {headerRow.map((_, ci) => {
                        const cell = r[ci] ?? "";
                        const isNum = numericCols.has(ci) && isNumericLike(cell);
                        const isDate = dateCols.has(ci);
                        const isHidden = hideCols.has(ci);
                        if (isHidden) {
                          return (
                            <td
                              key={ci}
                              className="border-b border-r"
                              style={{
                                borderColor: T.border,
                                padding: "0 0",
                                minWidth: "0.5rem",
                                backgroundColor: isAlt ? T.bgElevated : T.bgCard,
                              }}
                            />
                          );
                        }
                        return (
                          <td
                            key={ci}
                            className="border-b border-r px-2.5 py-1.5"
                            title={
                              variant === "rentals" && ci === RENTALS_PHOTOS_COL && cell
                                ? `${cell.split("+")[0]} фото при выдаче + ${cell.split("+")[1] ?? 0} при возврате`
                                : cell
                            }
                            style={{
                              borderColor: T.border,
                              textAlign: isNum ? "right" : isDate ? "center" : "left",
                              // iter20: «Заметки» wraps (long operator notes) and
                              // «Субарендатор» gets a soft amber tint; «Фото» shows
                              // a camera glyph — green when photos exist.
                              whiteSpace:
                                variant === "rentals" && ci === RENTALS_NOTES_COL
                                  ? "normal"
                                  : "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth:
                                isDate ? "8rem"
                                : variant === "rentals" && ci === RENTALS_NOTES_COL ? "16rem"
                                : variant === "rentals" && (ci === RENTALS_SUBRENTER_COL || ci === RENTALS_PHOTOS_COL) ? "10rem"
                                : undefined,
                              fontVariantNumeric: isNum ? "tabular-nums" : undefined,
                              ...(variant === "rentals" && ci === RENTALS_SUBRENTER_COL && cell
                                ? { color: "#f59e0b" }
                                : {}),
                              ...(variant === "rentals" && ci === RENTALS_PHOTOS_COL && cell
                                ? { color: "#22c55e", fontWeight: 600 }
                                : {}),
                              // Sticky first column — same bg as row, with shadow
                              ...(ci === 0
                                ? {
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 10,
                                    boxShadow: "2px 0 4px rgba(0,0,0,0.06)",
                                    backgroundColor: isAlt ? T.bgElevated : T.bgCard,
                                  }
                                : {}),
                            }}
                          >
                            {variant === "rentals" && ci === RENTALS_PHOTOS_COL && cell ? (
                              <span className="inline-flex items-center gap-1">
                                <Camera className="h-3 w-3" aria-hidden />
                                {cell}
                              </span>
                            ) : (
                              cell || "\u00A0"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {totalsRow && (
                  <tr style={{ backgroundColor: T.bgElevated }}>
                    {headerRow.map((_, ci) => {
                      const isHidden = hideCols.has(ci);
                      if (isHidden) {
                        return (
                          <td
                            key={ci}
                            className="border-t-2 border-r"
                            style={{
                              borderColor: T.border,
                              padding: "0 0",
                              minWidth: "0.5rem",
                              backgroundColor: T.bgElevated,
                            }}
                          />
                        );
                      }
                      const cell = totalsRow[ci] ?? "";
                      const isNum = numericCols.has(ci) && isNumericLike(cell);
                      return (
                        <td
                          key={ci}
                          className="whitespace-nowrap border-t-2 border-r px-2.5 py-2.5 font-bold"
                          style={{
                            borderColor: T.border,
                            textAlign: isNum ? "right" : dateCols.has(ci) ? "center" : "left",
                            fontVariantNumeric: isNum ? "tabular-nums" : undefined,
                            color: T.text,
                            position: ci === 0 ? "sticky" : undefined,
                            left: ci === 0 ? 0 : undefined,
                            zIndex: ci === 0 ? 10 : undefined,
                            boxShadow: ci === 0 ? "2px 0 4px rgba(0,0,0,0.06)" : undefined,
                          }}
                        >
                          {cell || "\u00A0"}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer — count + range + status pill ──────────────────────────── */}
        {!loading && !error && headerRow.length > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11px]"
            style={{ borderColor: T.border, color: T.textMuted, background: T.bgElevated }}
          >
            <span className="tabular-nums">
              {dataRows.length}
              {totalsRow ? " + итоги" : ""} строк
            </span>
            {/* iter20: tap-through affordance — rental rows open the rental page */}
            {variant === "rentals" && slug && dataRows.length > 0 && (
              <span className="text-[10px] opacity-80">
                Нажмите на строку — откроется страница аренды (фото, депозит, передача)
              </span>
            )}
            <span className="tabular-nums">
              {formatDateRu(from)} — {formatDateRu(to)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small sub-component for the totals card tiles ─────────────────────────
function TotalsTile({
  label,
  value,
  T,
  accent = false,
  small = false,
}: {
  label: string;
  value: string;
  T: ThemeTokens;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="px-3 py-2"
      style={{ backgroundColor: T.bgCard }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-wide"
        style={{ color: T.textMuted }}
      >
        {label}
      </div>
      <div
        className={`mt-0.5 font-bold tabular-nums ${small ? "text-[11px]" : "text-sm"}`}
        style={{ color: accent ? T.accent : T.text }}
      >
        {value}
      </div>
    </div>
  );
}
