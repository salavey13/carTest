"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
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
  QrCode,
  Edit,
  MoreVertical,
  Phone,
  Globe,
  Mail,
  MessageSquare,
  Send,
  List,
  Share2,
  Plus,
  X,
  BarChart3,
  Tag,
  FileText,
} from "lucide-react";

import { useAppContext } from "@/contexts/AppContext";
import {
  getRentalsDashboard,
  getRentalsDateRange,
  getRentalsForExport,
  getSalesDashboard,
  validateAnalyticsPassword,
  getCommercialProposalsDashboard,
  getSubrentContractsDashboard,
  updateRentalStatus,
  regenerateRentalQr,
  sendRentalDocByEmail,
  type RentalDashboardItem,
  type RentalDashboardSummary,
  type SaleDashboardItem,
  type SalesDashboardResult,
  type CommercialProposalItem,
  type CommercialProposalsResult,
  type SubrentContractItem,
  type SubrentContractsResult,
} from "@/app/franchize/server-actions/rentals-dashboard";
import {
  getSubrentApplications,
  approveSubrentApplication,
  declineSubrentApplication,
  type SubrentApplicationItem,
} from "@/app/franchize/server-actions/subrent-approval";
import {
  getMessageTemplates,
  sendTemplateMessage,
} from "@/app/franchize/server-actions/message-templates";
import { useSupabaseRealtime } from "@/app/franchize/hooks/useSupabaseRealtime";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { RentalsStatsRow } from "./analytics-components/RentalsStatsRow";
import { SubrentsSection } from "./analytics-components/SubrentsSection";
import { SalesListSection } from "./analytics-components/SalesListSection";
import { CommercialProposalsListSection } from "./analytics-components/CommercialProposalsListSection";
import { TodosSection } from "./analytics-components/TodosSection";
import {
  getAllChecklistStates,
  updateChecklistState,
  type ChecklistState,
} from "@/app/franchize/server-actions/checklist";
import {
  getCrewTodos,
  getCrewTodoStats,
  createCrewTodo,
  getCrewMembersForTodos,
  type CrewTodo,
  type TodoStatus,
  type TodoPriority,
} from "@/app/franchize/server-actions/crew-todos";
import { RentalHandoffModal } from "./RentalHandoffModal";
import { RentalsCalendar } from "./RentalsCalendar";
import { withAlpha } from "@/app/franchize/lib/theme";

// ─── Formatting helpers ─────────────────────────────────────────────────────────

