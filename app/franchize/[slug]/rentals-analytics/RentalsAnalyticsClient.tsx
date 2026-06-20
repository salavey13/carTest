"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  User,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  IdCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  X,
  RefreshCw,
  QrCode,
  Send,
  ShieldCheck,
  ShieldAlert,
  Filter,
  Check,
  ListChecks,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Loading } from "@/components/Loading";
import { useAppContext } from "@/contexts/AppContext";
import {
  getRentalsDashboard,
  getRentalDocumentDetails,
  getRentalsDateRange,
  resendRentalContract,
  type RentalDashboardItem,
  type RentalDashboardSummary,
  type RentalDocumentDetail,
} from "@/app/franchize/server-actions/rentals-dashboard";
import {
  getAllChecklistStates,
  updateChecklistState,
  resetChecklistState,
  type ChecklistItem,
  type ChecklistState,
} from "@/app/franchize/server-actions/checklist";
import {
  crewPaletteForSurface,
  focusRingOutlineStyle,
  readablePaletteTextOnColor,
  withAlpha,
} from "@/app/franchize/lib/theme";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import {
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
} from "@/app/franchize/components/FranchizeOperatorSurface";

interface RentalsAnalyticsClientProps {
  initialSlug: string;
  initialDate: string;
  crew: FranchizeCrewVM;
}

// Format currency in Russian Rubles
const formatRubles = (amount: number | null | undefined): string => {
  if (amount == null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date in Russian format
const formatRussianDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: ru });
  } catch {
    return "—";
  }
};

// Format date only (no time)
const formatRussianDateOnly = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: ru });
  } catch {
    return "—";
  }
};

// Status badges
const statusConfig = {
  confirmed: {
    label: "Подтверждена",
    icon: CheckCircle2,
    color: "emerald",
  },
  active: {
    label: "Активна",
    icon: Clock,
    color: "blue",
  },
  completed: {
    label: "Завершена",
    icon: CheckCircle2,
    color: "green",
  },
  cancelled: {
    label: "Отменена",
    icon: XCircle,
    color: "rose",
  },
  pending_confirmation: {
    label: "Ожидает",
    icon: AlertCircle,
    color: "amber",
  },
  checkout_started: {
    label: "Оформление",
    icon: Clock,
    color: "slate",
  },
};

const paymentStatusConfig = {
  paid: {
    label: "Оплачено",
    color: "emerald",
  },
  pending: {
    label: "Ожидает",
    color: "amber",
  },
  failed: {
    label: "Ошибка",
    color: "rose",
  },
  refunded: {
    label: "Возврат",
    color: "purple",
  },
};

