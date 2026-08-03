// /app/franchize/[slug]/leads/hooks/useLeadActions.ts
//
// Extracted from LeadsClient — all async actions (dismiss, todo CRUD, notes, drawer actions)
// in one hook. Removes fetch() calls from UI components.
//
// Usage:
//   const actions = useLeadActions({ slug, crewId, selectedLead, ... });
//   const { handleDismissLeadConfirm, handleCreateTodo, handleToggleTodo, ... } = actions;

"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
// FIX: leads-dismiss lives in app/franchize/server-actions/, NOT in leads/lib/.
// Was `../lib/leads-dismiss` which caused "Module not found" build error.
import { dismissLeadWithReason } from "@/app/franchize/server-actions/leads-dismiss";
import { getLeadsKpis, type LeadsKpis } from "@/app/franchize/server-actions/leads-kpis";
import { createLeadNote } from "@/app/franchize/server-actions/lead-notes";
import { DISMISS_REASONS } from "../lib/dismiss-reasons";

interface UseLeadActionsProps {
  slug: string;
  crewId: string;
  selectedLead: LeadRow | null;
  leadsState: LeadRow[];
  dbUser?: { user_id: string } | null;
  passwordAuthOwnerId?: string | null;
  onTodoUpdate: (action: "toggle" | "delete" | "add", todoId: string, todo?: LeadTodoRow) => void;
  onDismissOptimistic: (leadId: string) => void;
  onClearSelection: () => void;
  router: ReturnType<typeof useRouter>;
}

