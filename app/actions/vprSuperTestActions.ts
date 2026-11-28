"use server";

// task221: СУПЕРТЕСТ — server actions. Динамическая сборка случайных
// вопросов из всех предметов 8 класса + per-subject диагностика дыр +
// запись персонального порядка разблокировки в users.metadata.
// ВАЖНО: только async-экспорты ("use server" ограничение next build);
// константы живут в lib/vprSuperTest.ts.

import { supabaseAnon } from "@/hooks/supabase";
import { getVprSubjectSlug } from "@/lib/vprCheatsheet";
import { fetchUserData, updateUserMetadata } from "@/lib/supabase-server";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger";
import {
  SUPER_SUBJECTS,
  SUPER_ROADMAP_SUBJECTS,
  SUPER_PRIORITY_SUBJECTS,
  SUPER_MODES,
  SUPER_GAP_RATIO,
  buildPersonalOrder,
  type SuperModeKey,
  type SuperTestResult,
  type SuperSubjectDiag,
} from "@/lib/vprSuperTest";
import type { VprRoadmapProgress } from "@/lib/vprRoadmap";

// ─── типы (внутренние) ───
export interface SuperAnswerData {
  id: number;
  question_id: number;
  text: string;
  is_correct: boolean;
}

export interface SuperQuestionData {
  id: number;
  subject_id: number;
  text: string;
  explanation?: string | null;
  /** слаг предмета дорожки (клиентский бейдж) */
  subjectSlug: string;
  vpr_answers: SuperAnswerData[];
}

export interface StartSuperResult {
  success: boolean;
  questions?: SuperQuestionData[];
  sessionId?: string;
  mode?: SuperModeKey;
  error?: string;
}

export interface FinishSuperResult {
  success: boolean;
  result?: SuperTestResult;
  gaps?: string[];
  error?: string;
}

/**
 * task222 codereview: хардкод id предметов (71..80) удалён — id нестабильны
 * между контурами (урок task217: «Алгебра-8 = 71 здесь» ломалось на других
 * деплоях). Резолвим id→слаг одним запросом к subjects через официальный
 * маппер имён getVprSubjectSlug; кэшируем на время жизни лямбды.
 */
let subjectIdMapCache: { slugToId: Map<string, number>; idToSlug: Map<number, string> } | null = null;

async function getSubjectIdMaps(): Promise<{ slugToId: Map<string, number>; idToSlug: Map<number, string> }> {
  if (subjectIdMapCache) return subjectIdMapCache;
  // task223: без фильтра класса — бонус-предметы живут на grade 7
  // («Информатика» id 70, «Английский язык» id 5), а «Английский» есть и в
  // 6-м (id 38). Для базового слага берём строку с МАКСИМАЛЬНЫм классом:
  // english: 7 > 6 → id 5; russian: 8 > 7 → id 76 и т.д.
  const { data, error } = await supabaseAnon
    .from("subjects")
    .select("id, name, grade_level");
  if (error || !data) {
    throw new Error(`Не удалось загрузить предметы: ${error?.message || "no data"}`);
  }
  const best = new Map<string, { id: number; grade: number }>();
  for (const sub of data) {
    // базовый слаг = слаг шпаргалки без суффикса класса («algebra-8» → «algebra»)
    const baseSlug = getVprSubjectSlug(sub.name, sub.grade_level).replace(/-\d+$/, "");
    if (!SUPER_SUBJECTS.includes(baseSlug)) continue;
    const grade = typeof sub.grade_level === "number" ? sub.grade_level : 0;
    const prev = best.get(baseSlug);
    if (!prev || grade > prev.grade) best.set(baseSlug, { id: sub.id, grade });
  }
  const slugToId = new Map<string, number>();
  const idToSlug = new Map<number, string>();
  for (const [slug, { id }] of best) {
    slugToId.set(slug, id);
    idToSlug.set(id, slug);
  }
  subjectIdMapCache = { slugToId, idToSlug };
  return subjectIdMapCache;
}

