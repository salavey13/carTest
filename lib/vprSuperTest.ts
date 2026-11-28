// task221: СУПЕРТЕСТ — диагностический микс из всех предметов 8 класса.
// Живёт в lib (НЕ в "use server" файле): из server actions Next.js разрешает
// экспортировать только async-функции, константы/типы ломают next build.

import { VPR_ROADMAP_ORDER } from "./vprRoadmap";

/**
 * Предметы супертеста (task223): 7 дорожечных + 2 бонус-предмета —
 * Информатика (id 70 в БД, grade 7, 36 вопросов) и Английский (id 5,
 * grade 7, 37 вопросов). Бонус-предметы участвуют в диагностике, радаре
 * и CTA шпаргалок, но НЕ входят в персональный порядок разблокировки —
 * дорожка остаётся семиуровневой (см. SUPER_ROADMAP_SUBJECTS).
 * Слаги базовые (без суффикса класса): CTA шпаргалки строит
 * /vpr/{slug}/8/cheatsheet — /vpr/informatics/8 и /vpr/english/8 живы.
 */
export const SUPER_SUBJECTS = [...VPR_ROADMAP_ORDER, "informatics", "english"] as string[];

/** Дорожечные предметы (7): только они входят в personalOrder/unlocked. */
export const SUPER_ROADMAP_SUBJECTS = [...VPR_ROADMAP_ORDER] as string[];

/** task223 (запрос босса: «focus more on informatics and english»):
 *  в quick-режиме эти два предмета ГАРАНТИРОВАНЫ, остальные добираются
 *  слот-ротацией по кольцу. */
export const SUPER_PRIORITY_SUBJECTS = ["informatics", "english"] as string[];

/** id предметов в БД подтягиваются клиентски (/api/vpr-roadmap/subjects),
 *  здесь — только офсеты для описаний. Подписи/цвета — единый источник. */
export const SUPER_SUBJECT_META: Record<
  string,
  { label: string; short: string; color: string }
> = {
  algebra: { label: "Алгебра", short: "АЛГ", color: "#22d3ee" },
  geometry: { label: "Геометрия", short: "ГЕО", color: "#0bf2f6" },
  probability: { label: "Вероятность и статистика", short: "ВЕС", color: "#4ade80" },
  russian: { label: "Русский язык", short: "РУС", color: "#a855f7" },
  worldhistory: { label: "Всеобщая история", short: "ВСИ", color: "#f59e0b" },
  literature: { label: "Литература", short: "ЛИТ", color: "#f43f5e" },
  history: { label: "История России", short: "ИСТ", color: "#eab308" },
  // task223: бонус-предметы (вне дорожки, но в диагностике)
  informatics: { label: "Информатика", short: "ИНФ", color: "#60a5fa" },
  english: { label: "Английский язык", short: "АНГ", color: "#2dd4bf" },
};

/** Режимы длины супертеста (task223): quick = информатика + английский +
 *  2 случайных дорожечных × 3, standard = 9 × 3, full = 9 × 4.
 *  Слот-ротация добирает недостающие предметы по кольцу, чтобы quick-режим
 *  не вечно гонял одну и ту же пару дорожечных. */
export const SUPER_MODES = {
  quick: { subjects: 4, perSubject: 3, label: "Quick_Scan", desc: "информатика + английский + 2 случайных · 12 вопросов · ~7 мин" },
  standard: { subjects: 9, perSubject: 3, label: "Full_Scan", desc: "все 9 предметов · 27 вопросов · ~15 мин" },
  full: { subjects: 9, perSubject: 4, label: "Deep_Scan", desc: "все 9 предметов · 36 вопросов · ~18 мин" },
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
