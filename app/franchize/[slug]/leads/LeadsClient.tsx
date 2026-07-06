"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Flame, Phone, CheckCircle, ChevronDown, ChevronRight, Plus,
  Trash2, MessageCircle, Send, Clock, TrendingUp, Search,
  Filter, ArrowUpDown, X, Bike, FileText, Mail, CircleDot,
} from "lucide-react";

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
}

// ── Source metadata ──────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; icon: typeof Flame; color: string }> = {
  web_callback: { label: "Звонок", icon: Phone, color: "#3b82f6" },
  rental_contract: { label: "Аренда", icon: CheckCircle, color: "#10b981" },
  sale_contract: { label: "Покупка", icon: TrendingUp, color: "#f59e0b" },
  test_drive: { label: "Тест-драйв", icon: Bike, color: "#8b5cf6" },
  dashboard_intent: { label: "Заявка", icon: Flame, color: "#ef4444" },
  rental_secret: { label: "Документы", icon: FileText, color: "#06b6d4" },
  profile_prefill: { label: "Профиль", icon: FileText, color: "#6366f1" },
  unknown: { label: "Клиент", icon: Phone, color: "#64748b" },
};

const INTENT_LABELS: Record<string, string> = {
  rent: "Аренда",
  sale: "Покупка",
  test_drive: "Тест-драйв",
  rental_contract: "Аренда",
  sale_contract: "Покупка",
};

type SortMode = "recent" | "urgent" | "name" | "verified";

// ── Main Component ───────────────────────────────────────────────────────────

