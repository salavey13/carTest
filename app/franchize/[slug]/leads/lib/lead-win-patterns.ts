// /app/franchize/[slug]/leads/lib/lead-win-patterns.ts
//
// ОБЩИЕ ФАКТОРЫ ПОБЕД (common factors analysis) — шаг 9 блупринта Хормози
// (транскрипт «Blueprint To Making Money»): «сделай 100, посмотри на
// топ-10% и найди, что у них ОБЩЕГО, чего нет у остальных». Здесь —
// версия по лидам: сравниваем закрытые «выигрыши» (closed_won) и «потери»
// (closed_lost) по факторам, которые мы честно знаем из данных:
//   • скорость первого ответа ≤ 5 мин (правило окна из курса 2026);
//   • канал (Авито против остальных);
//   • выходной ли день обращения (сб/вс — «+29% выручки»);
//   • глубина диалога (≥ 3 сообщения покупателя — «эффективный контакт»).
//
// ЧЕСТНОСТЬ ЦИФР (анти-мусор):
//   • паттерн показывается только если в ОБОИХ группах достаточно выборки
//     (MIN_CELL_N побед и потерь по фактору) и общий минимум закрытых
//     (MIN_CLOSED_N) — иначе «инсайт» на n=2 превращается в примету;
//   • формат доли — проценты в группах, не корреляция: «среди выигрышей
//     X% отвечали ≤ 5 мин против Y% среди потерь»;
//   • ничего не выдумываем: фактор отсутствует в данных — паттерна нет.
//
// Модуль чистый: без React, без Date.now() — только данные лида и todos.

import type { LeadRow, LeadTodoRow } from "../leads-types";
import { ensureLeadArraysSafe } from "./lead-speed";
import { matchTodosToLead } from "./pipeline-stages";
import { isHandledTodo } from "./lead-handling";
import { isAvitoLead } from "./lead-identity";

// ── Пороги честности ────────────────────────────────────────────────────────

/** Минимум закрытых лидов в КАЖДОЙ группе (побед/потерь), чтобы говорить
 *  о паттернах вообще. Ниже — «примета», не статистика. */
const MIN_CLOSED_N = 6;
/** Минимум лидов в ячейке фактора (например, «побед с ответом ≤ 5 мин»). */
const MIN_CELL_N = 3;

/** «Быстрый ответ» — то же окно, что в скоростной панели (курс 2026). */
const FAST_MS = 5 * 60_000;
/** «Глубокий диалог» — порог «эффективного контакта» из протокола. */
const DEEP_DIALOG_MESSAGES = 3;

// ── Типы ───────────────────────────────────────────────────────────────────

export type WinPatternKey = "fast-response" | "avito" | "weekend" | "deep-dialog";

export interface WinPattern {
  key: WinPatternKey;
  /** Человекочитаемый фактор: «Ответ ≤ 5 мин». */
  label: string;
  /** Доля фактора среди побед 0..1. */
  wonShare: number;
  /** Доля фактора среди потерь 0..1. */
  lostShare: number;
  /** Сколько побед/потерь вообще участвовало в сравнении. */
  wonN: number;
  lostN: number;
  /** Подсказка-действие для оператора (почему это стоит повторять). */
  hint: string;
}

// ── Хелперы ────────────────────────────────────────────────────────────────

function safeMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Время первого «обработан»-касания по todos (та же семантика, что в
 *  lead-speed.ts: completed_at || created_at самого раннего отмеченного). */
function earliestHandledAt(todosForLead: LeadTodoRow[]): number {
  let best = NaN;
  for (const t of todosForLead) {
    if (!isHandledTodo(t)) continue;
    const ts = safeMs(t.completed_at || t.created_at || null);
    if (Number.isFinite(ts) && (Number.isNaN(best) || ts < best)) best = ts;
  }
  return best;
}

function isWeekendIso(iso: string | null | undefined): boolean {
  const t = safeMs(iso);
  if (!Number.isFinite(t)) return false;
  const day = new Date(t).getDay(); // 0 = вс, 6 = сб
  return day === 0 || day === 6;
}

/** Доля фактора в группе: matches / n, null — если n ячейки < MIN_CELL_N. */
function share(count: number, n: number): number | null {
  if (n < MIN_CELL_N) return null;
  return count / n;
}

// ── Основной расчёт ────────────────────────────────────────────────────────

/**
 * Паттерны «общих факторов» по закрытым лидам. Возвращает до 4 паттернов;
 * пустой массив — данных мало (панель честно молчит, не рисует примет).
 */
