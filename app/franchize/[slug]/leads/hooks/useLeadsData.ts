"use client";

import { useMemo, useCallback } from "react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import { 
  getTodoLeadId, 
  getTodoLeadPhone, 
  filterLeads, 
  sortLeads, 
  categorizeLeads, 
  getAvailableSources,
  groupLeadsForBoard 
} from "../leads-utils";

export function useTodosMapping(todos: LeadTodoRow[]) {
  const getTodoLeadIdMemo = useCallback((todo: LeadTodoRow): string | null => {
    if (todo.lead_id) return todo.lead_id;
    if (!todo.description) return null;
    try { return JSON.parse(todo.description).lead_id || null; } catch { return null; }
  }, []);

  const getTodoLeadPhoneMemo = useCallback((todo: LeadTodoRow): string | null => {
    if (!todo.description) return null;
    try { return JSON.parse(todo.description).lead_phone || null; } catch { return null; }
  }, []);

  const getTodosForLead = useCallback((lead: LeadRow): LeadTodoRow[] => {
    const leadUserIds = new Set([lead.user_id, lead.phone].filter(Boolean));
    return todos.filter((t) => {
      const leadId = getTodoLeadIdMemo(t);
      if (leadId && leadUserIds.has(leadId)) return true;
      const leadPhone = getTodoLeadPhoneMemo(t);
      if (leadPhone && lead.phone && leadPhone === lead.phone) return true;
      if (leadId && lead.phone && leadId === lead.phone) return true;
      return false;
    });
  }, [todos, getTodoLeadIdMemo, getTodoLeadPhoneMemo]);

  return { getTodosForLead, getTodoLeadId: getTodoLeadIdMemo, getTodoLeadPhone: getTodoLeadPhoneMemo };
}

export function useFilteredSortedLeads(
  leads: LeadRow[],
  searchQuery: string,
  filterSource: string,
  segment: "all" | "hot" | "verified" | "warm" | "troubled",
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[],
  sortMode: "recent" | "urgent" | "name" | "spent"
) {
  const filteredLeads = useMemo(
    () => filterLeads(leads, searchQuery, filterSource, segment, getTodosForLead),
    [leads, searchQuery, filterSource, segment, getTodosForLead]
  );

  const sortedLeads = useMemo(
    () => sortLeads(filteredLeads, sortMode, getTodosForLead),
    [filteredLeads, sortMode, getTodosForLead]
  );

  const { hot, verified, warm } = useMemo(
    () => categorizeLeads(sortedLeads, getTodosForLead),
    [sortedLeads, getTodosForLead]
  );

  const availableSources = useMemo(
    () => getAvailableSources(leads),
    [leads]
  );

  const hasFilters = useMemo(
    () => !!(searchQuery || filterSource !== "all"),
    [searchQuery, filterSource]
  );

  const boardColumns = useMemo(
    () => groupLeadsForBoard(sortedLeads),
    [sortedLeads]
  );

  return {
    filteredLeads,
    sortedLeads,
    hot,
    verified,
    warm,
    availableSources,
    hasFilters,
    boardColumns,
  };
}