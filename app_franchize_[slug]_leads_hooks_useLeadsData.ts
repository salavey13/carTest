"use client";

import { useMemo, useCallback, useRef } from "react";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";
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
 *
 * Note: Telegram user IDs can be up to 10 digits today (e.g. 7813830016).
 * The previous /^\d{1,9}$/ regex silently rejected 10-digit IDs and broke
 * matching for most modern users. Allow up to 12 digits for future-proofing.
 *
 * Phones are normalized to E.164 so a todo with phone "89991234567" matches
 * a lead keyed by "+79991234567". Mirrors server-side behavior in
 * getTodoLeadId() in server-actions/leads.ts.
 */
function extractTodoLeadId(todo: LeadTodoRow): string | null {
  // 1. user_id column — canonical Telegram chat_id
  if (todo.user_id && /^\d{1,12}$/.test(todo.user_id)) return todo.user_id;
  // 2. phone column — phone-only leads (normalize for cross-source matching)
  if (todo.phone) {
    const normalized = normalizePhone(todo.phone);
    if (normalized) return normalized;
  }
  // 3. lead_id column — legacy fallback
  if (todo.lead_id) {
    if (/^\d{1,12}$/.test(todo.lead_id)) return todo.lead_id;
    // Phone-shaped lead_id (legacy) — normalize.
    const normalizedLead = normalizePhone(todo.lead_id);
    if (normalizedLead) return normalizedLead;
    if (todo.lead_id.includes('-')) return todo.lead_id;
  }
  // 4. description JSON — legacy fallback
  if (todo.description) {
    try {
      const desc = JSON.parse(todo.description);
      if (desc.user_id && typeof desc.user_id === 'string' && /^\d{1,12}$/.test(desc.user_id)) return desc.user_id;
      if (desc.phone && typeof desc.phone === 'string') {
        const normalized = normalizePhone(desc.phone);
        if (normalized) return normalized;
      }
      if (desc.lead_id && typeof desc.lead_id === 'string') {
        if (/^\d{1,12}$/.test(desc.lead_id)) return desc.lead_id;
        const normalizedLead = normalizePhone(desc.lead_id);
        if (normalizedLead) return normalizedLead;
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
    // Build identity set with normalized phone so phone-only leads (keyed by "+7999...")
    // match todos whose phone column or description.lead_phone is "8999...".
    const leadIdentitySet = new Set(
      [lead.user_id, lead.phone, normalizePhone(lead.phone)].filter(Boolean) as string[]
    );
    const seen = new Set<string>();
    return todos.filter((t) => {
      // 1. Match by rental_id from todo's direct column (Phase 3c FK — primary)
      const todoRentalId = t.rental_id || null;
      if (todoRentalId && leadRentalIds.has(todoRentalId)) {
        const key = t.id || `rental:${todoRentalId}|${t.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }

      // 2. Match by rental_id from description JSON (legacy fallback)
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

      // 3. Match by identity key (user_id/phone/lead_id) — must include normalized
      // phone variants so a todo keyed by "89991234567" matches a lead keyed by
      // "+79991234567". extractTodoLeadId() already normalizes phones, so we just
      // need to check membership against the full identity set.
      const todoLeadId = extractTodoLeadId(t);
      if (!todoLeadId || !leadIdentitySet.has(todoLeadId)) return false;
      // Dedup by todo id, fallback to title
      const key = t.id || `${todoLeadId}|${t.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [todos]);

  /** Stable result cache: same lead + same todos → same array reference */
  const cache = useRef(new Map<string, LeadTodoRow[]>()).current;
  const getTodosForLeadStable = useCallback((lead: LeadRow): LeadTodoRow[] => {
    const cacheKey = lead.user_id;
    const prev = cache.get(cacheKey);
    const result = getTodosForLead(lead);
    // Compare by length + each element id — only update cache if actually changed
    if (prev && prev.length === result.length && prev.every((t, i) => t.id === result[i]?.id && t.status === result[i]?.status)) {
      return prev; // same reference = no effect trigger in downstream components
    }
    cache.set(cacheKey, result);
    return result;
  }, [getTodosForLead, cache]);

  return { getTodosForLead: getTodosForLeadStable };
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