"use client";

import { useState } from "react";
import { Plus, CheckCircle, CircleDot, Trash2, AlertCircle } from "lucide-react";
import type { LeadTodoRow } from "@/app/franchize/server-actions/leads";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";
import { useAppContext } from "@/contexts/AppContext";

interface TodoListProps {
  leadId: string;
  leadName: string;
  todos: LeadTodoRow[];
  crewId: string;
  slug: string;
  T: ThemeTokens;
  /** Called after successful toggle/add/delete so parent can sync its todos state */
  onTodoUpdate?: (action: 'toggle' | 'delete' | 'add', todoId: string, todo?: LeadTodoRow) => void;
}

export function TodoList({ leadId, leadName, todos: initialTodos, crewId, slug, T, onTodoUpdate }: TodoListProps) {
  const { dbUser } = useAppContext();
  // Build auth headers so PATCH/POST/DELETE pass crew membership check
  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (dbUser?.user_id) h["x-telegram-user-id"] = dbUser.user_id;
    return h;
  };

  // Use initialTodos as initial state only (no useEffect syncing from props).
  // Key={lead.user_id} on the parent ensures remount on lead switch.
  // This avoids the optimistic-update revert bug: local state is never overwritten
  // by stale prop references.
  const [localTodos, setLocalTodos] = useState<LeadTodoRow[]>(initialTodos);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ crewId, slug, leadId, leadName, title: newTitle.trim(), priority: newPriority }),
      });
      const data = await resp.json();
      if (data.success && data.todo) {
        setLocalTodos([data.todo, ...localTodos]);
        setNewTitle("");
        setShowAddForm(false);
        onTodoUpdate?.('add', data.todo.id, data.todo);
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
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ todoId, status: newStatus }),
      });
      if (!r.ok) throw new Error();
      onTodoUpdate?.('toggle', todoId);
    } catch { setLocalTodos(prev); }
  };

  const handleDelete = async (todoId: string) => {
    const prev = localTodos;
    setLocalTodos(localTodos.filter((t) => t.id !== todoId));
    try {
      const r = await fetch("/api/franchize/lead-todo", {
        method: "DELETE", headers: authHeaders(),
        body: JSON.stringify({ todoId }),
      });
      if (!r.ok) throw new Error();
      onTodoUpdate?.('delete', todoId);
    } catch { setLocalTodos(prev); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: T.textMuted }}>
          Задачи {localTodos.length > 0 && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: T.borderSoft, color: T.text }}>{localTodos.length}</span>}
        </p>
        <button onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:brightness-110"
          style={{ backgroundColor: T.accent, color: T.accentContrast }}>
          <Plus className="h-3 w-3" aria-hidden /> Добавить
        </button>
      </div>

      {showAddForm && (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: T.inputBorder, backgroundColor: T.bgElevated }}>
          <input type="text" placeholder="Что нужно сделать?"
            value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            aria-label="Новая задача"
            className="min-h-[44px] w-full rounded-lg border px-3 py-2 text-xs outline-none"
            style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }} autoFocus />
          <div className="flex gap-2">
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              aria-label="Приоритет"
              className="min-h-[36px] rounded-lg border px-2 py-1.5 text-[11px] outline-none"
              style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }}>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
            <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
              className="min-h-[36px] inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: T.accent, color: T.accentContrast }}>
              <Plus className="h-3 w-3" aria-hidden />
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
              className="flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 transition hover:shadow-sm"
              style={{ borderColor: T.border, backgroundColor: T.bgElevated, opacity: todo.status === "done" ? 0.55 : 1 }}>
              <button onClick={() => handleToggle(todo.id, todo.status)} className="shrink-0 cursor-pointer" aria-label={todo.status === "done" ? "Снять отметку" : "Отметить выполненной"}>
                {todo.status === "done"
                  ? <CheckCircle className="h-4 w-4" style={{ color: "#22c55e" }} />
                  : <CircleDot className="h-4 w-4" style={{ color: T.textFaint }} />}
              </button>
              <span className={`flex-1 text-xs ${todo.status === "done" ? "line-through" : ""}`} style={{ color: T.text }}>{todo.title}</span>
              {todo.priority === "high" && todo.status !== "done" && (
                <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "#ef44441a", color: "#ef4444" }}>!</span>
              )}
              <button onClick={() => handleDelete(todo.id)} className="shrink-0 cursor-pointer rounded p-1 opacity-40 transition hover:opacity-80" aria-label="Удалить задачу"
                onMouseEnter={(e) => { e.currentTarget.style.background = "#ef44441a"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textFaint; }}
                style={{ color: T.textFaint }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}