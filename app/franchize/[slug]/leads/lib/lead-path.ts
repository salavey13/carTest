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
  /** Порог по очкам ПРОЗРАЧНОГО лидерборда (0 — шаг открывается сразу).
   *  Для kind:"guides" — декоративное значение на кривой лестницы: закрытие
   *  считается по гайдам (см. isLeadPathStepDone), не по очкам. */
  points: number;
  /** Тип закрытия: "points" (по умолчанию) — порог очков лидерборда;
   *  "guides" — открыты все гайды «Библиотеки оператора» (OPERATOR_GUIDES). */
  kind?: "points" | "guides";
}

/** «БИБЛИОТЕКА ОПЕРАТОРА» — три самоучителя системы (public/docs, работают
 *  офлайн). Один источник правды для: ссылок в футере плейбука, отметок
 *  «прочитано» (localStorage `leads-guides:<slug>`) и шага-«Теории» пути.
 *  Порядок = порядок чтения: сначала механика лидов, потом мышление, потом
 *  техника продаж. */
export interface OperatorGuide {
  id: string;
  href: string;
  emoji: string;
  title: string;
  desc: string;
}

export const OPERATOR_GUIDES: OperatorGuide[] = [
  {
    id: "avito-guide",
    href: "/docs/avito-leads-guide.html",
    emoji: "📘",
    title: "Гид по лидам Avito",
    desc: "Скорость первого ответа, готовые ответы, порядок очереди — полная инструкция по системе лидов",
  },
  {
    id: "brutal-truths",
    href: "/docs/brutal-business-truths-2026.html",
    emoji: "💣",
    title: "Жёсткие бизнес-правды",
    desc: "«13 Years Of Brutally Honest Business Advice» — конспект за 90 минут: честность, цена позиции, работа с возражениями",
  },
  {
    id: "ultimate-sales",
    href: "/docs/ultimate-sales-playbook-2026.html",
    emoji: "🏆",
    title: "Ultimate Sales 2026",
    desc: "Полный плейбук продаж: окно 60 секунд, зона смерти 5 минут, бенчмарки курса",
  },
];

/**
 * Шаги привязаны к серверным очкам lead_events (Lead Game wave) — одинаковые
 * для всей смены, не только для закрытий: взял в работу +3, перезвон +1/+5,
 * задачи +2, заметки +1. Значения порогов — четверти «нормальной смены».
 *
 * ВОЛНА «next step reveal»: между «5 минут подготовки» и короной вставлен
 * шаг «Теория» (id theory) — закрытие ПО ГАЙДАМ «Библиотеки оператора»
 * (все три документа из public/docs), а не по очкам: оператор, который
 * умеет mechanically закрывать очередь, читает, ПОЧЕМУ очередь именно
 * такая — до того, как лестница объявит его «Легендой смены».
 */
