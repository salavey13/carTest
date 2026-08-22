"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getRentalsDashboard,
  getRentalsDateRange,
  type RentalDashboardItem,
  type RentalDashboardSummary,
} from "@/app/franchize/server-actions/rentals-dashboard";

interface UseRentalsDashboardProps {
  slug: string;
  actorUserId: string | null;
  date: string;
  isPasswordAuth: boolean;
  verificationFilter?: "all" | "verified" | "pending" | "revoked";
}

export function useRentalsDashboard({
  slug,
  actorUserId,
  date,
  isPasswordAuth,
  verificationFilter,
}: UseRentalsDashboardProps) {
  const [rentals, setRentals] = useState<RentalDashboardItem[]>([]);
  const [summary, setSummary] = useState<RentalDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRentals = useCallback(async (loadDate: string, showRefresh = false) => {
    if (!actorUserId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await getRentalsDashboard({
        slug: slug.trim(),
        actorUserId,
        date: loadDate,
        verificationStatus: verificationFilter === "all" ? undefined : verificationFilter,
        isPasswordAuth: isPasswordAuth,
      });

      if (!result.success) {
        if (result.error?.includes("прав") || result.error?.includes("доступ")) {
          throw new Error("AUTH_REQUIRED");
        }
        throw new Error(result.error || "Не удалось загрузить аренды");
      }

      setRentals(result.data?.items || []);
      setSummary(result.data?.summary || null);
    } catch (error) {
      console.error("[useRentalsDashboard] Load error:", error);
      throw error;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug, actorUserId, isPasswordAuth, verificationFilter]);

  const loadDateRange = useCallback(async () => {
    if (!actorUserId) return;

    try {
      const result = await getRentalsDateRange({
        slug: slug.trim(),
        actorUserId,
        isPasswordAuth: isPasswordAuth,
      });

      if (result.success) return result.data;
    } catch (error) {
      console.error("[useRentalsDashboard] Date range error:", error);
    }
    return null;
  }, [slug, actorUserId, isPasswordAuth]);

  return {
    rentals,
    setRentals,
    summary,
    setSummary,
    loading,
    refreshing,
    setRefreshing,
    loadRentals,
    loadDateRange,
  };
}

interface UseSalesDashboardProps {
  slug: string;
  actorUserId: string | null;
  date: string;
  isPasswordAuth: boolean;
}

export function useSalesDashboard({ slug, actorUserId, date, isPasswordAuth }: UseSalesDashboardProps) {
  const [sales, setSales] = useState<any[]>([]);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [loadingSales, setLoadingSales] = useState(true);

  const { getSalesDashboard } = require("@/app/franchize/server-actions/rentals-dashboard");

  const loadSales = useCallback(async (loadDate: string) => {
    if (!actorUserId) {
      setLoadingSales(false);
      return;
    }

    setLoadingSales(true);
    try {
      const result = await getSalesDashboard({
        slug: slug.trim(),
        actorUserId,
        date: loadDate,
        isPasswordAuth,
      });

      if (result.success && result.data) {
        setSales(result.data.items || []);
        setSalesSummary(result.data.summary || null);
      }
    } catch (error) {
      console.error("[useSalesDashboard] Load error:", error);
    } finally {
      setLoadingSales(false);
    }
  }, [slug, actorUserId, isPasswordAuth]);

  return { sales, setSales, salesSummary, setSalesSummary, loadingSales, loadSales };
}

interface UseCommercialProposalsDashboardProps {
  slug: string;
  actorUserId: string | null;
  date: string;
  isPasswordAuth: boolean;
}

export function useCommercialProposalsDashboard({ slug, actorUserId, date, isPasswordAuth }: UseCommercialProposalsDashboardProps) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [proposalsSummary, setProposalsSummary] = useState<any>(null);
  const [loadingProposals, setLoadingProposals] = useState(true);

  const { getCommercialProposalsDashboard } = require("@/app/franchize/server-actions/rentals-dashboard");

  const loadProposals = useCallback(async (loadDate: string) => {
    if (!actorUserId) {
      setLoadingProposals(false);
      return;
    }

    setLoadingProposals(true);
    try {
      const result = await getCommercialProposalsDashboard({
        slug: slug.trim(),
        actorUserId,
        date: loadDate,
        isPasswordAuth,
      });

      if (result.success && result.data) {
        setProposals(result.data.items || []);
        setProposalsSummary(result.data.summary || null);
      }
    } catch (error) {
      console.error("[useCommercialProposalsDashboard] Load error:", error);
    } finally {
      setLoadingProposals(false);
    }
  }, [slug, actorUserId, isPasswordAuth]);

  return { proposals, setProposals, proposalsSummary, setProposalsSummary, loadingProposals, loadProposals };
}

interface UseSubrentDashboardProps {
  slug: string;
  actorUserId: string | null;
  date: string;
  isPasswordAuth: boolean;
}

export function useSubrentDashboard({ slug, actorUserId, date, isPasswordAuth }: UseSubrentDashboardProps) {
  const [subrents, setSubrents] = useState<any[]>([]);
  const [subrentsSummary, setSubrentsSummary] = useState<any>(null);
  const [loadingSubrents, setLoadingSubrents] = useState(true);

  const { getSubrentContractsDashboard } = require("@/app/franchize/server-actions/rentals-dashboard");

  const loadSubrents = useCallback(async (loadDate: string) => {
    if (!actorUserId) {
      setLoadingSubrents(false);
      return;
    }

    setLoadingSubrents(true);
    try {
      const result = await getSubrentContractsDashboard({
        slug: slug.trim(),
        actorUserId,
        date: loadDate,
        isPasswordAuth,
      });

      if (result.success && result.data) {
        setSubrents(result.data.items || []);
        setSubrentsSummary(result.data.summary || null);
      }
    } catch (error) {
      console.error("[useSubrentDashboard] Load error:", error);
    } finally {
      setLoadingSubrents(false);
    }
  }, [slug, actorUserId, isPasswordAuth]);

  return { subrents, setSubrents, subrentsSummary, setSubrentsSummary, loadingSubrents, loadSubrents };
}

