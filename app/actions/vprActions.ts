"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger";
// Import necessary types from the page component (or define them centrally)
import type { VprTestAttempt, SubjectData, VprQuestionData, VprAnswerData } from "@/app/vpr-test/[subjectId]/page";
import { notifyAdmins } from "@/app/actions"; // Assuming this is your main notify action

// --- Types for Return Values ---
interface StartAttemptResult {
  attempt: VprTestAttempt | null;
  subject: SubjectData | null;
  questions: VprQuestionData[];
  selectedVariant: number | null;
  error?: string;
}

interface RecordAnswerResult {
  updatedAttempt: VprTestAttempt | null;
  error?: string;
}

interface UpdateProgressResult {
  updatedAttempt: VprTestAttempt | null;
  error?: string;
}

interface ResetResult {
    success: boolean;
    error?: string;
}

// --- Action Implementations ---

/**
 * Initializes a VPR test: selects a variant, fetches subject/questions,
 * and finds or creates a test attempt record.
 */
export async function startOrResumeVprAttempt(userId: string, subjectId: number): Promise<StartAttemptResult> {
    debugLogger.log(`[VprAction] startOrResumeVprAttempt called for user: ${userId}, subject: ${subjectId}`);
    if (!userId || !subjectId) {
        return { attempt: null, subject: null, questions: [], selectedVariant: null, error: "User ID and Subject ID are required." };
    }

    let variantToLoad: number | null = null;
    let subjectData: SubjectData | null = null;
    let questionData: VprQuestionData[] = [];
    let attemptToUse: VprTestAttempt | null = null;

    try {
        // --- 1. Variant Selection ---
        const { data: variantData, error: variantError } = await supabaseAdmin
            .from('vpr_questions')
            .select('variant_number')
            .eq('subject_id', subjectId);

        if (variantError) throw new Error(`Ошибка получения вариантов: ${variantError.message}`);
        if (!variantData || variantData.length === 0) throw new Error(`Для предмета ID ${subjectId} не найдено ни одного варианта.`);
        const allAvailableVariants = [...new Set(variantData.map(q => q.variant_number))].sort((a, b) => a - b);

        const { data: completedAttemptsData, error: completedError } = await supabaseAdmin
            .from('vpr_test_attempts')
            .select('variant_number')
            .eq('user_id', userId)
            .eq('subject_id', subjectId)
            .not('completed_at', 'is', null);

        if (completedError) throw new Error(`Ошибка получения пройденных попыток: ${completedError.message}`);
        const completedVariants = [...new Set(completedAttemptsData.map(a => a.variant_number))];
        const untriedVariants = allAvailableVariants.filter(v => !completedVariants.includes(v));

        if (untriedVariants.length > 0) {
            variantToLoad = untriedVariants[Math.floor(Math.random() * untriedVariants.length)];
        } else if (allAvailableVariants.length > 0) {
            variantToLoad = allAvailableVariants[Math.floor(Math.random() * allAvailableVariants.length)];
        } else {
            throw new Error('Не удалось определить вариант для загрузки (нет доступных вариантов).');
        }
        if (variantToLoad === null || isNaN(variantToLoad)) throw new Error("Не удалось выбрать номер варианта.");
        debugLogger.log(`[VprAction] Selected Variant: ${variantToLoad}`);

        // --- 2. Fetch Subject Data ---
        const { data: subjData, error: subjectError } = await supabaseAdmin
            .from('subjects')
            .select('*')
            .eq('id', subjectId)
            .single();
        if (subjectError) throw new Error(`Ошибка загрузки предмета: ${subjectError.message}`);
        if (!subjData) throw new Error(`Предмет с ID ${subjectId} не найден`);
        subjectData = subjData;
        debugLogger.log(`[VprAction] Subject data loaded: ${subjectData.name}`);

        // --- 3. Fetch Questions ---
        const { data: qData, error: questionError } = await supabaseAdmin
            .from('vpr_questions')
            .select(`*, vpr_answers ( * )`) // Fetch nested answers
            .eq('subject_id', subjectId)
            .eq('variant_number', variantToLoad)
            .order('position', { ascending: true });
        if (questionError) throw new Error(`Ошибка загрузки вопросов: ${questionError.message}`);
        if (!qData || qData.length === 0) throw new Error(`Вопросы для предмета '${subjectData.name}', варианта ${variantToLoad} не найдены`);
        questionData = qData;
        const loadedQuestionCount = questionData.length;
        debugLogger.log(`[VprAction] Loaded ${loadedQuestionCount} questions.`);

        // --- 4. Find or Create Attempt ---
        const { data: existingAttempts, error: attemptError } = await supabaseAdmin
            .from('vpr_test_attempts')
            .select('*') // Select all fields
            .eq('user_id', userId)
            .eq('subject_id', subjectId)
            .eq('variant_number', variantToLoad)
            .is('completed_at', null)
            .order('started_at', { ascending: false })
            .limit(1);
        if (attemptError) throw new Error(`Ошибка поиска попытки: ${attemptError.message}`);

        if (existingAttempts && existingAttempts.length > 0) {
            const potentialAttempt = existingAttempts[0];
            // Validate question count
            if (typeof potentialAttempt.total_questions !== 'number' || potentialAttempt.total_questions !== loadedQuestionCount) {
                debugLogger.warn(`[VprAction] Question count mismatch (DB: ${potentialAttempt.total_questions}, Loaded: ${loadedQuestionCount}). Deleting old attempt ID: ${potentialAttempt.id}...`);
                const { error: deleteErr } = await supabaseAdmin.from('vpr_test_attempts').delete().eq('id', potentialAttempt.id);
                if (deleteErr) {
                    // Log but don't necessarily block creation of new attempt
                    logger.error(`[VprAction] Failed to delete outdated attempt ${potentialAttempt.id}: ${deleteErr.message}`);
                } else {
                    debugLogger.log(`[VprAction] Deleted outdated attempt ID: ${potentialAttempt.id}`);
                }
            } else {
                // Attempt seems valid, resume it
                attemptToUse = potentialAttempt;
                debugLogger.log(`[VprAction] Resuming active attempt ID: ${attemptToUse.id}`);
            }
        }

        // Create new attempt if no valid one was found
        if (!attemptToUse) {
            debugLogger.log(`[VprAction] Creating new attempt for variant ${variantToLoad}.`);
            const { data: newAttemptData, error: newAttemptError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .insert({
                    user_id: userId,
                    subject_id: subjectId,
                    variant_number: variantToLoad,
                    total_questions: loadedQuestionCount,
                    last_question_index: 0,
                    score: 0,
                    status: 'in_progress'
                })
                .select()
                .single();
            if (newAttemptError) throw new Error(`Не удалось создать новую попытку: ${newAttemptError.message}`);
            if (!newAttemptData) throw new Error('Не удалось получить данные новой попытки после создания.');
            attemptToUse = newAttemptData;
            debugLogger.log(`[VprAction] New attempt created ID: ${attemptToUse.id}`);
        }

        return {
            attempt: attemptToUse,
            subject: subjectData,
            questions: questionData,
            selectedVariant: variantToLoad,
        };

    } catch (err: any) {
        logger.error(`[VprAction] Error in startOrResumeVprAttempt (user: ${userId}, subject: ${subjectId}):`, err);
        return { attempt: null, subject: null, questions: [], selectedVariant: variantToLoad, error: err.message || 'Произошла неизвестная ошибка при инициализации теста.' };
    }
}

/**
 * Records a user's answer for a specific question in an attempt and updates the score.
 */
export async function recordVprAnswer(attemptId: string, questionId: number, selectedAnswerId: number, isCorrect: boolean, currentScore: number): Promise<RecordAnswerResult> {
    debugLogger.log(`[VprAction] recordVprAnswer called for attempt: ${attemptId}, question: ${questionId}`);
    if (!attemptId || !questionId || selectedAnswerId === null) {
        return { updatedAttempt: null, error: "Attempt ID, Question ID, and Answer ID are required." };
    }

    const newScore = currentScore + (isCorrect ? 1 : 0);

    try {
        // 1. Record the specific answer selection
        const { error: recordError } = await supabaseAdmin
            .from('vpr_attempt_answers')
            .insert({
                attempt_id: attemptId,
                question_id: questionId,
                selected_answer_id: selectedAnswerId,
                was_correct: isCorrect
            });

        // Ignore duplicate errors (e.g., user double-clicks), log others
        if (recordError && recordError.code !== '23505') {
            throw new Error(`Ошибка записи ответа: ${recordError.message}`);
        } else if (recordError?.code === '23505') {
            debugLogger.warn(`[VprAction] Attempt answer already recorded for question ${questionId}. Ignoring duplicate.`);
            // If already recorded, still try to update score just in case, but maybe return existing attempt?
            // For now, proceed to update score.
        } else {
            debugLogger.log("[VprAction] Answer recorded successfully.");
        }

        // 2. Update the attempt's score
        debugLogger.log(`[VprAction] Updating attempt ${attemptId} score to ${newScore}.`);
        const { data: updatedData, error: updateScoreError } = await supabaseAdmin
            .from('vpr_test_attempts')
            .update({ score: newScore }) // Only update score
            .eq('id', attemptId)
            .select()
            .single();

        if (updateScoreError) throw new Error(`Ошибка обновления счета: ${updateScoreError.message}`);
        if (!updatedData) throw new Error("Attempt data not returned after score update.");

        debugLogger.log(`[VprAction] Attempt ${attemptId} score updated.`);
        return { updatedAttempt: updatedData };

    } catch (err: any) {
        logger.error(`[VprAction] Error recording answer (attempt: ${attemptId}, question: ${questionId}):`, err);
        return { updatedAttempt: null, error: err.message || "Не удалось сохранить ответ." };
    }
}

/**
 * Updates the progress (last question index) or completion status of an attempt.
 */
export async function updateVprAttemptProgress(attemptId: string, nextIndex: number, totalQuestions: number): Promise<UpdateProgressResult> {
    debugLogger.log(`[VprAction] updateVprAttemptProgress called for attempt: ${attemptId}, nextIndex: ${nextIndex}`);
    if (!attemptId || nextIndex === null) {
        return { updatedAttempt: null, error: "Attempt ID and next index are required." };
    }

    const isFinishing = nextIndex >= totalQuestions;
    const updates: Partial<VprTestAttempt> = isFinishing
        ? { last_question_index: totalQuestions, completed_at: new Date().toISOString(), status: 'completed' }
        : { last_question_index: nextIndex, status: 'in_progress' };

    try {
        debugLogger.log(`[VprAction] Updating attempt ${attemptId} progress:`, updates);
        const { data: updatedAttempt, error: updateError } = await supabaseAdmin
            .from('vpr_test_attempts')
            .update(updates)
            .eq('id', attemptId)
            .select()
            .single();

        if (updateError) throw new Error(`Ошибка обновления прогресса: ${updateError.message}`);
        if (!updatedAttempt) throw new Error("Attempt not found after progress update.");

        debugLogger.log(`[VprAction] Attempt ${attemptId} progress updated.`);

        // Notify Admin on Normal Completion
        if (isFinishing && updatedAttempt) {
            try {
                const { data: subjectData } = await supabaseAdmin.from('subjects').select('name').eq('id', updatedAttempt.subject_id).single();
                const { data: userData } = await supabaseAdmin.from('users').select('username, full_name').eq('user_id', updatedAttempt.user_id).single();

                const score = updatedAttempt.score ?? 0;
                const total = typeof updatedAttempt.total_questions === 'number' ? updatedAttempt.total_questions : totalQuestions;
                const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : '0.0';
                let durationStr = 'N/A', startTimeStr = 'N/A', endTimeStr = 'N/A';
                if (updatedAttempt.started_at && updatedAttempt.completed_at) { /* ... date formatting ... */ }
                const userIdentifier = userData?.full_name ? `${userData.full_name} (${userData.username || 'no_tg_username'})` : (userData?.username || `ID:${updatedAttempt.user_id}`);

                 const message = `✅ *Тест ВПР Завершен: Детальная Статистика* 📊

👤 *Пользователь:* ID: \`${updatedAttempt.user_id}\`, Имя: ${userIdentifier}
📚 *Тест:* Предмет: *${subjectData?.name || '??'}* (ID: ${updatedAttempt.subject_id}), Вариант: №${updatedAttempt.variant_number}, ID Попытки: \`${updatedAttempt.id}\`
⏱️ *Время:* Длительность: *${durationStr}*
🎯 *Результат:* Баллы: *${score}* из *${total}* (${percentage}%), Статус: \`${updatedAttempt.status || 'completed'}\` ✅`;
                await notifyAdmins(message);
            } catch (notifyError) {
                 logger.error(`[VprAction] Failed to fetch data/notify admin about normal completion for attempt ${attemptId}:`, notifyError);
            }
        }

        return { updatedAttempt: updatedAttempt };

    } catch (err: any) {
        logger.error(`[VprAction] Error updating progress (attempt: ${attemptId}):`, err);
        return { updatedAttempt: null, error: err.message || "Не удалось обновить прогресс." };
    }
}

/**
 * Forces completion of an attempt, usually due to time up.
 */
export async function forceCompleteVprAttempt(attemptId: string, currentScore: number, totalQuestions: number): Promise<UpdateProgressResult> {
    debugLogger.log(`[VprAction] forceCompleteVprAttempt called for attempt: ${attemptId}`);
    if (!attemptId) {
        return { updatedAttempt: null, error: "Attempt ID is required." };
    }

    const updates: Partial<VprTestAttempt> = {
        last_question_index: totalQuestions, // Mark all questions as 'passed'
        completed_at: new Date().toISOString(),
        score: currentScore, // Keep the score as it was
        status: 'time_up'
    };

    try {
        const { data: updatedAttempt, error: updateError } = await supabaseAdmin
            .from('vpr_test_attempts')
            .update(updates)
            .eq('id', attemptId)
            .select()
            .single();

        if (updateError) throw new Error(`Ошибка принудительного завершения: ${updateError.message}`);
        if (!updatedAttempt) throw new Error("Attempt not found after forced completion update.");

        debugLogger.log(`[VprAction] Attempt ${attemptId} forcibly completed.`);

         // Notify Admin on Time Up Completion
         if (updatedAttempt) {
            try {
                const { data: subjectData } = await supabaseAdmin.from('subjects').select('name').eq('id', updatedAttempt.subject_id).single();
                const { data: userData } = await supabaseAdmin.from('users').select('username, full_name').eq('user_id', updatedAttempt.user_id).single();

                const score = updatedAttempt.score ?? 0;
                const total = typeof updatedAttempt.total_questions === 'number' ? updatedAttempt.total_questions : totalQuestions;
                const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : '0.0';
                let durationStr = 'N/A', startTimeStr = 'N/A', endTimeStr = 'N/A';
                if (updatedAttempt.started_at && updatedAttempt.completed_at) { /* ... date formatting ... */ }
                const userIdentifier = userData?.full_name ? `${userData.full_name} (${userData.username || 'no_tg_username'})` : (userData?.username || `ID:${updatedAttempt.user_id}`);

                 const message = `🔔 *Тест ВПР Завершен (Время вышло!)* ⏳

👤 *Пользователь:* ID: \`${updatedAttempt.user_id}\`, Имя: ${userIdentifier}
📚 *Тест:* Предмет: *${subjectData?.name || '??'}* (ID: ${updatedAttempt.subject_id}), Вариант: №${updatedAttempt.variant_number}, ID Попытки: \`${updatedAttempt.id}\`
⏱️ *Время:* Длительность: *${durationStr}*
🎯 *Результат:* Баллы: *${score}* из *${total}* (${percentage}%), Статус: \`${updatedAttempt.status || 'time_up'}\` ⏳`;

                await notifyAdmins(message);
            } catch (notifyError) {
                 logger.error(`[VprAction] Failed to fetch data/notify admin about time-up completion for attempt ${attemptId}:`, notifyError);
            }
        }

        return { updatedAttempt: updatedAttempt };

    } catch (err: any) {
        logger.error(`[VprAction] Error forcing completion (attempt: ${attemptId}):`, err);
        return { updatedAttempt: null, error: err.message || "Не удалось принудительно завершить тест." };
    }
}

/**
 * Deletes active (incomplete) attempts for a user and subject. Used for resetting.
 */
export async function resetVprTest(userId: string, subjectId: number): Promise<ResetResult> {
    debugLogger.log(`[VprAction] resetVprTest called for user: ${userId}, subject: ${subjectId}`);
    if (!userId || !subjectId) {
        return { success: false, error: "User ID and Subject ID are required for reset." };
    }

    try {
        const { error: deleteError } = await supabaseAdmin
            .from('vpr_test_attempts')
            .delete()
            .eq('user_id', userId)
            .eq('subject_id', subjectId)
            .is('completed_at', null); // Target only incomplete attempts

        if (deleteError) {
            // Log the error but maybe don't block the user from trying again
            logger.error(`[VprAction] Error deleting active attempts during reset (user: ${userId}, subject: ${subjectId}):`, deleteError);
            // Return success: false to indicate potential issue, but maybe client can still proceed
            return { success: false, error: `Не удалось удалить предыдущие незавершенные попытки: ${deleteError.message}` };
        }

        debugLogger.log(`[VprAction] Active attempts deleted for user ${userId}, subject ${subjectId}.`);
        return { success: true };

    } catch (err: any) {
        logger.error(`[VprAction] Exception during reset (user: ${userId}, subject: ${subjectId}):`, err);
        return { success: false, error: err.message || "Произошла ошибка при сбросе теста." };
    }
}