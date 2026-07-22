"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike,
  TrendingUp,
  Wrench,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";
import type {
  Mode,
  StageKey,
  FilterFlags,
  SortModeV2,
  LeadSignal,
} from "@/app/franchize/[slug]/leads/leads-constants";

// Hooks
// Note: useFilteredSortedLeads is also exported from this module but its v1
// signature (SortMode, Segment) doesn't fit the v2 types (SortModeV2,
// FilterFlags). The filter+sort pipeline is reimplemented inline below.
import { useTodosMapping } from "./hooks/useLeadsData";

// Lib
import {
  computeLeadStage,
  computeQrStatus,
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
} from "@/app/franchize/[slug]/leads/lib/pipeline-stages";
import { computeLeadSignals, isHotLead } from "@/app/franchize/[slug]/leads/lib/sla-signals";
import { DISMISS_REASONS } from "@/app/franchize/[slug]/leads/lib/dismiss-reasons";
import { dismissLeadWithReason } from "@/app/franchize/[slug]/leads/lib/leads-dismiss";
import { getLeadsKpis, type LeadsKpis } from "@/app/franchize/server-actions/leads-kpis";
import { createLeadNote } from "@/app/franchize/server-actions/lead-notes";

// Components
import { LeadsAppShell } from "./LeadsAppShell";
import { LeadsToolbar } from "./LeadsToolbar";
import { LeadsKPICards } from "./LeadsKPICards";
import { PipelineFunnelBar, type PipelineStage } from "./PipelineFunnelBar";
import { SegmentChips, type SegmentChip } from "./SegmentChips";
import { LeadList } from "./LeadList";
import { LeadBoard } from "./LeadBoard";
import { LeadDetailContent } from "./LeadDetailContent";
import { MobileLeadSheet } from "./MobileLeadSheet";
import { DismissLeadDialog } from "./DismissLeadDialog";
import { EmptyState } from "./EmptyState";

// ── Types ───────────────────────────────────────────────────────────────────

