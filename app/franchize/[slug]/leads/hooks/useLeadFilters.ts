// /app/franchize/[slug]/leads/hooks/useLeadFilters.ts
//
// Extracted from LeadsClient — all filter/sort/segment logic in one hook.
// Reduces LeadsClient from ~995 lines to ~700 by moving the filter pipeline here.
//
// Usage:
//   const filters = useLeadFilters({ leadsState, todosState, getTodosForLead });
//   const { sortedLeads, enrichedLeads, segmentChips, hasActiveFilters, ... } = filters;

"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import type {
  Mode,
  StageKey,
  SortModeV2,
  FilterFlags,
  LeadSignal,
} from "../leads-constants";
import {
  computeLeadStage,
  computeQrStatus,
  PIPELINE_STAGES,
  STAGE_LABELS,
} from "../lib/pipeline-stages";
import { computeLeadSignals, isHotLead } from "../lib/sla-signals";
import { SORT_OPTIONS } from "../leads-constants";

const MODE_INTENTS: Record<Mode, string[]> = {
  rent: [
    "rent", "test_drive", "test_ride_click", "checkout_start", "prebuy",
    "trade_in", "finance", "hold_created", "payment_failure", "payment_success",
    "map_click", "contact_click",
  ],
  sale: ["sale"],
  service: ["service"],
};

const DEFAULT_FILTER_FLAGS: FilterFlags = {
  overdueOnly: false,
  unclaimedQrOnly: false,
  documentsMissingOnly: false,
  activeRentalOnly: false,
  returnDueOnly: false,
  dismissedOnly: false,
  hideOperatorPlaceholders: false,
};

