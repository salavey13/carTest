// /app/franchize/[slug]/leads/hooks/useLeadsData.ts
"use client";

import { useMemo, useCallback, useRef } from "react";
import type {LeadRow, LeadTodoRow} from "../leads-types";
import { buildPriorityMap } from "../leads-utils";
import type { LeadPriority } from "../lib/lead-priority";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";
import { parseTodoDesc } from "../lib/lead-identity";


/**
 * Extract ALL lead-identifier candidates from a todo, checking every column:
 *  1. user_id column (Telegram chat_id — or a phone-shaped legacy value)
 *  2. phone column (phone-only leads)
 *  3. lead_id column (legacy: Telegram ID, phone, or UUID)
 *  4. description JSON (legacy fallback)
 *
 * ── IDENTITY MATCHING FIX (2026-09-02, round 2) ──
 * The old single-candidate version (first column wins) had a fatal flaw for
 * operator-created todos: the bot's /doc flow writes user_id = OPERATOR's
 * chat_id AND phone = RENTER's phone on the SAME row. user_id won the priority
 * race, matched no lead (leads are no longer keyed by operator ids after the
 * server-side identity fix), and the REAL renter's todo silently vanished from
 * the lead card. Now we return EVERY candidate (raw + phone-normalized) and
 * the caller matches if ANY candidate is in the lead's identity set. Operator
 * chat_ids are harmless: no lead identity set contains them anymore.
 *
 * Note: Telegram user IDs can be up to 10 digits today (e.g. 7813830016).
 * The previous /^\d{1,9}$/ regex silently rejected 10-digit IDs and broke
 * matching for most modern users. Allow up to 12 digits for future-proofing.
 *
 * Phone-shaped 11-digit values ("89960430155") stored in user_id by older bot
 * flows are normalized to E.164 as extra candidates so they match phone-keyed
 * leads. Mirrors server-side behavior in getTodoLeadIds() in leads.ts.
 */
