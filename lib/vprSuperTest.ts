// task221: СУПЕРТЕСТ — диагностический микс из всех предметов 8 класса.
// Живёт в lib (НЕ в "use server" файле): из server actions Next.js разрешает
// экспортировать только async-функции, константы/типы ломают next build.

import { VPR_ROADMAP_ORDER } from "./vprRoadmap";

/**
 * Предметы супертеста = предметы дорожки 8 класса (7 шт. с тестами в БД).
 * Слаги совпадают с VPR_ROADMAP_ORDER — диагностика напрямую маппится в
 * персональный порядок разблокировки.
 */
export const SUPER_SUBJECTS = [...VPR_ROADMAP_ORDER] as string[];

/** id предметов в БД подтягиваются клиентски (/api/vpr-roadmap/subjects),
 *  здесь — только офсеты для описаний. Подписи/цвета — единый источник. */
export const SUPER_SUBJECT_META: Record<
  string,
  { label: string; short: string; color: string; icon: "atom" | "ruler" | "activity" | "languages" | "globe" | "hash" | "landmark" | "calculator" }
> = {
  algebra: { label: "Алгебра", short: "АЛГ", color: "#22d3ee", icon: "calculator" },
  geometry: { label: "Геометрия", short: "ГЕО", color: "#0bf2f6", icon: "ruler" },
  probability: { label: "Вероятность и статистика", short: "ВЕС", color: "#4ade80", icon: "activity" },
  russian: { label: "Русский язык", short: "РУС", color: "#a855f7", icon: "languages" },
  worldhistory: { label: "Всеобщая история", short: "ВСИ", color: "#f59e0b", icon: "globe" },
  literature: { label: "Литература", short: "ЛИТ", color: "#f43f5e", icon: "hash" },
  history: { label: "История России", short: "ИСТ", color: "#eab308", icon: "landmark" },
};

/** Режимы длины супертеста (task221): quick = 4 предмета × 3 вопроса,
 *  standard = 7 × 3, full = 7 × 5. Слот-ротация не даёт quick-режиму
 *  вечно гонять одни и те же 4 предмета: каждый прогон стартует со
 *  следующего сдвига по кольцу. */
export const SUPER_MODES = {
  quick: { subjects: 4, perSubject: 3, label: "Quick_Scan", desc: "4 предмета · 12 вопросов · ~7 мин" },
  standard: { subjects: 7, perSubject: 3, label: "Full_Scan", desc: "все 7 предметов · 21 вопрос · ~12 мин" },
  full: { subjects: 7, perSubject: 5, label: "Deep_Scan", desc: "все 7 предметов · 35 вопросов · ~20 мин" },
} as const;

export type SuperModeKey = keyof typeof SUPER_MODES;

/** Диагноз по предмету: сколько вопросов было, сколько верно. */
export interface SuperSubjectDiag {
  slug: string;
  asked: number;
  correct: number;
}

/** Итог супертеста, сохраняемый в users.metadata.vprSuperTest. */
export interface SuperTestResult {
  at: string;
  mode: SuperModeKey;
  score: number;
  total: number;
  perSubject: SuperSubjectDiag[];
  /** Персональный порядок дорожки: слабейшие предметы первыми. */
  order: string[];
}

/**
 * Персональный порядок разблокировки (task221): предметы сортируются по
 * проценту супертеста — слабейшие вперёд (раньше разблокируются и раньше
 * закрываются шпаргалкой). Предметы без данных сохраняют относительный
 * порядок дорожки. Стабильная сортировка сохраняет «история России —
 * финал»-инварианты из task219 для равных процентов.
 */
export function buildPersonalOrder(diag: SuperSubjectDiag[]): string[] {
  const ratio = new Map(diag.map((d) => [d.slug, d.asked > 0 ? d.correct / d.asked : 1]));
  return [...SUPER_SUBJECTS].sort((a, b) => {
    const ra = ratio.get(a) ?? 1;
    const rb = ratio.get(b) ?? 1;
    if (ra !== rb) return ra - rb; // слабейший — первым
    return SUPER_SUBJECTS.indexOf(a) - SUPER_SUBJECTS.indexOf(b);
  });
}

/** Порог «провала» предмета в диагностике: <70% — дыра. */
export const SUPER_GAP_RATIO = 0.7;
