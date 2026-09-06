// /app/franchize/[slug]/leads/lib/lead-gamification.ts
//
// ПУТЬ ОПЕРАТОРА — связка «плейбук ↔ достижения ↔ лиды».
// =====================================================================
//
// Просьба босса: «interlink gamification and achievements with playbook
// and leads stuff, go invent something cool about it, extra effort ;)».
//
// До сих пор три слоя страницы работали ПАРАЛЛЕЛЬНО, а не вместе:
//   • плейбук говорил «что делать сейчас» (lead-playbook.ts),
//   • достижения считали KPI-пороги (lead-achievements.ts),
//   • лиды ждали ответа.
// Оператор не видел, что шаг плейбука «Реанимировать: Иван» — это буквально
// прогресс бейджа «Реаниматор», а золотой «Скорострел» — это и есть
// 5-минутное правило курса. Этот модуль и связывает:
//
//   1. XP: каждое достижение стоит XP по уровню (бронза 10 / серебро 25 /
//      золото 50 / легенда 100). XP копится из sticky-стора «заработано
//      навсегда» — той же таблицы id → лучший уровень, что и тосты. Никакой
//      новой памяти: цифры гаснут — XP остаётся.
//   1а. МОСТ С ПРОФИЛЕМ: shift-бейджи из users.metadata (серии смен, часы,
//      «ранняя пташка»…) — плоские, без уровней; каждый даёт
//      PROFILE_XP_FALLBACK (15) XP и считается в звании наравне с
//      лестничными (computeOperatorRank принимает их вторым аргументом).
//   2. ЗВАНИЯ (5 уровней пути): Новичок бокса → Механик → Гонщик →
//      Бригадир смены → Легенда экипажа. Звание растёт только от реальных
//      достижений — накрутить его нельзя, честно как KPI.
//   3. КАРТА КОРМЛЕНИЯ: какой шаг плейбука продвигает какой бейдж
//      (PLAYBOOK_FEEDS) и обратная — какими шагами кормится бейдж
//      (actionsFeedingAchievement). В UI: у шага плейбука чип «прокачает:
//      🏆 бейдж», у закрытого бейджа подсказка «кормится шагом плейбука».
//
// Модуль чистый: без React, без localStorage, без Date.now().

import type {
  AchievementTier,
  AchievementStore,
  AchievementEvent,
} from "./lead-achievements";
import type { NextActionKey } from "./lead-playbook";

// ── XP ─────────────────────────────────────────────────────────────────────

/** Сколько XP стоит уровень бейджа. Легенда — составная, она дороже золота. */
export const TIER_XP: Record<AchievementTier, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  legend: 100,
};

/** XP за событие тоста: открытие — полный уровень, апгрейд — дельта. */
export function xpForEvent(event: AchievementEvent): number {
  if (event.kind === "unlock") return TIER_XP[event.tier];
  const order: AchievementTier[] = ["bronze", "silver", "gold", "legend"];
  const prev = order[Math.max(0, order.indexOf(event.tier) - 1)];
  return TIER_XP[event.tier] - TIER_XP[prev];
}

// ── XP профильных достижений (мост «профиль ↔ путь оператора») ─────────────
// Shift/бонусные бейджи (серии смен, часы, early-bird…) живут в
// users.metadata (grantFranchizeAchievementAction) и НЕ имеют уровней —
// это плоские «получил/нет». Они тоже труд, и путь оператора должен их
// считать: плоская цена PROFILE_XP_FALLBACK за каждый взятый id.
// XP лестничных бейджей выше ровно потому, что тот же труд делится на
// уровни, а здесь — разовый факт.

/** Плоская цена одного профильного (безуровневого) достижения в XP. */
export const PROFILE_XP_FALLBACK = 15;

/**
 * XP за профильные разблокировки. acceptable input — Set/id-массив/объект
 * вида id→true (это форма users.metadata.franchizeProfiles[slug].achievements).
 * Битые элементы (пустые id) молча пропускаются.
 */
export function xpForProfileUnlocks(
  ids: Iterable<unknown> | Record<string, unknown> | null | undefined,
): number {
  if (!ids) return 0;
  const list: unknown[] =
    typeof ids === "object" && !Array.isArray(ids) && !(ids instanceof Set)
      ? Object.entries(ids as Record<string, unknown>)
          .filter(([, v]) => v) // achievements: id → {unlockedAt…} или true
          .map(([id]) => id)
      : Array.from(ids as Iterable<unknown>);
  let xp = 0;
  for (const id of list) {
    if (typeof id === "string" && id.trim().length > 0) xp += PROFILE_XP_FALLBACK;
  }
  return xp;
}