function extractTodoLeadIds(todo: LeadTodoRow): string[] {
  const ids: string[] = [];
  const push = (v: string | null | undefined): void => {
    if (v && v.length > 0 && !ids.includes(v)) ids.push(v);
  };
  // push a value AND its normalized-phone form (both are candidates)
  const pushWithPhone = (v: string | null | undefined): void => {
    if (!v) return;
    push(v);
    const n = normalizePhone(v);
    if (n) push(n);
  };

  // 1. user_id column — Telegram chat_id, or a phone-shaped legacy value
  if (todo.user_id && /^\d{1,12}$/.test(todo.user_id)) {
    push(todo.user_id);
    if (/^[78]\d{10}$/.test(todo.user_id)) push(normalizePhone(todo.user_id));
  }
  // 2. phone column — phone-only leads
  pushWithPhone(todo.phone);
  // 3. lead_id column — legacy fallback
  if (todo.lead_id) {
    if (/^\d{1,12}$/.test(todo.lead_id)) {
      push(todo.lead_id);
      if (/^[78]\d{10}$/.test(todo.lead_id)) push(normalizePhone(todo.lead_id));
    } else if (/^[+\d\s\-()]+$/.test(todo.lead_id)) {
      // phone-shaped → raw + normalized candidates
      pushWithPhone(todo.lead_id);
    } else {
      // FIX (lead-handling, kept): non-phone keys ("avito:…", UUIDs) compare
      // AS-IS — normalizePhone() mangles them into "+avito:…" which matches
      // nothing. Push raw only, never a mangled twin.
      push(todo.lead_id);
    }
  }
  // 4. description JSON — legacy fallback
  if (todo.description) {
    try {
      const desc = parseTodoDesc(todo);
      if (desc.user_id && typeof desc.user_id === 'string' && /^\d{1,12}$/.test(desc.user_id)) {
        push(desc.user_id);
        if (/^[78]\d{10}$/.test(desc.user_id)) push(normalizePhone(desc.user_id));
      }
      if (desc.phone && typeof desc.phone === 'string') pushWithPhone(desc.phone);
      if (desc.lead_id && typeof desc.lead_id === 'string') {
        if (/^\d{1,12}$/.test(desc.lead_id)) {
          push(desc.lead_id);
          if (/^[78]\d{10}$/.test(desc.lead_id)) push(normalizePhone(desc.lead_id));
        } else if (/^[+\d\s\-()]+$/.test(desc.lead_id)) {
          pushWithPhone(desc.lead_id);
        } else {
          // non-phone keys (avito:…) compare as-is — see fix above
          push(desc.lead_id);
        }
      }
    } catch { /* ignore */ }
  }
  return ids;
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
          const desc = parseTodoDesc(t);
          if (desc.rental_id && leadRentalIds.has(desc.rental_id)) {
            const key = t.id || `rental:${desc.rental_id}|${t.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }
        } catch { /* ignore */ }
      }

      // 3. Match by identity candidates (user_id/phone/lead_id, raw + normalized).
      // Multi-candidate: operator-created todos carry user_id = operator AND
      // phone = renter — the phone candidate matches the renter's phone-keyed
      // lead while the operator id candidate matches nothing (no lead is keyed
      // by an operator id). See extractTodoLeadIds() for the full story.
      const todoLeadIds = extractTodoLeadIds(t);
      if (!todoLeadIds.some((id) => leadIdentitySet.has(id))) return false;
      // Dedup by todo id, fallback to title
      const key = t.id || `${todoLeadIds[0] || "?"}|${t.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [todos]);

  /** Stable result cache: same lead + same todos → same array reference.
   *  2026-09-10 FIX: сравнение было только length+id+status — смена
   *  due_date/title/assigned_to сохраняла СТАРЫЙ массив-референс, и плашки
   *  перезвонов/назначенных лагали до следующей «другой формы» изменения. */
  const cache = useRef(new Map<string, LeadTodoRow[]>()).current;
  const getTodosForLeadStable = useCallback((lead: LeadRow): LeadTodoRow[] => {
    const cacheKey = lead.user_id;
    const prev = cache.get(cacheKey);
    const result = getTodosForLead(lead);
    const sameShape =
      prev &&
      prev.length === result.length &&
      prev.every((t, i) => {
        const n = result[i];
        return (
          t.id === n?.id &&
          t.status === n?.status &&
          (t.due_date || null) === (n?.due_date || null) &&
          t.title === n?.title &&
          (t.assigned_to || null) === (n?.assigned_to || null)
        );
      });
    if (sameShape) return prev; // same reference = no effect trigger in downstream components
    cache.set(cacheKey, result);
    return result;
  }, [getTodosForLead, cache]);

  return { getTodosForLead: getTodosForLeadStable };
}

// DEAD CODE REMOVED (2026-09-10): useFilteredSortedLeads — клиентская
// фильтрация/сортировка легаси-пути, не используется с серверного уиндоуинга
// (LeadsClient фильтрует окно через изоморфный filterLeads напрямую).

/**
 * Priority Score карта для всех лидов (ТЗ: индекс приоритета 0–100).
 * Пересчитывается при смене данных/задач. `now` можно передать снаружи
 * (nowTick из LeadsClient, обновляется раз в минуту) — тогда просроченные
 * перезвоны вовремя получают буст и перегруппировываются в очереди без
 * перезагрузки страницы; без параметра — фиксируется на первом рендере.
 */
export function usePriorityMap(
  leads: LeadRow[],
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[],
  nowMs?: number,
): Map<string, LeadPriority> {
  // Точка отсчёта «сейчас» — обновляется вместе с данными (fetch/refresh)
  // или с внешним nowTick.
  const now = useMemo(() => (typeof nowMs === "number" && Number.isFinite(nowMs) ? nowMs : Date.now()), [nowMs]);
  return useMemo(
    () => buildPriorityMap(leads, getTodosForLead, now),
    [leads, getTodosForLead, now],
  );
}