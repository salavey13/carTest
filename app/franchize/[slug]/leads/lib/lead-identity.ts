// /app/franchize/[slug]/leads/lib/lead-identity.ts
/**
 * Single source of truth for lead-identity helpers shared by the UI layer
 * (leads-utils re-exports) and pure lib modules (kpi / playbook / scripts).
 * Lives in lib/ (no React, no "use client") so server-safe modules and tests
 * import it without pulling the .tsx component chain. Wave 4 cleanup: replaces
 * 4 local isAvitoLead copies (leads-utils, lead-kpi, lead-playbook, lead-scripts).
 */
import type { LeadRow, LeadTodoRow } from "../leads-types";

/**
 * True when the lead came from the Avito pipeline (webhook v3, factory monitor
 * enrichment, or an assistant-bot forward). Such leads have no phone/TG —
 * the Avito chat link is the ONLY way to answer them, so the UI highlights
 * them (badge + row accent + dedicated "Avito" source filter).
 */
export function isAvitoLead(lead: LeadRow): boolean {
  return (
    lead.contactChannel === "avito" ||
    !!lead.avito?.chatId ||
    lead.user_id.startsWith("avito:")
  );
}

/**
 * JSON.parse(todo.description) cached by object identity via WeakMap —
 * parse ONCE per todo instead of O(leads x todos) times on every minute-tick
 * (KPI + playbook + speed + priority all call matchTodosToLead per lead).
 * Todos are replaced, not mutated, on updates; the identity fields inside the
 * description (rental_id / lead_id / phone) never change after creation, so
 * the cache cannot go stale for the fields consumers read.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors JSON.parse's own `any`
const descCache = new WeakMap<LeadTodoRow, any>();

export function parseTodoDesc(todo: LeadTodoRow): any {
  if (!todo.description) return null;
  const hit = descCache.get(todo);
  if (hit !== undefined) return hit;
  let parsed: any = null;
  try {
    parsed = JSON.parse(todo.description);
  } catch {
    parsed = null; // malformed JSON = no description candidates
  }
  descCache.set(todo, parsed);
  return parsed;
}
