"use server";

// task212c/213: VPR Roadmap — геймификация 8 класса.
// Прогресс разблокировки предметов хранится в users.metadata.vprProgress:
//   { "unlocked": ["algebra"], "completed": { "algebra": { score, total, at } } }
// Порядок дорожки (первый открыт, остальные под замком до сдачи теста ≥70%):
//   algebra → geometry → probability → russian → history → literature
// ВАЖНО: только async-экспорты ("use server" ограничение next build);
// константы живут в lib/vprRoadmap.ts.

import { fetchUserData, updateUserMetadata } from "@/lib/supabase-server";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import {
  VPR_ROADMAP_ORDER,
  VPR_PASS_RATIO,
  VPR_TG_DEEPLINK,
  VPR_ROADMAP_LABELS,
  type VprRoadmapSlug,
  type VprRoadmapProgress,
} from "@/lib/vprRoadmap";

function readProgress(meta: Record<string, any> | null | undefined): VprRoadmapProgress {
  const raw = meta?.vprProgress;
  if (raw && typeof raw === "object" && Array.isArray(raw.unlocked) && raw.unlocked.length > 0) {
    return { unlocked: raw.unlocked as string[], completed: raw.completed || {} };
  }
  // пустой профиль = только первый предмет дорожки
  return { unlocked: [VPR_ROADMAP_ORDER[0]], completed: raw?.completed || {} };
}

/**
 * Уведомление игроку о прогрессе дорожки (task213): шлём в TG через
 * форвардинг-API. Кнопка-deeplink открывает WebApp (t.me/oneBikePlsBot/vpr).
 * Ошибка отправки не валит основной flow — только лог.
 */
async function notifyRoadmapProgress(params: {
  userId: string;
  kind: "unlocked" | "passed" | "almost" | "finished";
  slug: string;
  score: number;
  total: number;
  nextSlug?: string | null;
}): Promise<void> {
  const { userId, kind, slug, score, total, nextSlug } = params;
  try {
    const subjectLabel = VPR_ROADMAP_LABELS[slug] ?? slug;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const deepLinkButton = [[{ text: "🎮 Продолжить тренировку", url: VPR_TG_DEEPLINK }]];

    let text = "";
    let buttons = deepLinkButton;

    if (kind === "unlocked" && nextSlug) {
      const nextLabel = VPR_ROADMAP_LABELS[nextSlug] ?? nextSlug;
      text =
        `🔓 *Уровень открыт!*\n\n` +
        `*${subjectLabel}* — сдана на *${pct}%* (${score}/${total}).\n` +
        `Следующий уровень дорожки: *${nextLabel}*. Шпаргалка уже прогружена, тест ждёт.\n\n` +
        `Feed → Fight → Fail → Repeat → Upgrade 💊`;
    } else if (kind === "finished") {
      text =
        `🏆 *ДОРОЖКА ПРОЙДЕНА!*\n\n` +
        `*${subjectLabel}* — финальный уровень сдан (${score}/${total}, ${pct}%).\n` +
        `Все 6 предметов 8 класса разблокированы и сданы. Середина года дешифрована — I know kung fu и теорему Пифагора 😎`;
      buttons = [[{ text: "🎮 В Матрицу", url: VPR_TG_DEEPLINK }]];
    } else if (kind === "almost") {
      const need = Math.max(1, Math.ceil(VPR_PASS_RATIO * total) - score);
      text =
        `⚡ *Почти получилось!*\n\n` +
        `*${subjectLabel}* — ${score}/${total} (${pct}%).\n` +
        `До разблокировки следующего уровня не хватило *${need}* ${need === 1 ? "ответа" : "ответов"}. ` +
        `Перечитай шпаргалку по слабым местам и вернись — второй заход всегда точнее.\n\n` +
        `Fail → Repeat → Upgrade. Это часть протокола 🔁`;
    } else {
      text =
        `✅ *Уровень сдан!*\n\n` +
        `*${subjectLabel}* — ${score}/${total} (${pct}%).\n` +
        `Порог пройден. Дорожка 8 класса ждёт продолжения.`;
    }

    const result = await sendComplexMessage(userId, text, buttons, { parseMode: "Markdown" });
    if (!result.success) {
      logger.warn(`[VprRoadmap] TG notify failed for ${userId}: ${result.error}`);
    } else {
      debugLogger.log(`[VprRoadmap] TG notify (${kind}) sent to ${userId}`);
    }
  } catch (e) {
    logger.warn(`[VprRoadmap] TG notify error for ${userId}: ${e instanceof Error ? e.message : e}`);
  }
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
 * task213: шлёт игроку TG-уведомление (unlock / почти / сдан / финал).
 */
export async function recordVprRoadmapResultAction(params: {
  userId: string;
  slug: string;
  score: number;
  total: number;
  notify?: boolean;
}): Promise<{
  success: boolean;
  passed?: boolean;
  newlyUnlocked?: string | null;
  progress?: VprRoadmapProgress;
  error?: string;
}> {
  const { userId, slug, score, total, notify = true } = params;
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
    const ratio = score / total;
    const passed = ratio >= VPR_PASS_RATIO;

    // обновляем рекорд предмета
    const prev = progress.completed?.[slug];
    const better = !prev || ratio > prev.score / prev.total;
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

    // TG-уведомление о прогрессе (task213), только если это новый результат
    const isNewResult = Boolean(newlyUnlocked || (passed && better));
    if (notify && isNewResult) {
      const allDone = VPR_ROADMAP_ORDER.every((s) => progress.completed?.[s]);
      if (passed && allDone) {
        await notifyRoadmapProgress({ userId, kind: "finished", slug, score, total });
      } else if (passed && newlyUnlocked) {
        await notifyRoadmapProgress({ userId, kind: "unlocked", slug, score, total, nextSlug: newlyUnlocked });
      } else if (passed) {
        await notifyRoadmapProgress({ userId, kind: "passed", slug, score, total });
      } else if (ratio >= 0.6) {
        await notifyRoadmapProgress({ userId, kind: "almost", slug, score, total });
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
