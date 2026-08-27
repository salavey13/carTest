"use client";

import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { getRentalReturnTodos, type ReturnTodo } from "../server-actions/rentals";
import { ChevronDown, PackageCheck } from "lucide-react";

interface RentalReturnChecklistProps {
  rentalId: string;
  crewId: string;
  accentColor: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  isAuto: boolean;
}

export function RentalReturnChecklist({
  rentalId,
  crewId,
  accentColor,
  borderColor,
  textPrimary,
  textSecondary,
  isAuto,
}: RentalReturnChecklistProps) {
  const { dbUser } = useAppContext();
  const [todos, setTodos] = useState<ReturnTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRentalReturnTodos(rentalId, crewId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.success && result.data) {
        setTodos(result.data);
      }
    });
    return () => { cancelled = true; };
  }, [rentalId, crewId]);

  // BUG F fix: toggle a closure todo's status (pending ↔ done).
  // Previously the checklist was read-only — operators could see items but
  // couldn't act on them from the dedicated /rental/[id] page. Now each
  // todo has a tap target that flips its status via the lead-todo API
  // (PATCH /api/franchize/lead-todo with action=toggle).
  const handleToggle = async (todoId: string, currentStatus: string) => {
    setTogglingId(todoId);
    const newStatus = currentStatus === "done" ? "pending" : "done";
    try {
      // Optimistic update
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todoId ? { ...t, status: newStatus } : t
        )
      );

      // FIX: the API PATCH endpoint expects { todoId, status, crewId } — NOT
      // { todoId, action: "toggle" }. Was sending the wrong payload shape,
      // which caused the API to return 400 "Missing todoId or status" →
      // the revert logic un-checked the todo immediately.
      // Also added auth headers (x-telegram-user-id) so verifyCrewAccess passes.
      // dbUser is already available from useAppContext() at the top of the component
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (dbUser?.user_id) {
        headers["x-telegram-user-id"] = dbUser.user_id;
      }

      const res = await fetch("/api/franchize/lead-todo", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          todoId,
          status: newStatus,
          crewId,
        }),
      });

      if (!res.ok) {
        // Revert optimistic update on failure
        setTodos((prev) =>
          prev.map((t) =>
            t.id === todoId ? { ...t, status: currentStatus } : t
          )
        );
        console.error("[RentalReturnChecklist] Toggle failed:", await res.text());
      }
    } catch (e) {
      // Revert + log
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todoId ? { ...t, status: currentStatus } : t
        )
      );
      console.error("[RentalReturnChecklist] Toggle error:", e);
    } finally {
      setTogglingId(null);
    }
  };

  // Fallback: default return items shown when no DB todos exist yet
  const defaultItems = [
    "ТС в том же состоянии",
    "Ключи от байка",
    "Шлем (если брали)",
    "Допы: перчатки, куртка, зарядка",
    "Паспорт/СТС, если в залог",
    "Одометр: записать показания при возврате",
    "Фото ТС после поездки",
    "Полный бак / заряд",
  ];

  const displayTodos = todos.length > 0 ? todos : null;

  return (
    <details className="group rounded-xl border" style={{ borderColor }}>
      <summary
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium list-none"
        style={{ color: textPrimary }}
      >
        <PackageCheck className="h-4 w-4 shrink-0" />
        Что вернуть
        {displayTodos && (() => {
          const done = displayTodos.filter(t => t.status === "done").length;
          const total = displayTodos.length;
          const allDone = done === total;
          return (
            <span
              className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: allDone ? "#22c55e20" : `${accentColor}20`,
                color: allDone ? "#22c55e" : accentColor,
              }}
            >
              {allDone ? "✓ Готово!" : `${done}/${total}`}
            </span>
          );
        })()}
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-3 text-xs space-y-2" style={{ borderColor, color: textPrimary }}>
        {loading ? (
          <p className="text-center" style={{ color: textSecondary }}>Загрузка чек-листа...</p>
        ) : displayTodos ? (
          <ul className="space-y-1.5">
            {displayTodos.map((todo) => {
              const isDone = todo.status === "done";
              const isToggling = togglingId === todo.id;
              return (
                <li key={todo.id} className="flex gap-2 items-start">
                  {/* BUG F fix: tap-to-toggle button (was static span) */}
                  <button
                    type="button"
                    onClick={() => handleToggle(todo.id, todo.status)}
                    disabled={isToggling}
                    aria-label={isDone ? "Отметить как невыполненное" : "Отметить как выполненное"}
                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold transition-colors hover:scale-110 disabled:opacity-50"
                    style={{
                      backgroundColor: isDone
                        ? "color-mix(in srgb, var(--franchize-accent-main, #22c55e) 20%, transparent)"
                        : "color-mix(in srgb, var(--franchize-text-secondary, #aaa) 12%, transparent)",
                      color: isDone ? "var(--franchize-accent-main, #22c55e)" : textSecondary,
                      cursor: isToggling ? "wait" : "pointer",
                    }}
                  >
                    {isToggling ? "…" : isDone ? "✓" : "○"}
                  </button>
                  <span style={{ textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.6 : 1 }}>
                    {todo.title.replace(/^[^\s]+\s/, "")}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-1.5">
            {defaultItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span style={{ color: accentColor }}>✓</span> {item}
              </li>
            ))}
          </ul>
        )}
        {!loading && displayTodos && (() => {
          const done = displayTodos.filter(t => t.status === "done").length;
          const total = displayTodos.length;
          if (done === total) {
            return (
              <p className="mt-3 font-semibold" style={{ color: "#22c55e" }}>
                ✓ Все задачи закрыты — возврат оформлен идеально!
              </p>
            );
          }
          return (
            <p className="mt-3" style={{ color: textSecondary }}>
              Нажмите на кружок, чтобы отметить пункт выполненным. Прогресс: {done}/{total}.
            </p>
          );
        })()}
        {!loading && !displayTodos && (
          <p className="mt-3" style={{ color: textSecondary }}>
            При возврате оператор проверит комплектацию и состояние. Депозит вернём после акта.
          </p>
        )}
      </div>
    </details>
  );
}
