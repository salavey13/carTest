// /app/franchize/[slug]/leads/lib/lead-speed.ts
//
// LEAD SPEED METRICS — счётчики скорости обработки лидов.
// =====================================================================
//
// Просьба босса: «add counters to visualize lead handling speed».
//
// ЧТО СЧИТАЕМ (все метрики — чистые функции от данных, без сервера):
//   • Время обработки лида = момент отметки «✅ Лид обработан» (earliest
//     handling-todo completed_at) − createdAt лида. Если лид КОНВЕРТИРОВАЛСЯ
//     (аренда/покупка/договор), он тоже «обработан» — но без отметки времени
//     (в статистику скорости не попадает, в «ждущие» тоже).
//   • Медиана и средняя скорость — по лидам с известными обеими точками.
//   • Распределение по бакетам: ≤15 мин / 15 мин–1 ч / 1–4 ч / 4–24 ч /
//     >24 ч — мини-бар в UI показывает, где застревает скорость.
//   • ПРАВИЛО 5 МИНУТ (Ultimate Sales Blueprint 2026): ответ в первые
//     60 сек = +391% к шансу закрытия, после 5 минут тишины — −80%.
//     Считаем долю обработок, уложившихся в 5 минут (under5m), и число
//     обработок с известным временем (handledTimedTotal) — из них
//     достижения «Пять минут» и «Молния».
//   • Ждут ответа: лиды без отметки «обработан» и без конверсии; отдельно
//     счётчики «ждут >1 ч» и «ждут >24 ч» (SLA-тревога) + топ-3 «дольше всех
//     ждут» для всплывающей подсказки.
//   • Перезвоны: активные (pending) и просроченные — из того же handling-
//     состояния, что и плашки «📞 Перезвонить» в списках.
//
// ОПЕРАТОРСКИЕ ЗАГЛУШКИ (identityState="operator_placeholder") — это лиды,
// созданные оператором через /doc, а не входящие обращения: они исключаются
// из всех метрик, чтобы не портить скорость фиктивными точками.
//
// Модуль чистый: без React, без Date.now() внутри (now передаётся снаружи) —
// стабильно мемоизируется в клиенте и тестируется фиксациями времени.

import type { LeadRow, LeadTodoRow } from "../leads-types";
import { isHandledTodo, isCallbackTodo } from "./lead-handling";
import { matchTodosToLead } from "./pipeline-stages";

// ── Типы ────────────────────────────────────────────────────────────────────

export type SpeedBucketKey = "lt15m" | "lt1h" | "lt4h" | "lt24h" | "over24h";

export interface SpeedBucket {
  key: SpeedBucketKey;
  label: string;
  /** Цвет сегмента в UI (зелёный → красный по мере роста времени ответа). */
  color: string;
  count: number;
}

export interface WorstWaiting {
  id: string;
  name: string;
  /** Сколько ждёт ответа (мс). */
  ageMs: number;
}

export interface LeadSpeedMetrics {
  /** Лидов обработано всего (отметка «обработан» ИЛИ конверсия). */
  handledTotal: number;
  /** Из них — с отметкой/активностью СЕГОДНЯ (календарный день now). */
  handledToday: number;
  /** Лидов сконвертировалось (аренда/покупка/договор) — «до денег дошли». */
  converted: number;
  /** Медиана времени обработки (мс), null — нет ни одной точки. */
  medianMs: number | null;
  /** Средняя скорость обработки (мс), null — нет точек. */
  avgMs: number | null;
  /** Быстрый ответ (минимальное время обработки), null — нет точек. */
  fastestMs: number | null;
  /** Обработок с известным временем — знаменатель доли «в 5 минут». */
  handledTimedTotal: number;
  /** Из них уложились в 5 минут (правило 5 минут из курса 2026). */
  under5m: number;
  /** Доля ответов ≤5 минут 0..1, null — нет timed-точек. */
  under5mRate: number | null;
  /** Ждут первого внятного ответа прямо сейчас. */
  waitingTotal: number;
  /** Ждут дольше часа (начало просадки скорости). */
  waitingOver1h: number;
  /** Ждут дольше суток (SLA-провал). */
  waitingOver24h: number;
  /** Активных перезвонов назначено. */
  callbacksPending: number;
  /** Перезвонов просрочено (время пришло, звонка нет). */
  callbacksOverdue: number;
  /** Распределение скорости обработки по бакетам. */
  buckets: SpeedBucket[];
  /** Топ-3 «дольше всех ждут» — для подсказки оператору, кого спасать. */
  worstWaiting: WorstWaiting[];
}

