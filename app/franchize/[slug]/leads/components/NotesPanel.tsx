"use client";

import { useState, useEffect } from "react";
import { Trash2, Loader2, StickyNote } from "lucide-react";
import { getLeadNotes, createLeadNote, deleteLeadNote, type LeadNote } from "@/app/franchize/server-actions/lead-notes";

interface NotesPanelProps {
  leadId: string;
  crewId: string;
  T: any;
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
          className="w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none"
          style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }} />
        <button onClick={addNote} disabled={!draft.trim() || saving}
          className="w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-40" style={{ backgroundColor: T.accent }}>
          {saving ? "Сохранение..." : "Добавить заметку"}
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
          <StickyNote className="mx-auto h-6 w-6 mb-2" style={{ color: T.textFaint }} />
          <p className="text-xs" style={{ color: T.textFaint }}>Заметок пока нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-relaxed flex-1" style={{ color: T.text }}>{n.text}</p>
                <button onClick={() => deleteNote(n.id)} className="shrink-0 rounded p-1 opacity-40 transition hover:opacity-80 hover:bg-red-500/10">
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