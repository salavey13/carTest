"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Flame, Phone, CheckCircle, ChevronDown, ChevronRight, Plus,
  Trash2, Send, Clock, TrendingUp, Search, X, Bike, FileText,
  CircleDot, Users, Lock, AlertCircle, LayoutList, Columns3,
  Calendar, UserPlus, Download, Star, Filter, StickyNote, History,
  MapPin, ExternalLink, Banknote, Briefcase, ShieldAlert, Hash,
  MessageSquare, Wallet, Gauge, Activity, Check, Loader2, XCircle,
  RotateCcw, Camera, ShieldCheck, Eye, ImageOff, RefreshCw
} from "lucide-react";
import { validateAnalyticsPassword, activateRental, updateRentalStatus } from "../../server-actions/rentals-dashboard";
import { getRentalDocVerification, type DocVerificationData } from "../../server-actions/leads";
import type { LeadRow, LeadTodoRow, LeadRentalRow, LeadSaleRow } from "../../server-actions/leads";
import { getLeadNotes, createLeadNote, deleteLeadNote, type LeadNote } from "../../server-actions/lead-notes";

// ── Types ────────────────────────────────────────────────────────────────────

interface LeadsClientProps {
  leads: LeadRow[];
  todos: LeadTodoRow[];
  crewId: string;
  slug: string;
  accentColor: string;
  textColor?: string;
  bgColor?: string;
  isLightTheme?: boolean;
  isAuto?: boolean;
}

type ViewMode = "list" | "board";
type Segment = "all" | "hot" | "verified" | "warm" | "troubled";
type SortMode = "recent" | "urgent" | "name" | "spent";
type DetailSection = "contacts" | "deals" | "tasks" | "notes";

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; icon: typeof Flame; color: string; bg: string }> = {
  web_callback:    { label: "Звонок",       icon: Phone,        color: "#3b82f6", bg: "#3b82f620" },
  rental_contract: { label: "Аренда",       icon: CheckCircle,  color: "#10b981", bg: "#10b98120" },
  sale_contract:   { label: "Покупка",      icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  test_drive:      { label: "Тест-драйв",   icon: Bike,         color: "#8b5cf6", bg: "#8b5cf620" },
  app_open:        { label: "Открыл приложение", icon: Users,   color: "#64748b", bg: "#64748b20" },
  rent:            { label: "Аренда",       icon: Bike,         color: "#10b981", bg: "#10b98120" },
  sale:            { label: "Покупка",      icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  checkout_start:  { label: "Корзина",      icon: Wallet,       color: "#06b6d4", bg: "#06b6d420" },
  rental_secret:   { label: "Документы",    icon: FileText,     color: "#06b6d4", bg: "#06b6d420" },
  profile_prefill: { label: "Профиль",      icon: FileText,     color: "#6366f1", bg: "#6366f120" },
  unknown:         { label: "Клиент",       icon: Users,        color: "#64748b", bg: "#64748b20" },
};

const STAGE_LABELS: Record<string, string> = {
  contract_generated: "Договор готов",
  checkout_started: "Оформление",
  checkout_completed: "Оплачен",
  dismissed: "Отклонён",
  interest_paid: "Интерес",
  new: "Новый",
  contacted: "Контакт установлен",
  viewed: "Просмотр",
  configured: "Настроил",
};

const SEGMENT_META: Record<Segment, { label: string; icon: typeof Flame; color: string }> = {
  all:       { label: "Все",         icon: Users,       color: "#64748b" },
  hot:       { label: "Горячие",     icon: Flame,       color: "#ef4444" },
  verified:  { label: "Клиенты",     icon: CheckCircle, color: "#10b981" },
  warm:      { label: "Заявки",      icon: Phone,       color: "#3b82f6" },
  troubled:  { label: "Проблемные",  icon: AlertCircle, color: "#dc2626" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffH < 24) return `${diffH} ч назад`;
  if (diffD === 1) return "вчера";
  if (diffD < 7) return `${diffD} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function temperatureColor(urgency: number | null | undefined, pendingTodos: number): string {
  const score = (urgency || 0) + pendingTodos * 15;
  if (score >= 90) return "#ef4444";
  if (score >= 60) return "#f59e0b";
  if (score >= 30) return "#3b82f6";
  return "#64748b";
}

function temperatureLabel(urgency: number | null | undefined, pendingTodos: number): string {
  const score = (urgency || 0) + pendingTodos * 15;
  if (score >= 90) return "Горячий";
  if (score >= 60) return "Тёплый";
  if (score >= 30) return "Холодный";
  return "Спящий";
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function metaFor(source: string) { return SOURCE_META[source] || SOURCE_META.unknown; }

function fmtMoney(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "0 ₽";
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}

// ── Theme hook ────────────────────────────────────────────────────────────────

type ThemeTokens = {
  text: string; textMuted: string; textFaint: string;
  bg: string; bgCard: string; bgCardHover: string; bgElevated: string;
  border: string; borderSoft: string; borderActive: string;
  inputBg: string; inputBorder: string; shadow: string;
  accent: string; accentContrast: string;
};

function useTheme({ isAuto, isLightTheme, textColor, bgColor, accentColor }: {
  isAuto: boolean; isLightTheme: boolean; textColor: string; bgColor: string; accentColor: string;
}): ThemeTokens {
  if (isAuto) {
    return {
      text: "var(--franchize-text-primary)",
      textMuted: "var(--franchize-text-secondary)",
      textFaint: "color-mix(in srgb, var(--franchize-text-secondary) 65%, transparent)",
      bg: "var(--franchize-bg-base)",
      bgCard: "color-mix(in srgb, var(--franchize-bg-card) 96%, transparent)",
      bgCardHover: "color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)",
      bgElevated: "var(--franchize-bg-card)",
      border: "color-mix(in srgb, var(--franchize-border-soft) 45%, transparent)",
      borderSoft: "color-mix(in srgb, var(--franchize-border-soft) 25%, transparent)",
      borderActive: "var(--franchize-accent-main)",
      inputBg: "var(--franchize-bg-base)",
      inputBorder: "color-mix(in srgb, var(--franchize-border-soft) 55%, transparent)",
      shadow: "0 4px 24px color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)",
      accent: "var(--franchize-accent-main)",
      accentContrast: "var(--franchize-accent-contrast)",
    };
  }
  return {
    text: isLightTheme ? "#1e293b" : textColor,
    textMuted: isLightTheme ? "#64748b" : `${textColor}99`,
    textFaint: isLightTheme ? "#94a3b8" : `${textColor}60`,
    bg: isLightTheme ? "#f8fafc" : bgColor,
    bgCard: isLightTheme ? "#ffffff" : `${accentColor}08`,
    bgCardHover: isLightTheme ? "#f1f5f9" : `${accentColor}12`,
    bgElevated: isLightTheme ? "#ffffff" : `${accentColor}10`,
    border: isLightTheme ? "#e2e8f0" : `${accentColor}22`,
    borderSoft: isLightTheme ? "#f1f5f9" : `${accentColor}12`,
    borderActive: accentColor,
    inputBg: isLightTheme ? "#ffffff" : `${accentColor}0a`,
    inputBorder: isLightTheme ? "#cbd5e1" : `${accentColor}30`,
    shadow: isLightTheme ? "0 4px 20px rgba(0,0,0,0.08)" : "0 4px 24px rgba(0,0,0,0.35)",
    accent: accentColor,
    accentContrast: isLightTheme ? "#16130A" : "#ffffff",
  };
}

// ── UI atoms ──────────────────────────────────────────────────────────────────

function Avatar({ name, source, size = 44 }: { name: string | null; source: string; size?: number }) {
  const meta = SOURCE_META[source] || SOURCE_META.unknown;
  const initials = getInitials(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size, height: size, backgroundColor: meta.bg, color: meta.color, fontSize: size > 40 ? "14px" : "12px",
        boxShadow: `0 0 0 2px ${meta.color}25`,
      }}
    >
      {initials}
    </div>
  );
}

function SourceBadge({ source, size = "sm" }: { source: string; size?: "sm" | "md" }) {
  const meta = SOURCE_META[source] || SOURCE_META.unknown;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"}`}
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <Icon className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"} />
      {meta.label}
    </span>
  );
}

