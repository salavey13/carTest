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
 * - Large search input with magnifying glass icon (dominant control)
 * - 4 dropdown filters: Source, Stage, Owner, Sort
 * - Boolean filter pills: Overdue, QR Pending, Missing Docs, Active Rental
 * - View mode toggle (List / Board)
 * - Export button
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
    <section className="space-y-4">
      {/* Row 1: search + dropdowns */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2"
            style={{ color: T.textFaint }}
          />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Имя, телефон, байк, Telegram, договор..."
            className="w-full rounded-2xl border py-4 pl-14 pr-4 text-base outline-none transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              borderColor: searchValue ? `${T.accent}66` : "rgba(255,255,255,0.08)",
              color: T.text,
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
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

      {/* Row 2: pill filters + view toggle + export */}
      <div className="flex flex-wrap items-center gap-2">
        {pills.map((p) => {
          const Icon = p.icon;
          return (
            <motion.button
              key={p.key}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() =>
                onFilterFlagsChange({ [p.key]: !p.active } as Partial<FilterFlags>)
              }
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition"
              style={
                p.active
                  ? {
                      borderColor: `${p.color}4d`,
                      background: `${p.color}1a`,
                      color: p.color,
                    }
                  : {
                      borderColor: "rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.03)",
                      color: T.textMuted,
                    }
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {p.label}
            </motion.button>
          );
        })}

        {/* View mode toggle */}
        <div
          className="ml-auto flex rounded-full border p-1"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
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
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
                style={
                  active
                    ? { background: T.accent, color: T.accentContrast }
                    : { color: T.textMuted }
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Export */}
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition hover:bg-white/5"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: T.textMuted }}
        >
          <Download className="h-3.5 w-3.5" /> Экспорт
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition"
        style={{
          borderColor: open ? T.accent : "rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.03)",
          color: T.text,
        }}
      >
        <span style={{ color: T.textMuted }}>{label}:</span>
        <span className="max-w-[120px] truncate font-medium">{selected?.label || "—"}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
          style={{ color: T.textMuted }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-20 mt-2 min-w-[200px] max-h-[320px] overflow-y-auto rounded-2xl border p-1.5"
            style={{
              background: "#161618",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
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
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition hover:bg-white/5"
                  style={{ color: active ? T.accent : T.text }}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
