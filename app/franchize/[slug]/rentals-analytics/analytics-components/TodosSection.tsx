"use client";

import { useState } from "react";
import { Plus, X, CheckCircle2 } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";

interface Todo {
  id: string;
  title: string;
  status: string;
  assigned_name: string | null;
  priority: string | null;
}

type TodoPriority = "low" | "medium" | "high";

interface TodosSectionProps {
  todos: Todo[];
  todoStats: { total: number; pending: number; inProgress: number; done: number } | null;
  loadingTodos: boolean;
  todoFilter: string;
  onFilterChange: (f: string) => void;
  showTodoForm: boolean;
  onToggleForm: () => void;
  creatingTodo: boolean;
  onCreateTodo: (title: string, priority: TodoPriority, assignee: string | null) => Promise<void>;
  crewMembers: Array<{ user_id: string; full_name: string | null; username: string | null }>;
  textPrimary: string;
  textSecondary: string;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
}

export function TodosSection({
  todos, todoStats, loadingTodos, todoFilter, onFilterChange,
  showTodoForm, onToggleForm, creatingTodo, onCreateTodo, crewMembers,
  textPrimary, textSecondary, accentMain, bgCard, borderSoft,
}: TodosSectionProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [assignee, setAssignee] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onCreateTodo(title.trim(), priority, assignee);
    setTitle("");
    setPriority("medium");
    setAssignee(null);
  };

  return (
    <div className="lg:col-span-2 rounded-xl md:rounded-2xl border overflow-hidden transition-all duration-300" style={{ backgroundColor: withAlpha(bgCard, 0.4), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)", borderWidth: "1px" }}>
      <div className="px-4 md:px-5 py-2.5 md:py-3 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: withAlpha(borderSoft, 0.3), background: `linear-gradient(to right, ${withAlpha(accentMain, 0.05)}, transparent)` }}>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0 shadow-lg animate-pulse" style={{ backgroundColor: accentMain, boxShadow: `0 0 10px ${withAlpha(accentMain, 0.5)}` }} />
          <span className="text-xs md:text-sm font-black tracking-tight" style={{ color: textPrimary }}>ЗАДАЧИ</span>
          {todoStats && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: withAlpha(accentMain, 0.15), color: accentMain }}>{todoStats.total}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          {(["all", "pending", "in_progress", "done"] as const).map((f) => (
            <button key={f} onClick={() => onFilterChange(todoFilter === f ? "all" : f)} className="relative px-2 md:px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden" style={todoFilter === f ? { backgroundColor: `linear-gradient(135deg, ${withAlpha(accentMain, 0.25)}, ${withAlpha(accentMain, 0.15)})`, color: accentMain, border: "1.5px solid", borderColor: withAlpha(accentMain, 0.3) } : { color: textSecondary }}>
              {f === "all" ? "Все" : f === "pending" ? "Ожидают" : f === "in_progress" ? "В работе" : "Готово"}
            </button>
          ))}
          <button onClick={onToggleForm} className="ml-1 flex items-center gap-1 px-2 md:px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300" style={{ backgroundColor: withAlpha(accentMain, 0.15), color: accentMain, border: "1.5px solid", borderColor: withAlpha(accentMain, 0.4) }} aria-label="Добавить задачу">
            <Plus className="w-3 h-3 md:w-3.5 md:h-3.5" /><span className="hidden sm:inline">Добавить</span>
          </button>
        </div>
      </div>

      {showTodoForm && (
        <div className="px-4 md:px-5 py-3 md:py-4 border-b space-y-2.5 md:space-y-3" style={{ borderColor: withAlpha(borderSoft, 0.3), backgroundColor: withAlpha(accentMain, 0.04) }}>
          <div className="flex items-center gap-2">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !creatingTodo) void handleSubmit(); if (e.key === "Escape") onToggleForm(); }} placeholder="Что нужно сделать?" autoFocus className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: bgCard, border: `1px solid ${borderSoft}`, color: textPrimary }} />
            <button onClick={onToggleForm} className="p-2 rounded-lg" style={{ color: textSecondary, border: `1px solid ${borderSoft}` }} aria-label="Закрыть форму"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide" style={{ color: textSecondary }}>Приоритет:</span>
              {(["low", "medium", "high"] as TodoPriority[]).map((p) => (
                <button key={p} onClick={() => setPriority(p)} className="px-2 py-1 rounded-md text-[10px] md:text-xs font-bold transition-all" style={priority === p ? { backgroundColor: withAlpha(accentMain, 0.25), color: accentMain, border: `1px solid ${withAlpha(accentMain, 0.4)}` } : { color: textSecondary, border: `1px solid ${borderSoft}` }}>
                  {p === "low" ? "Низкий" : p === "medium" ? "Средний" : "Высокий"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide" style={{ color: textSecondary }}>Кому:</span>
              <select value={assignee || ""} onChange={(e) => setAssignee(e.target.value || null)} className="px-2 py-1 rounded-md text-[10px] md:text-xs outline-none" style={{ backgroundColor: bgCard, border: `1px solid ${borderSoft}`, color: textPrimary }}>
                <option value="">Без исполнителя</option>
                {crewMembers.map((m) => (<option key={m.user_id} value={m.user_id}>{m.full_name || m.username || m.user_id}</option>))}
              </select>
            </div>
            <button onClick={() => void handleSubmit()} disabled={creatingTodo || !title.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50" style={{ backgroundColor: accentMain, color: "#ffffff" }}>
              <Plus className="w-3.5 h-3.5" />{creatingTodo ? "Создание..." : "Создать"}
            </button>
          </div>
        </div>
      )}

      <div className="p-3 md:p-4" style={{ minHeight: "200px" }}>
        {loadingTodos ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-2">
            {[1, 2, 3].map((i) => (<div key={i} className="h-16 md:h-20 rounded-xl animate-pulse" style={{ backgroundColor: withAlpha(bgCard, 0.5) }} />))}
          </div>
        ) : todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8"><CheckCircle2 className="w-8 h-8 mb-3" style={{ color: withAlpha(accentMain, 0.5) }} /><p className="text-xs md:text-sm" style={{ color: textSecondary }}>Нет активных задач</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-2">
            {todos.map((todo) => {
              const statusColor = todo.status === "done" ? "#10b981" : todo.status === "in_progress" ? "#f59e0b" : borderSoft;
              return (
                <div key={todo.id} className="p-2.5 md:p-3 rounded-lg md:rounded-xl border transition-all duration-300 group hover:scale-[1.02]" style={{ backgroundColor: todo.status === "done" ? `linear-gradient(135deg, ${withAlpha("#10b981", 0.15)}, ${withAlpha("#10b981", 0.08)})` : todo.status === "in_progress" ? `linear-gradient(135deg, ${withAlpha("#f59e0b", 0.15)}, ${withAlpha("#f59e0b", 0.08)})` : withAlpha(bgCard, 0.6), borderColor: todo.status === "done" ? withAlpha("#10b981", 0.3) : todo.status === "in_progress" ? withAlpha("#f59e0b", 0.3) : borderSoft, borderWidth: "1px" }}>
                  <div className="flex items-start gap-1.5 md:gap-2">
                    <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mt-1 md:mt-1.5 flex-shrink-0 shadow-sm" style={{ backgroundColor: statusColor, animation: todo.status === "in_progress" ? "pulse 2s infinite" : undefined, boxShadow: todo.status === "in_progress" ? `0 0 8px ${statusColor}` : undefined }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm font-semibold truncate" style={{ color: textPrimary }}>{todo.title}</p>
                      {todo.assigned_name && (<p className="text-[10px] md:text-xs mt-0.5 truncate" style={{ color: textSecondary }}>&rarr; {todo.assigned_name}</p>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