function InfoTile({ label, value, T, fullWidth }: { label: string; value: string; T: ThemeTokens; fullWidth?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 ${fullWidth ? "col-span-full" : ""}`} style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>{label}</p>
      <p className="mt-0.5 text-xs font-semibold break-words" style={{ color: T.text }}>{value}</p>
    </div>
  );
}

function ActionBtn({ href, icon: Icon, label, T, external }: {
  href: string; icon: typeof Phone; label: string; T: ThemeTokens; external?: boolean;
}) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}
      className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition hover:brightness-110"
      style={{ borderColor: T.border, backgroundColor: T.bgElevated, color: T.text }}>
      <Icon className="h-3.5 w-3.5 transition group-hover:scale-110" style={{ color: T.accent }} />
      {label}
    </a>
  );
}

function Section({ title, icon: Icon, children, T, defaultOpen = false }: {
  title: string; icon: typeof Phone; children: React.ReactNode; T: ThemeTokens; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        style={{ backgroundColor: T.bgElevated }}
      >
        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: T.text }}>
          <Icon className="h-3.5 w-3.5" style={{ color: T.accent }} />
          {title}
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5" style={{ color: T.textFaint }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: T.textFaint }} />}
      </button>
      {open && <div className="border-t px-3 py-3" style={{ borderColor: T.border }}>{children}</div>}
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

function KpiCards({ leads, hot, verified, todos, T }: {
  leads: LeadRow[]; hot: LeadRow[]; verified: LeadRow[]; todos: LeadTodoRow[]; T: ThemeTokens;
}) {
  const today = leads.filter((l) => isToday(l.createdAt) || isToday(l.lastSeenAt)).length;
  const pending = todos.filter((t) => t.status !== "done").length;
  const totalSpent = leads.reduce((s, l) => s + (l.totalSpent || 0), 0);
  const cards = [
    { label: "Всего лидов", value: leads.length, icon: Users, color: T.textMuted },
    { label: "Активность сегодня", value: today, icon: Star, color: T.accent },
    { label: "Горячие", value: hot.length, icon: Flame, color: "#ef4444" },
    { label: "Клиенты", value: verified.length, icon: CheckCircle, color: "#10b981" },
    { label: "Задач в работе", value: pending, icon: Clock, color: "#f59e0b" },
    { label: "Выручка", value: fmtMoney(totalSpent), icon: Banknote, color: "#10b981" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label}
            className="relative overflow-hidden rounded-2xl border p-3 transition hover:shadow-md"
            style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: T.textFaint }}>{c.label}</p>
                <p className="mt-1 text-xl font-black tracking-tight" style={{ color: T.text }}>{c.value}</p>
              </div>
              <div className="rounded-lg p-1.5" style={{ backgroundColor: T.borderSoft }}>
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({
  searchQuery, setSearchQuery, sortMode, setSortMode, filterSource, setFilterSource,
  availableSources, segment, setSegment, viewMode, setViewMode, T, isAuto,
}: {
  searchQuery: string; setSearchQuery: (v: string) => void;
  sortMode: SortMode; setSortMode: (v: SortMode) => void;
  filterSource: string; setFilterSource: (v: string) => void;
  availableSources: string[];
  segment: Segment; setSegment: (v: Segment) => void;
  viewMode: ViewMode; setViewMode: (v: ViewMode) => void;
  T: ThemeTokens; isAuto: boolean;
}) {
  return (
    <div
      className="sticky top-0 z-10 -mx-4 space-y-3 border-b px-4 py-3 backdrop-blur-md sm:rounded-2xl sm:border"
      style={{ backgroundColor: isAuto ? `color-mix(in srgb, var(--franchize-bg-base) 88%, transparent)` : T.bgCard, borderColor: T.border }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: T.textFaint }} />
          <input
            type="text"
            placeholder="Имя, телефон, байк, Telegram…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border py-2.5 pl-10 pr-9 text-sm outline-none transition focus:ring-2"
            style={{
              backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text,
              // @ts-ignore
              "--tw-ring-color": T.borderActive,
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 transition hover:opacity-80" style={{ color: T.textFaint }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border p-1" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
            <button onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${viewMode === "list" ? "" : "hover:opacity-70"}`}
              style={viewMode === "list" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}>
              <LayoutList className="h-3.5 w-3.5" /> Список
            </button>
            <button onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${viewMode === "board" ? "" : "hover:opacity-70"}`}
              style={viewMode === "board" ? { backgroundColor: T.accent, color: T.accentContrast } : { color: T.textMuted }}>
              <Columns3 className="h-3.5 w-3.5" /> Воронка
            </button>
          </div>

          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-xl border px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}>
            <option value="all">Все источники</option>
            {availableSources.map((s) => (
              <option key={s} value={s}>{metaFor(s).label || s}</option>
            ))}
          </select>

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-xl border px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}>
            <option value="recent">Свежие</option>
            <option value="urgent">🔥 Срочные</option>
            <option value="spent">💰 По выручке</option>
            <option value="name">А → Я</option>
          </select>

          <button disabled
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium opacity-50"
            style={{ borderColor: T.border, color: T.textMuted }}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(SEGMENT_META) as Segment[]).map((key) => {
          const meta = SEGMENT_META[key];
          const Icon = meta.icon;
          const active = segment === key;
          return (
            <button key={key} onClick={() => setSegment(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${active ? "" : "hover:bg-black/5"}`}
              style={active ? { backgroundColor: meta.color + "15", color: meta.color, borderColor: meta.color + "40" } : { color: T.textMuted, borderColor: "transparent" }}>
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Todos ─────────────────────────────────────────────────────────────────────

