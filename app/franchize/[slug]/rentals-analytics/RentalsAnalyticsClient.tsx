"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import * as XLSX from "xlsx";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Filter,
  ListChecks,
  Plus,
  Trash2,
  Eye,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Loading } from "@/components/Loading";
import { useAppContext } from "@/contexts/AppContext";
import {
  getRentalsDashboard,
  getRentalDocumentDetails,
  getRentalsDateRange,
  resendRentalContract,
  getRentalsForExport,
  validateAnalyticsPassword,
  type RentalDashboardItem,
  type RentalDashboardSummary,
  type RentalDocumentDetail,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { useSupabaseRealtime } from "@/app/franchize/hooks/useSupabaseRealtime";
import {
  getAllChecklistStates,
  updateChecklistState,
  resetChecklistState,
  type ChecklistState,
} from "@/app/franchize/server-actions/checklist";
import {
  getCrewTodos,
  getCrewMembersForTodos,
  createCrewTodo,
  updateCrewTodo,
  deleteCrewTodo,
  getCrewTodoStats,
  type CrewTodo,
  type TodoStatus,
} from "@/app/franchize/server-actions/crew-todos";
import {
  crewPaletteForSurface,
  readablePaletteTextOnColor,
} from "@/app/franchize/lib/theme";
import type { FranchizeCrewVM } from "@/app/franchize/actions";

// ─── Ultra-compact formatting helpers ───────────────────────────────────────

const formatRubles = (amount: number | null | undefined): string => {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatRussianDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: ru });
  } catch {
    return "—";
  }
};

const formatRussianDateOnly = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: ru });
  } catch {
    return "—";
  }
};

// Status configs
const statusConfig = {
  confirmed: { label: "Подтв", icon: CheckCircle2, color: "text-emerald-400" },
  active: { label: "Активна", icon: Clock, color: "text-blue-400" },
  completed: { label: "Завершена", icon: CheckCircle2, color: "text-green-400" },
  cancelled: { label: "Отменена", icon: XCircle, color: "text-rose-400" },
  pending_confirmation: { label: "Ожидает", icon: AlertCircle, color: "text-amber-400" },
};

interface RentalsAnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: FranchizeCrewVM;
}

