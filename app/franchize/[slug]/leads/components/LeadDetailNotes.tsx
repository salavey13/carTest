"use client";

import { useState } from "react";
import { Plus, StickyNote } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import { relativeTime } from "../leads-utils";

export interface LeadDrawerNote {
  id: string;
  text: string;
  created_at: string;
  created_by: string | null;
}

interface LeadDetailNotesProps {
  notes: LeadDrawerNote[];
  onAddNote: (text: string) => void;
  T: ThemeTokens;
}

/**
 * Extracted notes section from LeadDetailDrawer for better maintainability.
 * Handles note display and creation with optimistic updates.
 */
export function LeadDetailNotes({ notes, onAddNote, T }: LeadDetailNotesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");

  const handleAddNote = () => {
    if (newNoteText.trim()) {
      onAddNote(newNoteText.trim());
      setNewNoteText("");
      setIsAdding(false);
    }
  };

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: T.border, background: T.bgCard }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" style={{ color: T.primary }} />
          <span className="text-sm font-semibold" style={{ color: T.text }}>
            Заметки
          </span>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: T.bgElevated, color: T.textSecondary }}>
            {notes.length}
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
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Новая заметка..."
            className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
            style={{
              borderColor: T.border,
              background: T.bg,
              color: T.text,
              minHeight: "80px",
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewNoteText("");
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
              style={{ color: T.textSecondary }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.bgElevated; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleAddNote}
              disabled={!newNoteText.trim()}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-40"
              style={{ background: T.primary, color: "white" }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Добавить
            </button>
          </div>
        </div>
      )}

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm" style={{ color: T.textMuted }}>
            Заметок нет
          </p>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border p-3"
              style={{
                borderColor: T.border,
                background: T.bg,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium" style={{ color: T.text }}>
                  {n.created_by || "Аноним"}
                </span>
                <span className="shrink-0 text-xs" style={{ color: T.textFaint }}>
                  {relativeTime(n.created_at)}
                </span>
              </div>
              <p className="mt-1.5 text-sm" style={{ color: T.textMuted }}>
                {n.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