function TodoList({ leadId, leadName, todos, crewId, slug, T }: {
  leadId: string; leadName: string; todos: LeadTodoRow[]; crewId: string; slug: string; T: ThemeTokens;
}) {
  const [localTodos, setLocalTodos] = useState<LeadTodoRow[]>(todos);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocalTodos(todos); }, [todos]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crewId, slug, leadId, leadName, title: newTitle.trim(), priority: newPriority }),
      });
      const data = await resp.json();
      if (data.success && data.todo) {
        setLocalTodos([data.todo, ...localTodos]);
        setNewTitle("");
        setShowAddForm(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleToggle = async (todoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    const prev = localTodos;
    setLocalTodos(localTodos.map((t) => (t.id === todoId ? { ...t, status: newStatus } : t)));
    try {
      const r = await fetch("/api/franchize/lead-todo", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId, status: newStatus }),
      });
      if (!r.ok) throw new Error();
    } catch { setLocalTodos(prev); }
  };

  const handleDelete = async (todoId: string) => {
    const prev = localTodos;
    setLocalTodos(localTodos.filter((t) => t.id !== todoId));
    try {
      const r = await fetch("/api/franchize/lead-todo", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId }),
      });
      if (!r.ok) throw new Error();
    } catch { setLocalTodos(prev); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: T.textMuted }}>
          Задачи {localTodos.length > 0 && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: T.borderSoft, color: T.text }}>{localTodos.length}</span>}
        </p>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:brightness-110"
          style={{ backgroundColor: T.accent, color: T.accentContrast }}>
          <Plus className="h-3 w-3" /> Добавить
        </button>
      </div>

      {showAddForm && (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: T.inputBorder, backgroundColor: T.bgElevated }}>
          <input type="text" placeholder="Что нужно сделать?"
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full rounded-lg border px-3 py-2 text-xs outline-none"
            style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }} autoFocus />
          <div className="flex gap-2">
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-[11px] outline-none"
              style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
            <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40" style={{ backgroundColor: T.accent }}>
              {saving ? "…" : "Сохранить"}
            </button>
          </div>
        </div>
      )}

      {localTodos.length === 0 ? (
        <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <p className="text-xs" style={{ color: T.textFaint }}>Нет задач по этому лиду</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {localTodos.map((todo) => (
            <div key={todo.id}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 transition hover:shadow-sm"
              style={{ borderColor: T.border, backgroundColor: T.bgElevated, opacity: todo.status === "done" ? 0.55 : 1 }}>
              <button onClick={() => handleToggle(todo.id, todo.status)} className="shrink-0">
                {todo.status === "done"
                  ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                  : <CircleDot className="h-4 w-4" style={{ color: T.textFaint }} />}
              </button>
              <span className={`flex-1 text-xs ${todo.status === "done" ? "line-through" : ""}`} style={{ color: T.text }}>{todo.title}</span>
              {todo.priority === "high" && todo.status !== "done" && (
                <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">!</span>
              )}
              <button onClick={() => handleDelete(todo.id)} className="shrink-0 rounded p-1 opacity-40 transition hover:opacity-80 hover:bg-red-500/10">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notes ─────────────────────────────────────────────────────────────────────

function NotesPanel({ leadId, crewId, T }: { leadId: string; crewId: string; T: ThemeTokens }) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load notes from DB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getLeadNotes(leadId, crewId);
        if (!cancelled && result.success && result.data) {
          setNotes(result.data);
        }
      } catch (err) {
        console.error("[NotesPanel] Failed to load notes:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId, crewId]);

  const addNote = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      const result = await createLeadNote({
        leadId,
        crewId,
        text: draft.trim(),
      });
      if (result.success && result.data) {
        setNotes([result.data, ...notes]);
        setDraft("");
      }
    } catch (err) {
      console.error("[NotesPanel] Failed to create note:", err);
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Удалить заметку?")) return;
    try {
      const result = await deleteLeadNote(noteId);
      if (result.success) {
        setNotes(notes.filter((n) => n.id !== noteId));
      }
    } catch (err) {
      console.error("[NotesPanel] Failed to delete note:", err);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <p className="text-xs" style={{ color: T.textFaint }}>Загрузка заметок...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: T.inputBorder, backgroundColor: T.bgElevated }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Заметка о клиенте..." rows={3}
          className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none"
          style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }} />
        <button onClick={addNote} disabled={!draft.trim() || saving}
          className="w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-40" style={{ backgroundColor: T.accent }}>
          {saving ? "Сохранение..." : "Добавить заметку"}
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <p className="text-xs" style={{ color: T.textFaint }}>Заметок пока нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-relaxed flex-1" style={{ color: T.text }}>{n.text}</p>
                <button onClick={() => deleteNote(n.id)} className="shrink-0 rounded p-1 opacity-40 transition hover:opacity-80 hover:bg-red-500/10">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>{relativeTime(n.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Document Verification ─────────────────────────────────────────────────────

function DocumentVerificationPanel({ rental, slug, T }: { rental: LeadRentalRow; slug: string; T: ThemeTokens }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocVerificationData | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null); // which doc type is being verified
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const hasAnyPhoto = !!(rental.passportMainpagePhoto || rental.passportRegistrationPhoto || rental.driversLicenceFrontalPhoto);

  // Load verification data on mount
  useEffect(() => {
    if (!rental.rentalId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const result = await getRentalDocVerification(rental.rentalId);
        if (cancelled) return;
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || "Не удалось загрузить данные");
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Ошибка сети");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rental.rentalId]);

  // Calculate verification progress
  const totalDocs = 3; // passport (mainpage + registration counted as 1), license
  const verifiedCount = data ? [data.checklist.passportVerified, data.checklist.licenseVerified].filter(Boolean).length : 0;
  // For progress: passport = 1 doc (both pages), license = 1 doc
  // But we show 3 photo cards, so let's count verified photos
  const passportVerified = data?.checklist.passportVerified ?? false;
  const licenseVerified = data?.checklist.licenseVerified ?? false;

  const handleVerify = async (docType: "passport" | "license") => {
    if (!rental.rentalId) return;
    setVerifying(docType);
    setVerifyMsg(null);
    try {
      const updates: Record<string, any> = {};
      if (docType === "passport") {
        updates.passport_verified = true;
      } else {
        updates.license_verified = true;
      }

      const resp = await fetch("/api/verify-rental-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalId: rental.rentalId, updates }),
      });
      const result = await resp.json();
      if (result.success) {
        setVerifyMsg({ ok: true, text: docType === "passport" ? "Паспорт верифицирован" : "Права верифицированы" });
        // Reload data to reflect changes
        const refreshed = await getRentalDocVerification(rental.rentalId);
        if (refreshed.success && refreshed.data) {
          setData(refreshed.data);
        }
      } else {
        setVerifyMsg({ ok: false, text: result.error || "Ошибка верификации" });
      }
    } catch (err: any) {
      setVerifyMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setVerifying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.accent }} />
        <span className="ml-2 text-xs" style={{ color: T.textMuted }}>Загрузка документов...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border p-3" style={{ borderColor: "#ef444440", backgroundColor: "#ef444410" }}>
        <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#ef4444" }} />
        <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  // If no photos and no OCR data, show empty state
  if (!hasAnyPhoto && !data.ocrData.fullName && !data.ocrData.passport && !data.ocrData.driverLicense) {
    return (
      <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <Camera className="mx-auto h-6 w-6 mb-2" style={{ color: T.textFaint }} />
        <p className="text-xs" style={{ color: T.textFaint }}>Документы не загружены</p>
        <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>Арендатор не загрузил фото документов</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold" style={{ color: T.text }}>
            <ShieldCheck className="inline h-3.5 w-3.5 mr-1" style={{ color: verifiedCount === 2 ? "#10b981" : T.accent }} />
            Верификация документов
          </span>
          <span className="text-[10px] font-bold" style={{ color: verifiedCount === 2 ? "#10b981" : T.textMuted }}>
            {verifiedCount}/2
          </span>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: T.borderSoft }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(verifiedCount / 2) * 100}%`,
              backgroundColor: verifiedCount === 2 ? "#10b981" : T.accent,
            }}
          />
        </div>
        {verifiedCount === 2 && (
          <p className="mt-1.5 text-[10px] font-medium text-center" style={{ color: "#10b981" }}>
            <Check className="inline h-3 w-3 mr-0.5" /> Все документы верифицированы
          </p>
        )}
      </div>

      {/* Verification message */}
      {verifyMsg && (
        <div className="rounded-xl border p-2.5 text-[11px] font-medium text-center"
          style={{
            borderColor: verifyMsg.ok ? "#10b98140" : "#ef444440",
            backgroundColor: verifyMsg.ok ? "#10b98110" : "#ef444410",
            color: verifyMsg.ok ? "#10b981" : "#ef4444",
          }}>
          {verifyMsg.ok ? <Check className="inline h-3.5 w-3.5 mr-1" /> : <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
          {verifyMsg.text}
        </div>
      )}

      {/* Passport section */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: passportVerified ? "#10b98110" : T.bgElevated }}>
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" style={{ color: passportVerified ? "#10b981" : T.accent }} />
            <span className="text-xs font-bold" style={{ color: T.text }}>Паспорт</span>
            {passportVerified && (
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#10b98120", color: "#10b981" }}>
                <Check className="inline h-2.5 w-2.5 mr-0.5" />Верифицирован
              </span>
            )}
          </div>
          {!passportVerified && (data.photos.passportMainpage.signedUrl || data.photos.passportRegistration.signedUrl) && (
            <button
              onClick={() => handleVerify("passport")}
              disabled={verifying === "passport"}
              className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: "#10b981" }}
            >
              {verifying === "passport" ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />...</span>
              ) : (
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Верифицировать</span>
              )}
            </button>
          )}
        </div>

        <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: T.border }}>
          {/* Passport photos */}
          <div className="grid grid-cols-2 gap-2">
            {/* Main page photo */}
            <div>
              <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: T.textFaint }}>Главная страница</p>
              {data.photos.passportMainpage.signedUrl ? (
                <button onClick={() => setLightboxSrc(data.photos.passportMainpage.signedUrl)} className="block w-full">
                  <img
                    src={data.photos.passportMainpage.signedUrl}
                    alt="Паспорт (главная)"
                    className="w-full h-24 object-cover rounded-lg border transition hover:opacity-80"
                    style={{ borderColor: T.border }}
                  />
                  <p className="mt-0.5 text-[9px] text-center" style={{ color: T.textFaint }}>
                    <Eye className="inline h-2.5 w-2.5 mr-0.5" />Увеличить
                  </p>
                </button>
              ) : data.photos.passportMainpage.path ? (
                <div className="flex h-24 items-center justify-center rounded-lg border" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
                  <div className="text-center">
                    <ImageOff className="mx-auto h-5 w-5 mb-1" style={{ color: T.textFaint }} />
                    <p className="text-[9px]" style={{ color: T.textFaint }}>Фото удалено</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed" style={{ borderColor: T.border }}>
                  <p className="text-[9px]" style={{ color: T.textFaint }}>Не загружено</p>
                </div>
              )}
            </div>

            {/* Registration photo */}
            <div>
              <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: T.textFaint }}>Прописка</p>
              {data.photos.passportRegistration.signedUrl ? (
                <button onClick={() => setLightboxSrc(data.photos.passportRegistration.signedUrl)} className="block w-full">
                  <img
                    src={data.photos.passportRegistration.signedUrl}
                    alt="Паспорт (прописка)"
                    className="w-full h-24 object-cover rounded-lg border transition hover:opacity-80"
                    style={{ borderColor: T.border }}
                  />
                  <p className="mt-0.5 text-[9px] text-center" style={{ color: T.textFaint }}>
                    <Eye className="inline h-2.5 w-2.5 mr-0.5" />Увеличить
                  </p>
                </button>
              ) : data.photos.passportRegistration.path ? (
                <div className="flex h-24 items-center justify-center rounded-lg border" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
                  <div className="text-center">
                    <ImageOff className="mx-auto h-5 w-5 mb-1" style={{ color: T.textFaint }} />
                    <p className="text-[9px]" style={{ color: T.textFaint }}>Фото удалено</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed" style={{ borderColor: T.border }}>
                  <p className="text-[9px]" style={{ color: T.textFaint }}>Не загружено</p>
                </div>
              )}
            </div>
          </div>

          {/* OCR data */}
          {(data.ocrData.fullName || data.ocrData.passport || data.ocrData.birthDate || data.ocrData.registration) && (
            <div className="rounded-lg border p-2 space-y-1" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
              <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: T.textFaint }}>Данные OCR</p>
              {data.ocrData.fullName && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>ФИО:</span>
                  <span className="text-[10px] break-words" style={{ color: T.text }}>{data.ocrData.fullName}</span>
                </div>
              )}
              {data.ocrData.passport && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Паспорт:</span>
                  <span className="text-[10px]" style={{ color: T.text }}>{data.ocrData.passport}</span>
                </div>
              )}
              {data.ocrData.passportIssuedBy && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Кем выдан:</span>
                  <span className="text-[10px] break-words" style={{ color: T.text }}>{data.ocrData.passportIssuedBy}</span>
                </div>
              )}
              {data.ocrData.passportIssueDate && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Дата выдачи:</span>
                  <span className="text-[10px]" style={{ color: T.text }}>{data.ocrData.passportIssueDate}</span>
                </div>
              )}
              {data.ocrData.birthDate && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Дата рождения:</span>
                  <span className="text-[10px]" style={{ color: T.text }}>{data.ocrData.birthDate}</span>
                </div>
              )}
              {data.ocrData.registration && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Регистрация:</span>
                  <span className="text-[10px] break-words" style={{ color: T.text }}>{data.ocrData.registration}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Driver's license section */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: licenseVerified ? "#10b98110" : T.bgElevated }}>
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" style={{ color: licenseVerified ? "#10b981" : T.accent }} />
            <span className="text-xs font-bold" style={{ color: T.text }}>Водительское удостоверение</span>
            {licenseVerified && (
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#10b98120", color: "#10b981" }}>
                <Check className="inline h-2.5 w-2.5 mr-0.5" />Верифицировано
              </span>
            )}
          </div>
          {!licenseVerified && data.photos.driversLicence.signedUrl && (
            <button
              onClick={() => handleVerify("license")}
              disabled={verifying === "license"}
              className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: "#10b981" }}
            >
              {verifying === "license" ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />...</span>
              ) : (
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Верифицировать</span>
              )}
            </button>
          )}
        </div>

        <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: T.border }}>
          {/* License photo */}
          <div>
            <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: T.textFaint }}>Водительское удостоверение</p>
            {data.photos.driversLicence.signedUrl ? (
              <button onClick={() => setLightboxSrc(data.photos.driversLicence.signedUrl)} className="block w-full">
                <img
                  src={data.photos.driversLicence.signedUrl}
                  alt="Водительское удостоверение"
                  className="w-full h-24 object-cover rounded-lg border transition hover:opacity-80"
                  style={{ borderColor: T.border }}
                />
                <p className="mt-0.5 text-[9px] text-center" style={{ color: T.textFaint }}>
                  <Eye className="inline h-2.5 w-2.5 mr-0.5" />Увеличить
                </p>
              </button>
            ) : data.photos.driversLicence.path ? (
              <div className="flex h-24 items-center justify-center rounded-lg border" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
                <div className="text-center">
                  <ImageOff className="mx-auto h-5 w-5 mb-1" style={{ color: T.textFaint }} />
                  <p className="text-[9px]" style={{ color: T.textFaint }}>Фото удалено</p>
                </div>
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed" style={{ borderColor: T.border }}>
                <p className="text-[9px]" style={{ color: T.textFaint }}>Не загружено</p>
              </div>
            )}
          </div>

          {/* OCR data */}
          {data.ocrData.driverLicense && (
            <div className="rounded-lg border p-2 space-y-1" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
              <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: T.textFaint }}>Данные OCR</p>
              <div className="flex items-start gap-1">
                <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Номер ВУ:</span>
                <span className="text-[10px]" style={{ color: T.text }}>{data.ocrData.driverLicense}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightboxSrc}
              alt="Документ"
              className="w-full rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deals ─────────────────────────────────────────────────────────────────────

function DealsPanel({ lead, slug, T }: { lead: LeadRow; slug: string; T: ThemeTokens }) {
  return (
    <div className="space-y-3">
      {lead.rentals.length === 0 && lead.sales.length === 0 && (
        <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <p className="text-xs" style={{ color: T.textFaint }}>Пока нет сделок</p>
        </div>
      )}

      {lead.rentals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold" style={{ color: T.text }}>Аренда</p>
          {lead.rentals.map((r, i) => <RentalRow key={r.rentalId || i} rental={r} slug={slug} T={T} />)}
        </div>
      )}

      {lead.sales.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold" style={{ color: T.text }}>Продажи</p>
          {lead.sales.map((s, i) => <SaleRow key={s.saleId || i} sale={s} T={T} />)}
        </div>
      )}
    </div>
  );
}

function RentalRow({ rental, slug, T }: { rental: LeadRentalRow; slug: string; T: ThemeTokens }) {
  const statusMeta: Record<string, { label: string; color: string }> = {
    active: { label: "Активна", color: "#10b981" },
    completed: { label: "Завершена", color: "#3b82f6" },
    confirmed: { label: "Подтверждена", color: "#8b5cf6" },
    pending_confirmation: { label: "В обработке", color: "#f59e0b" },
    cancelled: { label: "Отменена", color: "#64748b" },
  };
  const meta = statusMeta[rental.status] || { label: rental.status, color: T.textMuted };

  // ── Activation state ──
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [odometerInput, setOdometerInput] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Decline state ──
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineMessage, setDeclineMessage] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineMsg, setDeclineMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Complete state ──
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeOdometer, setCompleteOdometer] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeMsg, setCompleteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Odometer pre-fill: suggest last known odometer from bike specs ──
  const lastOdometer = rental.metadata?.last_known_odometer as number | undefined;

  const handleActivate = async () => {
    const odometer = parseInt(odometerInput, 10);
    if (isNaN(odometer) || odometer < 0 || odometer > 999999) {
      setActivationMsg({ ok: false, text: "Введите корректные показания одометра (0–999999 км)" });
      return;
    }
    setActivating(true);
    setActivationMsg(null);
    try {
      const result = await activateRental({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        odometerBefore: odometer,
        isPasswordAuth: true,
      });
      if (result.success) {
        setActivationMsg({ ok: true, text: result.message || "✅ Аренда активирована! Обновляю..." });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setActivationMsg({ ok: false, text: result.error || "Ошибка активации" });
      }
    } catch (err: any) {
      setActivationMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setActivating(false);
    }
  };

  const handleDecline = async () => {
    if (!declineMessage.trim()) {
      setDeclineMsg({ ok: false, text: "Укажите причину отклонения" });
      return;
    }
    setDeclining(true);
    setDeclineMsg(null);
    try {
      const result = await updateRentalStatus({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        status: "cancelled",
        operatorMessage: declineMessage.trim(),
        isPasswordAuth: true,
      });
      if (result.success) {
        setDeclineMsg({ ok: true, text: result.message || "✅ Аренда отклонена. Обновляю..." });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setDeclineMsg({ ok: false, text: result.error || "Ошибка" });
      }
    } catch (err: any) {
      setDeclineMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setDeclining(false);
    }
  };

  const handleComplete = async () => {
    const odometer = parseInt(completeOdometer, 10);
    if (isNaN(odometer) || odometer < 0 || odometer > 999999) {
      setCompleteMsg({ ok: false, text: "Введите корректные показания одометра (0–999999 км)" });
      return;
    }
    setCompleting(true);
    setCompleteMsg(null);
    try {
      const result = await updateRentalStatus({
        slug,
        actorUserId: String(Date.now()),
        rentalId: rental.rentalId,
        status: "completed",
        odometerAfter: odometer,
        isPasswordAuth: true,
      });
      if (result.success) {
        setCompleteMsg({ ok: true, text: result.message || "✅ Аренда завершена. Обновляю..." });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setCompleteMsg({ ok: false, text: result.error || "Ошибка" });
      }
    } catch (err: any) {
      setCompleteMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setCompleting(false);
    }
  };

  // Past-dated pending rentals show as "past" (can still be activated)
  const isPastRental = rental.endDate && new Date(rental.endDate) < new Date();

  return (
    <>
      <div className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: (isPastRental && rental.status === "pending_confirmation" ? "#64748b" : meta.color) + "15",
                    color: isPastRental && rental.status === "pending_confirmation" ? "#64748b" : meta.color }}>
            {isPastRental && rental.status === "pending_confirmation" ? "Просрочена" : meta.label}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" style={{ color: T.textMuted }}>
          <span><Calendar className="inline h-3 w-3 mr-1" />{formatDate(rental.startDate)} — {formatDate(rental.endDate)}</span>
          <span><Banknote className="inline h-3 w-3 mr-1" />{fmtMoney(rental.totalCost)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {rental.rentalId && (
            <a href={`/franchize/vip-bike/rental/${rental.rentalId}`}
              className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: T.accent }}>
              Открыть <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {/* Activate button — only for pending_confirmation */}
          {rental.status === "pending_confirmation" && (
            <>
              <button onClick={() => setShowActivateModal(true)}
                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all hover:opacity-80"
                style={{ backgroundColor: "#10b981", color: "#fff" }}>
                <Activity className="h-3 w-3" />
                Активировать
              </button>
              <button onClick={() => setShowDeclineModal(true)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all hover:opacity-80"
                style={{ backgroundColor: "#ef4444", color: "#fff" }}>
                <XCircle className="h-3 w-3" />
                Отклонить
              </button>
            </>
          )}
          {/* Complete button — only for active */}
          {rental.status === "active" && (
            <button onClick={() => { setShowCompleteModal(true); setCompleteOdometer(String(lastOdometer || "")); }}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all hover:opacity-80"
              style={{ backgroundColor: "#3b82f6", color: "#fff" }}>
              <CheckCircle className="h-3 w-3" />
              Завершить
            </button>
          )}
        </div>
      </div>

      {/* ── Activation Modal ── */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { if (!activating) { setShowActivateModal(false); setActivationMsg(null); } }}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
            style={{ backgroundColor: T.bgCard, borderColor: T.border }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold" style={{ color: T.text }}>Активация аренды</h3>
            <p className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
              Подтвердите выдачу байка и укажите показания одометра
            </p>
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
              <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
              <p className="mt-1 text-[10px]" style={{ color: T.textMuted }}>
                {formatDate(rental.startDate)} — {formatDate(rental.endDate)}
              </p>
              <p className="text-[10px]" style={{ color: T.textMuted }}>{fmtMoney(rental.totalCost)}</p>
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-medium" style={{ color: T.text }}>
                <Gauge className="inline h-3.5 w-3.5 mr-1" />
                Показания одометра (км)
              </label>
              <input
                type="number" min="0" max="999999"
                value={odometerInput}
                onChange={e => { setOdometerInput(e.target.value); setActivationMsg(null); }}
                placeholder={lastOdometer ? `~${lastOdometer} (предыдущий)` : "0"}
                disabled={activating}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all"
                style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}
                autoFocus
              />
              {lastOdometer && !odometerInput && (
                <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>
                  <RotateCcw className="inline h-3 w-3 mr-0.5" />
                  Предыдущий: {lastOdometer} км
                </p>
              )}
            </div>
            {activationMsg && (
              <div className="mt-3 rounded-xl border p-2.5 text-[11px] font-medium text-center"
                style={{
                  borderColor: activationMsg.ok ? "#10b98140" : "#ef444440",
                  backgroundColor: activationMsg.ok ? "#10b98110" : "#ef444410",
                  color: activationMsg.ok ? "#10b981" : "#ef4444",
                }}>
                {activationMsg.ok ? <Check className="inline h-3.5 w-3.5 mr-1" /> : <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
                {activationMsg.text}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setShowActivateModal(false); setActivationMsg(null); }} disabled={activating}
                className="flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all hover:opacity-70"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgCard }}>
                Отмена
              </button>
              <button onClick={handleActivate} disabled={activating}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "#10b981" }}>
                {activating ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Активация...</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Активировать</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Decline Modal ── */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { if (!declining) { setShowDeclineModal(false); setDeclineMsg(null); } }}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
            style={{ backgroundColor: T.bgCard, borderColor: T.border }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold" style={{ color: "#ef4444" }}>
              <XCircle className="inline h-4 w-4 mr-1" />
              Отклонение аренды
            </h3>
            <p className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
              Укажите причину — она будет отправлена арендатору
            </p>
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
              <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
              <p className="mt-1 text-[10px]" style={{ color: T.textMuted }}>
                {formatDate(rental.startDate)} — {formatDate(rental.endDate)}
              </p>
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-medium" style={{ color: T.text }}>
                <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
                Сообщение арендатору
              </label>
              <textarea
                value={declineMessage}
                onChange={e => { setDeclineMessage(e.target.value); setDeclineMsg(null); }}
                placeholder="Например: Байк на зарядке. Предлагаем перенести на завтра или выбрать другой байк."
                disabled={declining}
                rows={4}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all resize-none"
                style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}
                autoFocus
              />
              <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>
                Быстрые причины:
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {["Байк на зарядке", "Байк на ремонте", "Нет свободных дат", "Перенос на другие даты"].map((reason) => (
                  <button key={reason}
                    onClick={() => { setDeclineMessage(reason); setDeclineMsg(null); }}
                    className="rounded-lg border px-2 py-0.5 text-[9px] font-medium transition-all hover:opacity-70"
                    style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgElevated }}>
                    {reason}
                  </button>
                ))}
              </div>
            </div>
            {declineMsg && (
              <div className="mt-3 rounded-xl border p-2.5 text-[11px] font-medium text-center"
                style={{
                  borderColor: declineMsg.ok ? "#10b98140" : "#ef444440",
                  backgroundColor: declineMsg.ok ? "#10b98110" : "#ef444410",
                  color: declineMsg.ok ? "#10b981" : "#ef4444",
                }}>
                {declineMsg.ok ? <Check className="inline h-3.5 w-3.5 mr-1" /> : <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
                {declineMsg.text}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setShowDeclineModal(false); setDeclineMsg(null); }} disabled={declining}
                className="flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all hover:opacity-70"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgCard }}>
                Отмена
              </button>
              <button onClick={handleDecline} disabled={declining}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "#ef4444" }}>
                {declining ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Отклоняю...</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" />Отклонить</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Complete Modal ── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { if (!completing) { setShowCompleteModal(false); setCompleteMsg(null); } }}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
            style={{ backgroundColor: T.bgCard, borderColor: T.border }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold" style={{ color: "#3b82f6" }}>
              <CheckCircle className="inline h-4 w-4 mr-1" />
              Завершение аренды
            </h3>
            <p className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
              Укажите финальные показания одометра при возврате байка
            </p>
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
              <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
              <p className="mt-1 text-[10px]" style={{ color: T.textMuted }}>
                {formatDate(rental.startDate)} — {formatDate(rental.endDate)}
              </p>
              <p className="text-[10px]" style={{ color: T.textMuted }}>{fmtMoney(rental.totalCost)}</p>
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-medium" style={{ color: T.text }}>
                <Gauge className="inline h-3.5 w-3.5 mr-1" />
                Финальный одометр (км)
              </label>
              <input
                type="number" min="0" max="999999"
                value={completeOdometer}
                onChange={e => { setCompleteOdometer(e.target.value); setCompleteMsg(null); }}
                placeholder={lastOdometer ? `~${lastOdometer} (примерно)` : "0"}
                disabled={completing}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all"
                style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}
                autoFocus
              />
              {lastOdometer && (
                <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>
                  <RotateCcw className="inline h-3 w-3 mr-0.5" />
                  Предыдущий: {lastOdometer} км — используйте как отправную точку
                </p>
              )}
            </div>
            {completeMsg && (
              <div className="mt-3 rounded-xl border p-2.5 text-[11px] font-medium text-center"
                style={{
                  borderColor: completeMsg.ok ? "#10b98140" : "#ef444440",
                  backgroundColor: completeMsg.ok ? "#10b98110" : "#ef444410",
                  color: completeMsg.ok ? "#10b981" : "#ef4444",
                }}>
                {completeMsg.ok ? <Check className="inline h-3.5 w-3.5 mr-1" /> : <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
                {completeMsg.text}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setShowCompleteModal(false); setCompleteMsg(null); }} disabled={completing}
                className="flex-1 rounded-xl border py-2.5 text-xs font-medium transition-all hover:opacity-70"
                style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.bgCard }}>
                Отмена
              </button>
              <button onClick={handleComplete} disabled={completing}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "#3b82f6" }}>
                {completing ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Завершаю...</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" />Завершить</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SaleRow({ sale, T }: { sale: LeadSaleRow; T: ThemeTokens }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: T.text }}>{sale.bikeTitle || "Байк"}</p>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#f59e0b15", color: "#f59e0b" }}>Продажа</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" style={{ color: T.textMuted }}>
        <span><Calendar className="inline h-3 w-3 mr-1" />{formatDate(sale.createdAt)}</span>
        <span><Banknote className="inline h-3 w-3 mr-1" />{fmtMoney(sale.salePrice)}</span>
      </div>
    </div>
  );
}

// ── Contact panel ─────────────────────────────────────────────────────────────

function ContactPanel({ lead, T, todos }: { lead: LeadRow; T: ThemeTokens; todos?: LeadTodoRow[] }) {
  const [showTgInput, setShowTgInput] = useState(false);
  const [tgMessage, setTgMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleTgSend = async () => {
    if (!tgMessage.trim() || !lead.telegramChatId) return;
    setSending(true);
    try {
      const resp = await fetch("/api/franchize/notify-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId: lead.telegramChatId, message: tgMessage.trim() }),
      });
      const data = await resp.json();
      if (data.success) {
        setSent(true);
        setTimeout(() => { setSent(false); setShowTgInput(false); setTgMessage(""); }, 2000);
      }
    } catch { /* ignore */ }
    setSending(false);
  };

  const addTodosToMessage = () => {
    if (!todos || todos.length === 0) return;
    const pendingTodos = todos.filter((t) => t.status !== "done");
    if (pendingTodos.length === 0) return;
    const todoText = pendingTodos.map((t) => `• ${t.title}`).join("\n");
    setTgMessage((prev) => (prev ? prev + "\n\n" : "") + todoText);
  };

  const [troubledUpdating, setTroubledUpdating] = useState(false);
  const [troubledReasonInput, setTroubledReasonInput] = useState("");
  const [showTroubledInput, setShowTroubledInput] = useState(false);

  const handleToggleTroubled = async (userId: string, reason: string) => {
    setTroubledUpdating(true);
    try {
      const finalReason = reason || troubledReasonInput.trim();
      const resp = await fetch("/api/franchize/toggle-troubled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: finalReason || undefined }),
      });
      const data = await resp.json();
      if (data.success) {
        lead.troubled = data.troubled;
        if (!data.troubled) lead.troubledReason = null;
        setShowTroubledInput(false);
        setTroubledReasonInput("");
        window.location.reload();
      }
    } catch { /* ignore */ }
    setTroubledUpdating(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {lead.phone && <ActionBtn href={`tel:${lead.phone}`} icon={Phone} label="Позвонить" T={T} />}
        {lead.username && <ActionBtn href={`https://t.me/${lead.username}`} icon={Send} label="Telegram" T={T} external />}
        {lead.telegramChatId && (
          <button onClick={() => setShowTgInput(!showTgInput)}
            className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition hover:brightness-110"
            style={{ borderColor: T.border, backgroundColor: showTgInput ? `${T.accent}18` : T.bgElevated, color: showTgInput ? T.accent : T.text }}>
            <Send className="h-3.5 w-3.5 transition group-hover:scale-110" style={{ color: T.accent }} />
            {showTgInput ? "Закрыть" : "Уведомить"}
          </button>
        )}
        <button onClick={() => lead.troubled ? handleToggleTroubled(lead.user_id, "") : setShowTroubledInput(!showTroubledInput)}
          className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition hover:brightness-110"
          style={{ borderColor: lead.troubled ? "#dc262640" : T.border, backgroundColor: lead.troubled ? "#dc262618" : T.bgElevated, color: lead.troubled ? "#dc2626" : T.text }}>
          <AlertCircle className="h-3.5 w-3.5 transition group-hover:scale-110" style={{ color: lead.troubled ? "#dc2626" : T.accent }} />
          {lead.troubled ? "Снять отметку" : "Отметить"}
        </button>
      </div>

      {showTroubledInput && !lead.troubled && (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "#dc262640", backgroundColor: "#dc262608" }}>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#dc2626" }}>
            <AlertCircle className="h-3.5 w-3.5" /> Причина отметки
          </div>
          <div className="flex gap-2">
            <input value={troubledReasonInput} onChange={(e) => setTroubledReasonInput(e.target.value)}
              placeholder="Повредил байк / не оплатил …"
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
              style={{ borderColor: "#dc262640", backgroundColor: T.inputBg, color: T.text }}
              onKeyDown={(e) => { if (e.key === "Enter") handleToggleTroubled(lead.user_id, troubledReasonInput.trim()); }} />
            <button onClick={() => handleToggleTroubled(lead.user_id, troubledReasonInput.trim())} disabled={troubledUpdating}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40" style={{ backgroundColor: "#dc2626" }}>
              {troubledUpdating ? "…" : "OK"}
            </button>
          </div>
        </div>
      )}

      {showTgInput && lead.telegramChatId && (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: T.inputBorder, backgroundColor: T.bgElevated }}>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.accent }}>
            <Send className="h-3.5 w-3.5" /> Уведомление в Telegram
          </div>
          <div className="relative">
            <textarea value={tgMessage} onChange={(e) => setTgMessage(e.target.value)}
              placeholder="Текст уведомления..." rows={3}
              className="w-full resize-none rounded-lg border px-3 py-2 pr-8 text-xs outline-none"
              style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }} />
            {todos && todos.filter((t) => t.status !== "done").length > 0 && (
              <button onClick={addTodosToMessage} title="Добавить задачи в текст"
                className="absolute right-2 top-2 rounded p-1 transition hover:opacity-80" style={{ color: T.accent }}>
                <StickyNote className="h-4 w-4" />
              </button>
            )}
          </div>
          <button onClick={handleTgSend} disabled={sending || !tgMessage.trim()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40" style={{ backgroundColor: T.accent }}>
            {sending ? "…" : sent ? "✅" : <><Send className="h-3 w-3" /> Отправить</>}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {lead.phone && <InfoTile label="Телефон" value={lead.phone} T={T} />}
        {lead.username && <InfoTile label="Telegram" value={`@${lead.username}`} T={T} />}
        {lead.telegramChatId && <InfoTile label="TG ID" value={lead.telegramChatId} T={T} />}
        {lead.bikeTitle && <InfoTile label="Байк" value={lead.bikeTitle} T={T} />}
        {lead.intentStage && <InfoTile label="Стадия" value={STAGE_LABELS[lead.intentStage] || lead.intentStage} T={T} />}
        {lead.urgencyScore != null && <InfoTile label="Приоритет" value={`${lead.urgencyScore}/100`} T={T} />}
        <InfoTile label="Источник" value={metaFor(lead.source).label} T={T} />
        {lead.sourceRoute && <InfoTile label="Маршрут" value={lead.sourceRoute} T={T} />}
        {lead.contactChannel && <InfoTile label="Канал" value={lead.contactChannel} T={T} />}
        {(lead.totalSpent || 0) > 0 && <InfoTile label="Выручка" value={fmtMoney(lead.totalSpent)} T={T} />}
        {lead.lastRentalDate && <InfoTile label="Последняя аренда" value={formatDate(lead.lastRentalDate)} T={T} />}
        {lead.troubled && (
          <div className="col-span-full flex items-center gap-2 rounded-lg border p-2.5" style={{ borderColor: "#dc262640", backgroundColor: "#dc262608" }}>
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#dc2626" }} />
            <div className="min-w-0 text-xs">
              <span className="font-semibold" style={{ color: "#dc2626" }}>Проблемный клиент</span>
              {lead.troubledReason && <span className="ml-2" style={{ color: T.textMuted }}>— {lead.troubledReason}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail content (used inline on mobile and in panel on desktop) ────────────

function LeadDetailContent({ lead, todos, crewId, slug, T }: {
  lead: LeadRow; todos: LeadTodoRow[]; crewId: string; slug: string; T: ThemeTokens;
}) {
  // Check if any rental has photos or is pending verification
  const rentalsWithDocs = lead.rentals.filter(
    (r) => r.passportMainpagePhoto || r.passportRegistrationPhoto || r.driversLicenceFrontalPhoto || r.status === "pending_confirmation"
  );

  return (
    <div className="space-y-3">
      <Section title="Контакты и действия" icon={Phone} T={T} defaultOpen>
        <ContactPanel lead={lead} T={T} todos={todos} />
      </Section>

      {rentalsWithDocs.length > 0 && (
        <Section title={`Верификация документов (${rentalsWithDocs.length})`} icon={ShieldCheck} T={T} defaultOpen>
          <div className="space-y-4">
            {rentalsWithDocs.map((rental, i) => (
              <div key={rental.rentalId || i}>
                {rentalsWithDocs.length > 1 && (
                  <p className="mb-2 text-[10px] font-semibold" style={{ color: T.textMuted }}>
                    {rental.bikeTitle || "Байк"} — {rental.status === "pending_confirmation" ? "Ожидает подтверждения" : rental.status}
                  </p>
                )}
                <DocumentVerificationPanel rental={rental} slug={slug} T={T} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={`Сделки (${lead.rentals.length + lead.sales.length})`} icon={Briefcase} T={T} defaultOpen={lead.rentals.length > 0 || lead.sales.length > 0}>
        <DealsPanel lead={lead} slug={slug} T={T} />
      </Section>

      <Section title={`Задачи (${todos.filter(t => t.status !== "done").length})`} icon={CheckCircle} T={T}>
        <TodoList leadId={lead.user_id} leadName={lead.full_name || "Без имени"} todos={todos} crewId={crewId} slug={slug} T={T} />
      </Section>

      <Section title="Заметки" icon={StickyNote} T={T}>
        <NotesPanel leadId={lead.user_id} crewId={crewId} T={T} />
      </Section>

      <Section title="История" icon={History} T={T}>
        <div className="space-y-2">
          {/* CRM entry */}
          <div className="flex gap-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
              <UserPlus className="h-4 w-4" style={{ color: T.accent }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: T.text }}>Добавлен в CRM</p>
              <p className="text-[10px]" style={{ color: T.textFaint }}>{relativeTime(lead.createdAt)}</p>
            </div>
          </div>

          {/* Rental status changes */}
          {lead.rentals.length > 0 && lead.rentals.map((r) => {
            const history = (r.metadata?.history as Array<{ status: string; at: string; message?: string }>) || [];
            if (history.length === 0) return null;
            const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
              pending_confirmation: { label: "Заявка создана", color: "#f59e0b", icon: Clock },
              active: { label: "Активирована", color: "#10b981", icon: Activity },
              completed: { label: "Завершена", color: "#3b82f6", icon: CheckCircle },
              cancelled: { label: "Отклонена", color: "#ef4444", icon: X },
              confirmed: { label: "Подтверждена", color: "#8b5cf6", icon: CheckCircle },
              disputed: { label: "В споре", color: "#ef4444", icon: ShieldAlert },
            };
            return history.map((h, i) => {
              const sMeta = statusLabels[h.status] || { label: h.status, color: T.textMuted, icon: Clock };
              const Icon = sMeta.icon;
              return (
                <div key={`${r.rentalId}-${i}`} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: sMeta.color + "20" }}>
                    <Icon className="h-4 w-4" style={{ color: sMeta.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium" style={{ color: T.text }}>
                      {sMeta.label}
                      <span className="ml-1.5 text-[10px] font-normal" style={{ color: T.textFaint }}>— {r.bikeTitle || "Байк"}</span>
                    </p>
                    <p className="text-[10px]" style={{ color: T.textFaint }}>{relativeTime(h.at)}</p>
                    {h.message && (
                      <p className="mt-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] italic" style={{ color: T.textMuted, borderLeft: `2px solid ${sMeta.color}` }}>
                        {h.message}
                      </p>
                    )}
                  </div>
                </div>
              );
            });
          })}

          {/* Last activity */}
          {lead.lastSeenAt && lead.lastSeenAt !== lead.createdAt && (
            <div className="flex gap-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
                <Clock className="h-4 w-4" style={{ color: T.accent }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: T.text }}>Последняя активность</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>{relativeTime(lead.lastSeenAt)}</p>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead, T, isSelected, onSelect, onDismiss, todos,
}: {
  lead: LeadRow; T: ThemeTokens; isSelected: boolean;
  onSelect: () => void; onDismiss: (id: string) => void;
  todos: LeadTodoRow[];
}) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.unknown;
  const relTime = relativeTime(lead.lastSeenAt || lead.createdAt);
  const stageLabel = lead.intentStage ? STAGE_LABELS[lead.intentStage] || lead.intentStage : null;
  const pendingTodos = todos.filter((t) => t.status !== "done").length;
  const tempColor = temperatureColor(lead.urgencyScore, pendingTodos);
  const tempLabel = temperatureLabel(lead.urgencyScore, pendingTodos);
  const displayName = lead.full_name || "Без имени";

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border transition-all duration-200"
      style={{
        backgroundColor: T.bgCard,
        borderColor: isSelected ? T.borderActive : T.border,
        boxShadow: isSelected ? `0 0 0 2px ${T.borderActive}33, ${T.shadow}` : undefined,
      }}
    >
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: tempColor }} />
      <button onClick={onSelect} className="w-full p-3 pl-4 text-left">
        <div className="flex items-start gap-3">
          <Avatar name={lead.full_name} source={lead.source} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold" style={{ color: T.text }}>{displayName}</p>
              {lead.verified && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
              {pendingTodos > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-400">
                  {pendingTodos}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: T.textMuted }}>
              {lead.phone && <span className="truncate font-medium" style={{ color: T.text }}>{lead.phone}</span>}
              {lead.username && <span>@{lead.username}</span>}
              {relTime && <span>{relTime}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SourceBadge source={lead.source} />
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: tempColor + "15", color: tempColor }}>{tempLabel}</span>
              {lead.troubled && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "#dc262615", color: "#dc2626" }}>
                  <AlertCircle className="h-3 w-3" /> Проблемный
                </span>
              )}
            </div>
            {((lead.totalSpent || 0) > 0 || lead.rentals.length > 0 || lead.sales.length > 0) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]" style={{ color: T.textMuted }}>
                {lead.rentals.length > 0 && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{lead.rentals.length} аренд</span>}
                {lead.sales.length > 0 && <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{lead.sales.length} продаж</span>}
                {(lead.totalSpent || 0) > 0 && <span>{fmtMoney(lead.totalSpent)}</span>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`Убрать «${displayName}» из списка?`)) onDismiss(lead.user_id); }}
              className="rounded p-1.5 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
              style={{ color: T.textFaint }}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {isSelected ? <ChevronDown className="h-4 w-4" style={{ color: T.textFaint }} /> : <ChevronRight className="h-4 w-4" style={{ color: T.textFaint }} />}
          </div>
        </div>
      </button>
    </div>
  );
}

