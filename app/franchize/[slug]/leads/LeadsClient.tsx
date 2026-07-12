"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Flame, Phone, CheckCircle, ChevronDown, ChevronRight, Plus,
  Trash2, Send, Clock, TrendingUp, Search, X, Bike, FileText,
  CircleDot, Users, Lock, AlertCircle, LayoutList, Columns3,
  Calendar, UserPlus, Download, Star, Filter, StickyNote, History,
  MapPin, ExternalLink, Banknote, Briefcase, ShieldAlert, Hash,
  MessageSquare, Wallet
} from "lucide-react";
import { validateAnalyticsPassword } from "../../server-actions/rentals-dashboard";
import type { LeadRow, LeadTodoRow, LeadRentalRow, LeadSaleRow } from "../../server-actions/leads";

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

function NotesPanel({ leadId, T }: { leadId: string; T: ThemeTokens }) {
  const storageKey = `lead_notes_${leadId}`;
  const [notes, setNotes] = useState<{ id: string; text: string; at: string }[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setNotes(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notes));
  }, [notes, storageKey]);

  const addNote = () => {
    if (!draft.trim()) return;
    setNotes([{ id: `n-${Date.now()}`, text: draft.trim(), at: new Date().toISOString() }, ...notes]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: T.inputBorder, backgroundColor: T.bgElevated }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Заметка о клиенте..." rows={3}
          className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none"
          style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }} />
        <button onClick={addNote} disabled={!draft.trim()}
          className="w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-40" style={{ backgroundColor: T.accent }}>
          Добавить заметку
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
              <p className="text-xs leading-relaxed" style={{ color: T.text }}>{n.text}</p>
              <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>{relativeTime(n.at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deals ─────────────────────────────────────────────────────────────────────

function DealsPanel({ lead, T }: { lead: LeadRow; T: ThemeTokens }) {
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
          {lead.rentals.map((r, i) => <RentalRow key={r.rentalId || i} rental={r} T={T} />)}
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

function RentalRow({ rental, T }: { rental: LeadRentalRow; T: ThemeTokens }) {
  const statusMeta: Record<string, { label: string; color: string }> = {
    active: { label: "Активна", color: "#10b981" },
    completed: { label: "Завершена", color: "#3b82f6" },
    confirmed: { label: "Подтверждена", color: "#8b5cf6" },
    pending_confirmation: { label: "В обработке", color: "#f59e0b" },
    cancelled: { label: "Отменена", color: "#64748b" },
  };
  const meta = statusMeta[rental.status] || { label: rental.status, color: T.textMuted };
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: T.text }}>{rental.bikeTitle || "Байк"}</p>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: meta.color + "15", color: meta.color }}>{meta.label}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" style={{ color: T.textMuted }}>
        <span><Calendar className="inline h-3 w-3 mr-1" />{formatDate(rental.startDate)} — {formatDate(rental.endDate)}</span>
        <span><Banknote className="inline h-3 w-3 mr-1" />{fmtMoney(rental.totalCost)}</span>
      </div>
      {rental.rentalId && (
        <a href={`/franchize/vip-bike/rental/${rental.rentalId}`} target="_blank" rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: T.accent }}>
          Открыть аренду <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
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
  return (
    <div className="space-y-3">
      <Section title="Контакты и действия" icon={Phone} T={T} defaultOpen>
        <ContactPanel lead={lead} T={T} todos={todos} />
      </Section>

      <Section title={`Сделки (${lead.rentals.length + lead.sales.length})`} icon={Briefcase} T={T} defaultOpen={lead.rentals.length > 0 || lead.sales.length > 0}>
        <DealsPanel lead={lead} T={T} />
      </Section>

      <Section title={`Задачи (${todos.filter(t => t.status !== "done").length})`} icon={CheckCircle} T={T}>
        <TodoList leadId={lead.user_id} leadName={lead.full_name || "Без имени"} todos={todos} crewId={crewId} slug={slug} T={T} />
      </Section>

      <Section title="Заметки" icon={StickyNote} T={T}>
        <NotesPanel leadId={lead.user_id} T={T} />
      </Section>

      <Section title="История" icon={History} T={T}>
        <div className="space-y-2">
          <div className="flex gap-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
              <UserPlus className="h-4 w-4" style={{ color: T.accent }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: T.text }}>Добавлен в CRM</p>
              <p className="text-[10px]" style={{ color: T.textFaint }}>{relativeTime(lead.createdAt)}</p>
            </div>
          </div>
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
                <div key={lead.user_id} className="space-y-3">
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
