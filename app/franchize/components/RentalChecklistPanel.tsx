"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, CircleDot, Camera, Key, FileText, Gauge, AlertTriangle, Package, ChevronDown, ChevronRight } from "lucide-react";

interface TodoItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  description?: string;
}

interface RentalChecklistPanelProps {
  rentalId: string;
  crewId: string;
  slug: string;
  accentColor: string;
  metadata?: Record<string, any>;
  status: string;
}

/**
 * Interactive rental checklist panel.
 * Shows equipment return items, self-check reminders, and rental details.
 * Pulls todos from crew_todos linked via description JSON.
 */
export function RentalChecklistPanel({
  rentalId,
  crewId,
  slug,
  accentColor,
  metadata,
  status,
}: RentalChecklistPanelProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Extract rental info from metadata
  const odometerBefore = metadata?.pickup_freeze?.odometer_km || metadata?.odometer_before;
  const paymentCash = metadata?.payment_cash || metadata?.cashAmount;
  const paymentBank = metadata?.payment_bank || metadata?.bankAmount;
  const totalCost = metadata?.total_cost || metadata?.daily_price;
  const equipment = metadata?.equipment || {};
  const contractSha = metadata?.doc_sha256 || metadata?.contract_sha;

  const fetchTodos = useCallback(async () => {
    try {
      const resp = await fetch("/api/franchize/lead-todo", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) return;
      // The API might not support GET for rental-specific todos
      // We'll use a different approach: fetch all crew todos and filter
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // For now, build checklist from metadata + standard items
    // In future, fetch from crew_todos API
    const standardChecks = buildStandardChecks(status, equipment, odometerBefore);
    setTodos(standardChecks);
    setLoading(false);
  }, [status, equipment, odometerBefore]);

  const handleToggle = async (todoId: string) => {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    const newStatus = todo.status === "done" ? "pending" : "done";
    setTodos(todos.map((t) => (t.id === todoId ? { ...t, status: newStatus } : t)));
  };

  const completedCount = todos.filter((t) => t.status === "done").length;
  const progress = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  if (loading) {
    return (
      <div className="rounded-2xl border p-4 animate-pulse" style={{ borderColor: `${accentColor}20` }}>
        <p className="text-sm opacity-50">Загрузка чек-листа...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${accentColor}20` }}>
      {/* Header with progress */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 transition hover:opacity-80"
        style={{ backgroundColor: `${accentColor}08` }}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 opacity-50" /> : <ChevronRight className="h-4 w-4 opacity-50" />}
          <span className="text-sm font-semibold">📋 Чек-лист аренды</span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            {completedCount}/{todos.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ backgroundColor: `${accentColor}15` }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "#22c55e" : accentColor }}
            />
          </div>
          <span className="text-[10px] opacity-50">{progress}%</span>
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-1">
          {/* Quick info grid */}
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            {odometerBefore != null && (
              <div className="rounded-lg border p-2" style={{ borderColor: `${accentColor}15` }}>
                <span className="flex items-center gap-1 opacity-60"><Gauge className="h-3 w-3" /> Одометр (до)</span>
                <p className="font-bold mt-0.5">{odometerBefore} км</p>
              </div>
            )}
            {totalCost != null && (
              <div className="rounded-lg border p-2" style={{ borderColor: `${accentColor}15` }}>
                <span className="opacity-60">💰 Стоимость</span>
                <p className="font-bold mt-0.5">{Number(totalCost).toLocaleString("ru-RU")} ₽</p>
                {paymentCash != null && paymentBank != null && (paymentCash > 0 || paymentBank > 0) && (
                  <p className="text-[10px] opacity-50 mt-0.5">
                    💵 {Number(paymentCash || 0).toLocaleString("ru-RU")} ₽ / 💳 {Number(paymentBank || 0).toLocaleString("ru-RU")} ₽
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Equipment summary */}
          {Object.keys(equipment).length > 0 && (
            <div className="mb-3 rounded-lg border p-2" style={{ borderColor: `${accentColor}15` }}>
              <span className="flex items-center gap-1 text-xs opacity-60"><Package className="h-3 w-3" /> Оборудование</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {equipment.helmets > 0 && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${accentColor}15` }}>🪖 ×{equipment.helmets}</span>}
                {equipment.gloves > 0 && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${accentColor}15` }}>🧤 ×{equipment.gloves}</span>}
                {equipment.net && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${accentColor}15` }}>🌐 Сетка</span>}
                {equipment.backpack && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${accentColor}15` }}>🎒 Рюкзак</span>}
                {equipment.bag && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${accentColor}15` }}>👜 Сумка</span>}
                {equipment.charger && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${accentColor}15` }}>🔌 Зарядка</span>}
              </div>
            </div>
          )}

          {/* Checklist items */}
          {todos.map((todo) => {
            const icon = getTodoIcon(todo.id);
            return (
              <div
                key={todo.id}
                className="flex items-center gap-2 rounded-lg border px-2 py-1.5 transition cursor-pointer hover:opacity-80"
                style={{
                  borderColor: `${accentColor}10`,
                  opacity: todo.status === "done" ? 0.5 : 1,
                }}
                onClick={() => handleToggle(todo.id)}
              >
                <button className="shrink-0" type="button">
                  {todo.status === "done"
                    ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                    : <CircleDot className="h-4 w-4 opacity-40" />}
                </button>
                {icon && <span className="shrink-0 opacity-60">{icon}</span>}
                <span className={`flex-1 text-xs ${todo.status === "done" ? "line-through" : ""}`}>
                  {todo.title}
                </span>
                {todo.priority === "high" && todo.status !== "done" && (
                  <span className="rounded bg-red-500/20 px-1 text-[9px] text-red-400">!</span>
                )}
              </div>
            );
          })}

          {todos.length === 0 && (
            <p className="py-4 text-center text-xs opacity-40">Нет задач для этой аренды</p>
          )}

          {/* Contract info */}
          {contractSha && (
            <div className="mt-3 border-t pt-2" style={{ borderColor: `${accentColor}10` }}>
              <p className="text-[10px] opacity-40 break-all">
                🔐 {contractSha.slice(0, 16)}...{contractSha.slice(-8)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Build standard checklist items based on rental status and equipment */
function buildStandardChecks(
  status: string,
  equipment: Record<string, any>,
  odometerBefore?: number,
): TodoItem[] {
  const items: TodoItem[] = [];
  const isActive = status === "active";
  const isCompleted = status === "completed";

  // Photo documentation
  items.push({
    id: "photo_before",
    title: "📸 Сфотографировать байк до поездки (8 ракурсов)",
    status: isCompleted ? "done" : "pending",
    priority: "high",
  });

  // Equipment checks
  if (equipment.helmets > 0) {
    items.push({
      id: "return_helmets",
      title: `🪖 Вернуть ${equipment.helmets} шлем(а/ов)`,
      status: isCompleted ? "done" : "pending",
      priority: "medium",
    });
  }
  if (equipment.gloves > 0) {
    items.push({
      id: "return_gloves",
      title: `🧤 Вернуть ${equipment.gloves} перчатки`,
      status: isCompleted ? "done" : "pending",
      priority: "low",
    });
  }
  if (equipment.charger) {
    items.push({
      id: "return_charger",
      title: "🔌 Вернуть зарядное устройство",
      status: isCompleted ? "done" : "pending",
      priority: "medium",
    });
  }
  if (equipment.net) {
    items.push({
      id: "return_net",
      title: "🌐 Вернуть сетку",
      status: isCompleted ? "done" : "pending",
      priority: "low",
    });
  }
  if (equipment.backpack) {
    items.push({
      id: "return_backpack",
      title: "🎒 Вернуть рюкзак",
      status: isCompleted ? "done" : "pending",
      priority: "low",
    });
  }
  if (equipment.bag) {
    items.push({
      id: "return_bag",
      title: "👜 Вернуть сумку",
      status: isCompleted ? "done" : "pending",
      priority: "low",
    });
  }

  // Keys and docs
  items.push({
    id: "return_keys",
    title: "🔑 Вернуть ключи от байка",
    status: isCompleted ? "done" : "pending",
    priority: "high",
  });

  // Odometer and damage check
  if (odometerBefore != null) {
    items.push({
      id: "check_odometer",
      title: `📊 Записать одометр при возврате (было: ${odometerBefore} км)`,
      status: isCompleted ? "done" : "pending",
      priority: "medium",
    });
  }

  items.push({
    id: "check_damage",
    title: "🔍 Осмотреть байк на повреждения при возврате",
    status: isCompleted ? "done" : "pending",
    priority: "high",
  });

  // Photo after
  items.push({
    id: "photo_after",
    title: "📸 Сфотографировать байк после поездки",
    status: isCompleted ? "done" : "pending",
    priority: "high",
  });

  // Fuel/charge check
  items.push({
    id: "check_fuel",
    title: "⚡ Проверить уровень заряда/топлива при возврате",
    status: isCompleted ? "done" : "pending",
    priority: "medium",
  });

  return items;
}

function getTodoIcon(id: string): React.ReactNode {
  switch (id) {
    case "photo_before":
    case "photo_after":
      return <Camera className="h-3.5 w-3.5" />;
    case "return_keys":
      return <Key className="h-3.5 w-3.5" />;
    case "check_damage":
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case "check_odometer":
      return <Gauge className="h-3.5 w-3.5" />;
    default:
      if (id.startsWith("return_")) return <Package className="h-3.5 w-3.5" />;
      return null;
  }
}