/**
 * Правило 5 минут (Ultimate Sales Blueprint 2026): после 5 минут тишины
 * шанс закрытия падает на 80%. Порог для доли быстрых ответов.
 */
export const FAST_RESPONSE_WINDOW_MS = 5 * 60_000;

// ── Константы бакетов ───────────────────────────────────────────────────────

const BUCKET_DEFS: ReadonlyArray<{
  key: SpeedBucketKey;
  label: string;
  color: string;
  /** Верхняя граница бакета в мс (Infinity — последний). */
  maxMs: number;
}> = [
  { key: "lt15m", label: "≤ 15 мин", color: "#22c55e", maxMs: 15 * 60_000 },
  { key: "lt1h", label: "15 мин – 1 ч", color: "#14b8a6", maxMs: 60 * 60_000 },
  { key: "lt4h", label: "1 – 4 ч", color: "#f59e0b", maxMs: 4 * 60 * 60_000 },
  { key: "lt24h", label: "4 – 24 ч", color: "#f97316", maxMs: 24 * 60 * 60_000 },
  { key: "over24h", label: "> 24 ч", color: "#ef4444", maxMs: Infinity },
];

function bucketFor(handleMs: number): SpeedBucketKey {
  for (const b of BUCKET_DEFS) {
    if (handleMs <= b.maxMs) return b.key;
  }
  return "over24h";
}

// ── Форматирование ──────────────────────────────────────────────────────────

