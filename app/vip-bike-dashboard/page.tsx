"use client";

import { useEffect, useState } from "react";
import { format, subDays, addDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";

// Palette constants matching web app
const PALETTE = {
  bg: "#121520",
  card: "#1B2132",
  border: "#313648",
  accent: "#F4BD55", // Gold
  accentHover: "#D4A540",
  success: "#44CC77", // Green
  error: "#E35B5B", // Red
  textPrimary: "#E6D8C4",
  textSecondary: "#A7ABB4",
  textMuted: "#7D828C",
};

interface DashboardData {
  date: string;
  displayDate: string;
  todayTotal: number;
  rentalTotal: number;
  rentalCount: number;
  salesTotal: number;
  salesCount: number;
  depositsTotal: number;
  reminders: Array<{
    id: string;
    bikeName: string;
    renterName: string;
    endDate: string;
    overdueText: string;
  }>;
  rentalsList: Array<{
    id: string;
    bikeName: string;
    renterName: string;
    dateRange: string;
    totalSum: number;
    createdAt: string;
    status: string;
  }>;
  salesList: Array<{
    id: string;
    bikeName: string;
    buyerName: string;
    warranty: string;
    salePrice: number;
    createdAt: string;
  }>;
  weeklyData: Array<{
    date: string;
    rentals: number;
    sales: number;
  }>;
  timestamp: string;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
}

interface ChecklistItem {
  id: number;
  text: string;
  checked: boolean;
}

interface ChecklistState {
  type: "handout" | "return";
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  percentage?: number;
}

function formatPrice(num: number): string {
  return num.toLocaleString("ru-RU");
}

export default function VipBikeDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const [checklistType, setChecklistType] = useState<"handout" | "return">("handout");
  const [checklist, setChecklist] = useState<ChecklistState | null>(null);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const res = await fetch(`/api/vip-bike-dashboard?date=${dateStr}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [currentDate]);

  // Fetch todos
  useEffect(() => {
    const fetchTodos = async () => {
      try {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const res = await fetch(`/api/vip-bike-todos?date=${dateStr}`);
        if (res.ok) {
          const json = await res.json();
          setTodos(json.todos || []);
        }
      } catch (err) {
        console.error("Failed to fetch todos:", err);
      }
    };

    fetchTodos();
  }, [currentDate]);

  // Fetch checklist
  useEffect(() => {
    const fetchChecklist = async () => {
      try {
        const res = await fetch(`/api/vip-bike-checklists?type=${checklistType}`);
        if (res.ok) {
          const json = await res.json();
          setChecklist(json);
        }
      } catch (err) {
        console.error("Failed to fetch checklist:", err);
      }
    };

    fetchChecklist();
  }, [checklistType]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    try {
      const res = await fetch("/api/vip-bike-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newTodoText, date: format(currentDate, "yyyy-MM-dd") }),
      });

      if (res.ok) {
        const json = await res.json();
        setTodos((prev) => [{ ...json.todo, completed: false }, ...prev]);
        setNewTodoText("");
      } else if (res.status === 409) {
        alert("Такой TODO уже существует");
      }
    } catch (err) {
      console.error("Failed to add todo:", err);
    }
  };

  const handleToggleTodo = async (id: string, completed: boolean) => {
    try {
      await fetch("/api/vip-bike-todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completed: !completed }),
      });
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)));
    } catch (err) {
      console.error("Failed to toggle todo:", err);
    }
  };

  const handleChecklistItem = async (itemId: number, checked: boolean) => {
    try {
      const res = await fetch("/api/vip-bike-checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: checklistType, itemId, checked }),
      });

      if (res.ok) {
        const json = await res.json();
        setChecklist(json);
      }
    } catch (err) {
      console.error("Failed to update checklist:", err);
    }
  };

  const goToToday = () => setCurrentDate(new Date());
  const prevDay = () => setCurrentDate((d) => subDays(d, 1));
  const nextDay = () => setCurrentDate((d) => addDays(d, 1));

  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: PALETTE.bg, color: PALETTE.textPrimary }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold" style={{ color: PALETTE.accent }}>
            VIP BIKE DASHBOARD
          </h1>
          <div className="text-xs" style={{ color: PALETTE.textMuted }}>
            Обновлено: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString("ru-RU") : "..."}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Date picker, Summary, Reminders */}
        <div className="space-y-4 lg:col-span-1">
          {/* Date picker */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevDay} className="text-sm hover:opacity-70">
                ← Previous day
              </button>
              <button onClick={goToToday} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: PALETTE.border }}>
                Сегодня
              </button>
              <button onClick={nextDay} className="text-sm hover:opacity-70">
                Next day →
              </button>
            </div>
            <input
              type="date"
              value={format(currentDate, "yyyy-MM-dd")}
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
              className="w-full p-2 rounded text-sm"
              style={{ backgroundColor: PALETTE.bg, border: `1px solid ${PALETTE.border}`, color: PALETTE.textPrimary }}
            />
            <div className="text-center mt-2 text-lg font-bold" style={{ color: PALETTE.accent }}>
              {format(currentDate, "dd.MM.yyyy")}
            </div>
          </div>

          {/* Summary */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
          >
            <h2 className="text-sm font-semibold mb-3 uppercase" style={{ color: PALETTE.textSecondary }}>
              Итого за {data?.displayDate || "..."}
            </h2>
            <div className="text-3xl font-bold mb-4" style={{ color: PALETTE.accent }}>
              {loading ? "..." : formatPrice(data?.todayTotal || 0)} ₽
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: PALETTE.textSecondary }}>Аренды</span>
                <div className="text-right">
                  <div style={{ color: PALETTE.textPrimary }}>{formatPrice(data?.rentalTotal || 0)} ₽</div>
                  <div className="text-xs" style={{ color: PALETTE.textMuted }}>{data?.rentalCount || 0} шт.</div>
                </div>
              </div>
              <div className="flex justify-between">
                <span style={{ color: PALETTE.textSecondary }}>Продажи</span>
                <div className="text-right">
                  <div style={{ color: PALETTE.textPrimary }}>{formatPrice(data?.salesTotal || 0)} ₽</div>
                  <div className="text-xs" style={{ color: PALETTE.textMuted }}>{data?.salesCount || 0} шт.</div>
                </div>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${PALETTE.border}` }}>
                <span style={{ color: PALETTE.textSecondary }}>Депозиты на руках</span>
                <span style={{ color: PALETTE.textPrimary }}>{formatPrice(data?.depositsTotal || 0)} ₽</span>
              </div>
            </div>
          </div>

          {/* Reminders */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
          >
            <h2 className="text-sm font-semibold mb-3 uppercase" style={{ color: PALETTE.error }}>
              Напоминалки
            </h2>
            {data?.reminders && data.reminders.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs" style={{ color: PALETTE.textMuted }}>
                  {data.reminders.length} активных аренд
                </div>
                {data.reminders.slice(0, 5).map((reminder) => (
                  <div
                    key={reminder.id}
                    className="p-2 rounded text-xs"
                    style={{ backgroundColor: "rgba(227, 91, 91, 0.1)", border: "1px solid rgba(227, 91, 91, 0.3)" }}
                  >
                    <div className="font-semibold" style={{ color: PALETTE.textPrimary }}>
                      {reminder.bikeName}
                    </div>
                    <div className="text-[10px]" style={{ color: PALETTE.textMuted }}>
                      {reminder.renterName}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span style={{ color: PALETTE.textSecondary }}>{reminder.endDate}</span>
                      <span style={{ color: PALETTE.error }}>{reminder.overdueText}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs" style={{ color: PALETTE.textMuted }}>
                Нет активных аренд
              </div>
            )}
          </div>
        </div>

        {/* Middle column: Rentals & Sales lists */}
        <div className="space-y-4 lg:col-span-1">
          {/* Rentals */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
          >
            <h2 className="text-sm font-semibold mb-3 uppercase flex justify-between">
              <span style={{ color: PALETTE.textSecondary }}>Аренды за день</span>
              <span style={{ color: PALETTE.accent }}>{data?.rentalsList?.length || 0}</span>
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {data?.rentalsList?.map((rental) => (
                <div
                  key={rental.id}
                  className="p-2 rounded text-xs"
                  style={{ backgroundColor: PALETTE.bg, border: `1px solid ${PALETTE.border}` }}
                >
                  <div className="font-semibold" style={{ color: PALETTE.textPrimary }}>
                    {rental.bikeName}
                  </div>
                  <div className="text-[10px]" style={{ color: PALETTE.textMuted }}>
                    {rental.renterName}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span style={{ color: PALETTE.textSecondary }}>{rental.dateRange}</span>
                    <span style={{ color: PALETTE.textPrimary }}>{formatPrice(rental.totalSum)} ₽</span>
                  </div>
                  <div className="text-[10px]" style={{ color: PALETTE.textMuted }}>
                    {rental.createdAt}
                  </div>
                </div>
              ))}
              {(!data?.rentalsList || data.rentalsList.length === 0) && (
                <div className="text-xs text-center py-4" style={{ color: PALETTE.textMuted }}>
                  Нет аренд за этот день
                </div>
              )}
            </div>
          </div>

          {/* Sales */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
          >
            <h2 className="text-sm font-semibold mb-3 uppercase flex justify-between">
              <span style={{ color: PALETTE.textSecondary }}>Продажи за день</span>
              <span style={{ color: PALETTE.accent }}>{data?.salesList?.length || 0}</span>
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {data?.salesList?.map((sale) => (
                <div
                  key={sale.id}
                  className="p-2 rounded text-xs"
                  style={{ backgroundColor: PALETTE.bg, border: `1px solid ${PALETTE.border}` }}
                >
                  <div className="font-semibold" style={{ color: PALETTE.textPrimary }}>
                    {sale.bikeName}
                  </div>
                  <div className="text-[10px]" style={{ color: PALETTE.textMuted }}>
                    {sale.buyerName}
                  </div>
                  {sale.warranty && (
                    <div className="text-[10px]" style={{ color: PALETTE.success }}>
                      {sale.warranty}
                    </div>
                  )}
                  <div className="flex justify-between mt-1">
                    <span style={{ color: PALETTE.accent }}>{formatPrice(sale.salePrice)} ₽</span>
                    <span style={{ color: PALETTE.textMuted }}>{sale.createdAt}</span>
                  </div>
                </div>
              ))}
              {(!data?.salesList || data.salesList.length === 0) && (
                <div className="text-xs text-center py-4" style={{ color: PALETTE.textMuted }}>
                  Нет продаж за этот день
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Weekly chart, Diary, Checklist */}
        <div className="space-y-4 lg:col-span-1">
          {/* Weekly chart */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
          >
            <h2 className="text-sm font-semibold mb-3 uppercase" style={{ color: PALETTE.textSecondary }}>
              Выручка за неделю
            </h2>
            <div className="space-y-2">
              {data?.weeklyData?.map((day) => (
                <div key={day.date} className="flex items-center gap-2">
                  <div className="text-xs w-16" style={{ color: PALETTE.textSecondary }}>
                    {day.date}
                  </div>
                  <div className="flex-1 flex gap-1 h-4">
                    <div
                      className="rounded-l"
                      style={{
                        backgroundColor: day.rentals > 0 ? PALETTE.success : PALETTE.border,
                        width: day.rentals > 0 ? `${(day.rentals / Math.max(day.rentals + day.sales, 1)) * 100}%` : "2px",
                        minWidth: day.rentals > 0 ? "4px" : "2px",
                      }}
                      title={`Аренды: ${day.rentals}`}
                    />
                    <div
                      className="rounded-r"
                      style={{
                        backgroundColor: day.sales > 0 ? PALETTE.accent : PALETTE.border,
                        width: day.sales > 0 ? `${(day.sales / Math.max(day.rentals + day.sales, 1)) * 100}%` : "2px",
                        minWidth: day.sales > 0 ? "4px" : "2px",
                      }}
                      title={`Продажи: ${day.sales}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs" style={{ color: PALETTE.textMuted }}>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded" style={{ backgroundColor: PALETTE.success }} />
                Аренды
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded" style={{ backgroundColor: PALETTE.accent }} />
                Продажи
              </div>
            </div>
          </div>

          {/* Diary */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
          >
            <h2 className="text-sm font-semibold mb-3 uppercase" style={{ color: PALETTE.textSecondary }}>
              Дневник оператора
            </h2>
            <form onSubmit={handleAddTodo} className="mb-3">
              <div className="text-xs mb-1" style={{ color: PALETTE.textMuted }}>
                + открытые
              </div>
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Новое TODO за этот день..."
                className="w-full p-2 rounded text-xs"
                style={{ backgroundColor: PALETTE.bg, border: `1px solid ${PALETTE.border}`, color: PALETTE.textPrimary }}
              />
            </form>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {todos.map((todo) => (
                <label key={todo.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggleTodo(todo.id, todo.completed)}
                    className="accent-yellow-500"
                  />
                  <span
                    style={{
                      color: todo.completed ? PALETTE.textMuted : PALETTE.textPrimary,
                      textDecoration: todo.completed ? "line-through" : "none",
                    }}
                  >
                    {todo.text}
                  </span>
                </label>
              ))}
              {todos.length === 0 && (
                <div className="text-xs text-center py-4" style={{ color: PALETTE.textMuted }}>
                  Список пуст
                </div>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold uppercase" style={{ color: PALETTE.textSecondary }}>
                Чек-лист
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setChecklistType("handout")}
                  className={`text-xs px-2 py-1 rounded ${
                    checklistType === "handout" ? "font-bold" : ""
                  }`}
                  style={{
                    backgroundColor: checklistType === "handout" ? PALETTE.accent : PALETTE.border,
                    color: checklistType === "handout" ? PALETTE.bg : PALETTE.textSecondary,
                  }}
                >
                  Выдача
                </button>
                <button
                  onClick={() => setChecklistType("return")}
                  className={`text-xs px-2 py-1 rounded ${
                    checklistType === "return" ? "font-bold" : ""
                  }`}
                  style={{
                    backgroundColor: checklistType === "return" ? PALETTE.accent : PALETTE.border,
                    color: checklistType === "return" ? PALETTE.bg : PALETTE.textSecondary,
                  }}
                >
                  Возврат
                </button>
              </div>
            </div>

            {checklist && (
              <>
                <div className="mb-3">
                  <div className="text-xs" style={{ color: PALETTE.textMuted }}>
                    {checklist.completedCount} из {checklist.totalCount}
                  </div>
                  <div className="text-lg font-bold" style={{ color: PALETTE.accent }}>
                    {checklist.percentage || 0}%
                  </div>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {checklist.items.map((item) => (
                    <label key={item.id} className="flex items-start gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => handleChecklistItem(item.id, e.target.checked)}
                        className="accent-yellow-500 mt-0.5"
                      />
                      <span style={{ color: PALETTE.textPrimary }}>{item.text}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-6 text-center text-xs" style={{ color: PALETTE.textMuted }}>
        VIP Bike Dashboard · сделано на ZAI · данные из Supabase ({format(currentDate, "yyyy-MM-dd")})
      </div>
    </div>
  );
}
