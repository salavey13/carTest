export type BushStage = "Росток" | "Цветение" | "Плодоношение" | "Восстановление";
export type BushHealth = "Отлично" | "Норма" | "Требует внимания";
export type CareRisk = "низкий" | "средний" | "высокий";

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

export type PlantCareRecommendation = {
  plantName: string;
  risk: CareRisk;
  score: number;
  summary: string;
  checks: string[];
  treatment: string[];
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

export const riskTone: Record<CareRisk, string> = {
  низкий:
    "border-emerald-300/70 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-50",
  средний:
    "border-amber-300/75 bg-amber-50 text-amber-950 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-50",
  высокий:
    "border-rose-300/80 bg-rose-50 text-rose-950 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-50",
};

export function buildCareRecommendation(bush: DemoTomatoBush): PlantCareRecommendation {
  let score = 8;
  const checks: string[] = [];
  const treatment: string[] = [];

  if (bush.hydration < 58) {
    score += 34;
    checks.push("Влажность ниже мягкой зоны: лист может вянуть не от болезни, а от пересыхания субстрата.");
    treatment.push("Дать мягкий полив малыми порциями и проверить дренаж через 20 минут.");
  } else if (bush.hydration > 78) {
    score += 24;
    checks.push("Влажность слишком высокая: есть риск корневого стресса и грибка.");
    treatment.push("Поставить паузу на полив и усилить проветривание у корней.");
  } else {
    checks.push("Влажность в рабочей зоне, полив можно держать по текущему расписанию.");
  }

  if (bush.ph < 5.9) {
    score += 22;
    checks.push("pH ниже комфортного диапазона для томата: питание может хуже усваиваться.");
    treatment.push("Поднять pH питательного раствора до 6.1–6.3 без резких скачков.");
  } else if (bush.ph > 6.6) {
    score += 18;
    checks.push("pH выше комфортного диапазона: возможен лёгкий блок микроэлементов.");
    treatment.push("Снизить pH до 6.2–6.4 и повторно проверить раствор вечером.");
  } else {
    checks.push("pH в зелёной зоне для домашней гидропоники.");
  }

  if (bush.ec < 1.2 && bush.stage !== "Росток") {
    score += 18;
    checks.push("EC низковат для взрослой стадии: куст может голодать.");
    treatment.push("Добавить слабую порцию питания и наблюдать за новыми листьями 24 часа.");
  } else if (bush.ec > 2.2) {
    score += 20;
    checks.push("EC высоковат: кончики листьев могут получить солевой ожог.");
    treatment.push("Разбавить раствор чистой водой и не подкармливать до следующего замера.");
  } else {
    checks.push("EC выглядит безопасно для текущей стадии.");
  }

  if (bush.health === "Требует внимания") {
    score += 16;
    checks.push("Ручная отметка здоровья уже просит осмотра листьев с двух сторон.");
    treatment.push("Снять крупное фото нижних листьев и проверить пятна, налёт и вредителей.");
  }

  const risk: CareRisk = score >= 58 ? "высокий" : score >= 34 ? "средний" : "низкий";
  const summary =
    risk === "высокий"
      ? "Нужен уход сегодня: сначала стабилизируем среду, потом ищем болезнь по фото листа."
      : risk === "средний"
        ? "Есть ранние сигналы: лучше поправить режим и проверить лист вечером."
        : "Куст выглядит спокойно: продолжаем наблюдение без тяжёлых вмешательств.";

  return {
    plantName: bush.name,
    risk,
    score: Math.min(score, 100),
    summary,
    checks,
    treatment,
  };
}

export const careRecommendations = demoTomatoBushes.map(buildCareRecommendation);
