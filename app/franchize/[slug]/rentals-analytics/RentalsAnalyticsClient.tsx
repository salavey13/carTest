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
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
  Eye,
} from "lucide-react";

import { useAppContext } from "@/contexts/AppContext";
import {
  getRentalsDashboard,
  getRentalsDateRange,
  getRentalsForExport,
  validateAnalyticsPassword,
  type RentalDashboardItem,
  type RentalDashboardSummary,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { useSupabaseRealtime } from "@/app/franchize/hooks/useSupabaseRealtime";
import {
  getAllChecklistStates,
  updateChecklistState,
  type ChecklistState,
} from "@/app/franchize/server-actions/checklist";
import {
  getCrewTodos,
  getCrewTodoStats,
  type CrewTodo,
  type TodoStatus,
} from "@/app/franchize/server-actions/crew-todos";
import { RentalHandoffModal } from "./RentalHandoffModal";

// ─── Formatting helpers ─────────────────────────────────────────────────────────

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

// ─── Status configs ────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  confirmed: { bg: "rgba(52, 211, 153, 0.15)", border: "#34d399", text: "#34d399", icon: CheckCircle2, label: "Подтв" },
  active: { bg: "rgba(96, 165, 250, 0.15)", border: "#60a5fa", text: "#60a5fa", icon: Clock, label: "Активна" },
  completed: { bg: "rgba(74, 222, 128, 0.15)", border: "#4ade80", text: "#4ade80", icon: CheckCircle2, label: "Завершена" },
  cancelled: { bg: "rgba(248, 113, 113, 0.15)", border: "#f87171", text: "#f87171", icon: XCircle, label: "Отменена" },
  pending_confirmation: { bg: "rgba(251, 191, 36, 0.15)", border: "#fbbf24", text: "#fbbf24", icon: AlertCircle, label: "Ожидает" },
};

