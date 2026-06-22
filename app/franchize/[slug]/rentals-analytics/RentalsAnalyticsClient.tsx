"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Plus,
  MoreVertical,
  Trash2,
  Monitor,
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
  type RentalDashboardItem,
  type RentalDashboardSummary,
  type RentalDocumentDetail,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { useSupabaseRealtime } from "@/app/franchize/hooks/useSupabaseRealtime";
import { ConnectionStatus } from "./ConnectionStatus";
import { ExportModal } from "./ExportModal";
import {
  getAllChecklistStates,
  updateChecklistState,
  resetChecklistState,
  type ChecklistItem,
  type ChecklistState,
} from "@/app/franchize/server-actions/checklist";
import {
  getCrewTodos,
  getCrewMembersForTodos,
  createCrewTodo,
  updateCrewTodo,
  deleteCrewTodo,
  getCrewTodoStats,
  DEFAULT_TODO_CATEGORIES,
  type CrewTodo,
  type TodoStatus,
} from "@/app/franchize/server-actions/crew-todos";
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
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date in Russian format
const formatRussianDate = (dateStr: string | null, includeTime = true): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), includeTime ? "dd MMM yyyy, HH:mm" : "dd MMM yyyy", { locale: ru });
  } catch {
    return "—";
  }
};

// Format date only (no time) - convenience wrapper
const formatRussianDateOnly = (dateStr: string | null): string => formatRussianDate(dateStr, false);

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

// Filter configurations (outside component to avoid recreation on each render)
const VERIFICATION_FILTERS = [
  { value: "all", label: "Все", icon: FileText },
  { value: "verified", label: "Проверены", icon: ShieldCheck },
  { value: "pending", label: "Ожидают", icon: Clock },
  { value: "revoked", label: "Отозваны", icon: ShieldAlert },
] as const;

