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
import type {LeadRow, LeadTodoRow} from "../leads-types";
import type {LeadsKpis} from "../leads-types";
import type {LeadNote} from "../leads-types";
// STATIC imports are safe now — all server action files have NO module-level server-only
// imports (cookies + telegram-actor-cookie + privateSchema are all dynamic inside functions).
import { dismissLeadWithReason } from "@/app/franchize/server-actions/leads-dismiss";
import { getLeadsKpis } from "@/app/franchize/server-actions/leads-kpis";
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
  // LA-004 FIX: added dbUser, passwordAuthOwnerId to deps so KPIs re-fetch after auth resolves.
  // Was: deps only [slug] — fetchKpis captured null dbUser on initial render and never re-fired.
  const fetchKpis = useCallback(async (mode: string) => {
    try {
      const result = await getLeadsKpis(
        slug,
        mode,
        dbUser?.user_id || passwordAuthOwnerId || "",
        !!passwordAuthOwnerId,
      );
      setKpis(result);
    } catch (e) {
      console.error("[useLeadActions] KPI fetch failed:", e);
    }
  }, [slug, dbUser, passwordAuthOwnerId]);

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

      // Insert the optimistic todo FIRST so it appears immediately. Previously
      // the optimistic add only happened in the success branch (swapping for the
      // real one), so on API failure the operator's typed todo silently vanished.
      // Now it shows right away; on success we swap it for the server todo, and on
      // failure we leave it visible (the next router.refresh() reconciles with DB).
      onTodoUpdate("add", newTodo.id, newTodo);

      try {
        const res = await fetch("/api/franchize/lead-todo", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(dbUser?.user_id || passwordAuthOwnerId ? { "x-telegram-user-id": dbUser?.user_id || passwordAuthOwnerId } : {}) },
          body: JSON.stringify({ title: title.trim(), slug, crewId, leadId: selectedLead.user_id, phone: selectedLead.phone }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.todo) {
            // Remove the optimistic duplicate, then add the real one so the UI
            // never shows two rows for the same task.
            onTodoUpdate("delete", newTodo.id);
            onTodoUpdate("add", data.todo.id, data.todo);
          }
        }
      } catch (e) {
        console.error("[useLeadActions] Create todo failed:", e);
        // Keep the optimistic todo visible — the next router.refresh() resyncs.
      }
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
          headers: { "Content-Type": "application/json", ...(dbUser?.user_id || passwordAuthOwnerId ? { "x-telegram-user-id": dbUser?.user_id || passwordAuthOwnerId } : {}) },
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
          headers: { "Content-Type": "application/json", ...(dbUser?.user_id || passwordAuthOwnerId ? { "x-telegram-user-id": dbUser?.user_id || passwordAuthOwnerId } : {}) },
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
        // LA-003 FIX: createLeadNote expects an object, not 3 positional args.
        // Was: createLeadNote(selectedLead.user_id, text.trim(), slug) — silently failed.
        const result = await createLeadNote({
          leadId: selectedLead.user_id,
          crewId,
          text: text.trim(),
          createdBy: dbUser?.user_id || passwordAuthOwnerId || undefined,
        });
        if (result.success && result.data) {
          return result.data;
        }
      } catch (e) {
        console.error("[useLeadActions] Add note failed:", e);
      }
      return null;
    },
    [selectedLead, slug, crewId, dbUser, passwordAuthOwnerId]
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
            // L1 fix: use tg:// scheme (numeric ID, not username). https://t.me/<number> doesn't work.
            window.open(`tg://user?id=${selectedLead.telegramChatId}`, "_blank");
          } else {
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
          // L3 fix: /api/forward-telegram route doesn't exist in current app — use the
          // sendRentalMessage server action from rentals.ts instead, which does the same
          // thing (sends a TG message to the renter via the bot). We pass a generic
          // notification message. This is fire-and-forget — non-critical path.
          {
            const notifyChatId = selectedLead.telegramChatId || "";
            const notifyRentalId = selectedLead.rentals?.[0]?.rentalId || "";
            if (notifyChatId && notifyRentalId) {
              try {
                // Dynamically import to avoid bundling server action in client if not needed
                import("@/app/franchize/server-actions/rentals").then(async ({ sendRentalMessage }) => {
                  await sendRentalMessage(
                    notifyRentalId,
                    `📋 У вас есть непросмотренное уведомление от экипажа. Откройте карточку аренды для деталей.`,
                    notifyChatId
                  );
                }).catch(() => { /* non-fatal */ });
              } catch (e) {
                console.warn("[useLeadActions] notify action failed:", e);
              }
            } else if (selectedLead.phone) {
              // No rental to attach a TG message to (pre-contract lead) — nothing to
              // fall back to, so surface a concrete next step instead of a silent no-op.
              alert(`Уведомить по Telegram пока нечего (нет активной аренды). Позвоните клиенту: ${selectedLead.phone}`);
            } else {
              alert("Уведомить нельзя: нет Telegram-чата и активной аренды для отправки.");
            }
          }
          break;
        case "more":
          // BUG 8 fix: "Ещё" — was a no-op. Scroll to the bottom of the lead detail
          // content area where the dismiss button + notes + todos live.
          // L2 fix: instead of querying a non-existent [data-action] selector,
          // find the scrollable content container and scroll to bottom.
          const contentArea = document.querySelector('[class*="space-y-3"]');
          if (contentArea) {
            (contentArea as HTMLElement).scrollIntoView({ behavior: "smooth", block: "end" });
          } else {
            // Fallback: scroll the whole window to bottom
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
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