// ── Board View ────────────────────────────────────────────────────────────────

function BoardView({
  leads, selectedId, onSelect, onDismiss, getTodosForLead, T,
}: {
  leads: LeadRow[]; selectedId: string | null; onSelect: (id: string) => void;
  onDismiss: (id: string) => void; getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  T: ThemeTokens;
}) {
  const columns = useMemo(() => {
    const map: Record<string, LeadRow[]> = { new: [], contacted: [], configured: [], contract_generated: [], completed: [] };
    for (const l of leads) {
      const key = l.intentStage || "new";
      const col = map[key] ? key : "new";
      map[col].push(l);
    }
    return map;
  }, [leads]);

  const colMeta: Record<string, { label: string; color: string }> = {
    new: { label: "Новые", color: "#64748b" },
    contacted: { label: "В работе", color: "#3b82f6" },
    configured: { label: "Настроил", color: "#8b5cf6" },
    contract_generated: { label: "Договор", color: "#f59e0b" },
    completed: { label: "Завершено", color: "#10b981" },
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {Object.entries(columns).map(([key, colLeads]) => (
        <div key={key} className="flex max-h-[calc(100vh-280px)] flex-col rounded-2xl border" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <div className="flex items-center justify-between border-b p-3" style={{ borderColor: T.border }}>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colMeta[key].color }} />
              <span className="text-xs font-bold" style={{ color: T.text }}>{colMeta[key].label}</span>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: T.borderSoft, color: T.text }}>{colLeads.length}</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {colLeads.map((lead) => {
              const pending = getTodosForLead(lead).filter((t) => t.status !== "done").length;
              return (
                <div key={lead.user_id} onClick={() => onSelect(selectedId === lead.user_id ? "" : lead.user_id)}
                  className="cursor-pointer rounded-xl border p-2.5 transition hover:shadow-sm"
                  style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: selectedId === lead.user_id ? `0 0 0 2px ${T.borderActive}33` : undefined }}>
                  <div className="flex items-center gap-2">
                    <Avatar name={lead.full_name} source={lead.source} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold" style={{ color: T.text }}>{lead.full_name || "Без имени"}</p>
                      <p className="truncate text-[10px]" style={{ color: T.textMuted }}>{lead.phone || lead.username || relativeTime(lead.createdAt)}</p>
                    </div>
                    {pending > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 text-[9px] font-bold text-amber-400">{pending}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: metaFor(lead.source).bg, color: metaFor(lead.source).color }}>
                      {metaFor(lead.source).label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, T }: { hasFilters: boolean; T: ThemeTokens }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border p-12 text-center" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
        {hasFilters ? <Filter className="h-9 w-9" style={{ color: T.textFaint }} /> : <Users className="h-9 w-9" style={{ color: T.textFaint }} />}
      </div>
      <p className="text-base font-bold" style={{ color: T.text }}>{hasFilters ? "Ничего не найдено" : "Пока нет заявок"}</p>
      <p className="mt-1 max-w-xs text-sm" style={{ color: T.textFaint }}>
        {hasFilters ? "Попробуйте изменить фильтры или сбросить поиск" : "Новые заявки появятся здесь автоматически"}
      </p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function LeadsClient({
  leads, todos, crewId, slug, accentColor,
  textColor = "#e5e7eb", bgColor = "#0a0a0a", isLightTheme = false, isAuto = false,
}: LeadsClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [segment, setSegment] = useState<Segment>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const T = useTheme({ isAuto, isLightTheme, textColor, bgColor, accentColor });

  // ── Password auth ─────────────────────────────────────────────────────────
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);
  const [passwordAuthed, setPasswordAuthed] = useState(false);

  const isInTelegram = useMemo(() => {
    if (typeof window === "undefined") return false;
    const tg = (window as any).Telegram?.WebApp;
    return !!(tg?.initData && tg.initData.length > 0);
  }, []);

  useEffect(() => {
    if (!isInTelegram && !passwordAuthed) setShowPasswordEntry(true);
  }, [isInTelegram, passwordAuthed]);

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) return;
    setIsPasswordValidating(true);
    setPasswordError(null);
    try {
      const result = await validateAnalyticsPassword({ password: passwordInput });
      if (!result.success) { setPasswordError(result.error || "Неверный пароль"); return; }
      if (result.slug && result.slug !== slug.trim()) { setPasswordError("Пароль для другого экипажа"); return; }
      setPasswordAuthed(true);
      setShowPasswordEntry(false);
      setPasswordInput("");
    } catch { setPasswordError("Ошибка проверки пароля"); }
    finally { setIsPasswordValidating(false); }
  };

  // ── Scroll to selected lead card ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    // Small delay to let React render the opened panel
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-lead-id="${selectedId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedId]);

  // ── Data processing ───────────────────────────────────────────────────────
  const getTodoLeadId = useCallback((todo: LeadTodoRow): string | null => {
    // Priority: native lead_id column first, then fallback to JSON description
    if (todo.lead_id) return todo.lead_id;
    if (!todo.description) return null;
    try { return JSON.parse(todo.description).lead_id || null; } catch { return null; }
  }, []);

  const getTodoLeadPhone = useCallback((todo: LeadTodoRow): string | null => {
    if (!todo.description) return null;
    try { return JSON.parse(todo.description).lead_phone || null; } catch { return null; }
  }, []);

  const getTodosForLead = useCallback((lead: LeadRow): LeadTodoRow[] => {
    return todos.filter((t) => {
      const leadId = getTodoLeadId(t);
      if (leadId === lead.user_id) return true;
      const leadPhone = getTodoLeadPhone(t);
      if (leadPhone && lead.phone && leadPhone === lead.phone) return true;
      if (leadId && lead.phone && leadId === lead.phone) return true;
      return false;
    });
  }, [todos, getTodoLeadId, getTodoLeadPhone]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        (l.full_name || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q) ||
        (l.username || "").toLowerCase().includes(q) ||
        (l.bikeTitle || "").toLowerCase().includes(q) ||
        (l.sourceRoute || "").toLowerCase().includes(q)
      );
    }
    if (filterSource !== "all") result = result.filter((l) => l.source === filterSource);
    if (segment !== "all") {
      result = result.filter((l) => {
        const pt = getTodosForLead(l).filter((t) => t.status !== "done").length;
        if (segment === "troubled") return l.troubled === true;
        if (segment === "verified") return l.verified;
        if (segment === "hot") return !l.verified && ((l.urgencyScore ?? 0) >= 60 || pt > 0 || (l.totalSpent || 0) > 0);
        return !l.verified && !((l.urgencyScore ?? 0) >= 60 || pt > 0 || (l.totalSpent || 0) > 0);
      });
    }
    return result;
  }, [leads, searchQuery, filterSource, segment, getTodosForLead]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];
    switch (sortMode) {
      case "urgent":
        return arr.sort((a, b) => {
          const aT = getTodosForLead(a).filter((t) => t.status !== "done").length;
          const bT = getTodosForLead(b).filter((t) => t.status !== "done").length;
          const aScore = (a.urgencyScore || 0) + aT * 20;
          const bScore = (b.urgencyScore || 0) + bT * 20;
          if (aScore !== bScore) return bScore - aScore;
          return new Date(b.lastSeenAt || b.createdAt || 0).getTime() - new Date(a.lastSeenAt || a.createdAt || 0).getTime();
        });
      case "name":
        return arr.sort((a, b) => (a.full_name || "яя").localeCompare(b.full_name || "яя", "ru"));
      case "spent":
        return arr.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
      default:
        return arr.sort((a, b) => new Date(b.lastSeenAt || b.createdAt || 0).getTime() - new Date(a.lastSeenAt || a.createdAt || 0).getTime());
    }
  }, [filteredLeads, sortMode, getTodosForLead]);

  const { hot, verified, warm } = useMemo(() => {
    const hot: LeadRow[] = [];
    const verified: LeadRow[] = [];
    const warm: LeadRow[] = [];
    for (const l of sortedLeads) {
      const pt = getTodosForLead(l).filter((t) => t.status !== "done").length;
      if (l.verified) { verified.push(l); continue; }
      if ((l.urgencyScore ?? 0) >= 60 || pt > 0 || (l.totalSpent || 0) > 0) { hot.push(l); continue; }
      warm.push(l);
    }
    return { hot, verified, warm };
  }, [sortedLeads, getTodosForLead]);

  const availableSources = useMemo(() => Array.from(new Set(leads.map((l) => l.source))), [leads]);
  const hasFilters = !!(searchQuery || filterSource !== "all");
  const selectedLead = useMemo(() => sortedLeads.find((l) => l.user_id === selectedId) || null, [sortedLeads, selectedId]);

  // ── Dismiss ────────────────────────────────────────────────────────────────
  const handleDismissLead = async (leadId: string) => {
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, dismissLead: true, slug }),
      });
      if (!resp.ok) { alert("Не удалось убрать лид. Попробуйте позже."); return; }
      window.location.reload();
    } catch { alert("Ошибка сети."); }
  };

  // ── Password gate ──────────────────────────────────────────────────────────
  if (showPasswordEntry && !passwordAuthed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border p-6" style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
              <Lock className="h-6 w-6" style={{ color: T.accent }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: T.text }}>Клиенты и заявки</h2>
            <p className="mt-1 text-sm" style={{ color: T.textMuted }}>Введите пароль для доступа</p>
          </div>
          <input type="password" value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            placeholder="••••••••" disabled={isPasswordValidating}
            className="w-full rounded-xl border px-4 py-3 text-center tracking-widest outline-none transition focus:ring-2"
            style={{
              borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text,
              // @ts-ignore
              "--tw-ring-color": T.borderActive,
            }} autoFocus />
          {passwordError && (
            <p className="flex items-center justify-center gap-1.5 text-center text-sm text-red-400">
              <AlertCircle className="h-4 w-4" /> {passwordError}
            </p>
          )}
          <button onClick={handlePasswordSubmit} disabled={isPasswordValidating || !passwordInput.trim()}
            className="w-full rounded-xl py-3 font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: T.accent, color: T.accentContrast }}>
            {isPasswordValidating ? "Проверка..." : "Войти"}
          </button>
          <p className="text-center text-xs" style={{ color: T.textFaint }}>Пароль можно получить через бота: /analytics_pass</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <KpiCards leads={leads} hot={hot} verified={verified} todos={todos} T={T} />

      <Toolbar
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        sortMode={sortMode} setSortMode={setSortMode}
        filterSource={filterSource} setFilterSource={setFilterSource}
        availableSources={availableSources}
        segment={segment} setSegment={setSegment}
        viewMode={viewMode} setViewMode={setViewMode}
        T={T} isAuto={isAuto}
      />

      {viewMode === "board" ? (
        <BoardView
          leads={sortedLeads}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
          onDismiss={handleDismissLead}
          getTodosForLead={getTodosForLead}
          T={T}
        />
      ) : sortedLeads.length === 0 ? (
        <EmptyState hasFilters={hasFilters} T={T} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* List */}
          <div className={`space-y-3 ${selectedLead ? "lg:col-span-5" : "lg:col-span-12"}`}>
            {sortedLeads.map((lead) => {
              const isThisSelected = selectedId === lead.user_id;
              return (
                <div key={lead.user_id} data-lead-id={lead.user_id} className="space-y-3">
                  <LeadCard
                    lead={lead}
                    T={T}
                    isSelected={isThisSelected}
                    onSelect={() => setSelectedId(isThisSelected ? null : lead.user_id)}
                    onDismiss={handleDismissLead}
                    todos={getTodosForLead(lead)}
                  />
                  {/* FIX: Uncollapse the lead INLINE inside the list (not as a
                      separate bottom section) on mobile. The detail card sits
                      right beneath the selected LeadCard so the user doesn't
                      have to scroll all the way down. Hidden on desktop where
                      the side panel is used. */}
                  {isThisSelected && (
                    <div
                      className="lg:hidden rounded-2xl border p-4"
                      style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <Avatar name={lead.full_name} source={lead.source} size={48} />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-bold" style={{ color: T.text }}>{lead.full_name || "Без имени"}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: T.textMuted }}>
                            {lead.phone && <span>{lead.phone}</span>}
                            {lead.username && <span>@{lead.username}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedId(null)}
                          aria-label="Свернуть карточку"
                          className="rounded p-1 transition hover:bg-black/5"
                          style={{ color: T.textFaint }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <LeadDetailContent lead={lead} todos={getTodosForLead(lead)} crewId={crewId} slug={slug} T={T} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop detail panel */}
          {selectedLead && (
            <div className="hidden lg:block lg:col-span-7">
              <div className="sticky top-24 max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border p-4" style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}>
                <div className="mb-4 flex items-start gap-3">
                  <Avatar name={selectedLead.full_name} source={selectedLead.source} size={56} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold" style={{ color: T.text }}>{selectedLead.full_name || "Без имени"}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: T.textMuted }}>
                      {selectedLead.phone && <span>{selectedLead.phone}</span>}
                      {selectedLead.username && <span>@{selectedLead.username}</span>}
                      <span>{relativeTime(selectedLead.lastSeenAt || selectedLead.createdAt)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <SourceBadge source={selectedLead.source} size="md" />
                      {selectedLead.bikeTitle && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: T.borderSoft, color: T.text }}>
                          <Bike className="h-3 w-3" /> {selectedLead.bikeTitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="rounded p-1 transition hover:bg-black/5" style={{ color: T.textFaint }}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <LeadDetailContent lead={selectedLead} todos={getTodosForLead(selectedLead)} crewId={crewId} slug={slug} T={T} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