export function RentalsAnalyticsClient({
  initialSlug,
  initialDate,
  crew,
}: RentalsAnalyticsClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [verificationFilter, setVerificationFilter] = useState<"all" | "verified" | "pending" | "revoked">("all");
  const [rentals, setRentals] = useState<RentalDashboardItem[]>([]);
  const [summary, setSummary] = useState<RentalDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRental, setSelectedRental] = useState<RentalDashboardItem | null>(null);
  const [rentalDetails, setRentalDetails] = useState<RentalDocumentDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [dateRange, setDateRange] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [resending, setResending] = useState<string | null>(null); // rental_id being resent
  const [checklistStates, setChecklistStates] = useState<{ handout: ChecklistState | null; return: ChecklistState | null }>({
    handout: null,
    return: null,
  });
  const [updatingChecklist, setUpdatingChecklist] = useState<string | null>(null); // type being updated

  const slug = initialSlug?.trim() || "vip-bike";
  const surface = crewPaletteForSurface(crew.theme);
  const buttonFocus = focusRingOutlineStyle(crew.theme);
  const accentOn = readablePaletteTextOnColor(
    crew.theme.palette.accentMain,
    crew.theme.palette,
  );

  // Load rentals for selected date
  const loadRentals = useCallback(async (date: string, showRefresh = false) => {
    if (!dbUser?.user_id) return;

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getRentalsDashboard({
        slug,
        actorUserId: dbUser.user_id,
        date,
        verificationStatus: verificationFilter === "all" ? undefined : verificationFilter,
      });

      if (!result.success) {
        toast.error(result.error || "Не удалось загрузить аренды");
        return;
      }

      setRentals(result.data?.items || []);
      setSummary(result.data?.summary || null);
    } catch (error) {
      console.error("[RentalsAnalytics] Load error:", error);
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dbUser?.user_id, slug, verificationFilter]);

  // Load rental document details
  const loadRentalDetails = useCallback(async (rentalId: string) => {
    if (!dbUser?.user_id) return;

    setLoadingDetails(true);
    try {
      const result = await getRentalDocumentDetails({
        actorUserId: dbUser.user_id,
        rentalId,
      });

      if (!result.success) {
        toast.error(result.error || "Не удалось загрузить детали");
        return;
      }

      setRentalDetails(result.data || null);
    } catch (error) {
      console.error("[RentalsAnalytics] Details load error:", error);
      toast.error("Ошибка загрузки деталей");
    } finally {
      setLoadingDetails(false);
    }
  }, [dbUser?.user_id]);

  // Load date range
  const loadDateRange = useCallback(async () => {
    if (!dbUser?.user_id) return;

    try {
      const result = await getRentalsDateRange({
        slug,
        actorUserId: dbUser.user_id,
      });

      if (result.success && result.data) {
        setDateRange(result.data);
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Date range error:", error);
    }
  }, [dbUser?.user_id, slug]);

  // Load checklist states
  const loadChecklistStates = useCallback(async () => {
    if (!dbUser?.user_id) return;

    try {
      const result = await getAllChecklistStates({
        actorUserId: dbUser.user_id,
      });

      if (result.success && result.data) {
        setChecklistStates(result.data);
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Checklist load error:", error);
    }
  }, [dbUser?.user_id]);

  // Toggle checklist item
  const toggleChecklistItem = useCallback(async (type: "handout" | "return", itemId: string) => {
    if (!dbUser?.user_id) return;

    const currentState = checklistStates[type];
    if (!currentState) return;

    setUpdatingChecklist(type);
    try {
      const updatedItems = currentState.items.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      );

      const result = await updateChecklistState({
        actorUserId: dbUser.user_id,
        type,
        items: updatedItems,
        action: "toggle",
      });

      if (result.success && result.data) {
        setChecklistStates(prev => ({
          ...prev,
          [type]: result.data,
        }));
      } else {
        toast.error(result.error || "Не удалось обновить чеклист");
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Toggle checklist error:", error);
      toast.error("Ошибка обновления чеклиста");
    } finally {
      setUpdatingChecklist(null);
    }
  }, [dbUser?.user_id, checklistStates]);

  // Reset checklist
  const resetChecklist = useCallback(async (type: "handout" | "return") => {
    if (!dbUser?.user_id) return;

    setUpdatingChecklist(type);
    try {
      const result = await resetChecklistState({
        actorUserId: dbUser.user_id,
        type,
      });

      if (result.success && result.data) {
        setChecklistStates(prev => ({
          ...prev,
          [type]: result.data,
        }));
        toast.success("Чеклист сброшен");
      } else {
        toast.error(result.error || "Не удалось сбросить чеклист");
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Reset checklist error:", error);
      toast.error("Ошибка сброса чеклиста");
    } finally {
      setUpdatingChecklist(null);
    }
  }, [dbUser?.user_id]);

  // Initial load
  useEffect(() => {
    if (dbUser?.user_id) {
      void loadRentals(selectedDate);
      void loadDateRange();
      void loadChecklistStates();
    }
  }, [dbUser?.user_id, selectedDate, loadRentals, loadDateRange, loadChecklistStates]);

  // Reload when verification filter changes
  useEffect(() => {
    if (dbUser?.user_id) {
      void loadRentals(selectedDate);
    }
  }, [verificationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (dbUser?.user_id && !loading) {
        void loadRentals(selectedDate, true);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [dbUser?.user_id, selectedDate, loadRentals, loading]);

  // Resend contract handler
  const handleResendContract = useCallback(async (rental: RentalDashboardItem) => {
    if (!dbUser?.user_id || !rental.documentSecret?.doc_sha256) {
      toast.error("QR код недоступен для этой аренды");
      return;
    }

    setResending(rental.rental_id);
    try {
      // Prompt for target chat ID (could be the user's chat ID or admin)
      const targetChatId = rental.user?.metadata?.telegram_chat_id as string | undefined;
      const chatIdToSend = targetChatId || prompt("Введите ID чата Telegram для отправки:", rental.user_id);

      if (!chatIdToSend) {
        toast.error("ID чата не указан");
        return;
      }

      const result = await resendRentalContract({
        actorUserId: dbUser.user_id,
        rentalId: rental.rental_id,
        telegramChatId: chatIdToSend,
      });

      if (!result.success) {
        toast.error(result.error || "Не удалось отправить договор");
        return;
      }

      toast.success("Договор успешно отправлен");
    } catch (error) {
      console.error("[RentalsAnalytics] Resend error:", error);
      toast.error("Ошибка отправки");
    } finally {
      setResending(null);
    }
  }, [dbUser?.user_id]);

  // Navigate date
  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    const newDateStr = newDate.toISOString().split("T")[0];

    // Check date range bounds
    if (dateRange) {
      if (days < 0 && newDateStr < dateRange.minDate) return;
      if (days > 0 && newDateStr > dateRange.maxDate) return;
    }

    setSelectedDate(newDateStr);
    window.history.pushState(
      {},
      "",
      `/franchize/${slug}/rentals-analytics?date=${newDateStr}`,
    );
  };

  // Open rental details modal
  const openRentalDetails = (rental: RentalDashboardItem) => {
    setSelectedRental(rental);
    setRentalDetails(null);
    void loadRentalDetails(rental.rental_id);
  };

  // Close modal
  const closeModal = () => {
    setSelectedRental(null);
    setRentalDetails(null);
  };

  // Get status config
  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      icon: AlertCircle,
      color: "slate",
    };
  };

  if (authLoading) return <Loading text="Загружаем данные..." />;

  return (
    <div
      className="space-y-4"
      style={{
        ["--fr-analytics-accent" as string]: crew.theme.palette.accentMain,
        ["--fr-analytics-accent-hover" as string]: crew.theme.palette.accentMainHover,
        ["--fr-analytics-border" as string]: crew.theme.palette.borderSoft,
        ["--fr-analytics-text" as string]: crew.theme.palette.textPrimary,
        ["--fr-analytics-muted" as string]: crew.theme.palette.textSecondary,
        ["--fr-analytics-bg-card" as string]: crew.theme.palette.bgCard,
        ["--fr-analytics-bg-base" as string]: crew.theme.palette.bgBase,
      }}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-[var(--fr-analytics-accent)]">
            Аналитика аренд
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--fr-analytics-text)]">
            Аренды за день
          </h1>
          <p className="mt-1 text-sm text-[var(--fr-analytics-muted)]">
            Просмотр аренд с детальной информацией по документам
          </p>
        </div>

        {/* Date Picker */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigateDate(-1)}
            disabled={!dateRange || selectedDate <= dateRange.minDate || loading}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 rounded-lg border border-[var(--fr-analytics-border)] bg-[var(--fr-analytics-bg-card)] px-3 py-2">
            <Calendar className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
            <span className="text-sm font-medium text-[var(--fr-analytics-text)]">
              {formatRussianDateOnly(selectedDate)}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigateDate(1)}
            disabled={!dateRange || selectedDate >= dateRange.maxDate || loading}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setSelectedDate(today);
              window.history.pushState(
                {},
                "",
                `/franchize/${slug}/rentals-analytics?date=${today}`,
              );
            }}
            disabled={selectedDate === new Date().toISOString().split("T")[0] || loading}
            className="h-9 w-9"
            title="Сегодня"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <input
            type="date"
            value={selectedDate}
            min={dateRange?.minDate}
            max={dateRange?.maxDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              window.history.pushState(
                {},
                "",
                `/franchize/${slug}/rentals-analytics?date=${e.target.value}`,
              );
            }}
            className="h-9 rounded-md border border-[var(--fr-analytics-border)] bg-transparent px-3 py-1 text-sm text-[var(--fr-analytics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fr-analytics-accent)]"
          />
        </div>
      </div>

      {/* Verification Status Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
        <span className="text-sm text-[var(--fr-analytics-muted)]">Фильтр по верификации:</span>
        <div className="flex gap-1">
          {[
            { value: "all", label: "Все", icon: FileText },
            { value: "verified", label: "Проверены", icon: ShieldCheck },
            { value: "pending", label: "Ожидают", icon: Clock },
            { value: "revoked", label: "Отозваны", icon: ShieldAlert },
          ].map((filter) => {
            const Icon = filter.icon;
            const isActive = verificationFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setVerificationFilter(filter.value as typeof verificationFilter)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--fr-analytics-accent)] text-white"
                    : "bg-transparent text-[var(--fr-analytics-muted)] hover:bg-[var(--fr-analytics-accent)]/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FranchizeOperatorStatCard
            label="Всего аренд"
            value={summary.totalCount}
            detail={<FileText className="h-4 w-4 opacity-60" />}
          />
          <FranchizeOperatorStatCard
            label="Выручка"
            value={formatRubles(summary.totalRevenue)}
            detail={<CreditCard className="h-4 w-4 text-emerald-500" />}
          />
          <FranchizeOperatorStatCard
            label="Подтверждённые"
            value={summary.byStatus.confirmed || 0}
            detail={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          />
          <FranchizeOperatorStatCard
            label="Активные"
            value={summary.byStatus.active || 0}
            detail={<Clock className="h-4 w-4 text-blue-500" />}
          />
        </div>
      )}

      {/* Checklist Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Выдача Checklist */}
        <FranchizeOperatorPanel>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--fr-analytics-accent)]" />
              <p className="text-sm font-semibold text-[var(--fr-analytics-text)]">
                Выдача
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => resetChecklist("handout")}
              disabled={updatingChecklist === "handout"}
              title="Сбросить чеклист"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${updatingChecklist === "handout" ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {checklistStates.handout?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={updatingChecklist === "handout"}
                onClick={() => toggleChecklistItem("handout", item.id)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                  item.checked
                    ? "border-[var(--fr-analytics-accent)] bg-[var(--fr-analytics-accent)]/10"
                    : "border-[var(--fr-analytics-border)] hover:bg-[var(--fr-analytics-accent)]/5"
                }`}
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  item.checked
                    ? "border-[var(--fr-analytics-accent)] bg-[var(--fr-analytics-accent)]"
                    : "border-[var(--fr-analytics-muted)]"
                }`}>
                  {item.checked && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className={item.checked ? "text-[var(--fr-analytics-text)]" : "text-[var(--fr-analytics-muted)]"}>
                  {item.text}
                </span>
              </button>
            )) || <p className="py-4 text-center text-xs text-[var(--fr-analytics-muted)]">Загрузка...</p>}
          </div>
        </FranchizeOperatorPanel>

        {/* Возврат Checklist */}
        <FranchizeOperatorPanel>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--fr-analytics-accent)]" />
              <p className="text-sm font-semibold text-[var(--fr-analytics-text)]">
                Возврат
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => resetChecklist("return")}
              disabled={updatingChecklist === "return"}
              title="Сбросить чеклист"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${updatingChecklist === "return" ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {checklistStates.return?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={updatingChecklist === "return"}
                onClick={() => toggleChecklistItem("return", item.id)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                  item.checked
                    ? "border-[var(--fr-analytics-accent)] bg-[var(--fr-analytics-accent)]/10"
                    : "border-[var(--fr-analytics-border)] hover:bg-[var(--fr-analytics-accent)]/5"
                }`}
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  item.checked
                    ? "border-[var(--fr-analytics-accent)] bg-[var(--fr-analytics-accent)]"
                    : "border-[var(--fr-analytics-muted)]"
                }`}>
                  {item.checked && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className={item.checked ? "text-[var(--fr-analytics-text)]" : "text-[var(--fr-analytics-muted)]"}>
                  {item.text}
                </span>
              </button>
            )) || <p className="py-4 text-center text-xs text-[var(--fr-analytics-muted)]">Загрузка...</p>}
          </div>
        </FranchizeOperatorPanel>
      </div>

      {/* Rentals List */}
      <FranchizeOperatorPanel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--fr-analytics-text)]">
              Список аренд
            </p>
            <p className="mt-1 text-xs text-[var(--fr-analytics-muted)]">
              Нажмите на аренду для просмотра деталей
            </p>
          </div>
          {refreshing && (
            <RefreshCw className="h-4 w-4 animate-spin text-[var(--fr-analytics-muted)]" />
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading text="Загружаем аренды..." />
          </div>
        ) : !rentals.length ? (
          <p className="py-12 text-center text-sm text-[var(--fr-analytics-muted)]">
            За этот день аренд нет
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: "var(--fr-analytics-border)" }}>
            {/* Table Header */}
            <div className="hidden grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1.2fr] gap-3 border-b px-4 py-3 text-xs font-semibold text-[var(--fr-analytics-muted)] md:grid" style={{ borderColor: "var(--fr-analytics-border)" }}>
              <span>Время</span>
              <span>Клиент / Техника</span>
              <span>Сумма</span>
              <span>Статус</span>
              <span>Документы</span>
              <span className="text-right">Действия</span>
            </div>

            {/* Table Body */}
            <div className="divide-y" style={{ borderColor: "var(--fr-analytics-border)" }}>
              {rentals.map((rental) => {
                const statusConf = getStatusConfig(rental.status);
                const StatusIcon = statusConf.icon;
                const vehicleName = rental.vehicle
                  ? `${rental.vehicle.make} ${rental.vehicle.model}`
                  : "Неизвестно";

                const hasQrCode = !!rental.documentSecret?.doc_sha256;
                const verificationStatus = rental.documentSecret?.verification_status || "none";

                return (
                  <div
                    key={rental.rental_id}
                    className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1.2fr] md:items-center hover:bg-[var(--fr-analytics-accent)]/5 cursor-pointer transition-colors"
                    onClick={() => openRentalDetails(rental)}
                  >
                    {/* Time */}
                    <div className="text-[var(--fr-analytics-text)]">
                      <span className="md:hidden text-xs text-[var(--fr-analytics-muted)]">Время: </span>
                      {formatRussianDate(rental.created_at)?.split(",")?.[1] || "—"}
                    </div>

                    {/* Client / Vehicle */}
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-[var(--fr-analytics-muted)]" />
                        <span className="font-medium text-[var(--fr-analytics-text)]">
                          {rental.user?.full_name || rental.user?.username || `Пользователь #${rental.user_id.slice(0, 8)}`}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--fr-analytics-muted)]">
                        {vehicleName}
                      </div>
                    </div>

                    {/* Sum */}
                    <div className="font-medium text-[var(--fr-analytics-text)]">
                      <span className="md:hidden text-xs text-[var(--fr-analytics-muted)]">Сумма: </span>
                      {formatRubles(rental.total_cost)}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={`h-3.5 w-3.5 text-${statusConf.color}-500`} />
                      <span className="text-xs text-[var(--fr-analytics-muted)] md:text-[var(--fr-analytics-text)]">
                        {statusConf.label}
                      </span>
                    </div>

                    {/* Documents */}
                    <div className="flex items-center gap-2">
                      {hasQrCode && (
                        <div className="flex items-center gap-1 text-emerald-600" title="QR код доступен">
                          <QrCode className="h-3.5 w-3.5" />
                          <span className="text-xs">QR</span>
                        </div>
                      )}
                      {verificationStatus === "verified" && (
                        <div className="flex items-center gap-1 text-emerald-600" title="Документы проверены">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </div>
                      )}
                      {verificationStatus === "pending" && (
                        <div className="flex items-center gap-1 text-amber-600" title="Ожидает проверки">
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                      )}
                      {verificationStatus === "revoked" && (
                        <div className="flex items-center gap-1 text-rose-600" title="Документы отозваны">
                          <ShieldAlert className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {hasQrCode && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleResendContract(rental)}
                          disabled={resending === rental.rental_id}
                          title="Отправить договор + QR"
                        >
                          {resending === rental.rental_id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Отправить</span>
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRentalDetails(rental);
                        }}
                      >
                        Подробнее
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </FranchizeOperatorPanel>

      {/* Rental Details Modal */}
      {selectedRental && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border p-6 shadow-2xl"
            style={{
              borderColor: "var(--fr-analytics-border)",
              backgroundColor: "var(--fr-analytics-bg-card)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--fr-analytics-text)]">
                  Детали аренды
                </h2>
                <p className="mt-1 text-xs text-[var(--fr-analytics-muted)]">
                  #{selectedRental.rental_id.slice(0, 8)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeModal}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Rental Info */}
            <div className="mt-4 space-y-4">
              {/* Vehicle */}
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Техника</p>
                <p className="mt-1 text-sm font-semibold text-[var(--fr-analytics-text)]">
                  {selectedRental.vehicle
                    ? `${selectedRental.vehicle.make} ${selectedRental.vehicle.model}`
                    : "Неизвестно"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--fr-analytics-muted)]">
                  ID: {selectedRental.vehicle_id}
                </p>
              </div>

              {/* Customer */}
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
                  <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Клиент</p>
                </div>
                <p className="mt-1 text-sm font-semibold text-[var(--fr-analytics-text)]">
                  {selectedRental.user?.full_name || selectedRental.user?.username || `Пользователь #${selectedRental.user_id.slice(0, 8)}`}
                </p>
                <p className="mt-0.5 text-xs text-[var(--fr-analytics-muted)]">
                  ID: {selectedRental.user_id}
                </p>
              </div>

              {/* Dates */}
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Даты аренды</p>
                <div className="mt-2 space-y-1 text-sm text-[var(--fr-analytics-text)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--fr-analytics-muted)]">Начало:</span>
                    <span>{formatRussianDate(selectedRental.agreed_start_date || selectedRental.requested_start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--fr-analytics-muted)]">Конец:</span>
                    <span>{formatRussianDate(selectedRental.agreed_end_date || selectedRental.requested_end_date)}</span>
                  </div>
                </div>
              </div>

              {/* Cost */}
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Стоимость</p>
                <p className="mt-1 text-xl font-bold text-[var(--fr-analytics-accent)]">
                  {formatRubles(selectedRental.total_cost)}
                </p>
              </div>

              {/* Document Details */}
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loading text="Загружаем документы..." />
                </div>
              ) : rentalDetails?.secret ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">
                    Данные из документов
                  </p>

                  {/* Personal Info */}
                  {rentalDetails.secret.renter_full_name && (
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                      <div className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
                        <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">ФИО</p>
                      </div>
                      <p className="mt-1 text-sm text-[var(--fr-analytics-text)]">
                        {rentalDetails.secret.renter_full_name}
                      </p>
                    </div>
                  )}

                  {/* Passport */}
                  {rentalDetails.secret.renter_passport && (
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                      <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Паспорт</p>
                      <div className="mt-1 space-y-1 text-sm text-[var(--fr-analytics-text)]">
                        <p>Серия/номер: {rentalDetails.secret.renter_passport}</p>
                        {rentalDetails.secret.renter_passport_issue_date && (
                          <p className="text-xs text-[var(--fr-analytics-muted)]">
                            Выдан: {rentalDetails.secret.renter_passport_issue_date}
                          </p>
                        )}
                        {rentalDetails.secret.renter_birth_date && (
                          <p className="text-xs text-[var(--fr-analytics-muted)]">
                            Дата рождения: {rentalDetails.secret.renter_birth_date}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Registration */}
                  {rentalDetails.secret.renter_registration && (
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
                        <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Прописка</p>
                      </div>
                      <p className="mt-1 text-sm text-[var(--fr-analytics-text)]">
                        {rentalDetails.secret.renter_registration}
                      </p>
                    </div>
                  )}

                  {/* Driver License */}
                  {rentalDetails.secret.renter_driver_license && (
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                      <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Водительское удостоверение</p>
                      <p className="mt-1 text-sm text-[var(--fr-analytics-text)]">
                        {rentalDetails.secret.renter_driver_license}
                      </p>
                    </div>
                  )}

                  {/* Contact */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {rentalDetails.secret.renter_phone && (
                      <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
                          <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Телефон</p>
                        </div>
                        <p className="mt-1 text-sm text-[var(--fr-analytics-text)]">
                          {rentalDetails.secret.renter_phone}
                        </p>
                      </div>
                    )}
                    {rentalDetails.secret.renter_email && (
                      <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
                          <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Email</p>
                        </div>
                        <p className="mt-1 text-sm text-[var(--fr-analytics-text)]">
                          {rentalDetails.secret.renter_email}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  {rentalDetails.secret.renter_address && (
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
                        <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Адрес</p>
                      </div>
                      <p className="mt-1 text-sm text-[var(--fr-analytics-text)]">
                        {rentalDetails.secret.renter_address}
                      </p>
                    </div>
                  )}

                  {/* Contract Verifier */}
                  {rentalDetails.contractVerifier && (
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                      <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Статус договора</p>
                      <div className="mt-2 flex items-center gap-2">
                        {rentalDetails.contractVerifier.status === "verified" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-sm text-[var(--fr-analytics-text)]">
                          {rentalDetails.contractVerifier.status === "verified"
                            ? "Проверен"
                            : rentalDetails.contractVerifier.status}
                        </span>
                      </div>
                      {rentalDetails.contractVerifier.verifiedAt && (
                        <p className="mt-1 text-xs text-[var(--fr-analytics-muted)]">
                          Проверен: {formatRussianDate(rentalDetails.contractVerifier.verifiedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Doc SHA256 */}
                  {rentalDetails.secret.doc_sha256 && (
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--fr-analytics-border)" }}>
                      <p className="text-xs font-medium text-[var(--fr-analytics-muted)]">Хэш документа</p>
                      <p className="mt-1 text-xs font-mono text-[var(--fr-analytics-muted)] break-all">
                        {rentalDetails.secret.doc_sha256}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--fr-analytics-border)" }}>
                  <p className="text-sm text-[var(--fr-analytics-muted)]">
                    Данные из документов не найдены
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                className="h-9"
              >
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
