"use client";

import { useState, useCallback } from "react";
import {
  CheckCircle, Phone, Globe, FileText, Lock, MessageCircle,
  Flame, LayoutDashboard, ChevronDown, ChevronRight, Plus, Trash2, CircleDot
} from "lucide-react";

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
  description: string | null;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  completed_at: string | null;
  assigned_to: string | null;
}

const SOURCE_META: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  web_callback: { label: "Заявка с сайта", icon: Globe, color: "#3b82f6" },
  dashboard_intent: { label: "Интерес", icon: LayoutDashboard, color: "#f59e0b" },
  rental_contract: { label: "Аренда", icon: FileText, color: "#10b981" },
  sale_contract: { label: "Покупка", icon: FileText, color: "#a855f7" },
  test_drive: { label: "Тест-драйв", icon: FileText, color: "#f97316" },
  rental_secret: { label: "Данные", icon: Lock, color: "#6b7280" },
  profile_prefill: { label: "Профиль", icon: MessageCircle, color: "#8b5cf6" },
};

const INTENT_LABELS: Record<string, string> = {
  rent: "Аренда",
  sale: "Покупка",
  test_ride: "Тест-драйв",
  test_drive: "Тест-драйв",
  checkout_start: "Оформление",
  callback_request: "Звонок",
  rental_contract: "Договор аренды",
  sale_contract: "Договор продажи",
};

export default function LeadsClient({
  leads,
  todos,
  accentColor,
  crewId,
  slug,
}: {
  leads: LeadRow[];
  todos: TodoRow[];
  accentColor: string;
  crewId: string;
  slug: string;
}) {
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  // Parse lead_id from todo description (stored as JSON prefix)
  const getTodoLeadId = (todo: TodoRow): string | null => {
    if (!todo.description) return null;
    try {
      const parsed = JSON.parse(todo.description);
      return parsed.lead_id || null;
    } catch {
      return null;
    }
  };

  const getTodosForLead = (leadId: string): TodoRow[] => {
    return todos.filter((t) => getTodoLeadId(t) === leadId);
  };

  const verified = leads.filter((l) => l.verified);
  const hot = leads.filter((l) => !l.verified && (l.urgencyScore ?? 0) >= 60);
  const warm = leads.filter((l) => !l.verified && (l.urgencyScore ?? 0) < 60);

  return (
    <div className="mt-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <StatCard count={leads.length} label="Всего" color={accentColor} />
        <StatCard count={verified.length} label="Клиенты" color="#10b981" />
        <StatCard count={hot.length} label="Горячие 🔥" color="#ef4444" />
        <StatCard count={todos.filter(t => t.status !== "done").length} label="Задачи" color="#f59e0b" />
      </div>

      {hot.length > 0 && (
        <LeadSection title={`Горячие заявки (${hot.length})`} icon={Flame} iconColor="#ef4444"
          leads={hot} accentColor={accentColor} expandedLead={expandedLead} setExpandedLead={setExpandedLead}
          getTodosForLead={getTodosForLead} crewId={crewId} slug={slug} allTodos={todos} />
      )}

      {verified.length > 0 && (
        <LeadSection title={`Клиенты (${verified.length})`} icon={CheckCircle} iconColor="#10b981"
          leads={verified} accentColor={accentColor} expandedLead={expandedLead} setExpandedLead={setExpandedLead}
          getTodosForLead={getTodosForLead} crewId={crewId} slug={slug} allTodos={todos} />
      )}

      {warm.length > 0 && (
        <LeadSection title={`Заявки (${warm.length})`} icon={Phone} iconColor="#3b82f6"
          leads={warm} accentColor={accentColor} expandedLead={expandedLead} setExpandedLead={setExpandedLead}
          getTodosForLead={getTodosForLead} crewId={crewId} slug={slug} allTodos={todos} />
      )}

      {leads.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: `${accentColor}20` }}>
          <Phone className="mx-auto mb-3 h-10 w-4 opacity-40" />
          <p className="text-sm opacity-60">Пока нет ни одной заявки</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: `${color}30` }}>
      <p className="text-xl font-bold sm:text-2xl" style={{ color }}>{count}</p>
      <p className="text-[10px] opacity-60 sm:text-xs">{label}</p>
    </div>
  );
}

function LeadSection({
  title, icon: Icon, iconColor, leads, accentColor, expandedLead, setExpandedLead,
  getTodosForLead, crewId, slug, allTodos,
}: {
  title: string;
  icon: typeof Flame;
  iconColor: string;
  leads: LeadRow[];
  accentColor: string;
  expandedLead: string | null;
  setExpandedLead: (id: string | null) => void;
  getTodosForLead: (id: string) => TodoRow[];
  crewId: string;
  slug: string;
  allTodos: TodoRow[];
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
            isExpanded={expandedLead === lead.user_id}
            onToggle={() => setExpandedLead(expandedLead === lead.user_id ? null : lead.user_id)}
            todos={getTodosForLead(lead.user_id)}
            crewId={crewId}
            slug={slug}
          />
        ))}
      </div>
    </div>
  );
}

