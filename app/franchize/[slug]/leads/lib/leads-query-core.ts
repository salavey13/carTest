// /app/franchize/[slug]/leads/lib/leads-query-core.ts
//
// ── ИЗОМОРФНОЕ ЯДРО ЗАПРОСОВ ЛИДОВ (wave «load best leads first») ──────────
//
// Чистые функции фильтрации/сортировки/агрегации, которые раньше жили в
// leads-utils.tsx под директивой "use client" — а значит, серверный экшен
// не мог их импортировать (клиентская ссылка-прокси вместо реализации).
//
// Теперь ОДНИ И ТЕ ЖЕ правила применяются в двух местах:
//   • на СЕРВЕРЕ (getFranchizeLeads): отфильтровать → отсортировать
//     («лучшие сверху») → отрезать окно offset..offset+limit и посчитать
//     агрегаты по ПОЛНОМУ набору — клиент получает только окно;
//   • на КЛИЕНТЕ (LeadsClient): пересчёт лейблов приоритета по окну.
//
// Ни React, ни window/document, ни директив — чистый TS, работает в обоих
// рантаймах. leads-utils.tsx ре-экспортирует отсюда для существующих
// клиентов (тесты и компоненты импорт не меняли).

import type { LeadRow, LeadTodoRow } from "../leads-types";
import { compareByPriority, computeLeadPriority, handledPenalty, type LeadPriority } from "./lead-priority";
import { getLeadHandling, isHandlingTodo } from "./lead-handling";
import { isAvitoLead } from "./lead-identity";
// ВАЖНО: НЕ импортируем leads-constants.ts — он под "use client" (lucide-иконки
// в SOURCE_META), а клиентская ссылка-прокси на сервере ломает рантайм
// (см. историю «Cannot access 'eX' before initialization» в page.tsx).
// Канонические группы источников дублированы ниже — 3 строки без зависимостей.

export type LeadsSegment = "all" | "hot" | "verified" | "warm" | "troubled";
export type LeadsSortMode = "priority" | "recent" | "urgent" | "name" | "spent";

/** Канонические группы источников — синхронно с leads-constants.SOURCE_GROUPS. */
const SOURCE_GROUPS_SERVER: Record<string, string[]> = {
  testdrive: ["test_drive", "testdrive_contract", "test_ride", "test_ride_click"],
  rent: ["rental_contract", "rent", "rental"],
  sale: ["sale_contract", "sale", "prebuy", "hold_created"],
};
const RAW_SOURCE_TO_GROUP_SERVER: Record<string, string> = {};
for (const [groupId, members] of Object.entries(SOURCE_GROUPS_SERVER)) {
  for (const member of members) RAW_SOURCE_TO_GROUP_SERVER[member] = groupId;
}
function sourceGroupOfCore(source: string | null | undefined): string {
  if (!source) return "unknown";
  return RAW_SOURCE_TO_GROUP_SERVER[source] ?? source;
}

// ── Сегмент «скрыть заглушки»: у операторской заглушки нет реальной
// активности (аренд/продаж/задач) — в списке она только шумит. ──
export function placeholderHasActivity(lead: LeadRow, todosForLead: LeadTodoRow[]): boolean {
  return (
    lead.identityState !== "operator_placeholder" ||
    (lead.rentals?.length ?? 0) > 0 ||
    (lead.sales?.length ?? 0) > 0 ||
    todosForLead.length > 0
  );
}

// ── ФИЛЬТРАЦИЯ ──────────────────────────────────────────────────────────────
// Правила 1:1 с прежним filterLeads (leads-utils): поиск по имени/телефону/
// username/байку/маршруту, источник по канонической группе + виртуальный
// канал «avito», сегменты hot/verified/warm/troubled.
//
// SEARCH QUALITY FIX (2026-09-10): запрос «89991234567»/«8 999 123-45-67»
// раньше не находил лид с телефоном «+79991234567» (raw substring), и поиск
// не смотрел в ключ лида (часто это телефон/tg-id) и тексты авито-диалога.
// Теперь: если запрос похож на телефон (≥7 цифр после вычистки) — матчим по
// последним 10 цифрам нормализованного номера (канон compare-ключ RU), плюс
// расширено сено: user_id, авито lastMessage/firstMessage.
const SEARCH_PHONE_MIN_DIGITS = 7;

function searchDigitsOf(raw: string): string {
  return (raw.match(/\d/g) || []).join("");
}

