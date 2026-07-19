"use client";

import { useMemo, useCallback } from "react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import { 
  filterLeads, 
  sortLeads, 
  categorizeLeads, 
  getAvailableSources,
  groupLeadsForBoard 
} from "../leads-utils";

/**
 * Extract lead_id (user_id UUID) from a todo — checks column first, then description JSON.
 * Returns null if the value looks like a phone number (no '-') rather than a UUID.
 */
function extractTodoLeadId(todo: LeadTodoRow): string | null {
  if (todo.lead_id) {
    // Numeric → Telegram user ID (primary match)
    if (/^\d{1,9}$/.test(todo.lead_id)) return todo.lead_id;
    // UUID → accept
    if (todo.lead_id.includes('-')) return todo.lead_id;
    // Phone or other → reject
  }
  if (todo.description) {
    try {
      const desc = JSON.parse(todo.description);
      if (desc.lead_id && typeof desc.lead_id === 'string') {
        if (/^\d{1,9}$/.test(desc.lead_id)) return desc.lead_id;
        if (desc.lead_id.includes('-')) return desc.lead_id;
      }
    } catch { /* ignore */ }
  }
  return null;
}

export function useTodosMapping(todos: LeadTodoRow[]) {
  const getTodosForLead = useCallback((lead: LeadRow): LeadTodoRow[] => {
    const seen = new Set<string>();
    return todos.filter((t) => {
      // Match ONLY by lead_id (user_id UUID) — never by phone, which causes
      // cross-lead pollution when multiple leads share a contact number.
      const todoLeadId = extractTodoLeadId(t);
      if (!todoLeadId || todoLeadId !== lead.user_id) return false;
      // Dedup by todo id, fallback to title
      const key = t.id || `${todoLeadId}|${t.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [todos]);

  return { getTodosForLead };
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