/** «45 м» / «2 ч 10 м» / «3 д 4 ч» — компактная длительность для плиток UI. */
export function fmtDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} д ${h % 24} ч`;
  if (h > 0) return `${h} ч ${m % 60} м`;
  if (m > 0) return `${m} м`;
  return "меньше минуты";
}

// ── Внутренние хелперы ──────────────────────────────────────────────────────

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
 * EDGE CASE: битая строка API (rentals/sales = null вместо []) или битый
 * срез todos не должны ронять весь useMemo-дерево лидов (белый экран).
 * Аналитика — чистая функция: на любом входе считает, а не бросает.
 */
export function asArray<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

/**
 * EDGE CASE-политика модулей аналитики: битая строка API (rentals/sales =
 * null вместо []) или битый срез (leads/todos не массив) не роняют расчёт
 * (раньше — белый экран всей страницы лидов). Чистая функция считает на
 * любом входе, а не бросает.
 */
export function ensureLeadArraysSafe(lead: LeadRow): LeadRow {
  if (Array.isArray(lead.rentals) && Array.isArray(lead.sales)) return lead;
  return { ...lead, rentals: asArray(lead.rentals), sales: asArray(lead.sales) };
}

/** Раннейшая отметка «✅ Лид обработан» среди matching-строк, или null. */
function earliestHandledAt(todosForLead: LeadTodoRow[]): string | null {
  let best: string | null = null;
  for (const t of todosForLead) {
    if (!isHandledTodo(t)) continue;
    const ts = t.completed_at || t.created_at || null;
    if (ts && (!best || ts < best)) best = ts;
  }
  return best;
}

/** Прослушивающий перезвон с флагом просрочки — для счётчиков перезвонов. */
interface CallbackScan {
  pending: number;
  overdue: number;
}

/**
 * Активный перезвон лида (самый поздний по due_date — та же логика, что в
 * getLeadHandling) → максимум 1 pending + 1 overdue на лид: в UI у лида
 * одна плашка «📞 Перезвонить», и счётчики должны совпадать с ней.
 */
function scanCallback(todosForLead: LeadTodoRow[], now: number): CallbackScan {
  let latest: { dueAt: string } | null = null;
  for (const t of todosForLead) {
    if (!isCallbackTodo(t) || t.status === "done") continue;
    const dueAt = t.due_date || t.created_at || "";
    if (!latest || dueAt > latest.dueAt) latest = { dueAt };
  }
  if (!latest) return { pending: 0, overdue: 0 };
  const due = new Date(latest.dueAt).getTime();
  return { pending: 1, overdue: Number.isFinite(due) && due < now ? 1 : 0 };
}

// ── Основной расчёт ─────────────────────────────────────────────────────────

/**
 * Скорость обработки лидов по всему срезу. now — снаружи (чистота + тесты);
 * в клиенте передаётся nowTick (обновление раз в минуту).
 */
export function computeLeadSpeedMetrics(
  leadsInput: LeadRow[],
  allTodosInput: LeadTodoRow[],
  now: number = Date.now(),
): LeadSpeedMetrics {
  const leads = asArray(leadsInput);
  const allTodos = asArray(allTodosInput);
  const handleTimes: number[] = [];
  const buckets = BUCKET_DEFS.map((b) => ({ ...b, count: 0 }));

  let handledTotal = 0;
  let handledToday = 0;
  let converted = 0;
  let under5m = 0;
  let waitingTotal = 0;
  let waitingOver1h = 0;
  let waitingOver24h = 0;
  let callbacksPending = 0;
  let callbacksOverdue = 0;
  const waitingList: WorstWaiting[] = [];

  for (const rawLead of leads) {
    const lead = ensureLeadArraysSafe(rawLead);
    // Операторские заглушки — не входящие обращения, метрики не портим.
    if (lead.identityState === "operator_placeholder") continue;

    const todosForLead = matchTodosToLead(lead, allTodos);
    const cb = scanCallback(todosForLead, now);
    callbacksPending += cb.pending;
    callbacksOverdue += cb.overdue;

    const isConverted =
      lead.rentals.length > 0 || lead.sales.length > 0 || (lead.contractCount ?? 0) > 0;
    if (isConverted) converted += 1;

    const handledAt = earliestHandledAt(todosForLead);
    const isHandled = handledAt != null || isConverted;
    if (isHandled) {
      handledTotal += 1;
      if (handledAt && isSameCalendarDay(handledAt, now)) handledToday += 1;
      if (handledAt && lead.createdAt) {
        const created = new Date(lead.createdAt).getTime();
        const done = new Date(handledAt).getTime();
        if (Number.isFinite(created) && Number.isFinite(done) && done >= created) {
          const ms = done - created;
          handleTimes.push(ms);
          if (ms <= FAST_RESPONSE_WINDOW_MS) under5m += 1;
          buckets.find((b) => b.key === bucketFor(ms))!.count += 1;
        }
      }
      continue;
    }

    // Не обработан и не сконвертирован. Но если перезвон НАЗНАЧЕН — это
    // контролируемое ожидание (оператор уже взял лида в работу): в очередь
    // «ждут ответа» он не попадает, чтобы не пугать оператора двойным учётом
    // (плашка перезвона и так видна в списках).
    if (cb.pending > 0) continue;
    waitingTotal += 1;
    if (lead.createdAt) {
      const created = new Date(lead.createdAt).getTime();
      if (Number.isFinite(created)) {
        const ageMs = Math.max(0, now - created);
        if (ageMs > 60 * 60_000) waitingOver1h += 1;
        if (ageMs > 24 * 60 * 60_000) waitingOver24h += 1;
        waitingList.push({
          id: lead.user_id,
          name: lead.full_name || lead.bikeTitle || "Лид",
          ageMs,
        });
      }
    }
  }

  // Медиана / средняя / максимум по накопленным точкам скорости.
  let medianMs: number | null = null;
  let avgMs: number | null = null;
  let fastestMs: number | null = null;
  if (handleTimes.length > 0) {
    const sorted = [...handleTimes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianMs =
      sorted.length % 2 === 1
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    avgMs = Math.round(handleTimes.reduce((s, v) => s + v, 0) / handleTimes.length);
    fastestMs = sorted[0];
  }

  return {
    handledTotal,
    handledToday,
    converted,
    medianMs,
    avgMs,
    fastestMs,
    handledTimedTotal: handleTimes.length,
    under5m,
    under5mRate: handleTimes.length > 0 ? under5m / handleTimes.length : null,
    waitingTotal,
    waitingOver1h,
    waitingOver24h,
    callbacksPending,
    callbacksOverdue,
    buckets,
    worstWaiting: waitingList.sort((a, b) => b.ageMs - a.ageMs).slice(0, 3),
  };
}