/** Fisher–Yates: перемешивание без мутации входа. */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Запуск супертеста: выбирает предметы (слот-ротация для quick-режима —
 * каждый прогон стартует со следующего сдвига по кольцу, чтобы 4 предмета
 * не повторялись вечно), тянет по perSubject случайных вопросов каждого
 * (без дедупликации вариантов — пул маленький, случайность важнее),
 * перемешивает итог вперемешку и отдаёт клиенту. Сессия живёт на клиенте:
 * супертест диагностический, attempt-таблицу не занимаем (не портим
 * вариантную логику обычных тестов и лидерборд-агрегацию).
 */
export async function startSuperTestAction(mode: SuperModeKey = "standard"): Promise<StartSuperResult> {
  try {
    const cfg = SUPER_MODES[mode] ?? SUPER_MODES.standard;
    // какие предметы в этом прогоне
    let pickedSubjects = SUPER_SUBJECTS;
    if (cfg.subjects < SUPER_SUBJECTS.length) {
      // task223: приоритетные (информатика + английский) — всегда в наборе,
      // остаток добираем слот-ротацией дорожечного кольца (псевдослучайный
      // детерминированный сдвиг по минуте, без юзер-стейта).
      const rest = SUPER_SUBJECTS.filter((sl) => !SUPER_PRIORITY_SUBJECTS.includes(sl));
      const shift = Math.floor(Date.now() / 60000) % rest.length;
      const ring = [...rest.slice(shift), ...rest.slice(0, shift)];
      const takeRest = Math.max(cfg.subjects - SUPER_PRIORITY_SUBJECTS.length, 0);
      pickedSubjects = [...SUPER_PRIORITY_SUBJECTS, ...ring.slice(0, takeRest)];
    }

    // динамический резолв id (task222: без хардкода — контуры БД различаются)
    const { slugToId, idToSlug } = await getSubjectIdMaps();
    const pickedIds = pickedSubjects
      .map((slug) => slugToId.get(slug))
      .filter((id): id is number => typeof id === "number");
    if (pickedIds.length === 0) {
      return { success: false, error: "Предметы 8 класса не найдены в базе." };
    }

    // task222 codereview: один батч-запрос вместо N+1 по предметам —
    // 8 класс маленький, .in() по id предметов тянет всё разом.
    const { data, error } = await supabaseAnon
      .from("vpr_questions")
      .select(`id, subject_id, text, explanation, vpr_answers ( id, question_id, text, is_correct )`)
      .in("subject_id", pickedIds)
      .limit(500);
    if (error) {
      return { success: false, error: `Ошибка загрузки вопросов: ${error.message}` };
    }
    if (!data || data.length === 0) {
      return { success: false, error: "Пул вопросов пуст — супертест недоступен." };
    }

    // группируем по предмету и берём perSubject случайных от каждого
    const bySubject = new Map<number, typeof data>();
    for (const q of data) {
      const arr = bySubject.get(q.subject_id) ?? [];
      arr.push(q);
      bySubject.set(q.subject_id, arr);
    }
    const questions: SuperQuestionData[] = [];
    for (const [, arr] of bySubject) {
      const chosen = shuffled(arr).slice(0, cfg.perSubject);
      for (const q of chosen) {
        questions.push({
          id: q.id,
          subject_id: q.subject_id,
          text: q.text,
          explanation: q.explanation ?? null,
          subjectSlug: idToSlug.get(q.subject_id) ?? "algebra",
          vpr_answers: shuffled((q as { vpr_answers: SuperAnswerData[] }).vpr_answers ?? []),
        });
      }
    }

    if (questions.length === 0) {
      return { success: false, error: "Пул вопросов пуст — супертест недоступен." };
    }

    return {
      success: true,
      questions,
      sessionId: `super-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      mode,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "super start failed";
    logger.error(`[SuperTest] start error: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Финиш супертеста: агрегирует per-subject диагноз, строит персональный
 * порядок разблокировки (слабейшие вперёд) и — если юзер авторизован —
 * сохраняет результат в users.metadata.vprSuperTest, а порядок применяет
 * к vprProgress.unlocked (все предметы с дырой ≤ порога гарантированно
 * открыты, дальше порядок подсказывает, что качать первым).
 * Гость: тот же расчёт без записи — диагностика работает локально.
 */
export async function finishSuperTestAction(params: {
  userId?: string | null;
  mode: SuperModeKey;
  answers: { questionId: number; subjectSlug: string; wasCorrect: boolean }[];
}): Promise<FinishSuperResult> {
  const { userId, mode = "standard", answers } = params;
  try {
    // per-subject агрегация
    const bySlug = new Map<string, SuperSubjectDiag>();
    for (const a of answers) {
      const cur = bySlug.get(a.subjectSlug) ?? { slug: a.subjectSlug, asked: 0, correct: 0 };
      cur.asked += 1;
      if (a.wasCorrect) cur.correct += 1;
      bySlug.set(a.subjectSlug, cur);
    }
    const perSubject = [...bySlug.values()];
    const total = answers.length;
    const score = answers.filter((a) => a.wasCorrect).length;
    // task223: порядок разблокировки — только по 7 дорожечным предметам;
    // информатика/английский остаются в perSubject (радар, вердикты, CTA
    // шпаргалок), но дорожку не перекраивают.
    const roadmapDiag = perSubject.filter((d) => SUPER_ROADMAP_SUBJECTS.includes(d.slug));
    const order = buildPersonalOrder(roadmapDiag);
    const gaps = perSubject
      .filter((d) => d.asked > 0 && d.correct / d.asked < SUPER_GAP_RATIO)
      .map((d) => d.slug);

    const result: SuperTestResult = {
      at: new Date().toISOString(),
      mode,
      score,
      total,
      perSubject,
      order,
    };

    if (!userId) {
      debugLogger.log("[SuperTest] guest finish — local result only");
      return { success: true, result, gaps };
    }

    // сохраняем результат + применяем порядок к дорожке
    const user = await fetchUserData(userId);
    const meta = (user?.metadata as Record<string, any> | null) || {};
    const history: SuperTestResult[] = Array.isArray(meta.vprSuperTestHistory) ? meta.vprSuperTestHistory : [];
    const newMeta: Record<string, any> = {
      ...meta,
      vprSuperTest: result,
      vprSuperTestHistory: [...history.slice(-9), result], // последние 10 прогонов
    };

    // дорожка: персональный порядок. Разблокировка остаётся жёсткой
    // (unlocked — префикс порядка), но сам порядок теперь личный:
    // слабейший предмет = Level 1.
    const oldProgress = meta.vprProgress as VprRoadmapProgress | undefined;
    if (oldProgress && Array.isArray(oldProgress.unlocked)) {
      // сколько уровней уже открыто — столько же первых в новом порядке
      const unlockedCount = oldProgress.unlocked.length;
      const prevSet = new Set(oldProgress.unlocked);
      // уже СДАННЫЕ предметы прижимаем к хвосту (они закрыты), неотвеченные
      // слабейшие — вперёд; внутри — сортировка по percent супертеста.
      const completedSlugs = Object.keys(oldProgress.completed || {});
      const sortedOrder = [...order].sort((a, b) => {
        const ca = completedSlugs.includes(a) ? 1 : 0;
        const cb = completedSlugs.includes(b) ? 1 : 0;
        if (ca !== cb) return ca - cb; // несданные раньше
        return order.indexOf(a) - order.indexOf(b); // стабильность
      });
      // сданные предметы, которых нет в order (были сданы до супертеста), добавляем в конец
      const missing = SUPER_ROADMAP_SUBJECTS.filter((s) => !sortedOrder.includes(s));
      const finalOrder = [...sortedOrder, ...missing];
      newMeta.vprProgress = {
        ...oldProgress,
        unlocked: finalOrder.slice(0, Math.max(unlockedCount, 1)),
        personalOrder: finalOrder,
      };
      debugLogger.log(`[SuperTest] personal order applied for ${userId}: ${finalOrder.join(" → ")}`);
    }

    await updateUserMetadata(userId, newMeta);
    return { success: true, result, gaps };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "super finish failed";
    logger.error(`[SuperTest] finish error: ${msg}`);
    return { success: false, error: msg };
  }
}

/** Последний результат супертеста юзера (для хаба и бейджа «личный порядок»). */
export async function getSuperTestResultAction(
  userId: string
): Promise<{ success: boolean; result?: SuperTestResult | null; error?: string }> {
  try {
    const user = await fetchUserData(userId);
    const meta = (user?.metadata as Record<string, any> | null) || {};
    return { success: true, result: meta.vprSuperTest ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "super get failed";
    logger.error(`[SuperTest] get error: ${msg}`);
    return { success: false, error: msg };
  }
}
