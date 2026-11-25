"use server";

// task212c/213/214: VPR Roadmap — геймификация 8 класса.
// Прогресс разблокировки предметов хранится в users.metadata.vprProgress:
//   { unlocked: ["algebra"], completed: { algebra: { score, total, at } },
//     achievements: ["first_blood"], fails: { algebra: 1 } }
// Порядок дорожки (первый открыт, остальные под замком до сдачи теста ≥70%):
//   algebra → geometry → probability → russian → history → literature
// ВАЖНО: только async-экспорты ("use server" ограничение next build);
// константы живут в lib/vprRoadmap.ts.
// task214: уведомления — sendPhoto с hero-картинкой предмета + inline
// URL-кнопки (переживают пересылку) + ачивки + копия резюме родителю.

import { fetchUserData, updateUserMetadata } from "@/lib/supabase-server";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger";
import { telegramDeliver } from "@/lib/telegram-transport";
import {
  VPR_ROADMAP_ORDER,
  VPR_PASS_RATIO,
  VPR_TG_DEEPLINK,
  VPR_ROADMAP_LABELS,
  VPR_HERO_IMAGES,
  VPR_ACHIEVEMENTS,
  type VprRoadmapSlug,
  type VprRoadmapProgress,
} from "@/lib/vprRoadmap";

function readProgress(meta: Record<string, any> | null | undefined): VprRoadmapProgress {
  const raw = meta?.vprProgress;
  if (raw && typeof raw === "object" && Array.isArray(raw.unlocked) && raw.unlocked.length > 0) {
    return {
      unlocked: raw.unlocked as string[],
      completed: raw.completed || {},
      achievements: raw.achievements || [],
      fails: raw.fails || {},
    };
  }
  // пустой профиль = только первый предмет дорожки
  return {
    unlocked: [VPR_ROADMAP_ORDER[0]],
    completed: raw?.completed || {},
    achievements: raw?.achievements || [],
    fails: raw?.fails || {},
  };
}

/**
 * Экранирование Markdown-спецсимволов (task215): имена геймеров с _ * ` [
 * ломали parse_mode=Markdown — Telegram отклонял всю отправку. Экранируем
 * только пользовательские вставки (имя), остальной текст — наш, контролируем.
 */