interface LeadsClientProps {
  leads: LeadRow[];
  todos: LeadTodoRow[];
  crewId: string;
  slug: string;
  accentColor: string;
  textColor?: string;
  bgColor?: string;
  isLightTheme?: boolean;
  isAuto?: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Intent types grouped by Mode — matches getLeadsKpis server action. */
const MODE_INTENTS: Record<Mode, string[]> = {
  rent: [
    "rent", "test_drive", "test_ride_click", "checkout_start", "prebuy",
    "trade_in", "finance", "hold_created", "payment_failure", "payment_success",
    "map_click", "contact_click",
  ],
  sale: ["sale"],
  service: ["service"],
};

const MODE_TABS: Array<{ value: Mode; label: string; icon: LucideIcon; color: string }> = [
  { value: "rent", label: "Аренда", icon: Bike, color: "#22c55e" },
  { value: "sale", label: "Продажа", icon: TrendingUp, color: "#f59e0b" },
  { value: "service", label: "Сервис", icon: Wrench, color: "#3b82f6" },
];

const DEFAULT_FILTER_FLAGS: FilterFlags = {
  overdueOnly: false,
  unclaimedQrOnly: false,
  documentsMissingOnly: false,
  activeRentalOnly: false,
  returnDueOnly: false,
  dismissedOnly: false,
  hideOperatorPlaceholders: false,
};

// ── Main Component ──────────────────────────────────────────────────────────

export function LeadsClient({
  leads,
  todos,
  crewId,
  slug,
  accentColor,
  textColor = "#e5e7eb",
  bgColor = "#0a0a0a",
  isLightTheme = false,
  isAuto = false,
}: LeadsClientProps) {
  const router = useRouter();

  // ── Theme tokens (built inline to avoid pulling useTheme's full API) ──
  const T: ThemeTokens = useMemo(() => {
    if (isAuto) {
      return {
        text: "var(--franchize-text-primary)",
        textMuted: "var(--franchize-text-secondary)",
        textFaint: "color-mix(in srgb, var(--franchize-text-secondary) 65%, transparent)",
        bg: "var(--franchize-bg-base)",
        bgCard: "color-mix(in srgb, var(--franchize-bg-card) 96%, transparent)",
        bgCardHover: "color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)",
        bgElevated: "var(--franchize-bg-card)",
        border: "color-mix(in srgb, var(--franchize-border-soft) 45%, transparent)",
        borderSoft: "color-mix(in srgb, var(--franchize-border-soft) 25%, transparent)",
        borderActive: "var(--franchize-accent-main)",
        inputBg: "var(--franchize-bg-base)",
        inputBorder: "color-mix(in srgb, var(--franchize-border-soft) 55%, transparent)",
        shadow: "0 4px 24px color-mix(in srgb, var(--franchize-accent-main) 6%, transparent)",
        accent: "var(--franchize-accent-main)",
        accentContrast: "var(--franchize-accent-contrast)",
      };
    }
    return {
      text: isLightTheme ? "#1e293b" : textColor,
      textMuted: isLightTheme ? "#64748b" : `${textColor}99`,
      textFaint: isLightTheme ? "#94a3b8" : `${textColor}60`,
      bg: isLightTheme ? "#f8fafc" : bgColor,
      bgCard: isLightTheme ? "#ffffff" : `${accentColor}08`,
      bgCardHover: isLightTheme ? "#f1f5f9" : `${accentColor}12`,
      bgElevated: isLightTheme ? "#ffffff" : `${accentColor}10`,
      border: isLightTheme ? "#e2e8f0" : `${accentColor}22`,
      borderSoft: isLightTheme ? "#f1f5f9" : `${accentColor}12`,
      borderActive: accentColor,
      inputBg: isLightTheme ? "#ffffff" : `${accentColor}0a`,
      inputBorder: isLightTheme ? "#cbd5e1" : `${accentColor}30`,
      shadow: isLightTheme ? "0 4px 20px rgba(0,0,0,0.08)" : "0 4px 24px rgba(0,0,0,0.35)",
      accent: accentColor,
      accentContrast: isLightTheme ? "#16130A" : "#ffffff",
    };
  }, [isAuto, isLightTheme, textColor, bgColor, accentColor]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortModeV2>("recent");
  const [mode, setMode] = useState<Mode>("rent");
  const [activeStageFilter, setActiveStageFilter] = useState<StageKey | null>(null);
  const [filterFlags, setFilterFlags] = useState<FilterFlags>(DEFAULT_FILTER_FLAGS);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [activeSegment, setActiveSegment] = useState<string>("all");
  // Source / owner dropdown filters. Previously referenced but never declared,
  // which broke the toolbar (TS2304: Cannot find name 'sourceFilter') AND meant
  // changing the dropdowns had no effect on the list.
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  const [kpis, setKpis] = useState<LeadsKpis | null>(null);
  const [leadsState, setLeadsState] = useState<LeadRow[]>(leads);
  const [todosState, setTodosState] = useState<LeadTodoRow[]>(todos);

  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [dismissLeadId, setDismissLeadId] = useState<string | null>(null);

  // ── Writable leads/todos state syncs with prop changes ──
  // NOTE: leads/todos state is initialized once from props.
  // Do NOT sync on every prop change — that would clobber optimistic updates.
  // router.refresh() will cause a re-render with new prop refs, but we preserve
  // the writable state by only initializing on mount.
  // If server data changes significantly, the user can pull-to-refresh manually.

  // ── Debounce search ──
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Fetch KPIs (server action) when mode changes ──
  useEffect(() => {
    let cancelled = false;
    getLeadsKpis(slug, mode)
      .then((result) => {
        if (!cancelled) setKpis(result);
      })
      .catch(() => {
        if (!cancelled) setKpis({ totalLeads: 0, hotLeads: 0, conversionRate: 0, monthlyRevenue: 0 });
      });
    return () => { cancelled = true; };
  }, [slug, mode]);

  // ── Todo mapping hook ──
  const { getTodosForLead } = useTodosMapping(todosState);

  // ── getLeadSignals: compute signals on-the-fly for a single lead ──
  const getLeadSignals = useCallback(
    (lead: LeadRow): LeadSignal[] => {
      const enriched = {
        ...lead,
        stageKey: (lead as { stageKey?: string }).stageKey || computeLeadStage(lead),
        qrStatus: (lead as { qrStatus?: string }).qrStatus || computeQrStatus(lead),
      };
      return computeLeadSignals(enriched, todosState);
    },
    [todosState]
  );

  // ── Filter pipeline: mode → stage → search → source/owner → filterFlags → segment → sort ──

  // 1. Mode filter (by intent_type)
  const modeFilteredLeads = useMemo(() => {
    const allowed = MODE_INTENTS[mode];
    return leadsState.filter((l) => allowed.includes(l.intentType || ""));
  }, [leadsState, mode]);

  // 2. Enrich each lead with computed stageKey + qrStatus (memoized)
  const enrichedLeads = useMemo(() => {
    return modeFilteredLeads.map((l) => ({
      ...l,
      stageKey: (l as { stageKey?: string }).stageKey || computeLeadStage(l),
      qrStatus: (l as { qrStatus?: string }).qrStatus || computeQrStatus(l),
    })) as Array<LeadRow & { stageKey: StageKey; qrStatus: string }>;
  }, [modeFilteredLeads]);

  // 3. Stage filter
  const stageFilteredLeads = useMemo(() => {
    if (!activeStageFilter) return enrichedLeads;
    return enrichedLeads.filter((l) => l.stageKey === activeStageFilter);
  }, [enrichedLeads, activeStageFilter]);

  // 4. Search filter
  const searchFilteredLeads = useMemo(() => {
    if (!debouncedSearch.trim()) return stageFilteredLeads;
    const q = debouncedSearch.toLowerCase();
    return stageFilteredLeads.filter((l) =>
      (l.full_name || "").toLowerCase().includes(q) ||
      (l.phone || "").includes(q) ||
      (l.username || "").toLowerCase().includes(q) ||
      (l.bikeTitle || "").toLowerCase().includes(q) ||
      (l.sourceRoute || "").toLowerCase().includes(q)
    );
  }, [stageFilteredLeads, debouncedSearch]);

  // 4b. Source + owner dropdown filters. Previously these state values were
  // referenced by the toolbar but never declared and never applied here, so
  // changing the dropdowns had no visible effect on the list.
  const sourceOwnerFilteredLeads = useMemo(() => {
    let result = searchFilteredLeads;
    if (sourceFilter !== "all") {
      result = result.filter((l) => l.source === sourceFilter);
    }
    if (ownerFilter !== "all") {
      // Match either ownerId or ownerName so the dropdown keeps working even
      // when the owner has a name but the lead only stores the id (or vice versa).
      result = result.filter(
        (l) => l.ownerId === ownerFilter || l.ownerName === ownerFilter
      );
    }
    return result;
  }, [searchFilteredLeads, sourceFilter, ownerFilter]);

  // 5. FilterFlags (overdue, qr, docs, active, returnDue, dismissed, hideOperatorPlaceholders)
  const flagFilteredLeads = useMemo(() => {
    const now = Date.now();
    return sourceOwnerFilteredLeads.filter((l) => {
      const leadTodos = getTodosForLead(l);
      const hasOverdueTodo = leadTodos.some(
        (t) => !!(t as { due_date?: string | null }).due_date &&
          new Date((t as { due_date?: string | null }).due_date!).getTime() < now &&
          t.status !== "done"
      );
      const hasMissingDocs = l.rentals.some(
        (r) => !r.passportMainpagePhoto || !r.passportRegistrationPhoto || !r.driversLicenceFrontalPhoto
      );
      const hasActiveRental = l.rentals.some((r) => r.status === "active");
      const hasReturnDue = l.rentals.some(
        (r) => r.status === "active" && r.endDate && new Date(r.endDate).getTime() - now < 24 * 60 * 60 * 1000
      );
      const isDismissed = l.stageKey === "closed_lost" || l.intentStage === "dismissed";
      const isOperatorPlaceholder = l.identityState === "operator_placeholder" && l.rentals.length === 0 && l.sales.length === 0 && leadTodos.length === 0;

      if (filterFlags.overdueOnly && !hasOverdueTodo) return false;
      if (filterFlags.unclaimedQrOnly && l.qrStatus !== "unclaimed") return false;
      if (filterFlags.documentsMissingOnly && !hasMissingDocs) return false;
      if (filterFlags.activeRentalOnly && !hasActiveRental) return false;
      if (filterFlags.returnDueOnly && !hasReturnDue) return false;
      if (filterFlags.dismissedOnly && !isDismissed) return false;
      if (filterFlags.hideOperatorPlaceholders && isOperatorPlaceholder) return false;
      return true;
    });
  }, [sourceOwnerFilteredLeads, filterFlags, getTodosForLead]);

  // 6. Segment filter (All / Hot / Overdue / Clients)
  const segmentFilteredLeads = useMemo(() => {
    if (activeSegment === "all") return flagFilteredLeads;
    return flagFilteredLeads.filter((l) => {
      if (activeSegment === "hot") return isHotLead(l, todosState);
      if (activeSegment === "overdue") {
        const leadTodos = getTodosForLead(l);
        return leadTodos.some(
          (t) => !!(t as { due_date?: string | null }).due_date &&
            new Date((t as { due_date?: string | null }).due_date!).getTime() < Date.now() &&
            t.status !== "done"
        );
      }
      if (activeSegment === "clients") return l.verified || l.rentals.length > 0 || l.sales.length > 0;
      return true;
    });
  }, [flagFilteredLeads, activeSegment, todosState, getTodosForLead]);

  // 7. Sort
  const sortedLeads = useMemo(() => {
    const arr = [...segmentFilteredLeads];
    const byRecency = (a: LeadRow, b: LeadRow) =>
      new Date(b.lastSeenAt || b.createdAt || 0).getTime() - new Date(a.lastSeenAt || a.createdAt || 0).getTime();

    switch (sortMode) {
      case "urgent":
        return arr.sort((a, b) => {
          const aT = getTodosForLead(a).filter((t) => t.status !== "done").length;
          const bT = getTodosForLead(b).filter((t) => t.status !== "done").length;
          const aScore = (a.urgencyScore || 0) + aT * 20;
          const bScore = (b.urgencyScore || 0) + bT * 20;
          if (aScore !== bScore) return bScore - aScore;
          return byRecency(a, b);
        });
      case "name":
        return arr.sort((a, b) => (a.full_name || "яя").localeCompare(b.full_name || "яя", "ru"));
      case "spent":
        return arr.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
      case "sla":
        return arr.sort((a, b) => {
          const aS = getLeadSignals(a);
          const bS = getLeadSignals(b);
          const aP = aS[0]?.priority ?? -1;
          const bP = bS[0]?.priority ?? -1;
          if (aP !== bP) return bP - aP;
          return byRecency(a, b);
        });
      case "return_due":
        return arr.sort((a, b) => {
          const aEnd = a.rentals.find((r) => r.status === "active")?.endDate;
          const bEnd = b.rentals.find((r) => r.status === "active")?.endDate;
          if (!aEnd && !bEnd) return byRecency(a, b);
          if (!aEnd) return 1;
          if (!bEnd) return -1;
          return new Date(aEnd).getTime() - new Date(bEnd).getTime();
        });
      case "overdue_todos":
        return arr.sort((a, b) => {
          const aO = getTodosForLead(a).filter((t) => (t as { due_date?: string | null }).due_date && new Date((t as { due_date?: string | null }).due_date!).getTime() < Date.now() && t.status !== "done").length;
          const bO = getTodosForLead(b).filter((t) => (t as { due_date?: string | null }).due_date && new Date((t as { due_date?: string | null }).due_date!).getTime() < Date.now() && t.status !== "done").length;
          if (aO !== bO) return bO - aO;
          return byRecency(a, b);
        });
      case "recent":
      default:
        return arr.sort(byRecency);
    }
  }, [segmentFilteredLeads, sortMode, getTodosForLead, getLeadSignals]);

  // ── Pipeline stage counts (from filtered leads) ──
  const pipelineStages: PipelineStage[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of enrichedLeads) {
      counts.set(l.stageKey, (counts.get(l.stageKey) || 0) + 1);
    }
    return PIPELINE_STAGES.map((s) => ({
      key: s.key,
      label: STAGE_LABELS[s.key] || s.key,
      color: STAGE_COLORS[s.key] || "#64748b",
      count: counts.get(s.key) || 0,
    }));
  }, [enrichedLeads]);

