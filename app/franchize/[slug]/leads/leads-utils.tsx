// /app/franchize/[slug]/leads/leads-utils.tsx
"use client";

import { SOURCE_META, BOARD_COLUMNS, AVITO_COLUMN_STAGES } from "./leads-constants";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";
// Изоморфное ядро: filterLeads/sortLeads/buildPriorityMap/categorizeLeads/
// getAvailableSources переехали в lib/leads-query-core.ts (без "use client"),
// чтобы серверный экшен getFranchizeLeads применял ТЕ ЖЕ правила при оконной
// выдаче. Здесь — ре-экспорты для существующих клиентов и тестов.
export {
  filterLeads,
  buildPriorityMap,
  sortLeads,
  categorizeLeads,
  getAvailableSources,
  matchStageFilter,
  matchOwnerFilter,
  placeholderHasActivity,
  computeLeadsKpiCardsStats,
} from "./lib/leads-query-core";
export type { LeadsSegment, LeadsSortMode, LeadsKpiCardsStats } from "./lib/leads-query-core";
import type {LeadRow, LeadTodoRow} from "./leads-types";

/** Avito brand tint used for badges/accents across the leads UI. */
export const AVITO_COLOR = "#0a8f2a";
export const AVITO_BG = "#0a8f2a1a";

import { isAvitoLead } from "./lib/lead-identity";
export { isAvitoLead };

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

export function metaFor(source: string) { return SOURCE_META[source] || SOURCE_META.unknown; }

export function fmtMoney(n: number | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "0 ₽";
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
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