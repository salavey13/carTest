// /app/franchize/[slug]/leads/lib/lead-kpi.ts
//
// KPI-ВОРОНКА ЛИДОВ — оцифровка отдела продаж по протоколу встречи.
// =====================================================================
//
// Просьба босса: «Implement most interesting from following ideas» — из
// конспекта встречи (KPI-мотивация, оцифровка воронки) взято то, что можно
// посчитать прямо на клиенте из уже загруженных данных:
//
//   А. АКТИВНОСТЬ (вход в воронку)  — все входящие лиды (без заглушек).
//   Б. ДИАЛОГ («эффективный контакт») — лид отработан: отметка «✅ обработан»
//      ИЛИ конверсия в аренду/покупку (та же логика, что в lead-speed.ts).
//   В. КЭВ — КЛЮЧЕВОЕ СОБЫТИЕ воронки («существенно повышает вероятность
//      покупки»): для vip-bike это договор/бронь — аренда создана и ждёт
//      активации (contract_sent / awaiting_qr_claim / documents_missing),
//      уже идёт (active_rental / return_due) или успешно закрыта
//      (closed_won). Аналог «тест-драйва / визита в шоу-рум» из протокола.
//   Г. СДЕЛКА — деньги: активная/успешная аренда или продажа.
//
// Плюс «не допустить слива целевых лидов»: счётчик ГОРЯЧИХ лидов, которые
// ещё ждут ответа (temperature=hot без обработки/конверсии/назначенного
// перезвона) — их видно сразу, пока не стало поздно.
//
// ЮНИТ-ЭКОНОМИКА (лайт): выручка экипажа и средний чек сделки — без CPL/CAC,
// т.к. расходов на рекламу в данных лида нет.
//
// НОРМА ДНЯ (из протокола: «нормирование КЭВ») — NORM_HANDLED_PER_DAY
// обработанных лидов в день; прогресс показывается в панели воронки.
// НОРМА НЕДЕЛИ — NORM_KEV_PER_WEEK КЭВ-лидов за неделю (пн–пт), та же
// «нормирование КЭВ» из протокола в недельном выражении.
//
// ПАКЕТ 2 ДОСТИЖЕНИЙ (2026-09-05, «Add more achievements»): +5 метрик —
// kevThisWeek/leadsThisWeek (недельная динамика), salesTotal (продажи
// байков), revenuePerLead (лайт-LTV: выручка на лид), avgDialogDepth
// («эффективный контакт» из протокола — глубина диалога покупателя).
//
// ПЛЕЙБУК 2026 (2026-09-06, «enhance leads with ideas from transcript» —
// The Ultimate Sales Training 2026): +4 метрики — weekendLeads/weekendHandled
// («продавай 7 дней в неделю»: суббота+воскресенье = +104 дня = +29% в год),
// ghostsTotal (молчаливые авито-диалоги >24 ч без ответа — пул реанимации:
// «no for now ≠ no forever») и avitoLeads (канал для применимости метрик).
//
// Модуль чистый: без React, без Date.now() внутри (now передаётся снаружи).
// Скоростные метрики (lead-speed.ts) встроены в результат одним вызовом —
// клиент считает всё за один useMemo.

import type { LeadRow, LeadTodoRow } from "../leads-types";
import {
  asArray,
  computeLeadSpeedMetrics,
  ensureLeadArraysSafe,
  type LeadSpeedMetrics,
} from "./lead-speed";
import { computeLeadStage, matchTodosToLead } from "./pipeline-stages";
import { isCallbackTodo, isHandledTodo } from "./lead-handling";

/**
 * Порог тишины, после которого авито-диалог считается «пропавшим»
 * (ghost): последнее сообщение покупателя старше суток, отметки
 * «обработан»/конверсии/перезвона нет. По курсу 2026 такие лиды не «нет»,
 * а «не сейчас» — их реанимируют мем-сообщением (самый высокий отклик).
 */
export const GHOST_SILENCE_MS = 24 * 60 * 60 * 1000;

// ── Нормы дня (протокол: «нормирование КЭВ/звонков») ───────────────────────

/** Норма обработанных лидов в день на экипаж. */
export const NORM_HANDLED_PER_DAY = 4;

/**
 * Недельная норма КЭВ (протокол: «нормирование КЭВ» в недельном выражении):
 * 4 лид/день × 5 рабочих дней.
 */
export const NORM_KEV_PER_WEEK = NORM_HANDLED_PER_DAY * 5;

