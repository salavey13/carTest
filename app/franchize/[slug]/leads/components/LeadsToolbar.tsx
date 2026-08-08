// /app/franchize/[slug]/leads/components/LeadsToolbar.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  ChevronDown,
  Check,
  LayoutList,
  Columns3,
  ShieldAlert,
  Flame,
  CheckCircle,
  Phone,
  AlertCircle,
} from "lucide-react";
import { type Segment } from "../leads-constants";

// ── Segment metadata for the chip row ──
const SEGMENT_META: Record<Segment, { label: string; icon: any; color: string }> = {
  all: { label: "Все", icon: LayoutList, color: "#64748b" },
  hot: { label: "Горячие", icon: Flame, color: "#ef4444" },
  verified: { label: "Клиенты", icon: CheckCircle, color: "#10b981" },
  warm: { label: "Заявки", icon: Phone, color: "#3b82f6" },
  troubled: { label: "Проблемные", icon: AlertCircle, color: "#dc2626" },
};

// ── Sort options ──
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "recent", label: "Свежие" },
  { value: "urgent", label: "🔥 Срочные" },
  { value: "spent", label: "💰 По выручке" },
  { value: "name", label: "А → Я" },
];

// ── Stage options (from STAGE_LABELS + board columns) ──
const STAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Все стадии" },
  { value: "new", label: "Новые" },
  { value: "contacted", label: "В работе" },
  { value: "configured", label: "Настроил" },
  { value: "contract_generated", label: "Договор" },
  { value: "completed", label: "Завершено" },
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
  viewMode: "list" | "board";
  setViewMode?: (v: "list" | "board") => void;
  onViewModeChange?: (v: "list" | "board") => void;
  hidePlaceholders: boolean;
  setHidePlaceholders: (v: boolean) => void;
  filterFlags?: any;
  onFilterFlagsChange?: any;
  T: any;
  isAuto: boolean;
}) {
  // Resolve the view-mode setter — prefer onViewModeChange (newer API),
  // fall back to setViewMode (older API).
  const handleViewModeChange = (v: "list" | "board") => {
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
      {/* ── Row 1: search input (full width on mobile) ── */}
      <div className="relative flex-1 sm:max-w-sm">
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
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 transition hover:opacity-80"
            style={{ color: T.textFaint }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Row 2: labeled dropdown filters + view toggle ──
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
            ...availableSources.map((s) => ({ value: s, label: s })),
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

        {/* View mode toggle — Список / Воронка */}
        <div
          className="flex rounded-xl border p-1"
          style={{ flexShrink: 0, borderColor: T.border, backgroundColor: T.bgElevated }}
        >
          <button
            onClick={() => handleViewModeChange("list")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              viewMode === "list" ? "" : "hover:opacity-70"
            }`}
            style={viewMode === "list" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}
          >
            <LayoutList className="h-3.5 w-3.5" /> Список
          </button>
          <button
            onClick={() => handleViewModeChange("board")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              viewMode === "board" ? "" : "hover:opacity-70"
            }`}
            style={viewMode === "board" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}
          >
            <Columns3 className="h-3.5 w-3.5" /> Воронка
          </button>
        </div>

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
// menu with all options. On mobile it sits inside an overflow-x-auto parent
// so the row scrolls horizontally without inducing page-level scroll.
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
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" style={{ flexShrink: 0 }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 z-30 mt-1.5 min-w-[180px] max-h-[300px] overflow-y-auto rounded-xl border p-1"
            style={{
              backgroundColor: T.bgCard,
              borderColor: T.border,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
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
      </AnimatePresence>
    </div>
  );
}
