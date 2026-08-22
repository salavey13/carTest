"use client";

import { useState } from "react";
import { Bell, CheckCircle2, Flame, Plus } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import { relativeTime } from "../leads-utils";

export interface LeadDrawerTodo {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  priority: "high" | "medium" | "low";
}

interface LeadDetailTodosProps {
  todos: LeadDrawerTodo[];
  onAddTodo: (text: string, priority: LeadDrawerTodo["priority"]) => void;
  onToggleTodo: (id: string) => void;
  T: ThemeTokens;
}

/**
 * Extracted todos section from LeadDetailDrawer for better maintainability.
 * Handles todo display, creation, and completion toggling.
 */
export function LeadDetailTodos({ todos, onAddTodo, onToggleTodo, T }: LeadDetailTodosProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<LeadDrawerTodo["priority"]>("medium");

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      onAddTodo(newTodoText.trim(), selectedPriority);
      setNewTodoText("");
      setSelectedPriority("medium");
      setIsAdding(false);
    }
  };

  const PRIORITY_META = {
    high: { label: "Срочно", color: "#ef4444", icon: Flame },
    medium: { label: "Важно", color: "#f59e0b", icon: Bell },
    low: { label: "Можно", color: "#64748b", icon: Bell },
  };

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: T.border, background: T.bgCard }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" style={{ color: T.primary }} />
          <span className="text-sm font-semibold" style={{ color: T.text }}>
            Задачи
          </span>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: T.bgElevated, color: T.textSecondary }}>
            {todos.filter(t => !t.completed).length}/{todos.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition"
          style={{ background: T.bgElevated }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.border; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = T.bgElevated; }}
        >
          <Plus className="h-4 w-4" style={{ color: T.text }} />
        </button>
      </div>

      {isAdding && (
        <div className="mb-3 space-y-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Новая задача..."
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{
              borderColor: T.border,
              background: T.bg,
              color: T.text,
            }}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleAddTodo(); }}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {(["high", "medium", "low"] as const).map((priority) => {
                const meta = PRIORITY_META[priority];
                const Icon = meta.icon;
                return (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setSelectedPriority(priority)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition"
                    style={{
                      background: selectedPriority === priority ? meta.color : T.bgElevated,
                      color: selectedPriority === priority ? "white" : T.textSecondary,
                    }}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewTodoText("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                style={{ color: T.textSecondary }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddTodo}
                disabled={!newTodoText.trim()}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-40"
                style={{ background: T.primary, color: "white" }}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {todos.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: T.textMuted }}>
            Задач нет
          </p>
        ) : (
          todos.map((todo) => {
            const meta = PRIORITY_META[todo.priority];
            return (
              <div
                key={todo.id}
                className="flex items-start gap-2 rounded-xl border p-2.5 transition"
                style={{
                  borderColor: todo.completed ? T.border : meta.color + "40",
                  background: todo.completed ? T.bg : meta.color + "10",
                  opacity: todo.completed ? 0.6 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggleTodo(todo.id)}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition"
                  style={{
                    borderColor: todo.completed ? T.border : meta.color,
                    background: todo.completed ? meta.color : "transparent",
                  }}
                >
                  {todo.completed && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "white" }} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{
                    color: T.text,
                    textDecoration: todo.completed ? "line-through" : "none",
                  }}>
                    {todo.text}
                  </p>
                  {!todo.completed && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs" style={{ color: meta.color }}>
                      <meta.icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  )}
                  {todo.completed_at && (
                    <span className="mt-1 block text-xs" style={{ color: T.textFaint }}>
                      Выполнено {relativeTime(todo.completed_at)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