// ── Стадии КЭВ и Сделки ────────────────────────────────────────────────────

/**
 * КЭВ — договор отправлен или дальше (сделка в оформлении/идёт/закрыта
 * успешно). Именно эти стадии «существенно повышают вероятность покупки».
 */
const KEV_STAGES: ReadonlySet<string> = new Set([
  "contract_sent",
  "awaiting_qr_claim",
  "documents_missing",
  "active_rental",
  "return_due",
  "closed_won",
]);

/** Сделка — деньги уже в кассе: аренда идёт или успешно завершена, продажа. */
const DEAL_STAGES: ReadonlySet<string> = new Set([
  "active_rental",
  "return_due",
  "closed_won",
]);

// ── Типы ───────────────────────────────────────────────────────────────────

export interface KpiFunnel {
  /** Вход в воронку: все входящие лиды (заглушки операторов исключены). */
  leads: number;
  /** Диалог: лид отработан (отметка «обработан» или конверсия). */
  dialogs: number;
  /** КЭВ: договор/бронь отправлена и дальше. */
  kev: number;
  /** Сделка: аренда идёт/успешно закрыта или продажа. */
  deals: number;
}

export interface LeadKpiMetrics {
  funnel: KpiFunnel;
  /** Лидов пришло сегодня (календарный день now). */
  leadsToday: number;
  /** Лидов пришло за текущую неделю (с понедельника) — «магнит недели». */
  leadsThisWeek: number;
  /** КЭВ-лидов за текущую неделю — недельная норма NORM_KEV_PER_WEEK. */
  kevThisWeek: number;
  /** Продаж байков по лидам экипажа (сумма sales) — направление «продажи». */
  salesTotal: number;
  /** Обработано сегодня (= speed.handledToday). */
  handledToday: number;
  /** Горячих лидов всего (avito temperature=hot). */
  hotTotal: number;
  /** Горячих, которые ЕЩЁ ЖДУТ ответа — «не слить целевые лиды». */
  hotWaiting: number;
  /** Лидов с заявленным тест-драйвом (avito intent=testdrive) — КЭВ-приглашения. */
  testdrives: number;
  /** Лидов авито-канала (webhook/bot_forward) — база применимости авито-метрик. */
  avitoLeads: number;
  /** Лидов, пришедших в выходные (сб/вс) — «продавай 7 дней в неделю» (+29%). */
  weekendLeads: number;
  /** Из них обработано или сконвертировалось. */
  weekendHandled: number;
  /** Авито-диалоги, молчащие >24 ч без обработки/конверсии/перезвона —
   *  пул реанимации («no for now ≠ no forever», курс 2026). */
  ghostsTotal: number;
  /** Выручка экипажа по лидам (сумма totalSpent), ₽. */
  revenue: number;
  /** Средний чек сделки, ₽ — null, если сделок нет. */
  avgDealCheck: number | null;
  /** Выручка на один лид (лайт-LTV без CPL), ₽ — null, если лидов нет. */
  revenuePerLead: number | null;
  /** Средняя глубина диалога (сообщений покупателя на авито) — «эффективный
   *  контакт» из протокола; null, если данных о сообщениях нет. */
  avgDialogDepth: number | null;
  /** Конверсии 0..1 — null, если знаменатель 0. */
  responseRate: number | null;
  kevRate: number | null;
  dealRate: number | null;
  /** Прогресс нормы дня 0..1 (может быть > 1 — перевыполнение). */
  normProgress: number;
  /** Встроенные скоростные метрики (lead-speed.ts) — один источник правды. */
  speed: LeadSpeedMetrics;
}

// ── Хелперы ────────────────────────────────────────────────────────────────

function isSameCalendarDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date(now);
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
}

/**
 * Начало текущей недели — понедельник 00:00 локального времени (неделя
 * рабочая, метрики отдела считаются пн–пт; now — снаружи для чистоты тестов).
 */
