"use client";

import { useEffect, useState } from "react";
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
  const [todos, setTodos] = useState<ReturnTodo[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Fallback: default return items shown when no DB todos exist yet
  const defaultItems = [
    "ТС в том же состоянии",
    "Ключи от байка",
    "Шлем (если брали)",
    "Допы: перчатки, куртка, зарядка",
    "Паспорт/СТС, если в залог",
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
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-3 text-xs space-y-2" style={{ borderColor, color: textPrimary }}>
        {loading ? (
          <p className="text-center" style={{ color: textSecondary }}>Загрузка чек-листа...</p>
        ) : displayTodos ? (
          <ul className="space-y-1.5">
            {displayTodos.map((todo) => {
              const isDone = todo.status === "done";
              return (
                <li key={todo.id} className="flex gap-2 items-start">
                  <span
                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: isDone
                        ? "color-mix(in srgb, var(--franchize-accent-main, #22c55e) 20%, transparent)"
                        : "color-mix(in srgb, var(--franchize-text-secondary, #aaa) 12%, transparent)",
                      color: isDone ? "var(--franchize-accent-main, #22c55e)" : textSecondary,
                    }}
                  >
                    {isDone ? "✓" : "○"}
                  </span>
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
        {!loading && displayTodos && (
          <p className="mt-3" style={{ color: textSecondary }}>
            Отмеченные пункты выполнены. При возврате оператор проверит комплектацию и состояние.
          </p>
        )}
        {!loading && !displayTodos && (
          <p className="mt-3" style={{ color: textSecondary }}>
            При возврате оператор проверит комплектацию и состояние. Депозит вернём после акта.
          </p>
        )}
      </div>
    </details>
  );
}
