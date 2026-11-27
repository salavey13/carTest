// task212c/213: общие константы VPR-дорожки. Живут в lib (НЕ в "use server"
// файле): Next.js разрешает экспортировать из server actions только async
// функции — константы/типы ломают next build на Vercel (молча для tsc).

export const VPR_ROADMAP_ORDER = [
  "algebra",
  "geometry",
  "probability",
  "russian",
  "worldhistory",
  "literature",
  // task219: История России — второе полугодие; в 1-м полугодии 8 класса
  // по программе идёт ВСЕОБЩАЯ история (Новое время), поэтому в лестнице
  // разблокировки она раньше, а российская — финальный уровень.
  "history",
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
  worldhistory: "Всеобщая история",
  literature: "Литература",
  history: "История России",
};

/**
 * Hero-картинки предметов (task212, storage) — прикрепляются к TG-уведомлениям.
 * Telegram качает URL сам через sendPhoto, inline-кнопки вешаются на фото.
 */
export const VPR_HERO_IMAGES: Record<string, string> = {
  // task220: переведены на новые hero-иллюстрации (те же слаги дорожки)
  algebra: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/algebra-8.jpg",
  geometry: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/geometry-8.jpg",
  probability: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/probability-8.jpg",
  russian: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/russian-8.jpg",
  worldhistory: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/worldhistory-8.jpg",
  literature: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/literature-8.jpg",
  history: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/task220/history-8.jpg",
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
    text: () => `Три из ${VPR_ROADMAP_ORDER.length} уровней сданы. Экватор пройден — обратной дороги к «не хочу учиться» больше нет.`,
  },
  {
    key: "one_to_go",
    title: "⏳ Один до конца",
    text: () => `${VPR_ROADMAP_ORDER.length - 1} из ${VPR_ROADMAP_ORDER.length}! Остался последний уровень — добей и стань Избранным.`,
  },
  {
    key: "the_one",
    title: "🕶️ The One",
    text: () => `ВСЕ ${VPR_ROADMAP_ORDER.length} УРОВНЕЙ СДАНЫ. Ты — Избранный. Матрица 8 класса покорена полностью.`,
  },
];