function LeadCard({
  lead, accentColor, isExpanded, onToggle, todos, crewId, slug,
}: {
  lead: LeadRow;
  accentColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  todos: TodoRow[];
  crewId: string;
  slug: string;
}) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.dashboard_intent;
  const Icon = meta.icon;
  const date = lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", year: "numeric",
  }) : "";
  const intentLabel = lead.intentType ? INTENT_LABELS[lead.intentType] || lead.intentType : null;
  const pendingTodos = todos.filter((t) => t.status !== "done").length;

  return (
    <div
      className="rounded-xl border transition"
      style={{ borderColor: isExpanded ? accentColor : `${accentColor}20`, backgroundColor: `${accentColor}05` }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={onToggle}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{lead.full_name || "Без имени"}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-60">
            {lead.phone && <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="hover:opacity-100">📱 {lead.phone}</a>}
            {lead.username && <span>@{lead.username}</span>}
            {lead.bikeTitle && <span className="max-w-32 truncate">🏍 {lead.bikeTitle}</span>}
            {intentLabel && <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: `${meta.color}15` }}>{intentLabel}</span>}
            {date && <span>{date}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {pendingTodos > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              {pendingTodos} задач
            </span>
          )}
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
            {meta.label}
          </span>
          {lead.verified && <CheckCircle className="h-4 w-4 text-emerald-400" />}
          {isExpanded ? <ChevronDown className="h-4 w-4 opacity-50" /> : <ChevronRight className="h-4 w-4 opacity-50" />}
        </div>
      </div>

      {/* Expanded section — todos */}
      {isExpanded && (
        <div className="border-t px-3 py-3" style={{ borderColor: `${accentColor}15` }}>
          {/* Contact actions */}
          <div className="mb-3 flex gap-2">
            {lead.phone && (
              <>
                <a href={`tel:${lead.phone}`} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition hover:opacity-80"
                  style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                  <Phone className="h-3 w-3" /> Позвонить
                </a>
                <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition hover:opacity-80"
                  style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              </>
            )}
          </div>

          {/* Todos */}
          <TodoList leadId={lead.user_id} leadName={lead.full_name || "Без имени"} todos={todos} crewId={crewId} slug={slug} accentColor={accentColor} />
        </div>
      )}
    </div>
  );
}

function TodoList({
  leadId, leadName, todos, crewId, slug, accentColor,
}: {
  leadId: string;
  leadName: string;
  todos: TodoRow[];
  crewId: string;
  slug: string;
  accentColor: string;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState("medium");
  const [localTodos, setLocalTodos] = useState<TodoRow[]>(todos);
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
    // Optimistic update
    setLocalTodos(localTodos.map((t) => t.id === todoId ? { ...t, status: newStatus } : t));
    try {
      await fetch("/api/franchize/lead-todo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId, status: newStatus }),
      });
    } catch { /* revert on error */ }
  };

  const handleDeleteTodo = async (todoId: string) => {
    setLocalTodos(localTodos.filter((t) => t.id !== todoId));
    try {
      await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId }),
      });
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium opacity-70">📋 Задачи по клиенту</p>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition hover:opacity-80"
          style={{ borderColor: `${accentColor}40`, color: accentColor }}>
          <Plus className="h-3 w-3" /> Добавить
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-2 space-y-2 rounded-lg border p-2" style={{ borderColor: `${accentColor}20` }}>
          <input
            type="text"
            placeholder="Что нужно сделать?"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
            className="w-full rounded border px-2 py-1.5 text-xs"
            style={{ borderColor: `${accentColor}20`, backgroundColor: "var(--franchize-shell-card, rgba(0,0,0,0.1))", color: "inherit" }}
            autoFocus
          />
          <div className="flex gap-2">
            <select value={newTodoPriority} onChange={(e) => setNewTodoPriority(e.target.value)}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: `${accentColor}20`, backgroundColor: "var(--franchize-shell-card, rgba(0,0,0,0.1))", color: "inherit" }}>
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

      {/* Todo list */}
      {localTodos.length === 0 ? (
        <p className="py-2 text-center text-xs opacity-40">Нет задач</p>
      ) : (
        <div className="space-y-1">
          {localTodos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
              style={{ borderColor: `${accentColor}15`, opacity: todo.status === "done" ? 0.5 : 1 }}>
              <button onClick={() => handleToggleTodo(todo.id, todo.status)}
                className="shrink-0">
                {todo.status === "done"
                  ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                  : <CircleDot className="h-4 w-4 opacity-40" />}
              </button>
              <span className={`flex-1 text-xs ${todo.status === "done" ? "line-through" : ""}`}>
                {todo.title}
              </span>
              {todo.priority === "high" && <span className="rounded bg-red-500/20 px-1 text-[9px] text-red-400">!</span>}
              <button onClick={() => handleDeleteTodo(todo.id)}
                className="shrink-0 opacity-30 transition hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
