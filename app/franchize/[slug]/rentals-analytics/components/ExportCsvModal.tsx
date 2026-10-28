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
//
// Task 129 (2026-10-24, boss: "yes i want:)"):
//   «Подтвердить все видимые» — when BOTH the operator filter AND the
//   «без сверки» chip are active, a bulk button appears next to the chips:
//   ONE confirm for N visible rows, then the same owner-gated action runs
//   per row (the server re-gates every call: owner tier + completed status
//   + idempotent on already-verified). Honest by construction: the button
//   counts exactly what is on screen, failures are counted per row and
//   reported in one summary toast, ONE silent refetch canonicalises the
//   labels (no N redundant CSV rebuilds).
//
// Task 137 (2026-10-25, boss) — table view usability, round three:
//   1. Sticky LEFT rail = Дата + Марка: the bike id column moves to display
//      position 2 — «when + which bike» stays visible no matter how far
//      right you scroll (the sheet is 25 columns wide).
//   2. Sticky RIGHT rail = Оператор выдал / Оператор принял / Верификация:
//      the activation/finalization columns move to the END, right before
//      the owner-tier quick-verify column — all three pin to the right
//      edge, so only the middle of the table scrolls.
//   3. The modal goes FULLSCREEN on PC — the old max-w-7xl + 88vh box
//      wasted the monitor's free real estate — and the table font drops
//      to text-xs (13px → 12px) for density.
//   Rails are MEASURED, not guessed: auto table layout sizes columns by
//   content, so the offsets come from the rendered header row
//   (getBoundingClientRect) via a ResizeObserver — see lib/table-rails.ts.
//
// Task 146 (2026-10-27, boss — tableview round four: "make everything
//   collapsible … keep showing date picker only in collapsed-controls mode
//   … autocollapse in case screen is rotated on mobile"):
//   1. COLLAPSIBLE CONTROLS — the header folds to ONE compact row: the date
//      pickers stay visible (that's the "collapsed-controls" contract),
//      search/send/download shrink to icon buttons (send/download hide on
//      the narrowest phones), and the totals tiles + «ЗП по операторам»
//      split + сверка chips fold away behind a CSS grid-rows 1fr↔0fr
//      animation (inert + aria-hidden while folded) — the table gets the
//      whole screen.
//   2. DEFAULTS — desktop (fine pointer) starts expanded, touch starts
//      collapsed: the boss works IN the table on the phone. The last MANUAL
//      toggle is remembered per tab (sessionStorage) — a fresh tab falls
//      back to the viewport default.
//   3. AUTO-COLLAPSE — rotating a touch device to landscape folds the
//      controls immediately (the rotated-short viewport is exactly when the
//      chrome hurts). Never auto-EXPANDS: after the transition the manual
//      toggle always wins.
//   4. SHIPPING DETAILS — the toggle wears a count badge while a filter is
//      active (a folded filter must never be invisible); a bulk-verify run
//      force-opens the chips row so the progress button stays on screen;
//      the collapsed phone search icon expands the controls and focuses the
//      field once the fold animation has opened the row; the scroll
//      container got a thin styled scrollbar + touch-action:manipulation.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Download, Loader2, Send, Search, Table2, Camera, Check, ChevronUp, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
// Task 128 — same owner-gated action the rental-page verification card uses.
// Task 152 — resendVerificationDmsAction powers the per-row «выслать сверку»
// button (send the verification REQUEST to operator + owner right from the
// table view, without opening the rental — boss request 2026-10-27).
import {
  adminVerifyRentalAction,
  resendVerificationDmsAction,
} from "@/app/franchize/server-actions/rental-verify-actions";
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
// Task 137 — display-order remap + measured sticky-rail offsets.
import { computeRailOffsets, RENTALS_DISPLAY_ORDER } from "./lib/table-rails";
import {
  parseCsvSections,
  pluralBlocksRu,
  type CsvSectionKey,
  type ParsedCsvSection,
} from "@/lib/csv-builders/rentals-csv-sections";

