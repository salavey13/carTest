// /app/franchize/[slug]/leads/lib/lead-achievements.ts
//
// ДОСТИЖЕНИЯ ЭКИПАЖА — геймификация KPI из протокола встречи.
// =====================================================================
//
// Просьба босса: «Add a lot of achievements for all these metrics ;)».
//
// Каждое достижение — бейдж с уровнями бронза / серебро / золото (и «легенда»
// для составных). Уровень берётся из той же KPI-математики, что и панели
// воронки/скорости: ничего вручную отмечать не нужно — достижение
// «открывается» само, когда цифры дотягиваются до порога.
//
// НАПРАВЛЕНИЯ:
//   • max  — «чем больше, тем лучше» (сделки, выручка, конверсия);
//   • min  — «чем меньше, тем лучше» (очередь ожидания, просрочки SLA).
//
// Прогресс считается к СЛЕДУЮЩЕМУ уровню (или к нулю, если уровень ещё не
// взят), т.е. бейдж всегда подсказывает, сколько осталось до апгрейда.
//
// Модуль чистый: без React, без Date.now() — вход только LeadKpiMetrics.

import type { LeadKpiMetrics } from "./lead-kpi";
import { fmtDurationMs } from "./lead-speed";

// ── Типы ───────────────────────────────────────────────────────────────────

export type AchievementTier = "bronze" | "silver" | "gold" | "legend";

export interface AchievementTierColors {
  bronze: string;
  silver: string;
  gold: string;
  legend: string;
}

/** Цвета уровней — используются и в UI бейджей. */
export const TIER_COLORS: AchievementTierColors = {
  bronze: "#cd7f32",
  silver: "#9ca3af",
  gold: "#f59e0b",
  legend: "#8b5cf6",
};

export const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: "бронза",
  silver: "серебро",
  gold: "золото",
  legend: "легенда",
};

export interface LeadAchievement {
  id: string;
  emoji: string;
  title: string;
  /** Что меряем и зачем — подсказка в tooltip. */
  desc: string;
  /** Текущий уровень (высший достигнутый). */
  tier: AchievementTier;
  /** Текущее значение метрики. */
  value: number;
  /** Цель следующего уровня (null — максимум уже взят). */
  nextTarget: number | null;
  /** Прогресс к следующему уровню 0..1. */
  progress: number;
  /** Взят ли хотя бы бронзовый уровень. */
  unlocked: boolean;
  /** Золотой/легендарный уровень достигнут — выше нечего брать. */
  maxed: boolean;
  /** Метрика применима (например, «горячих» нет — достижение скрыто). */
  available: boolean;
  /** Форматированное текущее значение («45 м», «65 %», «185к ₽»). */
  valueLabel: string;
  /** Форматированная цель следующего уровня. */
  nextLabel: string | null;
  color: string;
}

// ── Форматирование значений ────────────────────────────────────────────────

function fmtCount(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function fmtPercent(v: number): string {
  return `${Math.round(v * 100)} %`;
}

/** «185к ₽» — компактные деньги для бейджей. */
function fmtMoneyK(v: number): string {
  if (v >= 1_000_000) return `${(Math.round(v / 100_000) / 10).toLocaleString("ru-RU")} млн ₽`;
  if (v >= 1_000) return `${Math.round(v / 1_000).toLocaleString("ru-RU")}к ₽`;
  return `${Math.round(v).toLocaleString("ru-RU")} ₽`;
}

// ── Определения достижений ─────────────────────────────────────────────────

type Direction = "max" | "min";

interface TierDef {
  tier: Exclude<AchievementTier, "legend">;
  /** Порог уровня: max → value ≥ target, min → value ≤ target. */
  target: number;
}

interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  /** Значение метрики; null → достижение скрыто (available=false). */
  metric: (k: LeadKpiMetrics) => number | null;
  direction: Direction;
  /** Уровни по возрастанию: bronze → silver → gold. */
  tiers: [TierDef, TierDef, TierDef];
  format: (v: number) => string;
}

