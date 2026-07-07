"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Flame, Phone, CheckCircle, ChevronDown, ChevronRight, Plus,
  Trash2, MessageCircle, Send, Clock, TrendingUp, Search,
  X, Bike, FileText, Mail, CircleDot, Users, Lock, AlertCircle,
  LayoutList, Columns3, MoreHorizontal, Calendar, UserPlus,
  Download, Star, Filter, ArrowUpRight, StickyNote, History,
  MapPin, Briefcase, Zap
} from "lucide-react";
import { validateAnalyticsPassword } from "../../server-actions/rentals-dashboard";

// ── Types ────────────────────────────────────────────────────────────────────

interface LeadRow {
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  source: string;
  bikeTitle: string | null;
  createdAt: string | null;
  verified: boolean;
  intentType?: string | null;
  intentStage?: string | null;
  urgencyScore?: number | null;
}

interface TodoRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  description?: string | null;
}

interface LeadsClientProps {
  leads: LeadRow[];
  todos: TodoRow[];
  crewId: string;
  slug: string;
  accentColor: string;
  textColor?: string;
  bgColor?: string;
  isLightTheme?: boolean;
  isAuto?: boolean;
}

type ViewMode = "list" | "board";
type Segment = "all" | "hot" | "verified" | "warm";
type DetailTab = "contacts" | "tasks" | "notes" | "history";
type SortMode = "recent" | "urgent" | "name" | "verified";

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; icon: typeof Flame; color: string; bg: string; ring: string }> = {
  web_callback:    { label: "Звонок",     icon: Phone,        color: "#3b82f6", bg: "#3b82f620", ring: "#3b82f640" },
  rental_contract: { label: "Аренда",     icon: CheckCircle,  color: "#10b981", bg: "#10b98120", ring: "#10b98140" },
  sale_contract:   { label: "Покупка",    icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20", ring: "#f59e0b40" },
  test_drive:      { label: "Тест-драйв", icon: Bike,         color: "#8b5cf6", bg: "#8b5cf620", ring: "#8b5cf640" },
  dashboard_intent:{ label: "Заявка",     icon: Flame,        color: "#ef4444", bg: "#ef444420", ring: "#ef444440" },
  rental_secret:   { label: "Документы",  icon: FileText,     color: "#06b6d4", bg: "#06b6d420", ring: "#06b6d440" },
  profile_prefill: { label: "Профиль",    icon: FileText,     color: "#6366f1", bg: "#6366f120", ring: "#6366f140" },
  unknown:         { label: "Клиент",     icon: Users,        color: "#64748b", bg: "#64748b20", ring: "#64748b40" },
};

const STAGE_LABELS: Record<string, string> = {
  contract_generated: "Договор готов",
  checkout_started: "Оформление",
  checkout_completed: "Оплачен",
  dismissed: "Отклонён",
  interest_paid: "Интерес",
  new: "Новый",
  contacted: "Контакт установлен",
};

const INTENT_LABELS: Record<string, string> = {
  rent: "Аренда",
  sale: "Покупка",
  test_drive: "Тест-драйв",
  rental_contract: "Аренда",
  sale_contract: "Покупка",
};

const BOARD_COLUMNS = [
  { key: "new", label: "Новые", color: "#64748b" },
  { key: "contacted", label: "В работе", color: "#3b82f6" },
  { key: "contract_generated", label: "Договор", color: "#f59e0b" },
  { key: "checkout_completed", label: "Завершено", color: "#10b981" },
  { key: "dismissed", label: "Отклонено", color: "#ef4444" },
];

const SEGMENT_META: Record<Segment, { label: string; icon: typeof Flame; color: string }> = {
  all:       { label: "Все",       icon: Users,       color: "#64748b" },
  hot:       { label: "Горячие",   icon: Flame,       color: "#ef4444" },
  verified:  { label: "Клиенты",   icon: CheckCircle, color: "#10b981" },
  warm:      { label: "Заявки",    icon: Phone,       color: "#3b82f6" },
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

function formatPhoneDigits(phone: string | null): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length === 11) digits = "7" + digits.slice(1);
  if (digits.startsWith("9") && digits.length === 10) digits = "7" + digits;
  return digits;
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

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, source, size = 44 }: { name: string | null; source: string; size?: number }) {
  const meta = SOURCE_META[source] || SOURCE_META.unknown;
  const initials = getInitials(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: size > 40 ? "14px" : "12px",
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

// ── Small UI atoms ────────────────────────────────────────────────────────────

function InfoTile({ label, value, T }: { label: string; value: string; T: ThemeTokens }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: T.textFaint }}>{label}</p>
      <p className="mt-0.5 text-xs font-semibold" style={{ color: T.text }}>{value}</p>
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

// ── KPI Cards ─────────────────────────────────────────────────────────────────

function KpiCards({ leads, hot, verified, todos, T }: {
  leads: LeadRow[]; hot: LeadRow[]; verified: LeadRow[]; todos: TodoRow[]; T: ThemeTokens;
}) {
  const today = leads.filter((l) => isToday(l.createdAt)).length;
  const pending = todos.filter((t) => t.status !== "done").length;
  const cards = [
    { label: "Всего лидов", value: leads.length, icon: Users, color: T.textMuted },
    { label: "Новые сегодня", value: today, icon: Star, color: T.accent },
    { label: "Горячие", value: hot.length, icon: Flame, color: "#ef4444" },
    { label: "Клиенты", value: verified.length, icon: CheckCircle, color: "#10b981" },
    { label: "Задач в работе", value: pending, icon: Clock, color: "#f59e0b" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label}
            className="relative overflow-hidden rounded-2xl border p-3 transition hover:shadow-md"
            style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: T.textFaint }}>{c.label}</p>
                <p className="mt-1 text-2xl font-black tracking-tight" style={{ color: T.text }}>{c.value}</p>
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
      style={{
        backgroundColor: isAuto ? `color-mix(in srgb, var(--franchize-bg-base) 88%, transparent)` : T.bgCard,
        borderColor: T.border,
      }}>
      {/* Row 1: search + controls */}
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
              backgroundColor: T.inputBg,
              borderColor: T.inputBorder,
              color: T.text,
              // @ts-ignore
              "--tw-ring-color": T.borderActive,
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 transition hover:opacity-80"
              style={{ color: T.textFaint }}>
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
              <option key={s} value={s}>{SOURCE_META[s]?.label || s}</option>
            ))}
          </select>

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-xl border px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }}>
            <option value="recent">Свежие</option>
            <option value="urgent">🔥 Срочные</option>
            <option value="verified">✅ Клиенты</option>
            <option value="name">А → Я</option>
          </select>

          <button disabled
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium opacity-50"
            style={{ borderColor: T.border, color: T.textMuted }}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Row 2: segment tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {(Object.keys(SEGMENT_META) as Segment[]).map((key) => {
          const meta = SEGMENT_META[key];
          const Icon = meta.icon;
          const active = segment === key;
          return (
            <button key={key} onClick={() => setSegment(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${active ? "" : "hover:bg-black/5"}`}
              style={active ? {
                backgroundColor: meta.color + "15",
                color: meta.color,
                borderColor: meta.color + "40",
              } : { color: T.textMuted, borderColor: "transparent" }}>
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Todo List ────────────────────────────────────────────────────────────────

function TodoList({
  leadId, leadName, todos, crewId, slug, T,
}: {
  leadId: string; leadName: string; todos: TodoRow[];
  crewId: string; slug: string; T: ThemeTokens;
}) {
  const [localTodos, setLocalTodos] = useState<TodoRow[]>(todos);
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
          <input
            type="text" placeholder="Что нужно сделать?"
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full rounded-lg border px-3 py-2 text-xs outline-none"
            style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}
            autoFocus
          />
          <div className="flex gap-2">
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-[11px] outline-none"
              style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
            <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: T.accent }}>
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
              <span className={`flex-1 text-xs ${todo.status === "done" ? "line-through" : ""}`} style={{ color: T.text }}>
                {todo.title}
              </span>
              {todo.priority === "high" && todo.status !== "done" && (
                <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">!</span>
              )}
              <button onClick={() => handleDelete(todo.id)}
                className="shrink-0 rounded p-1 opacity-40 transition hover:opacity-80 hover:bg-red-500/10">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notes Panel ───────────────────────────────────────────────────────────────

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
        <textarea
          value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Заметка о клиенте..."
          rows={3}
          className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none"
          style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}
        />
        <button onClick={addNote} disabled={!draft.trim()}
          className="w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-40"
          style={{ backgroundColor: T.accent }}>
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

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ lead, T }: { lead: LeadRow; T: ThemeTokens }) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.unknown;
  const events = [
    { icon: meta.icon, label: `Лид создан: ${meta.label}`, time: lead.createdAt },
    { icon: UserPlus, label: "Добавлен в CRM", time: lead.createdAt },
  ];
  return (
    <div className="space-y-2">
      {events.map((e, i) => {
        const Icon = e.icon;
        return (
          <div key={i} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
              <Icon className="h-4 w-4" style={{ color: T.accent }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: T.text }}>{e.label}</p>
              <p className="text-[10px]" style={{ color: T.textFaint }}>{relativeTime(e.time)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Contact Panel ─────────────────────────────────────────────────────────────

function ContactPanel({ lead, T }: { lead: LeadRow; T: ThemeTokens }) {
  const phoneDigits = formatPhoneDigits(lead.phone);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {lead.phone && (
          <>
            <ActionBtn href={`tel:${lead.phone}`} icon={Phone} label="Позвонить" T={T} />
            <ActionBtn href={`https://wa.me/${phoneDigits}`} icon={MessageCircle} label="WhatsApp" T={T} external />
            <ActionBtn href={`sms:${lead.phone}`} icon={Mail} label="SMS" T={T} />
          </>
        )}
        {lead.username && (
          <ActionBtn href={`https://t.me/${lead.username}`} icon={Send} label="Telegram" T={T} external />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {lead.phone && <InfoTile label="Телефон" value={lead.phone} T={T} />}
        {lead.username && <InfoTile label="Telegram" value={`@${lead.username}`} T={T} />}
        {lead.bikeTitle && <InfoTile label="Байк" value={lead.bikeTitle} T={T} />}
        {lead.intentStage && <InfoTile label="Стадия" value={STAGE_LABELS[lead.intentStage] || lead.intentStage} T={T} />}
        {lead.urgencyScore != null && <InfoTile label="Приоритет" value={`${lead.urgencyScore}/100`} T={T} />}
        <InfoTile label="Источник" value={metaFor(lead.source).label} T={T} />
      </div>
    </div>
  );
}

function metaFor(source: string) { return SOURCE_META[source] || SOURCE_META.unknown; }

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead, T, isSelected, onSelect, onDismiss, todos, crewId, slug,
}: {
  lead: LeadRow; T: ThemeTokens; isSelected: boolean;
  onSelect: () => void; onDismiss: (id: string) => void;
  todos: TodoRow[]; crewId: string; slug: string;
}) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.unknown;
  const relTime = relativeTime(lead.createdAt);
  const stageLabel = lead.intentStage ? STAGE_LABELS[lead.intentStage] || lead.intentStage : null;
  const intentLabel = lead.intentType ? INTENT_LABELS[lead.intentType] || lead.intentType : null;
  const pendingTodos = todos.filter((t) => t.status !== "done").length;
  const tempColor = temperatureColor(lead.urgencyScore, pendingTodos);
  const tempLabel = temperatureLabel(lead.urgencyScore, pendingTodos);
  const displayName = lead.full_name || (lead.source === "test_drive" ? "Новый тест-драйв" : "Без имени");

  return (
    <div
      onClick={onSelect}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border p-3 transition-all duration-200 hover:shadow-md"
      style={{
        backgroundColor: T.bgCard,
        borderColor: isSelected ? T.borderActive : T.border,
        boxShadow: isSelected ? `0 0 0 2px ${T.borderActive}33, ${T.shadow}` : undefined,
      }}>
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: tempColor }} />

      <div className="flex items-start gap-3 pl-2">
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
            {intentLabel && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: meta.bg, color: meta.color }}>
                {intentLabel}
              </span>
            )}
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: tempColor + "15", color: tempColor }}>
              {tempLabel}
            </span>
          </div>
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

      {stageLabel && lead.bikeTitle && (
        <div className="mt-2 flex items-center gap-2 pl-2 text-[11px]" style={{ color: T.textMuted }}>
          {lead.bikeTitle && <span className="truncate">{lead.bikeTitle}</span>}
          {stageLabel && <span className="shrink-0">• {stageLabel}</span>}
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ lead, todos, crewId, slug, T, onClose }: {
  lead: LeadRow; todos: TodoRow[]; crewId: string; slug: string; T: ThemeTokens; onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("contacts");
  const meta = SOURCE_META[lead.source] || SOURCE_META.unknown;
  const displayName = lead.full_name || (lead.source === "test_drive" ? "Новый тест-драйв" : "Без имени");

  return (
    <div className="flex h-full flex-col rounded-2xl border" style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: T.shadow }}>
      {/* Header */}
      <div className="flex items-start gap-3 border-b p-4" style={{ borderColor: T.border }}>
        <Avatar name={lead.full_name} source={lead.source} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-bold" style={{ color: T.text }}>{displayName}</h3>
            {lead.verified && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: T.textMuted }}>
            {lead.phone && <span>{lead.phone}</span>}
            {lead.username && <span>@{lead.username}</span>}
            <span>{relativeTime(lead.createdAt)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SourceBadge source={lead.source} size="md" />
            {lead.bikeTitle && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: T.borderSoft, color: T.text }}>
                <Bike className="h-3 w-3" /> {lead.bikeTitle}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="rounded p-1 transition hover:bg-black/5" style={{ color: T.textFaint }}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: T.border }}>
        {([
          { key: "contacts", label: "Контакты", icon: Phone },
          { key: "tasks", label: "Задачи", icon: CheckCircle },
          { key: "notes", label: "Заметки", icon: StickyNote },
          { key: "history", label: "История", icon: History },
        ] as { key: DetailTab; label: string; icon: typeof Phone }[]).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[11px] font-semibold transition sm:text-xs`}
              style={{
                borderColor: active ? T.accent : "transparent",
                color: active ? T.accent : T.textMuted,
                backgroundColor: active ? T.borderSoft : "transparent",
              }}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "contacts" && <ContactPanel lead={lead} T={T} />}
        {tab === "tasks" && <TodoList leadId={lead.user_id} leadName={displayName} todos={todos} crewId={crewId} slug={slug} T={T} />}
        {tab === "notes" && <NotesPanel leadId={lead.user_id} T={T} />}
        {tab === "history" && <HistoryPanel lead={lead} T={T} />}
      </div>
    </div>
  );
}

// ── Board View ────────────────────────────────────────────────────────────────

function BoardView({
  leads, selectedId, onSelect, onDismiss, getTodosForLead, T, crewId, slug,
}: {
  leads: LeadRow[]; selectedId: string | null; onSelect: (id: string) => void;
  onDismiss: (id: string) => void; getTodosForLead: (id: string) => TodoRow[];
  T: ThemeTokens; crewId: string; slug: string;
}) {
  const columnMap = useMemo(() => {
    const map: Record<string, LeadRow[]> = {};
    for (const col of BOARD_COLUMNS) map[col.key] = [];
    for (const l of leads) {
      const key = l.intentStage || "new";
      const col = BOARD_COLUMNS.find((c) => c.key === key) || BOARD_COLUMNS[0];
      map[col.key].push(l);
    }
    return map;
  }, [leads]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {BOARD_COLUMNS.map((col) => (
        <div key={col.key} className="flex max-h-[calc(100vh-280px)] flex-col rounded-2xl border" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <div className="flex items-center justify-between border-b p-3" style={{ borderColor: T.border }}>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
              <span className="text-xs font-bold" style={{ color: T.text }}>{col.label}</span>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: T.borderSoft, color: T.text }}>{columnMap[col.key].length}</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {columnMap[col.key].map((lead) => {
              const pending = getTodosForLead(lead.user_id).filter((t) => t.status !== "done").length;
              return (
                <div key={lead.user_id} onClick={() => onSelect(lead.user_id)}
                  className="cursor-pointer rounded-xl border p-2.5 transition hover:shadow-sm"
                  style={{ borderColor: T.border, backgroundColor: T.bgCard, boxShadow: selectedId === lead.user_id ? `0 0 0 2px ${T.borderActive}33` : undefined }}>
                  <div className="flex items-center gap-2">
                    <Avatar name={lead.full_name} source={lead.source} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold" style={{ color: T.text }}>{lead.full_name || (lead.source === "test_drive" ? "Новый тест-драйв" : "Без имени")}</p>
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
      <p className="text-base font-bold" style={{ color: T.text }}>
        {hasFilters ? "Ничего не найдено" : "Пока нет заявок"}
      </p>
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
  const getTodoLeadId = useCallback((todo: TodoRow): string | null => {
    if (!todo.description) return null;
    try { return JSON.parse(todo.description).lead_id || null; } catch { return null; }
  }, []);

  const getTodosForLead = useCallback((leadId: string): TodoRow[] => {
    return todos.filter((t) => getTodoLeadId(t) === leadId);
  }, [todos, getTodoLeadId]);

  const dedupedLeads = useMemo(() => {
    const map = new Map<string, LeadRow>();
    const sourcePriority: Record<string, number> = {
      rental_contract: 5, sale_contract: 4, test_drive: 3,
      dashboard_intent: 2, web_callback: 1, rental_secret: 0,
      profile_prefill: 0, unknown: -1,
    };
    for (const lead of leads) {
      const existing = map.get(lead.user_id);
      if (!existing) { map.set(lead.user_id, lead); continue; }
      const leadScore = sourcePriority[lead.source] ?? 0;
      const existScore = sourcePriority[existing.source] ?? 0;
      if (leadScore > existScore) {
        map.set(lead.user_id, {
          ...lead,
          phone: lead.phone || existing.phone,
          full_name: lead.full_name || existing.full_name,
          username: lead.username || existing.username,
          bikeTitle: lead.bikeTitle || existing.bikeTitle,
          verified: lead.verified || existing.verified,
        });
      }
    }
    return Array.from(map.values());
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let result = dedupedLeads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        (l.full_name || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q) ||
        (l.username || "").toLowerCase().includes(q) ||
        (l.bikeTitle || "").toLowerCase().includes(q)
      );
    }
    if (filterSource !== "all") result = result.filter((l) => l.source === filterSource);
    if (segment !== "all") {
      result = result.filter((l) => {
        const pt = getTodosForLead(l.user_id).filter((t) => t.status !== "done").length;
        if (segment === "verified") return l.verified;
        if (segment === "hot") return !l.verified && ((l.urgencyScore ?? 0) >= 60 || pt > 0);
        return !l.verified && !((l.urgencyScore ?? 0) >= 60 || pt > 0);
      });
    }
    return result;
  }, [dedupedLeads, searchQuery, filterSource, segment, getTodosForLead]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];
    switch (sortMode) {
      case "urgent":
        return arr.sort((a, b) => {
          const aT = getTodosForLead(a.user_id).filter((t) => t.status !== "done").length;
          const bT = getTodosForLead(b.user_id).filter((t) => t.status !== "done").length;
          const aScore = (a.urgencyScore || 0) + aT * 20;
          const bScore = (b.urgencyScore || 0) + bT * 20;
          if (aScore !== bScore) return bScore - aScore;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      case "name":
        return arr.sort((a, b) => (a.full_name || "яя").localeCompare(b.full_name || "яя", "ru"));
      case "verified":
        return arr.sort((a, b) => {
          if (a.verified !== b.verified) return a.verified ? -1 : 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      default:
        return arr.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
  }, [filteredLeads, sortMode, getTodosForLead]);

  const { hot, verified, warm } = useMemo(() => {
    const hot: LeadRow[] = [];
    const verified: LeadRow[] = [];
    const warm: LeadRow[] = [];
    for (const l of sortedLeads) {
      const pt = getTodosForLead(l.user_id).filter((t) => t.status !== "done").length;
      if (l.verified) { verified.push(l); continue; }
      if ((l.urgencyScore ?? 0) >= 60 || pt > 0) { hot.push(l); continue; }
      warm.push(l);
    }
    return { hot, verified, warm };
  }, [sortedLeads, getTodosForLead]);

  const availableSources = useMemo(() => Array.from(new Set(leads.map((l) => l.source))), [leads]);
  const hasFilters = searchQuery || filterSource !== "all";
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
            style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text, // @ts-ignore
              "--tw-ring-color": T.borderActive }} autoFocus />
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
          <p className="text-center text-xs" style={{ color: T.textFaint }}>Пароль можно получить через бота: /analytics-pass</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <KpiCards leads={dedupedLeads} hot={hot} verified={verified} todos={todos} T={T} />

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
          T={T} crewId={crewId} slug={slug}
        />
      ) : sortedLeads.length === 0 ? (
        <EmptyState hasFilters={hasFilters} T={T} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-5">
          {/* List */}
          <div className={`space-y-3 ${selectedLead ? "xl:col-span-2" : "xl:col-span-5"}`}>
            {sortedLeads.map((lead) => (
              <LeadCard
                key={lead.user_id}
                lead={lead}
                T={T}
                isSelected={selectedId === lead.user_id}
                onSelect={() => setSelectedId(selectedId === lead.user_id ? null : lead.user_id)}
                onDismiss={handleDismissLead}
                todos={getTodosForLead(lead.user_id)}
                crewId={crewId}
                slug={slug}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selectedLead && (
            <div className="xl:col-span-3">
              <div className="sticky top-24 max-h-[calc(100vh-140px)]">
                <DetailPanel
                  lead={selectedLead}
                  todos={getTodosForLead(selectedLead.user_id)}
                  crewId={crewId}
                  slug={slug}
                  T={T}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
