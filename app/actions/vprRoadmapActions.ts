"use server";

// task212c: VPR Roadmap — геймификация 8 класса.
// Прогресс разблокировки предметов хранится в users.metadata.vprProgress:
//   { "unlocked": ["algebra"], "completed": { "algebra": { score, total, at } } }
// Порядок дорожки (первый открыт, остальные под замком до сдачи теста ≥70%):
//   algebra → geometry → probability → russian → history → literature

import { fetchUserData, updateUserMetadata } from "@/lib/supabase-server";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger";

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

function readProgress(meta: Record<string, any> | null | undefined): VprRoadmapProgress {
  const raw = meta?.vprProgress;
  if (raw && typeof raw === "object" && Array.isArray(raw.unlocked) && raw.unlocked.length > 0) {
    return { unlocked: raw.unlocked as string[], completed: raw.completed || {} };
  }
  // пустой профиль = только первый предмет дорожки
  return { unlocked: [VPR_ROADMAP_ORDER[0]], completed: raw?.completed || {} };
}

export async function getVprRoadmapProgressAction(
  userId: string
): Promise<{ success: boolean; progress?: VprRoadmapProgress; error?: string }> {
  if (!userId) return { success: false, error: "User ID is required." };
  try {
    const user = await fetchUserData(userId);
    return { success: true, progress: readProgress(user?.metadata) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "roadmap fetch failed";
    logger.error(`[VprRoadmap] fetch failed for ${userId}: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Записать результат теста и разблокировать следующий предмет, если сдано.
 * Вызывается с тестовой страницы после завершения попытки. Идемпотентно:
 * повторный вызов не блокирует уже открытые предметы.
 */
export async function recordVprRoadmapResultAction(params: {
  userId: string;
  slug: string;
  score: number;
  total: number;
}): Promise<{
  success: boolean;
  passed?: boolean;
  newlyUnlocked?: string | null;
  progress?: VprRoadmapProgress;
  error?: string;
}> {
  const { userId, slug, score, total } = params;
  if (!userId || !slug) return { success: false, error: "userId и slug обязательны." };
  if (!VPR_ROADMAP_ORDER.includes(slug as VprRoadmapSlug)) {
    return { success: false, error: `Неизвестный предмет дорожки: ${slug}` };
  }
  if (typeof score !== "number" || typeof total !== "number" || total <= 0) {
    return { success: false, error: "Некорректные score/total." };
  }

  try {
    const user = await fetchUserData(userId);
    const meta = (user?.metadata as Record<string, any> | null) || {};
    const progress = readProgress(user?.metadata);
    const passed = score / total >= VPR_PASS_RATIO;

    // обновляем рекорд предмета
    const prev = progress.completed?.[slug];
    const better = !prev || score / total > prev.score / prev.total;
    if (passed && better) {
      progress.completed = {
        ...progress.completed,
        [slug]: { score, total, at: new Date().toISOString() },
      };
    }

    // разблокировка следующего
    let newlyUnlocked: string | null = null;
    if (passed) {
      const idx = VPR_ROADMAP_ORDER.indexOf(slug as VprRoadmapSlug);
      const next = VPR_ROADMAP_ORDER[idx + 1];
      if (next && !progress.unlocked.includes(next)) {
        progress.unlocked = [...progress.unlocked, next];
        newlyUnlocked = next;
        debugLogger.log(`[VprRoadmap] ${userId}: unlocked ${next} after ${slug} (${score}/${total})`);
      }
    }

    if (newlyUnlocked || (passed && better)) {
      const updated = await updateUserMetadata(userId, {
        ...meta,
        vprProgress: { unlocked: progress.unlocked, completed: progress.completed },
      });
      if (!updated.success) {
        return { success: false, error: updated.error || "Не удалось сохранить прогресс." };
      }
    }

    return { success: true, passed, newlyUnlocked, progress };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "roadmap record failed";
    logger.error(`[VprRoadmap] record failed for ${userId}/${slug}: ${msg}`);
    return { success: false, error: msg };
  }
}

/** Админ-шарик: открыть всю дорожку (для отладки/родителей). */
export async function unlockAllVprRoadmapAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: "User ID is required." };
  try {
    const user = await fetchUserData(userId);
    const meta = (user?.metadata as Record<string, any> | null) || {};
    const progress = readProgress(user?.metadata);
    const merged = Array.from(new Set([...progress.unlocked, ...VPR_ROADMAP_ORDER]));
    const updated = await updateUserMetadata(userId, {
      ...meta,
      vprProgress: { unlocked: merged, completed: progress.completed },
    });
    return updated.success
      ? { success: true }
      : { success: false, error: updated.error || "unlock all failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "unlock all failed" };
  }
}
