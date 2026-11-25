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
