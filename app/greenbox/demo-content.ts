export type BushStage = "Росток" | "Цветение" | "Плодоношение" | "Восстановление";
export type BushHealth = "Отлично" | "Норма" | "Требует внимания";

export type DemoTomatoBush = {
  name: string;
  stage: BushStage;
  health: BushHealth;
  progress: number;
  hydration: number;
  ec: number;
  ph: number;
  fruitCount: number;
  note: string;
  emoji: string;
  tone: string;
};

export const demoTomatoBushes: DemoTomatoBush[] = [
  {
    name: "Черри #1",
    stage: "Росток",
    health: "Отлично",
    progress: 28,
    hydration: 73,
    ec: 1.2,
    ph: 6.1,
    fruitCount: 0,
    note: "Наращивает корневую массу после пересадки.",
    emoji: "🌱",
    tone: "from-lime-100/80 to-emerald-100/70 dark:from-emerald-900/40 dark:to-lime-900/20",
  },
  {
    name: "Розовый мёд #2",
    stage: "Цветение",
    health: "Норма",
    progress: 58,
    hydration: 66,
    ec: 1.6,
    ph: 6.4,
    fruitCount: 4,
    note: "Первые кисти раскрылись, нужен стабильный обдув.",
    emoji: "🌿",
    tone: "from-emerald-100/80 to-teal-100/70 dark:from-emerald-900/35 dark:to-teal-900/20",
  },
  {
    name: "Бычье сердце #3",
    stage: "Плодоношение",
    health: "Отлично",
    progress: 84,
    hydration: 71,
    ec: 2,
    ph: 6.2,
    fruitCount: 11,
    note: "Плоды наливаются, вес кистей растёт.",
    emoji: "🍅",
    tone: "from-orange-100/90 to-rose-100/70 dark:from-rose-900/35 dark:to-orange-900/20",
  },
  {
    name: "Сливка #4",
    stage: "Восстановление",
    health: "Требует внимания",
    progress: 42,
    hydration: 54,
    ec: 1.1,
    ph: 5.7,
    fruitCount: 2,
    note: "Стресс после жары, нужен мягкий полив и тень.",
    emoji: "🪴",
    tone: "from-amber-100/90 to-yellow-100/70 dark:from-amber-900/40 dark:to-yellow-900/20",
  },
];

export const healthTone: Record<BushHealth, string> = {
  Отлично:
    "border-emerald-300/70 bg-emerald-100/80 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100",
  Норма:
    "border-lime-300/70 bg-lime-100/80 text-lime-900 dark:border-lime-400/40 dark:bg-lime-500/15 dark:text-lime-100",
  "Требует внимания":
    "border-amber-300/70 bg-amber-100/80 text-amber-900 dark:border-amber-400/45 dark:bg-amber-500/15 dark:text-amber-100",
};