const DEFS: AchievementDef[] = [
  {
    id: "speedster",
    emoji: "⚡",
    title: "Скорострел",
    desc: "Медиана первого ответа лиду — чем быстрее, тем выше шанс сделки",
    metric: (k) => k.speed.medianMs,
    direction: "min",
    tiers: [
      { tier: "bronze", target: 4 * 60 * 60_000 },
      { tier: "silver", target: 60 * 60_000 },
      { tier: "gold", target: 15 * 60_000 },
    ],
    format: (v) => fmtDurationMs(v),
  },
  {
    id: "queue-cleaner",
    emoji: "🧹",
    title: "Чистая очередь",
    desc: "Лидов без ответа прямо сейчас — доведи очередь до нуля",
    metric: (k) => k.speed.waitingTotal,
    direction: "min",
    tiers: [
      { tier: "bronze", target: 5 },
      { tier: "silver", target: 2 },
      { tier: "gold", target: 0 },
    ],
    format: fmtCount,
  },
  {
    id: "sla-shield",
    emoji: "🛡",
    title: "SLA-щит",
    desc: "Лидов, ждущих ответа больше суток, — держи на нуле",
    metric: (k) => k.speed.waitingOver24h,
    direction: "min",
    tiers: [
      { tier: "bronze", target: 3 },
      { tier: "silver", target: 1 },
      { tier: "gold", target: 0 },
    ],
    format: fmtCount,
  },
  {
    id: "callback-ninja",
    emoji: "📞",
    title: "Перезвон-ниндзя",
    desc: "Просроченных перезвонов — ни один назначенный звонок не забыт",
    metric: (k) => k.speed.callbacksOverdue,
    direction: "min",
    tiers: [
      { tier: "bronze", target: 2 },
      { tier: "silver", target: 1 },
      { tier: "gold", target: 0 },
    ],
    format: fmtCount,
  },
  {
    id: "kev-master",
    emoji: "🎯",
    title: "КЭВ-мастер",
    desc: "Лидов на стадии договора/брони — ключевое событие воронки",
    metric: (k) => k.funnel.kev,
    direction: "max",
    tiers: [
      { tier: "bronze", target: 1 },
      { tier: "silver", target: 3 },
      { tier: "gold", target: 6 },
    ],
    format: fmtCount,
  },
  {
    id: "closer",
    emoji: "🤝",
    title: "Клоузер",
    desc: "Закрытых сделок (аренда идёт/успешно завершена, продажи)",
    metric: (k) => k.funnel.deals,
    direction: "max",
    tiers: [
      { tier: "bronze", target: 1 },
      { tier: "silver", target: 3 },
      { tier: "gold", target: 6 },
    ],
    format: fmtCount,
  },
  {
    id: "daily-engine",
    emoji: "🔥",
    title: "Разгон дня",
    desc: "Лидов обработано сегодня — норма дня 4, перевыполняй",
    metric: (k) => k.handledToday,
    direction: "max",
    tiers: [
      { tier: "bronze", target: 1 },
      { tier: "silver", target: 3 },
      { tier: "gold", target: 6 },
    ],
    format: fmtCount,
  },
  {
    id: "hot-rescuer",
    emoji: "🌡",
    title: "Горячий спасатель",
    desc: "Доля горячих лидов, получивших ответ, — «не слить целевых»",
    metric: (k) => (k.hotTotal > 0 ? (k.hotTotal - k.hotWaiting) / k.hotTotal : null),
    direction: "max",
    tiers: [
      { tier: "bronze", target: 0.5 },
      { tier: "silver", target: 0.75 },
      { tier: "gold", target: 1 },
    ],
    format: fmtPercent,
  },
  {
    id: "dialog-master",
    emoji: "💬",
    title: "Мастер диалога",
    desc: "Конверсия лид → диалог (отработан/конверсия)",
    metric: (k) => k.responseRate,
    direction: "max",
    tiers: [
      { tier: "bronze", target: 0.5 },
      { tier: "silver", target: 0.7 },
      { tier: "gold", target: 0.85 },
    ],
    format: fmtPercent,
  },
  {
    id: "funnel-driver",
    emoji: "🎡",
    title: "Воронка в деле",
    desc: "Конверсия лид → КЭВ (договор/бронь) — воронка работает",
    metric: (k) => k.kevRate,
    direction: "max",
    tiers: [
      { tier: "bronze", target: 0.2 },
      { tier: "silver", target: 0.35 },
      { tier: "gold", target: 0.5 },
    ],
    format: fmtPercent,
  },
  {
    id: "cashier",
    emoji: "💰",
    title: "Касса экипажа",
    desc: "Выручка по лидам экипажа — юнит-экономика в плюсе",
    metric: (k) => k.revenue,
    direction: "max",
    tiers: [
      { tier: "bronze", target: 50_000 },
      { tier: "silver", target: 150_000 },
      { tier: "gold", target: 300_000 },
    ],
    format: fmtMoneyK,
  },
  {
    id: "lead-magnet",
    emoji: "🧲",
    title: "Магнит лидов",
    desc: "Всего лидов в воронке — маркетинг и оцифровка трафика",
    metric: (k) => k.funnel.leads,
    direction: "max",
    tiers: [
      { tier: "bronze", target: 25 },
      { tier: "silver", target: 50 },
      { tier: "gold", target: 100 },
    ],
    format: fmtCount,
  },
];

