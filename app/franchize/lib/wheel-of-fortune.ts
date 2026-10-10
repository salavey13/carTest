// /app/franchize/lib/wheel-of-fortune.ts
// ─────────────────────────────────────────────────────────────────────────────
// Колесо фортуны для franchize-витрин (boss request 2026-10-11).
//
// Портировано из /app/wheel-of-fortune + /components/WheelOfFortune.tsx
// (старое «счастливое число»), но с реальными наградами: каждое событие
// выдаёт ХАРДКОДНЫЙ промокод, который валидируется сервером через
// validateFranchizePromoCode → BUILT_IN_PROMO_CODES (actions-runtime.ts).
//
// Правила проектирования:
//  · Этот модуль — PURE (без "use client"/"use server"): его импортируют и
//    серверная страница, и клиентский компонент, и vitest-спеки.
//  · Коды сегментов и BUILT_IN_PROMO_CODES — единый источник правды:
//    сегмент ссылается на код строкой, спека проверяет соответствие.
//  · Выпадение сегмента — детерминированная функция от Math.random()
//    (весовой выбор), а анимация колеса только ДОГОНЯЕТ заранее выбранный
//    индекс. Так визуальный результат всегда равен фактическому.
// ─────────────────────────────────────────────────────────────────────────────

export type WheelSegmentKind = "promo" | "respin" | "miss";

export type WheelSegment = {
  id: string;
  /** Короткая подпись на секторе («1 000 ₽», «15%», «Ещё раз»…). */
  label: string;
  /** Мелкая подпись под основной («скидка», «в подарок»…). */
  sublabel?: string;
  /** Цвет сектора (яркая палитра в духе Amnezia-колеса из скриншота). */
  color: string;
  /** Цвет текста на секторе — гарантирует контраст на ярких заливках. */
  textColor: string;
  kind: WheelSegmentKind;
  /** Промокод для kind="promo" — обязан существовать в BUILT_IN_PROMO_CODES. */
  promoCode?: string;
  /** Относительный вес выпадения (сумма не обязана быть 100). */
  weight: number;
};

/**
 * Хардкодные промокоды колеса. Серверная валидация — BUILT_IN_PROMO_CODES
 * в app/franchize/actions-runtime.ts (kind: full | fixed | percent).
 * Добавляешь награду здесь — добавь её и там (спека wheel-promo сверяет).
 */
export const WHEEL_PROMO_CODES = [
  { code: "WHEEL1000", amountRub: 1000, label: "1 000 ₽" },
  { code: "WHEEL2000", amountRub: 2000, label: "2 000 ₽" },
  { code: "WHEEL5000", amountRub: 5000, label: "5 000 ₽" },
  { code: "WHEEL15", percent: 15, label: "15%" },
] as const;

export type WheelPromoCode = (typeof WHEEL_PROMO_CODES)[number];

/** Палитра секторов — контрастные цвета как на референс-скриншоте. */
const COLORS = {
  green: { fill: "#22C55E", text: "#052E16" },
  orange: { fill: "#F97316", text: "#431407" },
  gold: { fill: "#FACC15", text: "#422006" },
  violet: { fill: "#8B5CF6", text: "#FFFFFF" },
  pink: { fill: "#EC4899", text: "#500724" },
  slate: { fill: "#475569", text: "#FFFFFF" },
  teal: { fill: "#14B8A6", text: "#042F2E" },
} as const;

/** 12 секторов по 30°. Сумма весов = 100. */
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { id: "w1000-a", label: "1 000 ₽", sublabel: "скидка", color: COLORS.green.fill, textColor: COLORS.green.text, kind: "promo", promoCode: "WHEEL1000", weight: 20 },
  { id: "miss-a", label: "Мимо", color: COLORS.slate.fill, textColor: COLORS.slate.text, kind: "miss", weight: 8 },
  { id: "w2000-a", label: "2 000 ₽", sublabel: "скидка", color: COLORS.orange.fill, textColor: COLORS.orange.text, kind: "promo", promoCode: "WHEEL2000", weight: 14 },
  { id: "w15-a", label: "15%", sublabel: "скидка", color: COLORS.violet.fill, textColor: COLORS.violet.text, kind: "promo", promoCode: "WHEEL15", weight: 12 },
  { id: "w1000-b", label: "1 000 ₽", sublabel: "скидка", color: COLORS.teal.fill, textColor: COLORS.teal.text, kind: "promo", promoCode: "WHEEL1000", weight: 18 },
  { id: "respin-a", label: "Ещё раз", sublabel: "крутка", color: COLORS.pink.fill, textColor: COLORS.pink.text, kind: "respin", weight: 10 },
  { id: "w2000-b", label: "2 000 ₽", sublabel: "скидка", color: COLORS.gold.fill, textColor: COLORS.gold.text, kind: "promo", promoCode: "WHEEL2000", weight: 8 },
  { id: "miss-b", label: "Мимо", color: COLORS.slate.fill, textColor: COLORS.slate.text, kind: "miss", weight: 6 },
  { id: "w5000-a", label: "5 000 ₽", sublabel: "скидка", color: COLORS.pink.fill, textColor: COLORS.pink.text, kind: "promo", promoCode: "WHEEL5000", weight: 2 },
  { id: "w15-b", label: "15%", sublabel: "скидка", color: COLORS.orange.fill, textColor: COLORS.orange.text, kind: "promo", promoCode: "WHEEL15", weight: 6 },
  { id: "respin-b", label: "Ещё раз", sublabel: "крутка", color: COLORS.green.fill, textColor: COLORS.green.text, kind: "respin", weight: 4 },
  { id: "w1000-c", label: "1 000 ₽", sublabel: "скидка", color: COLORS.gold.fill, textColor: COLORS.gold.text, kind: "promo", promoCode: "WHEEL1000", weight: 4 },
];

