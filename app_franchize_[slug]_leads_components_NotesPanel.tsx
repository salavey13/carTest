"use client";

import { useState, useEffect } from "react";
import { Trash2, Loader2, StickyNote } from "lucide-react";
import { getLeadNotes, createLeadNote, deleteLeadNote, type LeadNote } from "@/app/franchize/server-actions/lead-notes";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

interface NotesPanelProps {
  leadId: string;
  crewId: string;
  T: ThemeTokens;
}

export function NotesPanel({ leadId, crewId, T }: NotesPanelProps) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        <Loader2 className="mx-auto h-4 w-4 animate-spin" style={{ color: T.accent }} />
        <p className="mt-1 text-xs" style={{ color: T.textMuted }}>Загрузка заметок...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: T.inputBorder, backgroundColor: T.bgElevated }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="Заметка о клиенте..." rows={3}
          aria-label="Текст заметки"
          className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none"
          style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }} />
        <button onClick={addNote} disabled={!draft.trim() || saving}
          className="min-h-[44px] w-full cursor-pointer rounded-lg py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: T.accent, color: T.accentContrast }}>
          {saving ? "Сохранение..." : "Добавить заметку"}
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <StickyNote className="mx-auto mb-2 h-6 w-6" style={{ color: T.textFaint }} aria-hidden />
          <p className="text-xs" style={{ color: T.textFaint }}>Заметок пока нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-xs leading-relaxed" style={{ color: T.text }}>{n.text}</p>
                <button onClick={() => deleteNote(n.id)} className="shrink-0 cursor-pointer rounded p-1 opacity-40 transition hover:opacity-80" aria-label="Удалить заметку"
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#ef44441a"; e.currentTarget.style.color = "#ef4444"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textFaint; }}
                  style={{ color: T.textFaint }}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>
                {new Date(n.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}