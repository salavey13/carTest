// /app/franchize/[slug]/leads/lib/lead-priority.ts
//
// LEAD PRIORITY ENGINE (ТЗ: «Итоговый индекс приоритета 0–100»)
// =====================================================================
//
// Комплексный коэффициент приоритета лида от 0 до 100. Чем выше балл —
// тем выше лид поднимается в списке у менеджера (режим сортировки
// «🔥 Приоритет», теперь дефолтный на странице лидов).
//
// Формула — взвешенная сумма компонент, затем мультипликатор канала
// и кламп в 0–100:
//
//   base  = W.fresh    * freshness       // 0–100, LIFO-свежесть
//         + W.urgency  * urgencyScore    // 0–100, сквозная температура
//         + W.tasks    * taskPressure    // 0–100, открытые задачи
//         + W.value    * valuePressure   // 0–100, LTV клиента
//         + W.stage    * stageWeight     // 0–100, этап воронки
//
//   score = clamp(round(base * channelMultiplier), 0, 100)
//
// ТЗ п.2 (LIFO): обращение, поступившее «только что», автоматически
// попадает на самый верх очереди — freshness = 100 при возрасте ≤ 15 мин,
// плавное затухание до 0 за FRESHNESS_TTL (72 ч). При равном счёте
// свежий лид строго выше (tie-break по времени активности).
//
// ТЗ п.3 (Авито ×2): заявкам с Авито присваивается мультипликатор ×2
// к базовому весу — эти клиенты максимально «горячие» и требуют
// мгновенной реакции. Знак ×2 виден оператору на плашке лида.
//
// Модуль объявляет только чистые функции без Date.now() внутри расчётов
// (now передаётся снаружи) — одинаковый вход всегда даёт одинаковый выход,
// что важно для стабильности рендера и мемоизации.

import type { LeadRow } from "../leads-types";
import { isAvitoLead } from "../leads-utils";
import { type LeadHandling, isCallbackOverdue } from "./lead-handling";

// ── Канальные мультипликаторы (базовый вес ×) ───────────────────────────────
/**
 * ТЗ п.3: Авито ×2 — «максимально горячие» клиенты. Остальные каналы
 * ранжируются по «температуре» источника: входящий звонок горячее
 * пассивного открытия приложения.
 */
export const CHANNEL_MULTIPLIERS: Record<string, number> = {
  avito: 2,
  web_callback: 1.35,
  callback_request: 1.2,
  checkout_start: 1.2,
  rental_contract: 1.1,
  rent: 1.1,
  sale_contract: 1.1,
  sale: 1.1,
  test_drive: 1.05,
  testdrive_contract: 1.05,
  profile_prefill: 1,
  unknown: 1,
  app_open: 0.95,
};

/** Мультипликатор Авито (экспорт для UI-плашек «×2»). */
export const AVITO_MULTIPLIER = CHANNEL_MULTIPLIERS.avito;

// ── Веса компонент (сумма = 1) ──────────────────────────────────────────────
const W = {
  fresh: 0.4,    // Свежесть (LIFO) — главный фактор по ТЗ
  urgency: 0.25, // Существующая температура лида (urgency_score из БД)
  tasks: 0.12,   // Открытые задачи оператора по лиду
  value: 0.13,   // LTV / суммарная выручка клиента
  stage: 0.1,    // Позиция в воронке
} as const;

// ── Свежесть (LIFO) ─────────────────────────────────────────────────────────
/** Возраст, в течение которого лид считается «свежим» (для ⚡-лайбочки). */
export const FRESH_LEAD_MINUTES = 60;
/** Возраст с полным баллом свежести («только что»). */
const JUST_NOW_MINUTES = 15;
/** TTL полного затухания freshness-компоненты. */
export const FRESHNESS_TTL_MS = 72 * 60 * 60 * 1000; // 72 ч

// ── Этапы воронки: чем ближе к деньгам / операционке, тем выше вес ──────────
const STAGE_WEIGHTS: Record<string, number> = {
  needs_contact: 95,     // ждёт первого ответа — мяч на нашей стороне
  new: 80,
  documents_missing: 75, // документы — наша зона ответственности
  contract_sent: 70,
  awaiting_qr_claim: 60,
  active_rental: 55,
  return_due: 90,        // возврат сегодня-завтра — оперативка
  closed_won: 20,
  closed_lost: 0,
  dismissed: 0,
};

// ── Компоненты ───────────────────────────────────────────────────────────────

/** Возраст лида в мс (по последней активности, иначе по созданию). */
export function leadAgeMs(lead: LeadRow, now: number): number {
  const t = new Date(lead.lastSeenAt || lead.createdAt || 0).getTime();
  // Нет даты → считаем «старым» (не даём бонуса свежести за отсутствие данных).
  if (!Number.isFinite(t) || t <= 0) return FRESHNESS_TTL_MS;
  return Math.max(0, now - t);
}

/**
 * Свежесть 0–100 (LIFO-принцип, ТЗ п.2).
 * age ≤ 15 мин → 100 («только что» — на самый верх),
 * линейное затухание до 0 к FRESHNESS_TTL (72 ч).
 */
export function freshnessScore(ageMs: number): number {
  const justNowMs = JUST_NOW_MINUTES * 60 * 1000;
  if (ageMs <= justNowMs) return 100;
  if (ageMs >= FRESHNESS_TTL_MS) return 0;
  return Math.round(100 * (1 - (ageMs - justNowMs) / (FRESHNESS_TTL_MS - justNowMs)));
}

