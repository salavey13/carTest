"use server";

import { 
  fetchUserData as dbFetchUserData, 
  updateUserMetadata as dbUpdateUserMetadata 
} from "@/hooks/supabase";
import { logger } from "@/lib/logger";

/**
 * Безопасно сохраняет результат теста "Humanity Exam" в метаданные пользователя.
 * Использует ту же логику, что и сохранение темы: fetch -> merge -> update.
 */
export async function saveHumanityExamResult(
  userId: string, 
  score: number, 
  total: number
): Promise<{ success: boolean; error?: string }> {
  
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  try {
    // 1. Получаем текущие данные пользователя
    const user = await dbFetchUserData(userId);
    
    if (!user) {
      throw new Error("User not found in database.");
    }

    // 2. Берем текущие метаданные (чтобы не стереть тему или другие настройки)
    const currentMetadata = (user.metadata as Record<string, any>) || {};

    // 3. Формируем новые метаданные с результатом теста
    const updatedMetadata = {
      ...currentMetadata,
      history_7_bullshit_detector: {
        score: score,
        total: total,
        completedAt: new Date().toISOString(),
        version: "v1"
      }
    };

    // 4. Обновляем пользователя через центральную функцию
    const result = await dbUpdateUserMetadata(userId, updatedMetadata);

    if (!result.success) {
      throw new Error(result.error || "Failed to update user metadata with exam result.");
    }

    logger.info(`[saveHumanityExamResult] Successfully saved score ${score}/${total} for user ${userId}.`);
    return { success: true };

  } catch (e) {
    const error = e instanceof Error ? e.message : "An unknown error occurred.";
    logger.error(`[saveHumanityExamResult] Failed for user ${userId}:`, e);
    return { success: false, error };
  }
}