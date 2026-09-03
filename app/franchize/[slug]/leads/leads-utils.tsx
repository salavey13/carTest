// /app/franchize/[slug]/leads/leads-utils.tsx
"use client";

import { SOURCE_META, BOARD_COLUMNS, AVITO_COLUMN_STAGES, sourceGroupOf } from "./leads-constants";
import { PIPELINE_STAGES } from "./lib/pipeline-stages";
import { compareByPriority, computeLeadPriority, handledPenalty, type LeadPriority } from "./lib/lead-priority";
import { getLeadHandling, isHandlingTodo } from "./lib/lead-handling";
import type {LeadRow, LeadTodoRow} from "./leads-types";

/** Avito brand tint used for badges/accents across the leads UI. */
export const AVITO_COLOR = "#0a8f2a";
export const AVITO_BG = "#0a8f2a1a";

/**
 * True when the lead came from the Avito pipeline (webhook v3, factory monitor
 * enrichment, or an assistant-bot forward). Such leads have no phone/TG —
 * the Avito chat link is the ONLY way to answer them, so the UI highlights
 * them (badge + row accent + dedicated «Авито» source filter).
 */
export function isAvitoLead(lead: LeadRow): boolean {
  return (
    lead.contactChannel === "avito" ||
    !!lead.avito?.chatId ||
    lead.user_id.startsWith("avito:")
  );
}

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
  return "Ледяной";
}

/**
 * Generates CSV export of leads data.
 * UTF-8 BOM for proper Excel Russian character display.
 */
export function generateLeadsCSV(leads: LeadRow[]): string {
  const BOM = "﻿";
  const headers = [
    "ID",
    "Имя",
    "Телефон",
    "Источник",
    "Статус верификации",
    "Тема",
    "Этап",
    "Байк",
    "Создан",
    "Активность",
    "Изменено",
    "Срочность",
    "Telegram ID"
  ];

  const rows = leads.map((lead) => {
    const source = SOURCE_META[lead.source as keyof typeof SOURCE_META];
    return [
      lead.user_id,
      lead.full_name || "Без имени",
      lead.phone || "—",
      source?.label || lead.source,
      lead.verified ? "Верифицирован" : "Не верифицирован",
      lead.intentType || "—",
      lead.intentStage || "new",
      lead.bikeTitle || "—",
      lead.createdAt ? formatDate(lead.createdAt) : "—",
      lead.lastSeenAt ? formatDate(lead.lastSeenAt) : "—",
      // «Изменено» — последняя модификация (заметка/туду/стадия); без неё — активность
      formatDate(lead.lastModifiedAt || lead.lastSeenAt || lead.createdAt),
      lead.urgencyScore?.toString() || "0",
      lead.telegramChatId || "—"
    ].map((field) => {
      // Escape quotes and wrap in quotes for CSV
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    }).join(",");
  });

  return BOM + [headers.join(","), ...rows].join("\n");
}

/**
 * Triggers browser download of CSV file.
 */