const TODO_STATUS_FILTERS = [
  { value: "all" as const, label: "Все" },
  { value: "pending" as const, label: "Ожидают" },
  { value: "in_progress" as const, label: "В работе" },
  { value: "done" as const, label: "Выполнено" },
];

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

  // Crew todos state
  const [todos, setTodos] = useState<CrewTodo[]>([]);
  const [todoStats, setTodoStats] = useState<{
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    byAssignee: Array<{ userId: string; userName: string | null; pending: number; inProgress: number; done: number }>;
    overdue: number;
  } | null>(null);
  const [crewMembers, setCrewMembers] = useState<Array<{ user_id: string; full_name: string | null; username: string | null }>>([]);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [todoFilter, setTodoFilter] = useState<TodoStatus | "all">("all");
  const [todoAssigneeFilter, setTodoAssigneeFilter] = useState<string | "all">("all");
  const [showCreateTodo, setShowCreateTodo] = useState(false);
  const [creatingTodo, setCreatingTodo] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDescription, setNewTodoDescription] = useState("");
  const [newTodoCategory, setNewTodoCategory] = useState("general");
  const [newTodoPriority, setNewTodoPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTodoAssignedTo, setNewTodoAssignedTo] = useState<string | null>(null);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  // Real-time subscriptions for crew_todos and checklist_state
  const todosRealtime = useSupabaseRealtime({
    tableName: "crew_todos",
    filter: crew.id ? `crew_id=eq.${crew.id}` : undefined,
    onData: () => {
      // Reload todos when changes occur
      void loadTodos();
    },
    onError: (error) => {
      console.error("[RentalsAnalytics] Todos realtime error:", error);
    },
  });

  const checklistRealtime = useSupabaseRealtime({
    tableName: "checklist_state",
    onData: () => {
      // Reload checklist when changes occur
      void loadChecklistStates();
    },
    onError: (error) => {
      console.error("[RentalsAnalytics] Checklist realtime error:", error);
    },
  });

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
      } else {
        toast.error(result.error || "Не удалось загрузить диапазон дат");
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Date range error:", error);
      toast.error("Ошибка загрузки диапазона дат");
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
      } else {
        toast.error(result.error || "Не удалось загрузить чеклисты");
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Checklist load error:", error);
      toast.error("Ошибка загрузки чеклистов");
    }
  }, [dbUser?.user_id]);

  // Load crew todos
  const loadTodos = useCallback(async () => {
    if (!dbUser?.user_id || !crew.id) return;

    setLoadingTodos(true);
    try {
      const [todosResult, statsResult, membersResult] = await Promise.all([
        getCrewTodos({
          actorUserId: dbUser.user_id,
          crewId: crew.id,
          status: todoFilter === "all" ? undefined : todoFilter,
          assignedTo: todoAssigneeFilter === "all" ? undefined : todoAssigneeFilter,
        }),
        getCrewTodoStats({
          actorUserId: dbUser.user_id,
          crewId: crew.id,
        }),
        getCrewMembersForTodos({
          actorUserId: dbUser.user_id,
          crewId: crew.id,
        }),
      ]);

      if (todosResult.success) {
        setTodos(todosResult.data || []);
      }
      if (statsResult.success) {
        setTodoStats(statsResult.data || null);
      }
      if (membersResult.success) {
        setCrewMembers(membersResult.data || []);
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Todos load error:", error);
    } finally {
      setLoadingTodos(false);
    }
  }, [dbUser?.user_id, crew.id, todoFilter, todoAssigneeFilter]);

  // Create todo
  const handleCreateTodo = useCallback(async () => {
    if (!dbUser?.user_id || !crew.id || !newTodoTitle.trim()) {
      toast.error("Введите название задачи");
      return;
    }

    setCreatingTodo(true);
    try {
      const result = await createCrewTodo({
        actorUserId: dbUser.user_id,
        todo: {
          crewId: crew.id,
          assignedTo: newTodoAssignedTo,
          title: newTodoTitle.trim(),
          description: newTodoDescription.trim() || undefined,
          category: newTodoCategory,
          priority: newTodoPriority,
        },
      });

      if (result.success) {
        toast.success("Задача создана");
        setNewTodoTitle("");
        setNewTodoDescription("");
        setNewTodoCategory("general");
        setNewTodoPriority("medium");
        setNewTodoAssignedTo(null);
        setShowCreateTodo(false);
        void loadTodos();
      } else {
        toast.error(result.error || "Не удалось создать задачу");
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Create todo error:", error);
      toast.error("Ошибка создания задачи");
    } finally {
      setCreatingTodo(false);
    }
  }, [dbUser?.user_id, crew.id, newTodoTitle, newTodoDescription, newTodoCategory, newTodoPriority, newTodoAssignedTo, loadTodos]);

  // Update todo status
  const updateTodoStatus = useCallback(async (todo: CrewTodo, newStatus: TodoStatus) => {
    if (!dbUser?.user_id || !crew.id) return;

    try {
      const result = await updateCrewTodo({
        actorUserId: dbUser.user_id,
        crewId: crew.id,
        todo: {
          id: todo.id,
          status: newStatus,
        },
      });

      if (result.success) {
        void loadTodos();
      } else {
        toast.error(result.error || "Не удалось обновить задачу");
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Update todo error:", error);
      toast.error("Ошибка обновления задачи");
    }
  }, [dbUser?.user_id, crew.id, loadTodos]);

  // Delete todo
  const handleDeleteTodo = useCallback(async (todoId: string) => {
    if (!dbUser?.user_id || !crew.id) return;

    try {
      const result = await deleteCrewTodo({
        actorUserId: dbUser.user_id,
        crewId: crew.id,
        todoId,
      });

      if (result.success) {
        toast.success("Задача удалена");
        void loadTodos();
      } else {
        toast.error(result.error || "Не удалось удалить задачу");
      }
    } catch (error) {
      console.error("[RentalsAnalytics] Delete todo error:", error);
      toast.error("Ошибка удаления задачи");
    }
  }, [dbUser?.user_id, crew.id, loadTodos]);

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
      void loadTodos();
    }
  }, [dbUser?.user_id, selectedDate, loadRentals, loadDateRange, loadChecklistStates, loadTodos]);

  // Reload when verification filter changes
  useEffect(() => {
    if (dbUser?.user_id) {
      void loadRentals(selectedDate);
    }
  }, [verificationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const navigateDate = useCallback((days: number) => {
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
  }, [selectedDate, dateRange, slug]);

  // Open rental details modal
  const openRentalDetails = useCallback((rental: RentalDashboardItem) => {
    setSelectedRental(rental);
    setRentalDetails(null);
    void loadRentalDetails(rental.rental_id);
  }, [loadRentalDetails]);

  // Close modal
  const closeModal = useCallback(() => {
    setSelectedRental(null);
    setRentalDetails(null);
  }, []);

  // Export handler
  const handleExport = useCallback(async (startDate: string, endDate: string) => {
    if (!dbUser?.user_id) return;

    setExporting(true);
    try {
      const result = await getRentalsForExport({
        slug,
        actorUserId: dbUser.user_id,
        startDate,
        endDate,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || "Не удалось загрузить данные для экспорта");
        return;
      }

      // Convert data to Excel format
      const exportData = result.data.map((row, index) => ({
        "#": index + 1,
        "ID аренды": row.rental_id.slice(0, 8),
        "Дата создания": formatRussianDate(row.created_at),
        "Начало аренды": formatRussianDateOnly(row.agreed_start_date),
        "Конец аренды": formatRussianDateOnly(row.agreed_end_date),
        "Стоимость": formatRubles(row.total_cost),
        "Статус": statusConfig[row.status as keyof typeof statusConfig]?.label || row.status,
        "Оплата": paymentStatusConfig[row.payment_status as keyof typeof paymentStatusConfig]?.label || row.payment_status || "—",
        "Техника": `${row.vehicle_make} ${row.vehicle_model}`.trim(),
        "Тип техники": row.vehicle_type,
        "Клиент": row.user_full_name || row.user_username || `ID: ${row.rental_id.slice(0, 8)}`,
        "Чеклист": row.checklist_status === "not_started" ? "Не начат" : row.checklist_status,
        "Чеклист обновлен": formatRussianDate(row.checklist_updated_at),
        "Задачи ожидают": row.todos_pending,
        "Задачи в работе": row.todos_in_progress,
        "Задачи выполнено": row.todos_done,
        "Документ проверен": row.document_verified ? "Да" : "Нет",
      }));

      // Create workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Аренды");

      // Generate filename
      const filename = `rentals-export-${startDate}-to-${endDate}.xlsx`;

      // Download
      XLSX.writeFile(workbook, filename);

      toast.success("Экспорт завершен");
    } catch (error) {
      console.error("[RentalsAnalytics] Export error:", error);
      toast.error("Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  }, [dbUser?.user_id, slug]);

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
      className={`space-y-4 ${compactMode ? "text-xs" : ""}`}
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
      <div className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${compactMode ? "gap-2" : ""}`}>
        {/* Connection Status */}
        <div className={`flex items-center gap-3 ${compactMode ? "gap-1" : ""}`}>
          <ConnectionStatus status={todosRealtime.state.status} />
          <ConnectionStatus status={checklistRealtime.state.status} />
        </div>
        <div>
          <p className={`font-medium tracking-wide text-[var(--fr-analytics-accent)] ${compactMode ? "text-[10px]" : "text-xs"}`}>
            Аналитика аренд
          </p>
          <h1 className={`mt-2 break-words font-semibold text-[var(--fr-analytics-text)] ${compactMode ? "text-base" : "text-2xl"}`}>
            Аренды за день
          </h1>
          <p className={`mt-1 text-[var(--fr-analytics-muted)] ${compactMode ? "text-[10px] hidden" : "text-sm"}`}>
            Просмотр аренд с детальной информацией по документам
          </p>
        </div>

        {/* Date Picker */}
        <div className={`flex items-center gap-2 ${compactMode ? "gap-1" : ""}`}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigateDate(-1)}
            disabled={!dateRange || selectedDate <= dateRange.minDate || loading}
            className={compactMode ? "h-7 w-7" : "h-9 w-9"}
          >
            <ChevronLeft className={compactMode ? "h-3 w-3" : "h-4 w-4"} />
          </Button>

          <div className={`flex items-center rounded-lg border border-[var(--fr-analytics-border)] bg-[var(--fr-analytics-bg-card)] ${compactMode ? "gap-1 px-2 py-1" : "gap-2 px-3 py-2"}`}>
            <Calendar className={`text-[var(--fr-analytics-muted)] ${compactMode ? "h-3 w-3" : "h-4 w-4"}`} />
            <span className={`font-medium text-[var(--fr-analytics-text)] ${compactMode ? "text-xs" : "text-sm"}`}>
              {formatRussianDateOnly(selectedDate)}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigateDate(1)}
            disabled={!dateRange || selectedDate >= dateRange.maxDate || loading}
            className={compactMode ? "h-7 w-7" : "h-9 w-9"}
          >
            <ChevronRight className={compactMode ? "h-3 w-3" : "h-4 w-4"} />
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
            className={compactMode ? "h-7 w-7" : "h-9 w-9"}
            title="Сегодня"
          >
            <RefreshCw className={compactMode ? "h-3 w-3" : "h-4 w-4"} />
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
            className={`rounded-md border border-[var(--fr-analytics-border)] bg-transparent text-[var(--fr-analytics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fr-analytics-accent)] ${compactMode ? "h-7 px-2 py-1 text-xs" : "h-9 px-3 py-1 text-sm"}`}
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowExportModal(true)}
            disabled={!dateRange}
            className={compactMode ? "h-7 w-7" : "h-9 w-9"}
            title="Экспорт в Excel"
          >
            <Download className={compactMode ? "h-3 w-3" : "h-4 w-4"} />
          </Button>

          <Button
            type="button"
            variant={compactMode ? "default" : "outline"}
            size="icon"
            onClick={() => setCompactMode(!compactMode)}
            className={compactMode ? "h-7 bg-[var(--fr-analytics-accent)] text-white hover:bg-[var(--fr-analytics-accent-hover)]" : "h-9 w-9"}
            title={compactMode ? "Обычный режим" : "Компактный режим"}
          >
            <Monitor className={compactMode ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {/* Verification Status Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-[var(--fr-analytics-muted)]" />
        <span className="text-sm text-[var(--fr-analytics-muted)]">Фильтр по верификации:</span>
        <div className="flex gap-1">
          {VERIFICATION_FILTERS.map((filter) => {
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
        <div className={`grid sm:grid-cols-2 lg:grid-cols-4 ${compactMode ? "gap-2" : "gap-3"}`}>
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
      <div className={`grid md:grid-cols-2 ${compactMode ? "gap-2" : "gap-4"}`}>
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
          <div className={`space-y-2 ${compactMode ? "mt-2 space-y-1" : "mt-3 space-y-2"}`}>
            {checklistStates.handout?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={updatingChecklist === "handout"}
                onClick={() => toggleChecklistItem("handout", item.id)}
                className={`flex w-full items-center rounded-lg border text-left transition-all ${
                  item.checked
                    ? "border-[var(--fr-analytics-accent)] bg-[var(--fr-analytics-accent)]/10"
                    : "border-[var(--fr-analytics-border)] hover:bg-[var(--fr-analytics-accent)]/5"
                } ${compactMode ? "gap-1 px-2 py-1 text-xs" : "gap-2 px-3 py-2 text-sm"}`}
              >
                <div className={`flex shrink-0 items-center justify-center rounded border transition-colors ${
                  item.checked
                    ? "border-[var(--fr-analytics-accent)] bg-[var(--fr-analytics-accent)]"
                    : "border-[var(--fr-analytics-muted)]"
                } ${compactMode ? "h-3 w-3" : "h-4 w-4"}`}>
                  {item.checked && <Check className={compactMode ? "h-2 w-2" : "h-3 w-3"} text-white />}
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
          <div className={`space-y-2 ${compactMode ? "mt-2 space-y-1" : "mt-3 space-y-2"}`}>
            {checklistStates.return?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={updatingChecklist === "return"}
                onClick={() => toggleChecklistItem("return", item.id)}
                className={`flex w-full items-center rounded-lg border text-left transition-all ${
                  item.checked
                    ? "border-[var(--fr-analytics-accent)] bg-[var(--fr-analytics-accent)]/10"
                    : "border-[var(--fr-analytics-border)] hover:bg-[var(--fr-analytics-accent)]/5"
                } ${compactMode ? "gap-1 px-2 py-1 text-xs" : "gap-2 px-3 py-2 text-sm"}`}
              >
                <div className={`flex shrink-0 items-center justify-center rounded border transition-colors ${
                  item.checked
                    ? "border-[var(--fr-analytics-accent)] bg-[var(--fr-analytics-accent)]"
                    : "border-[var(--fr-analytics-muted)]"
                } ${compactMode ? "h-3 w-3" : "h-4 w-4"}`}>
                  {item.checked && <Check className={compactMode ? "h-2 w-2" : "h-3 w-3"} text-white />}
                </div>
                <span className={item.checked ? "text-[var(--fr-analytics-text)]" : "text-[var(--fr-analytics-muted)]"}>
                  {item.text}
                </span>
              </button>
            )) || <p className="py-4 text-center text-xs text-[var(--fr-analytics-muted)]">Загрузка...</p>}
          </div>
        </FranchizeOperatorPanel>
      </div>

      {/* Crew Todos Section */}
      <FranchizeOperatorPanel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[var(--fr-analytics-accent)]" />
            <p className="text-sm font-semibold text-[var(--fr-analytics-text)]">
              Задачи экипажа
            </p>
            {todoStats && (
              <span className="ml-2 flex gap-2">
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                  {todoStats.pending} ожидают
                </span>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                  {todoStats.inProgress} в работе
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                  {todoStats.done} выполнено
                </span>
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setShowCreateTodo(!showCreateTodo)}
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1">Новая задача</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--fr-analytics-muted)]">Фильтр:</span>
          <div className="flex gap-1">
            {TODO_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setTodoFilter(filter.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  todoFilter === filter.value
                    ? "bg-[var(--fr-analytics-accent)] text-white"
                    : "bg-transparent text-[var(--fr-analytics-muted)] hover:bg-[var(--fr-analytics-accent)]/10"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {todoStats?.byAssignee && todoStats.byAssignee.length > 0 && (
            <>
              <span className="ml-2 text-xs text-[var(--fr-analytics-muted)]">Исполнитель:</span>
              <select
                value={todoAssigneeFilter}
                onChange={(e) => setTodoAssigneeFilter(e.target.value)}
                className="rounded-md border border-[var(--fr-analytics-border)] bg-transparent px-2 py-1 text-xs text-[var(--fr-analytics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fr-analytics-accent)]"
              >
                <option value="all">Все</option>
                <option value="unassigned">Не назначен</option>
                {todoStats.byAssignee.map((assignee) => (
                  <option key={assignee.userId} value={assignee.userId}>
                    {assignee.userName || assignee.userId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Create Todo Form */}
        {showCreateTodo && (
          <div className="rounded-lg border border-[var(--fr-analytics-border)] bg-[var(--fr-analytics-bg-base)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Название задачи *"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                className="rounded-md border border-[var(--fr-analytics-border)] bg-transparent px-3 py-2 text-sm text-[var(--fr-analytics-text)] placeholder:text-[var(--fr-analytics-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--fr-analytics-accent)]"
                maxLength={200}
              />
              <select
                value={newTodoAssignedTo || ""}
                onChange={(e) => setNewTodoAssignedTo(e.target.value || null)}
                className="rounded-md border border-[var(--fr-analytics-border)] bg-transparent px-3 py-2 text-sm text-[var(--fr-analytics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fr-analytics-accent)]"
              >
                <option value="">Не назначен</option>
                {crewMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.full_name || member.username || member.user_id}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Описание (необязательно)"
                value={newTodoDescription}
                onChange={(e) => setNewTodoDescription(e.target.value)}
                className="sm:col-span-2 min-h-[60px] rounded-md border border-[var(--fr-analytics-border)] bg-transparent px-3 py-2 text-sm text-[var(--fr-analytics-text)] placeholder:text-[var(--fr-analytics-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--fr-analytics-accent)]"
                rows={2}
              />
              <select
                value={newTodoCategory}
                onChange={(e) => setNewTodoCategory(e.target.value)}
                className="rounded-md border border-[var(--fr-analytics-border)] bg-transparent px-3 py-2 text-sm text-[var(--fr-analytics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fr-analytics-accent)]"
              >
                {DEFAULT_TODO_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <select
                value={newTodoPriority}
                onChange={(e) => setNewTodoPriority(e.target.value as "low" | "medium" | "high")}
                className="rounded-md border border-[var(--fr-analytics-border)] bg-transparent px-3 py-2 text-sm text-[var(--fr-analytics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--fr-analytics-accent)]"
              >
                <option value="low">Низкий приоритет</option>
                <option value="medium">Средний приоритет</option>
                <option value="high">Высокий приоритет</option>
              </select>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setShowCreateTodo(false)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleCreateTodo}
                disabled={!newTodoTitle.trim() || creatingTodo}
              >
                {creatingTodo ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span className="ml-1">Создать</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Todos List */}
        {loadingTodos ? (
          <div className="flex items-center justify-center py-8">
            <Loading text="Загружаем задачи..." />
          </div>
        ) : !todos.length ? (
          <div className="py-8 text-center">
            <ListChecks className="mx-auto h-8 w-8 text-[var(--fr-analytics-muted)] opacity-50" />
            <p className="mt-2 text-sm text-[var(--fr-analytics-muted)]">
              Нет активных задач
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {todos.map((todo) => {
              const categoryLabel = DEFAULT_TODO_CATEGORIES.find(c => c.id === todo.category)?.label || todo.category;
              const assigneeName = todo.assigned_to_user?.full_name || todo.assigned_to_user?.username || null;

              return (
                <div
                  key={todo.id}
                  className={`rounded-lg border p-3 transition-all ${
                    todo.status === "done"
                      ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
                      : todo.status === "in_progress"
                        ? "border-blue-500/30 bg-blue-500/5"
                        : "border-[var(--fr-analytics-border)] hover:border-[var(--fr-analytics-accent)]/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status Circle */}
                    <button
                      type="button"
                      onClick={() => {
                        if (todo.status === "pending") {
                          void updateTodoStatus(todo, "in_progress");
                        } else if (todo.status === "in_progress") {
                          void updateTodoStatus(todo, "done");
                        } else {
                          void updateTodoStatus(todo, "pending");
                        }
                      }}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        todo.status === "done"
                          ? "border-emerald-500 bg-emerald-500"
                          : todo.status === "in_progress"
                            ? "border-blue-500 bg-blue-500"
                            : "border-[var(--fr-analytics-muted)] hover:border-[var(--fr-analytics-accent)]"
                      }`}
                    >
                      {todo.status === "done" && <Check className="h-3 w-3 text-white" />}
                      {todo.status === "in_progress" && (
                        <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            todo.status === "done" ? "line-through text-[var(--fr-analytics-muted)]" : "text-[var(--fr-analytics-text)]"
                          }`}>
                            {todo.title}
                          </p>
                          {todo.description && (
                            <p className="mt-1 text-xs text-[var(--fr-analytics-muted)] line-clamp-2">
                              {todo.description}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[var(--fr-analytics-accent)]/10 px-2 py-0.5 text-xs text-[var(--fr-analytics-accent)]">
                              {categoryLabel}
                            </span>
                            {todo.priority === "high" && (
                              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-600">
                                Срочно
                              </span>
                            )}
                            {assigneeName && (
                              <span className="flex items-center gap-1 text-xs text-[var(--fr-analytics-muted)]">
                                <User className="h-3 w-3" />
                                {assigneeName}
                              </span>
                            )}
                            {todo.due_date && (
                              <span className={`text-xs ${
                                new Date(todo.due_date) < new Date() && todo.status !== "done"
                                  ? "text-rose-600"
                                  : "text-[var(--fr-analytics-muted)]"
                              }`}>
                                до {formatRussianDate(todo.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => {
                            if (confirm("Удалить задачу?")) {
                              void handleDeleteTodo(todo.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[var(--fr-analytics-muted)]" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* By Assignee Stats */}
        {todoStats?.byAssignee && todoStats.byAssignee.length > 0 && (
          <div className="mt-4 border-t border-[var(--fr-analytics-border)] pt-4">
            <p className="mb-2 text-xs font-medium text-[var(--fr-analytics-muted)]">
              По исполнителям
            </p>
            <div className="flex flex-wrap gap-2">
              {todoStats.byAssignee.slice(0, 5).map((assignee) => (
                <div
                  key={assignee.userId}
                  className="flex items-center gap-2 rounded-full border border-[var(--fr-analytics-border)] bg-[var(--fr-analytics-bg-card)] px-3 py-1.5 text-xs"
                >
                  <User className="h-3.5 w-3.5 text-[var(--fr-analytics-muted)]" />
                  <span className="font-medium text-[var(--fr-analytics-text)]">
                    {assignee.userName || assignee.userId.slice(0, 8)}
                  </span>
                  <span className="text-[var(--fr-analytics-muted)]">
                    {assignee.pending + assignee.inProgress}/{assignee.done}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </FranchizeOperatorPanel>

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

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        minDate={dateRange?.minDate}
        maxDate={dateRange?.maxDate}
        defaultDaysBack={7}
      />
    </div>
  );
}
