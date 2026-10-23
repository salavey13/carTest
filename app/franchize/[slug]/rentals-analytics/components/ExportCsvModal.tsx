"use client";

// /analytics/components/ExportCsvModal.tsx
//
// FIX (F9 iter3, polished iter4): the "Export CSV" button opens a TABLE VIEW
// (same columns as the CSV file). The user can scroll the table horizontally
// on mobile, change the date range at the top, search/filter rows, send the
// file to their Telegram chat, or download it as CSV.
//
// iter52 (2026-10-07, boss request): the rentals sheet is BLOCK-structured —
// the builder (lib/csv-builders/rentals-csv.ts) now emits separate
// «АРЕНДЫ / ЭКИП / СЕРВИС / ПРОДАЖИ / СВОДКА» blocks, and this modal renders
// each block as its own titled table with its own «Итого» row. The totals
// card shows per-block revenue (аренды/экип/сервис/продажи отдельно) + the
// operator salary (ЗП аренды + ЗП продажи; gear & service pay no bonus).
// Legacy flat sheets (sales variant, old exports) fall back to the original
// single-grid rendering.
//
// Task 127 (2026-10-23, boss):
//   1. Verification row tints are now THEME-PROOF: they mix the tone color
//      into the theme's own card bg (color-mix) — light theme keeps its pastel
//      rows, dark theme gets a DARK tint so white body text stays readable
//      (the old hardcoded pastels washed out white text in dark).
//   2. The whole modal panel clears the Telegram fullscreen native buttons
//      (useTelegramContentSafeTop) — the header «x» no longer hides under
//      them; closing always reachable.
//   3. When ≥2 operators carry ЗП this period, a «ЗП по операторам» strip
//      splits the commissions (who has how much of the total + %), and table
//      rows get the operator's stable emoji marker (date cell + op cell).
//
// Task 128 (2026-10-23, boss):
//   1. Tap a split pill → the table filters to that operator's rows
//      (АРЕНДЫ + ПРОДАЖИ blocks; tap again / «показать всех» → back). The
//      split itself reads the PRE-filter sections, so the pills stay
//      tappable — you can hop between operators without unfiltering.
//   2. Quick verify right in the table: owner-tier viewers get a ✓ on every
//      unverified АРЕНДЫ row — confirm → adminVerifyRentalAction (the same
//      server action as the rental-page card) → optimistic «подтверждено»
//      tint + a silent CSV refetch for the canonical label. The October
//      never-verified sweep is now «filter ➕ без сверки → ✓ ✓ ✓».

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Download, Loader2, Send, Search, Table2, Camera, Check } from "lucide-react";
import { toast } from "sonner";
// Task 128 — same owner-gated action the rental-page verification card uses.
import { adminVerifyRentalAction } from "@/app/franchize/server-actions/rental-verify-actions";
import type { ThemeTokens } from "../hooks/useTheme";
import { toNumber } from "./lib/csv-money";
// Task 127 — fullscreen TG native buttons (close/expand) overlay the top-right
// corner; without this the header «x» sits right under them.
import { useTelegramContentSafeTop } from "@/app/franchize/hooks/useTelegramContentSafeTop";
// Task 127 — per-operator commission split + stable emoji identities.
import {
  buildOperatorSplit,
  operatorIconOf,
  operatorColorOf,
  type OperatorSplitEntry,
} from "./lib/operator-split";
import {
  parseCsvSections,
  pluralBlocksRu,
  type CsvSectionKey,
  type ParsedCsvSection,
} from "@/lib/csv-builders/rentals-csv-sections";

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fetch CSV text for the given range — used to render the in-modal table. */
  fetchCsvText?: (from: string, to: string) => Promise<string>;
  /** Trigger the actual file download (blob + anchor / TG fallback). */
  onExport: (from: string, to: string) => Promise<void>;
  /** Send-to-Telegram button next to download — fires `onSendTelegram` */
  onSendTelegram?: (from: string, to: string) => Promise<void>;
  /** Theme tokens (useTheme) */
  T: ThemeTokens;
  /** "rentals" renders the block-structured sheet; "sales" the 5-col sheet */
  variant?: "rentals" | "sales";
  /** Crew slug — powers the rental-row tap-through (АРЕНДЫ block). */
  slug?: string;
  /** Task 127 — dark theme ⇒ brighter verification tone text. Optional: when
   *  the caller can't know (CSS-var themes) the light tones are kept — the
   *  row tints stay theme-proof either way (they derive from the theme bg). */
  isDark?: boolean;
  /** Task 128 — viewer passed the owner-tier gate (owner/admin/co_owner):
   *  unverified АРЕНДЫ rows get an inline ✓ quick-verify button. The server
   *  action re-gates, this only decides whether the button renders. */
  canVerify?: boolean;
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateRu(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m ? `${d}.${m}.${y}` : iso;
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

// ── Legacy single-grid column kinds (fallback + sales variant) ──────────────
const RENTALS_NUMERIC_COLS = new Set([1, 3, 4, 5, 8, 9, 15]);
const RENTALS_DATE_COLS = new Set([0, 12]);
const RENTALS_HIDE_COLS = new Set([7, 20]);
const RENTALS_NOTES_COL = 17;
const RENTALS_SUBRENTER_COL = 18;
const RENTALS_PHOTOS_COL = 19;
const RENTALS_ID_COL = 20;
const SALES_NUMERIC_COLS = new Set([3]);
const SALES_DATE_COLS = new Set([0]);

// ── Block-section column kinds (iter52) ─────────────────────────────────────
// Column indexes per block of the new sheet layout (builder: rentals-csv.ts):
//   АРЕНДЫ  (25): Дата, ЗП Аренда, Партнеру, Цена, Экип, Залог, Марка,
//                 Пробег до, Пробег после, Время, Комментарий, Заметки,
//                 Субарендатор, Фото, ID, ЗП техника, ЗП экип, ЗП наценка,
//                 Экип флаги, Оператор создал, Оператор выдал, Оператор
//                 принял, Оператор (ЗП), Атрибуция ЗП, Верификация
//   ЭКИП     (7): Дата, Наименование, Цена, Выдал, Принял, Комментарий, ID
//   СЕРВИС   (5): Дата, Услуга, Байк, Цена, ID
//   ПРОДАЖИ  (8): Дата, ЗП Продажа, Наименование, Цена, Комментарий, ID,
//                 Оператор (ЗП), Атрибуция ЗП
//   СВОДКА   (5): Блок, Записей, Выручка, ЗП, Примечание
interface SectionColCfg {
  numeric: Set<number>;
  date: Set<number>;
  hide: Set<number>;
  notes?: number;
  subrenter?: number;
  photos?: number;
  /** Task 124 — «Верификация» column (АРЕНДЫ only): colored + tints the row. */
  verification?: number;
  /** Task 127 — «Оператор (ЗП)» column: powers the commission split + row
   *  emoji markers (АРЕНДЫ col 22, ПРОДАЖИ col 6 in the new sheet layout). */
  opCol?: number;
  /** Rental uuid column for the row tap-through (АРЕНДЫ only). */
  idCol: number;
}

const SECTION_COLS: Record<CsvSectionKey, SectionColCfg> = {
  rentals: {
    numeric: new Set([1, 3, 4, 5, 7, 8]),
    date: new Set([0]),
    hide: new Set([14]),
    notes: 11,
    subrenter: 12,
    photos: 13,
    verification: 24,
    opCol: 22,
    idCol: 14,
  },
  equipment: { numeric: new Set([2]), date: new Set([0]), hide: new Set([6]), idCol: -1 },
  service: { numeric: new Set([3]), date: new Set([0]), hide: new Set([4]), idCol: -1 },
  sales: { numeric: new Set([1, 3]), date: new Set([0]), hide: new Set([5]), opCol: 6, idCol: -1 },
  summary: { numeric: new Set([1, 2, 3]), date: new Set(), hide: new Set(), idCol: -1 },
};

/** Section accent colors — quick visual block separation. */
const SECTION_ACCENT: Record<CsvSectionKey, string> = {
  rentals: "#3b82f6",
  equipment: "#f59e0b",
  service: "#8b5cf6",
  sales: "#22c55e",
  summary: "#6b7280",
};

function isNumericLike(s: string): boolean {
  if (!s) return false;
  const t = s.trim().replace(/\s+/g, "").replace(",", ".").replace(/[₽$€]/g, "");
  return t !== "" && !Number.isNaN(Number(t));
}

// ── Task 124 — verification status coloring (mirrors the XLSX converter) ────
// The «Верификация» column (АРЕНДЫ block) renders colored + the whole row
// gets a light tint, so the operator's eye lands on what is still unverified.
type VerTone = "verified" | "disputed" | "waiting" | null;
type VerFilterKey = "all" | Exclude<VerTone, null> | "none";
function verificationToneOf(label: string): VerTone {
  const s = (label || "").toLowerCase();
  if (!s.trim()) return null;
  if (s.includes("спор")) return "disputed";
  if (s.includes("подтверждено")) return "verified";
  if (s.includes("ждёт") || s.includes("ожидает")) return "waiting";
  return null;
}
const VER_TONE_FG: Record<Exclude<VerTone, null>, string> = {
  verified: "#16a34a",
  disputed: "#dc2626",
  waiting: "#d97706",
};
// Task 127 — dark theme reads better with brighter tone text (the light-theme
// greens/reds are tuned for pastel-on-white and go muted on dark tints).
const VER_TONE_FG_DARK: Record<Exclude<VerTone, null>, string> = {
  verified: "#4ade80",
  disputed: "#f87171",
  waiting: "#fbbf24",
};

// Task 127 — THEME-PROOF row tints. The old hardcoded pastel hexes sit
// on white and washed out in the dark theme: pastel bg + white body text ≈
// white-on-white. Now the tint MIXES the tone color into the theme's own base:
//   light (white card)  → the same familiar pastels as before (~13% over white);
//   dark (near-black)   → a DARK tint — white body text stays readable.
const VER_TONE_TINT_PCT: Record<Exclude<VerTone, null>, number> = {
  verified: 14,
  disputed: 13,
  waiting: 12,
};
const verToneBg = (tone: Exclude<VerTone, null>, base: string): string =>
  `color-mix(in srgb, ${VER_TONE_FG[tone]} ${VER_TONE_TINT_PCT[tone]}%, ${base})`;
const verToneFg = (tone: Exclude<VerTone, null>, isDark?: boolean): string =>
  isDark ? VER_TONE_FG_DARK[tone] : VER_TONE_FG[tone];

export function ExportCsvModal({
  isOpen,
  onClose,
  fetchCsvText,
  onExport,
  onSendTelegram,
  T,
  variant = "rentals",
  slug,
  isDark,
  canVerify = false,
}: ExportCsvModalProps) {
  const router = useRouter();
  // Task 127 — px of the TG fullscreen native-buttons zone (exact measurement
  // on Bot API 8.0+, the app-wide 54px comfort floor on mobile otherwise,
  // 0 outside Telegram / on wide viewports). Pushes the header — and its
  // top-right «x» — below the overlapped corner.
  const tgSafeTop = useTelegramContentSafeTop();
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Task 126 — «что не сверено» одним тапом: фильтр по колонке «Верификация»
  // (АРЕНДЫ блок). Chips double as the legend for the row tints. «none» =
  // пустая ячейка — аренды, по которым сверка ещё не заводилась.
  const [verFilter, setVerFilter] = useState<VerFilterKey>("all");
  // Task 128 — tap a split pill → filter the table to that operator's ЗП
  // rows (АРЕНДЫ + ПРОДАЖИ). null = no filter (all operators).
  const [opFilter, setOpFilter] = useState<string | null>(null);
  // Task 128 — quick-verify bookkeeping: ids with an in-flight action (the ✓
  // shows a spinner) and ids verified THIS session (optimistic «подтверждено»
  // tint until the silent CSV refetch brings the canonical label).
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(() => new Set());
  const [justVerified, setJustVerified] = useState<Set<string>>(() => new Set());

  const loadTable = useCallback(async (opts?: { silent?: boolean }) => {
    if (!fetchCsvText || !from || !to || from > to) return;
    // Task 128 — silent mode: a quick-verify just landed server-side; swap in
    // the regenerated CSV WITHOUT the loading flash (rows stay on screen).
    // A silent failure keeps the old rows — the optimistic tint may linger,
    // but the verify itself DID succeed (the action returned success).
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const text = await fetchCsvText(from, to);
      setRows(parseCsv(text));
    } catch (e) {
      // FIX (iter6): show the ACTUAL error next to the generic message so the
      // operator can tell a 500 from an offline device from a bad date range.
      const detail = e instanceof Error ? e.message : String(e);
      if (silent) {
        console.warn("[ExportCsvModal] silent refetch failed:", detail);
      } else {
        setError(`Не удалось загрузить данные — ${detail}`);
        setRows([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchCsvText, from, to]);

  // Task 128 — quick verify from the table view. Same action, same confirm
  // pattern and same toasts as the rental-page CommissionVerificationCard —
  // only the entry point is different (a ✓ inside the «Верификация» cell).
  const handleQuickVerify = useCallback(
    async (rentalId: string) => {
      if (!slug || verifyingIds.has(rentalId)) return;
      const ok = window.confirm(
        "Подтвердить сверку по этой аренде?\n\nСтрока будет помечена «подтверждено» для оператора и владельца (используйте после личной сверки).",
      );
      if (!ok) return;
      setVerifyingIds((prev) => new Set(prev).add(rentalId));
      try {
        const res = await adminVerifyRentalAction({ slug, rentalId });
        if (res.success) {
          toast.success("Сверка подтверждена ✅");
          setJustVerified((prev) => new Set(prev).add(rentalId));
          void loadTable({ silent: true });
        } else {
          toast.error(res.error || "Не удалось подтвердить сверку");
        }
      } catch {
        toast.error("Не удалось подтвердить сверку");
      } finally {
        setVerifyingIds((prev) => {
          const next = new Set(prev);
          next.delete(rentalId);
          return next;
        });
      }
    },
    [slug, verifyingIds, loadTable],
  );
  // Owner-tier + rentals variant + a slug to act through — otherwise the ✓
  // never renders (sales sheets, password viewers, non-owner crew). The
  // server action re-gates anyway — this is presentation only.
  const canQuickVerify = canVerify && variant === "rentals" && !!slug;

  useEffect(() => {
    if (isOpen) {
      setFrom(firstDayOfMonthIso());
      setTo(todayIso());
      setRows([]);
      setError(null);
      setDownloading(false);
      setSending(false);
      setQuery("");
      setVerFilter("all");
      setOpFilter(null);
      setVerifyingIds(new Set());
      setJustVerified(new Set());
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

  // ── Block-section model (iter52) ──────────────────────────────────────────
  const parsedSections = parseCsvSections(rows);
  const isSectioned = variant === "rentals" && !parsedSections.legacy && parsedSections.sections.length > 0;

  // Task 126 — verification filter: counts from the UNFILTERED rentals block
  // (the chips are also the legend — they answer «сколько чего»), applied
  // only to the АРЕНДЫ rows; other blocks keep every row.
  const verCol = SECTION_COLS.rentals.verification ?? 24;
  const rentalsSectionRaw = isSectioned
    ? parsedSections.sections.find((s) => s.key === "rentals")
    : undefined;
  const verCounts = (() => {
    const c = { all: 0, verified: 0, waiting: 0, disputed: 0, none: 0 };
    for (const r of rentalsSectionRaw?.data ?? []) {
      c.all += 1;
      const tone = verificationToneOf(r[verCol] || "");
      if (tone) c[tone] += 1;
      else c.none += 1;
    }
    return c;
  })();
  const applyVerFilter = (s: ParsedCsvSection): ParsedCsvSection => {
    if (verFilter === "all" || s.key !== "rentals") return s;
    return {
      ...s,
      data: s.data.filter((r) => (verificationToneOf(r[verCol] || "") ?? "none") === verFilter),
      // Filtered sums would not match the full-period СВОДКА block — hide them.
      totals: null,
    };
  };

  const q = query.trim().toLowerCase();
  const applyFilter = (s: ParsedCsvSection): ParsedCsvSection => {
    if (!q) return s;
    // While filtering, hide the «Итого» rows — their sums would not match
    // the filtered subset and would mislead.
    return {
      ...s,
      data: s.data.filter((r) => r.some((c) => (c || "").toLowerCase().includes(q))),
      totals: null,
    };
  };

  // Task 128 — sumCell lives BEFORE the split block: the pill strip needs the
  // PRE-op-filter sums before visibleSections exists.
  const sumCell = (section: ParsedCsvSection | undefined, col: number): number =>
    !section || col < 0 ? 0 : section.data.reduce((acc, r) => acc + toNumber(r[col] || ""), 0);

  // Task 128 — the split reads the PRE-op-filter sections (text + ver filters
  // applied, operator filter NOT): pills stay tappable while a filter is on —
  // you can hop between operators without unfiltering first. With no operator
  // filter this is byte-for-byte the old behaviour (preOp === visible).
  const preOpSections = isSectioned
    ? parsedSections.sections.map(applyFilter).map(applyVerFilter)
    : [];
  const rentPre = preOpSections.find((s) => s.key === "rentals");
  const salesPre = preOpSections.find((s) => s.key === "sales");
  const opGrandTotal = sumCell(rentPre, 1) + sumCell(salesPre, 1);

  // Task 127 — per-operator commission split (grouped client-side from the
  // builder's attribution columns — same chain as the profile math).
  const opSplit: OperatorSplitEntry[] = (() => {
    if (!isSectioned) return [];
    const entries: { label: string; amount: number }[] = [];
    for (const s of preOpSections) {
      const cfg = SECTION_COLS[s.key];
      // Only blocks that both pay and attribute ЗП (АРЕНДЫ, ПРОДАЖИ).
      if (cfg.opCol == null || s.key === "summary") continue;
      for (const r of s.data) {
        const label = (r[cfg.opCol] || "").trim();
        if (!label) continue;
        entries.push({ label, amount: toNumber(r[1] || "") });
      }
    }
    return buildOperatorSplit(entries, opGrandTotal);
  })();

  // Task 128 — tap a split pill → the table filters to that operator's ЗП
  // rows (АРЕНДЫ + ПРОДАЖИ — the blocks that both pay and attribute). Tap the
  // active pill again / the «показать всех» chip → back to everyone. The
  // guard keeps a stale label (date range changed) from blanking the table.
  const effectiveOpFilter =
    opFilter && opSplit.some((o) => o.label === opFilter) ? opFilter : null;
  const applyOpFilter = (s: ParsedCsvSection): ParsedCsvSection => {
    if (!effectiveOpFilter) return s;
    const cfg = SECTION_COLS[s.key];
    // Blocks without operator attribution (ЭКИП / СЕРВИС / СВОДКА) pass through.
    if (cfg.opCol == null || s.key === "summary") return s;
    return {
      ...s,
      data: s.data.filter((r) => (r[cfg.opCol] || "").trim() === effectiveOpFilter),
      // Filtered sums would not match the full-period СВОДКА block — hide them.
      totals: null,
    };
  };

  // Empty blocks (no data this period) are hidden entirely — the СВОДКА
  // block still reports their zero totals.
  const visibleSections = preOpSections.map(applyOpFilter).filter((s) => s.data.length > 0);
  const secByKey = (key: CsvSectionKey) => visibleSections.find((s) => s.key === key);
  // iter53: value of a named data row inside the СВОДКА block (e.g. «Экип»
  // Выручка). Returns null when the block/row/cell is absent — caller falls
  // back to the legacy row-sum path.
  const summaryRowValue = (rowLabel: string, col: number): number | null => {
    const summary = secByKey("summary");
    if (!summary) return null;
    const row = summary.data.find((r) => (r[0] || "").trim().toLowerCase() === rowLabel.toLowerCase());
    if (!row) return null;
    const cell = (row[col] || "").trim();
    return cell === "" ? null : toNumber(cell);
  };
  const rentSec = secByKey("rentals");
  const equipSec = secByKey("equipment");
  const svcSec = secByKey("service");
  const salesSec = secByKey("sales");
  const sumRentPrice = sumCell(rentSec, 3);
  const sumRentSalary = sumCell(rentSec, 1);
  // iter53: ЭКИП rows now carry справочные prices for 0-cost docs (iter53
  // builder change), so the tile reads the REAL accounting Σ from the СВОДКА
  // block («Экип» row, Выручка column) and only falls back to the row sum for
  // legacy files without a СВОДКА block. Keeps the tile double-count-free.
  const sumEquipPrice = summaryRowValue("Экип", 2) ?? sumCell(equipSec, 2);
  const sumSvcPrice = sumCell(svcSec, 3);
  const sumSalesPrice = sumCell(salesSec, 3);
  const sumSalesSalary = sumCell(salesSec, 1);
  const dataRowCount =
    visibleSections.reduce((acc, s) => acc + (s.key === "summary" ? 0 : s.data.length), 0);

  const formatMoney = (n: number): string =>
    n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

  // Task 127/128 — split pills render only when the period actually has
  // SEVERAL operators (pre-op-filter view) — with one operator the plain
  // «Σ ЗП» tile already tells the whole story.
  const showOpSplit = opSplit.length >= 2;
  const opAttributed = opSplit.reduce((acc, o) => acc + o.amount, 0);
  const opUnattributed = Math.max(0, opGrandTotal - opAttributed);
  // Row emoji markers ride with the split: with a single operator every row
  // would wear the same icon — noise instead of information.
  const showOpMarkers = showOpSplit;

  // ── Legacy single-grid values (sales variant / old flat sheets) ───────────
  const headerRow = rows[0] ?? [];
  const bodyRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  const totalsRowIdx = bodyRows.findIndex((r) =>
    r.some((c) => c.trim().toLowerCase().startsWith("итого")),
  );
  const dataRowsAll = totalsRowIdx === -1 ? bodyRows : bodyRows.slice(0, totalsRowIdx);
  const totalsRow = totalsRowIdx === -1 ? null : bodyRows[totalsRowIdx];
  const dataRows = !q
    ? dataRowsAll
    : dataRowsAll.filter((r) => r.some((c) => (c || "").toLowerCase().includes(q)));

  const numericCols = variant === "rentals" ? RENTALS_NUMERIC_COLS : SALES_NUMERIC_COLS;
  const dateCols = variant === "rentals" ? RENTALS_DATE_COLS : SALES_DATE_COLS;
  const hideCols = variant === "rentals" ? RENTALS_HIDE_COLS : new Set<number>();
  const visibleColCount = Math.max(headerRow.length - hideCols.size, 0);

  const openRentalById = (rentalId: string) => {
    if (!slug) return;
    router.push(`/franchize/${slug}/rental/${rentalId}`);
  };
  const openRentalForRow = (row: string[]) => {
    if (variant !== "rentals") return;
    const rentalId = (row[RENTALS_ID_COL] || "").trim();
    if (rentalId) openRentalById(rentalId);
  };

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

  const colAlign = (i: number): React.CSSProperties => ({
    textAlign: numericCols.has(i) ? "right" : dateCols.has(i) ? "center" : "left",
  });

  // PORTAL FIX (2026-09-13): the analytics page is wrapped in FranchizePageShell
  // whose card has `backdrop-blur` — a containing block for position:fixed
  // descendants in Chromium. Inline rendering trapped this full-screen modal
  // inside the card box (backdrop covered the viewport, the panel sat below
  // the fold). Portal to document.body — same treatment as AnalyticsMobileSheet.
  // Line's `if (!isOpen) return null` guarantees client-only evaluation.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      onClick={downloading || sending ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр таблицы и экспорт CSV"
    >
      <div
        className="flex h-full w-full flex-col sm:h-auto sm:max-h-[88vh] sm:max-w-5xl border shadow-2xl overflow-hidden sm:rounded-2xl"
        // Task 127 — the panel starts BELOW the TG fullscreen native buttons:
        // the header row (and its top-right «x») can no longer hide under them.
        style={{
          backgroundColor: T.bgCard,
          borderColor: T.border,
          ...(tgSafeTop > 0 ? { paddingTop: `${tgSafeTop}px` } : {}),
        }}
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
                {isSectioned
                  ? pluralBlocksRu(visibleSections.filter((s) => s.key !== "summary").length)
                  : variant === "sales"
                    ? "5 столбцов"
                    : `${visibleColCount} столбцов`}
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
                  // Task 124 — verification highlight only exists in the rentals
                  // variant (sales have no сверка column).
                  title={variant === "rentals" ? "Отправить XLSX в Telegram (подсветка сверки)" : "Отправить XLSX в Telegram"}
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
                aria-label="Скачать видимые данные в XLSX"
                title={variant === "rentals" ? "Скачать XLSX (подсветка сверки)" : "Скачать XLSX"}
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

        {/* ── Totals card — per-block revenue + operator salary (iter52) ─────── */}
        {!loading && !error && isSectioned && visibleSections.length > 0 && (
          <div
            className="grid grid-cols-2 gap-px border-b sm:grid-cols-3 lg:grid-cols-6"
            style={{
              borderColor: T.border,
              backgroundColor: T.border,
            }}
          >
            <TotalsTile label="Записей" value={String(dataRowCount)} T={T} />
            <TotalsTile label="Σ Аренды" value={`${formatMoney(sumRentPrice)} ₽`} T={T} accent />
            <TotalsTile label="Σ Экип" value={`${formatMoney(sumEquipPrice)} ₽`} T={T} />
            <TotalsTile label="Σ Сервис" value={`${formatMoney(sumSvcPrice)} ₽`} T={T} />
            <TotalsTile label="Σ Продажи" value={`${formatMoney(sumSalesPrice)} ₽`} T={T} />
            <TotalsTile
              label="Σ ЗП (аренда + продажа)"
              value={`${formatMoney(sumRentSalary + sumSalesSalary)} ₽`}
              T={T}
            />
          </div>
        )}
        {!loading && !error && !isSectioned && headerRow.length > 0 && (
          <div
            className={variant === "rentals" ? "grid grid-cols-2 gap-px border-b sm:grid-cols-5" : "grid grid-cols-2 gap-px border-b sm:grid-cols-4"}
            style={{
              borderColor: T.border,
              backgroundColor: T.border,
            }}
          >
            <TotalsTile label="Записей" value={String(dataRows.length)} T={T} />
            <TotalsTile label="Σ Цена" value={`${formatMoney(sumPrice)} ₽`} T={T} accent />
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

        {/* ── ЗП по операторам (Task 127) — who has how much of the total ──────
            Rendered only when ≥2 operators carry ЗП this period; with one
            operator the «Σ ЗП» tile above already tells the whole story.
            Empty-label rows are surfaced as «без атрибуции» so the pills
            always reconcile against the tile.
            Task 128: pills are TOGGLE FILTERS — tap one to show only that
            operator's rows (АРЕНДЫ + ПРОДАЖИ), tap again or «показать всех»
            to reset. The strip reads the pre-filter sections, so it stays
            stable (and switchable) while a filter is on. */}
        {!loading && !error && showOpSplit && (
          <div
            className="border-b px-3 py-2"
            style={{ borderColor: T.border, backgroundColor: T.bg }}
            role="group"
            aria-label="Комиссии по операторам"
          >
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
              <span
                className="text-[10px] font-medium uppercase tracking-wide"
                style={{ color: T.textMuted }}
              >
                ЗП по операторам
              </span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: T.text }}>
                {formatMoney(opGrandTotal)} ₽
              </span>
              {opUnattributed > 0.5 && (
                <span className="text-[10px] tabular-nums" style={{ color: T.textMuted }}>
                  · без атрибуции {formatMoney(opUnattributed)} ₽
                </span>
              )}
              {effectiveOpFilter && (
                <span className="text-[10px]" style={{ color: T.textMuted }}>
                  · таблица показывает только строки выбранного оператора
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {opSplit.map((op) => {
                const opActive = effectiveOpFilter === op.label;
                return (
                  <button
                    key={op.label}
                    type="button"
                    onClick={() => setOpFilter((cur) => (cur === op.label ? null : op.label))}
                    aria-pressed={opActive}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90 focus:outline-none focus-visible:ring-2"
                    style={{
                      borderColor: opActive ? op.color : `color-mix(in srgb, ${op.color} 45%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${op.color} ${opActive ? 26 : 14}%, ${T.bgCard})`,
                      color: T.text,
                      // Task 128 — the active filter pill gets a firm ring:
                      // discoverable on both themes without shouting.
                      boxShadow: opActive ? `0 0 0 1.5px color-mix(in srgb, ${op.color} 55%, transparent)` : undefined,
                    }}
                    title={
                      opActive
                        ? `${op.label} — фильтр активен, нажмите чтобы снова показать всех`
                        : `${op.label} — ${formatMoney(op.amount)} ₽ из ${formatMoney(opGrandTotal)} ₽ · показать только его строки`
                    }
                  >
                    <span aria-hidden>{op.icon}</span>
                    <span
                      className="max-w-[10rem] truncate"
                      style={{ color: op.color }}
                    >
                      {op.label}
                    </span>
                    <span className="tabular-nums">{formatMoney(op.amount)} ₽</span>
                    <span className="tabular-nums opacity-60">{Math.round(op.share * 100)}%</span>
                  </button>
                );
              })}
              {effectiveOpFilter && (
                <button
                  type="button"
                  onClick={() => setOpFilter(null)}
                  className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 focus:outline-none focus-visible:ring-2"
                  style={{ borderColor: T.border, backgroundColor: T.bgElevated, color: T.text }}
                  title="Показать строки всех операторов"
                >
                  ✕ показать всех
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Сверка filter chips (Task 126) — legend + one-tap «что не сверено» ── */}
        {!loading && !error && isSectioned && (rentalsSectionRaw?.data.length ?? 0) > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2"
            style={{ borderColor: T.border, backgroundColor: T.bg }}
            role="group"
            aria-label="Фильтр по сверке"
          >
            <span className="mr-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: T.textMuted }}>
              Сверка:
            </span>
            {([
              { key: "all" as const, label: "Все", count: verCounts.all, fg: T.text, bg: "transparent" },
              { key: "verified" as const, label: "✅ сверены", count: verCounts.verified, fg: verToneFg("verified", isDark), bg: verToneBg("verified", T.bgElevated) },
              { key: "waiting" as const, label: "⏳ ждут", count: verCounts.waiting, fg: verToneFg("waiting", isDark), bg: verToneBg("waiting", T.bgElevated) },
              { key: "disputed" as const, label: "⚠️ споры", count: verCounts.disputed, fg: verToneFg("disputed", isDark), bg: verToneBg("disputed", T.bgElevated) },
              { key: "none" as const, label: "➕ без сверки", count: verCounts.none, fg: T.textMuted, bg: T.bgElevated },
            ]).map((chip) => {
              const active = verFilter === chip.key;
              const dim = chip.count === 0;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setVerFilter(chip.key)}
                  aria-pressed={active}
                  disabled={dim && !active}
                  className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-45"
                  style={{
                    borderColor: active ? chip.fg : T.border,
                    backgroundColor: active ? (chip.key === "all" ? T.bgElevated : chip.bg) : "transparent",
                    color: chip.fg,
                    fontVariantNumeric: "tabular-nums",
                  }}
                  title={
                    chip.key === "all"
                      ? "Показать все аренды периода"
                      : chip.key === "none"
                        ? "Аренды без сверки — по ним комиссия ещё не подтверждалась"
                        : `Только строки: ${chip.label}`
                  }
                >
                  {chip.label}
                  <span className="opacity-80">{chip.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Table(s) — horizontal scroll, sticky first column + header ─────── */}
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
          ) : isSectioned ? (
            visibleSections.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-1 p-8 text-center text-sm" style={{ color: T.textMuted }}>
                <Search className="h-6 w-6 opacity-40" aria-hidden />
                <p>Ничего не найдено</p>
                <p className="text-[11px]">Попробуйте другой запрос</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-2 sm:p-3">
                {visibleSections.map((s) => (
                  <SectionTable
                    key={s.key}
                    section={s}
                    T={T}
                    slug={slug}
                    isDark={isDark}
                    showOpMarkers={showOpMarkers}
                    onOpenRental={openRentalById}
                    verifyingIds={verifyingIds}
                    justVerified={justVerified}
                    onQuickVerify={canQuickVerify ? handleQuickVerify : undefined}
                  />
                ))}
              </div>
            )
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
        {!loading && !error && (isSectioned ? visibleSections.length > 0 : headerRow.length > 0) && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11px]"
            style={{ borderColor: T.border, color: T.textMuted, background: T.bgElevated }}
          >
            <span className="tabular-nums">
              {isSectioned
                ? `${dataRowCount} строк · итоги в каждом блоке`
                : `${dataRows.length}${totalsRow ? " + итоги" : ""} строк`}
            </span>
            {/* iter20: tap-through affordance — rental rows open the rental page */}
            {variant === "rentals" && slug && (isSectioned ? dataRowCount > 0 : dataRows.length > 0) && (
              <span className="text-[10px] opacity-80">
                Нажмите на строку аренды — откроется страница аренды (фото, депозит, передача)
              </span>
            )}
            <span className="tabular-nums">
              {formatDateRu(from)} — {formatDateRu(to)}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Block-section table (iter52) ─────────────────────────────────────────────
// One titled block: colored banner + its own column header + data rows +
// «Итого …» footer. АРЕНДЫ rows are tap-through (rental uuid in the hidden
// ID column). Task 128: unverified АРЕНДЫ rows get an inline ✓ quick-verify
// button (owner-tier only) — confirm → server action → optimistic tint +
// silent refetch.
function SectionTable({
  section,
  T,
  slug,
  isDark,
  showOpMarkers = false,
  onOpenRental,
  verifyingIds,
  justVerified,
  onQuickVerify,
}: {
  section: ParsedCsvSection;
  T: ThemeTokens;
  slug?: string;
  isDark?: boolean;
  showOpMarkers?: boolean;
  onOpenRental: (rentalId: string) => void;
  /** Task 128 — ids with an in-flight verify (the ✓ shows a spinner). */
  verifyingIds?: Set<string>;
  /** Task 128 — ids verified this session (optimistic verified tint). */
  justVerified?: Set<string>;
  /** Task 128 — present only for owner-tier viewers (rentals variant). */
  onQuickVerify?: (rentalId: string) => Promise<void> | void;
}) {
  const cfg = SECTION_COLS[section.key];
  const accent = SECTION_ACCENT[section.key];
  const isSummary = section.key === "summary";

  return (
    <section>
      {/* Block banner */}
      <div
        className="sticky top-0 z-20 flex items-center gap-2 rounded-t-lg px-3 py-2 text-xs font-bold uppercase tracking-wide"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, ${T.bgElevated})`, color: accent }}
      >
        {section.title}
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 20%, transparent)` }}
        >
          {section.data.length}
        </span>
      </div>

      <table
        className="w-full border-collapse text-left text-xs"
        style={{ color: T.text, minWidth: "max-content" }}
      >
        <thead>
          <tr>
            {section.header.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap border-b-2 border-r px-2.5 py-2 font-semibold"
                style={{
                  borderColor: T.border,
                  color: T.textMuted,
                  backgroundColor: T.bgElevated,
                  textAlign: cfg.numeric.has(i) ? "right" : cfg.date.has(i) ? "center" : "left",
                  ...(i === 0
                    ? {
                        position: "sticky",
                        left: 0,
                        zIndex: 10,
                        boxShadow: "2px 0 4px rgba(0,0,0,0.08)",
                      }
                    : {}),
                  ...(cfg.hide.has(i) ? { minWidth: "0.5rem", padding: "0 0" } : {}),
                }}
              >
                {cfg.hide.has(i) ? "" : h || "\u00A0"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.data.map((r, ri) => {
            const isAlt = ri % 2 === 1;
            const rowRentalId =
              section.key === "rentals" && cfg.idCol >= 0 ? (r[cfg.idCol] || "").trim() : "";
            const rowClickable = !!rowRentalId && !!slug;
            const isGrandTotal = isSummary && (r[0] || "").trim().toUpperCase() === "ВСЕГО";
            // Task 124 — verification tint for the whole АРЕНДЫ row (Task 127:
            // the tint mixes into the THEME bg — dark theme gets a dark tint,
            // white text stays readable).
            // Task 128 — a row verified THIS session renders as verified
            // immediately (optimistic), before the silent refetch lands.
            const forceVerified = !!(rowRentalId && justVerified?.has(rowRentalId));
            const verTone =
              section.key === "rentals" && cfg.verification != null
                ? forceVerified
                  ? ("verified" as const)
                  : verificationToneOf(r[cfg.verification] || "")
                : null;
            // Task 128 — inline quick-verify: unverified rows with a uuid,
            // only when the modal was opened by an owner-tier viewer. The
            // server action re-gates (owner-tier + completed status).
            const verifyPending = !!(rowRentalId && verifyingIds?.has(rowRentalId));
            const showQuickVerify =
              !!onQuickVerify && !!rowRentalId && section.key === "rentals" && verTone !== "verified";
            // Task 127 — operator identity for this row (when the split is on).
            const opLabel =
              showOpMarkers && cfg.opCol != null ? (r[cfg.opCol] || "").trim() : "";
            const opMeta = opLabel
              ? { icon: operatorIconOf(opLabel), color: operatorColorOf(opLabel) }
              : null;
            const rowBg = verTone
              ? verToneBg(verTone, T.bgCard)
              : isGrandTotal
                ? T.bgElevated
                : isAlt
                  ? T.bgElevated
                  : T.bgCard;
            return (
              <tr
                key={ri}
                className="transition-colors hover:brightness-95"
                style={{
                  backgroundColor: rowBg,
                  ...(rowClickable ? { cursor: "pointer" } : {}),
                  ...(isGrandTotal ? { fontWeight: 700 } : {}),
                }}
                onClick={rowClickable ? () => onOpenRental(rowRentalId) : undefined}
                title={rowClickable ? "Открыть аренду" : undefined}
              >
                {section.header.map((_, ci) => {
                  const cell = r[ci] ?? "";
                  const isNum = cfg.numeric.has(ci) && isNumericLike(cell);
                  const isDate = cfg.date.has(ci);
                  if (cfg.hide.has(ci)) {
                    return (
                      <td
                        key={ci}
                        className="border-b border-r"
                        style={{
                          borderColor: T.border,
                          padding: "0 0",
                          minWidth: "0.5rem",
                          backgroundColor: rowBg,
                        }}
                      />
                    );
                  }
                  return (
                    <td
                      key={ci}
                      className="border-b border-r px-2.5 py-1.5"
                      title={
                        section.key === "rentals" && ci === cfg.photos && cell
                          ? `${cell.split("+")[0]} фото при выдаче + ${cell.split("+")[1] ?? 0} при возврате`
                          : cell
                      }
                      style={{
                        borderColor: T.border,
                        textAlign: isNum ? "right" : isDate ? "center" : "left",
                        whiteSpace: ci === cfg.notes ? "normal" : "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth:
                          isDate ? "8rem"
                          : ci === cfg.notes ? "16rem"
                          : (ci === cfg.subrenter || ci === cfg.photos) ? "10rem"
                          : undefined,
                        fontVariantNumeric: isNum ? "tabular-nums" : undefined,
                        ...(ci === cfg.subrenter && cell ? { color: "#f59e0b" } : {}),
                        ...(ci === cfg.photos && cell ? { color: "#22c55e", fontWeight: 600 } : {}),
                        ...(ci === cfg.verification && verTone
                          ? { color: verToneFg(verTone, isDark), fontWeight: 700 }
                          : {}),
                        // Task 127 — the operator's label wears their color.
                        ...(opMeta && ci === cfg.opCol ? { color: opMeta.color, fontWeight: 600 } : {}),
                        ...(ci === 0
                          ? {
                              position: "sticky",
                              left: 0,
                              zIndex: 10,
                              boxShadow: "2px 0 4px rgba(0,0,0,0.06)",
                              backgroundColor: rowBg,
                            }
                          : {}),
                      }}
                    >
                      {section.key === "rentals" && ci === cfg.verification && (showQuickVerify || verifyPending || forceVerified) ? (
                        // Task 128 — «Верификация» cell with the inline ✓.
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            style={{
                              color: verTone ? verToneFg(verTone, isDark) : undefined,
                              fontWeight: verTone || forceVerified ? 700 : undefined,
                            }}
                          >
                            {cell || (forceVerified ? "подтверждено" : "\u00A0")}
                          </span>
                          {showQuickVerify && (
                            <button
                              type="button"
                              disabled={verifyPending}
                              onClick={(e) => {
                                // The row itself is a tap-through to the rental
                                // page — the ✓ must not trigger it.
                                e.stopPropagation();
                                if (onQuickVerify) void onQuickVerify(rowRentalId);
                              }}
                              aria-label="Подтвердить сверку"
                              title="Подтвердить сверку (закрытая аренда; после личной сверки)"
                              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition hover:opacity-85 focus:outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-60"
                              style={{
                                borderColor: `color-mix(in srgb, ${VER_TONE_FG.verified} 45%, transparent)`,
                                backgroundColor: `color-mix(in srgb, ${VER_TONE_FG.verified} 12%, ${T.bgCard})`,
                                color: verToneFg("verified", isDark),
                              }}
                            >
                              {verifyPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              )}
                            </button>
                          )}
                        </span>
                      ) : section.key === "rentals" && ci === cfg.photos && cell ? (
                        <span className="inline-flex items-center gap-1">
                          <Camera className="h-3 w-3" aria-hidden />
                          {cell}
                        </span>
                      ) : opMeta && (ci === 0 || ci === cfg.opCol) ? (
                        // Task 127 — crew-member marker: stable emoji on the
                        // sticky date cell (always visible while scrolling)
                        // and next to the name in «Оператор (ЗП)».
                        <span className="inline-flex items-center gap-1">
                          <span aria-hidden>{opMeta.icon}</span>
                          {cell || "\u00A0"}
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
        </tbody>
        {section.totals && (
          <tfoot>
            <tr style={{ backgroundColor: T.bgElevated }}>
              {section.header.map((_, ci) => {
                if (cfg.hide.has(ci)) {
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
                const cell = section.totals![ci] ?? "";
                const isNum = cfg.numeric.has(ci) && isNumericLike(cell);
                return (
                  <td
                    key={ci}
                    className="whitespace-nowrap border-t-2 border-r px-2.5 py-2.5 font-bold"
                    style={{
                      borderColor: T.border,
                      textAlign: isNum ? "right" : cfg.date.has(ci) ? "center" : "left",
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
          </tfoot>
        )}
      </table>
    </section>
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