function escapeTgMarkdown(s: string): string {
  return s.replace(/([_*`\[\]])/g, "\\$1");
}

/** Отправка сообщения игроку: фото (hero предмета) + caption + inline-кнопки. */
async function sendVprPhotoMessage(params: {
  chatId: string;
  text: string;
  photoUrl?: string;
  buttons: { text: string; url: string }[][];
}): Promise<void> {
  const { chatId, text, photoUrl, buttons } = params;
  try {
    const payload: Record<string, unknown> = {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    };
    if (photoUrl) {
      payload.photo = photoUrl;
      payload.caption = text;
    } else {
      payload.text = text;
    }
    const result = await telegramDeliver(photoUrl ? "sendPhoto" : "sendMessage", chatId, payload);
    if (!result.ok) {
      // Edge case (task215): битый Markdown (незакрытая * или _ в имени
      // геймера) валяет всю отправку — ретрай без форматирования лучше,
      // чем потерянное уведомление.
      debugLogger.log(`[VprRoadmap] TG Markdown failed (${result.error}), retrying plain`);
      const plain: Record<string, unknown> = { reply_markup: payload.reply_markup };
      if (photoUrl) {
        plain.photo = photoUrl;
        plain.caption = text.replace(/[*_`]/g, "");
      } else {
        plain.text = text.replace(/[*_`]/g, "");
      }
      const retry = await telegramDeliver(photoUrl ? "sendPhoto" : "sendMessage", chatId, plain);
      if (!retry.ok) {
        logger.warn(`[VprRoadmap] TG plain retry failed for ${chatId}: ${retry.error}`);
        return;
      }
    }
    debugLogger.log(`[VprRoadmap] TG photo message sent to ${chatId}`);
  } catch (e) {
    logger.warn(`[VprRoadmap] TG sendPhoto error for ${chatId}: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * Уведомление игроку о прогрессе дорожки (task213/214): hero-картинка
 * предмета + inline URL-кнопка в WebApp (t.me/oneBikePlsBot/vpr) — кнопки
 * переживают пересылку. Ачивки (если есть) добавляются в то же сообщение.
 * Ошибка отправки не валит основной flow — только лог.
 */
async function notifyRoadmapProgress(params: {
  userId: string;
  kind: "unlocked" | "passed" | "almost" | "finished";
  slug: string;
  score: number;
  total: number;
  nextSlug?: string | null;
  achievements?: string[]; // названия полученных ачивок (уже отформатированные)
}): Promise<void> {
  const { userId, kind, slug, score, total, nextSlug, achievements = [] } = params;
  try {
    const subjectLabel = VPR_ROADMAP_LABELS[slug] ?? slug;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const heroImage = VPR_HERO_IMAGES[slug] ?? VPR_HERO_IMAGES.algebra;

    let text = "";
    let ctaText = "🎮 Продолжить тренировку";

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
      ctaText = "🎮 В Матрицу";
    } else if (kind === "almost") {
      const need = Math.max(1, Math.ceil(VPR_PASS_RATIO * total) - score);
      text =
        `⚡ *Почти получилось!*\n\n` +
        `*${subjectLabel}* — ${score}/${total} (${pct}%).\n` +
        `До разблокировки следующего уровня не хватило *${need}* ${need === 1 ? "ответа" : "ответов"}. ` +
        `Перечитай шпаргалку по слабым местам и вернись — второй заход всегда точнее.\n\n` +
        `Fail → Repeat → Upgrade. Это часть протокола 🔁`;
      ctaText = "📖 Шпаргалка";
    } else {
      text =
        `✅ *Уровень сдан!*\n\n` +
        `*${subjectLabel}* — ${score}/${total} (${pct}%).\n` +
        `Порог пройден. Дорожка 8 класса ждёт продолжения.`;
    }

    // ачивки — отдельным блоком в этом же сообщении
    if (achievements.length > 0) {
      text += `\n\n${achievements.map((a) => `🏅 ${a}`).join("\n")}`;
    }

    await sendVprPhotoMessage({
      chatId: userId,
      text,
      photoUrl: heroImage,
      buttons: [[{ text: ctaText, url: VPR_TG_DEEPLINK }]],
    });
    debugLogger.log(`[VprRoadmap] TG notify (${kind}) sent to ${userId}`);
  } catch (e) {
    logger.warn(`[VprRoadmap] TG notify error for ${userId}: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * Копия родителю/организатору (task214): краткое резюме прогресса геймера
 * без игрового сленга — что сдано, сколько ошибок, какие ачивки.
 */
async function notifyParentSummary(params: {
  parentId: string;
  gamerName: string;
  kind: "unlocked" | "passed" | "almost" | "finished";
  slug: string;
  score: number;
  total: number;
  achievements: string[];
  completedCount: number;
}): Promise<void> {
  const { parentId, gamerName, kind, slug, score, total, achievements, completedCount } = params;
  try {
    const subjectLabel = VPR_ROADMAP_LABELS[slug] ?? slug;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;

    const headline =
      kind === "finished"
        ? `🏆 ${gamerName} прошёл всю дорожку!`
        : kind === "unlocked"
          ? `🔓 ${gamerName} открыл новый уровень`
          : kind === "almost"
            ? `⚡ ${gamerName} почти сдал уровень`
            : `✅ ${gamerName} сдал уровень`;

    const body =
      `${subjectLabel}: ${score}/${total} (${pct}%).\n` +
      `Прогресс дорожки: ${completedCount}/6 предметов сдано.`;

    const ach = achievements.length > 0 ? `\n🏅 Ачивки: ${achievements.join(", ")}` : "";
    const advice =
      kind === "almost"
        ? `\nНе хватило пары правильных ответов до порога 70% — стоит повторить тему и перезапустить тест.`
        : kind === "finished"
          ? `\nВсе шесть предметов сданы. Можно хвалить и выдавать награду 🙂`
          : "";

    await sendVprPhotoMessage({
      chatId: parentId,
      text: `${headline}\n\n${body}${ach}${advice}`,
      photoUrl: VPR_HERO_IMAGES[slug] ?? VPR_HERO_IMAGES.algebra,
      buttons: [[{ text: "🎮 Открыть Матрицу", url: VPR_TG_DEEPLINK }]],
    });
    debugLogger.log(`[VprRoadmap] parent summary (${kind}) sent to ${parentId}`);
  } catch (e) {
    logger.warn(`[VprRoadmap] parent summary error for ${parentId}: ${e instanceof Error ? e.message : e}`);
  }
}

/** Имя геймера для родительского резюме: username → first_name → «Геймер». */
function tgDisplayName(user: any): string {
  return user?.username || user?.first_name || user?.name || "Геймер";
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
 * task213: TG-уведомление игроку (unlock / почти / сдан / финал).
 * task214: hero-фото + inline-кнопки; ачивки чекпоинтов с дедупликацией;
 * копия резюме родителю (ADMIN_CHAT_ID) — если геймер не он сам.
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
  earnedAchievements?: string[];
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
    const wasCompleted = Boolean(progress.completed?.[slug]);

    // считаем провалы (для Iron Will) и обновляем рекорд
    const prev = progress.completed?.[slug];
    const better = !prev || ratio > prev.score / prev.total;
    if (passed && better) {
      progress.completed = {
        ...progress.completed,
        [slug]: { score, total, at: new Date().toISOString() },
      };
    } else if (!passed && !wasCompleted) {
      progress.fails = { ...progress.fails, [slug]: (progress.fails?.[slug] || 0) + 1 };
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

    // ===== ачивки (task214): какие earned в этой попытке =====
    const earned: string[] = [];
    const owned = new Set(progress.achievements || []);
    const completedCount = Object.keys(progress.completed).length;
    const claim = (key: string) => {
      if (!owned.has(key)) {
        owned.add(key);
        const def = VPR_ACHIEVEMENTS.find((a) => a.key === key);
        if (def) earned.push(def.title);
      }
    };

    // first_blood: первый сданный предмет ЛИБО ретро (task215) — юзер, сдавший
    // предметы до появления ачивок, получает first_blood при следующей сдаче.
    if (passed && Object.keys(progress.completed).length >= 1) claim("first_blood");
    if (passed && score === total) claim("flawless");
    if (passed && !wasCompleted && (progress.fails?.[slug] || 0) > 0) claim("iron_will");
    if (Object.keys(progress.completed).length >= 3) claim("half_matrix");
    if (Object.keys(progress.completed).length >= 5) claim("one_to_go");
    if (Object.keys(progress.completed).length >= 6) claim("the_one");
    progress.achievements = Array.from(owned);

    // сохраняем, если что-то изменилось
    const dirty =
      Boolean(newlyUnlocked) || (passed && better) || earned.length > 0 || (!passed && !wasCompleted);
    if (dirty) {
      const updated = await updateUserMetadata(userId, {
        ...meta,
        vprProgress: {
          unlocked: progress.unlocked,
          completed: progress.completed,
          achievements: progress.achievements,
          fails: progress.fails,
        },
      });
      if (!updated.success) {
        return { success: false, error: updated.error || "Не удалось сохранить прогресс." };
      }
    }

    // ===== TG-уведомления =====
    // игроку — на новые результаты (рекорд/разблокировка/ачивка), «почти» — на близкий провал
    const isNewResult = Boolean(newlyUnlocked || (passed && better) || earned.length > 0);
    const isCloseFail = !passed && ratio >= 0.6 && !wasCompleted;
    if (notify && (isNewResult || isCloseFail)) {
      const allDone = VPR_ROADMAP_ORDER.every((s) => progress.completed?.[s]);
      let kind: "unlocked" | "passed" | "almost" | "finished" = "passed";
      if (passed && allDone) kind = "finished";
      else if (passed && newlyUnlocked) kind = "unlocked";
      else if (!passed) kind = "almost";

      await notifyRoadmapProgress({ userId, kind, slug, score, total, nextSlug: newlyUnlocked, achievements: earned });

      // родителю — если геймер не сам родитель и есть что рассказать
      const parentChatId = process.env.ADMIN_CHAT_ID;
      if (parentChatId && parentChatId !== userId && (passed || isCloseFail)) {
        await notifyParentSummary({
          parentId: parentChatId,
          gamerName: escapeTgMarkdown(tgDisplayName(user)),
          kind,
          slug,
          score,
          total,
          achievements: earned,
          completedCount,
        });
      }
    }

    return { success: true, passed, newlyUnlocked, earnedAchievements: earned, progress };
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
      vprProgress: {
        unlocked: merged,
        completed: progress.completed,
        achievements: progress.achievements,
        fails: progress.fails,
      },
    });
    return updated.success
      ? { success: true }
      : { success: false, error: updated.error || "unlock all failed" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "unlock all failed" };
  }
}