/** Открытые задачи оператора 0–100 (3+ задачи = максимум). */
function taskPressure(pendingTodos: number): number {
  return Math.min(100, pendingTodos * 35);
}

/**
 * LTV-давление 0–100 — логарифмическое насыщение:
 * 5к ₽ ≈ 43, 10к ≈ 57, 20к ≈ 69, 50к ≈ 86, 100к+ ≈ 100.
 */
function valuePressure(totalSpent: number): number {
  if (totalSpent <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(31.2 * Math.log10(totalSpent) - 62.4) + 5));
}

/** Вес этапа воронки 0–100 (неизвестный этап = 50). */
function stagePressure(stageKey: string | undefined): number {
  return STAGE_WEIGHTS[stageKey || "new"] ?? 50;
}

// ── Итоговый индекс ─────────────────────────────────────────────────────────

export interface LeadPriority {
  /** Итоговый индекс приоритета 0–100 (ТЗ п.1). */
  score: number;
  /** Компонента свежести 0–100 (LIFO). */
  freshness: number;
  /** Свежий ли лид (age ≤ FRESH_LEAD_MINUTES) — основа для ⚡-лайбочки. */
  isFresh: boolean;
  /** Высокоприоритетный (score ≥ HOT_THRESHOLD) — основа для 🔥-лайбочки. */
  isHot: boolean;
  /** Применённый мультипликатор канала (×2 для Авито). */
  channelMultiplier: number;
  /** Канал для UI-подписи. */
  channel: "avito" | "web_callback" | "callback_request" | "other";
  /** Активный перезвон назначен — время (ISO), когда нужно позвонить. */
  callbackDue: string | null;
}

/** Порог «горячего» лида для 🔥-лайбочки (ТЗ п.4). */
export const HOT_THRESHOLD = 70;

/** Бонус к индексу за ПРОСРОЧЕННЫЙ перезвон (время пришло — звонка не было). */
export const CALLBACK_OVERDUE_BOOST = 30;
/** Бонус за перезвон, который подоспел (ближайшие 3 часа). */
export const CALLBACK_SOON_BOOST = 15;
/** Горизонт «подоспевшего» перезвона. */
export const CALLBACK_SOON_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Бонус за активный перезвон (0 — нет перезвона). */
export function callbackBoost(handling: LeadHandling | undefined, now: number): number {
  const cb = handling?.callback;
  if (!cb) return 0;
  if (isCallbackOverdue(cb, now)) return CALLBACK_OVERDUE_BOOST;
  const due = new Date(cb.dueAt).getTime();
  if (Number.isFinite(due) && due - now <= CALLBACK_SOON_WINDOW_MS) return CALLBACK_SOON_BOOST;
  return 0;
}

/**
 * Расчёт итогового индекса приоритета лида (0–100).
 * Чистая функция: `now` передаётся снаружи (мемоизируется рендером).
 * `handling` (опционально) — состояние «отработан/перезвонить»: назначенный
 * перезвон, чьё время подоспело (+15) или уже ПРОСРОЧЕН (+30), поднимает
 * лид вверх очереди — менеджер обязан увидеть его первым.
 */
export function computeLeadPriority(
  lead: LeadRow,
  pendingTodos: number,
  now: number,
  handling?: LeadHandling,
): LeadPriority {
  const ageMs = leadAgeMs(lead, now);
  const freshness = freshnessScore(ageMs);
  const urgency = Math.max(0, Math.min(100, lead.urgencyScore ?? 0));
  const tasks = taskPressure(pendingTodos);
  const value = valuePressure(lead.totalSpent ?? 0);
  const stage = stagePressure(lead.stageKey);

  const avito = isAvitoLead(lead);
  const channel: LeadPriority["channel"] = avito
    ? "avito"
    : lead.source === "web_callback"
      ? "web_callback"
      : lead.source === "callback_request"
        ? "callback_request"
        : "other";
  const channelMultiplier = avito
    ? AVITO_MULTIPLIER
    : (CHANNEL_MULTIPLIERS[lead.source] ?? 1);

  const base =
    W.fresh * freshness +
    W.urgency * urgency +
    W.tasks * tasks +
    W.value * value +
    W.stage * stage;

  const score = Math.max(
    0,
    Math.min(100, Math.round(base * channelMultiplier) + callbackBoost(handling, now)),
  );

  return {
    score,
    freshness,
    isFresh: ageMs <= FRESH_LEAD_MINUTES * 60 * 1000,
    isHot: score >= HOT_THRESHOLD,
    channelMultiplier,
    channel,
    /** Активный перезвон назначен (для плашки 📞 в списке). */
    callbackDue: handling?.callback?.dueAt ?? null,
  };
}

/**
 * Компаратор сортировки «по приоритету» (по убыванию).
 * ТЗ п.2 (LIFO): при равном счёте свежий лид строго выше;
 * финальный tie-break — по user_id для стабильного порядка.
 */
export function compareByPriority(
  a: LeadRow,
  aP: LeadPriority,
  b: LeadRow,
  bP: LeadPriority,
): number {
  if (aP.score !== bP.score) return bP.score - aP.score;
  const aT = new Date(a.lastSeenAt || a.createdAt || 0).getTime();
  const bT = new Date(b.lastSeenAt || b.createdAt || 0).getTime();
  if (aT !== bT) return bT - aT;
  return (a.user_id || "").localeCompare(b.user_id || "");
}