/** Угол одного сектора в градусах. */
export const WHEEL_SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS.length;

/** Все промокоды, на которые ссылается колесо (для сверки с сервером в спеках). */
export function wheelPromoCodes(): string[] {
  return Array.from(
    new Set(
      WHEEL_SEGMENTS
        .filter((segment) => segment.kind === "promo" && segment.promoCode)
        .map((segment) => segment.promoCode as string),
    ),
  );
}

/**
 * Взвешенный выбор индекса сегмента. Вызывается ДО запуска анимации:
 * колесо докручивается ровно до выбранного сектора.
 */
export function pickWeightedSegmentIndex(
  random: () => number = Math.random,
  segments: WheelSegment[] = WHEEL_SEGMENTS,
): number {
  const totalWeight = segments.reduce((sum, segment) => sum + segment.weight, 0);
  if (totalWeight <= 0) return 0;
  let roll = random() * totalWeight;
  for (let index = 0; index < segments.length; index += 1) {
    roll -= segments[index].weight;
    if (roll < 0) return index;
  }
  return segments.length - 1;
}

/**
 * Финальный угол поворота колеса (в градусах), при котором ВЫБРАННЫЙ сегмент
 * оказывается под указателем на 12 часов.
 *
 * Конвенция рендера (WheelOfFortuneClient): conic-gradient `from -A/2` —
 * сектор i ЦЕНТРИРОВАН на угле i*A от вершины (сектор 0 стоит под указателем
 * у неповернутого колеса). Чтобы под указатель встал сектор i, колесо
 * поворачивается на -(i*A) (модуль 360) плюс случайный джиттер ±(A*0.35),
 * чтобы остановка не всегда была ровно по центру сектора. Плюс N полных
 * оборотов от предыдущего положения.
 */
export function computeTargetRotation(
  segmentIndex: number,
  previousRotation: number,
  random: () => number = Math.random,
  fullSpins = 6,
): number {
  const angle = WHEEL_SEGMENT_ANGLE;
  const jitter = (random() - 0.5) * angle * 0.7;
  const targetModulus = (360 - segmentIndex * angle + jitter) % 360;
  const base = previousRotation - (previousRotation % 360);
  return base + fullSpins * 360 + targetModulus;
}

// ── Лимит круток: 1 раз в 24 часа на экипаж (localStorage) ──────────────────
// ?demo=1 на странице снимает лимит (витрина/boss-тест), но промокоды всё
// равно публичные и сервер валидирует их заново в корзине.

export const WHEEL_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function wheelSpinStorageKey(slug: string): string {
  return `franchize-wheel-spin:${slug}`;
}

export function readLastSpinAt(storage: Storage | null, slug: string): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(wheelSpinStorageKey(slug));
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) && ts > 0 ? ts : null;
  } catch {
    return null;
  }
}

export function writeLastSpinAt(storage: Storage | null, slug: string, at: number): void {
  if (!storage) return;
  try {
    storage.setItem(wheelSpinStorageKey(slug), String(at));
  } catch {
    // Best-effort: хранилище никогда не должно ломать колесо.
  }
}

/** ms до следующей доступной крутки (0 — можно крутить). */
export function spinCooldownRemainingMs(lastSpinAt: number | null, now: number = Date.now()): number {
  if (!lastSpinAt) return 0;
  const remaining = lastSpinAt + WHEEL_SPIN_COOLDOWN_MS - now;
  return remaining > 0 ? remaining : 0;
}

/** «через 5 ч 12 мин» для подписи на кнопке. */
export function formatCooldown(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `через ${hours} ч ${minutes} мин` : `через ${hours} ч`;
  return `через ${Math.max(1, minutes)} мин`;
}
