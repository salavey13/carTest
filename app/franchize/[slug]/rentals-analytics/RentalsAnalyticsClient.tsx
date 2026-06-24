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
  getSalesDashboard,
  validateAnalyticsPassword,
  type RentalDashboardItem,
  type RentalDashboardSummary,
  type SaleDashboardItem,
  type SalesDashboardResult,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { useSupabaseRealtime } from "@/app/franchize/hooks/useSupabaseRealtime";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
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
import { withAlpha } from "@/app/franchize/lib/theme";

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

// ─── Status configs (will be themed dynamically) ───────────────────────────────

const getStatusConfig = (accentMain: string) => ({
  confirmed: { icon: CheckCircle2, label: "Подтв", color: "#34d399" },
  active: { icon: Clock, label: "Активна", color: "#60a5fa" },
  completed: { icon: CheckCircle2, label: "Завершена", color: "#4ade80" },
  cancelled: { icon: XCircle, label: "Отменена", color: "#f87171" },
  pending_confirmation: { icon: AlertCircle, label: "Ожидает", color: "#fbbf24" },
});

interface RentalsAnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: { id: string; name: string; theme: any };
}

export function RentalsAnalyticsClient({ initialSlug, initialDate, crew }: RentalsAnalyticsClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const theme = useFranchizeTheme(crew.theme);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [verificationFilter, setVerificationFilter] = useState<"all" | "verified" | "pending" | "revoked">("all");
  const [rentals, setRentals] = useState<RentalDashboardItem[]>([]);
  const [summary, setSummary] = useState<RentalDashboardSummary | null>(null);
  // Sales data
  const [sales, setSales] = useState<SaleDashboardItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesDashboardResult["summary"] | null>(null);
  const [loadingSales, setLoadingSales] = useState(true);
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

  const loadSales = useCallback(async (date: string) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    setLoadingSales(true);
    try {
      const result = await getSalesDashboard({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        date,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success && result.data) {
        setSales(result.data.items || []);
        setSalesSummary(result.data.summary || null);
      }
    } catch (error) {
      console.error("[Analytics] Sales load error:", error);
    } finally {
      setLoadingSales(false);
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
      const result = await validateAnalyticsPassword({ password: passwordInput });
      if (!result.success) {
        setPasswordError(result.error || "Неверный пароль");
        return;
      }

      // Verify the returned slug matches the current crew
      if (result.data?.slug && result.data.slug !== initialSlug?.trim()) {
        setPasswordError(`Пароль для другого экипажа: ${result.data.slug}`);
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
      void loadSales(selectedDate);
      void loadDateRange();
      void loadChecklistStates();
      void loadTodos();
    }
  }, [getActorUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (getActorUserId() && !authLoading) {
      void loadRentals(selectedDate, true);
      void loadSales(selectedDate);
    }
  }, [selectedDate, verificationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (getActorUserId() && !authLoading && crew.id) {
      void loadTodos();
    }
  }, [todoFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Calculations ───────────────────────────────────────────────────────────────

  const totalRentals = rentals.length;
  const rentalRevenue = rentals.reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const totalSales = sales.length;
  const salesRevenue = salesSummary?.totalRevenue || 0;
  const totalRevenue = rentalRevenue + salesRevenue;
  const activeRentals = rentals.filter(r => r.status === "active").length;
  const completedRentals = rentals.filter(r => r.status === "completed").length;
  const completionRate = totalRentals > 0 ? Math.round((completedRentals / totalRentals) * 100) : 0;

  // Theme colors from CSS variables
  const bgBase = "var(--franchize-bg-base)";
  const bgCard = "var(--franchize-bg-card)";
  const accentMain = "var(--franchize-accent-main)";
  const accentHover = "var(--franchize-accent-hover)";
  const textPrimary = "var(--franchize-text-primary)";
  const textSecondary = "var(--franchize-text-secondary)";
  const borderSoft = "var(--franchize-border-soft)";

  // ─── Password entry screen ────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgBase }}>
        <div className="relative">
          <div className="w-16 h-16 border-4 rounded-full animate-spin" style={{ borderColor: withAlpha(accentMain, 0.3), borderTopColor: accentMain }} />
        </div>
      </div>
    );
  }

  if (showPasswordEntry) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgBase }}>
        <div className="w-full max-w-sm relative">
          {/* Animated glow effect */}
          <div
            className="absolute -inset-4 rounded-full blur-3xl animate-pulse"
            style={{ backgroundColor: withAlpha(accentMain, 0.15) }}
          />

          <div
            className="relative rounded-3xl p-8 border shadow-2xl"
            style={{ backgroundColor: bgCard, borderColor: borderSoft }}
          >
            <div className="text-center mb-8">
              <div
                className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${accentMain}, ${accentHover})`,
                  boxShadow: `0 10px 40px ${withAlpha(accentMain, 0.3)}`,
                }}
              >
                <ShieldCheck className="w-10 h-10" style={{ color: "#FFFFFF" }} />
              </div>
              <h1 className="text-3xl font-black tracking-tight" style={{ backgroundImage: `linear-gradient(to right, ${accentMain}, ${accentHover})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Аналитика
              </h1>
              <p className="text-sm mt-2" style={{ color: textSecondary }}>Введите пароль для доступа</p>
            </div>

            <div className="relative">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(null); }}
                onKeyDown={(e) => e.key === "Enter" && void handlePasswordSubmit()}
                placeholder="••••••••"
                disabled={isPasswordValidating}
                className="w-full px-6 py-4 rounded-xl border-2 text-center tracking-widest text-lg transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: withAlpha(bgCard, 0.5),
                  borderColor: borderSoft,
                  color: textPrimary,
                  placeholderColor: textSecondary,
                }}
                autoFocus
              />
              {passwordError && (
                <p className="mt-3 text-center text-sm flex items-center justify-center gap-2" style={{ color: "#ef4444" }}>
                  <AlertCircle className="w-4 h-4" />
                  {passwordError}
                </p>
              )}
            </div>

            <button
              onClick={handlePasswordSubmit}
              disabled={isPasswordValidating || !passwordInput.trim()}
              className="w-full mt-6 px-6 py-4 font-bold rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(to right, ${accentMain}, ${accentHover})`,
                boxShadow: `0 4px 20px ${withAlpha(accentMain, 0.4)}`,
                color: "#000000",
              }}
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

  const statusConfig = getStatusConfig(accentMain);

  // ─── Main render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgBase, color: textPrimary }}>
      {/* Animated gradient orbs background - themed */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[120px] animate-orb-1"
          style={{ backgroundColor: withAlpha(accentMain, 0.08) }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[100px] animate-orb-2 top-[20%] right-[10%]"
          style={{ backgroundColor: withAlpha(accentMain, 0.06) }}
        />
        <div
          className="absolute w-[700px] h-[700px] rounded-full blur-[110px] animate-orb-3 bottom-[10%] left-[30%]"
          style={{ backgroundColor: withAlpha(accentMain, 0.05) }}
        />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* HEADER */}
        <header className="flex-shrink-0 px-6 py-4 border-b backdrop-blur-xl" style={{ borderColor: withAlpha(borderSoft, 0.5), backgroundColor: withAlpha(bgCard, 0.5) }}>
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Left section */}
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-xl font-black tracking-tight" style={{ backgroundImage: `linear-gradient(to right, ${accentMain}, ${accentHover})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Аналитика
                </h1>
                <p className="text-xs mt-0.5" style={{ color: textSecondary }}>{crew.name}</p>
              </div>

              <div className="h-8 w-px" style={{ backgroundColor: withAlpha(borderSoft, 0.5) }} />

              {/* Date navigation */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateDate(-1)}
                  disabled={loading}
                  className="p-2 rounded-xl border transition-all group"
                  style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentMain; e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.1); }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderSoft; e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.5); }}
                >
                  <ChevronLeft className="w-5 h-5 transition-colors group-hover:text-[var(--hover-color)]" style={{ color: textSecondary, '--hover-color': accentMain } as React.CSSProperties} />
                </button>

                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border">
                  <Calendar className="w-4 h-4" style={{ color: accentMain }} />
                  <span className="text-sm font-medium" style={{ color: textPrimary }}>
                    {formatRussianDateOnly(selectedDate)}
                  </span>
                </div>

                <button
                  onClick={() => navigateDate(1)}
                  disabled={loading}
                  className="p-2 rounded-xl border transition-all group"
                  style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentMain; e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.1); }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderSoft; e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.5); }}
                >
                  <ChevronRight className="w-5 h-5 transition-colors" style={{ color: textSecondary, '--hover-color': accentMain } as React.CSSProperties} />
                </button>
              </div>
            </div>

            {/* Right section - actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => void loadRentals(selectedDate, true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl border transition-all group"
                style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#34d399"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderSoft; }}
              >
                <RefreshCw className={`w-5 h-5 transition-colors ${refreshing ? "animate-spin" : ""}`} style={{ color: textSecondary }} />
              </button>

              <button
                onClick={exportToExcel}
                className="px-4 py-2.5 rounded-xl border font-medium transition-all flex items-center gap-2 text-sm"
                style={{
                  backgroundColor: withAlpha("#10b981", 0.15),
                  borderColor: withAlpha("#10b981", 0.3),
                  color: "#34d399",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = withAlpha("#10b981", 0.25); e.currentTarget.style.borderColor = withAlpha("#10b981", 0.4); }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = withAlpha("#10b981", 0.15); e.currentTarget.style.borderColor = withAlpha("#10b981", 0.3); }}
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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total rentals */}
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl blur-xl group-hover:blur-2xl transition-all" style={{ backgroundColor: withAlpha(accentMain, 0.12) }} />
                <div className="relative rounded-2xl p-5 border transition-all" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha(accentMain, 0.15) }}>
                      <Eye className="w-5 h-5" style={{ color: accentMain }} />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Всего аренд</span>
                  </div>
                  <div className="text-3xl font-black" style={{ color: textPrimary }}>{totalRentals}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                    <Calendar className="w-3 h-3" />
                    За выбранный день
                  </div>
                </div>
              </div>

              {/* Revenue */}
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl blur-xl group-hover:blur-2xl transition-all" style={{ backgroundColor: withAlpha("#10b981", 0.12) }} />
                <div className="relative rounded-2xl p-5 border transition-all" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha("#10b981", 0.15) }}>
                      <TrendingUp className="w-5 h-5" style={{ color: "#34d399" }} />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Выручка</span>
                  </div>
                  <div className="text-3xl font-black" style={{ color: "#34d399" }}>{formatRubles(totalRevenue)}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                    <Zap className="w-3 h-3" />
                    Общий доход
                  </div>
                </div>
              </div>

              {/* Sales */}
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl blur-xl group-hover:blur-2xl transition-all" style={{ backgroundColor: withAlpha("#8b5cf6", 0.12) }} />
                <div className="relative rounded-2xl p-5 border transition-all" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha("#8b5cf6", 0.15) }}>
                      <TrendingUp className="w-5 h-5" style={{ color: "#a78bfa" }} />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Продажи</span>
                  </div>
                  <div className="text-3xl font-black" style={{ color: "#a78bfa" }}>{totalSales}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                    <Zap className="w-3 h-3" style={{ color: "#a78bfa" }} />
                    {formatRubles(salesRevenue)}
                  </div>
                </div>
              </div>

              {/* Active rentals */}
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl blur-xl group-hover:blur-2xl transition-all" style={{ backgroundColor: withAlpha("#3b82f6", 0.12) }} />
                <div className="relative rounded-2xl p-5 border transition-all" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha("#3b82f6", 0.15) }}>
                      <Clock className="w-5 h-5" style={{ color: "#60a5fa" }} />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Активных</span>
                  </div>
                  <div className="text-3xl font-black" style={{ color: "#60a5fa" }}>{activeRentals}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                    <Sparkles className="w-3 h-3" />
                    Сейчас на выезде
                  </div>
                </div>
              </div>

              {/* Completion rate */}
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl blur-xl group-hover:blur-2xl transition-all" style={{ backgroundColor: withAlpha(accentMain, 0.12) }} />
                <div className="relative rounded-2xl p-5 border transition-all" style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha(accentMain, 0.15) }}>
                      <CheckCircle2 className="w-5 h-5" style={{ color: accentMain }} />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Завершено</span>
                  </div>
                  <div className="text-3xl font-black" style={{ color: accentMain }}>{completionRate}%</div>
                  <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: textSecondary }}>
                    <CheckCircle2 className="w-3 h-3" />
                    {completedRentals} из {totalRentals}
                  </div>
                </div>
              </div>
            </div>

            {/* FILTER BAR */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              <span className="text-xs font-medium uppercase tracking-wider whitespace-nowrap" style={{ color: textSecondary }}>Фильтр:</span>
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
                    className="px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap"
                    style={
                      isActive
                        ? { background: withAlpha(accentMain, 0.15), borderColor: withAlpha(accentMain, 0.3), color: accentMain }
                        : { backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = withAlpha(borderSoft, 0.8);
                        e.currentTarget.style.color = textPrimary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = borderSoft;
                        e.currentTarget.style.color = textSecondary;
                      }
                    }}
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
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.3), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: withAlpha(borderSoft, 0.3) }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-sm font-bold" style={{ color: textPrimary }}>ВЫДАЧА</span>
                    <span style={{ color: textSecondary }}>→</span>
                  </div>
                  <span className="text-xs" style={{ color: textSecondary }}>
                    {checklistStates.handout?.items.filter(i => i.checked).length || 0} / {checklistStates.handout?.items.length || 0}
                  </span>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {checklistStates.handout?.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void toggleChecklistItem("handout", item.id)}
                      disabled={updatingChecklist === item.id}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap"
                      style={
                        item.checked
                          ? { backgroundColor: withAlpha("#10b981", 0.2), borderColor: withAlpha("#10b981", 0.3), color: "#34d399" }
                          : { backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }
                      }
                      onMouseEnter={(e) => {
                        if (!item.checked) {
                          e.currentTarget.style.borderColor = withAlpha(borderSoft, 0.8);
                          e.currentTarget.style.color = textPrimary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!item.checked) {
                          e.currentTarget.style.borderColor = borderSoft;
                          e.currentTarget.style.color = textSecondary;
                        }
                      }}
                    >
                      {item.checked && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Return checklist */}
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.3), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: withAlpha(borderSoft, 0.3) }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-sm font-bold" style={{ color: textPrimary }}>ВОЗВРАТ</span>
                    <span style={{ color: textSecondary }}>←</span>
                  </div>
                  <span className="text-xs" style={{ color: textSecondary }}>
                    {checklistStates.return?.items.filter(i => i.checked).length || 0} / {checklistStates.return?.items.length || 0}
                  </span>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {checklistStates.return?.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void toggleChecklistItem("return", item.id)}
                      disabled={updatingChecklist === item.id}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap"
                      style={
                        item.checked
                          ? { backgroundColor: withAlpha("#3b82f6", 0.2), borderColor: withAlpha("#3b82f6", 0.3), color: "#60a5fa" }
                          : { backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft, color: textSecondary }
                      }
                      onMouseEnter={(e) => {
                        if (!item.checked) {
                          e.currentTarget.style.borderColor = withAlpha(borderSoft, 0.8);
                          e.currentTarget.style.color = textPrimary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!item.checked) {
                          e.currentTarget.style.borderColor = borderSoft;
                          e.currentTarget.style.color = textSecondary;
                        }
                      }}
                    >
                      {item.checked && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Todos */}
              <div className="lg:col-span-2 rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.3), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: withAlpha(borderSoft, 0.3) }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentMain }} />
                    <span className="text-sm font-bold" style={{ color: textPrimary }}>ЗАДАЧИ</span>
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
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={
                          todoFilter === filter.value
                            ? { backgroundColor: withAlpha(accentMain, 0.2), color: accentMain }
                            : { color: textSecondary }
                        }
                        onMouseEnter={(e) => {
                          if (todoFilter !== filter.value) e.currentTarget.style.color = textPrimary;
                        }}
                        onMouseLeave={(e) => {
                          if (todoFilter !== filter.value) e.currentTarget.style.color = textSecondary;
                        }}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  {todos.length === 0 ? (
                    <div className="text-center py-6 text-sm" style={{ color: textSecondary }}>Нет активных задач</div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {todos.slice(0, 6).map((todo) => {
                        const statusColor =
                          todo.status === "done" ? "#10b981" :
                          todo.status === "in_progress" ? "#f59e0b" :
                          withAlpha(borderSoft, 2);
                        return (
                          <div
                            key={todo.id}
                            className="p-3 rounded-xl border transition-all"
                            style={{
                              backgroundColor: todo.status === "done" ? withAlpha("#10b981", 0.1) : todo.status === "in_progress" ? withAlpha("#f59e0b", 0.1) : withAlpha(bgCard, 0.5),
                              borderColor: todo.status === "done" ? withAlpha("#10b981", 0.2) : todo.status === "in_progress" ? withAlpha("#f59e0b", 0.2) : borderSoft,
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                                style={{
                                  backgroundColor: statusColor,
                                  animation: todo.status === "in_progress" ? "pulse 2s infinite" : undefined,
                                }}
                              />
                              <span className="text-sm" style={{ color: textPrimary }}>{todo.title}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RENTALS TABLE */}
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.3), borderColor: withAlpha(borderSoft, 0.5), backdropFilter: "blur(12px)" }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: withAlpha(borderSoft, 0.3) }}>
                <span className="text-sm font-bold" style={{ color: textPrimary }}>АРЕНДЫ</span>
              </div>

              {loading ? (
                <div className="p-12 text-center">
                  <div className="w-10 h-10 border-3 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: withAlpha(accentMain, 0.3), borderTopColor: accentMain }} />
                  <p className="text-sm" style={{ color: textSecondary }}>Загрузка...</p>
                </div>
              ) : rentals.length === 0 ? (
                <div className="p-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: borderSoft }} />
                  <p className="text-sm" style={{ color: textSecondary }}>Нет аренд за этот день</p>
                  <p className="text-xs mt-1" style={{ color: textSecondary }}>Выберите другую дату</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b" style={{ borderColor: withAlpha(borderSoft, 0.3) }}>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Время</th>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Клиент / Техника</th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Сумма</th>
                        <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Статус</th>
                        <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Док</th>
                        <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Одометр</th>
                        <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
                      {rentals.map((rental) => {
                        const statusStyle = statusConfig[rental.status as keyof typeof statusConfig] || statusConfig.pending_confirmation;
                        const StatusIcon = statusStyle.icon;
                        return (
                          <tr
                            key={rental.rental_id}
                            className="transition-colors"
                            style={{ backgroundColor: withAlpha(accentMain, 0.02) }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.05); }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.02); }}
                          >
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="text-sm font-mono" style={{ color: textPrimary }}>
                                {formatRussianDate(rental.agreed_start_date || rental.created_at).split(",")[1]?.trim() || "—"}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm font-medium" style={{ color: textPrimary }}>{rental.user?.full_name || rental.user?.username || "—"}</div>
                              <div className="text-xs mt-0.5" style={{ color: textSecondary }}>
                                {rental.vehicle?.make} {rental.vehicle?.model}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <span className="text-sm font-mono" style={{ color: "#34d399" }}>{formatRubles(rental.total_cost)}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                                style={{
                                  backgroundColor: withAlpha(statusStyle.color, 0.15),
                                  borderColor: withAlpha(statusStyle.color, 0.3),
                                  color: statusStyle.color,
                                }}
                              >
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusStyle.label}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="text-lg" style={{ color: rental.documentSecret ? "#34d399" : borderSoft }}>
                                {rental.documentSecret ? "✓" : "—"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {rental.odometerStart || rental.odometerEnd ? (
                                <span className="text-sm font-mono" style={{ color: "#34d399" }}>
                                  {rental.odometerStart || "?"}→{rental.odometerEnd || "?"}
                                </span>
                              ) : (
                                <span style={{ color: borderSoft }}>—</span>
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
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                  style={
                                    rental.handoutCompleted
                                      ? { backgroundColor: "#10b981", color: "white", boxShadow: `0 4px 12px ${withAlpha("#10b981", 0.3)}` }
                                      : { backgroundColor: withAlpha("#10b981", 0.15), borderColor: withAlpha("#10b981", 0.3), color: "#34d399", border: "1px solid" }
                                  }
                                >
                                  →
                                </button>
                                <button
                                  onClick={() => {
                                    setHandoffModalRental(rental);
                                    setHandoffModalPhase("return");
                                    setHandoffModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                  style={
                                    rental.returnCompleted
                                      ? { backgroundColor: "#3b82f6", color: "white", boxShadow: `0 4px 12px ${withAlpha("#3b82f6", 0.3)}` }
                                      : { backgroundColor: withAlpha("#3b82f6", 0.15), borderColor: withAlpha("#3b82f6", 0.3), color: "#60a5fa", border: "1px solid" }
                                  }
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

              {/* SALES LIST */}
              {sales.length > 0 && (
                <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.3), borderColor: withAlpha(borderSoft, 0.3) }}>
                  <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha("#8b5cf6", 0.15) }}>
                        <TrendingUp className="w-5 h-5" style={{ color: "#a78bfa" }} />
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: textPrimary }}>Продажи</h3>
                        <p className="text-xs" style={{ color: textSecondary }}>{totalSales} {totalSales === 1 ? "сделка" : totalSales > 1 && totalSales < 5 ? "сделки" : "сделок"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: "#a78bfa" }}>{formatRubles(salesRevenue)}</div>
                      <div className="text-xs" style={{ color: textSecondary }}>Общая сумма</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ backgroundColor: withAlpha(borderSoft, 0.1) }}>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Время</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Покупатель</th>
                          <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Мотоцикл</th>
                          <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Сумма</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
                        {sales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-opacity-50 transition-all" style={{ hoverBackgroundColor: withAlpha(accentMain, 0.05) }}>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium" style={{ color: textPrimary }}>{formatRussianDate(sale.created_at)}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium" style={{ color: textPrimary }}>{sale.buyer_full_name || "—"}</span>
                                {sale.buyer_email && (
                                  <span className="text-xs" style={{ color: textSecondary }}>{sale.buyer_email}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm font-medium" style={{ color: textPrimary }}>
                                {sale.vehicle ? `${sale.vehicle.make} ${sale.vehicle.model}` : "—"}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="text-sm font-bold" style={{ color: "#a78bfa" }}>{formatRubles(parseInt((sale.sale_price || "0").replace(/\s/g, ""), 10) || 0)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center py-4">
              <p className="text-xs" style={{ color: textSecondary }}>
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
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
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
          crewTheme={crew.theme}
        />
      )}
    </div>
  );
}