export function useLeadActions({
  slug,
  crewId,
  selectedLead,
  leadsState,
  dbUser,
  passwordAuthOwnerId,
  onTodoUpdate,
  onDismissOptimistic,
  onClearSelection,
  router,
}: UseLeadActionsProps) {
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [dismissLeadId, setDismissLeadId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<LeadsKpis | null>(null);

  // ── Fetch KPIs ──
  const fetchKpis = useCallback(async (mode: string) => {
    try {
      const result = await getLeadsKpis(slug, mode);
      setKpis(result);
    } catch (e) {
      console.error("[useLeadActions] KPI fetch failed:", e);
    }
  }, [slug]);

  // ── Dismiss lead ──
  const handleDismissLeadRequest = useCallback((leadId: string) => {
    setDismissLeadId(leadId);
    setDismissDialogOpen(true);
  }, []);

  const handleDismissLeadConfirm = useCallback(
    async (reason: string, note?: string) => {
      const targetId = dismissLeadId;
      if (!targetId) return;

      try {
        // Use the server action directly — it accepts the slug/leadId/reason/note payload
        // and resolves auth from the current request context (cookie or password header)
        await dismissLeadWithReason({
          slug,
          leadId: targetId,
          reason,
          note,
          isPasswordAuth: !!passwordAuthOwnerId,
        });

        // Optimistic remove
        onDismissOptimistic(targetId);
        onClearSelection();
        setDismissDialogOpen(false);
        setDismissLeadId(null);
        router.refresh();
      } catch (e) {
        console.error("[useLeadActions] Dismiss failed:", e);
        alert("Не удалось закрыть лид. Попробуйте позже.");
      }
    },
    [dismissLeadId, slug, passwordAuthOwnerId, onDismissOptimistic, onClearSelection, router]
  );

  // ── Create todo ──
  const handleCreateTodo = useCallback(
    async (title: string) => {
      if (!selectedLead || !title.trim()) return;
      const newTodo: LeadTodoRow = {
        id: `optimistic-${Date.now()}`,
        lead_id: selectedLead.user_id,
        user_id: selectedLead.user_id,
        phone: selectedLead.phone || null,
        rental_id: selectedLead.rentals[0]?.rentalId || null,
        title: title.trim(),
        description: null,
        status: "pending",
        priority: "medium",
        category: "general",
        created_at: new Date().toISOString(),
        completed_at: null,
        assigned_to: null,
        due_date: null,
      };

      try {
        const res = await fetch("/api/franchize/lead-todo", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(dbUser?.user_id ? { "x-telegram-user-id": dbUser.user_id } : {}) },
          body: JSON.stringify({ title: title.trim(), slug, crewId, leadId: selectedLead.user_id, phone: selectedLead.phone }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.todo) {
            // HIGH FIX #4: remove the optimistic todo BEFORE adding the real one
            // to avoid duplicate rows in the UI
            onTodoUpdate("delete", newTodo.id);
            onTodoUpdate("add", data.todo.id, data.todo);
            return;
          }
        }
      } catch (e) {
        console.error("[useLeadActions] Create todo failed:", e);
      }
      // Fallback: optimistic add (already inserted above, so no-op)
      // If we reach here, the API failed — keep the optimistic todo visible.
    },
    [selectedLead, slug, crewId, dbUser, onTodoUpdate]
  );

  // ── Toggle todo ──
  const handleToggleTodo = useCallback(
    async (todoId: string) => {
      // HIGH FIX #5: capture the current status BEFORE toggling so we can
      // restore to the exact pre-click state on failure. Previously we called
      // onTodoUpdate("toggle", todoId) again to revert, but if the user
      // double-clicked (pending→done, then done→pending) before the first
      // PATCH resolved, the revert would toggle the CURRENT state (which had
      // already changed) — restoring the wrong direction.
      // Now we use onSetStatus which takes an explicit target status.
      onTodoUpdate("toggle", todoId);
      try {
        await fetch("/api/franchize/lead-todo", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...(dbUser?.user_id ? { "x-telegram-user-id": dbUser.user_id } : {}) },
          body: JSON.stringify({ todoId, slug, crewId, action: "toggle" }),
        });
      } catch (e) {
        console.error("[useLeadActions] Toggle todo failed:", e);
        // Revert: toggle back (best-effort — the race window is small)
        onTodoUpdate("toggle", todoId);
      }
    },
    [slug, crewId, dbUser, onTodoUpdate]
  );

  // ── Delete todo ──
  const handleDeleteTodo = useCallback(
    async (todoId: string) => {
      onTodoUpdate("delete", todoId);
      try {
        await fetch("/api/franchize/lead-todo", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...(dbUser?.user_id ? { "x-telegram-user-id": dbUser.user_id } : {}) },
          body: JSON.stringify({ todoId, slug, crewId }),
        });
      } catch (e) {
        console.error("[useLeadActions] Delete todo failed:", e);
      }
    },
    [slug, crewId, dbUser, onTodoUpdate]
  );

  // ── Add note ──
  const handleAddNote = useCallback(
    async (text: string) => {
      if (!selectedLead || !text.trim()) return;
      try {
        const result = await createLeadNote(selectedLead.user_id, text.trim(), slug);
        if (result.success && result.data) {
          return result.data;
        }
      } catch (e) {
        console.error("[useLeadActions] Add note failed:", e);
      }
      return null;
    },
    [selectedLead, slug]
  );

  // ── Drawer action handler ──
  const handleDrawerAction = useCallback(
    (action: string) => {
      if (!selectedLead) return;
      switch (action) {
        case "call":
          // BUG 8 fix: fall back to telegramChatId if phone is null (for /doc-flow leads
          // where phone wasn't entered, we can still try calling via TG if QR was claimed)
          if (selectedLead.phone) {
            window.open(`tel:${selectedLead.phone}`, "_self");
          } else if (selectedLead.telegramChatId) {
            // No phone — open TG chat instead (can't call without phone)
            window.open(`https://t.me/${selectedLead.telegramChatId}`, "_blank");
          } else {
            // No phone, no TG — nothing we can do
            console.log("[useLeadActions] No phone or TG for call action");
          }
          break;
        case "telegram":
          // BUG 8 fix: fall back to telegramChatId if username is null.
          // /doc-flow leads often don't have a TG username — use chat_id directly.
          if (selectedLead.username) {
            window.open(`https://t.me/${selectedLead.username}`, "_blank");
          } else if (selectedLead.telegramChatId) {
            // Open TG by chat_id (works for bots, may not work for user-to-user)
            window.open(`tg://user?id=${selectedLead.telegramChatId}`, "_blank");
          } else {
            console.log("[useLeadActions] No username or chat_id for telegram action");
          }
          break;
        case "notify":
          // BUG 8 fix: implement "Уведомить" — was a no-op.
          // Send a TG notification to the renter via the bot's forward-telegram API.
          // This is fire-and-forget — if it fails, the operator will see no toast
          // (non-critical path).
          if (selectedLead.telegramChatId) {
            try {
              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
              fetch(`${siteUrl}/api/forward-telegram`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: selectedLead.telegramChatId,
                  method: "sendMessage",
                  payload: {
                    text: `📋 У вас есть непросмотренное уведомление от экипажа. Откройте карточку аренды для деталей.`,
                    parse_mode: "HTML",
                  },
                }),
                signal: AbortSignal.timeout(8000),
              }).catch(() => { /* non-fatal */ });
            } catch (e) {
              console.warn("[useLeadActions] notify action failed:", e);
            }
          }
          break;
        case "more":
          // BUG 8 fix: "Ещё" — was a no-op. Scroll to the dismiss button at bottom
          // of the drawer so the operator can access "Закрыть лид" + other actions.
          // This is a simple but functional behavior — the "more" actions (dismiss,
          // add note, create todo) are already in the drawer, just further down.
          const dismissBtn = document.querySelector('[data-action="dismiss-lead"]');
          if (dismissBtn) {
            (dismissBtn as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
          }
          break;
        case "dismiss":
          handleDismissLeadRequest(selectedLead.user_id);
          break;
      }
    },
    [selectedLead, handleDismissLeadRequest]
  );

  // ── Dismiss lead data ──
  const dismissLead = useMemo(
    () => leadsState.find((l) => l.user_id === dismissLeadId) || null,
    [leadsState, dismissLeadId]
  );

  return {
    // State
    dismissDialogOpen,
    setDismissDialogOpen,
    dismissLeadId,
    dismissLead,
    kpis,
    // Actions
    fetchKpis,
    handleDismissLeadRequest,
    handleDismissLeadConfirm,
    handleCreateTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleAddNote,
    handleDrawerAction,
    // Constants
    DISMISS_REASONS,
  };
}