export function downloadLeadsCSV(leads: LeadRow[], filename: string = `leads-${new Date().toISOString().split('T')[0]}.csv`): void {
  const csv = generateLeadsCSV(leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
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
    // FIX (lead-handling): non-phone keys — "avito:…", "fwd-…", UUIDs —
    // must compare AS-IS. The old path ran normalizePhone() on any string,
    // which mangled "avito:123" into "+avito:123" and never matched the
    // lead's user_id. Only phone-SHAPED values (digits/+/dashes/parens)
    // go through normalization.
    if (!/^[+\d\s\-()]+$/.test(todo.lead_id)) return todo.lead_id;
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
        // same fix as above: non-phone keys compare as-is (avito:…)
        if (!/^[+\d\s\-()]+$/.test(desc.lead_id)) return desc.lead_id;
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

  // "avito" is a VIRTUAL source: it selects leads by CHANNEL (any intent that
  // came from the Avito webhook/forward), not by the raw `source` column —
  // otherwise you'd have to know that Avito chats land as callback_request.
  if (filterSource === "avito") {
    result = result.filter(isAvitoLead);
  } else if (filterSource !== "all") {
    // FIX: match by CANONICAL group — the toolbar now emits group ids
    // ("testdrive"/"rent"/"sale"), so one option covers every raw slug of the
    // same meaning (test_drive + testdrive_contract, rental_contract + rent,
    // sale_contract + sale). Legacy raw values still match themselves.
    result = result.filter((l) => sourceGroupOf(l.source) === filterSource);
  }

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

/**
 * Priority Score для каждого лида, с мемоизацией по user_id.
 *
 * Сортировка «priority» и лайбочки (⚡ свежий / 🔥 счёт) в карточках,
 * таблице и канбане читают значения из этой карты — расчёт O(1) на лида,
 * без пересчёта внутри компаратора сортировки.
 *
 * Заметка: pending-задачи для индекса НЕ включают handling-строки
 * («отработан»/«перезвонить») — их влияние учитывается отдельным
 * callback-бонусом внутри computeLeadPriority.
 */
export function buildPriorityMap(
  leads: LeadRow[],
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[],
  now: number,
): Map<string, LeadPriority> {
  const map = new Map<string, LeadPriority>();
  for (const lead of leads) {
    const todos = getTodosForLead(lead);
    const pending = todos.filter((t) => t.status !== "done" && !isHandlingTodo(t)).length;
    const handling = getLeadHandling(todos);
    map.set(lead.user_id, computeLeadPriority(lead, pending, now, handling));
  }
  return map;
}

export function sortLeads(
  leads: LeadRow[],
  sortMode: "priority" | "recent" | "urgent" | "name" | "spent",
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[],
  priorityMap?: Map<string, LeadPriority>,
  now: number = Date.now(),
): LeadRow[] {
  const arr = [...leads];
  switch (sortMode) {
    // ТЗ «Итоговый индекс приоритета»: комплексный score 0–100 (LIFO-свежесть
    // + температура + задачи + LTV + этап, Авито ×2). Самые горячие и свежие
    // обращения — наверху очереди у менеджера, а не в алфавитной куче.
    case "priority": {
      const pMap = priorityMap ?? buildPriorityMap(arr, getTodosForLead, now);
      const fallback = computeLeadPriorityFallback(getTodosForLead, now);
      return arr.sort((a, b) => {
        const aP = pMap.get(a.user_id) ?? fallback(a);
        const bP = pMap.get(b.user_id) ?? fallback(b);
        return compareByPriority(a, aP, b, bP);
      });
    }
    case "urgent":
      // «Срочность»: температура + открытые задачи, НО обработанные лиды тонут
      // (handledPenalty) — по-настоящему срочные нетронутые обращения не
      // вытесняются из топа лидами, которые оператор уже отработал.
      return arr.sort((a, b) => {
        const aT = getTodosForLead(a).filter((t) => t.status !== "done").length;
        const bT = getTodosForLead(b).filter((t) => t.status !== "done").length;
        const aScore = (a.urgencyScore || 0) + aT * 20 + handledPenalty(a, now);
        const bScore = (b.urgencyScore || 0) + bT * 20 + handledPenalty(b, now);
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

/** Ленивый расчёт приоритета для лидов, которых нет в priorityMap. */
function computeLeadPriorityFallback(
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[],
  now: number,
): (lead: LeadRow) => LeadPriority {
  const cache = new Map<string, LeadPriority>();
  return (lead: LeadRow) => {
    const cached = cache.get(lead.user_id);
    if (cached) return cached;
    const todos = getTodosForLead(lead);
    const pending = todos.filter((t) => t.status !== "done" && !isHandlingTodo(t)).length;
    const handling = getLeadHandling(todos);
    const p = computeLeadPriority(lead, pending, now, handling);
    cache.set(lead.user_id, p);
    return p;
  };
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
  // FIX: used to group by the RAW DB stage (intentStage) while the board only
  // knows 5 columns — DB stages like "viewed" (the most common one!), "clicked",
  // "lead_captured", "checkout_started" all fell into the "new" fallback bucket,
  // which is why «Новые» showed 125+ mixed leads. Now we group by the COMPUTED
  // pipeline stage (stageKey, already resolved server-side from rentals/QR/docs),
  // and the column set matches PIPELINE_STAGES exactly (плюс виртуальная
  // колонка «Авито» для дотрудовых авито-лидов — см. BOARD_COLUMNS).
  const map: Record<string, LeadRow[]> = {};
  for (const s of BOARD_COLUMNS) map[s.key] = [];
  for (const l of leads) {
    const stage = l.stageKey || "new";
    const key = isAvitoLead(l) && AVITO_COLUMN_STAGES.has(stage) ? "avito" : stage;
    if (!map[key]) map[key] = [];
    map[key].push(l);
  }
  return map;
}

export function getAvailableSources(leads: LeadRow[]): string[] {
  return Array.from(new Set(leads.map((l) => l.source)));
}