export interface SegmentChip {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface PipelineStage {
  key: string;
  label: string;
  color: string;
  count: number;
}

interface UseLeadFiltersProps {
  leadsState: LeadRow[];
  todosState: LeadTodoRow[];
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[];
  getLeadSignals: (lead: LeadRow) => LeadSignal[];
}

export function useLeadFilters({
  leadsState,
  todosState,
  getTodosForLead,
  getLeadSignals,
}: UseLeadFiltersProps) {
  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortModeV2>("recent");
  const [mode, setMode] = useState<Mode>("rent");
  const [activeStageFilter, setActiveStageFilter] = useState<StageKey | null>(null);
  const [filterFlags, setFilterFlags] = useState<FilterFlags>(DEFAULT_FILTER_FLAGS);
  const [activeSegment, setActiveSegment] = useState<string>(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("segment") || "all"
      : "all"
  );
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  // ── Debounce search ──
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── 1. Mode filter ──
  const modeFilteredLeads = useMemo(() => {
    const allowed = MODE_INTENTS[mode];
    return leadsState.filter((l) => l && allowed.includes(l.intentType || ""));
  }, [leadsState, mode]);

  // ── 2. Enrich with stageKey + qrStatus ──
  const enrichedLeads = useMemo(() => {
    return modeFilteredLeads
      .filter((l): l is LeadRow => !!l)
      .map((l) => {
        let stageKey: StageKey;
        try {
          stageKey = ((l as { stageKey?: string }).stageKey as StageKey) || computeLeadStage(l);
        } catch {
          stageKey = "new";
        }
        let qrStatus: string;
        try {
          qrStatus = (l as { qrStatus?: string }).qrStatus || computeQrStatus(l);
        } catch {
          qrStatus = "unclaimed";
        }
        return { ...l, stageKey, qrStatus };
      }) as Array<LeadRow & { stageKey: StageKey; qrStatus: string }>;
  }, [modeFilteredLeads]);

  // ── 3. Stage filter ──
  const stageFilteredLeads = useMemo(() => {
    if (!activeStageFilter) return enrichedLeads;
    return enrichedLeads.filter((l) => l && l.stageKey === activeStageFilter);
  }, [enrichedLeads, activeStageFilter]);

  // ── 4. Search filter ──
  const searchFilteredLeads = useMemo(() => {
    if (!debouncedSearch.trim()) return stageFilteredLeads;
    const q = debouncedSearch.toLowerCase();
    return stageFilteredLeads.filter((l) => {
      if (!l) return false;
      return (
        (l.full_name || "").toLowerCase().includes(q) ||
        (l.phone || "").toLowerCase().includes(q) ||
        (l.username || "").toLowerCase().includes(q) ||
        (l.bikeTitle || "").toLowerCase().includes(q) ||
        (l.user_id || "").toLowerCase().includes(q) ||
        (l.sourceRoute || "").toLowerCase().includes(q)
      );
    });
  }, [stageFilteredLeads, debouncedSearch]);

  // ── 5. Source/owner filter ──
  const sourceOwnerFilteredLeads = useMemo(() => {
    return searchFilteredLeads.filter((l) => {
      if (!l) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (ownerFilter !== "all") {
        return l.ownerId === ownerFilter || l.ownerName === ownerFilter;
      }
      return true;
    });
  }, [searchFilteredLeads, sourceFilter, ownerFilter]);

  // ── 6. Filter flags ──
  const flagFilteredLeads = useMemo(() => {
    const now = Date.now();
    return sourceOwnerFilteredLeads.filter((l) => {
      if (!l) return false;
      const leadTodos = getTodosForLead(l);
      const hasOverdueTodo = leadTodos.some(
        (t) => !!t.due_date && new Date(t.due_date).getTime() < now && t.status !== "done"
      );
      const hasMissingDocs =
        l.rentals.length > 0 &&
        !(l.rentals[0] as { passportMainpagePhoto?: string }).passportMainpagePhoto;
      const hasActiveRental = l.rentals.some((r) => r.status === "active");
      const hasReturnDue = l.rentals.some(
        (r) => r.status === "active" && r.endDate && new Date(r.endDate).getTime() - now < 24 * 60 * 60 * 1000
      );
      const isDismissed = (l && (l.stageKey === "closed_lost" || l.intentStage === "dismissed")) || false;
      const isOperatorPlaceholder =
        l.identityState === "operator_placeholder" && l.rentals.length === 0 && l.sales.length === 0 && leadTodos.length === 0;

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

  // ── 7. Segment filter ──
  const segmentFilteredLeads = useMemo(() => {
    if (activeSegment === "all") return flagFilteredLeads;
    return flagFilteredLeads.filter((l) => {
      if (!l) return false;
      if (activeSegment === "hot") return isHotLead(l, todosState);
      if (activeSegment === "overdue") {
        const ts = getTodosForLead(l);
        return ts.some((t) => (t as { due_date?: string | null }).due_date && new Date((t as { due_date?: string | null }).due_date!).getTime() < Date.now() && t.status !== "done");
      }
      if (activeSegment === "clients") return l.verified || l.rentals.length > 0 || l.sales.length > 0;
      return true;
    });
  }, [flagFilteredLeads, activeSegment, todosState, getTodosForLead]);

  // ── 8. Sort ──
  const sortedLeads = useMemo(() => {
    const arr = [...segmentFilteredLeads];
    const byRecency = (a: LeadRow, b: LeadRow) =>
      new Date(b.lastSeenAt || b.createdAt || 0).getTime() -
      new Date(a.lastSeenAt || a.createdAt || 0).getTime();

    switch (sortMode) {
      case "urgent":
        return arr.sort((a, b) => {
          const aS = getLeadSignals(a);
          const bS = getLeadSignals(b);
          const aMax = aS.length > 0 ? Math.max(...aS.map((s) => s.priority)) : 0;
          const bMax = bS.length > 0 ? Math.max(...bS.map((s) => s.priority)) : 0;
          if (bMax !== aMax) return bMax - aMax;
          return byRecency(a, b);
        });
      case "name":
        return arr.sort((a, b) =>
          (a.full_name || "").localeCompare(b.full_name || "")
        );
      case "spent":
        return arr.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
      case "sla":
      case "return_due":
      case "overdue_todos":
      case "recent":
      default:
        return arr.sort(byRecency);
    }
  }, [segmentFilteredLeads, sortMode, getLeadSignals]);

  // ── Pipeline stages ──
  const pipelineStages: PipelineStage[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of enrichedLeads) {
      if (!l) continue;
      const key = l.stageKey || "new";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return PIPELINE_STAGES.map((s) => ({
      key: s.key,
      label: STAGE_LABELS[s.key] || s.key,
      color: s.color,
      count: counts.get(s.key) || 0,
    }));
  }, [enrichedLeads]);

  // ── Segment chips ──
  const segmentChips: SegmentChip[] = useMemo(() => {
    const hotCount = enrichedLeads.filter((l) => isHotLead(l, todosState)).length;
    const overdueCount = enrichedLeads.filter((l) => {
      const ts = getTodosForLead(l);
      return ts.some((t) => (t as { due_date?: string | null }).due_date && new Date((t as { due_date?: string | null }).due_date!).getTime() < Date.now() && t.status !== "done");
    }).length;
    const clientsCount = enrichedLeads.filter((l) => l.verified || l.rentals.length > 0 || l.sales.length > 0).length;
    return [
      { key: "all", label: "Все", count: enrichedLeads.length, color: "#64748b" },
      { key: "hot", label: "Горячие", count: hotCount, color: "#ef4444" },
      { key: "overdue", label: "Просроченные", count: overdueCount, color: "#f59e0b" },
      { key: "clients", label: "Клиенты", count: clientsCount, color: "#22c55e" },
    ];
  }, [enrichedLeads, todosState, getTodosForLead]);

  // ── Leads by stage (for board view) ──
  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadRow[]> = {};
    for (const s of PIPELINE_STAGES) map[s.key] = [];
    for (const l of sortedLeads) {
      if (!l) continue;
      const key = l.stageKey || "new";
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    return map;
  }, [sortedLeads]);

  // ── Available sources/owners for dropdowns ──
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const l of leadsState) {
      if (l && l.source) set.add(l.source);
    }
    return Array.from(set).sort();
  }, [leadsState]);