export function RentalsAnalyticsClient({ initialSlug, initialDate, crew }: RentalsAnalyticsClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [verificationFilter, setVerificationFilter] = useState<"all" | "verified" | "pending" | "revoked">("all");
  const [rentals, setRentals] = useState<RentalDashboardItem[]>([]);
  const [summary, setSummary] = useState<RentalDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [checklistStates, setChecklistStates] = useState<{ handout: ChecklistState | null; return: ChecklistState | null }>({ handout: null, return: null });
  const [updatingChecklist, setUpdatingChecklist] = useState<string | null>(null);
  const [todos, setTodos] = useState<CrewTodo[]>([]);
  const [todoStats, setTodoStats] = useState<{ total: number; pending: number; inProgress: number; done: number } | null>(null);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [todoFilter, setTodoFilter] = useState<TodoStatus | "all">("all");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Password auth
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);

  // Realtime subscriptions
  useSupabaseRealtime({
    tableName: "checklist_state",
    onData: () => void loadChecklistStates(),
    onError: (error) => console.error("[Analytics] Checklist error:", error),
  });

  useSupabaseRealtime({
    tableName: "crew_todos",
    filter: crew.id ? `crew_id=eq.${crew.id}` : undefined,
    onData: () => void loadTodos(),
    onError: (error) => console.error("[Analytics] Todos error:", error),
  });

  const getActorUserId = useCallback((): string | null => dbUser?.user_id || passwordAuthOwnerId, [dbUser?.user_id, passwordAuthOwnerId]);

  const loadRentals = useCallback(async (date: string, showRefresh = false) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await getRentalsDashboard({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        date,
        verificationStatus: verificationFilter === "all" ? undefined : verificationFilter,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (!result.success) {
        if (result.error?.includes("прав") || result.error?.includes("доступ")) {
          setShowPasswordEntry(true);
          toast.error("Требуется пароль");
          return;
        }
        toast.error(result.error || "Не удалось загрузить аренды");
        return;
      }

      setRentals(result.data?.items || []);
      setSummary(result.data?.summary || null);
    } catch (error) {
      console.error("[Analytics] Load error:", error);
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getActorUserId, initialSlug, verificationFilter, passwordAuthOwnerId]);

  const loadDateRange = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    try {
      const result = await getRentalsDateRange({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success) setDateRange(result.data || null);
      else if (result.error?.includes("прав")) {
        setShowPasswordEntry(true);
      }
    } catch (error) {
      console.error("[Analytics] Date range error:", error);
    }
  }, [getActorUserId, initialSlug, passwordAuthOwnerId]);

  const loadChecklistStates = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    try {
      const result = await getAllChecklistStates({ actorUserId, isPasswordAuth: !!passwordAuthOwnerId });
      if (result.success && result.data) setChecklistStates(result.data);
    } catch (error) {
      console.error("[Analytics] Checklist error:", error);
    }
  }, [getActorUserId, passwordAuthOwnerId]);

  const loadTodos = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId || !crew.id) return;

    setLoadingTodos(true);
    try {
      const [todosResult, statsResult] = await Promise.all([
        getCrewTodos({ actorUserId, crewId: crew.id, status: todoFilter === "all" ? undefined : todoFilter, isPasswordAuth: !!passwordAuthOwnerId }),
        getCrewTodoStats({ actorUserId, crewId: crew.id, isPasswordAuth: !!passwordAuthOwnerId }),
      ]);
      if (todosResult.success) setTodos(todosResult.data || []);
      if (statsResult.success) setTodoStats(statsResult.data);
    } catch (error) {
      console.error("[Analytics] Todos error:", error);
    } finally {
      setLoadingTodos(false);
    }
  }, [getActorUserId, crew.id, todoFilter, passwordAuthOwnerId]);

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) return;

    setIsPasswordValidating(true);
    setPasswordError(null);

    try {
      const result = await validateAnalyticsPassword({ password: passwordInput, crewSlug: initialSlug?.trim() || "vip-bike" });
      if (!result.success) {
        setPasswordError(result.error || "Неверный пароль");
        return;
      }

      setPasswordAuthOwnerId(result.data?.ownerId || null);
      setShowPasswordEntry(false);
      setPasswordInput("");
      toast.success("Доступ разрешён");
    } catch (error) {
      setPasswordError("Ошибка проверки пароля");
    } finally {
      setIsPasswordValidating(false);
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handlePasswordSubmit();
  };

  const toggleChecklistItem = async (type: "handout" | "return", itemId: string) => {
    const currentState = type === "handout" ? checklistStates.handout : checklistStates.return;
    if (!currentState) return;

    const item = currentState.items.find((i) => i.id === itemId);
    if (!item) return;

    setUpdatingChecklist(itemId);
    try {
      const newItem = { ...item, checked: !item.checked };
      const result = await updateChecklistState({
        actorUserId: getActorUserId()!,
        type,
        items: currentState.items.map((i) => (i.id === itemId ? newItem : i)),
        isPasswordAuth: !!passwordAuthOwnerId,
      });
      if (result.success) {
        await loadChecklistStates();
      }
    } finally {
      setUpdatingChecklist(null);
    }
  };

  const navigateDate = (delta: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  // Initial load
  useEffect(() => {
    if (getActorUserId()) {
      void loadRentals(selectedDate);
      void loadDateRange();
      void loadChecklistStates();
      void loadTodos();
    }
  }, [getActorUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when date/filter changes
  useEffect(() => {
    if (getActorUserId() && !authLoading) {
      void loadRentals(selectedDate, true);
    }
  }, [selectedDate, verificationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload todos when filter changes
  useEffect(() => {
    if (getActorUserId() && !authLoading && crew.id) {
      void loadTodos();
    }
  }, [todoFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) return <Loading text="..." compact />;

  // Password entry
  if (showPasswordEntry) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">
              Аналитика
            </h1>
            <p className="text-purple-300 text-sm mt-2">Введите пароль</p>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(null); }}
            onKeyDown={handlePasswordKeyDown}
            placeholder="Пароль"
            disabled={isPasswordValidating}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-purple-400 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
            autoFocus
          />
          {passwordError && <p className="mt-2 text-xs text-rose-400">{passwordError}</p>}
          <button
            onClick={handlePasswordSubmit}
            disabled={isPasswordValidating || !passwordInput.trim()}
            className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-bold rounded-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPasswordValidating ? "Проверка..." : "Войти"}
          </button>
        </div>
      </div>
    );
  }

  const palette = crew.theme.palette;
  const totalRentals = rentals.length;
  const totalRevenue = rentals.reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const activeRentals = rentals.filter(r => r.status === "active").length;
  const completedRentals = rentals.filter(r => r.status === "completed").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob top-0 left-0"></div>
        <div className="absolute w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000 top-0 right-0"></div>
        <div className="absolute w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000 bottom-0 left-1/2"></div>
      </div>

      <div className="relative z-10 h-screen flex flex-col overflow-hidden">
        {/* ULTRA COMPACT HEADER */}
        <header className="flex-shrink-0 px-2 py-1 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Title + Date */}
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white/90">АРЕНДЫ</h1>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5">
                <Calendar className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-mono text-yellow-400">{formatRussianDateOnly(selectedDate)}</span>
              </div>
            </div>

            {/* Center: Date nav */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateDate(-1)}
                disabled={loading}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                title="Предыдущий день"
              >
                <ChevronLeft className="w-4 h-4 text-white/70" />
              </button>
              <button
                onClick={() => navigateDate(1)}
                disabled={loading}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                title="Следующий день"
              >
                <ChevronRight className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => void loadRentals(selectedDate, true)}
                disabled={refreshing}
                className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                title="Обновить"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-white/70 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Экспорт"
              >
                <Download className="w-3.5 h-3.5 text-white/70" />
              </button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 mt-1 overflow-x-auto">
            {[
              { value: "all", label: "Все" },
              { value: "verified", label: "Проверены" },
              { value: "pending", label: "Ожидают" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setVerificationFilter(verificationFilter === filter.value ? "all" : filter.value as any)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all ${
                  verificationFilter === filter.value
                    ? "bg-yellow-400 text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        {/* MAIN CONTENT - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
            {/* Stats cards */}
            <div className="bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
              <div className="text-[10px] text-white/50">Аренд</div>
              <div className="text-lg font-bold text-white">{totalRentals}</div>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
              <div className="text-[10px] text-white/50">Выручка</div>
              <div className="text-lg font-bold text-green-400">{formatRubles(totalRevenue)}</div>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
              <div className="text-[10px] text-white/50">Активных</div>
              <div className="text-lg font-bold text-blue-400">{activeRentals}</div>
            </div>

            {/* Checklist: Выдача */}
            <div className="bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10 md:col-span-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] font-medium text-white/70">ВЫДАЧА</span>
                <span className="text-[10px] text-white/40">→</span>
              </div>
              <div className="flex flex-wrap gap-0.5">
                {checklistStates.handout?.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void toggleChecklistItem("handout", item.id)}
                    disabled={updatingChecklist === item.id}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all ${
                      item.checked
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                        : "bg-white/5 text-white/40 border border-white/10 hover:border-white/20"
                    } ${updatingChecklist === item.id ? "opacity-50" : ""}`}
                  >
                    {item.checked ? "✓" : ""}{item.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Checklist: Возврат */}
            <div className="bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] font-medium text-white/70">ВОЗВРАТ</span>
                <span className="text-[10px] text-white/40">←</span>
              </div>
              <div className="flex flex-wrap gap-0.5">
                {checklistStates.return?.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void toggleChecklistItem("return", item.id)}
                    disabled={updatingChecklist === item.id}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all ${
                      item.checked
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                        : "bg-white/5 text-white/40 border border-white/10 hover:border-white/20"
                    } ${updatingChecklist === item.id ? "opacity-50" : ""}`}
                  >
                    {item.checked ? "✓" : ""}{item.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Todos */}
            <div className="bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10 md:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-white/70">ЗАДАЧИ</span>
                <div className="flex items-center gap-1">
                  {[
                    { value: "all", label: "Все" },
                    { value: "pending", label: "Ожидают" },
                    { value: "in_progress", label: "В работе" },
                    { value: "done", label: "Выполнено" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setTodoFilter(todoFilter === filter.value ? "all" : filter.value as any)}
                      className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${
                        todoFilter === filter.value
                          ? "bg-purple-500/30 text-purple-300"
                          : "bg-white/5 text-white/40 hover:bg-white/10"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              {todos.length === 0 ? (
                <div className="text-center py-2 text-[10px] text-white/30">Нет активных задач</div>
              ) : (
                <div className="space-y-0.5 max-h-20 overflow-y-auto">
                  {todos.slice(0, 5).map((todo) => (
                    <div key={todo.id} className="flex items-center gap-2 px-2 py-1 rounded bg-white/5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        todo.status === "done" ? "bg-emerald-400" :
                        todo.status === "in_progress" ? "bg-amber-400" :
                        "bg-slate-400"
                      }`} />
                      <span className="text-[10px] text-white/70 truncate flex-1">{todo.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rentals table - FULL WIDTH */}
          <div className="p-1 pt-2">
            <div className="bg-white/5 backdrop-blur rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-2 py-1 text-left text-[10px] font-medium text-white/50">ВРЕМЯ</th>
                    <th className="px-2 py-1 text-left text-[10px] font-medium text-white/50">КЛИЕНТ / ТЕХНИКА</th>
                    <th className="px-2 py-1 text-right text-[10px] font-medium text-white/50">СУММА</th>
                    <th className="px-2 py-1 text-center text-[10px] font-medium text-white/50">СТАТУС</th>
                    <th className="px-2 py-1 text-center text-[10px] font-medium text-white/50">ДОК</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-white/30 text-xs">Загрузка...</td>
                    </tr>
                  ) : rentals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-white/30 text-xs">
                        Нет аренд за этот день. Выберите другую дату.
                      </td>
                    </tr>
                  ) : (
                    rentals.map((rental) => {
                      const status = statusConfig[rental.status as keyof typeof statusConfig] || statusConfig.pending_confirmation;
                      const StatusIcon = status.icon;
                      return (
                        <tr key={rental.rental_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-2 py-1.5 text-[10px] text-white/70 whitespace-nowrap">
                            {formatRussianDate(rental.agreed_start_date || rental.created_at).split(",")[1]?.trim() || "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="text-[10px] font-medium text-white">{rental.user?.full_name || rental.user?.username || "—"}</div>
                            <div className="text-[9px] text-white/50">{rental.vehicle?.make} {rental.vehicle?.model}</div>
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] font-mono text-white/70">
                            {formatRubles(rental.total_cost)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${status.color}`}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`text-[9px] ${
                              rental.documentSecret ? "text-emerald-400" : "text-amber-400"
                            }`}>
                              {rental.documentSecret ? "✓" : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}
