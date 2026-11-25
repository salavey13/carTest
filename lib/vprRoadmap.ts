// task212c/213: общие константы VPR-дорожки. Живут в lib (НЕ в "use server"
// файле): Next.js разрешает экспортировать из server actions только async
// функции — константы/типы ломают next build на Vercel (молча для tsc).

export const VPR_ROADMAP_ORDER = [
  "algebra",
  "geometry",
  "probability",
  "russian",
  "history",
  "literature",
] as const;

export type VprRoadmapSlug = (typeof VPR_ROADMAP_ORDER)[number];

export interface VprRoadmapProgress {
  unlocked: string[];
  completed: Record<string, { score: number; total: number; at: string }>;
  /** Полученные ачивки (task214) — для дедупликации повторных уведомлений. */
  achievements?: string[];
  /** Число неудачных попыток по предмету (task214) — для ачивки Iron Will. */
  fails?: Record<string, number>;
}

/** Порог сдачи: не больше 30% ошибок. */
export const VPR_PASS_RATIO = 0.7;

/** Deeplink Telegram WebApp (создаст юзер: t.me/oneBikePlsBot/vpr → /vpr-matrix). */
export const VPR_TG_DEEPLINK = "https://t.me/oneBikePlsBot/vpr";

export const VPR_ROADMAP_LABELS: Record<string, string> = {
  algebra: "Алгебра",
  geometry: "Геометрия",
  probability: "Вероятность и статистика",
  russian: "Русский язык",
  history: "История",
  literature: "Литература",
};

/**
 * Hero-картинки предметов (task212, storage) — прикрепляются к TG-уведомлениям.
 * Telegram качает URL сам через sendPhoto, inline-кнопки вешаются на фото.
 */
export const VPR_HERO_IMAGES: Record<string, string> = {
  algebra: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/algebra-hero.jpg",
  geometry: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/geometry-hero.jpg",
  probability: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/probability-hero.jpg",
  russian: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/russian-hero.jpg",
  history: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/history-hero.jpg",
  literature: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task212/literature-hero.jpg",
};

/** Ачивки заметных чекпоинтов (task214). Ключи хранятся в progress.achievements. */
export interface VprAchievementDef {
  key: string;
  title: string;
  text: (subjectLabel: string, pct: number) => string;
}

export const VPR_ACHIEVEMENTS: VprAchievementDef[] = [
  {
    key: "first_blood",
    title: "🩸 First Blood",
    text: (s) => `Первый уровень дорожки сдан (${s}) — машина завелась, дальше только разгон.`,
  },
  {
    key: "flawless",
    title: "🎯 Flawless Victory",
    text: (s) => `Идеальная сдача ${s} — 100% без единой ошибки. Мастерство, достойное Нео.`,
  },
  {
    key: "iron_will",
    title: "🔥 Iron Will",
    text: (s) => `Провал → повторная попытка → сдано (${s}). Сила воли сильнее красной таблетки поражения.`,
  },
  {
    key: "half_matrix",
    title: "🌗 Половина Матрицы",
    text: () => `Три из шести уровней сданы. Экватор пройден — обратной дороги к «не хочу учиться» больше нет.`,
  },
  {
    key: "one_to_go",
    title: "⏳ Один до конца",
    text: () => `Пять из шести! Остался последний уровень — добей и стань Избранным.`,
  },
  {
    key: "the_one",
    title: "🕶️ The One",
    text: () => `ВСЕ ШЕСТЬ УРОВНЕЙ СДАНЫ. Ты — Избранный. Матрица 8 класса покорена полностью.`,
  },
];
