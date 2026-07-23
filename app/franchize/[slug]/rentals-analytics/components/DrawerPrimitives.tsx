"use client";

// /analytics/components/DrawerPrimitives.tsx
//
// Shared sub-components used by RentalDetailDrawer, SaleDetailDrawer, and
// ServiceDetailDrawer. Mirrors the LeadInfoGrid / LeadSLAOverview / Section
// pattern from the leads page v2.

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Check, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import type { SlaSignal, Tone } from "./types";
import { toneColor } from "./lib/analytics-utils";

// ── Section (collapsible) ────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: LucideIcon;
  count?: number;
  expanded?: boolean;
  onToggle?: () => void;
  T: ThemeTokens;
  children: ReactNode;
  rightAction?: ReactNode;
}

export function DrawerSection({
  title,
  icon: Icon,
  count,
  expanded = true,
  onToggle,
  T,
  children,
  rightAction,
}: SectionProps) {
  const [internalOpen, setInternalOpen] = useState(expanded);
  const isOpen = onToggle ? expanded : internalOpen;
  const toggle = onToggle ?? (() => setInternalOpen((v) => !v));

  return (
    <section className="rounded-2xl border" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 rounded-2xl p-3 text-left transition focus:outline-none focus-visible:ring-2"
        style={{ minHeight: "44px" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" style={{ color: T.textMuted }} aria-hidden />
          <span className="truncate text-sm font-semibold" style={{ color: T.text }}>
            {title}
          </span>
          {typeof count === "number" && count > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
              style={{
                backgroundColor: T.bgElevated,
                color: T.textMuted,
              }}
            >
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {rightAction}
          <ChevronDown
            className="h-4 w-4 transition-transform"
            style={{
              color: T.textMuted,
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
            aria-hidden
          />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ── Info grid ────────────────────────────────────────────────────────────────

export interface InfoTile {
  label: string;
  value: string | number | null | undefined;
  copyable?: boolean;
  tone?: Tone;
}

interface DrawerInfoGridProps {
  items: InfoTile[];
  T: ThemeTokens;
}

export function DrawerInfoGrid({ items, T }: DrawerInfoGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((tile, i) => (
        <div
          key={i}
          className="rounded-xl border p-2.5"
          style={{
            borderColor: T.borderSoft,
            backgroundColor: T.bgElevated,
          }}
        >
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: T.textFaint }}
          >
            {tile.label}
          </p>
          <p
            className="mt-0.5 truncate text-sm font-medium"
            style={{
              color: tile.tone ? toneColor(tile.tone) : T.text,
            }}
            title={tile.value != null ? String(tile.value) : undefined}
          >
            {tile.value != null && tile.value !== "" ? tile.value : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── SLA overview ─────────────────────────────────────────────────────────────

interface DrawerSlaOverviewProps {
  signals: SlaSignal[];
  T: ThemeTokens;
}

export function DrawerSlaOverview({ signals, T }: DrawerSlaOverviewProps) {
  if (signals.length === 0) {
    return (
      <div
        className="rounded-2xl border p-3 text-sm"
        style={{ borderColor: T.border, backgroundColor: T.bgCard, color: T.textMuted }}
      >
        Нет активных сигналов SLA
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-2 rounded-2xl border p-3 lg:grid-cols-4"
      style={{ borderColor: T.border, backgroundColor: T.bgCard }}
      role="region"
      aria-label="SLA индикаторы"
    >
      {signals.map((sig) => {
        const c = toneColor(sig.tone);
        return (
          <div key={sig.key} className="min-w-0">
            <p
              className="truncate text-[10px] uppercase tracking-wider"
              style={{ color: T.textFaint }}
            >
              {sig.label}
            </p>
            <p
              className="mt-0.5 truncate text-base font-bold tabular-nums"
              style={{ color: c }}
            >
              {sig.value}
            </p>
            {sig.detail && (
              <p
                className="mt-0.5 truncate text-[10px]"
                style={{ color: T.textMuted }}
                title={sig.detail}
              >
                {sig.detail}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Primary actions ──────────────────────────────────────────────────────────

export interface PrimaryAction {
  icon: LucideIcon;
  label: string;
  action: string;
  color: string;
}

interface DrawerPrimaryActionsProps {
  actions: PrimaryAction[];
  onAction: (action: string) => void;
  T: ThemeTokens;
}

export function DrawerPrimaryActions({ actions, onAction, T }: DrawerPrimaryActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {actions.map((b) => {
        const Icon = b.icon;
        return (
          <motion.button
            key={b.action}
            type="button"
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -1 }}
            transition={{ type: "spring", damping: 22, stiffness: 320 }}
            onClick={() => onAction(b.action)}
            aria-label={b.label}
            className="flex min-h-[88px] cursor-pointer flex-col items-start justify-between rounded-2xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 md:min-h-[100px] md:p-4"
            style={{
              borderColor: `${b.color}33`,
              backgroundColor: `${b.color}14`,
              color: b.color,
            }}
          >
            <Icon className="h-6 w-6" aria-hidden />
            <div className="mt-2 text-sm font-medium">{b.label}</div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Sticky footer ────────────────────────────────────────────────────────────

interface DrawerStickyFooterProps {
  label: string;
  onClick: () => void;
  T: ThemeTokens;
  icon?: LucideIcon;
}

export function DrawerStickyFooter({
  label,
  onClick,
  T,
  icon: Icon,
}: DrawerStickyFooterProps) {
  return (
    <div
      className="sticky bottom-0 mt-4 -mx-4 border-t px-4 py-3 sm:-mx-5 sm:px-5"
      style={{
        borderColor: T.border,
        backgroundColor: T.bg,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2"
        style={{
          backgroundColor: T.accent,
          color: T.accentContrast,
          minHeight: "44px",
        }}
      >
        {Icon && <Icon className="h-4 w-4" aria-hidden />}
        {label}
      </button>
    </div>
  );
}

// ── Todo row ─────────────────────────────────────────────────────────────────

interface TodoRowProps {
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeName?: string | null;
  T: ThemeTokens;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#64748b",
};

export function DrawerTodoRow({
  title,
  status,
  priority,
  dueDate,
  assigneeName,
  T,
}: TodoRowProps) {
  const isDone = status === "done";
  const isOverdue =
    !!dueDate &&
    new Date(dueDate).getTime() < Date.now() &&
    status !== "done";
  const pColor = PRIORITY_COLOR[priority] || "#64748b";

  return (
    <div
      className="flex min-h-[44px] items-start gap-2 rounded-xl border p-2.5"
      style={{
        borderColor: T.border,
        backgroundColor: T.bgElevated,
        opacity: isDone ? 0.6 : 1,
      }}
    >
      <div
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
        style={{
          backgroundColor: isDone ? "#22c55e15" : T.bgCard,
          color: isDone ? "#22c55e" : T.textMuted,
        }}
        aria-hidden
      >
        {isDone ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-40" />}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium"
          style={{
            color: T.text,
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {title}
        </p>
        <div
          className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]"
          style={{ color: T.textFaint }}
        >
          <span style={{ color: pColor }}>{priority}</span>
          {dueDate && (
            <span
              className="tabular-nums"
              style={{ color: isOverdue ? "#ef4444" : T.textFaint }}
            >
              {isOverdue ? "Просрочено: " : "Срок: "}
              {new Date(dueDate).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {assigneeName && <span>· {assigneeName}</span>}
        </div>
      </div>
    </div>
  );
}

// ── History row ──────────────────────────────────────────────────────────────

interface HistoryRowProps {
  label: string;
  timestamp: string;
  detail?: string;
  color: string;
  T: ThemeTokens;
}

export function DrawerHistoryRow({ label, timestamp, detail, color, T }: HistoryRowProps) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div
          className="w-px flex-1"
          style={{ backgroundColor: T.border }}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <p className="text-sm font-medium" style={{ color: T.text }}>
          {label}
        </p>
        {detail && (
          <p className="mt-0.5 text-xs" style={{ color: T.textMuted }}>
            {detail}
          </p>
        )}
        <p className="mt-0.5 text-[10px] tabular-nums" style={{ color: T.textFaint }}>
          {new Date(timestamp).toLocaleString("ru-RU", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

// ── Add note input (controlled) ──────────────────────────────────────────────

interface AddNoteInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  T: ThemeTokens;
}

export function DrawerAddNoteInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Добавить заметку…",
  T,
}: AddNoteInputProps) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
        style={{
          borderColor: T.inputBorder,
          backgroundColor: T.inputBg,
          color: T.text,
          minHeight: "44px",
        }}
      />
      <button
        type="button"
        onClick={() => value.trim() && onSubmit()}
        disabled={!value.trim()}
        aria-label="Добавить"
        className="shrink-0 rounded-xl border px-3 transition focus:outline-none focus-visible:ring-2 disabled:opacity-40"
        style={{
          borderColor: T.border,
          backgroundColor: T.bgCard,
          color: T.text,
          minHeight: "44px",
          cursor: value.trim() ? "pointer" : "default",
        }}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

// ── Empty hint ───────────────────────────────────────────────────────────────

interface DrawerEmptyHintProps {
  label: string;
  T: ThemeTokens;
}

export function DrawerEmptyHint({ label, T }: DrawerEmptyHintProps) {
  return (
    <p className="py-2 text-sm" style={{ color: T.textMuted }}>
      {label}
    </p>
  );
}