export function startOfWeek(now: number): number {
  const d = new Date(now);
  const mondayOffset = (d.getDay() + 6) % 7; // 0 = понедельник
  d.setDate(d.getDate() - mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rateOr(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

// ── Основной расчёт ────────────────────────────────────────────────────────

/**
 * KPI-воронка по всему срезу лидов. now — снаружи (чистота + тесты);
 * в клиенте передаётся nowTick (обновление раз в минуту вместе со speed).
 */
export function computeLeadKpi(
  leadsInput: LeadRow[],
  allTodosInput: LeadTodoRow[],
  now: number = Date.now(),
): LeadKpiMetrics {
  const leads = asArray(leadsInput);
  const allTodos = asArray(allTodosInput);
  const speed = computeLeadSpeedMetrics(leads, allTodos, now);

  let leadsTotal = 0;
  let leadsToday = 0;
  let leadsThisWeek = 0;
  let kevCount = 0;
  let kevThisWeek = 0;
  let dealCount = 0;
  let hotTotal = 0;
  let hotWaiting = 0;
  let testdrives = 0;
  let avitoLeads = 0;
  let weekendLeads = 0;
  let weekendHandled = 0;
  let ghostsTotal = 0;
  let salesTotal = 0;
  let revenue = 0;
  let dialogDepthSum = 0;
  let dialogDepthCount = 0;
  const weekStart = startOfWeek(now);

  for (const rawLead of leads) {
    // EDGE CASE: нормализация массивов лида один раз — внутри legacy
    // pipeline-stages.ts (computeLeadStage/matchTodosToLead) прямые
    // rentals.length/sales.map без неё падают на битой строке API.
    const lead = ensureLeadArraysSafe(rawLead);
    // Операторские заглушки — не входящие обращения, воронку не портим
    // (та же политика, что и в lead-speed.ts).
    if (lead.identityState === "operator_placeholder") continue;

    leadsTotal += 1;

    // Недельная динамика: создан в текущей рабочей неделе (с понедельника).
    const createdMs = lead.createdAt ? new Date(lead.createdAt).getTime() : NaN;
    const isThisWeek = Number.isFinite(createdMs) && createdMs >= weekStart;
    if (lead.createdAt && isSameCalendarDay(lead.createdAt, now)) leadsToday += 1;
    if (isThisWeek) leadsThisWeek += 1;

    // Стадия: сервер проставляет stageKey, иначе считаем локально.
    const stage = lead.stageKey || computeLeadStage(lead);
    if (KEV_STAGES.has(stage)) {
      kevCount += 1;
      if (isThisWeek) kevThisWeek += 1;
    }
    if (DEAL_STAGES.has(stage)) dealCount += 1;

    // Продажи байков — отдельное направление отдела продаж (протокол).
    salesTotal += lead.sales.length;

    // Горячие лиды, которые ещё ждут ответа: температура от AI-анализа,
    // «ждёт» = не обработан, не конвертирован, без назначенного перезвона.
    if (lead.avito?.analysis?.temperature === "hot") {
      hotTotal += 1;
      if (isLeadUnhandledWaiting(lead, allTodos)) hotWaiting += 1;
    }

    if (lead.avito?.analysis?.intent === "testdrive") testdrives += 1;

    // Авито-канал: та же тройка проверок, что в lead-scripts.isAvitoLeadLike
    // (локальная лёгкая копия вместо React-цепочки leads-utils).
    const isAvitoLike =
      lead.contactChannel === "avito" ||
      !!lead.avito?.chatId ||
      lead.user_id.startsWith("avito:");
    if (isAvitoLike) avitoLeads += 1;

    // «Продавай 7 дней в неделю» (курс 2026): лиды, пришедшие в сб/вс,
    // плюс их обработанность — покрытие выходных = +29% к году.
    if (createdMs && Number.isFinite(createdMs)) {
      const day = new Date(createdMs).getDay();
      if (day === 0 || day === 6) {
        weekendLeads += 1;
        if (isLeadHandledLike(lead, allTodos)) weekendHandled += 1;
      }
    }

    // Ghost-диалог: авито, была переписка, тишина покупателя >24 ч, при
    // этом лид не обработан, не конвертировался и без назначенного перезвона
    // — пул реанимации («нет — не навсегда», курс 2026).
    if (isAvitoLike && isGhostDialog(lead, now)) {
      const waiting = isLeadUnhandledWaiting(lead, allTodos);
      if (waiting) ghostsTotal += 1;
    }

    // Глубина диалога: захваченные сообщения покупателя (авито-канал).
    // EDGE CASE: Number.isFinite — Infinity из битых метаданных испортил бы
    // среднее (NaN/Infinity улетели бы в достижения и тултипы).
    const messagesCount = lead.avito?.messagesCount;
    if (typeof messagesCount === "number" && Number.isFinite(messagesCount) && messagesCount > 0) {
      dialogDepthSum += messagesCount;
      dialogDepthCount += 1;
    }

    // EDGE CASE: totalSpent — только конечные положительные числа;
    // Infinity/отрицательные значения (битые данные) искажают кассу.
    // NB: NaN отсекался и раньше (`NaN || 0` → 0), Infinity — нет.
    const spent = lead.totalSpent;
    if (typeof spent === "number" && Number.isFinite(spent) && spent > 0) revenue += spent;
  }

  const dialogs = speed.handledTotal;
  const responseRate = rateOr(dialogs, leadsTotal);
  const kevRate = rateOr(kevCount, leadsTotal);
  const dealRate = rateOr(dealCount, leadsTotal);
  // Число делений защищено dealCount > 0; Number.isFinite — страховка от
  // будущего возврата Infinity в revenue (средний чек улетел бы в UI).
  const avgDealCheck = dealCount > 0 && Number.isFinite(revenue) ? revenue / dealCount : null;
  const revenuePerLead = rateOr(revenue, leadsTotal);
  const avgDialogDepth = dialogDepthCount > 0 ? dialogDepthSum / dialogDepthCount : null;

  return {
    funnel: { leads: leadsTotal, dialogs, kev: kevCount, deals: dealCount },
    leadsToday,
    leadsThisWeek,
    kevThisWeek,
    salesTotal,
    handledToday: speed.handledToday,
    hotTotal,
    hotWaiting,
    testdrives,
    avitoLeads,
    weekendLeads,
    weekendHandled,
    ghostsTotal,
    revenue,
    avgDealCheck,
    revenuePerLead,
    avgDialogDepth,
    responseRate,
    kevRate,
    dealRate,
    normProgress: speed.handledToday / NORM_HANDLED_PER_DAY,
    speed,
  };
}

/**
 * Ждёт ли лид ответа прямо сейчас: не обработан (нет отметки), не
 * конвертировался, без активного перезвона. Те же правила очереди, что в
 * lead-speed.ts (matchTodosToLead + isHandledTodo + isCallbackTodo), —
 * горячие лиды просто получают отдельный счётчик, чтобы «не слить целевых».
 */
export function isLeadUnhandledWaiting(lead: LeadRow, allTodos: LeadTodoRow[]): boolean {
  const isConverted = lead.rentals.length > 0 || lead.sales.length > 0 || (lead.contractCount ?? 0) > 0;
  if (isConverted) return false;

  let hasHandledMark = false;
  let hasActiveCallback = false;
  for (const t of matchTodosToLead(lead, allTodos)) {
    if (isHandledTodo(t)) hasHandledMark = true;
    if (isCallbackTodo(t) && t.status !== "done") hasActiveCallback = true;
  }
  return !hasHandledMark && !hasActiveCallback;
}

/**
 * Обработан ли лид (отметка «обработан» ИЛИ конверсия) — без требования
 * времени. Используется для «обработанность выходных лидов» (покрытие
 * сб/вс), где время отметки не важно, важен факт.
 */
function isLeadHandledLike(lead: LeadRow, allTodos: LeadTodoRow[]): boolean {
  if (lead.rentals.length > 0 || lead.sales.length > 0 || (lead.contractCount ?? 0) > 0) return true;
  for (const t of matchTodosToLead(lead, allTodos)) {
    if (isHandledTodo(t)) return true;
  }
  return false;
}

/**
 * Авито-диалог «пропал» (ghost): была переписка (lastMessage или >1
 * сообщения покупателя) и последнее сообщение покупателя старше 24 ч.
 * Обработанность/конверсию/перезвон проверяет вызывающий (isLeadUnhandledWaiting)
 * — здесь только факт тишины в канале.
 */
function isGhostDialog(lead: LeadRow, now: number): boolean {
  const avito = lead.avito;
  if (!avito) return false;
  const messagesCount = typeof avito.messagesCount === "number" && Number.isFinite(avito.messagesCount)
    ? avito.messagesCount
    : 0;
  const hadDialog = messagesCount >= 2 || !!(avito.lastMessage || "").trim() || !!(avito.firstMessage || "").trim();
  if (!hadDialog) return false;
  const silenceFrom = avito.lastMessageAt || lead.lastSeenAt || lead.createdAt || null;
  if (!silenceFrom) return false;
  const t = new Date(silenceFrom).getTime();
  if (!Number.isFinite(t)) return false;
  const age = now - t;
  // БУДУЩЕЕ время (ошибка часов/теста) — тишиной не считаем.
  if (age < 0) return false;
  return age >= GHOST_SILENCE_MS;
}