// ── Расчёт ─────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function reachedTierIndex(def: AchievementDef, value: number): number {
  let idx = -1;
  for (let i = 0; i < def.tiers.length; i += 1) {
    const t = def.tiers[i];
    const ok = def.direction === "max" ? value >= t.target : value <= t.target;
    if (ok) idx = i;
  }
  return idx;
}

/**
 * Все достижения экипажа по KPI-метрикам. unavailable записи возвращаются с
 * available=false — UI решает сам, скрывать или показывать серыми.
 */
export function computeLeadAchievements(kpi: LeadKpiMetrics): LeadAchievement[] {
  const out: LeadAchievement[] = [];

  for (const def of DEFS) {
    const value = def.metric(kpi);
    if (value == null || !Number.isFinite(value)) {
      out.push({
        id: def.id,
        emoji: def.emoji,
        title: def.title,
        desc: def.desc,
        tier: "bronze",
        value: 0,
        nextTarget: def.tiers[0].target,
        progress: 0,
        unlocked: false,
        maxed: false,
        available: false,
        valueLabel: "—",
        nextLabel: def.format(def.tiers[0].target),
        color: TIER_COLORS.bronze,
      });
      continue;
    }

    const idx = reachedTierIndex(def, value);
    const unlocked = idx >= 0;
    const maxed = idx === def.tiers.length - 1;
    const next: TierDef | null = unlocked && !maxed ? def.tiers[idx + 1] : unlocked ? null : def.tiers[0];

    let progress = 0;
    if (maxed) {
      progress = 1;
    } else if (unlocked && next) {
      const cur = def.tiers[idx];
      if (def.direction === "max") {
        const span = next.target - cur.target;
        progress = span > 0 ? clamp01((value - cur.target) / span) : 1;
      } else {
        const span = cur.target - next.target;
        progress = span > 0 ? clamp01((cur.target - value) / span) : 1;
      }
    } else if (!unlocked && next) {
      // До бронзы: max — доля от порога; min — насколько далеко от порога.
      if (def.direction === "max") {
        progress = next.target > 0 ? clamp01(value / next.target) : 0;
      } else if (next.target > 0) {
        progress = clamp01(1 - (value - next.target) / next.target);
      }
    }

    const tier: AchievementTier = unlocked ? def.tiers[idx].tier : "bronze";

    out.push({
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      desc: def.desc,
      tier,
      value,
      nextTarget: next ? next.target : null,
      progress,
      unlocked,
      maxed,
      available: true,
      valueLabel: def.format(value),
      nextLabel: next ? def.format(next.target) : null,
      color: TIER_COLORS[unlocked ? def.tiers[idx].tier : "bronze"],
    });
  }

  // ── ЛЕГЕНДА: идеальная смена — составное достижение ──
  // Медиана ≤ 1 ч, ноль просрочек SLA и перезвонов, норма дня выполнена.
  const perfect =
    kpi.speed.medianMs != null &&
    kpi.speed.medianMs <= 60 * 60_000 &&
    kpi.speed.waitingOver24h === 0 &&
    kpi.speed.callbacksOverdue === 0 &&
    kpi.handledToday >= 4;
  out.push({
    id: "perfect-shift",
    emoji: "🏆",
    title: "Идеальная смена",
    desc: "Медиана ≤ 1 ч, ноль SLA-просрочек и просроченных перезвонов, норма дня (4) выполнена",
    tier: "legend",
    value: perfect ? 1 : 0,
    nextTarget: perfect ? null : 1,
    progress: perfect ? 1 : 0,
    unlocked: perfect,
    maxed: perfect,
    available: true,
    valueLabel: perfect ? "выполнено" : "не выполнено",
    nextLabel: perfect ? null : "все условия",
    color: TIER_COLORS.legend,
  });

  return out;
}

/** Сколько достижений открыто (для шапки панели). */
export function countUnlocked(achievements: LeadAchievement[]): number {
  return achievements.filter((a) => a.available && a.unlocked).length;
}