export function LeadsClient({
  leads, todos, crewId, slug, accentColor,
  textColor = "#e5e7eb", bgColor = "#0a0a0a", isLightTheme = false,
}: LeadsClientProps) {
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [filterSource, setFilterSource] = useState<string>("all");

  // Parse lead_id from todo description
  const getTodoLeadId = useCallback((todo: TodoRow): string | null => {
    if (!todo.description) return null;
    try {
      const parsed = JSON.parse(todo.description);
      return parsed.lead_id || null;
    } catch {
      return null;
    }
  }, []);

  const getTodosForLead = useCallback((leadId: string): TodoRow[] => {
    return todos.filter((t) => getTodoLeadId(t) === leadId);
  }, [todos, getTodoLeadId]);

  // ── Smart filtering ──────────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        (l.full_name || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q) ||
        (l.username || "").toLowerCase().includes(q) ||
        (l.bikeTitle || "").toLowerCase().includes(q)
      );
    }

    // Source filter
    if (filterSource !== "all") {
      result = result.filter((l) => l.source === filterSource);
    }

    return result;
  }, [leads, searchQuery, filterSource]);

  // ── Smart sorting ────────────────────────────────────────────────────────

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];

    switch (sortMode) {
      case "urgent":
        // Sort by urgency score (desc), then by pending todos (desc), then by recency
        return arr.sort((a, b) => {
          const aUrgency = a.urgencyScore || 0;
          const bUrgency = b.urgencyScore || 0;
          if (aUrgency !== bUrgency) return bUrgency - aUrgency;
          const aTodos = getTodosForLead(a.user_id).filter((t) => t.status !== "done").length;
          const bTodos = getTodosForLead(b.user_id).filter((t) => t.status !== "done").length;
          if (aTodos !== bTodos) return bTodos - aTodos;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

      case "name":
        return arr.sort((a, b) => (a.full_name || "ЯЯЯЯ").localeCompare(b.full_name || "ЯЯЯЯ", "ru"));

      case "verified":
        // Verified leads first, then by recency
        return arr.sort((a, b) => {
          if (a.verified !== b.verified) return a.verified ? -1 : 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

      case "recent":
      default:
        return arr.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
  }, [filteredLeads, sortMode, getTodosForLead]);

  // ── Buckets ───────────────────────────────────────────────────────────────

  const verified = sortedLeads.filter((l) => l.verified);
  const hot = sortedLeads.filter((l) => {
    const pendingTodos = getTodosForLead(l.user_id).filter((t) => t.status !== "done").length;
    return !l.verified && ((l.urgencyScore ?? 0) >= 60 || pendingTodos > 0);
  });
  const warm = sortedLeads.filter((l) => {
    const pendingTodos = getTodosForLead(l.user_id).filter((t) => t.status !== "done").length;
    return !l.verified && (l.urgencyScore ?? 0) < 60 && pendingTodos === 0;
  });

  // ── Dismiss lead ─────────────────────────────────────────────────────────

  const handleDismissLead = async (leadId: string) => {
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, dismissLead: true }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        console.error("Dismiss failed:", data);
        alert("Не удалось убрать лид. Попробуйте позже.");
        return;
      }
      window.location.reload();
    } catch (e) {
      console.error("Dismiss error:", e);
      alert("Ошибка сети при удалении лида.");
    }
  };

  // ── Available source filters ──────────────────────────────────────────────

  const availableSources = useMemo(() => {
    const set = new Set(leads.map((l) => l.source));
    return Array.from(set);
  }, [leads]);

  const pendingTodoCount = todos.filter((t) => t.status !== "done").length;

  // ── Theme-aware styles ────────────────────────────────────────────────────

  const surfaceStyle = isLightTheme
    ? { backgroundColor: "#f8fafc", color: "#1e293b", borderColor: "#e2e8f0" }
    : { backgroundColor: bgColor, color: textColor, borderColor: `${accentColor}20` };

  const cardStyle = isLightTheme
    ? { backgroundColor: "#ffffff", borderColor: "#e2e8f0" }
    : { backgroundColor: `${accentColor}05`, borderColor: `${accentColor}20` };

  const mutedColor = isLightTheme ? "#64748b" : `${textColor}99`;
  const inputBg = isLightTheme ? "#ffffff" : `${accentColor}08`;
  const inputBorder = isLightTheme ? "#cbd5e1" : `${accentColor}20`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
          <input
            type="text"
            placeholder="Поиск по имени, телефону, байку..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition"
            style={{
              backgroundColor: inputBg,
              borderColor: inputBorder,
              color: surfaceStyle.color,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort + Filter */}
        <div className="flex gap-2">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: surfaceStyle.color }}
          >
            <option value="all">Все источники</option>
            {availableSources.map((s) => (
              <option key={s} value={s}>{SOURCE_META[s]?.label || s}</option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: surfaceStyle.color }}
          >
            <option value="recent">↓ Свежие</option>
            <option value="urgent">🔥 Срочные</option>
            <option value="verified">✅ Верифицированные</option>
            <option value="name">А-Я</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard count={sortedLeads.length} label="Всего" icon={Phone} color={accentColor} mutedColor={mutedColor} cardStyle={cardStyle} />
        <StatCard count={verified.length} label="Клиенты" icon={CheckCircle} color="#10b981" mutedColor={mutedColor} cardStyle={cardStyle} />
        <StatCard count={hot.length} label="Горячие 🔥" icon={Flame} color="#ef4444" mutedColor={mutedColor} cardStyle={cardStyle} />
        <StatCard count={pendingTodoCount} label="Задачи" icon={Clock} color="#f59e0b" mutedColor={mutedColor} cardStyle={cardStyle} />
      </div>

      {/* Lead sections */}
      <div className="space-y-4">
        {hot.length > 0 && (
          <LeadSection
            title={`Горячие лиды (${hot.length})`}
            icon={Flame} iconColor="#ef4444"
            leads={hot} accentColor={accentColor} mutedColor={mutedColor}
            cardStyle={cardStyle} inputBg={inputBg} inputBorder={inputBorder}
            expandedLead={expandedLead} setExpandedLead={setExpandedLead}
            getTodosForLead={getTodosForLead} crewId={crewId} slug={slug}
            surfaceColor={surfaceStyle.color}
            onDismiss={handleDismissLead}
          />
        )}

        {verified.length > 0 && (
          <LeadSection
            title={`Клиенты (${verified.length})`}
            icon={CheckCircle} iconColor="#10b981"
            leads={verified} accentColor={accentColor} mutedColor={mutedColor}
            cardStyle={cardStyle} inputBg={inputBg} inputBorder={inputBorder}
            expandedLead={expandedLead} setExpandedLead={setExpandedLead}
            getTodosForLead={getTodosForLead} crewId={crewId} slug={slug}
            surfaceColor={surfaceStyle.color}
            onDismiss={handleDismissLead}
          />
        )}

        {warm.length > 0 && (
          <LeadSection
            title={`Заявки (${warm.length})`}
            icon={Phone} iconColor="#3b82f6"
            leads={warm} accentColor={accentColor} mutedColor={mutedColor}
            cardStyle={cardStyle} inputBg={inputBg} inputBorder={inputBorder}
            expandedLead={expandedLead} setExpandedLead={setExpandedLead}
            getTodosForLead={getTodosForLead} crewId={crewId} slug={slug}
            surfaceColor={surfaceStyle.color}
            onDismiss={handleDismissLead}
          />
        )}
      </div>

      {sortedLeads.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={cardStyle}>
          <Phone className="mx-auto mb-3 h-10 w-4 opacity-30" />
          <p className="text-sm" style={{ color: mutedColor }}>
            {searchQuery || filterSource !== "all" ? "Ничего не найдено" : "Пока нет ни одной заявки"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ count, label, icon: Icon, color, mutedColor, cardStyle }: {
  count: number; label: string; icon: typeof Flame; color: string; mutedColor: string;
  cardStyle: Record<string, string>;
}) {
  return (
    <div className="rounded-xl border p-3 text-center" style={cardStyle}>
      <Icon className="mx-auto mb-1 h-4 w-4 opacity-50" style={{ color }} />
      <p className="text-xl font-bold sm:text-2xl" style={{ color }}>{count}</p>
      <p className="text-[10px] sm:text-xs" style={{ color: mutedColor }}>{label}</p>
    </div>
  );
}

// ── Lead Section ─────────────────────────────────────────────────────────────

function LeadSection({
  title, icon: Icon, iconColor, leads, accentColor, mutedColor,
  cardStyle, inputBg, inputBorder, expandedLead, setExpandedLead,
  getTodosForLead, crewId, slug, surfaceColor, onDismiss,
}: {
  title: string;
  icon: typeof Flame;
  iconColor: string;
  leads: LeadRow[];
  accentColor: string;
  mutedColor: string;
  cardStyle: Record<string, string>;
  inputBg: string;
  inputBorder: string;
  expandedLead: string | null;
  setExpandedLead: (id: string | null) => void;
  getTodosForLead: (id: string) => TodoRow[];
  crewId: string;
  slug: string;
  surfaceColor: string;
  onDismiss: (leadId: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: iconColor }}>
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead.user_id + lead.source}
            lead={lead}
            accentColor={accentColor}
            mutedColor={mutedColor}
            cardStyle={cardStyle}
            inputBg={inputBg}
            inputBorder={inputBorder}
            isExpanded={expandedLead === lead.user_id}
            onToggle={() => setExpandedLead(expandedLead === lead.user_id ? null : lead.user_id)}
            todos={getTodosForLead(lead.user_id)}
            crewId={crewId}
            slug={slug}
            surfaceColor={surfaceColor}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}

// ── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead, accentColor, mutedColor, cardStyle, inputBg, inputBorder,
  isExpanded, onToggle, todos, crewId, slug, surfaceColor, onDismiss,
}: {
  lead: LeadRow;
  accentColor: string;
  mutedColor: string;
  cardStyle: Record<string, string>;
  inputBg: string;
  inputBorder: string;
  isExpanded: boolean;
  onToggle: () => void;
  todos: TodoRow[];
  crewId: string;
  slug: string;
  surfaceColor: string;
  onDismiss: (leadId: string) => void;
}) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.unknown;
  const Icon = meta.icon;
  const date = lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short",
  }) : "";
  const intentLabel = lead.intentType ? INTENT_LABELS[lead.intentType] || lead.intentType : null;
  const pendingTodos = todos.filter((t) => t.status !== "done").length;
  const phoneDigits = (lead.phone || "").replace(/\D/g, "");

  return (
    <div
      className="rounded-xl border transition"
      style={{
        ...cardStyle,
        borderColor: isExpanded ? accentColor : cardStyle.borderColor,
      }}
    >
      {/* Header */}
      <div className="flex cursor-pointer items-center gap-3 p-3" onClick={onToggle}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: surfaceColor }}>
            {lead.full_name || "Без имени"}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: mutedColor }}>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="hover:opacity-100">
                📱 {lead.phone}
              </a>
            )}
            {lead.username && <span>@{lead.username}</span>}
            {lead.bikeTitle && <span className="max-w-32 truncate">🏍 {lead.bikeTitle}</span>}
            {intentLabel && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: `${meta.color}15` }}>
                {intentLabel}
              </span>
            )}
            {date && <span>{date}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {pendingTodos > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              {pendingTodos}
            </span>
          )}
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
            {meta.label}
          </span>
          {lead.verified && <CheckCircle className="h-4 w-4 text-emerald-400" />}
          {isExpanded
            ? <ChevronDown className="h-4 w-4 opacity-50" />
            : <ChevronRight className="h-4 w-4 opacity-50" />}
        </div>
      </div>

      {/* Expanded */}
      {isExpanded && (
        <div className="border-t px-3 py-3" style={{ borderColor: `${accentColor}15` }}>
          {/* Contact actions */}
          <div className="mb-3 flex flex-wrap gap-2">
            {lead.phone && (
              <>
                <a href={`tel:${lead.phone}`}
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition hover:opacity-80"
                  style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                  <Phone className="h-3 w-3" /> Позвонить
                </a>
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition hover:opacity-80"
                  style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              </>
            )}
            {lead.username && (
              <a href={`https://t.me/${lead.username}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition hover:opacity-80"
                style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                <Send className="h-3 w-3" /> Telegram
              </a>
            )}
            {lead.phone && (
              <a href={`sms:${lead.phone}`}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition hover:opacity-80"
                style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                <Mail className="h-3 w-3" /> SMS
              </a>
            )}
          </div>

          {/* Lead details */}
          {(lead.intentStage || lead.urgencyScore != null) && (
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              {lead.intentStage && (
                <div className="rounded-lg border p-2" style={{ borderColor: inputBorder }}>
                  <span style={{ color: mutedColor }}>Стадия</span>
                  <p className="font-medium" style={{ color: surfaceColor }}>{lead.intentStage}</p>
                </div>
              )}
              {lead.urgencyScore != null && (
                <div className="rounded-lg border p-2" style={{ borderColor: inputBorder }}>
                  <span style={{ color: mutedColor }}>Приоритет</span>
                  <p className="font-medium" style={{ color: surfaceColor }}>
                    {lead.urgencyScore >= 80 ? "🔥 Высокий" : lead.urgencyScore >= 50 ? "⚡ Средний" : "💤 Низкий"} ({lead.urgencyScore})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Todos */}
          <TodoList
            leadId={lead.user_id}
            leadName={lead.full_name || "Без имени"}
            todos={todos}
            crewId={crewId}
            slug={slug}
            accentColor={accentColor}
            mutedColor={mutedColor}
            inputBg={inputBg}
            inputBorder={inputBorder}
            surfaceColor={surfaceColor}
          />

          {/* Dismiss */}
          <div className="mt-3 border-t pt-2" style={{ borderColor: `${accentColor}10` }}>
            <button
              onClick={() => {
                if (confirm(`Убрать "${lead.full_name || 'этот лид'}" из списка?`)) {
                  onDismiss(lead.user_id);
                }
              }}
              className="flex items-center gap-1 text-xs opacity-40 transition hover:opacity-80 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" /> Убрать из списка
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Todo List ────────────────────────────────────────────────────────────────

function TodoList({
  leadId, leadName, todos, crewId, slug,
  accentColor, mutedColor, inputBg, inputBorder, surfaceColor,
}: {
  leadId: string;
  leadName: string;
  todos: TodoRow[];
  crewId: string;
  slug: string;
  accentColor: string;
  mutedColor: string;
  inputBg: string;
  inputBorder: string;
  surfaceColor: string;
}) {
  const [localTodos, setLocalTodos] = useState<TodoRow[]>(todos);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewId, slug, leadId, leadName,
          title: newTodoTitle.trim(),
          priority: newTodoPriority,
        }),
      });
      const data = await resp.json();
      if (data.success && data.todo) {
        setLocalTodos([data.todo, ...localTodos]);
        setNewTodoTitle("");
        setShowAddForm(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleToggleTodo = async (todoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    const prevTodos = localTodos;
    setLocalTodos(localTodos.map((t) => t.id === todoId ? { ...t, status: newStatus } : t));
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId, status: newStatus }),
      });
      if (!resp.ok) throw new Error("PATCH failed");
    } catch {
      setLocalTodos(prevTodos);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    const prevTodos = localTodos;
    setLocalTodos(localTodos.filter((t) => t.id !== todoId));
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId }),
      });
      if (!resp.ok) throw new Error("DELETE failed");
    } catch {
      setLocalTodos(prevTodos);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: mutedColor }}>📋 Задачи по клиенту</p>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition hover:opacity-80"
          style={{ borderColor: `${accentColor}40`, color: accentColor }}>
          <Plus className="h-3 w-3" /> Добавить
        </button>
      </div>

      {showAddForm && (
        <div className="mb-2 space-y-2 rounded-lg border p-2" style={{ borderColor: inputBorder }}>
          <input
            type="text"
            placeholder="Что нужно сделать?"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
            className="w-full rounded border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: inputBorder, backgroundColor: inputBg, color: surfaceColor }}
            autoFocus
          />
          <div className="flex gap-2">
            <select value={newTodoPriority} onChange={(e) => setNewTodoPriority(e.target.value)}
              className="rounded border px-2 py-1 text-xs outline-none"
              style={{ borderColor: inputBorder, backgroundColor: inputBg, color: surfaceColor }}>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
            <button onClick={handleAddTodo} disabled={saving || !newTodoTitle.trim()}
              className="rounded px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: accentColor }}>
              {saving ? "..." : "OK"}
            </button>
          </div>
        </div>
      )}

      {localTodos.length === 0 ? (
        <p className="py-2 text-center text-xs opacity-40">Нет задач</p>
      ) : (
        <div className="space-y-1">
          {localTodos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
              style={{ borderColor: `${accentColor}15`, opacity: todo.status === "done" ? 0.5 : 1 }}>
              <button onClick={() => handleToggleTodo(todo.id, todo.status)} className="shrink-0">
                {todo.status === "done"
                  ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                  : <CircleDot className="h-4 w-4 opacity-40" />}
              </button>
              <span className={`flex-1 text-xs ${todo.status === "done" ? "line-through" : ""}`} style={{ color: surfaceColor }}>
                {todo.title}
              </span>
              {todo.priority === "high" && <span className="rounded bg-red-500/20 px-1 text-[9px] text-red-400">!</span>}
              <button onClick={() => handleDeleteTodo(todo.id)}
                className="shrink-0 opacity-50 transition hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
