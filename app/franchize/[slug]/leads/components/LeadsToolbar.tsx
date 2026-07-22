"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronDown,
  Check,
  LayoutList,
  Columns3,
  Download,
  AlertTriangle,
  QrCode,
  FileText,
  Bike,
} from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";
import type {
  FilterFlags,
  SortModeV2,
  ViewMode,
} from "@/app/franchize/[slug]/leads/leads-constants";
import {
  STAGE_LABELS,
} from "@/app/franchize/[slug]/leads/lib/pipeline-stages";

interface Props {
  searchValue: string;
  onSearchChange: (v: string) => void;
  sortValue: SortModeV2;
  onSortChange: (v: SortModeV2) => void;
  sourceValue: string;
  onSourceChange: (v: string) => void;
  availableSources: string[];
  ownerValue: string;
  onOwnerChange: (v: string) => void;
  availableOwners?: string[];
  stageValue: string;
  onStageChange: (v: string) => void;
  filterFlags: FilterFlags;
  onFilterFlagsChange: (f: Partial<FilterFlags>) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onExport: () => void;
  T: ThemeTokens;
}

const SORT_OPTIONS: Array<{ value: SortModeV2; label: string }> = [
  { value: "recent", label: "Свежие" },
  { value: "urgent", label: "🔥 Срочные" },
  { value: "sla", label: "⏱ По SLA" },
  { value: "return_due", label: "🏁 Возврат" },
  { value: "overdue_todos", label: "⚠ Просроч. задачи" },
  { value: "spent", label: "💰 По выручке" },
  { value: "name", label: "А → Я" },
];

/**
 * Search + filters toolbar.
 *
 * Layout:
 *   Row 1 (mobile): full-width search input on its own line.
 *   Row 1 (desktop): search (flex-1) + dropdown row inline.
 *   Row 2 (mobile): dropdowns wrap to second row (flex-wrap), full-width each.
 *   Row 2 (desktop): dropdowns in a row + view toggle + export on the right.
 *
 * All touch targets are ≥44px (min-h-[44px]) for accessibility.
 * Filter pills are horizontally scrollable on mobile (overflow-x-auto with
 * hidden scrollbar) so they don't push the layout wider than the viewport.
 */
