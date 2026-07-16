"use client";

import { useState, useEffect, useCallback } from "react";
import { getLeadNotes, createLeadNote, deleteLeadNote, type LeadNote } from "@/app/franchize/server-actions/lead-notes";

export interface UseLeadNotesReturn {
  notes: LeadNote[];
  loading: boolean;
  draft: string;
  setDraft: (v: string) => void;
  saving: boolean;
  addNote: () => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
}

export function useLeadNotes(leadId: string, crewId: string): UseLeadNotesReturn {
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
        console.error("[useLeadNotes] Failed to load notes:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId, crewId]);

  const addNote = useCallback(async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      const result = await createLeadNote({ leadId, crewId, text: draft.trim() });
      if (result.success && result.data) {
        setNotes([result.data, ...notes]);
        setDraft("");
      }
    } catch (err) {
      console.error("[useLeadNotes] Failed to create note:", err);
    } finally {
      setSaving(false);
    }
  }, [draft, saving, leadId, crewId, notes]);

  const deleteNote = useCallback(async (noteId: string) => {
    if (!confirm("Удалить заметку?")) return;
    try {
      const result = await deleteLeadNote(noteId);
      if (result.success) {
        setNotes(notes.filter((n) => n.id !== noteId));
      }
    } catch (err) {
      console.error("[useLeadNotes] Failed to delete note:", err);
    }
  }, [notes]);

  return { notes, loading, draft, setDraft, saving, addNote, deleteNote };
}