/** Суммарный XP по sticky-стору (id → лучший уровень за всё время). */
export function xpForStore(store: AchievementStore): number {
  return Object.values(store).reduce((sum, tier) => {
    const xp = TIER_XP[tier as AchievementTier];
    return Number.isFinite(xp) ? sum + xp : sum;
  }, 0);
}

// ── Звания ─────────────────────────────────────────────────────────────────

export interface OperatorRankDef {
  level: number;
  emoji: string;
  title: string;
  /** Сколько XP нужно, чтобы звание было взято. */
  floor: number;
}

export const OPERATOR_RANKS: readonly OperatorRankDef[] = [
  { level: 1, emoji: "🛴", title: "Новичок бокса", floor: 0 },
  { level: 2, emoji: "🔧", title: "Механик", floor: 100 },
  { level: 3, emoji: "🏍", title: "Гонщик", floor: 250 },
  { level: 4, emoji: "🛞", title: "Бригадир смены", floor: 450 },
  { level: 5, emoji: "👑", title: "Легенда экипажа", floor: 700 },
];

export interface OperatorRank {
  level: number;
  emoji: string;
  title: string;
  xp: number;
  /** Следующее звание (null — взято последнее). */
  next: { emoji: string; title: string; floor: number } | null;
  /** Прогресс к следующему званию 0..1 (1 — максимум). */
  progress: number;
  /** Сколько XP осталось до следующего звания (null — максимум). */
  xpToNext: number | null;
}

/** Звание по XP: высший порог ≤ xp. */
export function rankForXp(xp: number): { def: OperatorRankDef; next: OperatorRankDef | null; progress: number } {
  let idx = 0;
  for (let i = 0; i < OPERATOR_RANKS.length; i += 1) {
    if (xp >= OPERATOR_RANKS[i].floor) idx = i;
  }
  const def = OPERATOR_RANKS[idx];
  const next = idx + 1 < OPERATOR_RANKS.length ? OPERATOR_RANKS[idx + 1] : null;
  let progress = 1;
  if (next) {
    const span = next.floor - def.floor;
    progress = span > 0 ? Math.max(0, Math.min(1, (xp - def.floor) / span)) : 1;
  }
  return { def, next, progress };
}

export function computeOperatorRank(
  store: AchievementStore,
  /** Мост: профильные достижения (серии смен и пр.) — тоже XP. */
  profileUnlocks?: Iterable<unknown> | Record<string, unknown> | null,
): OperatorRank {
  const xp = xpForStore(store) + xpForProfileUnlocks(profileUnlocks ?? null);
  return operatorRankForXp(xp);
}

/** Полная картина звания по голому XP (без стора) — общая математика выше. */
export function operatorRankForXp(xp: number): OperatorRank {
  const { def, next, progress } = rankForXp(xp);
  return {
    level: def.level,
    emoji: def.emoji,
    title: def.title,
    xp,
    next: next ? { emoji: next.emoji, title: next.title, floor: next.floor } : null,
    progress,
    xpToNext: next ? Math.max(0, next.floor - xp) : null,
  };
}

/**
 * ПРАЗДНИК ЗВАНИЯ (клиентская половина): пересечён ли порог звания переходом
 * prevXp → nextXp. Возвращает полную картину НОВОГО звания — или null, если
 * порог не взят (плюс-в-пределах одного звания), движение назад и уровень 1
 * («Новичок бокса» — старт, не достижение). Прыжок через ДВА порога сразу
 * (легендарный бейдж = 100 XP) празднует высший взятый.
 *
 * Сервер (notifyRankUpIfCrossed) празднует только профильные бейджи —
 * лидерский localStorage-XP ему недоступен. Эта функция — то, чем панель
 * лидов закрывает вторую половину пути: бейдж воронки взял порог → баннер.
 */
export function detectRankUp(prevXp: number, nextXp: number): OperatorRank | null {
  const before = rankForXp(prevXp).def;
  const after = rankForXp(nextXp).def;
  if (after.level <= 1 || after.level <= before.level) return null;
  return operatorRankForXp(nextXp);
}