// Task 153 — server actions carry NO deadline of their own: a silently
// dropped TCP connection (RU DPI window on 2026-10-27 / a flaky route) kept
// the row spinner spinning for minutes and the «выслать сверку» button felt
// HANGED (boss report, PC/password session). Every verify-family call from
// the table view now races a 45 s client-side deadline: on timeout the
// spinner clears and an honest toast tells the presser to retry. The
// orphaned server call, if it ever lands late, stays safe — verify is
// idempotent and resend creates-or-reuses the same verification row.
const SERVER_ACTION_TIMEOUT_MS = 45_000;
class ServerActionTimeoutError extends Error {}
async function withServerTimeout<T>(pending: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new ServerActionTimeoutError(
            "Сервер не ответил за 45 с — соединение потеряно. Попробуйте ещё раз.",
          ),
        ),
      SERVER_ACTION_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([pending, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Task 137 — the sticky rails are a PC affordance: on a narrow scrollport
 *  the two rails together (Дата+Марка ≈ 290px left, выдал+принял+Верификация
 *  ≈ 600px right) would cover a 390px phone ENTIRELY. Below lg (1024px) the
 *  table degrades to the classic single sticky date column. */
function useMinWidth(px: number): boolean {
  const [on, setOn] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${px}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const apply = () => setOn(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [px]);
  return on;
}

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
  /** task151 — password-session owner id (PC viewer, /analytics_pass flow):
   *  forwarded to the quick-verify calls so they act as the crew owner when
   *  the Telegram actor cookie is absent (server re-gates against
   *  crews.owner_id). */
  passwordAuthOwnerId?: string | null;
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
// Column indexes per block of the sheet layout (builder: rentals-csv.ts):
//   АРЕНДЫ  (28): Дата, ЗП Аренда, Партнеру, Цена, Способ оплаты, Экип, Залог,
//                 Марка, Пробег до, Пробег после, Время, Имя, Телефон,
//                 Комментарий, Заметки, Субарендатор, Фото, ID, ЗП техника,
//                 ЗП экип, ЗП наценка, Экип флаги, Оператор создал, Оператор
//                 выдал, Оператор принял, Оператор (ЗП), Атрибуция ЗП,
//                 Верификация
//   ЭКИП     (7): Дата, Наименование, Цена, Выдал, Принял, Комментарий, ID
//   СЕРВИС   (5): Дата, Услуга, Байк, Цена, ID
//   ПРОДАЖИ  (8): Дата, ЗП Продажа, Наименование, Цена, Комментарий, ID,
//                 Оператор (ЗП), Атрибуция ЗП
//   СВОДКА   (5): Блок, Записей, Выручка, ЗП, Примечание
//
// Task 156 (boss 2026-10-28): «Комментарий» (имя + телефон + нал/банк одним
// текстом) split into Имя (11) / Телефон (12) / Способ оплаты (4) — способ
// оплаты стоит сразу после Цены, чтобы «налито или не налито» читалось рядом
// с суммой. «Комментарий» (13) keeps the rest (причина бесплатной аренды).
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
  /** Task 137 — display-order remap (DATA indexes; every cfg lookup above
   *  stays in data space, only the render loop walks this order). */
  order?: number[];
  /** Task 137 — sticky rails: N leading display columns pin LEFT (date +
   *  bike id), M trailing display columns pin RIGHT (activation/finalization
   *  + verification). Defaults: 1 left (the date), 0 right. */
  stickyLeft?: number;
  stickyRight?: number;
}

const SECTION_COLS: Record<CsvSectionKey, SectionColCfg> = {
  rentals: {
    numeric: new Set([1, 3, 5, 6, 8, 9]),
    date: new Set([0]),
    hide: new Set([17]),
    notes: 14,
    subrenter: 15,
    photos: 16,
    verification: 27,
    opCol: 25,
    idCol: 17,
    // Task 137 — Марка (7) → display position 2, Оператор выдал (23) /
    // принял (24) → the tail right before Верификация (27). Left rail pins
    // «Дата + Марка», right rail pins «выдал / принял / верификация» — the
    // middle scrolls, the context never leaves the screen.
    order: RENTALS_DISPLAY_ORDER,
    stickyLeft: 2,
    stickyRight: 3,
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

// Task 129 — Russian plural for counts in the bulk confirm/labels
// (1 аренда / 2 аренды / 5 аренд; 21 аренда…). Classic 3-form rule.
function pluralRuNoun(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
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

// Task 152 — per-row context (дата · байк · цена) carried from the rendered
// row into the confirm dialogs: a verify/request tap must SHOW which row it
// is about to touch, so an off-by-one tap on a dense touch table is visible
// BEFORE the action fires (boss 2026-10-27: a verify landed on the row BELOW
// the one he was looking at — success toast, wrong row).
type QuickRowCtx = { date: string; bike: string; price: string };
const EMPTY_ROW_CTX: QuickRowCtx = { date: "", bike: "", price: "" };
function quickRowLabel(ctx?: Partial<QuickRowCtx>): string {
  if (!ctx) return "";
  const parts = [ctx.date, ctx.bike, ctx.price ? `${ctx.price} ₽` : ""].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Task 152 — read the «Верификация» label for one rental uuid from a freshly
 * parsed CSV. Walks the АРЕНДЫ block (header row containing «Верификация»,
 * data rows until the next ALL-CAPS block banner). Empty string = not found
 * (block missing / old layout) — callers treat it as «not reflected yet».
 */
function verLabelForId(rows: string[][], rentalId: string): string {
  if (!rentalId) return "";
  const hi = rows.findIndex((r) => r.some((c) => (c || "").trim() === "Верификация"));
  if (hi === -1) return "";
  const header = rows[hi];
  const verIdx = header.findIndex((c) => (c || "").trim() === "Верификация");
  const idIdx = header.findIndex((c) => (c || "").trim() === "ID");
  if (verIdx === -1 || idIdx === -1) return "";
  for (let i = hi + 1; i < rows.length; i += 1) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const first = (r[0] || "").trim();
    if (!first) continue;
    if (first === first.toUpperCase() && first.length < 12) break; // next block banner (ЭКИП/ПРОДАЖИ/СВОДКА)
    if ((r[idIdx] || "").trim() === rentalId) return (r[verIdx] || "").trim();
  }
  return "";
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

// Task 146 — sessionStorage remembers the last MANUAL fold choice for this
// tab: reopening the modal keeps the operator's layout, a fresh tab starts
// from the viewport default (desktop expanded / touch collapsed).
const CONTROLS_STORAGE_KEY = "rentalsAnalytics.csvTableControlsExpanded";

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
  passwordAuthOwnerId = null,
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
  // Task 129 — bulk «подтвердить все видимые» progress: {total, done} while
  // the batch is running (button label counts up, per-row ✓ spinners ride the
  // shared verifyingIds), null = idle. The loop keeps its own snapshot of the
  // ids captured at confirm time — filter changes mid-run can't skew it.
  const [bulkVerify, setBulkVerify] = useState<{ total: number; done: number } | null>(null);
  // Belt-and-braces against a second batch racing the first (state batching
  // alone leaves a one-tick window between the click and the re-render).
  const bulkRunRef = useRef(false);

  // Task 146 — collapsible controls (boss: "keep showing date picker only in
  // collapsed-controls mode"). false folds the header to one compact row:
  // date pickers + icon actions stay, the totals tiles / operator split /
  // сверка chips fold away and the table takes the screen. Initialized per
  // open in the isOpen effect below (viewport default + stored choice).
  const [controlsExpanded, setControlsExpanded] = useState(true);
  // Task 146 — the collapsed phone has no room for the search input; its
  // icon expands the controls and focuses the field after the fold opens.
  const [searchFocusPending, setSearchFocusPending] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Task 152 — the loader returns the set of ids from `expectVerified` whose
  // fresh labels are STILL not «подтверждено» (empty set when all reflected,
  // null when the refetch itself failed). Callers turn a non-empty set into
  // an honest warning instead of a silent revert illusion: the verify WRITE
  // landed server-side, but the table data did not catch up yet (WebView
  // cache / replication lag) — the old code silently cleared the optimistic
  // tint, which read as «verified flipped itself back to ожидает».
  const loadTable = useCallback(async (opts?: {
    silent?: boolean;
    expectVerified?: Set<string>;
  }): Promise<Set<string> | null> => {
    if (!fetchCsvText || !from || !to || from > to) return null;
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
      const parsed = parseCsv(text);
      setRows(parsed);
      // Task 129 review fix — canonical data is on screen now: drop the session
      // optimism so the row tints always follow the CSV label (not a stale
      // just-verified stamp). A silent failure never reaches this line — the
      // optimistic tint correctly survives a failed refetch.
      // Task 152 — EXCEPT the ids the caller just verified: when the fresh CSV
      // does not reflect them yet, KEEP their tint (the write is accepted
      // server-side) and report them back for the warning toast.
      const expect = opts?.expectVerified;
      if (expect && expect.size > 0) {
        const stuck = new Set<string>();
        for (const id of expect) {
          if (verificationToneOf(verLabelForId(parsed, id)) !== "verified") stuck.add(id);
        }
        setJustVerified((prev) => {
          const next = new Set(prev);
          for (const id of expect) if (!stuck.has(id)) next.delete(id);
          for (const id of stuck) next.add(id);
          return next;
        });
        return stuck;
      }
      setJustVerified((prev) => (prev.size > 0 ? new Set<string>() : prev));
      return new Set<string>();
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
    return null; // silent-failure path — caller keeps the optimistic tint, no warning
  }, [fetchCsvText, from, to]);

  // task151 — identity params for the quick-verify server action: the TG
  // cookie path stays untouched; the PC password session adds its owner id.
  // Memoized + declared BEFORE handleQuickVerify so the callback identity
  // only tracks the restored owner id (sessionStorage mount effect).
  const verifyActorParams = useMemo(
    () =>
      passwordAuthOwnerId
        ? { actorUserId: passwordAuthOwnerId, isPasswordAuth: true }
        : {},
    [passwordAuthOwnerId],
  );

  // Task 128 — quick verify from the table view. Same action, same confirm
  // pattern and same toasts as the rental-page CommissionVerificationCard —
  // only the entry point is different (a ✓ inside the «Верификация» cell).
  // Task 152 (boss 2026-10-27):
  //   • the confirm dialog now shows WHICH row is about to be verified
  //     (дата · байк · цена) — the tappable table is dense and the ✓ is
  //     small, so a one-row-off touch must be visible BEFORE the OK;
  //   • after the silent refetch the fresh label for THIS id is checked —
  //     when the table still shows the old status, the optimistic tint is
  //     KEPT and an honest warning toast fires instead of the silent revert
  //     illusion («verified → ожидает»).
  const handleQuickVerify = useCallback(
    async (rentalId: string, ctx?: QuickRowCtx) => {
      if (!slug || verifyingIds.has(rentalId)) return;
      const rowLabel = quickRowLabel(ctx);
      const ok = window.confirm(
        "Подтвердить сверку по этой аренде?\n\n" +
          (rowLabel ? `${rowLabel}\n\n` : "") +
          "Строка будет помечена «подтверждено» для оператора и владельца (используйте после личной сверки).",
      );
      if (!ok) return;
      setVerifyingIds((prev) => new Set(prev).add(rentalId));
      try {
        const res = await withServerTimeout(
          adminVerifyRentalAction({ slug, rentalId, ...verifyActorParams }),
        );
        if (res.success) {
          toast.success("Сверка подтверждена ✅");
          setJustVerified((prev) => new Set(prev).add(rentalId));
          const stuck = await loadTable({ silent: true, expectVerified: new Set([rentalId]) });
          if (stuck && stuck.has(rentalId)) {
            toast.warning(
              `Подтверждение принято${rowLabel ? ` (${rowLabel})` : ""}, но таблица пока показывает старый статус — обновите таблицу ещё раз через пару секунд.`,
              { duration: 7000 },
            );
          }
        } else {
          toast.error(res.error || "Не удалось подтвердить сверку");
        }
      } catch (err) {
        toast.error(
          err instanceof ServerActionTimeoutError
            ? err.message
            : "Не удалось подтвердить сверку",
        );
      } finally {
        setVerifyingIds((prev) => {
          const next = new Set(prev);
          next.delete(rentalId);
          return next;
        });
      }
    },
    [slug, verifyingIds, loadTable, verifyActorParams],
  );

  // Task 152 — «выслать сверку» from the table view (boss: «hope to be able
  // to send verification requests right from tableview, not just confirm
  // right away»). The resend action creates the verification row when it
  // does not exist yet and DMs BOTH parties (operator + owner) the frozen
  // расчёт with the ✅/⚠️ keyboard — each confirms SEPARATELY, the row walks
  // ожидает → ждёт владельца / ждёт оператора → подтверждено. Owner-tier
  // gated server-side (same resolveVerifyOwnerActor as the verify action).
  const [sendingIds, setSendingIds] = useState<Set<string>>(() => new Set());
  const handleSendRequest = useCallback(
    async (rentalId: string, ctx?: QuickRowCtx) => {
      if (!slug || sendingIds.has(rentalId)) return;
      const rowLabel = quickRowLabel(ctx);
      const ok = window.confirm(
        "Выслать сверку в Telegram?\n\n" +
          (rowLabel ? `${rowLabel}\n\n` : "") +
          "Оператор и владелец получат сообщение с кнопками ✅ / ⚠️ и подтвердят расчёт по отдельности — строка пройдёт «ожидает → ждёт владельца/оператора → подтверждено».",
      );
      if (!ok) return;
      setSendingIds((prev) => new Set(prev).add(rentalId));
      try {
        const call = resendVerificationDmsAction({ slug, rentalId, ...verifyActorParams });
        const res = await withServerTimeout(call);
        if (res.success && res.data) {
          // Honest delivery report (same wording as the rental-page card).
          const sent = res.data.sentTo?.length ?? 0;
          const failed = res.data.failed ?? [];
          const copied = res.data.actorCopied === true;
          const failNote = failed.length
            ? ` ⚠️ Не доставлено: ${failed.map((f) => f.chatId).join(", ")}`
            : "";
          toast.success(
            `${res.data.created ? "Сверка создана и отправлена" : "Сверка отправлена в Telegram"} (${sent} получено${copied ? " + копия вам" : ""}) ✅${failNote}`,
            { duration: 6000 },
          );
          // A freshly created row changes the «Верификация» cell (пусто →
          // ожидает) — pull the canonical labels without a loading flash.
          if (res.data.created) void loadTable({ silent: true });
        } else {
          toast.error(res.error || "Не удалось отправить сверку");
        }
      } catch (err) {
        toast.error(
          err instanceof ServerActionTimeoutError
            ? err.message
            : "Не удалось отправить сверку",
        );
      } finally {
        setSendingIds((prev) => {
          const next = new Set(prev);
          next.delete(rentalId);
          return next;
        });
      }
    },
    [slug, sendingIds, loadTable, verifyActorParams],
  );
  // Owner-tier + rentals variant + a slug to act through — otherwise the ✓
  // never renders (sales sheets, non-owner crew). Password viewers DO get the
  // ✓ when the password session resolved to the crew owner (task151) — the
  // server re-gates the identity anyway, this is presentation only.
  const canQuickVerify = canVerify && variant === "rentals" && !!slug;

  // Task 129 — «подтвердить все видимые»: ONE confirm, N rows. Available only
  // when BOTH scoping filters are on — the operator pill narrows the blast
  // radius to one crew member, the «без сверки» chip guarantees every visible
  // АРЕНДЫ row is a verify candidate. The loop reuses the SAME per-row action
  // (each call re-gates owner tier + completed status server-side and is
  // idempotent on verified rows), so a stale row or an in-progress rental
  // just fails its own count instead of poisoning the batch. Sequential keeps
  // the DB gentle and the progress honest; ONE silent refetch at the end —
  // per-row refetches would be N redundant CSV rebuilds.
  // Deliberately a plain (non-hook) function: it reads bulkTargetIds, which is
  // derived further down from the CURRENT visible rows — a fresh identity per
  // render is exactly what keeps the confirm count honest.
  const handleBulkVerify = async () => {
    if (!slug || bulkRunRef.current || bulkVerify) return;
    const ids = [...bulkTargetIds];
    if (ids.length === 0) return;
    const n = ids.length;
    const dative = n % 10 === 1 && n % 100 !== 11 ? "аренде" : "арендам";
    const ok = window.confirm(
      `Подтвердить сверку сразу по ${n} ${dative} оператора «${effectiveOpFilter}»?\n\n` +
        `Каждая видимая строка будет помечена «подтверждено» для оператора и владельца (используйте после личной сверки). ` +
        `Незакрытые аренды сервер пропустит — по ним сверка не заводится.`,
    );
    if (!ok) return;
    // Task 146 — the batch progress lives in the сверка chips row; open the
    // folded controls so the count-up button stays visible while it runs.
    setControlsExpanded(true);
    bulkRunRef.current = true;
    let done = 0;
    let failed = 0;
    let firstError: string | null = null;
    // Task 152 — ids whose verify was ACCEPTED server-side this batch; the
    // post-batch refetch checks their labels actually turned «подтверждено».
    const succeededIds: string[] = [];
    setBulkVerify({ total: n, done: 0 });
    for (const rentalId of ids) {
      setVerifyingIds((prev) => new Set(prev).add(rentalId));
      try {
        const res = await adminVerifyRentalAction({ slug, rentalId, ...verifyActorParams });
        if (res.success) {
          done += 1;
          succeededIds.push(rentalId);
          setJustVerified((prev) => new Set(prev).add(rentalId));
        } else {
          failed += 1;
          firstError = firstError || res.error || null;
        }
      } catch {
        failed += 1;
      } finally {
        setVerifyingIds((prev) => {
          const next = new Set(prev);
          next.delete(rentalId);
          return next;
        });
      }
      setBulkVerify({ total: n, done: done + failed });
    }
    setBulkVerify(null);
    if (failed === 0) {
      toast.success(
        `Сверка подтверждена: ${done} ${pluralRuNoun(done, "аренда", "аренды", "аренд")} ✅`,
      );
    } else if (done === 0) {
      toast.error(
        `Подтвердить не удалось (${n} ${pluralRuNoun(n, "строка", "строки", "строк")})${firstError ? ` — ${firstError}` : ""}`,
      );
    } else {
      toast.warning(
        `Сверено ${done} из ${n} · не удалось: ${failed}${firstError ? ` — ${firstError}` : ""}`,
      );
    }
    // One canonical refetch for the whole batch; the optimistic tint bridges
    // the gap (same contract as the single-row quick verify). Task 152 — the
    // just-verified ids ride as expectVerified: any row whose fresh label is
    // still not «подтверждено» keeps its tint and gets ONE honest warning
    // instead of silently flipping back to «ожидает».
    bulkRunRef.current = false;
    setBulkVerify(null);
    const stuck = await loadTable({ silent: true, expectVerified: new Set(succeededIds) });
    if (stuck && stuck.size > 0) {
      toast.warning(
        `Подтверждения приняты, но таблица пока показывает старые статусы (${stuck.size}) — обновите таблицу ещё раз через пару секунд.`,
        { duration: 7000 },
      );
    }
  };

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
      // Task 129 review fix — a batch still running from BEFORE the close keeps
      // going server-side (idempotent per row); a fresh open must allow a new
      // batch instead of silently no-op-ing on the stale running flag.
      bulkRunRef.current = false;
      setBulkVerify(null);
      // Task 146 — fold state per open: the stored MANUAL choice wins; a tab
      // without one falls back to the viewport default (desktop expanded /
      // touch collapsed — the phone works IN the table). Touch devices that
      // opened already rotated (landscape) also start folded via the same
      // coarse-pointer default.
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      let stored: string | null = null;
      try {
        stored = window.sessionStorage.getItem(CONTROLS_STORAGE_KEY);
      } catch {
        /* private mode — viewport default applies */
      }
      setControlsExpanded(stored != null ? stored === "1" : !coarse);
      setSearchFocusPending(false);
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

  // Task 146 — boss: "autocollapse in case screen is rotated on mobile".
  // A portrait→landscape transition on a touch device folds the controls
  // right away. Fires on the TRANSITION only (a keyboard opening or a window
  // resize never folds — the on-screen keyboard would otherwise fight the
  // operator mid-search). Desktop (fine pointer) never auto-collapses, and
  // nothing here ever auto-EXPANDS — the manual toggle wins after the flip.
  useEffect(() => {
    if (!isOpen) return;
    const landscape = window.matchMedia("(orientation: landscape)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const onOrientationChange = () => {
      if (landscape.matches && coarse.matches) setControlsExpanded(false);
    };
    landscape.addEventListener("change", onOrientationChange);
    return () => landscape.removeEventListener("change", onOrientationChange);
  }, [isOpen]);

  // Task 146 — the collapsed-phone search icon: wait for the 340ms fold
  // animation to open the controls row, then put the caret in the field.
  useEffect(() => {
    if (!searchFocusPending || !controlsExpanded) return;
    const t = window.setTimeout(() => {
      searchInputRef.current?.focus();
      setSearchFocusPending(false);
    }, 340);
    return () => window.clearTimeout(t);
  }, [searchFocusPending, controlsExpanded]);

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
    // Task 133 — with an operator filter on, the СВОДКА block still showed
    // FULL-period sums next to the filtered tables — the boss read that as
    // «the filter did nothing». Its per-block numbers are unattributable
    // (the summary has no operator column), so the honest move is to hide
    // the block entirely while the filter is on (it returns on reset).
    if (s.key === "summary") return { ...s, data: [], totals: null };
    const cfg = SECTION_COLS[s.key];
    // Blocks without operator attribution (ЭКИП / СЕРВИС) pass through —
    // they have no «Оператор (ЗП)» column to filter by. СВОДКА is hidden
    // above (full-period sums would contradict the filtered tables).
    // (task129 review fix — hoist to a local const: property narrowing doesn't
    // survive into the filter closure, the bare `r[cfg.opCol]` was TS2538.)
    const opIdx = cfg.opCol;
    if (opIdx == null || s.key === "summary") return s;
    return {
      ...s,
      data: s.data.filter((r) => (r[opIdx] || "").trim() === effectiveOpFilter),
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

  // Task 129 — bulk-verify candidates: the VISIBLE АРЕНДЫ rows that can take
  // a quick verify (uuid present; not verified — canonical or optimistic; not
  // already in flight). Only meaningful when BOTH filters are on: the operator
  // pill scopes it to one crew member, «без сверки» makes every visible row a
  // candidate. recompute per render → the button count always matches screen.
  const bulkScoped =
    canQuickVerify && !!effectiveOpFilter && verFilter === "none" && !loading && !error;
  const bulkTargetIds: string[] = bulkScoped
    ? (rentSec?.data ?? [])
        .map((r) => (r[SECTION_COLS.rentals.idCol] || "").trim())
        .filter((id) => id && !justVerified.has(id) && !verifyingIds.has(id))
    : [];
  const bulkActive = bulkVerify !== null;
  const showBulkVerify =
    canQuickVerify && !!effectiveOpFilter && verFilter === "none" &&
    (bulkActive || bulkTargetIds.length > 0);

  // Task 146 — fold model. regionOpen forces the chips row visible while the
  // bulk verify counts up; activeFilterCount powers the toggle's badge — a
  // folded operator/сверка filter must never be invisible (the boss reads
  // the table against the filters; a stale filter without a hint would lie).
  const regionOpen = controlsExpanded || bulkActive;
  const activeFilterCount =
    (effectiveOpFilter ? 1 : 0) + (verFilter !== "all" ? 1 : 0);
  const toggleControls = () => {
    const next = !controlsExpanded;
    setControlsExpanded(next);
    try {
      window.sessionStorage.setItem(CONTROLS_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* private mode — the layout choice just won't persist */
    }
  };
  const expandAndFocusSearch = () => {
    setControlsExpanded(true);
    setSearchFocusPending(true);
    try {
      window.sessionStorage.setItem(CONTROLS_STORAGE_KEY, "1");
    } catch {
      /* private mode */
    }
  };

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
      // Task 137 — fullscreen on PC too: the old sm padding + centering
      // boxed the sheet at max-w-7xl/88vh and wasted the monitor. Mobile was
      // always items-stretch — now PC matches it.
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/60 backdrop-blur-sm"
      onClick={downloading || sending ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр таблицы и экспорт CSV"
    >
      <div
        className="flex h-full w-full flex-col border shadow-2xl overflow-hidden"
        // Task 127 — the panel starts BELOW the TG fullscreen native buttons:
        // the header row (and its top-right «x») can no longer hide under them.
        style={{
          backgroundColor: T.bgCard,
          borderColor: T.border,
          ...(tgSafeTop > 0 ? { paddingTop: `${tgSafeTop}px` } : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header — title + close + date pickers + actions ──────────────────
            Task 146 — collapsible. Expanded = title row + full controls row
            (dates + search + send/download). Collapsed = ONE compact row:
            the DATE PICKERS stay visible (the "collapsed-controls" contract),
            search/send/download become icon buttons (send/download hide on
            the narrowest phones), and the summary region below folds away —
            the table gets the screen. The toggle's badge shows how many
            filters stay active while folded. */}
        <div
          className="flex flex-col gap-3 border-b p-3 sm:p-4"
          style={{ borderColor: T.border, background: T.bgElevated }}
        >
          {controlsExpanded ? (
            <>
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
            <div className="flex items-center gap-1.5">
              {/* Task 146 — fold everything but the dates; the badge keeps
                  active filters visible while folded. */}
              <button
                type="button"
                onClick={toggleControls}
                aria-expanded="true"
                aria-controls="csv-controls-region"
                title="Свернуть сводку и фильтры — останутся только даты"
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition hover:opacity-80 focus:outline-none focus-visible:ring-2"
                style={{ borderColor: T.border, color: T.text, backgroundColor: T.bgCard, minHeight: "36px" }}
              >
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                Свернуть
              </button>
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
                  ref={searchInputRef}
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
            </>
          ) : (
            /* Task 146 — COLLAPSED: one compact row. Date pickers keep their
               ids/labels (sr-only here) so the «collapsed-controls» contract
               holds; search/send/download shrink to icons — send/download
               hide below sm where the row would overflow anyway; the
               SlidersHorizontal toggle re-opens the summary region (badge =
               active filter count) and the X stays in the same corner. */
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <label className="sr-only" htmlFor="csv-from">
                  С даты
                </label>
                <input
                  id="csv-from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="С даты"
                  className="rounded-lg border px-2 py-1.5 text-xs tabular-nums"
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-col">
                <label className="sr-only" htmlFor="csv-to">
                  По дату
                </label>
                <input
                  id="csv-to"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="По дату"
                  className="rounded-lg border px-2 py-1.5 text-xs tabular-nums"
                  style={inputStyle}
                />
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                {/* Search: inline input where the row has room (sm+), a
                    one-tap expand+focus icon on phones (task 146). */}
                <div
                  className="relative hidden items-center rounded-lg border px-2 sm:flex"
                  style={inputStyle}
                >
                  <Search className="h-3.5 w-3.5 opacity-60" aria-hidden />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Поиск…"
                    aria-label="Поиск по таблице"
                    className="ml-1.5 w-24 bg-transparent py-1.5 text-xs outline-none sm:w-32"
                    style={{ color: T.text }}
                  />
                </div>
                <button
                  type="button"
                  onClick={expandAndFocusSearch}
                  aria-label="Найти в таблице"
                  title="Найти в таблице"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition hover:opacity-80 focus:outline-none focus-visible:ring-2 sm:hidden"
                  style={{ borderColor: T.border, color: T.text, backgroundColor: T.bgCard }}
                >
                  <Search className="h-4 w-4" aria-hidden />
                </button>

                {onSendTelegram && (
                  <button
                    type="button"
                    onClick={handleSendTelegram}
                    disabled={!isValid || sending || loading}
                    aria-label="Отправить в Telegram"
                    title={variant === "rentals" ? "Отправить XLSX в Telegram (подсветка сверки)" : "Отправить XLSX в Telegram"}
                    className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 disabled:opacity-50 sm:inline-flex"
                    style={{ backgroundColor: "#22c55e", color: "#ffffff" }}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!isValid || downloading || loading}
                  aria-label="Скачать видимые данные в XLSX"
                  title={variant === "rentals" ? "Скачать XLSX (подсветка сверки)" : "Скачать XLSX"}
                  className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 disabled:opacity-50 sm:inline-flex"
                  style={{ backgroundColor: "#3b82f6", color: "#ffffff" }}
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden />
                  )}
                </button>

                {/* Re-open the summary region. The badge counts active
                    filters (operator pill / сверка chip) — a folded filter
                    must never be invisible. */}
                <button
                  type="button"
                  onClick={toggleControls}
                  aria-expanded="false"
                  aria-controls="csv-controls-region"
                  aria-label="Показать сводку и фильтры"
                  title="Показать сводку и фильтры (итоги, ЗП по операторам, сверка)"
                  className="relative inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border px-2 transition hover:opacity-80 focus:outline-none focus-visible:ring-2"
                  style={{
                    borderColor: activeFilterCount > 0 ? T.accent : T.border,
                    color: activeFilterCount > 0 ? T.accent : T.text,
                    backgroundColor:
                      activeFilterCount > 0
                        ? `color-mix(in srgb, ${T.accent} 12%, ${T.bgCard})`
                        : T.bgCard,
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  {activeFilterCount > 0 && (
                    <span
                      className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
                      style={{ backgroundColor: T.accent, color: "#ffffff" }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>

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
            </div>
          )}
        </div>

        {/* ── Foldable region (task 146): totals tiles + «ЗП по операторам» +
            сверка chips. The grid-template-rows 1fr↔0fr animation needs the
            overflow-hidden child (a scroll container's automatic minimum
            size is 0 — that's what lets 0fr actually collapse); inert +
            aria-hidden keep the folded controls out of the tab order and off
            screen readers. bulkActive force-opens the region so the batch
            progress button stays visible. */}
        <div
          id="csv-controls-region"
          role="region"
          aria-label="Сводка и фильтры таблицы"
          aria-hidden={!regionOpen}
          {...(regionOpen ? {} : { inert: "" })}
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: regionOpen ? "1fr" : "0fr" }}
        >
        <div className="overflow-hidden">
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
            {/* Task 129 — «подтвердить все видимые»: lives next to the chips
                (that's where «без сверки» was tapped). One confirm covers all
                visible rows; while running it counts up and per-row ✓ spinners
                ride the shared verifyingIds.*/}
            {showBulkVerify && (
              <button
                type="button"
                onClick={() => void handleBulkVerify()}
                disabled={bulkActive}
                className="ml-auto inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition hover:opacity-90 focus:outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-70"
                style={{
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  boxShadow: "0 1px 4px rgba(22, 163, 74, 0.35)",
                }}
                title={
                  bulkActive
                    ? `Идёт пакетное подтверждение (${bulkVerify.done}/${bulkVerify.total})`
                    : `Одно подтверждение на все ${bulkTargetIds.length} видимых строк (оператор: ${effectiveOpFilter}) — по каждой сервер ещё раз проверит права и статус`
                }
              >
                {bulkActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                )}
                {bulkActive
                  ? `Подтверждаю ${bulkVerify.done}/${bulkVerify.total}…`
                  : `Подтвердить все видимые (${bulkTargetIds.length})`}
              </button>
            )}
          </div>
        )}
        </div>
        </div>

        {/* ── Table(s) — horizontal scroll, sticky first column + header.
            Task 146 polish: thin styled scrollbars (the horizontal one used
            to be a chunky default bar eating row height on PC) and
            touch-action:manipulation so double-tapping a row can't zoom the
            sheet while the boss works fast.
            Codereview fix (task 148): `bg-current/20` compiles to NOTHING in
            Tailwind 3 (opacity on currentColor is a v4 color-mix feature) —
            the thumb was fully transparent on WebKit while the bar still
            reserved its 8px: you paid the height AND got no affordance.
            Palette colors decompose fine in v3, so the thumb picks a real
            color per theme (white on dark / black on light at the same 20%). */}
        <div
          className={`flex-1 overflow-auto [touch-action:manipulation] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent ${
            isDark
              ? "[&::-webkit-scrollbar-thumb]:bg-white/20"
              : "[&::-webkit-scrollbar-thumb]:bg-black/20"
          }`}
          style={{ backgroundColor: T.bg }}
        >
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
                    sendingIds={sendingIds}
                    onSendRequest={canQuickVerify ? handleSendRequest : undefined}
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
  sendingIds,
  onSendRequest,
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
  onQuickVerify?: (rentalId: string, ctx?: QuickRowCtx) => Promise<void> | void;
  /** Task 152 — ids with an in-flight «выслать сверку» (the 📨 spins). */
  sendingIds?: Set<string>;
  /** Task 152 — per-row «выслать сверку в Telegram»: DMs the frozen расчёт
   *  to operator + owner with the ✅/⚠️ keyboard — each confirms SEPARATELY,
   *  right from the table view without opening the rental. */
  onSendRequest?: (rentalId: string, ctx?: QuickRowCtx) => Promise<void> | void;
}) {
  const cfg = SECTION_COLS[section.key];
  const accent = SECTION_ACCENT[section.key];
  const isSummary = section.key === "summary";
  // Task 132 — sticky two-tier header: banner + column row both stay visible
  // while the section's rows scroll. The banner must have a DETERMINISTIC
  // height (h-9 = 36px) because the thead sticks exactly below it (top-9).
  // Dark theme tokens (bgElevated/bgCard) are translucent hex tints — sticky
  // cells need an OPAQUE backing or scrolled rows bleed through, so both the
  // banner and every th composite themselves over T.bg (the scroll
  // container's own opaque background) via stacked background-image layers.
  const bannerTint = `color-mix(in srgb, ${accent} 18%, ${T.bgElevated})`;
  const thOpaqueBg = `linear-gradient(${T.bgElevated}, ${T.bgElevated}), linear-gradient(${T.bg}, ${T.bg})`;

  // Task 137 — sticky RAILS. cfg.stickyLeft leading display columns pin
  // left (Дата + Марка), cfg.stickyRight trailing ones pin right (выдал /
  // принял / верификация); the middle scrolls under both. Auto table layout
  // sizes columns by content, so the rail offsets are MEASURED from the
  // rendered header row (getBoundingClientRect — fractional, no drift) and
  // re-measured by a ResizeObserver on every width change (data reload,
  // viewport resize, font swap). The callback-ref-into-state pattern re-runs
  // the effect when the <table> (re)mounts — loading/error states swap the
  // element out entirely.
  const stickyLeftRaw = cfg.stickyLeft ?? 1;
  const stickyRightRaw = cfg.stickyRight ?? 0;
  const railsOn = useMinWidth(1024);
  const stickyLeft = railsOn ? stickyLeftRaw : 1;
  const stickyRight = railsOn ? stickyRightRaw : 0;
  const displayIdxs = cfg.order
    ? cfg.order.filter((i) => i < section.header.length)
    : section.header.map((_, i) => i);
  const colCount = displayIdxs.length;
  const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);
  const [rail, setRail] = useState<{ left: number[]; right: number[] }>({
    left: [],
    right: [],
  });
  useLayoutEffect(() => {
    if (!tableEl) return;
    const measure = () => {
      const headRow = tableEl.rows?.[0];
      if (!headRow || headRow.cells.length === 0) return;
      const widths = Array.from(headRow.cells).map(
        (c) => c.getBoundingClientRect().width,
      );
      const next = computeRailOffsets(widths, stickyLeft, stickyRight);
      // no-op guard: a setState per RO tick would re-render forever
      setRail((prev) =>
        prev.left.length === next.left.length &&
        prev.right.length === next.right.length &&
        prev.left.every((v, i) => Math.abs(v - next.left[i]) < 0.5) &&
        prev.right.every((v, i) => Math.abs(v - next.right[i]) < 0.5)
          ? prev
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(tableEl);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [tableEl, stickyLeft, stickyRight]);

  // Task 137 — one style factory for every rail cell (th/td/tfoot). Left rail
  // casts its shadow to the RIGHT (content slides under from the right), the
  // right rail mirrors it. The background is an OPAQUE composite: the row's
  // own tint stacked over the scroll container's T.bg — dark-theme tokens are
  // translucent, so without the second layer the cells sliding beneath would
  // bleed through (same recipe as the task132 th fix).
  const railCellStyle = (
    di: number,
    bg: string,
    shadowIntensity: string,
  ): React.CSSProperties => {
    if (di < stickyLeft) {
      return {
        position: "sticky",
        left: rail.left[di],
        zIndex: 10,
        boxShadow: `2px 0 4px rgba(0,0,0,${shadowIntensity})`,
        backgroundColor: bg,
        backgroundImage: `linear-gradient(${bg}, ${bg}), linear-gradient(${T.bg}, ${T.bg})`,
      };
    }
    const ri = colCount - 1 - di;
    if (ri >= 0 && ri < stickyRight) {
      return {
        position: "sticky",
        right: rail.right[ri],
        zIndex: 10,
        boxShadow: `-2px 0 4px rgba(0,0,0,${shadowIntensity})`,
        backgroundColor: bg,
        backgroundImage: `linear-gradient(${bg}, ${bg}), linear-gradient(${T.bg}, ${T.bg})`,
      };
    }
    return {};
  };

  return (
    <section className="min-w-fit">
      {/* min-w-fit (task 133): the table inside uses minWidth:max-content and
          can be WIDER than the scroll container — without this the section
          (and the sticky banner) stayed at container width, so scrolling
          right exposed a bare gap between the banner strip and the thead.
          Now the section stretches to the table's width and the banner
          covers the table edge-to-edge while pinned. */}
      {/* Block banner — tier 1 of the sticky header (36px) */}
      <div
        className="sticky top-0 z-20 flex h-9 items-center gap-2 rounded-t-lg px-3 text-xs font-bold uppercase tracking-wide"
        style={{
          backgroundColor: bannerTint,
          backgroundImage: `linear-gradient(${bannerTint}, ${bannerTint}), linear-gradient(${T.bg}, ${T.bg})`,
          color: accent,
        }}
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
        ref={setTableEl}
        className="w-full border-collapse text-left text-xs"
        style={{ color: T.text, minWidth: "max-content" }}
      >
        {/* Tier 2 of the sticky header — column names stick 36px below the
            banner (top-9), inside the same scroll container. z-20 keeps the
            row above body cells (their sticky rail columns are z-10).
            Task 137 — the row walks cfg.order (display order), while every
            cfg lookup stays in DATA space (dataIdx). */}
        <thead className="sticky top-9 z-20">
          <tr>
            {displayIdxs.map((dataIdx, di) => {
              const h = section.header[dataIdx] ?? "";
              return (
                <th
                  key={dataIdx}
                  className="whitespace-nowrap border-b-2 border-r px-2.5 py-2 font-semibold"
                  style={{
                    borderColor: T.border,
                    color: T.textMuted,
                    backgroundColor: T.bgElevated,
                    backgroundImage: thOpaqueBg,
                    textAlign: cfg.numeric.has(dataIdx)
                      ? "right"
                      : cfg.date.has(dataIdx)
                        ? "center"
                        : "left",
                    ...(cfg.hide.has(dataIdx)
                      ? { minWidth: "0.5rem", padding: "0 0" }
                      : {}),
                    ...railCellStyle(di, T.bgElevated, "0.08"),
                  }}
                >
                  {cfg.hide.has(dataIdx) ? "" : h || "\u00A0"}
                </th>
              );
            })}
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
            // Task 152 — per-row context for the confirm dialogs (дата ·
            // байк · цена): the tap must SHOW which row it touches. Data-space
            // indexes (task 156 layout): Дата 0, Цена 3, Марка 7
            // (SECTION_COLS.rentals).
            const quickCtx: QuickRowCtx = rowRentalId
              ? {
                  date: (r[0] || "").trim(),
                  bike: (r[7] || "").trim(),
                  price: (r[3] || "").trim(),
                }
              : EMPTY_ROW_CTX;
            // Task 152 — a ✓ on a row verified THIS SESSION stays visible but
            // disabled: the button must not vanish under the finger right
            // after a successful tap (the old code dropped it for verified
            // rows, so the next tap at the same spot hit the NEIGHBOR row —
            // an off-by-one self-inflicted by the UI itself).
            const verifiedThisSession = !!(rowRentalId && justVerified?.has(rowRentalId));
            const showQuickVerify =
              !!onQuickVerify &&
              !!rowRentalId &&
              section.key === "rentals" &&
              (verTone !== "verified" || verifiedThisSession);
            // Task 152 — «выслать сверку» affordance: same gating as the ✓,
            // offered while the row is NOT verified yet (waiting / disputed /
            // no row yet — the action creates it).
            const sendPending = !!(rowRentalId && sendingIds?.has(rowRentalId));
            const showSendRequest =
              !!onSendRequest && !!rowRentalId && section.key === "rentals" && verTone !== "verified";
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
                {displayIdxs.map((dataIdx, di) => {
                  const cell = r[dataIdx] ?? "";
                  const isNum = cfg.numeric.has(dataIdx) && isNumericLike(cell);
                  const isDate = cfg.date.has(dataIdx);
                  if (cfg.hide.has(dataIdx)) {
                    return (
                      <td
                        key={dataIdx}
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
                      key={dataIdx}
                      className="border-b border-r px-2.5 py-1.5"
                      title={
                        section.key === "rentals" && dataIdx === cfg.photos && cell
                          ? `${cell.split("+")[0]} фото при выдаче + ${cell.split("+")[1] ?? 0} при возврате`
                          : cell
                      }
                      style={{
                        borderColor: T.border,
                        textAlign: isNum ? "right" : isDate ? "center" : "left",
                        whiteSpace: dataIdx === cfg.notes ? "normal" : "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth:
                          isDate ? "8rem"
                          : dataIdx === cfg.notes ? "16rem"
                          : (dataIdx === cfg.subrenter || dataIdx === cfg.photos) ? "10rem"
                          : undefined,
                        fontVariantNumeric: isNum ? "tabular-nums" : undefined,
                        ...(dataIdx === cfg.subrenter && cell ? { color: "#f59e0b" } : {}),
                        ...(dataIdx === cfg.photos && cell ? { color: "#22c55e", fontWeight: 600 } : {}),
                        ...(dataIdx === cfg.verification && verTone
                          ? { color: verToneFg(verTone, isDark), fontWeight: 700 }
                          : {}),
                        // Task 127 — the operator's label wears their color.
                        ...(opMeta && dataIdx === cfg.opCol ? { color: opMeta.color, fontWeight: 600 } : {}),
                        // Task 137 — sticky rails (left: Дата + Марка, right:
                        // выдал / принял / Верификация) keep the row context
                        // on screen; the middle scrolls beneath them.
                        ...railCellStyle(di, rowBg, "0.06"),
                      }}
                    >
                      {section.key === "rentals" && dataIdx === cfg.verification && (showQuickVerify || verifyPending || forceVerified || showSendRequest || sendPending) ? (
                        // Task 128/152 — «Верификация» cell with the inline ✓
                        // (confirm for both parties) + 📨 (send the verification
                        // REQUEST — operator & owner confirm separately).
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
                              disabled={verifyPending || verifiedThisSession}
                              onClick={(e) => {
                                // The row itself is a tap-through to the rental
                                // page — the ✓ must not trigger it.
                                e.stopPropagation();
                                if (onQuickVerify) void onQuickVerify(rowRentalId, quickCtx);
                              }}
                              aria-label="Подтвердить сверку"
                              title={
                                verTone === "disputed"
                                  ? "Подтвердить сверку — снимет статус спора (после личного разбора с оператором)"
                                  : verifiedThisSession
                                    ? "Сверка подтверждена в этом сеансе"
                                    : "Подтвердить сверку (закрытая аренда; после личной сверки)"
                              }
                              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition hover:opacity-85 focus:outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-60"
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
                          {showSendRequest && (
                            <button
                              type="button"
                              disabled={sendPending || verifiedThisSession}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSendRequest) void onSendRequest(rowRentalId, quickCtx);
                              }}
                              aria-label="Выслать сверку в Telegram"
                              title="Выслать сверку в Telegram — оператор и владелец подтвердят расчёт по отдельности (✅ / ⚠️ в личке)"
                              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition hover:opacity-85 focus:outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-60"
                              style={{
                                borderColor: "color-mix(in srgb, #3b82f6 45%, transparent)",
                                backgroundColor: `color-mix(in srgb, #3b82f6 12%, ${T.bgCard})`,
                                color: isDark ? "#60a5fa" : "#2563eb",
                              }}
                            >
                              {sendPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Send className="h-3.5 w-3.5" aria-hidden />
                              )}
                            </button>
                          )}
                        </span>
                      ) : section.key === "rentals" && dataIdx === cfg.photos && cell ? (
                        <span className="inline-flex items-center gap-1">
                          <Camera className="h-3 w-3" aria-hidden />
                          {cell}
                        </span>
                      ) : opMeta && (di === 0 || dataIdx === cfg.opCol) ? (
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
              {displayIdxs.map((dataIdx, di) => {
                if (cfg.hide.has(dataIdx)) {
                  return (
                    <td
                      key={dataIdx}
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
                const cell = section.totals![dataIdx] ?? "";
                const isNum = cfg.numeric.has(dataIdx) && isNumericLike(cell);
                return (
                  <td
                    key={dataIdx}
                    className="whitespace-nowrap border-t-2 border-r px-2.5 py-2.5 font-bold"
                    style={{
                      borderColor: T.border,
                      textAlign: isNum ? "right" : cfg.date.has(dataIdx) ? "center" : "left",
                      fontVariantNumeric: isNum ? "tabular-nums" : undefined,
                      color: T.text,
                      ...railCellStyle(di, T.bgElevated, "0.06"),
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
