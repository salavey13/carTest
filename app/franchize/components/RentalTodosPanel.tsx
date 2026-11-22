"use client";

import { useEffect, useMemo, useState } from "react";
import { ListTodo, ChevronDown } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import type { ReturnTodo } from "../server-actions/rentals";

/**
 * RentalTodosPanel
 * ──────────────────────────────────────────────────────────────────────────
 * 2026-09-28 — owner report: «dynamic todos are present in rental analytics,
 * but in rental page itself it shows static todos only».
 *
 * This panel renders the SAME dynamic crew_todos the analytics drawer shows
 * (filtered by rental_id server-side, see getRentalPageTodos): the 5
 * verification rows («Верифицировать паспорт…», «Подтвердить начальный
 * одометр», …) + the equipment-aware return checklist + any crew follow-ups.
 * No static fallback — when nothing is linked to the rental the panel simply
 * says so (crew) / hides (renter).
 *
 * Roles:
 *   - crew (operator/admin/owner/subrenter): tap a row to toggle
 *     pending ↔ done (PATCH /api/franchize/lead-todo — the same endpoint the
 *     analytics drawer and the old checklist use, optimistic update + revert).
 *   - renter: read-only transparency — he sees the crew's progress on his
 *     deal but cannot flip crew tasks (the API enforces crew auth anyway).
 */

const CATEGORY_LABELS: Record<string, string> = {
  rental_verification: "Проверки",
  lead_followup: "Чек-лист аренды",
};

const CATEGORY_ORDER = ["rental_verification", "lead_followup"];

export function RentalTodosPanel({
  rentalId,
  crewId,
  crewSlug,
  ownerId,
  renterId,
  renterTelegramChatId,
  subrenterChatId,
  initialTodos,
  accentColor,
  borderColor,
  textPrimary,
  textSecondary,
}: {
  rentalId: string;
  crewId: string;
  crewSlug?: string;
  ownerId?: string | null;
  renterId?: string | null;
  renterTelegramChatId?: string | null;
  subrenterChatId?: string | null;
  initialTodos: ReturnTodo[];
  accentColor: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}) {
  const { dbUser, userCrewMemberships } = useAppContext();
  const [todos, setTodos] = useState<ReturnTodo[]>(initialTodos);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Role resolution — the same identities FranchizeRentalRoleGuard uses:
  // crew = owner of the rental OR an active crew membership (by crewId OR
  // slug — the UUID can drift, the slug is reliable); subrenter = the bike's
  // partner-owner (he runs handovers for his own bikes, same as the old
  // checklist allowed). Everyone else — the renter included — is read-only;
  // the lead-todo API enforces crew auth server-side anyway.
  const canToggle = useMemo(() => {
    const uid = dbUser?.user_id;
    if (!uid) return false;
    if (ownerId && uid === ownerId) return true;
    if (subrenterChatId && uid === subrenterChatId) return true;
    const membership = userCrewMemberships.find((m) => m.crewId === crewId)
      || (crewSlug ? userCrewMemberships.find((m) => m.slug === crewSlug) : undefined);
    return Boolean(membership && ["owner", "admin", "co_owner", "member"].includes(membership.role));
  }, [dbUser?.user_id, ownerId, subrenterChatId, userCrewMemberships, crewId, crewSlug]);

  // Keep in sync when the server payload refreshes (router.refresh()).
  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  const done = todos.filter((t) => t.status === "done").length;
  const total = todos.length;
  const allDone = total > 0 && done === total;

  const grouped = useMemo(() => {
    const groups = new Map<string, ReturnTodo[]>();
    for (const t of todos) {
      const key = CATEGORY_ORDER.includes(t.category) ? t.category : "other";
      const arr = groups.get(key) || [];
      arr.push(t);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort(
      ([a], [b]) =>
        (CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a)) -
        (CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b)),
    );
  }, [todos]);

  const handleToggle = async (todoId: string, currentStatus: string) => {
    if (!canToggle) return;
    const newStatus = currentStatus === "done" ? "pending" : "done";
    setTogglingId(todoId);
    // Optimistic flip
    setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: newStatus } : t)));
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (dbUser?.user_id) headers["x-telegram-user-id"] = dbUser.user_id;
      const res = await fetch("/api/franchize/lead-todo", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ todoId, status: newStatus, crewId }),
      });
      if (!res.ok) {
        setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: currentStatus } : t)));
        console.error("[RentalTodosPanel] Toggle failed:", await res.text());
      }
    } catch (e) {
      setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: currentStatus } : t)));
      console.error("[RentalTodosPanel] Toggle error:", e);
    } finally {
      setTogglingId(null);
    }
  };

  if (total === 0 && !canToggle) return null;

  return (
    <details
      className="group rounded-xl border"
      style={{ borderColor }}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium"
        style={{ color: textPrimary }}
      >
        <ListTodo className="h-4 w-4 shrink-0" />
        Задачи по аренде
        {total > 0 && (
          <span
            className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              backgroundColor: allDone ? "#22c55e20" : `${accentColor}20`,
              color: allDone ? "#22c55e" : accentColor,
            }}
          >
            {allDone ? "✓ Готово!" : `${done}/${total}`}
          </span>
        )}
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t px-4 py-3 text-xs" style={{ borderColor, color: textPrimary }}>
        {total === 0 ? (
          <p className="text-center" style={{ color: textSecondary }}>
            Задач по этой аренде пока нет.
          </p>
        ) : (
          grouped.map(([category, items]) => (
            <div key={category}>
              {grouped.length > 1 && (
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-60" style={{ color: textSecondary }}>
                  {CATEGORY_LABELS[category] || "Прочее"}
                </p>
              )}
              <ul className="space-y-1.5">
                {items.map((todo) => {
                  const isDone = todo.status === "done";
                  const isToggling = togglingId === todo.id;
                  const tap = canToggle && !isToggling;
                  return (
                    <li key={todo.id} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => tap && handleToggle(todo.id, todo.status)}
                        disabled={!canToggle || isToggling}
                        aria-label={
                          !canToggle
                            ? undefined
                            : isDone
                              ? "Отметить как невыполненное"
                              : "Отметить как выполненное"
                        }
                        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: isDone
                            ? "color-mix(in srgb, var(--franchize-accent-main, #22c55e) 20%, transparent)"
                            : "color-mix(in srgb, var(--franchize-text-secondary, #aaa) 12%, transparent)",
                          color: isDone ? "var(--franchize-accent-main, #22c55e)" : textSecondary,
                          cursor: canToggle ? (isToggling ? "wait" : "pointer") : "default",
                        }}
                      >
                        {isToggling ? "…" : isDone ? "✓" : "○"}
                      </button>
                      <span style={{ textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.6 : 1 }}>
                        {todo.title}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {total > 0 && (
          <p style={{ color: textSecondary }}>
            {allDone
              ? "✓ Все задачи закрыты."
              : canToggle
                ? "Нажмите на кружок, чтобы отметить пункт выполненным."
                : "Оператор отметит выполнение по мере подготовки аренды."}
          </p>
        )}
      </div>
    </details>
  );
}
