// /app/franchize/[slug]/leads/components/LeadsToolbar.tsx
"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  ChevronDown,
  Check,
  LayoutList,
  Columns3,
  Table2,
  ShieldAlert,
  Flame,
  CheckCircle,
  Phone,
  AlertCircle,
} from "lucide-react";
import { type Segment, SOURCE_META, SOURCE_GROUPS, sourceGroupOf } from "../leads-constants";

// ── Segment metadata for the chip row ──
const SEGMENT_META: Record<Segment, { label: string; icon: any; color: string }> = {
  all: { label: "Все", icon: LayoutList, color: "#64748b" },
  hot: { label: "Горячие", icon: Flame, color: "#ef4444" },
  verified: { label: "Клиенты", icon: CheckCircle, color: "#10b981" },
  warm: { label: "Заявки", icon: Phone, color: "#3b82f6" },
  troubled: { label: "Проблемные", icon: AlertCircle, color: "#dc2626" },
};

// ── Sort options ──
// "priority" — дефолт: итоговый индекс приоритета 0–100 (LIFO-свежесть,
// температура, задачи, LTV, этап; Авито ×2). См. lib/lead-priority.ts.
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "priority", label: "🔥 Приоритет" },
  { value: "recent", label: "Свежие" },
  { value: "urgent", label: "⏱ Срочность" },
  { value: "spent", label: "💰 По выручке" },
  { value: "name", label: "А → Я" },
];

// ── Stage options ──
// FIX: these values are matched against the lead's COMPUTED pipeline stage
// (stageKey: new / needs_contact / contract_sent / …), not the raw DB stage.
// The old list (contacted/configured/completed) mostly matched nothing —
// "Настроил"/"Завершено" never exist as stageKey, and "Новые" missed every
// lead whose DB stage was lead_captured/viewed → the filter looked dead.
const STAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Все стадии" },
  // Виртуальный фильтр: все лиды канала Авито (isAvitoLead), независимо от
  // стадии — обрабатывается в LeadsClient отдельно от стадийных значений.
  { value: "avito", label: "🟢 Авито (все)" },
  { value: "new", label: "Новые" },
  { value: "needs_contact", label: "Нужен контакт" },
  { value: "contract_sent", label: "Договор отправлен" },
  { value: "awaiting_qr_claim", label: "QR не принят" },
  { value: "documents_missing", label: "Нет документов" },
  { value: "active_rental", label: "Активные" },
  { value: "return_due", label: "Возврат" },
  { value: "closed_won", label: "Закрыто" },
  { value: "closed_lost", label: "Потеряно" },
];