export function LeadsToolbar(props: Props) {
  const {
    searchValue,
    onSearchChange,
    sortValue,
    onSortChange,
    sourceValue,
    onSourceChange,
    availableSources,
    ownerValue,
    onOwnerChange,
    availableOwners,
    stageValue,
    onStageChange,
    filterFlags,
    onFilterFlagsChange,
    viewMode,
    onViewModeChange,
    onExport,
    T,
  } = props;

  const pills = [
    {
      key: "overdueOnly" as const,
      label: "Просроченные",
      icon: AlertTriangle,
      color: "#ef4444",
      active: filterFlags.overdueOnly,
    },
    {
      key: "unclaimedQrOnly" as const,
      label: "QR не принят",
      icon: QrCode,
      color: "#f59e0b",
      active: filterFlags.unclaimedQrOnly,
    },
    {
      key: "documentsMissingOnly" as const,
      label: "Документы",
      icon: FileText,
      color: "#facc15",
      active: filterFlags.documentsMissingOnly,
    },
    {
      key: "activeRentalOnly" as const,
      label: "Активные",
      icon: Bike,
      color: "#22c55e",
      active: filterFlags.activeRentalOnly,
    },
  ];

  return (
    <section className="space-y-3">
      {/* Row 1: search (full width mobile) + dropdowns (wrap to next row on mobile) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search input — full width on mobile, flex-1 on desktop */}
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 md:left-5"
            style={{ color: T.textFaint }}
            aria-hidden
          />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Имя, телефон, байк, Telegram, договор..."
            aria-label="Поиск лидов"
            className="w-full min-h-[44px] rounded-2xl border py-3 pl-12 pr-4 text-base outline-none transition md:pl-14"
            style={{
              background: T.inputBg,
              borderColor: searchValue ? T.borderActive : T.inputBorder,
              color: T.text,
            }}
          />
        </div>

        {/* Dropdowns row — wraps on mobile so each gets its own line if needed */}
        <div className="flex flex-wrap gap-2 lg:flex-nowrap">
          <Dropdown
            label="Источник"
            value={sourceValue}
            onChange={onSourceChange}
            T={T}
            options={[
              { value: "all", label: "Все источники" },
              ...availableSources.map((s) => ({ value: s, label: s })),
            ]}
          />
          <Dropdown
            label="Стадия"
            value={stageValue}
            onChange={onStageChange}
            T={T}
            options={[
              { value: "all", label: "Все стадии" },
              ...Object.entries(STAGE_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <Dropdown
            label="Ответственный"
            value={ownerValue}
            onChange={onOwnerChange}
            T={T}
            options={[
              { value: "all", label: "Все" },
              ...(availableOwners || []).map((o) => ({ value: o, label: o })),
            ]}
          />
          <Dropdown
            label="Сортировка"
            value={sortValue}
            onChange={(v) => onSortChange(v as SortModeV2)}
            T={T}
            options={SORT_OPTIONS}
          />
        </div>
      </div>

      {/* Row 2: horizontally-scrollable filter pills + view toggle + export */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Pills row — horizontally scrollable on mobile with hidden scrollbar */}
        <div
          className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:px-0 lg:overflow-visible lg:pb-0"
          style={{ scrollbarWidth: "none" }}
          aria-label="Быстрые фильтры"
        >
          {pills.map((p) => {
            const Icon = p.icon;
            return (
              <motion.button
                key={p.key}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", damping: 22, stiffness: 320 }}
                type="button"
                onClick={() =>
                  onFilterFlagsChange({ [p.key]: !p.active } as Partial<FilterFlags>)
                }
                aria-pressed={p.active}
                className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition"
                style={
                  p.active
                    ? {
                        borderColor: `${p.color}4d`,
                        background: `${p.color}1a`,
                        color: p.color,
                      }
                    : {
                        borderColor: T.border,
                        background: T.bgCard,
                        color: T.textMuted,
                      }
                }
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="whitespace-nowrap">{p.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* View mode toggle — 44px touch target */}
        <div
          className="ml-auto flex rounded-full border p-1"
          style={{ borderColor: T.border }}
          role="group"
          aria-label="Режим отображения"
        >
          {(
            [
              { v: "list", icon: LayoutList, label: "Список" },
              { v: "board", icon: Columns3, label: "Воронка" },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = viewMode === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => onViewModeChange(opt.v)}
                aria-pressed={active}
                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
                style={
                  active
                    ? { background: T.accent, color: T.accentContrast }
                    : { color: T.textMuted }
                }
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Export — 44px target */}
        <button
          type="button"
          onClick={onExport}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition"
          style={{ borderColor: T.border, color: T.textMuted }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.bgCardHover;
            e.currentTarget.style.color = T.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = T.textMuted;
          }}
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Экспорт
        </button>
      </div>
    </section>
  );
}

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
  T: ThemeTokens;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative min-w-0 flex-1 lg:min-w-[160px] lg:flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm transition lg:w-auto"
        style={{
          borderColor: open ? T.borderActive : T.border,
          background: T.bgCard,
          color: T.text,
        }}
      >
        <span className="shrink-0" style={{ color: T.textMuted }}>
          {label}:
        </span>
        <span className="min-w-0 max-w-[120px] flex-1 truncate font-medium">
          {selected?.label || "—"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`}
          style={{ color: T.textMuted }}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="absolute right-0 z-[60] mt-2 min-w-[200px] max-h-[320px] overflow-y-auto rounded-2xl border p-1.5"
            style={{
              background: T.bgElevated,
              borderColor: T.border,
              boxShadow: T.shadow,
            }}
            role="listbox"
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
                  role="option"
                  aria-selected={active}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm transition"
                  style={{
                    color: active ? T.accent : T.text,
                    background: active ? T.bgCardHover : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = T.bgCardHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
