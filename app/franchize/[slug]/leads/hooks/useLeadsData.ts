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
 * Extract the lead identifier from a todo, checking columns in priority order:
 *  1. user_id column (Telegram chat_id, canonical)
 *  2. phone column (phone-only leads)
 *  3. lead_id column (legacy: Telegram ID, phone, or UUID)
 *  4. description JSON (legacy fallback)
 */
function extractTodoLeadId(todo: LeadTodoRow): string | null {
  // 1. user_id column — canonical Telegram chat_id
  if (todo.user_id && /^\d{1,9}$/.test(todo.user_id)) return todo.user_id;
  // 2. phone column — phone-only leads
  if (todo.phone) return todo.phone;
  // 3. lead_id column — legacy fallback
  if (todo.lead_id) {
    if (/^\d{1,9}$/.test(todo.lead_id)) return todo.lead_id;
    if (todo.lead_id.includes('-')) return todo.lead_id;
  }
  // 4. description JSON — legacy fallback
  if (todo.description) {
    try {
      const desc = JSON.parse(todo.description);
      if (desc.user_id && typeof desc.user_id === 'string' && /^\d{1,9}$/.test(desc.user_id)) return desc.user_id;
      if (desc.phone && typeof desc.phone === 'string') return desc.phone;
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
    // Build rental_id set for this lead — enables rental_id-based todo matching
    const leadRentalIds = new Set(lead.rentals.map((r) => r.rentalId).filter(Boolean));
    const seen = new Set<string>();
    return todos.filter((t) => {
      // 1. Match by rental_id from description JSON (strongest — works before QR claim)
      if (t.description) {
        try {
          const desc = JSON.parse(t.description);
          if (desc.rental_id && leadRentalIds.has(desc.rental_id)) {
            const key = t.id || `rental:${desc.rental_id}|${t.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }
        } catch { /* ignore */ }
      }

      // 2. Match by identity key (user_id/phone/lead_id)
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
  sortMode: "recent" | "urgent" | "name" | "spent",
  hidePlaceholders: boolean = false,
) {
  const filteredLeads = useMemo(
    () => filterLeads(leads, searchQuery, filterSource, segment, getTodosForLead, hidePlaceholders),
    [leads, searchQuery, filterSource, segment, getTodosForLead, hidePlaceholders]
  );

  const sortedLeads = useMemo(
    () => sortLeads(filteredLeads, sortMode, getTodosForLead),
    [filteredLeads, sortMode, getTodosForLead]
  );

  const { hot, verified, warm } = useMemo(
    () => categorizeLeads(sortedLeads, getTodosForLead),
    [sortedLeads, getTodosForLead]
  );

  // availableSources is based on the full leads set so filters don't disappear
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