export function LeadsToolbar({
  // Search
  searchQuery,
  setSearchQuery,
  // Source filter
  filterSource,
  setFilterSource,
  availableSources,
  // Sort
  sortMode,
  setSortMode,
  // Stage filter (NEW)
  filterStage,
  setFilterStage,
  // Owner filter (NEW)
  filterOwner,
  setFilterOwner,
  availableOwners,
  // Segment chips
  segment,
  setSegment,
  segmentCounts,
  // View mode
  viewMode,
  setViewMode,
  onViewModeChange,
  // Placeholders toggle
  hidePlaceholders,
  setHidePlaceholders,
  // Unused v2 props (accepted for compatibility)
  filterFlags,
  onFilterFlagsChange,
  // Theme
  T,
  isAuto,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterSource: string;
  setFilterSource: (v: string) => void;
  availableSources: string[];
  sortMode: string;
  setSortMode: (v: string) => void;
  filterStage?: string;
  setFilterStage?: (v: string) => void;
  filterOwner?: string;
  setFilterOwner?: (v: string) => void;
  availableOwners?: string[];
  segment: Segment;
  setSegment: (v: Segment) => void;
  segmentCounts?: Partial<Record<Segment, number>>;
  viewMode: "list" | "board" | "table";
  setViewMode?: (v: "list" | "board" | "table") => void;
  onViewModeChange?: (v: "list" | "board" | "table") => void;
  hidePlaceholders: boolean;
  setHidePlaceholders: (v: boolean) => void;
  filterFlags?: any;
  onFilterFlagsChange?: any;
  T: any;
  isAuto: boolean;
}) {
  // Resolve the view-mode setter — prefer onViewModeChange (newer API),
  // fall back to setViewMode (older API).
  const handleViewModeChange = (v: "list" | "board" | "table") => {
    if (onViewModeChange) onViewModeChange(v);
    else if (setViewMode) setViewMode(v);
  };

  return (
    <div
      className="sticky top-0 z-10 -mx-4 space-y-3 border-b px-4 py-3 backdrop-blur-md sm:rounded-2xl sm:border"
      style={{
        backgroundColor: isAuto
          ? `color-mix(in srgb, var(--franchize-bg-base) 88%, transparent)`
          : T.bgCard,
        borderColor: T.border,
      }}
    >
      {/* ── Row 1: search input + view toggle (ALWAYS visible) ──
          FIX (iter6, "kanban view got missing"): the Список/Воронка toggle
          used to live at the END of the horizontally-scrolling filter row —
          on a phone it sat off-screen after 4 dropdowns, with the scrollbar
          hidden (scrollbarWidth: none), so the kanban looked "missing".
          The view toggle now sits next to the search box on its own row and
          gains a third mode — Таблица (analytics-style table view). */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: T.textFaint }}
          />
          <input
            type="text"
            placeholder="Имя, телефон, байк, Telegram…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border py-2.5 pl-10 pr-9 text-sm outline-none transition focus:ring-2 focus:ring-offset-0"
            style={{
              backgroundColor: T.inputBg,
              borderColor: T.inputBorder,
              color: T.text,
              "--tw-ring-color": T.borderActive,
            } as React.CSSProperties}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 transition hover:opacity-80"
              style={{ color: T.textFaint }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View mode toggle — Список / Воронка / Таблица (icon-only on mobile) */}
        <div
          className="flex shrink-0 rounded-xl border p-1"
          style={{ borderColor: T.border, backgroundColor: T.bgElevated }}
          role="group"
          aria-label="Режим просмотра"
        >
          <button
            onClick={() => handleViewModeChange("list")}
            title="Список"
            aria-label="Список"
            aria-pressed={viewMode === "list"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 ${
              viewMode === "list" ? "" : "hover:opacity-70"
            }`}
            style={viewMode === "list" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}
          >
            <LayoutList className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Список</span>
          </button>
          <button
            onClick={() => handleViewModeChange("board")}
            title="Воронка (канбан)"
            aria-label="Воронка (канбан)"
            aria-pressed={viewMode === "board"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 ${
              viewMode === "board" ? "" : "hover:opacity-70"
            }`}
            style={viewMode === "board" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}
          >
            <Columns3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Воронка</span>
          </button>
          <button
            onClick={() => handleViewModeChange("table")}
            title="Таблица"
            aria-label="Таблица"
            aria-pressed={viewMode === "table"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 ${
              viewMode === "table" ? "" : "hover:opacity-70"
            }`}
            style={viewMode === "table" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}
          >
            <Table2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Таблица</span>
          </button>
        </div>
      </div>

      {/* ── Row 2: labeled dropdown filters ──
          Mobile: horizontal scroll (single row, no page overflow).
          Desktop: normal flex-wrap.
          Each Dropdown + the view toggle is shrink-0 so they keep their
          natural width and the row scrolls horizontally inside the toolbar
          container instead of inducing page-level horizontal scroll. */}
      <div
        className="pb-1 sm:pb-0"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Dropdown
          label="Источник"
          value={filterSource}
          onChange={setFilterSource}
          T={T}
          options={[
            { value: "all", label: "Все источники" },
            // Virtual filter: selects leads by CHANNEL (Avito webhook/forwards),
            // handled in filterLeads — see isAvitoLead().
            { value: "avito", label: "Авито" },
            // FIX («2 тест-драйва, 2 аренды…»): опции строятся по КАНОНИЧЕСКОЙ
            // группе источника (sourceGroupOf), а не по сырому slug. Раньше
            // test_drive и testdrive_contract (оба «Тест-драйв»), rental_contract
            // и rent (обе «Аренда»), sale_contract и sale (обе «Покупка»)
            // давали по две визуально одинаковые опции, каждая из которых
            // фильтровала только «свои» лиды. Теперь одна опция = вся группа.
            ...(() => {
              const byGroup = new Map<string, string>();
              for (const s of availableSources) {
                const g = sourceGroupOf(s);
                if (!byGroup.has(g)) {
                  byGroup.set(g, SOURCE_GROUPS[g]?.label || SOURCE_META[s]?.label || s);
                }
              }
              return Array.from(byGroup.entries())
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.label.localeCompare(b.label, "ru"));
            })(),
          ]}
        />

        {setFilterStage && (
          <Dropdown
            label="Стадия"
            value={filterStage || "all"}
            onChange={setFilterStage}
            T={T}
            options={STAGE_OPTIONS}
          />
        )}

        {setFilterOwner && (
          <Dropdown
            label="Ответственный"
            value={filterOwner || "all"}
            onChange={setFilterOwner}
            T={T}
            options={[
              { value: "all", label: "Все" },
              ...(availableOwners || []).map((o) => ({ value: o, label: o })),
            ]}
          />
        )}

        <Dropdown
          label="Сортировка"
          value={sortMode}
          onChange={(v) => setSortMode(v)}
          T={T}
          options={SORT_OPTIONS}
        />

        {/* Hide operator placeholders toggle */}
        <button
          onClick={() => setHidePlaceholders(!hidePlaceholders)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
            hidePlaceholders ? "" : "opacity-50"
          }`}
          style={{
            flexShrink: 0,
            borderColor: hidePlaceholders ? "#f59e0b40" : T.border,
            color: hidePlaceholders ? "#f59e0b" : T.textMuted,
            backgroundColor: hidePlaceholders ? "#f59e0b10" : "transparent",
          }}
          title={hidePlaceholders ? "Показать заглушки операторов" : "Скрыть заглушки операторов"}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {hidePlaceholders ? "Без опер." : "С опер."}
        </button>
      </div>

      {/* ── Row 3: segment chips — horizontal scroll on all sizes ── */}
      <div
        className="pb-1"
        style={{
          display: "flex",
          gap: "4px",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {(Object.keys(SEGMENT_META) as Segment[]).map((key) => {
          const meta = SEGMENT_META[key];
          const Icon = meta.icon;
          const active = segment === key;
          const count = segmentCounts?.[key];
          return (
            <button
              key={key}
              onClick={() => setSegment(key)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                active ? "" : "hover:opacity-80"
              }`}
              style={
                active
                  ? { flexShrink: 0, backgroundColor: meta.color + "15", color: meta.color, borderColor: meta.color + "40" }
                  : { flexShrink: 0, color: T.textMuted, borderColor: "transparent" }
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
              {count !== undefined && (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                  style={
                    active
                      ? { backgroundColor: meta.color + "30", color: meta.color }
                      : { backgroundColor: T.borderSoft, color: T.textFaint }
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Dropdown component ──
// Renders a button with `{label}: {selected value}` + chevron, and a popover
// menu with all options.
//
// FIX ("dropdowns are empty"): the popover used to be `position: absolute`
// INSIDE the horizontally-scrolling filter row (overflowX:auto +
// overflowY:hidden). Any absolutely-positioned child that extends below the
// ~36px-tall row gets CLIPPED by overflow-y — so the menu opened but was
// invisible (looked like an empty dropdown). Now the popover renders through
// a React portal into document.body with `position: fixed` anchored to the
// button's bounding rect, immune to any ancestor overflow clipping. It also
// flips up when there's more room above than below (phone keyboards, bottom
// of the page) and closes on outside click, Escape, scroll and resize.
function Dropdown({
  label,
  value,
  onChange,
  options,
  T,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  T: any;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Portal target only exists client-side after hydration.
  useEffect(() => setMounted(true), []);

  // Measure the button each time the menu opens (page may have scrolled since).
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const width = Math.max(200, Math.min(r.width, window.innerWidth - 16));
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setRect({ top: r.bottom, left, width });
  }, [open]);

  // Close on outside click (button + portal menu), Escape, scroll, resize.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // FIX ("list disappears on first touch, not even click"): the old handler
    // closed the menu on ANY scroll event (capture: true) — INCLUDING the
    // menu's own touch-scroll. On mobile, the first drag on a long list made
    // the menu itself fire `scroll` (it is the overflow-y-auto container),
    // the capture listener caught it, and the menu instantly closed, making
    // long lists impossible to scroll. Now scrolls that originate INSIDE the
    // open menu are ignored; only page/row scrolls (which detach the menu
    // from its anchor button) close it.
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReflow = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    // Any scroll OUTSIDE the menu (incl. the horizontal filter row itself)
    // detaches the menu from the button — close instead of drifting.
    // capture:true so inner scroll containers are caught too.
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const menuHeight = 300; // matches the previous max-h
  // Flip the menu ABOVE the button when there's not enough room below.
  const flipUp = !!rect && rect.top + menuHeight > window.innerHeight && rect.top > menuHeight;
  const menuStyle: React.CSSProperties | undefined = rect
    ? {
        position: "fixed",
        top: flipUp ? undefined : rect.top + 6,
        bottom: flipUp ? window.innerHeight - rect.top + 6 : undefined,
        left: rect.left,
        minWidth: rect.width,
        maxHeight: 300,
      }
    : { position: "fixed", top: -9999, left: -9999 };

  return (
    <div className="relative" style={{ flexShrink: 0 }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-xl border whitespace-nowrap transition"
        style={{
          borderColor: open ? T.borderActive : T.inputBorder,
          backgroundColor: T.inputBg,
          color: T.text,
          fontSize: "10px",
          lineHeight: "1",
          padding: "7px 9px",
          maxWidth: "140px",
          overflow: "hidden",
        }}
      >
        <span style={{ color: T.textMuted, flexShrink: 0 }}>{label}:</span>
        <span
          style={{
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "70px",
          }}
        >
          {selected?.label || "—"}
        </span>
        <ChevronDown
          className={`h-2.5 w-2.5 shrink-0 transition ${open ? "rotate-180" : ""}`}
          style={{ color: T.textMuted }}
        />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="listbox"
              initial={{ opacity: 0, y: flipUp ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: flipUp ? 4 : -4 }}
              transition={{ duration: 0.12 }}
              className="fixed z-[80] max-h-[300px] overflow-y-auto rounded-xl border p-1"
              style={{
                ...menuStyle,
                backgroundColor: T.bgCard,
                borderColor: T.border,
                boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
                // Scroll containment: touching the list at its top/bottom edge
                // must rubber-band INSIDE the menu instead of chaining the
                // scroll to the page behind (which would detach + close the
                // menu via the scroll listener above).
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition hover:opacity-80"
                    style={{ color: active ? T.borderActive : T.text }}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