function leadPhoneDigits(lead: LeadRow): string {
  const raw = lead.phone || "";
  if (!raw) return "";
  // Канон для сопоставления: последние 10 цифр (RU: 8/7/+7 → одинаковый ключ).
  const digits = searchDigitsOf(raw);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function leadSearchHaystack(lead: LeadRow): string {
  return [
    (lead.full_name || "").toLowerCase(),
    (lead.phone || ""),
    (lead.username || "").toLowerCase(),
    (lead.bikeTitle || "").toLowerCase(),
    (lead.sourceRoute || "").toLowerCase(),
    (lead.user_id || "").toLowerCase(),
    (lead.avito?.lastMessage || "").toLowerCase(),
    (lead.avito?.firstMessage || "").toLowerCase(),
  ].filter(Boolean).join("\n");
}

export function filterLeads(
  leads: LeadRow[],
  searchQuery: string,
  filterSource: string,
  segment: LeadsSegment,
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[],
  hidePlaceholders: boolean = false,
): LeadRow[] {
  let result = leads;

  if (hidePlaceholders) {
    result = result.filter((l) => placeholderHasActivity(l, getTodosForLead(l)));
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    const qDigits = searchDigitsOf(searchQuery);
    const isPhoneQuery = qDigits.length >= SEARCH_PHONE_MIN_DIGITS;
    const qPhoneKey = isPhoneQuery ? qDigits.slice(-10) : "";
    result = result.filter((l) => {
      if (leadSearchHaystack(l).includes(q)) return true;
      if (isPhoneQuery) {
        // Телефонный запрос: сравниваем канон «последние 10 цифр», чтобы
        // «8999…» находил «+7 (999) …», и наоборот.
        const leadDigits = searchDigitsOf(leadSearchHaystack(l));
        if (leadDigits.length >= 10 && leadDigits.endsWith(qPhoneKey)) return true;
        if (leadPhoneDigits(l) === qPhoneKey) return true;
      }
      return false;
    });
  }

  // "avito" — виртуальный источник: выбор по КАНАЛУ (вебхук/форвард Авито),
  // а не по сырому source (авито-чаты приходят как callback_request).
  if (filterSource === "avito") {
    result = result.filter(isAvitoLead);
  } else if (filterSource !== "all") {
    result = result.filter((l) => sourceGroupOfCore(l.source) === filterSource);
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

/** Стадийный фильтр: stageKey или виртуальная стадия «avito» (все авито-лиды на дотрудовых стадиях). */
export function matchStageFilter(lead: LeadRow, filterStage: string): boolean {
  if (filterStage === "all") return true;
  if (filterStage === "avito") return isAvitoLead(lead);
  return (lead.stageKey || "new") === filterStage;
}

/**
 * Фильтр «С заметками»: «human» — у лида есть хотя бы одна заметка,
 * оставленная ЧЕЛОВЕКОМ (humanNotesCount считается сервером в том же
 * проходе, что notesCount: всё, кроме служебных авто-заметок с автором
 * «подбор с сайта» — квиз с сайта есть у каждого веб-лида и работы
 * оператора не отражает). Легаси-заметки без автора (null) считаем
 * человеческими — их писали операторы до введения атрибуции.
 */
export function matchNotesFilter(lead: LeadRow, filterNotes: string): boolean {
  if (filterNotes !== "human") return true;
  return (lead.humanNotesCount ?? 0) > 0;
}

/**
 * Фильтр «Ответственный»: матч по id (assignee / owner / исходный оператор)
 * или по имени последнего оператора / легаси-имени. ownerName — имя,
 * резолвленное по id из ростера (может быть null для легаси-значений).
 */
export function matchOwnerFilter(lead: LeadRow, filterOwner: string, ownerName: string | null): boolean {
  if (filterOwner === "all") return true;
  return (
    lead.assigneeId === filterOwner ||
    lead.ownerId === filterOwner ||
    lead.originalOperatorChatId === filterOwner ||
    // lastTouchedBy приходит строкой-именем; сравниваем по ней, если
    // сервер вернул имя этого оператора.
    (!!ownerName && lead.lastTouchedBy === ownerName) ||
    // легаси-фоллбек: старый фильтр хранил ИМЯ в filterOwner
    (lead.assigneeName || lead.ownerName || "—") === filterOwner
  );
}

// ── ПРИОРИТЕТ ───────────────────────────────────────────────────────────────

/** Priority Score 0–100 для каждого лида (лейблы ⚡/🔥 + сортировка «priority»). */
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

// ── СОРТИРОВКА ──────────────────────────────────────────────────────────────
// «Лучшие сверху»: priority — комплексный индекс (LIFO-свежесть + температура
// + задачи + LTV + этап, Авито ×2); urgent — срочность с штрафом обработанным;
// recent/name/spent — простые режимы. Детерминирована → конкатенация окон
// серверной выдачи остаётся глобально отсортированной.
export function sortLeads(
  leads: LeadRow[],
  sortMode: LeadsSortMode,
  getTodosForLead: (lead: LeadRow) => LeadTodoRow[],
  priorityMap?: Map<string, LeadPriority>,
  now: number = Date.now(),
): LeadRow[] {
  const arr = [...leads];
  switch (sortMode) {
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

// ── КАТЕГОРИЗАЦИЯ / ОПЦИИ ФИЛЬТРОВ ──────────────────────────────────────────

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

export function getAvailableSources(leads: LeadRow[]): string[] {
  return Array.from(new Set(leads.map((l) => l.source)));
}

// ── АГРЕГАТЫ ПЛИТОК KPI (референс-дизайн: 6 плиток + тренды «за 7 дней») ────
// Порт числовой логики LeadsKPICards: компонент стал презентационным и
// получает готовые числа — сервер считает их по ПОЛНОМУ набору лидов
// (окно в 50 карточек не должно искажать «Всего лидов» и тренды).

const MS_7D = 7 * 24 * 60 * 60 * 1000;

export interface LeadsKpiCardsStats {
  totalLeads: number;
  todayActive: number;
  hot: number;
  verified: number;
  pendingTodos: number;
  revenue: number;
  /** Окно 7 дней против предыдущих 7 — сырье для строк-трендов. */
  trends: {
    leadsCur: number;
    leadsPrev: number;
    hotCur: number;
    verCur: number;
    todosCur: number;
    revCur: number;
    revPrev: number;
  };
}

function isTodayDate(dateStr: string | null, now: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function computeLeadsKpiCardsStats(
  leads: LeadRow[],
  todos: LeadTodoRow[],
  nowMs: number = Date.now(),
): LeadsKpiCardsStats {
  const now = new Date(nowMs);
  let todayActive = 0;
  let hot = 0;
  let verified = 0;
  let revenue = 0;
  let leadsCur = 0, leadsPrev = 0, hotCur = 0, verCur = 0;
  let revCur = 0, revPrev = 0;

  for (const l of leads) {
    if (isTodayDate(l.createdAt, now) || isTodayDate(l.lastSeenAt, now)) todayActive++;
    if (l.verified) verified++;
    if (l.avito?.analysis?.temperature === "hot") hot++;
    revenue += l.totalSpent || 0;

    const created = l.createdAt ? new Date(l.createdAt).getTime() : NaN;
    const inCur = Number.isFinite(created) && created > nowMs - MS_7D;
    const inPrev = Number.isFinite(created) && created <= nowMs - MS_7D && created > nowMs - 2 * MS_7D;
    if (inCur) {
      leadsCur++;
      if (l.avito?.analysis?.temperature === "hot") hotCur++;
      if (l.verified) verCur++;
    }
    if (inPrev) leadsPrev++;
    // Выручка окна: аренды по дате старта, продажи по дате создания.
    for (const r of l.rentals || []) {
      const s = r.startDate ? new Date(r.startDate).getTime() : NaN;
      if (!Number.isFinite(s)) continue;
      if (s > nowMs - MS_7D) revCur += r.totalCost || 0;
      else if (s > nowMs - 2 * MS_7D) revPrev += r.totalCost || 0;
    }
    for (const s of l.sales || []) {
      const cs = s.createdAt ? new Date(s.createdAt).getTime() : NaN;
      if (!Number.isFinite(cs)) continue;
      if (cs > nowMs - MS_7D) revCur += s.salePrice || 0;
      else if (cs > nowMs - 2 * MS_7D) revPrev += s.salePrice || 0;
    }
  }

  const pendingTodos = todos.filter((t) => t.status !== "done").length;
  const todosCur = todos.filter((t) => {
    if (t.status === "done") return false;
    const c = t.created_at ? new Date(t.created_at).getTime() : NaN;
    return Number.isFinite(c) && c > nowMs - MS_7D;
  }).length;

  return {
    totalLeads: leads.length,
    todayActive,
    hot,
    verified,
    pendingTodos,
    revenue,
    trends: { leadsCur, leadsPrev, hotCur, verCur, todosCur, revCur, revPrev },
  };
}