export const LEAD_PATH_STEPS: LeadPathStep[] = [
  { id: "start",       emoji: "🏁", title: "Старт смены",          hint: "Открыть «Клиенты и заявки» — уже хорошо",            points: 0 },
  { id: "first-touch", emoji: "✊", title: "Первый контакт",       hint: "Взять лид в работу: «✅ Отработан» (+3)",            points: 3 },
  { id: "call-back",   emoji: "📞", title: "На связи",             hint: "Назначить и выполнить перезвон (+1 и +5)",           points: 9 },
  { id: "order",       emoji: "🧹", title: "Порядок в очереди",    hint: "Закрывать задачи по лидам (+2 за каждую)",           points: 20 },
  { id: "playbook",    emoji: "🎯", title: "Плейбук-мастер",       hint: "Пройти очередь плейбука смены (задачи и перезвоны)", points: 35 },
  { id: "prep",        emoji: "🧠", title: "5 минут подготовки",   hint: "Изучить карточку клиента перед разговором",          points: 60 },
  { id: "theory",      emoji: "📚", title: "Теория",               hint: "Открыть все три гайда из «Библиотеки оператора» под плейбуком", points: 80, kind: "guides" },
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
  /** Сколько РАЗЛИЧНЫХ гайдов «Библиотеки оператора» открыто (0..3).
   *  Локальная метрика (localStorage на устройстве) — чтение личное,
   *  серверу не нужно; для не-crew остаётся undefined → шаг не закрыт. */
  guidesRead?: number;
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

/** Завершён ли шаг: порог по очкам; «Теория» — все гайды библиотеки;
 *  «Легенда смены» — честный топ-3. */
export function isLeadPathStepDone(step: LeadPathStep, stats: LeadPathStats): boolean {
  if (step.id === "top3") {
    return stats.myRank != null && stats.myRank <= 3 && stats.crewSize >= 3;
  }
  if (step.kind === "guides") {
    return (stats.guidesRead ?? 0) >= OPERATOR_GUIDES.length;
  }
  return stats.myPoints >= step.points;
}

// ── Отметки «гайд прочитан» (шаг «Теория») ─────────────────────────────────
// Формат стора — плоский JSON-массив id из OPERATOR_GUIDES. Чистые функции;
// I/O (getItem/setItem/dispatch события «leads-guides-changed») — в панелях.

/** Ключ стора отметок — единый для чтения и записи. */
export function guidesStorageKey(slug: string): string {
  return `leads-guides:${slug}`;
}

/** Парс стора отметок: чужие/неизвестные id отбрасываются, дубли схлопываются. */
export function parseGuidesReadIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const known = new Set(OPERATOR_GUIDES.map((g) => g.id));
    return Array.from(new Set(parsed.filter((x): x is string => typeof x === "string" && known.has(x))));
  } catch {
    return [];
  }
}

/** Чистое добавление отметки: массив id → новый массив (без мутаций). */
export function applyGuideRead(prev: string[], guideId: string): string[] {
  const known = new Set(OPERATOR_GUIDES.map((g) => g.id));
  if (!known.has(guideId) || prev.includes(guideId)) return prev;
  return [...prev, guideId];
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

/**
 * Слияние двух состояний пути — защита прогресса от регрессии. Приходит
 * старый снимок с сервера (ручной «Повторить загрузку», второе устройство,
 * зеркало localStorage) — локальные достижения не откатываются:
 *   • revealed — МАКСИМУМ (открытые шаги не закрываются обратно);
 *   • lastRevealDay — более поздняя дата (свежий drip приоритетнее);
 *   • celebrated — объединение (шаг празднуется ровно один раз).
 */
export function mergeLeadPathState(a: LeadPathState, b: LeadPathState): LeadPathState {
  const dayNum = (d: string | null): number => (d ? Number(d.replace(/-/g, "")) : 0);
  let lastRevealDay: string | null;
  if (!a.lastRevealDay) lastRevealDay = b.lastRevealDay;
  else if (!b.lastRevealDay) lastRevealDay = a.lastRevealDay;
  else lastRevealDay = dayNum(b.lastRevealDay) >= dayNum(a.lastRevealDay) ? b.lastRevealDay : a.lastRevealDay;
  return {
    revealed: Math.max(a.revealed || 0, b.revealed || 0),
    lastRevealDay,
    celebrated: Array.from(new Set([...(a.celebrated || []), ...(b.celebrated || [])])),
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
    } else if (step.kind === "guides") {
      // «Теория»: прогресс — доля открытых гайдов библиотеки, не очков.
      currentPct = Math.max(0, Math.min(100, Math.round(((stats.guidesRead ?? 0) / OPERATOR_GUIDES.length) * 100)));
    } else if (step.points > 0) {
      currentPct = Math.max(0, Math.min(100, Math.round((stats.myPoints / step.points) * 100)));
    } else {
      currentPct = 100;
    }
  }
  return { doneCount, views, currentPct, currentIndex, revealed };
}