import { formatRubles, formatRussianDate, formatRussianDateOnly } from "./analytics-utils";

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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<"all" | "verified" | "pending" | "revoked">("all");
  const [rentals, setRentals] = useState<RentalDashboardItem[]>([]);
  const [summary, setSummary] = useState<RentalDashboardSummary | null>(null);
  // Sales data
  const [sales, setSales] = useState<SaleDashboardItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesDashboardResult["summary"] | null>(null);
  const [loadingSales, setLoadingSales] = useState(true);

  // Commercial proposals data
  const [proposals, setProposals] = useState<CommercialProposalItem[]>([]);
  const [proposalsSummary, setProposalsSummary] = useState<CommercialProposalsResult["summary"] | null>(null);
  const [loadingProposals, setLoadingProposals] = useState(true);

  // Subrent contracts data
  const [subrents, setSubrents] = useState<SubrentContractItem[]>([]);
  const [subrentsSummary, setSubrentsSummary] = useState<SubrentContractsResult["summary"] | null>(null);
  const [loadingSubrents, setLoadingSubrents] = useState(true);

  // Pending subrent applications
  const [pendingApplications, setPendingApplications] = useState<SubrentApplicationItem[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [processingApplication, setProcessingApplication] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [checklistStates, setChecklistStates] = useState<{ handout: ChecklistState | null; return: ChecklistState | null }>({ handout: null, return: null });
  const [updatingChecklist, setUpdatingChecklist] = useState<string | null>(null);
  const [todos, setTodos] = useState<CrewTodo[]>([]);
  const [todoStats, setTodoStats] = useState<{ total: number; pending: number; inProgress: number; done: number } | null>(null);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [todoFilter, setTodoFilter] = useState<TodoStatus | "all">("all");

  // New todo form state
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState<TodoPriority>("medium");
  const [newTodoAssignee, setNewTodoAssignee] = useState<string | null>(null);
  const [crewMembers, setCrewMembers] = useState<Array<{ user_id: string; full_name: string | null; username: string | null }>>([]);
  const [creatingTodo, setCreatingTodo] = useState(false);

  // Handoff modal state
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [handoffModalPhase, setHandoffModalPhase] = useState<"handout" | "return">("handout");
  const [handoffModalRental, setHandoffModalRental] = useState<RentalDashboardItem | null>(null);

  // Rental status change state
  const [statusChangeModalOpen, setStatusChangeModalOpen] = useState(false);
  const [statusChangeRental, setStatusChangeRental] = useState<RentalDashboardItem | null>(null);
  const [updatingRentalStatus, setUpdatingRentalStatus] = useState<string | null>(null);
  const [regeneratingQr, setRegeneratingQr] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // Message template state
  const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
  const [messageTemplates, setMessageTemplates] = useState<Array<{ id: string; key: string; name: string }>>([]);
  const [sendingMessage, setSendingMessage] = useState<string | null>(null);

  // Rental completion state
  const [completingRental, setCompletingRental] = useState<string | null>(null);
  const [qrShareOpen, setQrShareOpen] = useState<string | null>(null);

  // View mode state
  const [analyticsView, setAnalyticsView] = useState<"table" | "calendar">("table");

  // Password auth
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);

  // Pull-to-refresh state
  const [pullState, setPullState] = useState<"idle" | "pulling" | "refreshing">("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const pullThreshold = 80;
  const maxPullDistance = 120;
  const mainContentRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Show password prompt immediately if no auth available
  useEffect(() => {
    if (!authLoading && !dbUser && !passwordAuthOwnerId) {
      setShowPasswordEntry(true);
    }
  }, [authLoading, dbUser, passwordAuthOwnerId]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false);
      }
    };
    if (datePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [datePickerOpen]);

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
    if (!actorUserId) {
      // Never get stuck in the initial loading state — flip the flag off
      // so the UI can show the empty state / date nav remains clickable.
      setLoading(false);
      setRefreshing(false);
      return;
    }

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
    if (!actorUserId) return; // no loading flag to reset for dateRange

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
    if (!actorUserId) {
      setLoadingSales(false);
      return;
    }

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

  const loadCommercialProposals = useCallback(async (date: string) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) {
      setLoadingProposals(false);
      return;
    }

    setLoadingProposals(true);
    try {
      const result = await getCommercialProposalsDashboard({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        date,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success && result.data) {
        setProposals(result.data.items || []);
        setProposalsSummary(result.data.summary || null);
      }
    } catch (error) {
      console.error("[Analytics] Commercial proposals load error:", error);
    } finally {
      setLoadingProposals(false);
    }
  }, [getActorUserId, initialSlug, passwordAuthOwnerId]);

  const loadSubrentContracts = useCallback(async (date: string) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) {
      setLoadingSubrents(false);
      return;
    }

    setLoadingSubrents(true);
    try {
      const result = await getSubrentContractsDashboard({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        date,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success && result.data) {
        setSubrents(result.data.items || []);
        setSubrentsSummary(result.data.summary || null);
      }
    } catch (error) {
      console.error("[Analytics] Subrent contracts load error:", error);
    } finally {
      setLoadingSubrents(false);
    }
  }, [getActorUserId, initialSlug, passwordAuthOwnerId]);

  const loadPendingApplications = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId) {
      setLoadingApplications(false);
      return;
    }

    setLoadingApplications(true);
    try {
      const result = await getSubrentApplications({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        status: "pending",
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success && result.data) {
        setPendingApplications(result.data.items || []);
      }
    } catch (error) {
      console.error("[Analytics] Pending applications load error:", error);
    } finally {
      setLoadingApplications(false);
    }
  }, [getActorUserId, initialSlug, passwordAuthOwnerId]);

  const handleApproveApplication = async (applicationId: string) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    setProcessingApplication(applicationId);
    try {
      const result = await approveSubrentApplication({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        applicationId,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success) {
        toast.success("Договор сгенерирован и отправлен!");
        await loadPendingApplications();
        await loadSubrentContracts(selectedDate);
      } else {
        toast.error(result.error || "Не удалось одобрить заявку");
      }
    } catch (error) {
      console.error("[Approve application] Error:", error);
      toast.error("Ошибка одобрения заявки");
    } finally {
      setProcessingApplication(null);
    }
  };

  const handleDeclineApplication = async (applicationId: string) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    setProcessingApplication(applicationId);
    try {
      const result = await declineSubrentApplication({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        applicationId,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success) {
        toast.success("Заявка отклонена");
        await loadPendingApplications();
      } else {
        toast.error(result.error || "Не удалось отклонить заявку");
      }
    } catch (error) {
      console.error("[Decline application] Error:", error);
      toast.error("Ошибка отклонения заявки");
    } finally {
      setProcessingApplication(null);
    }
  };

  const loadChecklistStates = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return; // no loading flag to reset

    try {
      const result = await getAllChecklistStates({ actorUserId, isPasswordAuth: !!passwordAuthOwnerId });
      if (result.success && result.data) setChecklistStates(result.data);
    } catch (error) {
      console.error("[Analytics] Checklist error:", error);
    }
  }, [getActorUserId, passwordAuthOwnerId]);

  const loadTodos = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId || !crew.id) {
      setLoadingTodos(false);
      return;
    }

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

  // Load crew members for the todo assignee dropdown (called once when form opens)
  const loadCrewMembers = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId || !crew.id) return;
    try {
      const result = await getCrewMembersForTodos({
        actorUserId,
        crewId: crew.id,
        isPasswordAuth: !!passwordAuthOwnerId,
      });
      if (result.success && result.data) setCrewMembers(result.data);
    } catch (error) {
      console.error("[Analytics] Crew members load error:", error);
    }
  }, [getActorUserId, crew.id, passwordAuthOwnerId]);

  // Create a new todo via server action
  const handleCreateTodo = async () => {
    const title = newTodoTitle.trim();
    if (!title) {
      toast.error("Введите название задачи");
      return;
    }
    const actorUserId = getActorUserId();
    if (!actorUserId || !crew.id) {
      toast.error("Нет авторизации");
      return;
    }
    setCreatingTodo(true);
    try {
      const result = await createCrewTodo({
        actorUserId,
        todo: {
          crewId: crew.id,
          title,
          assignedTo: newTodoAssignee,
          priority: newTodoPriority,
          category: "general",
        },
        isPasswordAuth: !!passwordAuthOwnerId,
      });
      if (result.success) {
        toast.success("Задача добавлена");
        setNewTodoTitle("");
        setNewTodoPriority("medium");
        setNewTodoAssignee(null);
        setShowTodoForm(false);
        await loadTodos();
      } else {
        toast.error(result.error || "Не удалось создать задачу");
      }
    } catch (error) {
      console.error("[Analytics] Create todo error:", error);
      toast.error("Ошибка создания задачи");
    } finally {
      setCreatingTodo(false);
    }
  };

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
      if (result.slug && result.slug !== initialSlug?.trim()) {
        setPasswordError(`Пароль для другого экипажа: ${result.slug}`);
        return;
      }

      setPasswordAuthOwnerId(result.ownerId || null);
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

  // Handle rental status change
  const handleStatusChange = async (rental: RentalDashboardItem, newStatus: RentalDashboardItem["status"]) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    setUpdatingRentalStatus(rental.rental_id);
    try {
      const result = await updateRentalStatus({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        rentalId: rental.rental_id,
        status: newStatus,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success) {
        toast.success(`Статус изменён на ${newStatus}`);
        await loadRentals(selectedDate, true);
      } else {
        toast.error(result.error || "Не удалось изменить статус");
      }
    } catch (error) {
      console.error("[Status change] Error:", error);
      toast.error("Ошибка изменения статуса");
    } finally {
      setUpdatingRentalStatus(null);
    }
  };

  // Handle QR regeneration
  const handleQrRegeneration = async (rental: RentalDashboardItem) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    setRegeneratingQr(rental.rental_id);
    try {
      const result = await regenerateRentalQr({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        rentalId: rental.rental_id,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success) {
        toast.success("QR код будет перегенерирован");
        await loadRentals(selectedDate, true);
      } else {
        toast.error(result.error || "Не удалось перегенерировать QR");
      }
    } catch (error) {
      console.error("[QR regeneration] Error:", error);
      toast.error("Ошибка регенерации QR");
    } finally {
      setRegeneratingQr(null);
    }
  };

  // Handle email sending
  const handleSendEmail = async (rental: RentalDashboardItem) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    setSendingEmail(rental.rental_id);
    try {
      const result = await sendRentalDocByEmail({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        rentalId: rental.rental_id,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success) {
        toast.success(`Отправлено на ${result.data?.email || "email"}`);
      } else {
        toast.error(result.error || "Не удалось отправить email");
      }
    } catch (error) {
      console.error("[Send email] Error:", error);
      toast.error("Ошибка отправки email");
    } finally {
      setSendingEmail(null);
    }
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

  // ─── Message templates ───────────────────────────────────────────────────────────

  const loadMessageTemplates = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    try {
      const result = await getMessageTemplates({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        channel: "telegram",
      });

      if (result.success && result.data) {
        // Group templates by category (prefix before underscore)
        const grouped: Record<string, typeof result.data> = {};
        for (const template of result.data) {
          const category = template.template_key.split('_')[0]; // e.g., "return" from "return_reminder_24h"
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push({
            id: template.id,
            key: template.template_key,
            name: template.name,
          });
        }
        setMessageTemplates(result.data.map(t => ({ id: t.id, key: t.template_key, name: t.name })));
      }
    } catch (error) {
      console.error("[Load templates] Error:", error);
    }
  }, [getActorUserId, initialSlug]);

  // Load templates on mount
  useEffect(() => {
    void loadMessageTemplates();
  }, [loadMessageTemplates]);

  const handleSendMessage = async (rental: RentalDashboardItem, templateKey: string) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    setSendingMessage(rental.rental_id);
    setMessageMenuOpen(null);

    try {
      const result = await sendTemplateMessage({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        rentalId: rental.rental_id,
        templateKey,
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success && result.data?.sent) {
        toast.success("Сообщение отправлено");
      } else if (result.success && result.data?.linked === false) {
        toast.warning("Клиент не связан (не отсканировал QR)");
      } else {
        toast.error(result.error || "Не удалось отправить сообщение");
      }
    } catch (error) {
      console.error("[Send message] Error:", error);
      toast.error("Ошибка отправки сообщения");
    } finally {
      setSendingMessage(null);
    }
  };

  const handleMarkComplete = async (rental: RentalDashboardItem) => {
    const actorUserId = getActorUserId();
    if (!actorUserId) return;

    setCompletingRental(rental.rental_id);
    try {
      const result = await updateRentalStatus({
        slug: initialSlug?.trim() || "vip-bike",
        actorUserId,
        rentalId: rental.rental_id,
        status: "completed",
        isPasswordAuth: !!passwordAuthOwnerId,
      });

      if (result.success) {
        toast.success("Аренда завершена");
        // Trigger refresh
        window.dispatchEvent(new CustomEvent("franchize-rentals-updated"));
      } else {
        toast.error(result.error || "Не удалось завершить аренду");
      }
    } catch (error) {
      console.error("[Mark complete] Error:", error);
      toast.error("Ошибка завершения аренды");
    } finally {
      setCompletingRental(null);
    }
  };

  const handleShareQr = (rental: RentalDashboardItem) => {
    // Generate deep link using startparam format: rental_{slug}_{rentalId}
    const slug = initialSlug?.trim() || "vip-bike";
    const startParam = `rental_${slug}_${rental.rental_id}`;
    const deepLink = `https://t.me/oneBikePlsBot/app?startapp=${startParam}`;

    // Copy to clipboard
    navigator.clipboard.writeText(deepLink).then(() => {
      toast.success("Ссылка скопирована! Отправьте её другому члену команды");
    }).catch(() => {
      toast.error("Не удалось скопировать ссылку");
    });
    setQrShareOpen(null);
  };

  // ─── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (getActorUserId()) {
      void loadRentals(selectedDate);
      void loadSales(selectedDate);
      void loadCommercialProposals(selectedDate);
      void loadSubrentContracts(selectedDate);
      void loadPendingApplications();
      void loadDateRange();
      void loadChecklistStates();
      void loadTodos();
    }
  }, [getActorUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (getActorUserId() && !authLoading) {
      void loadRentals(selectedDate, true);
      void loadSales(selectedDate);
      void loadCommercialProposals(selectedDate);
      void loadSubrentContracts(selectedDate);
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
  const totalProposals = proposals.length;
  const proposalsRevenue = proposals.reduce((sum, p) => sum + (p.total_price || 0), 0);
  const totalSubrents = subrents.length;
  const totalRevenue = rentalRevenue + salesRevenue + proposalsRevenue;
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
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full blur-xl animate-pulse"
            style={{ backgroundColor: withAlpha(accentMain, 0.2) }}
          />
          {/* Main spinner */}
          <div className="relative w-12 h-12 md:w-16 md:h-16">
            <div className="absolute inset-0 rounded-full border-3 md:border-4" style={{ borderColor: withAlpha(accentMain, 0.15) }} />
            <div
              className="absolute inset-0 rounded-full border-3 md:border-4 border-t-transparent animate-spin"
              style={{ borderColor: accentMain, borderTopColor: "transparent" }}
            />
            {/* Center dot */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: accentMain }}
            />
          </div>
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
            className="absolute -inset-3 md:-inset-4 rounded-full blur-2xl md:blur-3xl animate-pulse"
            style={{ backgroundColor: withAlpha(accentMain, 0.15) }}
          />

          <div
            className="relative rounded-2xl md:rounded-3xl p-6 md:p-8 border shadow-xl md:shadow-2xl"
            style={{ backgroundColor: bgCard, borderColor: borderSoft }}
          >
            <div className="text-center mb-6 md:mb-8">
              <div
                className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${accentMain}, ${accentHover})`,
                  boxShadow: `0 10px 40px ${withAlpha(accentMain, 0.3)}`,
                }}
              >
                <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" style={{ color: "#FFFFFF" }} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ backgroundImage: `linear-gradient(to right, ${accentMain}, ${accentHover})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Аналитика
              </h1>
              <p className="text-xs md:text-sm mt-1.5 md:mt-2" style={{ color: textSecondary }}>Введите пароль для доступа</p>
            </div>

            <div className="relative">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(null); }}
                onKeyDown={(e) => e.key === "Enter" && void handlePasswordSubmit()}
                placeholder="••••••••"
                disabled={isPasswordValidating}
                className="w-full px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl border-2 text-center tracking-widest text-base md:text-lg transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: withAlpha(bgCard, 0.5),
                  borderColor: borderSoft,
                  color: textPrimary,
                }}
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 md:mt-3 text-center text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2" style={{ color: "#ef4444" }}>
                  <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {passwordError}
                </p>
              )}
            </div>

            <button
              onClick={handlePasswordSubmit}
              disabled={isPasswordValidating || !passwordInput.trim()}
              className="w-full mt-4 md:mt-6 px-4 md:px-6 py-3 md:py-4 font-bold rounded-lg md:rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-1.5 md:gap-2 text-sm md:text-base relative overflow-hidden"
              style={{
                background: `linear-gradient(to right, ${accentMain}, ${accentHover})`,
                boxShadow: `0 4px 20px ${withAlpha(accentMain, 0.4)}`,
                color: "#000000",
              }}
            >
              {isPasswordValidating ? (
                <>
                  <div className="relative">
                    <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                    {/* Spinner glow */}
                    <div className="absolute inset-0 blur-lg" style={{ backgroundColor: withAlpha("#FFFFFF", 0.3) }} />
                  </div>
                  Проверка...
                  {/* Shimmer effect */}
                  <div
                    className="absolute inset-0 -translate-x-full animate-[shimmer_1s_infinite]"
                    style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)` }}
                  />
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
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
        <header className="flex-shrink-0 px-2 md:px-4 py-2 md:py-3 border-b relative z-10" style={{ borderColor: withAlpha(borderSoft, 0.5), backgroundColor: withAlpha(bgCard, 0.5) }}>
          <div className="flex items-center justify-between gap-2 md:gap-4">
            {/* Left section */}
            <div className="flex items-center gap-4 md:gap-6 min-w-0">
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-black tracking-tight" style={{ backgroundImage: `linear-gradient(to right, ${accentMain}, ${accentHover})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Аналитика
                </h1>
                <p className="text-xs mt-0.5 truncate" style={{ color: textSecondary }}>{crew.name}</p>
              </div>

              <div className="h-6 md:h-8 w-px flex-shrink-0" style={{ backgroundColor: withAlpha(borderSoft, 0.5) }} />

              {/* Date navigation */}
              <div className="flex items-center gap-2 md:gap-3">
                <button
                  onClick={() => navigateDate(-1)}
                  className="p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all group"
                  style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentMain; e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.1); }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderSoft; e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.5); }}
                  aria-label="Предыдущий день"
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 transition-colors" style={{ color: textSecondary }} />
                </button>

                <button
                  onClick={() => setDatePickerOpen(!datePickerOpen)}
                  className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border transition-all hover:scale-105"
                  style={{
                    backgroundColor: withAlpha(bgCard, 0.5),
                    borderColor: borderSoft,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentMain; e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.1); }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderSoft; e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.5); }}
                >
                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: accentMain }} />
                  <span className="text-xs md:text-sm font-medium" style={{ color: textPrimary }}>
                    {formatRussianDateOnly(selectedDate)}
                  </span>
                </button>

                <button
                  onClick={() => navigateDate(1)}
                  className="p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all group"
                  style={{ backgroundColor: withAlpha(bgCard, 0.5), borderColor: borderSoft }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentMain; e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.1); }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderSoft; e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.5); }}
                  aria-label="Следующий день"
                >
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 transition-colors" style={{ color: textSecondary }} />
                </button>
              </div>

              {/* Date picker popup */}
              {datePickerOpen && (
                <div
                  ref={datePickerRef}
                  className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-[100000] rounded-xl md:rounded-2xl border shadow-2xl p-3 md:p-4"
                  style={{
                    backgroundColor: bgCard,
                    borderColor: withAlpha(accentMain, 0.3),
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                        setDatePickerOpen(false);
                      }
                    }}
                    className="px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: withAlpha(bgBase, 0.5),
                      color: textPrimary,
                      border: `1px solid ${borderSoft}`,
                      fontFamily: "'Onest', sans-serif",
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setDatePickerOpen(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        backgroundColor: withAlpha(borderSoft, 0.3),
                        color: textSecondary,
                      }}
                    >
                      Отмена
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDate(new Date().toISOString().split("T")[0]);
                        setDatePickerOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        backgroundColor: withAlpha(accentMain, 0.2),
                        color: accentMain,
                        border: `1px solid ${withAlpha(accentMain, 0.3)}`,
                      }}
                    >
                      Сегодня
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right section - actions */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <button
                onClick={() => void loadRentals(selectedDate, true)}
                disabled={refreshing}
                className="p-1.5 md:p-2.5 rounded-lg md:rounded-xl border transition-all group relative"
                style={{
                  backgroundColor: refreshing ? withAlpha("#34d399", 0.15) : withAlpha(bgCard, 0.5),
                  borderColor: refreshing ? withAlpha("#34d399", 0.3) : borderSoft,
                }}
                onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.borderColor = "#34d399"; }}
                onMouseLeave={(e) => { if (!refreshing) e.currentTarget.style.borderColor = borderSoft; }}
              >
                <RefreshCw
                  className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${refreshing ? "animate-spin" : ""}`}
                  style={{ color: refreshing ? "#34d399" : textSecondary }}
                />
                {/* Refresh glow when active */}
                {refreshing && (
                  <div
                    className="absolute inset-0 rounded-lg md:rounded-xl blur-md animate-pulse"
                    style={{ backgroundColor: withAlpha("#34d399", 0.2) }}
                  />
                )}
              </button>

              <button
                onClick={exportToExcel}
                className="hidden sm:flex px-3 md:px-4 py-1.5 md:py-2.5 rounded-lg md:rounded-xl border font-semibold transition-all items-center gap-1.5 md:gap-2 text-xs md:text-sm"
                style={{
                  backgroundColor: withAlpha("#10b981", 0.15),
                  borderColor: withAlpha("#10b981", 0.3),
                  color: "#34d399",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = withAlpha("#10b981", 0.25); e.currentTarget.style.borderColor = withAlpha("#10b981", 0.4); }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = withAlpha("#10b981", 0.15); e.currentTarget.style.borderColor = withAlpha("#10b981", 0.3); }}
              >
                <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden md:inline">Экспорт</span>
                <span className="md:hidden">XLS</span>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto overflow-x-visible relative z-0">
          <div className="w-full px-2 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">

            {/* STATS ROW */}
              <RentalsStatsRow
                stats={[
                  { label: "Аренд", value: String(summary?.totalRentals ?? rentals.length), icon: <Eye className="w-3 h-3" />, color: accentMain },
                  { label: "Выручка", value: formatRubles(summary?.totalRevenue ?? 0), icon: <TrendingUp className="w-3 h-3" />, color: "#10b981" },
                  { label: "Средний", value: summary?.totalRentals ? formatRubles((summary?.totalRevenue ?? 0) / summary.totalRentals) : "—", icon: <BarChart3 className="w-3 h-3" />, color: "#8b5cf6" },
                  { label: "Активны", value: String(summary?.activeRentals ?? 0), icon: <Clock className="w-3 h-3" />, color: "#f59e0b" },
                  { label: "Завершены", value: String(summary?.completedRentals ?? 0), icon: <CheckCircle2 className="w-3 h-3" />, color: "#34d399" },
                  { label: "Продажи", value: String(sales.length), icon: <Tag className="w-3 h-3" />, color: "#10b981" },
                  { label: "КП", value: String(proposals.length), icon: <FileText className="w-3 h-3" />, color: "#8b5cf6" },
                ]}
                accentMain={accentMain}
                bgCard={bgCard}
                borderSoft={borderSoft}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
              />

            {/* FILTER BAR */}
            <div className="flex items-center gap-2 md:gap-3 overflow-x-visible pb-2 px-1 flex-wrap">
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap" style={{ color: textSecondary, opacity: 0.7 }}>Фильтр:</span>
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
                    className="relative px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap group"
                    style={
                      isActive
                        ? {
                            background: `linear-gradient(135deg, ${withAlpha(accentMain, 0.2)}, ${withAlpha(accentMain, 0.1)})`,
                            borderColor: withAlpha(accentMain, 0.4),
                            color: accentMain,
                            borderWidth: "1.5px",
                            boxShadow: `0 0 20px ${withAlpha(accentMain, 0.15)}`
                          }
                        : {
                            backgroundColor: withAlpha(bgCard, 0.5),
                            borderColor: borderSoft,
                            color: textSecondary,
                            borderWidth: "1px"
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = withAlpha(borderSoft, 1);
                        e.currentTarget.style.color = textPrimary;
                        e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.7);
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = borderSoft;
                        e.currentTarget.style.color = textSecondary;
                        e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.5);
                      }
                    }}
                  >
                    {/* Active glow effect */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-lg md:rounded-xl blur-md animate-pulse" style={{ backgroundColor: withAlpha(accentMain, 0.2) }} />
                    )}
                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10" />
                    <span className="relative z-10">{filter.label}</span>
                  </button>
                );
              })}
            </div>

            {/* CHECKLISTS & TODOS */}
            <div className="grid lg:grid-cols-2 gap-3 md:gap-4">
              {/* Handout checklist */}
              <div
                className="rounded-xl md:rounded-2xl border overflow-hidden transition-all duration-300"
                style={{
                  backgroundColor: withAlpha(bgCard, 0.4),
                  borderColor: withAlpha(borderSoft, 0.5),
                  backdropFilter: "blur(12px)",
                  borderWidth: "1px"
                }}
              >
                <div
                  className="px-4 md:px-5 py-2.5 md:py-3 border-b flex items-center justify-between"
                  style={{
                    borderColor: withAlpha(borderSoft, 0.3),
                    background: `linear-gradient(to right, ${withAlpha("#10b981", 0.05)}, transparent)`
                  }}
                >
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div
                      className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shadow-lg animate-pulse"
                      style={{ backgroundColor: "#10b981", boxShadow: `0 0 10px ${withAlpha("#10b981", 0.5)}` }}
                    />
                    <span className="text-xs md:text-sm font-black tracking-tight" style={{ color: textPrimary }}>ВЫДАЧА</span>
                    <span className="text-sm md:text-base" style={{ color: textSecondary, opacity: 0.7 }}>→</span>
                  </div>
                  <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full" style={{
                    backgroundColor: withAlpha("#10b981", 0.15),
                    color: "#34d399",
                    border: "1px solid",
                    borderColor: withAlpha("#10b981", 0.3)
                  }}>
                    {checklistStates.handout?.items.filter(i => i.checked).length || 0} / {checklistStates.handout?.items.length || 0}
                  </span>
                </div>
                <div className="p-3 md:p-4 flex flex-wrap gap-1.5 md:gap-2">
                  {checklistStates.handout?.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void toggleChecklistItem("handout", item.id)}
                      disabled={updatingChecklist === item.id}
                      className="relative px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border text-[10px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap overflow-hidden group"
                      style={
                        updatingChecklist === item.id
                          ? { backgroundColor: withAlpha("#10b981", 0.1), borderColor: withAlpha("#10b981", 0.3), color: "#34d399", borderWidth: "1.5px" }
                          : item.checked
                          ? {
                              backgroundColor: `linear-gradient(135deg, ${withAlpha("#10b981", 0.25)}, ${withAlpha("#10b981", 0.15)})`,
                              borderColor: withAlpha("#10b981", 0.4),
                              color: "#34d399",
                              borderWidth: "1.5px",
                              boxShadow: `0 2px 8px ${withAlpha("#10b981", 0.2)}`
                            }
                          : {
                              backgroundColor: withAlpha(bgCard, 0.6),
                              borderColor: borderSoft,
                              color: textSecondary,
                              borderWidth: "1px"
                            }
                      }
                      onMouseEnter={(e) => {
                        if (!item.checked && updatingChecklist !== item.id) {
                          e.currentTarget.style.borderColor = withAlpha(borderSoft, 1);
                          e.currentTarget.style.color = textPrimary;
                          e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.8);
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!item.checked && updatingChecklist !== item.id) {
                          e.currentTarget.style.borderColor = borderSoft;
                          e.currentTarget.style.color = textSecondary;
                          e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.6);
                        }
                      }}
                    >
                      {updatingChecklist === item.id ? (
                        <>
                          <RefreshCw className="w-2.5 h-2.5 md:w-3 md:h-3 inline animate-spin mr-0.5 md:mr-1" />
                          {item.text}
                        </>
                      ) : (
                        <>
                          {item.checked && <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 inline mr-0.5 md:mr-1" />}
                          {item.text}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Return checklist */}
              <div
                className="rounded-xl md:rounded-2xl border overflow-hidden transition-all duration-300"
                style={{
                  backgroundColor: withAlpha(bgCard, 0.4),
                  borderColor: withAlpha(borderSoft, 0.5),
                  backdropFilter: "blur(12px)",
                  borderWidth: "1px"
                }}
              >
                <div
                  className="px-4 md:px-5 py-2.5 md:py-3 border-b flex items-center justify-between"
                  style={{
                    borderColor: withAlpha(borderSoft, 0.3),
                    background: `linear-gradient(to right, ${withAlpha("#3b82f6", 0.05)}, transparent)`
                  }}
                >
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div
                      className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shadow-lg animate-pulse"
                      style={{ backgroundColor: "#3b82f6", boxShadow: `0 0 10px ${withAlpha("#3b82f6", 0.5)}` }}
                    />
                    <span className="text-xs md:text-sm font-black tracking-tight" style={{ color: textPrimary }}>ВОЗВРАТ</span>
                    <span className="text-sm md:text-base" style={{ color: textSecondary, opacity: 0.7 }}>←</span>
                  </div>
                  <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full" style={{
                    backgroundColor: withAlpha("#3b82f6", 0.15),
                    color: "#60a5fa",
                    border: "1px solid",
                    borderColor: withAlpha("#3b82f6", 0.3)
                  }}>
                    {checklistStates.return?.items.filter(i => i.checked).length || 0} / {checklistStates.return?.items.length || 0}
                  </span>
                </div>
                <div className="p-3 md:p-4 flex flex-wrap gap-1.5 md:gap-2">
                  {checklistStates.return?.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void toggleChecklistItem("return", item.id)}
                      disabled={updatingChecklist === item.id}
                      className="relative px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border text-[10px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap overflow-hidden group"
                      style={
                        updatingChecklist === item.id
                          ? { backgroundColor: withAlpha("#3b82f6", 0.1), borderColor: withAlpha("#3b82f6", 0.3), color: "#60a5fa", borderWidth: "1.5px" }
                          : item.checked
                          ? {
                              backgroundColor: `linear-gradient(135deg, ${withAlpha("#3b82f6", 0.25)}, ${withAlpha("#3b82f6", 0.15)})`,
                              borderColor: withAlpha("#3b82f6", 0.4),
                              color: "#60a5fa",
                              borderWidth: "1.5px",
                              boxShadow: `0 2px 8px ${withAlpha("#3b82f6", 0.2)}`
                            }
                          : {
                              backgroundColor: withAlpha(bgCard, 0.6),
                              borderColor: borderSoft,
                              color: textSecondary,
                              borderWidth: "1px"
                            }
                      }
                      onMouseEnter={(e) => {
                        if (!item.checked && updatingChecklist !== item.id) {
                          e.currentTarget.style.borderColor = withAlpha(borderSoft, 1);
                          e.currentTarget.style.color = textPrimary;
                          e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.8);
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!item.checked && updatingChecklist !== item.id) {
                          e.currentTarget.style.borderColor = borderSoft;
                          e.currentTarget.style.color = textSecondary;
                          e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.6);
                        }
                      }}
                    >
                      {updatingChecklist === item.id ? (
                        <>
                          <RefreshCw className="w-2.5 h-2.5 md:w-3 md:h-3 inline animate-spin mr-0.5 md:mr-1" />
                          {item.text}
                        </>
                      ) : (
                        <>
                          {item.checked && <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 inline mr-0.5 md:mr-1" />}
                          {item.text}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>

{/* Todos */}
              <TodosSection
                todos={todos}
                todoStats={todoStats}
                loadingTodos={loadingTodos}
                todoFilter={todoFilter}
                onFilterChange={setTodoFilter}
                showTodoForm={showTodoForm}
                onToggleForm={() => {
                  setShowTodoForm((v) => {
                    const next = !v;
                    if (next && crewMembers.length === 0) void loadCrewMembers();
                    return next;
                  });
                }}
                creatingTodo={creatingTodo}
                onCreateTodo={async (title, prio, assignee) => {
                  if (!title) return;
                  setCreatingTodo(true);
                  try {
                    const result = await createCrewTodo({
                      actorUserId: getActorUserId()!,
                      crewId: crew.id,
                      title,
                      priority: prio,
                      assignedTo: assignee,
                      isPasswordAuth: !!passwordAuthOwnerId,
                    });
                    if (result.success) { toast.success("Задача создана"); void loadTodos(); }
                    else toast.error(result.error || "Ошибка создания задачи");
                  } catch { toast.error("Ошибка"); }
                  finally { setCreatingTodo(false); setShowTodoForm(false); setNewTodoTitle(""); }
                }}
                crewMembers={crewMembers}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                accentMain={accentMain}
                bgCard={bgCard}
                borderSoft={borderSoft}
              />
            </div>

            {/* RENTALS TABLE */}
            <div
              className="rounded-xl md:rounded-2xl border overflow-hidden transition-all duration-300"
              style={{
                backgroundColor: withAlpha(bgCard, 0.4),
                borderColor: withAlpha(borderSoft, 0.5),
                backdropFilter: "blur(12px)",
                borderWidth: "1px"
              }}
            >
              {/* View toggle buttons */}
              <div className="px-4 md:px-5 pt-2.5 md:pt-3 flex items-center gap-2">
                <button
                  onClick={() => setAnalyticsView("table")}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 md:gap-2 ${
                    analyticsView === "table" ? "opacity-100" : "opacity-60"
                  }`}
                  style={{
                    backgroundColor: analyticsView === "table" ? withAlpha(accentMain, 0.2) : "transparent",
                    borderColor: analyticsView === "table" ? withAlpha(accentMain, 0.3) : borderSoft,
                    borderWidth: "1px",
                    color: analyticsView === "table" ? accentMain : textSecondary,
                  }}
                >
                  <List className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Таблица</span>
                </button>
                <button
                  onClick={() => setAnalyticsView("calendar")}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 md:gap-2 ${
                    analyticsView === "calendar" ? "opacity-100" : "opacity-60"
                  }`}
                  style={{
                    backgroundColor: analyticsView === "calendar" ? withAlpha(accentMain, 0.2) : "transparent",
                    borderColor: analyticsView === "calendar" ? withAlpha(accentMain, 0.3) : borderSoft,
                    borderWidth: "1px",
                    color: analyticsView === "calendar" ? accentMain : textSecondary,
                  }}
                >
                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Календарь</span>
                </button>
              </div>

              {analyticsView === "calendar" ? (
                <div className="px-4 md:px-5 pb-4 md:pb-6">
                  <RentalsCalendar
                    slug={initialSlug}
                    crewId={crew.id}
                    crewTheme={crew.theme}
                    isPasswordAuth={!!passwordAuthOwnerId}
                    passwordAuthOwnerId={passwordAuthOwnerId}
                  />
                </div>
              ) : (
                <>
              <div
                className="px-4 md:px-5 py-2.5 md:py-3 border-b flex items-center gap-2"
                style={{
                  borderColor: withAlpha(borderSoft, 0.3),
                  background: `linear-gradient(to right, ${withAlpha(accentMain, 0.05)}, transparent)`
                }}
              >
                <div
                  className="w-1 h-4 md:h-5 rounded-full"
                  style={{ backgroundColor: accentMain }}
                />
                <span className="text-xs md:text-sm font-black tracking-tight" style={{ color: textPrimary }}>АРЕНДЫ</span>
              </div>

              {loading ? (
                <div className="p-4 md:p-6 space-y-4">
                  {/* Skeleton rows */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg animate-pulse"
                      style={{ backgroundColor: withAlpha(bgCard, 0.3) }}
                    >
                      {/* Time skeleton */}
                      <div className="w-16 md:w-20 h-4 rounded" style={{ backgroundColor: withAlpha(borderSoft, 0.5) }} />
                      {/* Client skeleton */}
                      <div className="flex-1">
                        <div className="w-24 md:w-32 h-4 rounded mb-2" style={{ backgroundColor: withAlpha(borderSoft, 0.5) }} />
                        <div className="w-16 md:w-24 h-3 rounded" style={{ backgroundColor: withAlpha(borderSoft, 0.3) }} />
                      </div>
                      {/* Amount skeleton */}
                      <div className="w-16 md:w-20 h-4 rounded" style={{ backgroundColor: withAlpha(borderSoft, 0.5) }} />
                      {/* Status skeleton */}
                      <div className="w-16 md:w-20 h-6 rounded-full" style={{ backgroundColor: withAlpha(borderSoft, 0.5) }} />
                      {/* Actions skeleton */}
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: withAlpha(borderSoft, 0.5) }} />
                        <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: withAlpha(borderSoft, 0.5) }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : rentals.length === 0 ? (
                <div className="p-8 md:p-12 text-center">
                  <Calendar className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4" style={{ color: borderSoft }} />
                  <p className="text-xs md:text-sm" style={{ color: textSecondary }}>Нет аренд за этот день</p>
                  <p className="text-[10px] md:text-xs mt-1" style={{ color: textSecondary }}>Выберите другую дату</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr
                        className="border-b"
                        style={{
                          borderColor: withAlpha(borderSoft, 0.3),
                          background: `linear-gradient(to bottom, ${withAlpha(bgCard, 0.5)}, transparent)`
                        }}
                      >
                        <th className="px-3 md:px-5 py-2 md:py-3 text-left text-[10px] md:text-xs font-black uppercase tracking-widest" style={{ color: textSecondary, opacity: 0.7 }}>Время</th>
                        <th className="px-3 md:px-5 py-2 md:py-3 text-left text-[10px] md:text-xs font-black uppercase tracking-widest" style={{ color: textSecondary, opacity: 0.7 }}>Клиент / Техника</th>
                        <th className="px-3 md:px-5 py-2 md:py-3 text-right text-[10px] md:text-xs font-black uppercase tracking-widest" style={{ color: textSecondary, opacity: 0.7 }}>Сумма</th>
                        <th className="px-3 md:px-5 py-2 md:py-3 text-center text-[10px] md:text-xs font-black uppercase tracking-widest" style={{ color: textSecondary, opacity: 0.7 }}>Статус</th>
                        <th className="px-3 md:px-5 py-2 md:py-3 text-center text-[10px] md:text-xs font-black uppercase tracking-widest hidden sm:table-cell" style={{ color: textSecondary, opacity: 0.7 }}>QR</th>
                        <th className="px-3 md:px-5 py-2 md:py-3 text-center text-[10px] md:text-xs font-black uppercase tracking-widest hidden sm:table-cell" style={{ color: textSecondary, opacity: 0.7 }}>Док</th>
                        <th className="px-3 md:px-5 py-2 md:py-3 text-center text-[10px] md:text-xs font-black uppercase tracking-widest hidden md:table-cell" style={{ color: textSecondary, opacity: 0.7 }}>Одометр</th>
                        <th className="px-3 md:px-5 py-2 md:py-3 text-center text-[10px] md:text-xs font-black uppercase tracking-widest" style={{ color: textSecondary, opacity: 0.7 }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
                      {rentals.map((rental) => {
                        const statusStyle = statusConfig[rental.status as keyof typeof statusConfig] || statusConfig.pending_confirmation;
                        const StatusIcon = statusStyle.icon;
                        return (
                          <tr
                            key={rental.rental_id}
                            className="transition-all duration-200"
                            style={{ backgroundColor: withAlpha(accentMain, 0.02) }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.06);
                              e.currentTarget.style.transform = "scale(1.002)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.02);
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            <td className="px-3 md:px-5 py-3 md:py-4 whitespace-nowrap">
                              <span className="text-xs md:text-sm font-mono font-medium" style={{ color: textPrimary }}>
                                {formatRussianDate(rental.agreed_start_date || rental.created_at).split(",")[1]?.trim() || "—"}
                              </span>
                            </td>
                            <td className="px-3 md:px-5 py-3 md:py-4">
                              <div className="text-xs md:text-sm font-semibold leading-tight" style={{ color: textPrimary }}>{rental.user?.full_name || rental.user?.username || "—"}</div>
                              <div className="text-[10px] md:text-xs mt-0.5" style={{ color: textSecondary }}>
                                {rental.vehicle?.make} {rental.vehicle?.model}
                              </div>
                            </td>
                            <td className="px-3 md:px-5 py-3 md:py-4 text-right">
                              <span className="text-xs md:text-sm font-mono font-bold" style={{ color: "#34d399" }}>{formatRubles(rental.total_cost)}</span>
                            </td>
                            <td className="px-3 md:px-5 py-3 md:py-4 text-center">
                              <span
                                className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-semibold border transition-all"
                                style={{
                                  backgroundColor: withAlpha(statusStyle.color, 0.15),
                                  borderColor: withAlpha(statusStyle.color, 0.3),
                                  color: statusStyle.color,
                                }}
                              >
                                <StatusIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                <span className="hidden sm:inline">{statusStyle.label}</span>
                                <span className="sm:hidden">{statusStyle.label.slice(0, 4)}</span>
                              </span>
                            </td>
                            <td className="px-3 md:px-5 py-3 md:py-4 text-center hidden sm:table-cell">
                              {rental.documentSecret ? (
                                <div className="flex items-center justify-center gap-1">
                                  {rental.documentSecret.is_web_app_flow ? (
                                    <div className="flex items-center gap-1" title="Web App Flow">
                                      <Globe className="w-3 h-3 md:w-3.5 md:h-3.5" style={{ color: "#3b82f6" }} />
                                    </div>
                                  ) : rental.documentSecret.qr_claimed_at ? (
                                    <div className="flex items-center gap-1" title="QR claimed by renter">
                                      <QrCode className="w-3 h-3 md:w-3.5 md:h-3.5" style={{ color: "#10b981" }} />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1" title="QR not claimed yet">
                                      <QrCode className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-40" style={{ color: textSecondary }} />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: borderSoft }}>—</span>
                              )}
                            </td>
                            <td className="px-3 md:px-5 py-3 md:py-4 text-center hidden sm:table-cell">
                              <span className="text-base md:text-lg font-bold" style={{ color: rental.documentSecret ? "#34d399" : borderSoft }}>
                                {rental.documentSecret ? "✓" : "—"}
                              </span>
                            </td>
                            <td className="px-3 md:px-5 py-3 md:py-4 text-center hidden md:table-cell">
                              {rental.odometerStart || rental.odometerEnd ? (
                                <span className="text-xs md:text-sm font-mono font-semibold" style={{ color: "#34d399" }}>
                                  {rental.odometerStart || "?"}→{rental.odometerEnd || "?"}
                                </span>
                              ) : (
                                <span style={{ color: borderSoft }}>—</span>
                              )}
                            </td>
                            <td className="px-3 md:px-5 py-3 md:py-4 text-center">
                              <div className="flex items-center justify-center gap-1 md:gap-1.5 flex-wrap">
                                {/* Handout button */}
                                <button
                                  onClick={() => {
                                    setHandoffModalRental(rental);
                                    setHandoffModalPhase("handout");
                                    setHandoffModalOpen(true);
                                  }}
                                  className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group"
                                  style={
                                    rental.handoutCompleted
                                      ? {
                                          backgroundColor: `linear-gradient(135deg, #10b981, #059669)`,
                                          color: "white",
                                          boxShadow: `0 4px 12px ${withAlpha("#10b981", 0.4)}`,
                                          border: "none"
                                        }
                                      : {
                                          backgroundColor: withAlpha("#10b981", 0.15),
                                          borderColor: withAlpha("#10b981", 0.4),
                                          color: "#34d399",
                                          border: "1.5px solid"
                                        }
                                  }
                                >
                                  {rental.handoutCompleted && (
                                    <div className="absolute inset-0 bg-white/20 blur-sm" />
                                  )}
                                  <span className="relative z-10">→</span>
                                </button>
                                {/* Return button */}
                                <button
                                  onClick={() => {
                                    setHandoffModalRental(rental);
                                    setHandoffModalPhase("return");
                                    setHandoffModalOpen(true);
                                  }}
                                  className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group"
                                  style={
                                    rental.returnCompleted
                                      ? {
                                          backgroundColor: `linear-gradient(135deg, #3b82f6, #2563eb)`,
                                          color: "white",
                                          boxShadow: `0 4px 12px ${withAlpha("#3b82f6", 0.4)}`,
                                          border: "none"
                                        }
                                      : {
                                          backgroundColor: withAlpha("#3b82f6", 0.15),
                                          borderColor: withAlpha("#3b82f6", 0.4),
                                          color: "#60a5fa",
                                          border: "1.5px solid"
                                        }
                                  }
                                >
                                  {rental.returnCompleted && (
                                    <div className="absolute inset-0 bg-white/20 blur-sm" />
                                  )}
                                  <span className="relative z-10">←</span>
                                </button>
                                {/* QR Regenerate button */}
                                {rental.documentSecret && (
                                  <button
                                    onClick={() => void handleQrRegeneration(rental)}
                                    disabled={regeneratingQr === rental.rental_id}
                                    className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50"
                                    style={{
                                      backgroundColor: regeneratingQr === rental.rental_id
                                        ? withAlpha("#f59e0b", 0.25)
                                        : withAlpha("#f59e0b", 0.15),
                                      borderColor: withAlpha("#f59e0b", 0.4),
                                      color: "#f59e0b",
                                      border: "1.5px solid"
                                    }}
                                  >
                                    {regeneratingQr === rental.rental_id ? (
                                      <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
                                    ) : (
                                      <QrCode className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
                                    )}
                                  </button>
                                )}
                                {/* Status change button */}
                                <button
                                  onClick={() => {
                                    setStatusChangeRental(rental);
                                    setStatusChangeModalOpen(true);
                                  }}
                                  disabled={updatingRentalStatus === rental.rental_id}
                                  className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50"
                                  style={{
                                    backgroundColor: withAlpha(accentMain, 0.15),
                                    borderColor: withAlpha(accentMain, 0.4),
                                    color: accentMain,
                                    border: "1.5px solid"
                                  }}
                                >
                                  {updatingRentalStatus === rental.rental_id ? (
                                    <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
                                  ) : (
                                    <Edit className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
                                  )}
                                </button>
                                {/* Message button with dropdown */}
                                {rental.documentSecret && (
                                  <div className="relative">
                                    <button
                                      onClick={() => setMessageMenuOpen(messageMenuOpen === rental.rental_id ? null : rental.rental_id)}
                                      disabled={sendingMessage === rental.rental_id}
                                      className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50"
                                      style={{
                                        backgroundColor: sendingMessage === rental.rental_id
                                          ? withAlpha("#8b5cf6", 0.25)
                                          : withAlpha("#8b5cf6", 0.15),
                                        borderColor: withAlpha("#8b5cf6", 0.4),
                                        color: "#8b5cf6",
                                        border: "1.5px solid"
                                      }}
                                      title="Отправить сообщение"
                                    >
                                      {sendingMessage === rental.rental_id ? (
                                        <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
                                      ) : (
                                        <MessageSquare className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
                                      )}
                                    </button>

                                    {/* Dropdown menu */}
                                    {messageMenuOpen === rental.rental_id && (
                                      <>
                                        {/* Backdrop */}
                                        <div
                                          className="fixed inset-0 z-40"
                                          onClick={() => setMessageMenuOpen(null)}
                                        />
                                        {/* Menu */}
                                        <div
                                          className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl py-1 min-w-[200px]"
                                          style={{
                                            backgroundColor: bgCard,
                                            borderColor: borderSoft,
                                            borderWidth: "1px",
                                          }}
                                        >
                                          <div className="px-2 py-1.5 border-b text-xs font-bold" style={{ borderColor: withAlpha(borderSoft, 0.3), color: textSecondary }}>
                                            Быстрые сообщения
                                          </div>
                                          {messageTemplates.map((template) => (
                                            <button
                                              key={template.id}
                                              onClick={() => void handleSendMessage(rental, template.key)}
                                              className="w-full px-3 py-2 text-left text-xs hover:opacity-80 transition-colors flex items-center gap-2"
                                              style={{ color: textPrimary }}
                                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = withAlpha(accentMain, 0.1)}
                                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                            >
                                              <Send className="w-3 h-3 flex-shrink-0" style={{ color: "#8b5cf6" }} />
                                              <span className="truncate">{template.name}</span>
                                            </button>
                                          ))}
                                          {messageTemplates.length === 0 && (
                                            <div className="px-3 py-2 text-xs" style={{ color: textSecondary }}>
                                              Нет шаблонов
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                                {/* Email button */}
                                {rental.documentSecret && (
                                  <button
                                    onClick={() => void handleSendEmail(rental)}
                                    disabled={sendingEmail === rental.rental_id}
                                    className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50 hidden sm:block"
                                    style={{
                                      backgroundColor: sendingEmail === rental.rental_id
                                        ? withAlpha("#06b6d4", 0.25)
                                        : withAlpha("#06b6d4", 0.15),
                                      borderColor: withAlpha("#06b6d4", 0.4),
                                      color: "#06b6d4",
                                      border: "1.5px solid"
                                    }}
                                    title="Отправить на email"
                                  >
                                    {sendingEmail === rental.rental_id ? (
                                      <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
                                    ) : (
                                      <Mail className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
                                    )}
                                  </button>
                                )}
                                {/* Mark as complete button */}
                                {rental.status !== "completed" && (
                                  <button
                                    onClick={() => void handleMarkComplete(rental)}
                                    disabled={completingRental === rental.rental_id}
                                    className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group disabled:opacity-50"
                                    style={{
                                      backgroundColor: completingRental === rental.rental_id
                                        ? withAlpha("#10b981", 0.25)
                                        : withAlpha("#10b981", 0.15),
                                      borderColor: withAlpha("#10b981", 0.4),
                                      color: "#10b981",
                                      border: "1.5px solid"
                                    }}
                                    title="Завершить аренду"
                                  >
                                    {completingRental === rental.rental_id ? (
                                      <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin relative z-10" />
                                    ) : (
                                      <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
                                    )}
                                  </button>
                                )}
                                {/* QR Share button - for crew members to quickly access rental */}
                                <button
                                  onClick={() => handleShareQr(rental)}
                                  className="relative px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-300 overflow-hidden group"
                                  style={{
                                    backgroundColor: withAlpha("#8b5cf6", 0.15),
                                    borderColor: withAlpha("#8b5cf6", 0.4),
                                    color: "#8b5cf6",
                                    border: "1.5px solid"
                                  }}
                                  title="Скопировать ссылку для быстрого доступа"
                                >
                                  <Share2 className="w-3 h-3 md:w-3.5 md:h-3.5 relative z-10" />
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
              </> // End table view
              )} {/* End calendar/table conditional */}

              {/* SALES LIST */}
              <SalesListSection
                sales={sales}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                accentMain={accentMain}
                bgCard={bgCard}
                borderSoft={borderSoft}
              />
              {/* COMMERCIAL PROPOSALS LIST */}
              <CommercialProposalsListSection
                proposals={proposals}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                bgCard={bgCard}
                borderSoft={borderSoft}
              />
              {/* PENDING SUBRENT APPLICATIONS + SUBRENT CONTRACTS */}
              <SubrentsSection
                pendingApplications={pendingApplications}
                processingApplication={processingApplication}
                onApprove={handleApproveApplication}
                onDecline={handleDeclineApplication}
                subrents={subrents}
                subrentsSummary={subrentsSummary}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                bgCard={bgCard}
                borderSoft={borderSoft}
              />
            </div>

            {/* Footer */}
            <div className="text-center py-3 md:py-4">
              <p className="text-[10px] md:text-xs" style={{ color: textSecondary }}>
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
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
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

      {/* Status Change Modal */}
      {statusChangeModalOpen && statusChangeRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: withAlpha("#000000", 0.5) }}
            onClick={() => setStatusChangeModalOpen(false)}
          />

          {/* Modal */}
          <div
            className="relative rounded-2xl p-6 max-w-sm w-full"
            style={{
              backgroundColor: bgCard,
              borderColor: withAlpha(borderSoft, 0.5),
              borderWidth: "1px",
              boxShadow: `0 20px 60px ${withAlpha("#000000", 0.3)}`,
            }}
          >
            <h3 className="text-lg font-black mb-4" style={{ color: textPrimary }}>
              Изменить статус
            </h3>
            <p className="text-sm mb-4" style={{ color: textSecondary }}>
              {statusChangeRental.vehicle?.make} {statusChangeRental.vehicle?.model}
              <br />
              <span className="text-xs">{statusChangeRental.user?.full_name || statusChangeRental.user?.username}</span>
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {([
                { value: "pending_confirmation", label: "Ожидает", icon: AlertCircle, color: "#fbbf24" },
                { value: "confirmed", label: "Подтв.", icon: CheckCircle2, color: "#34d399" },
                { value: "active", label: "Активна", icon: Clock, color: "#60a5fa" },
                { value: "completed", label: "Завершена", icon: CheckCircle2, color: "#4ade80" },
                { value: "cancelled", label: "Отменена", icon: XCircle, color: "#f87171" },
                { value: "disputed", label: "Спор", icon: AlertCircle, color: "#ef4444" },
              ] as const).map((status) => {
                const Icon = status.icon;
                const isSelected = statusChangeRental?.status === status.value;
                const isUpdating = updatingRentalStatus === statusChangeRental.rental_id;

                return (
                  <button
                    key={status.value}
                    onClick={() => void handleStatusChange(statusChangeRental, status.value)}
                    disabled={isUpdating}
                    className="relative px-3 py-2 rounded-lg text-xs font-bold transition-all duration-300 disabled:opacity-50 overflow-hidden"
                    style={
                      isSelected
                        ? {
                            backgroundColor: `linear-gradient(135deg, ${withAlpha(status.color, 0.25)}, ${withAlpha(status.color, 0.15)})`,
                            borderColor: withAlpha(status.color, 0.4),
                            color: status.color,
                            borderWidth: "1.5px",
                            boxShadow: `0 0 15px ${withAlpha(status.color, 0.2)}`
                          }
                        : {
                            backgroundColor: withAlpha(bgCard, 0.6),
                            borderColor: borderSoft,
                            color: textSecondary,
                            borderWidth: "1px"
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isSelected && !isUpdating) {
                        e.currentTarget.style.borderColor = status.color;
                        e.currentTarget.style.color = status.color;
                        e.currentTarget.style.backgroundColor = withAlpha(status.color, 0.1);
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !isUpdating) {
                        e.currentTarget.style.borderColor = borderSoft;
                        e.currentTarget.style.color = textSecondary;
                        e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.6);
                      }
                    }}
                  >
                    {isUpdating ? (
                      <RefreshCw className="w-4 h-4 mx-auto animate-spin" style={{ color: status.color }} />
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" style={{ color: isSelected ? status.color : textSecondary }} />
                        <span>{status.label}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStatusChangeModalOpen(false)}
              className="w-full px-4 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                backgroundColor: withAlpha(borderSoft, 0.2),
                color: textSecondary,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = withAlpha(borderSoft, 0.3)}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = withAlpha(borderSoft, 0.2)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}