export function computeWinPatterns(
  leadsInput: LeadRow[],
  allTodosInput: LeadTodoRow[],
): WinPattern[] {
  const leads = Array.isArray(leadsInput) ? leadsInput : [];
  const allTodos = Array.isArray(allTodosInput) ? allTodosInput : [];

  // Два прохода: сначала разложим закрытые по группам, посчитаем n и счётчики.
  const won: LeadRow[] = [];
  const lost: LeadRow[] = [];
  for (const rawLead of leads) {
    const lead = ensureLeadArraysSafe(rawLead);
    if (lead.identityState === "operator_placeholder") continue;
    const stage = lead.stageKey || "";
    if (stage === "closed_won") won.push(lead);
    else if (stage === "closed_lost") lost.push(lead);
  }

  if (won.length < MIN_CLOSED_N || lost.length < MIN_CLOSED_N) return [];

  // Счётчики факторов по группам.
  let wonFast = 0,
    lostFast = 0;
  let wonAvito = 0,
    lostAvito = 0;
  let wonWeekend = 0,
    lostWeekend = 0;
  let wonDeep = 0,
    lostDeep = 0;
  let wonWithHandle = 0,
    lostWithHandle = 0; // знаменатель для «скорости» (есть отметка времени)

  for (const lead of won) {
    const todosForLead = matchTodosToLead(lead, allTodos);
    const handledMs = earliestHandledAt(todosForLead);
    if (Number.isFinite(handledMs)) {
      wonWithHandle += 1;
      const createdMs = safeMs(lead.createdAt);
      if (Number.isFinite(createdMs) && handledMs - createdMs <= FAST_MS) wonFast += 1;
    }
    if (isAvitoLead(lead)) wonAvito += 1;
    if (isWeekendIso(lead.createdAt)) wonWeekend += 1;
    if ((lead.avito?.messagesCount ?? 0) >= DEEP_DIALOG_MESSAGES) wonDeep += 1;
  }

  for (const lead of lost) {
    const todosForLead = matchTodosToLead(lead, allTodos);
    const handledMs = earliestHandledAt(todosForLead);
    if (Number.isFinite(handledMs)) {
      lostWithHandle += 1;
      const createdMs = safeMs(lead.createdAt);
      if (Number.isFinite(createdMs) && handledMs - createdMs <= FAST_MS) lostFast += 1;
    }
    if (isAvitoLead(lead)) lostAvito += 1;
    if (isWeekendIso(lead.createdAt)) lostWeekend += 1;
    if ((lead.avito?.messagesCount ?? 0) >= DEEP_DIALOG_MESSAGES) lostDeep += 1;
  }

  const patterns: WinPattern[] = [];

  const fastWon = share(wonFast, wonWithHandle);
  const fastLost = share(lostFast, lostWithHandle);
  if (fastWon != null && fastLost != null) {
    patterns.push({
      key: "fast-response",
      label: "Ответ ≤ 5 мин",
      wonShare: fastWon,
      lostShare: fastLost,
      wonN: wonWithHandle,
      lostN: lostWithHandle,
      hint: "из отвеченных в первую пятиминутку чаще выходят сделки — держи окно",
    });
  }

  const avitoWon = share(wonAvito, won.length);
  const avitoLost = share(lostAvito, lost.length);
  if (avitoWon != null && avitoLost != null) {
    patterns.push({
      key: "avito",
      label: "Канал Авито",
      wonShare: avitoWon,
      lostShare: avitoLost,
      wonN: won.length,
      lostN: lost.length,
      hint: "какой канал приносит закрытия — туда первое внимание смены",
    });
  }

  const weekendWon = share(wonWeekend, won.length);
  const weekendLost = share(lostWeekend, lost.length);
  if (weekendWon != null && weekendLost != null) {
    patterns.push({
      key: "weekend",
      label: "Обращение в выходные",
      wonShare: weekendWon,
      lostShare: weekendLost,
      wonN: won.length,
      lostN: lost.length,
      hint: "выходные — «+29% выручки»: смена в сб/вс окупается, если их вести",
    });
  }

  const deepWon = share(wonDeep, won.length);
  const deepLost = share(lostDeep, lost.length);
  if (deepWon != null && deepLost != null) {
    patterns.push({
      key: "deep-dialog",
      label: "Диалог ≥ 3 сообщений",
      wonShare: deepWon,
      lostShare: deepLost,
      wonN: won.length,
      lostN: lost.length,
      hint: "диалог глубже трёх сообщений — признак живой сделки, не отвечай одним словом",
    });
  }

  return patterns;
}