interface RentalsAnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: { id: string; name: string; theme: { palette: { primary: string } } };
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

  // Handoff modal state
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [handoffModalPhase, setHandoffModalPhase] = useState<"handout" | "return">("handout");
  const [handoffModalRental, setHandoffModalRental] = useState<RentalDashboardItem | null>(null);

  // Password auth
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);

  // ─── Realtime subscriptions ───────────────────────────────────────────────────

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

  // ─── Data loading functions ────────────────────────────────────────────────────

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

  // ─── Password handling ─────────────────────────────────────────────────────────

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

  // ─── Checklist handling ───────────────────────────────────────────────────────

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

  const exportToExcel = async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    try {
      const result = await getRentalsForExport({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        date: selectedDate,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || "Не удалось получить данные");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(result.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Аренды");
      XLSX.writeFile(wb, `rentals-${selectedDate}.xlsx`);
      toast.success("Экспорт выполнен");
    } catch (error) {
      toast.error("Ошибка экспорта");
    }
  };

  // ─── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (getActorUserId()) {
      void loadRentals(selectedDate);
      void loadDateRange();
      void loadChecklistStates();
      void loadTodos();
    }
  }, [getActorUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (getActorUserId() && !authLoading) {
      void loadRentals(selectedDate, true);
    }
  }, [selectedDate, verificationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (getActorUserId() && !authLoading && crew.id) {
      void loadTodos();
    }
  }, [todoFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Password entry screen ────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (showPasswordEntry) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm relative">
          {/* Animated glow effect */}
          <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 rounded-full blur-3xl opacity-20 animate-pulse" />

          <div className="relative bg-gradient-to-br from-zinc-900 to-black rounded-3xl p-8 border border-zinc-800 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <ShieldCheck className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 tracking-tight">
                Аналитика
              </h1>
              <p className="text-zinc-500 text-sm mt-2">Введите пароль для доступа</p>
            </div>

            <div className="relative">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(null); }}
                onKeyDown={(e) => e.key === "Enter" && void handlePasswordSubmit()}
                placeholder="••••••••"
                disabled={isPasswordValidating}
                className="w-full px-6 py-4 bg-zinc-900/50 border-2 border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 text-center tracking-widest text-lg transition-all"
                autoFocus
              />
              {passwordError && (
                <p className="mt-3 text-center text-sm text-rose-400 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {passwordError}
                </p>
              )}
            </div>

            <button
              onClick={handlePasswordSubmit}
              disabled={isPasswordValidating || !passwordInput.trim()}
              className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-bold rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-400/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isPasswordValidating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Войти
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Calculations ───────────────────────────────────────────────────────────────

  const totalRentals = rentals.length;
  const totalRevenue = rentals.reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const activeRentals = rentals.filter(r => r.status === "active").length;
  const completedRentals = rentals.filter(r => r.status === "completed").length;
  const completionRate = totalRentals > 0 ? Math.round((completedRentals / totalRentals) * 100) : 0;

  // ─── Main render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Animated gradient orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] animate-orb-1" />
        <div className="absolute w-[600px] h-[600px] bg-yellow-600/10 rounded-full blur-[100px] animate-orb-2 top-[20%] right-[10%]" />
        <div className="absolute w-[700px] h-[700px] bg-pink-600/8 rounded-full blur-[110px] animate-orb-3 bottom-[10%] left-[30%]" />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* HEADER */}
        <header className="flex-shrink-0 px-6 py-4 border-b border-white/5 bg-black/50 backdrop-blur-xl">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Left section */}
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent">
                  Аналитика
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">{crew.name}</p>
              </div>

              <div className="h-8 w-px bg-white/10" />

              {/* Date navigation */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateDate(-1)}
                  disabled={loading}
                  className="p-2 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-yellow-400/30 hover:bg-zinc-800 transition-all group"
                >
                  <ChevronLeft className="w-5 h-5 text-zinc-400 group-hover:text-yellow-400 transition-colors" />
                </button>

                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-400/10 to-orange-400/10 border border-yellow-400/20">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-100">
                    {formatRussianDateOnly(selectedDate)}
                  </span>
                </div>

                <button
                  onClick={() => navigateDate(1)}
                  disabled={loading}
                  className="p-2 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-yellow-400/30 hover:bg-zinc-800 transition-all group"
                >
                  <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-yellow-400 transition-colors" />
                </button>
              </div>
            </div>

            {/* Right section - actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => void loadRentals(selectedDate, true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-emerald-400/30 hover:bg-zinc-800 transition-all group"
              >
                <RefreshCw className={`w-5 h-5 text-zinc-400 group-hover:text-emerald-400 transition-colors ${refreshing ? "animate-spin" : ""}`} />
              </button>

              <button
                onClick={exportToExcel}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 hover:from-emerald-500/30 hover:to-teal-500/30 hover:border-emerald-400/40 transition-all flex items-center gap-2 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Экспорт
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

            {/* STATS ROW */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total rentals */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-purple-600/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative bg-zinc-900/50 backdrop-blur-xl rounded-2xl p-5 border border-white/5 group-hover:border-purple-500/20 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Eye className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Всего аренд</span>
                  </div>
                  <div className="text-3xl font-black text-white">{totalRentals}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                    <Calendar className="w-3 h-3" />
                    За выбранный день
                  </div>
                </div>
              </div>

              {/* Revenue */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative bg-zinc-900/50 backdrop-blur-xl rounded-2xl p-5 border border-white/5 group-hover:border-emerald-500/20 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Выручка</span>
                  </div>
                  <div className="text-3xl font-black text-emerald-400">{formatRubles(totalRevenue)}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                    <Zap className="w-3 h-3" />
                    Общий доход
                  </div>
                </div>
              </div>

              {/* Active rentals */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-blue-600/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative bg-zinc-900/50 backdrop-blur-xl rounded-2xl p-5 border border-white/5 group-hover:border-blue-500/20 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Clock className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Активных</span>
                  </div>
                  <div className="text-3xl font-black text-blue-400">{activeRentals}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                    <Sparkles className="w-3 h-3" />
                    Сейчас на выезде
                  </div>
                </div>
              </div>

              {/* Completion rate */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/20 to-yellow-600/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative bg-zinc-900/50 backdrop-blur-xl rounded-2xl p-5 border border-white/5 group-hover:border-yellow-500/20 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-yellow-500/20">
                      <CheckCircle2 className="w-5 h-5 text-yellow-400" />
                    </div>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Завершено</span>
                  </div>
                  <div className="text-3xl font-black text-yellow-400">{completionRate}%</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                    <CheckCircle2 className="w-3 h-3" />
                    {completedRentals} из {totalRentals}
                  </div>
                </div>
              </div>
            </div>

            {/* FILTER BAR */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider whitespace-nowrap">Фильтр:</span>
              {[
                { value: "all", label: "Все", icon: Eye },
                { value: "verified", label: "Проверены", icon: CheckCircle2 },
                { value: "pending", label: "Ожидают", icon: Clock },
              ].map((filter) => {
                const Icon = filter.icon;
                const isActive = verificationFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    onClick={() => setVerificationFilter(isActive ? "all" : (filter.value as any))}
                    className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border-yellow-400/30 text-yellow-400"
                        : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {/* CHECKLISTS & TODOS */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Handout checklist */}
              <div className="bg-zinc-900/30 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-sm font-bold text-white">ВЫДАЧА</span>
                    <span className="text-zinc-600">→</span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {checklistStates.handout?.items.filter(i => i.checked).length || 0} / {checklistStates.handout?.items.length || 0}
                  </span>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {checklistStates.handout?.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void toggleChecklistItem("handout", item.id)}
                      disabled={updatingChecklist === item.id}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${
                        item.checked
                          ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                      }`}
                    >
                      {item.checked && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Return checklist */}
              <div className="bg-zinc-900/30 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-sm font-bold text-white">ВОЗВРАТ</span>
                    <span className="text-zinc-600">←</span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {checklistStates.return?.items.filter(i => i.checked).length || 0} / {checklistStates.return?.items.length || 0}
                  </span>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {checklistStates.return?.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void toggleChecklistItem("return", item.id)}
                      disabled={updatingChecklist === item.id}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${
                        item.checked
                          ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                      }`}
                    >
                      {item.checked && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Todos */}
              <div className="lg:col-span-2 bg-zinc-900/30 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-sm font-bold text-white">ЗАДАЧИ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[
                      { value: "all", label: "Все" },
                      { value: "pending", label: "Ожидают" },
                      { value: "in_progress", label: "В работе" },
                      { value: "done", label: "Готово" },
                    ].map((filter) => (
                      <button
                        key={filter.value}
                        onClick={() => setTodoFilter(todoFilter === filter.value ? "all" : (filter.value as any))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          todoFilter === filter.value
                            ? "bg-purple-500/20 text-purple-400"
                            : "text-zinc-600 hover:text-zinc-400"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  {todos.length === 0 ? (
                    <div className="text-center py-6 text-zinc-600 text-sm">Нет активных задач</div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {todos.slice(0, 6).map((todo) => (
                        <div
                          key={todo.id}
                          className={`p-3 rounded-xl border transition-all ${
                            todo.status === "done"
                              ? "bg-emerald-500/10 border-emerald-500/20"
                              : todo.status === "in_progress"
                              ? "bg-amber-500/10 border-amber-500/20"
                              : "bg-zinc-900/50 border-zinc-800"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                              todo.status === "done" ? "bg-emerald-400" :
                              todo.status === "in_progress" ? "bg-amber-400 animate-pulse" :
                              "bg-zinc-600"
                            }`} />
                            <span className="text-sm text-zinc-300">{todo.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RENTALS TABLE */}
            <div className="bg-zinc-900/30 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5">
                <span className="text-sm font-bold text-white">АРЕНДЫ</span>
              </div>

              {loading ? (
                <div className="p-12 text-center">
                  <div className="w-10 h-10 border-3 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-zinc-500 text-sm">Загрузка...</p>
                </div>
              ) : rentals.length === 0 ? (
                <div className="p-12 text-center">
                  <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500 text-sm">Нет аренд за этот день</p>
                  <p className="text-zinc-600 text-xs mt-1">Выберите другую дату</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Время</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Клиент / Техника</th>
                        <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Сумма</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Статус</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Док</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Одометр</th>
                        <th className="px-5 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rentals.map((rental) => {
                        const statusStyle = STATUS_STYLES[rental.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.pending_confirmation;
                        const StatusIcon = statusStyle.icon;
                        return (
                          <tr
                            key={rental.rental_id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="text-sm text-zinc-400 font-mono">
                                {formatRussianDate(rental.agreed_start_date || rental.created_at).split(",")[1]?.trim() || "—"}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm font-medium text-white">{rental.user?.full_name || rental.user?.username || "—"}</div>
                              <div className="text-xs text-zinc-600 mt-0.5">
                                {rental.vehicle?.make} {rental.vehicle?.model}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <span className="text-sm font-mono text-emerald-400">{formatRubles(rental.total_cost)}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                                style={{
                                  background: statusStyle.bg,
                                  borderColor: statusStyle.border,
                                  color: statusStyle.text,
                                }}
                              >
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusStyle.label}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`text-lg ${rental.documentSecret ? "text-emerald-400" : "text-zinc-700"}`}>
                                {rental.documentSecret ? "✓" : "—"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {rental.odometerStart || rental.odometerEnd ? (
                                <span className="text-sm text-emerald-400 font-mono">
                                  {rental.odometerStart || "?"}→{rental.odometerEnd || "?"}
                                </span>
                              ) : (
                                <span className="text-zinc-700">—</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setHandoffModalRental(rental);
                                    setHandoffModalPhase("handout");
                                    setHandoffModalOpen(true);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    rental.handoutCompleted
                                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                                  }`}
                                >
                                  →
                                </button>
                                <button
                                  onClick={() => {
                                    setHandoffModalRental(rental);
                                    setHandoffModalPhase("return");
                                    setHandoffModalOpen(true);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    rental.returnCompleted
                                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                                  }`}
                                >
                                  ←
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center py-4">
              <p className="text-xs text-zinc-700">
                CarTest Analytics • {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        @keyframes orb-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(100px, -100px) scale(1.1); }
          66% { transform: translate(-50px, 100px) scale(0.9); }
        }
        @keyframes orb-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-80px, 80px) scale(1.05); }
          66% { transform: translate(60px, -60px) scale(0.95); }
        }
        @keyframes orb-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 50px) scale(1.1); }
        }
        .animate-orb-1 { animation: orb-1 20s ease-in-out infinite; }
        .animate-orb-2 { animation: orb-2 25s ease-in-out infinite; }
        .animate-orb-3 { animation: orb-3 18s ease-in-out infinite; }
      `}</style>

      {/* Rental Handoff Modal */}
      {handoffModalRental && (
        <RentalHandoffModal
          rentalId={handoffModalRental.rental_id}
          vehicleName={`${handoffModalRental.vehicle?.make || ""} ${handoffModalRental.vehicle?.model || ""}`.trim()}
          phase={handoffModalPhase}
          isOpen={handoffModalOpen}
          onClose={() => setHandoffModalOpen(false)}
          onSuccess={() => void loadRentals(selectedDate, true)}
          isPasswordAuth={!!passwordAuthOwnerId}
        />
      )}
    </div>
  );
}
