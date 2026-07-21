"use client";

import { SOURCE_META } from "./leads-constants";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/server-actions/leads";

export function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffH < 24) return `${diffH} ч назад`;
  if (diffD === 1) return "вчера";
  if (diffD < 7) return `${diffD} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function temperatureColor(urgency: number | null | undefined, pendingTodos: number): string {
  const score = (urgency || 0) + pendingTodos * 15;
  if (score >= 90) return "#ef4444";
  if (score >= 60) return "#f59e0b";
  if (score >= 30) return "#3b82f6";
  return "#64748b";
}

export function temperatureLabel(urgency: number | null | undefined, pendingTodos: number): string {
  const score = (urgency || 0) + pendingTodos * 15;
  if (score >= 90) return "Горячий";
  if (score >= 60) return "Тёплый";
  if (score >= 30) return "Холодный";
  return "Спящий";
}

export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function metaFor(source: string) { return SOURCE_META[source] || SOURCE_META.unknown; }

export function fmtMoney(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "0 ₽";
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}

/**
 * Normalize a phone number to canonical E.164-ish form (+7XXXXXXXXXX for RU).
 * Accepts +7/7/8 prefix, spaces, dashes, parentheses.
 * Returns null if input is empty or unparseable.
 *
 * MUST mirror the server-side normalizePhone() in server-actions/leads.ts and
 * crew-todos.ts so client-side matching stays consistent with server-side filtering.
 */
function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().replace(/[\s\-\(\)]/g, "");
  if (!s) return null;
  if (/^8\d{10}$/.test(s)) s = "+7" + s.slice(1);
  else if (/^7\d{10}$/.test(s)) s = "+" + s;
  else if (/^\d{10}$/.test(s)) s = "+7" + s;
  else if (!s.startsWith("+")) s = "+" + s;
  return s;
}

export function getTodoLeadId(todo: LeadTodoRow): string | null {
  // 1. user_id column — canonical Telegram chat_id
  // Note: Telegram IDs can be up to 10 digits today; allow up to 12 for future-proofing.
  if (todo.user_id && /^\d{1,12}$/.test(todo.user_id)) return todo.user_id;
  // 2. phone column — phone-only leads (normalize for cross-source matching)
  if (todo.phone) {
    const normalized = normalizePhone(todo.phone);
    if (normalized) return normalized;
  }
  // 3. lead_id column — legacy fallback
  if (todo.lead_id) {
    if (/^\d{1,12}$/.test(todo.lead_id)) return todo.lead_id;
    const normalizedLead = normalizePhone(todo.lead_id);
    if (normalizedLead) return normalizedLead;
    return todo.lead_id;
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
        return desc.lead_id;
      }
    } catch { /* ignore */ }
  }
  return null;
}

export function getTodoLeadPhone(todo: LeadTodoRow): string | null {
  if (!todo.description) return null;
  try { return JSON.parse(todo.description).lead_phone || null; } catch { return null; }
}

export function getTodosForLead(todos: LeadTodoRow[], lead: LeadRow): LeadTodoRow[] {
  // Build identity set with normalized phone so a lead keyed by "+7999..." matches
  // todos whose description.lead_phone is "8999..." (legacy formatting).
  const leadUserIds = new Set(
    [lead.user_id, lead.phone, normalizePhone(lead.phone)].filter(Boolean) as string[]
  );
  // Build rental_id lookup from lead's rentals for rental_id-based matching
  const leadRentalIds = new Set(lead.rentals.map((r) => r.rentalId).filter(Boolean));
  return todos.filter((t) => {
    // 1. Match by rental_id (strongest link — works before QR claim)
    if (t.rental_id && leadRentalIds.has(t.rental_id)) return true;
    // 2. Match by identity fields
    const leadId = getTodoLeadId(t);
    if (leadId && leadUserIds.has(leadId)) return true;
    const leadPhone = getTodoLeadPhone(t);
    if (leadPhone) {
      const normalizedTodoPhone = normalizePhone(leadPhone);
      if (normalizedTodoPhone && leadUserIds.has(normalizedTodoPhone)) return true;
      // Raw comparison as last-resort fallback for non-RU phones or weird formats.
      if (lead.phone && leadPhone === lead.phone) return true;
    }
    if (leadId && lead.phone && leadId === lead.phone) return true;
    // 3. Match by rental_id from description JSON (legacy)
    if (t.description) {
      try {
        const desc = JSON.parse(t.description);
        if (desc.rental_id && typeof desc.rental_id === 'string' && leadRentalIds.has(desc.rental_id)) return true;
      } catch { /* ignore */ }
    }
    return false;
  });
}

export function filterLeads(
  leads: LeadRow[],
  searchQuery: string,
  filterSource: string,
  segment: "all" | "hot" | "verified" | "warm" | "troubled",
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[],
  hidePlaceholders: boolean = false,
): LeadRow[] {
  let result = leads;

  // Hide operator-placeholder leads that have no real activity
  if (hidePlaceholders) {
    result = result.filter((l) => 
      l.identityState !== 'operator_placeholder' || 
      l.rentals.length > 0 || 
      l.sales.length > 0 ||
      getTodosForLead(l).length > 0
    );
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter((l) =>
      (l.full_name || "").toLowerCase().includes(q) ||
      (l.phone || "").includes(q) ||
      (l.username || "").toLowerCase().includes(q) ||
      (l.bikeTitle || "").toLowerCase().includes(q) ||
      (l.sourceRoute || "").toLowerCase().includes(q)
    );
  }

  if (filterSource !== "all") result = result.filter((l) => l.source === filterSource);

  if (segment !== "all") {
    result = result.filter((l) => {
      const pt = getTodosForLead(l).filter((t) => t.status !== "done").length;
      if (segment === "troubled") return l.troubled === true;
      if (segment === "verified") return l.verified;
      if (segment === "hot") return !l.verified && ((l.urgencyScore ?? 0) >= 60 || pt > 0 || (l.totalSpent || 0) > 0);
      return !l.verified && !((l.urgencyScore ?? 0) >= 60 || pt > 0 || (l.totalSpent || 0) > 0);
    });
  }

  return result;
}

export function sortLeads(
  leads: LeadRow[],
  sortMode: "recent" | "urgent" | "name" | "spent",
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[]
): LeadRow[] {
  const arr = [...leads];
  switch (sortMode) {
    case "urgent":
      return arr.sort((a, b) => {
        const aT = getTodosForLead(a).filter((t) => t.status !== "done").length;
        const bT = getTodosForLead(b).filter((t) => t.status !== "done").length;
        const aScore = (a.urgencyScore || 0) + aT * 20;
        const bScore = (b.urgencyScore || 0) + bT * 20;
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.lastSeenAt || b.createdAt || 0).getTime() - new Date(a.lastSeenAt || a.createdAt || 0).getTime();
      });
    case "name":
      return arr.sort((a, b) => (a.full_name || "яя").localeCompare(b.full_name || "яя", "ru"));
    case "spent":
      return arr.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
    default:
      return arr.sort((a, b) => new Date(b.lastSeenAt || b.createdAt || 0).getTime() - new Date(a.lastSeenAt || a.createdAt || 0).getTime());
  }
}

export function categorizeLeads(
  leads: LeadRow[],
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[]
): { hot: LeadRow[]; verified: LeadRow[]; warm: LeadRow[] } {
  const hot: LeadRow[] = [];
  const verified: LeadRow[] = [];
  const warm: LeadRow[] = [];
  for (const l of leads) {
    const pt = getTodosForLead(l).filter((t) => t.status !== "done").length;
    if (l.verified) { verified.push(l); continue; }
    if ((l.urgencyScore ?? 0) >= 60 || pt > 0 || (l.totalSpent || 0) > 0) { hot.push(l); continue; }
    warm.push(l);
  }
  return { hot, verified, warm };
}

export function groupLeadsForBoard(leads: LeadRow[]): Record<string, LeadRow[]> {
  const map: Record<string, LeadRow[]> = { new: [], contacted: [], configured: [], contract_generated: [], completed: [] };
  for (const l of leads) {
    const key = l.intentStage || "new";
    const col = map[key] ? key : "new";
    map[col].push(l);
  }
  return map;
}

export function getAvailableSources(leads: LeadRow[]): string[] {
  return Array.from(new Set(leads.map((l) => l.source)));
}