  const availableOwners = useMemo(() => {
    const set = new Set<string>();
    for (const l of leadsState) {
      if (!l) continue;
      const oid = l.ownerId || l.originalOperatorChatId;
      if (oid && /^\d{5,12}$/.test(oid)) {
        const name = l.ownerName || oid;
        set.add(name);
      }
    }
    return Array.from(set).sort();
  }, [leadsState]);

  // ── Has active filters ──
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

  // ── Reset all filters ──
  const handleResetAllFilters = useCallback(() => {
    setSearchQuery("");
    setSourceFilter("all");
    setOwnerFilter("all");
    setActiveStageFilter(null);
    setActiveSegment("all");
    setFilterFlags(DEFAULT_FILTER_FLAGS);
  }, []);

  // ── Handle filter flags change ──
  const handleFilterFlagsChange = useCallback((patch: Partial<FilterFlags>) => {
    setFilterFlags((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Handle stage select ──
  const handleStageSelect = useCallback((key: string) => {
    setActiveStageFilter((prev) => (prev === key ? null : (key as StageKey)));
  }, []);

  return {
    // State
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    sortMode,
    setSortMode,
    mode,
    setMode,
    activeStageFilter,
    activeSegment,
    setActiveSegment,
    sourceFilter,
    setSourceFilter,
    ownerFilter,
    setOwnerFilter,
    filterFlags,
    viewMode: "list" as "list" | "board",
    // Derived data
    enrichedLeads,
    sortedLeads,
    pipelineStages,
    segmentChips,
    leadsByStage,
    availableSources,
    availableOwners,
    hasActiveFilters,
    // Actions
    handleFilterFlagsChange,
    handleStageSelect,
    handleResetAllFilters,
    // Constants
    SORT_OPTIONS,
    MODE_INTENTS,
  };
}