// ── Карта кормления: шаг плейбука → бейджи ────────────────────────────────
// Принцип: шаг плейбука двигает РОВНО ТУ метрику, которую бейдж меряет.
// Проверяется тестом: каждый id существует в computeLeadAchievements().

export const PLAYBOOK_FEEDS: Record<NextActionKey, readonly string[]> = {
  // Горячий ждёт → скорость первого ответа: «Молния» (≤60 сек, +391%),
  // «Пять минут» (правило 5 минут) и доля отвеченных горячих.
  "hot-waiting": ["lightning", "five-minutes", "hot-rescuer"],
  // Просроченный перезвон → «Перезвон-ниндзя» (ноль просроченных звонков).
  "callback-overdue": ["callback-ninja"],
  // Свежий лид → конверсия в диалог + та же скорость.
  "fresh-waiting": ["dialog-master", "five-minutes"],
  // Висящий договор → КЭВ и работающая воронка.
  "contract-hanging": ["kev-master", "funnel-driver"],
  // Pull-up визита → сделки, норма дня, финальный дожим.
  "pull-up": ["closer", "daily-engine", "squeeze"],
  // Ghost-реанимация → «Реаниматор» (молчуны доведены до нуля).
  "ghost": ["ghost-buster"],
  "ghost-long": ["ghost-buster"],
  // Рекомендация «1+1=11» → новые лиды и касса экипажа.
  "referral": ["lead-magnet", "cashier"],
};

/** Все шаги плейбука, которые кормят бейдж (обратная карта). */
export function actionsFeedingAchievement(achievementId: string): NextActionKey[] {
  const keys: NextActionKey[] = [];
  for (const [key, ids] of Object.entries(PLAYBOOK_FEEDS) as Array<[NextActionKey, readonly string[]]>) {
    if (ids.includes(achievementId)) keys.push(key);
  }
  return keys;
}

/** Короткие подписи шагов плейбука для чипов (без имён лидов — они меняются). */
export const PLAYBOOK_STEP_META: Record<NextActionKey, { emoji: string; label: string }> = {
  "hot-waiting": { emoji: "🔥", label: "Ответить горячему" },
  "callback-overdue": { emoji: "📞", label: "Позвонить по перезвону" },
  "fresh-waiting": { emoji: "⚡", label: "Ответить первым" },
  "contract-hanging": { emoji: "🧾", label: "Растолкать договор" },
  "pull-up": { emoji: "⏩", label: "Подтянуть визит на сегодня" },
  "ghost": { emoji: "👻", label: "Реанимировать молчуна" },
  "ghost-long": { emoji: "🍂", label: "Пульс-чек пропавшему" },
  "referral": { emoji: "🤝", label: "Попросить рекомендацию" },
};

/** Мета бейджей, встречающихся в карте кормления (эмодзи + имя для чипов). */
export const LINKED_ACHIEVEMENT_META: Record<string, { emoji: string; title: string }> = {
  lightning: { emoji: "🌩", title: "Молния" },
  "five-minutes": { emoji: "⏱", title: "Пять минут" },
  "hot-rescuer": { emoji: "🌡", title: "Горячий спасатель" },
  "callback-ninja": { emoji: "📞", title: "Перезвон-ниндзя" },
  "dialog-master": { emoji: "💬", title: "Мастер диалога" },
  "kev-master": { emoji: "🎯", title: "КЭВ-мастер" },
  "funnel-driver": { emoji: "🎡", title: "Воронка в деле" },
  closer: { emoji: "🤝", title: "Клоузер" },
  "daily-engine": { emoji: "🔥", title: "Разгон дня" },
  squeeze: { emoji: "🥇", title: "Дожиматель" },
  "ghost-buster": { emoji: "👻", title: "Реаниматор" },
  "lead-magnet": { emoji: "🧲", title: "Магнит лидов" },
  cashier: { emoji: "💰", title: "Касса экипажа" },
};

/** Чипы «этот шаг прокачает бейдж» для строки плейбука (первичный бейдж). */
export function primaryBadgeForAction(key: NextActionKey): { id: string; emoji: string; title: string } | null {
  const [first] = PLAYBOOK_FEEDS[key] ?? [];
  if (!first) return null;
  const meta = LINKED_ACHIEVEMENT_META[first];
  return meta ? { id: first, emoji: meta.emoji, title: meta.title } : null;
}
