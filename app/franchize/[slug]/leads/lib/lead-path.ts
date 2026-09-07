// /app/franchize/[slug]/leads/lib/lead-path.ts
//
// ── «ПУТЬ ОПЕРАТОРА»: геймификационная лестница с шагами по одной ──────────
//
// КЛИЕНТСКАЯ ПРОСЬБА: «introduce all steps one by one and not everything at
// once, kinda reduce cognitive load, spread to several iterations, adding one
// more step each time». Вместо стены из семи шагов оператор видит постепенно
// растущую лестницу:
//   • DRIP: каждая новая СМЕНА (календарный день) открывает следующий шаг —
//     « spreading across iterations »;
//   • CATCH-UP: как только оператор догнал по очкам открытый шаг — следующий
//     открывается сразу (прогресс не заставляет ждать завтра);
//   • LOCKED TEASER: нераскрытые шаги видны как «???» с датой следующего
//     открытия — интрига вместо когнитивной перегрузки.
//
// Чистое ядро (state + steps + stats → видимость/прогресс) тестируется
// юнит-спеками; панель (LeadsPathPanel) только рисует результат.
// Состояние живёт в users.metadata.leads_path (см. /api/franchize/leads/
// user-prefs) с localStorage-фоллбеком на клиенте.

export interface LeadPathStep {
  id: string;
  emoji: string;
  title: string;
  /** Как закрыть шаг — конкретные действия и их очки. */
  hint: string;
  /** Порог по очкам ПРОЗРАЧНОГО лидерборда (0 — шаг открывается сразу). */
  points: number;
}

/**
 * Шаги привязаны к серверным очкам lead_events (Lead Game wave) — одинаковые
 * для всей смены, не только для закрытий: взял в работу +3, перезвон +1/+5,
 * задачи +2, заметки +1. Значения порогов — четверти «нормальной смены».
 */
export const LEAD_PATH_STEPS: LeadPathStep[] = [
  { id: "start",       emoji: "🏁", title: "Старт смены",          hint: "Открыть «Клиенты и заявки» — уже хорошо",            points: 0 },
  { id: "first-touch", emoji: "✊", title: "Первый контакт",       hint: "Взять лид в работу: «✅ Отработан» (+3)",            points: 3 },
  { id: "call-back",   emoji: "📞", title: "На связи",             hint: "Назначить и выполнить перезвон (+1 и +5)",           points: 9 },
  { id: "order",       emoji: "🧹", title: "Порядок в очереди",    hint: "Закрывать задачи по лидам (+2 за каждую)",           points: 20 },
  { id: "playbook",    emoji: "🎯", title: "Плейбук-мастер",       hint: "Пройти очередь плейбука смены (задачи и перезвоны)", points: 35 },
  { id: "prep",        emoji: "🧠", title: "5 минут подготовки",   hint: "Изучить карточку клиента перед разговором",          points: 60 },
  { id: "top3",        emoji: "👑", title: "Легенда смены",        hint: "Войти в топ-3 прозрачного лидерборда экипажа",       points: 100 },
];

/** Статистика оператора из серверного лидерборда (transparent, crew-wide). */
export interface LeadPathStats {
  /** Мои очки (0 — если ещё не действовал). */
  myPoints: number;
  /** Место в лидерборде (1-based), null — пока не в таблице. */
  myRank: number | null;
  /** Размер экипажа в лидерборде — для честного «топ-3». */
  crewSize: number;
}

/** Сохраняемое состояние пути (users.metadata.leads_path). */
export interface LeadPathState {
  /** Сколько шагов ОТКРЫТО (видно оператору), 0..steps.length. */
  revealed: number;
  /** День последнего drip-открытия (YYYY-MM-DD) или null. */
  lastRevealDay: string | null;
  /** Шаги, чьё завершение уже праздновали (не поздравляем дважды). */
  celebrated: string[];
}

export const DEFAULT_LEAD_PATH_STATE: LeadPathState = {
  revealed: 1,
  lastRevealDay: null,
  celebrated: [],
};

/** YYYY-MM-DD для локального дня (drip считается по смене, не по UTC). */
export function leadPathTodayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Завершён ли шаг: порог по очкам; «Легенда смены» — честный топ-3. */
export function isLeadPathStepDone(step: LeadPathStep, stats: LeadPathStats): boolean {
  if (step.id === "top3") {
    return stats.myRank != null && stats.myRank <= 3 && stats.crewSize >= 3;
  }
  return stats.myPoints >= step.points;
}

/**
 * Drip: одна новая смена — один новый шаг. Вызывается на монтировании
 * панели; возвращает НОВОЕ состояние и признак продвижения (для анимации).
 */
export function applyLeadPathDrip(
  state: LeadPathState,
  stepCount: number,
  today: string = leadPathTodayKey(),
): { state: LeadPathState; advanced: boolean } {
  const revealed = Math.max(0, Math.min(stepCount, state.revealed || 0));
  if (state.lastRevealDay === today || revealed >= stepCount) {
    // Сегодня уже открывали (или всё открыто) — состояние не трогаем.
    return { state: { ...state, revealed }, advanced: false };
  }
  return {
    state: { ...state, revealed: revealed + 1, lastRevealDay: today },
    advanced: true,
  };
}

/** Сколько шагов завершено по статистике (пороговые, подряд с начала). */
export function countLeadPathDone(steps: LeadPathStep[], stats: LeadPathStats): number {
  let done = 0;
  for (const step of steps) {
    if (!isLeadPathStepDone(step, stats)) break;
    done++;
  }
  return done;
}

export type LeadPathStepView = "done" | "current" | "open" | "locked";

export interface LeadPathProgress {
  /** Завершённых шагов подряд с начала. */
  doneCount: number;
  /** Видимость каждого шага (индекс совпадает со steps). */
  views: LeadPathStepView[];
  /** % прогресса текущего шага (0..100); 100, когда всё закрыто. */
  currentPct: number;
  /** Индекс текущего шага или null, если всё завершено. */
  currentIndex: number | null;
  /** Новый шаг(и) стали видимыми из-за catch-up — панель празднует. */
  revealed: number;
}

/**
 * Главная чистая функция: состояние + шаги + статистика → что рисовать.
 * CATCH-UP: завершение шага гарантированно открывает СЛЕДУЮЩИЙ — revealed
 * подтягивается до doneCount+1 (не ниже drip-значения, не выше числа шагов).
 */
export function computeLeadPathProgress(
  state: LeadPathState,
  steps: LeadPathStep[],
  stats: LeadPathStats,
): LeadPathProgress {
  const doneCount = countLeadPathDone(steps, stats);
  const revealed = Math.max(
    Math.max(0, Math.min(steps.length, state.revealed || 0)),
    Math.min(steps.length, doneCount + 1),
  );

  const views: LeadPathStepView[] = steps.map((step, i) => {
    if (i < doneCount) return "done";
    if (i >= revealed) return "locked";
    if (i === doneCount) return "current";
    return "open"; // открыт, но предыдущий не завершён — подсказка видна
  });

  const currentIndex = doneCount < steps.length ? doneCount : null;
  let currentPct = 100;
  if (currentIndex != null) {
    const step = steps[currentIndex];
    if (step.id === "top3") {
      currentPct = stats.myRank != null && stats.myRank <= 3 && stats.crewSize >= 3
        ? 100
        : 0;
    } else if (step.points > 0) {
      currentPct = Math.max(0, Math.min(100, Math.round((stats.myPoints / step.points) * 100)));
    } else {
      currentPct = 100;
    }
  }
  return { doneCount, views, currentPct, currentIndex, revealed };
}
