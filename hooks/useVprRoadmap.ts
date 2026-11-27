"use client";

// task212c: клиентский хук VPR-дорожки. Читает прогресс из БД через server
// action, кэширует в localStorage для мгновенной отрисовки замков (гость
// без Telegram-авторизации видит дорожку с дефолтным прогрессом).

import { useCallback, useEffect, useState } from "react";
import {
  getVprRoadmapProgressAction,
  recordVprRoadmapResultAction,
} from "@/app/actions/vprRoadmapActions";
import {
  VPR_ROADMAP_ORDER,
  VPR_PASS_RATIO,
  type VprRoadmapProgress,
} from "@/lib/vprRoadmap";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger } from "@/lib/debugLogger";

const LS_KEY = "vpr-roadmap-progress";

export const DEFAULT_PROGRESS: VprRoadmapProgress = {
  unlocked: [VPR_ROADMAP_ORDER[0]],
  completed: {},
  achievements: [],
  fails: {},
};

function readLS(): VprRoadmapProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // task215: старый кэш (до task214) не имеет achievements/fails —
    // достраиваем пустыми, чтобы UI не падал на undefined-полях.
    // task221: personalOrder — опциональный (появился с супертестом).
    if (parsed && Array.isArray(parsed.unlocked)) {
      return {
        unlocked: parsed.unlocked,
        completed: parsed.completed || {},
        achievements: parsed.achievements || [],
        fails: parsed.fails || {},
        personalOrder: Array.isArray(parsed.personalOrder) ? parsed.personalOrder : undefined,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeLS(p: VprRoadmapProgress) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function useVprRoadmap() {
  const { dbUser, isLoading: isUserLoading } = useAppContext();
  const [progress, setProgress] = useState<VprRoadmapProgress>(DEFAULT_PROGRESS);
  const [isLoaded, setIsLoaded] = useState(false);

  // мгновенный рендер из localStorage
  useEffect(() => {
    const cached = readLS();
    if (cached) setProgress(cached);
    setIsLoaded(true);
  }, []);

  // серверная правда — как только известен пользователь
  useEffect(() => {
    if (isUserLoading) return;
    const userId = dbUser?.user_id;
    if (!userId) {
      // гость: дорожка с только первым предметом (кэш не трогаем — вернётся
      // при логине), но и не позволяем локально «разблокировать» всё
      return;
    }
    let cancelled = false;
    getVprRoadmapProgressAction(String(userId))
      .then((res) => {
        if (cancelled || !res.success || !res.progress) return;
        setProgress(res.progress);
        writeLS(res.progress);
      })
      .catch((e) => debugLogger.warn("[useVprRoadmap] fetch failed", e));
    return () => {
      cancelled = true;
    };
  }, [dbUser?.user_id, isUserLoading]);

  /** Записать результат теста. Возвращает открылся ли следующий предмет + ачивки. */
  const recordResult = useCallback(
    async (slug: string, score: number, total: number): Promise<{ passed: boolean; newlyUnlocked: string | null; earnedAchievements: string[] }> => {
      const userId = dbUser?.user_id ? String(dbUser.user_id) : null;
      if (!userId) {
        // гость: считаем локально, чтобы UX работал и без авторизации
        // (ачивки гостю не начисляются — нет TG-доставки и постоянного профиля)
        const passed = total > 0 && score / total >= VPR_PASS_RATIO;
        if (passed) {
          const idx = VPR_ROADMAP_ORDER.indexOf(slug as (typeof VPR_ROADMAP_ORDER)[number]);
          const next = VPR_ROADMAP_ORDER[idx + 1] ?? null;
          if (next && !progress.unlocked.includes(next)) {
            const updated = { ...progress, unlocked: [...progress.unlocked, next] };
            setProgress(updated);
            writeLS(updated);
            return { passed, newlyUnlocked: next, earnedAchievements: [] };
          }
        }
        return { passed, newlyUnlocked: null, earnedAchievements: [] };
      }
      const res = await recordVprRoadmapResultAction({ userId, slug, score, total });
      if (res.success && res.progress) {
        setProgress(res.progress);
        writeLS(res.progress);
      }
      return { passed: res.passed ?? false, newlyUnlocked: res.newlyUnlocked ?? null, earnedAchievements: res.earnedAchievements ?? [] };
    },
    [dbUser?.user_id, progress]
  );

  const isUnlocked = useCallback(
    (slug: string) => progress.unlocked.includes(slug),
    [progress.unlocked]
  );

  const isCompleted = useCallback((slug: string) => Boolean(progress.completed?.[slug]), [progress.completed]);

  return { progress, isLoaded, recordResult, isUnlocked, isCompleted };
}

/**
 * task221: эффективный порядок дорожки для UI — персональный (из
 * супертеста), если есть, иначе канонический VPR_ROADMAP_ORDER.
 * Гость: личный порядок читается из localStorage-прогресса (гость мог
 * пройти супертест без авторизации — диагноз работает локально).
 */
export function useRoadmapDisplayOrder(): string[] {
  const { progress } = useVprRoadmap();
  if (progress.personalOrder && progress.personalOrder.length > 0) {
    // порядок мог устареть (появились новые слаги) — достраиваем хвостом
    const missing = VPR_ROADMAP_ORDER.filter((s) => !progress.personalOrder!.includes(s));
    return [...progress.personalOrder, ...missing];
  }
  return [...VPR_ROADMAP_ORDER];
}