  // ── Segment chips data ──
  const segmentChips: SegmentChip[] = useMemo(() => {
    const hotCount = enrichedLeads.filter((l) => isHotLead(l, todosState)).length;
    const overdueCount = enrichedLeads.filter((l) => {
      const ts = getTodosForLead(l);
      return ts.some((t) => (t as { due_date?: string | null }).due_date && new Date((t as { due_date?: string | null }).due_date!).getTime() < Date.now() && t.status !== "done");
    }).length;
    const clientsCount = enrichedLeads.filter((l) => l.verified || l.rentals.length > 0 || l.sales.length > 0).length;
    return [
      { key: "all", label: "Все", count: enrichedLeads.length, color: T.accent },
      { key: "hot", label: "Горячие", count: hotCount, color: "#ef4444" },
      { key: "overdue", label: "Просроченные", count: overdueCount, color: "#f59e0b" },
      { key: "clients", label: "Клиенты", count: clientsCount, color: "#22c55e" },
    ];
  }, [enrichedLeads, todosState, getTodosForLead, T.accent]);

  // ── Leads by stage (for board view) ──
  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadRow[]> = {};
    for (const s of PIPELINE_STAGES) map[s.key] = [];
    for (const l of sortedLeads) {
      const key = l.stageKey || "new";
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    return map;
  }, [sortedLeads]);

  // ── Selected lead + its todos ──
  const selectedLead = useMemo(
    () => sortedLeads.find((l) => l.user_id === selectedId) || null,
    [sortedLeads, selectedId]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFilterFlagsChange = useCallback((patch: Partial<FilterFlags>) => {
    setFilterFlags((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleStageSelect = useCallback((key: string) => {
    setActiveStageFilter((prev) => (prev === key ? null : (key as StageKey)));
  }, []);

  const handleSelectLead = useCallback((lead: LeadRow) => {
    setSelectedId(lead.user_id);
  }, []);

  const handleDismissLeadRequest = useCallback((leadId: string) => {
    setDismissLeadId(leadId);
    setDismissDialogOpen(true);
  }, []);

  const handleDismissLeadConfirm = useCallback(
    async (reason: string, note: string) => {
      if (!dismissLeadId) return;
      const targetId = dismissLeadId;
      // Optimistic remove
      setLeadsState((prev) => prev.filter((l) => l.user_id !== targetId));
      setSelectedId((prev) => (prev === targetId ? null : prev));
      setDismissDialogOpen(false);
      setDismissLeadId(null);
      try {
        await dismissLeadWithReason({
          slug,
          leadId: targetId,
          reason,
          note: note || undefined,
        });
      } catch {
        // Server action will log; revert would require re-fetch.
      }
      router.refresh();
    },
    [dismissLeadId, slug, router]
  );

  const handleTodoUpdate = useCallback(
    (action: "toggle" | "delete" | "add", todoId: string, todo?: LeadTodoRow) => {
      setTodosState((prev) => {
        if (action === "toggle") {
          return prev.map((t) =>
            t.id === todoId ? { ...t, status: t.status === "done" ? "pending" : "done" } : t
          );
        }
        if (action === "delete") return prev.filter((t) => t.id !== todoId);
        if (action === "add" && todo) return [todo, ...prev];
        return prev;
      });
    },
    []
  );

  // Todo CRUD handlers used by LeadDetailContent
  const handleCreateTodo = useCallback(
    async (title: string) => {
      if (!selectedLead) return;
      const newTodo: LeadTodoRow = {
        id: `tmp-${Date.now()}`,
        lead_id: selectedLead.user_id,
        user_id: selectedLead.user_id,
        phone: selectedLead.phone,
        rental_id: selectedLead.rentals[0]?.rentalId || null,
        title,
        description: null,
        status: "pending",
        priority: "medium",
        category: "manual",
        created_at: new Date().toISOString(),
        completed_at: null,
        assigned_to: null,
      };
      handleTodoUpdate("add", newTodo.id, newTodo);
      // Fire-and-forget server create via API route
      try {
        await fetch("/api/franchize/lead-todo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            crewId,
            leadId: selectedLead.user_id,
            title,
            phone: selectedLead.phone,
            rentalId: selectedLead.rentals[0]?.rentalId || null,
          }),
        });
        router.refresh();
      } catch {
        /* network error — optimistic state already updated */
      }
    },
    [selectedLead, slug, crewId, handleTodoUpdate, router]
  );

  const handleToggleTodo = useCallback(
    async (todoId: string) => {
      handleTodoUpdate("toggle", todoId);
      try {
        await fetch("/api/franchize/lead-todo", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todoId, slug, crewId, action: "toggle" }),
        });
        router.refresh();
      } catch {
        /* network error */
      }
    },
    [handleTodoUpdate, slug, crewId, router]
  );

  const handleDeleteTodo = useCallback(
    async (todoId: string) => {
      handleTodoUpdate("delete", todoId);
      try {
        await fetch("/api/franchize/lead-todo", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todoId, slug, crewId }),
        });
        router.refresh();
      } catch {
        /* network error */
      }
    },
    [handleTodoUpdate, slug, crewId, router]
  );

  const [notesState, setNotesState] = useState<Array<{ id: string; text: string; created_at: string; created_by: string | null }>>([]);

  // Reset notes when the selected lead changes
  useEffect(() => {
    setNotesState([]);
  }, [selectedId]);

  const handleAddNote = useCallback(
    async (text: string) => {
      if (!selectedLead) return;
      // Optimistic add to local state so the drawer + history update immediately
      const optimisticNote = {
        id: `tmp-${Date.now()}`,
        text,
        created_at: new Date().toISOString(),
        created_by: null,
      };
      setNotesState((prev) => [optimisticNote, ...prev]);
      try {
        await createLeadNote({
          leadId: selectedLead.user_id,
          crewId,
          text,
        });
        router.refresh();
      } catch {
        /* network error — optimistic state already updated */
      }
    },
    [selectedLead, crewId, router]
  );

  const handleDrawerAction = useCallback(
    (action: string) => {
      if (action === "dismiss") {
        if (selectedLead) handleDismissLeadRequest(selectedLead.user_id);
        return;
      }
      if (action === "call" && selectedLead?.phone) {
        window.open(`tel:${selectedLead.phone}`, "_self");
        return;
      }
      if (action === "telegram" && selectedLead?.username) {
        window.open(`https://t.me/${selectedLead.username}`, "_blank");
        return;
      }
      // Other actions (notify, request_docs, resend_qr, open_contract, etc.) — handled by sub-components.
    },
    [selectedLead, handleDismissLeadRequest]
  );

  // ── Available sources for the toolbar dropdown ──
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const l of leadsState) set.add(l.source);
    return Array.from(set);
  }, [leadsState]);

  // ── Available owners for the toolbar dropdown ──
  // Uses ownerName when available, falls back to ownerId. Skips null/empty.
  const availableOwners = useMemo(() => {
    const set = new Set<string>();
    for (const l of leadsState) {
      const name = l.ownerName || l.ownerId;
      if (name) set.add(name);
    }
    return Array.from(set);
  }, [leadsState]);

  // ── Whether any filter is currently active (drives EmptyState copy + reset) ──
  const hasActiveFilters = useMemo(() => {
    return (
      !!debouncedSearch.trim() ||
      sourceFilter !== "all" ||
      ownerFilter !== "all" ||
      activeStageFilter !== null ||
      activeSegment !== "all" ||
      Object.values(filterFlags).some(Boolean)
    );
  }, [debouncedSearch, sourceFilter, ownerFilter, activeStageFilter, activeSegment, filterFlags]);

  // ── Reset ALL filters (used by EmptyState "Сбросить фильтры" button) ──
  const handleResetAllFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSourceFilter("all");
    setOwnerFilter("all");
    setActiveStageFilter(null);
    setActiveSegment("all");
    setFilterFlags(DEFAULT_FILTER_FLAGS);
  }, []);

  // ── Selected lead's todos (for the detail drawer) ──
  const selectedLeadTodos = useMemo(
    () => (selectedLead ? getTodosForLead(selectedLead) : []),
    [selectedLead, getTodosForLead]
  );

  // ── Dismiss dialog lead object ──
  const dismissLead = useMemo(
    () => leadsState.find((l) => l.user_id === dismissLeadId) || null,
    [leadsState, dismissLeadId]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <LeadsAppShell T={T}>
      <div className="space-y-5">
        {/* Mode tabs + "Без операторов" toggle */}
        <ModeTabsRow
          mode={mode}
          onModeChange={setMode}
          hideOperatorPlaceholders={filterFlags.hideOperatorPlaceholders}
          onToggleHideOperators={() =>
            handleFilterFlagsChange({
              hideOperatorPlaceholders: !filterFlags.hideOperatorPlaceholders,
            })
          }
          T={T}
        />

        {/* 1. Toolbar */}
        <LeadsToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          sortValue={sortMode}
          onSortChange={(v) => setSortMode(v as SortModeV2)}
          sourceValue={sourceFilter}
          onSourceChange={setSourceFilter}
          availableSources={availableSources}
          ownerValue={ownerFilter}
          onOwnerChange={setOwnerFilter}
          availableOwners={availableOwners}
          stageValue={activeStageFilter || "all"}
          onStageChange={(v) => setActiveStageFilter(v === "all" ? null : (v as StageKey))}
          filterFlags={filterFlags}
          onFilterFlagsChange={handleFilterFlagsChange}
          viewMode={viewMode}
          onViewModeChange={(v) => setViewMode(v as "list" | "board")}
          onExport={() => {
            // Future: CSV export
          }}
          T={T}
        />

        {/* 2. KPI cards */}
        {kpis && <LeadsKPICards kpis={kpis} T={T} />}

        {/* 3. Pipeline funnel */}
        <PipelineFunnelBar
          stages={pipelineStages}
          activeStage={activeStageFilter}
          onStageSelect={handleStageSelect}
          T={T}
        />

        {/* 4. Segment chips */}
        <SegmentChips
          segments={segmentChips}
          activeSegment={activeSegment}
          onChange={setActiveSegment}
          T={T}
        />

        {/* 5. Lead list OR board */}
        <AnimatePresence mode="wait">
          {viewMode === "board" ? (
            <motion.div
              key="board-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <LeadBoard
                leadsByStage={leadsByStage}
                selectedLeadId={selectedId}
                onSelectLead={handleSelectLead}
                getLeadSignals={getLeadSignals}
                T={T}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <LeadList
                leads={sortedLeads}
                selectedLeadId={selectedId}
                onSelectLead={handleSelectLead}
                onDismissLead={handleDismissLeadRequest}
                getTodosForLead={getTodosForLead}
                getLeadSignals={getLeadSignals}
                T={T}
                crewId={crewId}
                slug={slug}
                emptyState={
                  <EmptyState
                    hasFilters={hasActiveFilters}
                    searchQuery={searchQuery}
                    onReset={handleResetAllFilters}
                    T={T}
                  />
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 6. Detail panel — desktop (right-side drawer overlay) */}
        <div className="hidden lg:block">
          <AnimatePresence>
            {selectedLead && (
              <LeadDetailContent
                key={selectedLead.user_id}
                lead={selectedLead}
                todos={selectedLeadTodos}
                notes={notesState}
                T={T}
                onClose={() => setSelectedId(null)}
                onAction={handleDrawerAction}
                onCreateTodo={handleCreateTodo}
                onToggleTodo={handleToggleTodo}
                onDeleteTodo={handleDeleteTodo}
                onAddNote={handleAddNote}
                onDismissLead={() => handleDismissLeadRequest(selectedLead.user_id)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* 6. Detail panel — mobile (bottom sheet wrapping LeadDetailContent) */}
        <MobileLeadSheet
          open={!!selectedLead}
          onClose={() => setSelectedId(null)}
          title={selectedLead?.full_name || selectedLead?.phone || undefined}
          T={T}
        >
          {selectedLead && (
            <LeadDetailContent
              key={`mobile-${selectedLead.user_id}`}
              lead={selectedLead}
              todos={selectedLeadTodos}
              notes={notesState}
              T={T}
              onClose={() => setSelectedId(null)}
              onAction={handleDrawerAction}
              onCreateTodo={handleCreateTodo}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              onAddNote={handleAddNote}
              onDismissLead={() => handleDismissLeadRequest(selectedLead.user_id)}
            />
          )}
        </MobileLeadSheet>

        {/* 7. Dismiss dialog */}
        <DismissLeadDialog
          open={dismissDialogOpen}
          lead={dismissLead}
          reasons={DISMISS_REASONS}
          T={T}
          onSubmit={handleDismissLeadConfirm}
          onCancel={() => {
            setDismissDialogOpen(false);
            setDismissLeadId(null);
          }}
        />
      </div>
    </LeadsAppShell>
  );
}

// ── Mode tabs + "Без операторов" toggle row ─────────────────────────────────

interface ModeTabsProps {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  hideOperatorPlaceholders: boolean;
  onToggleHideOperators: () => void;
  T: ThemeTokens;
}

function ModeTabsRow({
  mode,
  onModeChange,
  hideOperatorPlaceholders,
  onToggleHideOperators,
  T,
}: ModeTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mode tabs */}
      <div
        className="inline-flex rounded-full border p-1"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
        role="tablist"
        aria-label="Режим пайплайна"
      >
        {MODE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.value;
          return (
            <motion.button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onModeChange(tab.value)}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition"
              style={
                active
                  ? { background: tab.color, color: "#0a0a0a", boxShadow: `0 6px 18px ${tab.color}40` }
                  : { color: T.textMuted }
              }
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* "Без операторов" toggle */}
      <button
        type="button"
        onClick={onToggleHideOperators}
        className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition"
        style={
          hideOperatorPlaceholders
            ? { borderColor: `${T.accent}40`, background: `${T.accent}14`, color: T.accent }
            : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: T.textMuted }
        }
        aria-pressed={hideOperatorPlaceholders}
        title="Скрывать лиды, созданные операторами как заглушки (нет реальной активности)"
      >
        <EyeOff className="h-3.5 w-3.5" />
        Без операторов
      </button>
    </div>
  );
}