interface UsePendingApplicationsProps {
  actorUserId: string | null;
}

export function usePendingApplications({ actorUserId }: UsePendingApplicationsProps) {
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);

  const { getSubrentApplications } = require("@/app/franchize/server-actions/subrent-approval");

  const loadApplications = useCallback(async () => {
    if (!actorUserId) {
      setLoadingApplications(false);
      return;
    }

    setLoadingApplications(true);
    try {
      const result = await getSubrentApplications({ actorUserId });
      if (result.success && result.data) {
        setPendingApplications(result.data);
      }
    } catch (error) {
      console.error("[usePendingApplications] Load error:", error);
    } finally {
      setLoadingApplications(false);
    }
  }, [actorUserId]);

  return { pendingApplications, setPendingApplications, loadingApplications, loadApplications };
}

interface UseChecklistStatesProps {
  isAuthed: boolean;
}

export function useChecklistStates({ isAuthed }: UseChecklistStatesProps) {
  const [checklistStates, setChecklistStates] = useState<{ handout: any; return: any }>({ handout: null, return: null });
  const [updatingChecklist, setUpdatingChecklist] = useState<string | null>(null);

  const { getAllChecklistStates, updateChecklistState } = require("@/app/franchize/server-actions/checklist");

  const loadChecklistStates = useCallback(async () => {
    if (!isAuthed) return;

    try {
      const result = await getAllChecklistStates();
      if (result.success && result.data) {
        const handout = result.data.handout || [];
        const return_ = result.data.return || [];

        const handoutState = handout.reduce((acc: any, item: any) => {
          acc[item.field] = item;
          return acc;
        }, {});

        const returnState = return_.reduce((acc: any, item: any) => {
          acc[item.field] = item;
          return acc;
        }, {});

        setChecklistStates({ handout: handoutState, return: returnState });
      }
    } catch (error) {
      console.error("[useChecklistStates] Load error:", error);
    }
  }, [isAuthed]);

  const handleUpdateChecklist = useCallback(async (field: string, completed: boolean) => {
    setUpdatingChecklist(field);
    try {
      const result = await updateChecklistState({ field, completed });
      if (result.success) {
        loadChecklistStates();
      }
    } catch (error) {
      console.error("[useChecklistStates] Update error:", error);
    } finally {
      setUpdatingChecklist(null);
    }
  }, [loadChecklistStates]);

  useEffect(() => {
    loadChecklistStates();
  }, [loadChecklistStates]);

  return {
    checklistStates,
    updatingChecklist,
    loadChecklistStates,
    handleUpdateChecklist,
  };
}

interface UseCrewTodosProps {
  crewId: string;
  isAuthed: boolean;
}

export function useCrewTodos({ crewId, isAuthed }: UseCrewTodosProps) {
  const [todos, setTodos] = useState<any[]>([]);
  const [todoStats, setTodoStats] = useState<{ total: number; pending: number; inProgress: number; done: number } | null>(null);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [todoFilter, setTodoFilter] = useState<"all" | "pending" | "in_progress" | "done">("all");
  const [crewMembers, setCrewMembers] = useState<Array<{ user_id: string; full_name: string | null; username: string | null }>>([]);

  const {
    getCrewTodos,
    getCrewTodoStats,
    getCrewMembersForTodos,
  } = require("@/app/franchize/server-actions/crew-todos");

  const loadTodos = useCallback(async () => {
    if (!isAuthed || !crewId) {
      setLoadingTodos(false);
      return;
    }

    setLoadingTodos(true);
    try {
      const [todosResult, statsResult, membersResult] = await Promise.all([
        getCrewTodos({ crewId, status: todoFilter === "all" ? undefined : todoFilter }),
        getCrewTodoStats({ crewId }),
        getCrewMembersForTodos({ crewId }),
      ]);

      if (todosResult.success && todosResult.data) setTodos(todosResult.data);
      if (statsResult.success && statsResult.data) setTodoStats(statsResult.data);
      if (membersResult.success && membersResult.data) setCrewMembers(membersResult.data);
    } catch (error) {
      console.error("[useCrewTodos] Load error:", error);
    } finally {
      setLoadingTodos(false);
    }
  }, [crewId, isAuthed, todoFilter]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  return {
    todos,
    setTodos,
    todoStats,
    loadingTodos,
    todoFilter,
    setTodoFilter,
    crewMembers,
    loadTodos,
  };
}

interface UseMessageTemplatesProps {
  isAuthed: boolean;
}

export function useMessageTemplates({ isAuthed }: UseMessageTemplatesProps) {
  const [messageTemplates, setMessageTemplates] = useState<Array<{ id: string; key: string; name: string }>>([]);

  const { getMessageTemplates } = require("@/app/franchize/server-actions/message-templates");

  const loadTemplates = useCallback(async () => {
    if (!isAuthed) return;

    try {
      const result = await getMessageTemplates({});
      if (result.success && result.data) {
        setMessageTemplates(result.data);
      }
    } catch (error) {
      console.error("[useMessageTemplates] Load error:", error);
    }
  }, [isAuthed]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return { messageTemplates, loadTemplates };
}

// Need to add missing imports
import { useState, useEffect, useCallback, useRef } from "react";