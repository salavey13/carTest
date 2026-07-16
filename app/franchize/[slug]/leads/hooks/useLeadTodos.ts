"use client";

import { useState, useEffect, useCallback } from "react";
import type { LeadTodoRow } from "@/app/franchize/server-actions/leads";

export interface UseLeadTodosReturn {
  todos: LeadTodoRow[];
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  newTitle: string;
  setNewTitle: (v: string) => void;
  newPriority: string;
  setNewPriority: (v: string) => void;
  saving: boolean;
  handleAdd: () => Promise<void>;
  handleToggle: (todoId: string, currentStatus: string) => Promise<void>;
  handleDelete: (todoId: string) => Promise<void>;
}

export function useLeadTodos(
  leadId: string,
  leadName: string,
  initialTodos: LeadTodoRow[],
  crewId: string,
  slug: string
): UseLeadTodosReturn {
  const [todos, setTodos] = useState<LeadTodoRow[]>(initialTodos);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTodos(initialTodos); }, [initialTodos]);

  const handleAdd = useCallback(async () => {
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
        setTodos([data.todo, ...todos]);
        setNewTitle("");
        setShowAddForm(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  }, [newTitle, newPriority, crewId, slug, leadId, leadName, todos]);

  const handleToggle = useCallback(async (todoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    const prev = todos;
    setTodos(todos.map((t) => (t.id === todoId ? { ...t, status: newStatus } : t)));
    try {
      const r = await fetch("/api/franchize/lead-todo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId, status: newStatus }),
      });
      if (!r.ok) throw new Error();
    } catch { setTodos(prev); }
  }, [todos]);

  const handleDelete = useCallback(async (todoId: string) => {
    const prev = todos;
    setTodos(todos.filter((t) => t.id !== todoId));
    try {
      const r = await fetch("/api/franchize/lead-todo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoId }),
      });
      if (!r.ok) throw new Error();
    } catch { setTodos(prev); }
  }, [todos]);

  return {
    todos,
    showAddForm,
    setShowAddForm,
    newTitle,
    setNewTitle,
    newPriority,
    setNewPriority,
    saving,
    handleAdd,
    handleToggle,
    handleDelete,
  };
}