"use server";

import { supabaseAnon } from "@/hooks/supabase";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger";
import type { VprTestAttempt, SubjectData, VprQuestionData, VprAnswerData } from "@/app/vpr-test/[subjectId]/page";
import { notifyAdmins } from "@/app/actions"; // Assuming this is your main notify action
// Removed date-fns as timing details are removed from notification

// --- Types for Return Values ---
interface StartAttemptResult {
  success: boolean;
  attempt?: VprTestAttempt | null;
  subject?: SubjectData | null;
  questions?: VprQuestionData[];
  selectedVariant?: number | null;
  error?: string;
}

interface RecordAnswerResult {
  success: boolean;
  updatedAttempt?: VprTestAttempt | null;
  error?: string;
}

interface UpdateProgressResult {
  success: boolean;
  updatedAttempt?: VprTestAttempt | null;
  error?: string;
}

interface ResetResult {
    success: boolean;
    error?: string;
}

// --- Helper Function for Notifications ---
// Consolidate fetching and formatting logic for notifications
async function sendCompletionNotification(
    updatedAttempt: VprTestAttempt,
    totalQuestionsAttempted: number, // Pass total questions for percentage calculation
    isTimeUp: boolean = false
) {
    if (!updatedAttempt?.id) return; // Should not happen if called correctly

    try {
        // Fetch necessary data
        const { data: subjectData } = await supabaseAnon
            .from('subjects')
            .select('name')
            .eq('id', updatedAttempt.subject_id)
            .single();

        const { data: userData } = await supabaseAnon
            .from('users')
            .select('username, full_name')
            .eq('user_id', updatedAttempt.user_id)
            .single();

        // Fetch answers for this attempt, joining with questions for position
        const { data: answersData, error: answersError } = await supabaseAnon
            .from('vpr_attempt_answers')
            .select(`
                was_correct,
                question:vpr_questions ( position )
            `)
            .eq('attempt_id', updatedAttempt.id)
            .order('question(position)', { ascending: true }); // Ensure correct order

        if (answersError) {
            throw new Error(`Failed to fetch attempt answers: ${answersError.message}`);
        }

        // Process answers
        const correctPositions: number[] = [];
        const incorrectPositions: number[] = [];
        (answersData || []).forEach(answer => {
            // Handle potential null join result
            const position = answer.question?.position;
            if (typeof position === 'number') {
                if (answer.was_correct) {
                    correctPositions.push(position);
                } else {
                    incorrectPositions.push(position);
                }
            } else {
                logger.warn(`[Notification] Could not find position for an answer in attempt ${updatedAttempt.id}`);
            }
        });

        // Prepare common message parts
        const userIdentifier = userData?.full_name
            ? `${userData.full_name} (${userData.username || 'no_tg'})`
            : (userData?.username || `ID: ${updatedAttempt.user_id}`);

        const score = updatedAttempt.score ?? 0;
        // Use total_questions from the attempt if available, otherwise fallback
        const total = typeof updatedAttempt.total_questions === 'number'
            ? updatedAttempt.total_questions
            : totalQuestionsAttempted;
        const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : '0.0';

        const subjectName = subjectData?.name || 'Неизвестный Предмет';
        const variantNumber = updatedAttempt.variant_number;

        // Construct the detailed performance message
        let message = `📊 *Результаты ВПР: ${subjectName} (Вар. ${variantNumber})*\n\n`;
        message += `👤 *Пользователь:* ${userIdentifier}\n`;
        message += `🎯 *Итог:* ${score} из ${total} (${percentage}%)\n\n`;

        if (incorrectPositions.length > 0) {
            message += `❌ *Ошибки в вопросах:* № ${incorrectPositions.join(', ')}\n`;
        } else {
            message += `👍 *Ошибок нет!*\n`;
        }

        if (correctPositions.length > 0) {
             message += `✅ *Верные ответы:* № ${correctPositions.join(', ')}\n`;
             // Alternative: Just show count
             // message += `✅ *Верные ответы:* ${correctPositions.length} шт.\n`;
        } else {
             message += `🤔 *Нет верных ответов.*\n`;
        }

        message += `\n*Тест ${isTimeUp ? 'завершен (Время вышло!)' : 'завершен'} ${isTimeUp ? '⏳' : '✅'}*`;

        // Send the notification
        await notifyAdmins(message);
        debugLogger.log(`[VprAction] Sent performance notification for attempt ${updatedAttempt.id}. TimeUp: ${isTimeUp}`);

    } catch (error) {
        logger.error(`[VprAction] Failed to send completion notification for attempt ${updatedAttempt.id}:`, error);
        // Optionally notify admin about the notification failure itself
        // await notifyAdmins(`⚠️ Ошибка отправки уведомления о результатах для попытки ${updatedAttempt.id}`).catch(logger.error);
    }
}


// --- Action Implementations ---

/**
 * Initializes a VPR test: selects a variant, fetches subject/questions,
 * and finds or creates a test attempt record.
 */
export async function startOrResumeVprAttempt(userId: string, subjectId: number): Promise<StartAttemptResult> {
    debugLogger.log(`[VprAction] startOrResumeVprAttempt called for user: ${userId}, subject: ${subjectId}`);
    if (!userId || !subjectId) {
        return { success: false, error: "User ID and Subject ID are required." };
    }

    let variantToLoad: number | null = null;
    let subjectData: SubjectData | null = null;
    let questionData: VprQuestionData[] = [];
    let attemptToUse: VprTestAttempt | null = null;

    try {
        // --- 1. Variant Selection ---
        const { data: variantData, error: variantError } = await supabaseAnon.from('vpr_questions').select('variant_number').eq('subject_id', subjectId);
        if (variantError) throw new Error(`Ошибка получения вариантов: ${variantError.message}`);
        if (!variantData || variantData.length === 0) throw new Error(`Для предмета ID ${subjectId} не найдено ни одного варианта.`);
        const allAvailableVariants = [...new Set(variantData.map(q => q.variant_number))].sort((a, b) => a - b);
        const { data: completedAttemptsData, error: completedError } = await supabaseAnon.from('vpr_test_attempts').select('variant_number').eq('user_id', userId).eq('subject_id', subjectId).not('completed_at', 'is', null);
        if (completedError) throw new Error(`Ошибка получения пройденных попыток: ${completedError.message}`);
        const completedVariants = [...new Set(completedAttemptsData.map(a => a.variant_number))];
        const untriedVariants = allAvailableVariants.filter(v => !completedVariants.includes(v));
        if (untriedVariants.length > 0) { variantToLoad = untriedVariants[Math.floor(Math.random() * untriedVariants.length)]; }
        else if (allAvailableVariants.length > 0) { variantToLoad = allAvailableVariants[Math.floor(Math.random() * allAvailableVariants.length)]; }
        else { throw new Error('Не удалось определить вариант для загрузки (нет доступных вариантов).'); }
        if (variantToLoad === null || isNaN(variantToLoad)) throw new Error("Не удалось выбрать номер варианта.");
        debugLogger.log(`[VprAction] Selected Variant: ${variantToLoad}`);

        // --- 2. Fetch Subject Data ---
        const { data: subjData, error: subjectError } = await supabaseAnon.from('subjects').select('*').eq('id', subjectId).single();
        if (subjectError) throw new Error(`Ошибка загрузки предмета: ${subjectError.message}`);
        if (!subjData) throw new Error(`Предмет с ID ${subjectId} не найден`);
        subjectData = subjData;
        debugLogger.log(`[VprAction] Subject data loaded: ${subjectData.name}`);

        // --- 3. Fetch Questions ---
        const { data: qData, error: questionError } = await supabaseAnon.from('vpr_questions').select(`*, vpr_answers ( * )`).eq('subject_id', subjectId).eq('variant_number', variantToLoad).order('position', { ascending: true });
        if (questionError) throw new Error(`Ошибка загрузки вопросов: ${questionError.message}`);
        if (!qData || qData.length === 0) throw new Error(`Вопросы для предмета '${subjectData.name}', варианта ${variantToLoad} не найдены`);
        questionData = qData;
        const loadedQuestionCount = questionData.length;
        debugLogger.log(`[VprAction] Loaded ${loadedQuestionCount} questions.`);

        // --- 4. Find or Create Attempt ---
        const { data: existingAttempts, error: attemptError } = await supabaseAnon.from('vpr_test_attempts').select('*').eq('user_id', userId).eq('subject_id', subjectId).eq('variant_number', variantToLoad).is('completed_at', null).order('started_at', { ascending: false }).limit(1);
        if (attemptError) throw new Error(`Ошибка поиска попытки: ${attemptError.message}`);
        if (existingAttempts && existingAttempts.length > 0) {
            const potentialAttempt = existingAttempts[0];
            if (typeof potentialAttempt.total_questions !== 'number' || potentialAttempt.total_questions !== loadedQuestionCount) {
                debugLogger.warn(`[VprAction] Question count mismatch... Deleting old attempt ID: ${potentialAttempt.id}...`);
                const { error: deleteErr } = await supabaseAnon.from('vpr_test_attempts').delete().eq('id', potentialAttempt.id);
                if (deleteErr) { logger.error(`[VprAction] Failed to delete outdated attempt ${potentialAttempt.id}: ${deleteErr.message}`); }
                else { debugLogger.log(`[VprAction] Deleted outdated attempt ID: ${potentialAttempt.id}`); }
            } else { attemptToUse = potentialAttempt; debugLogger.log(`[VprAction] Resuming active attempt ID: ${attemptToUse.id}`); }
        }
        if (!attemptToUse) {
            debugLogger.log(`[VprAction] Creating new attempt for variant ${variantToLoad}.`);
            const { data: newAttemptData, error: newAttemptError } = await supabaseAnon.from('vpr_test_attempts').insert({ user_id: userId, subject_id: subjectId, variant_number: variantToLoad, total_questions: loadedQuestionCount, last_question_index: 0, score: 0, status: 'in_progress' }).select().single();
            if (newAttemptError) throw new Error(`Не удалось создать новую попытку: ${newAttemptError.message}`);
            if (!newAttemptData) throw new Error('Не удалось получить данные новой попытки после создания.');
            attemptToUse = newAttemptData; debugLogger.log(`[VprAction] New attempt created ID: ${attemptToUse.id}`);
        }

        return {
            success: true, // Added
            attempt: attemptToUse,
            subject: subjectData,
            questions: questionData,
            selectedVariant: variantToLoad,
        };

    } catch (err: any) {
        logger.error(`[VprAction] Error in startOrResumeVprAttempt (user: ${userId}, subject: ${subjectId}):`, err);
        return {
            success: false, // Added
            attempt: null,
            subject: null,
            questions: [],
            selectedVariant: variantToLoad,
            error: err.message || 'Произошла неизвестная ошибка при инициализации теста.'
        };
    }
}

/**
 * Records a user's answer for a specific question in an attempt and updates the score.
 */
export async function recordVprAnswer(attemptId: string, questionId: number, selectedAnswerId: number, isCorrect: boolean, currentScore: number): Promise<RecordAnswerResult> {
    debugLogger.log(`[VprAction] recordVprAnswer called - attempt: ${attemptId}, question: ${questionId}, answer: ${selectedAnswerId}, correct: ${isCorrect}, currentScore: ${currentScore}`);

    if (!attemptId || !questionId || selectedAnswerId === null || selectedAnswerId === undefined || typeof isCorrect !== 'boolean' || typeof currentScore !== 'number') {
        logger.error(`[VprAction] Invalid input to recordVprAnswer:`, { attemptId, questionId, selectedAnswerId, isCorrect, currentScore });
        return { success: false, error: "Invalid data provided to save answer function." };
    }

    const newScore = currentScore + (isCorrect ? 1 : 0);

    try {
        // --- Step 1: Insert into vpr_attempt_answers ---
        const insertPayload = { attempt_id: attemptId, question_id: questionId, selected_answer_id: selectedAnswerId, was_correct: isCorrect };
        debugLogger.log('[VprAction] Attempting to insert into vpr_attempt_answers:', insertPayload);
        const { error: recordError } = await supabaseAnon.from('vpr_attempt_answers').insert(insertPayload);
        if (recordError && recordError.code !== '23505') {
            logger.error('[VprAction] Insert into vpr_attempt_answers FAILED:', recordError);
            throw new Error(`Ошибка записи ответа: ${recordError.message} (Code: ${recordError.code})`);
        } else if (recordError?.code === '23505') { debugLogger.warn(`[VprAction] Duplicate answer insert attempted...`); }
        else { debugLogger.log(`[VprAction] Insert successful.`); }

        // --- Step 2: Update score in vpr_test_attempts ---
        debugLogger.log(`[VprAction] Attempting to update score for attempt ${attemptId} to ${newScore}.`);
        const { data: updatedData, error: updateScoreError } = await supabaseAnon.from('vpr_test_attempts').update({ score: newScore }).eq('id', attemptId).select().single();
        if (updateScoreError) {
            logger.error('[VprAction] Update score FAILED:', updateScoreError);
            throw new Error(`Ошибка обновления счета: ${updateScoreError.message} (Code: ${updateScoreError.code})`);
        }
        if (!updatedData) { logger.error(`[VprAction] Update score returned no data...`); throw new Error("Attempt data not returned after score update."); }

        debugLogger.log(`[VprAction] Attempt ${attemptId} score updated successfully.`);
        return { success: true, updatedAttempt: updatedData };

    } catch (err: any) {
        logger.error(`[VprAction] Caught error in recordVprAnswer (attempt: ${attemptId}, question: ${questionId}):`, err);
        return { success: false, error: err.message || "Не удалось сохранить ответ (неизвестная ошибка)." };
    }
}

/**
 * Updates the progress (last question index) or completion status of an attempt.
 */
export async function updateVprAttemptProgress(attemptId: string, nextIndex: number, totalQuestions: number): Promise<UpdateProgressResult> {
    debugLogger.log(`[VprAction] updateVprAttemptProgress called for attempt: ${attemptId}, nextIndex: ${nextIndex}`);
    if (!attemptId || nextIndex === null || totalQuestions === null) {
        return { success: false, error: "Attempt ID, next index, and total questions are required." };
    }

    const isFinishing = nextIndex >= totalQuestions;
    const updates: Partial<VprTestAttempt> = isFinishing
        ? { last_question_index: totalQuestions, completed_at: new Date().toISOString(), status: 'completed' }
        : { last_question_index: nextIndex, status: 'in_progress' };

    try {
        debugLogger.log(`[VprAction] Updating attempt ${attemptId} progress:`, updates);
        const { data: updatedAttempt, error: updateError } = await supabaseAnon.from('vpr_test_attempts').update(updates).eq('id', attemptId).select().single();
        if (updateError) throw new Error(`Ошибка обновления прогресса: ${updateError.message}`);
        if (!updatedAttempt) throw new Error("Attempt not found after progress update.");
        debugLogger.log(`[VprAction] Attempt ${attemptId} progress updated.`);

        // --- Notify Admin on Normal Completion (Using Helper) ---
        if (isFinishing) {
            await sendCompletionNotification(updatedAttempt, totalQuestions, false);
        }
        // --- End Notification ---

        return { success: true, updatedAttempt: updatedAttempt };

    } catch (err: any) {
        logger.error(`[VprAction] Error updating progress (attempt: ${attemptId}):`, err);
        return { success: false, error: err.message || "Не удалось обновить прогресс." };
    }
}

/**
 * Forces completion of an attempt, usually due to time up.
 */
export async function forceCompleteVprAttempt(attemptId: string, currentScore: number, totalQuestions: number): Promise<UpdateProgressResult> {
    debugLogger.log(`[VprAction] forceCompleteVprAttempt called for attempt: ${attemptId}`);
    if (!attemptId || currentScore === null || totalQuestions === null) {
        return { success: false, error: "Attempt ID, current score, and total questions are required." };
    }

    const updates: Partial<VprTestAttempt> = { last_question_index: totalQuestions, completed_at: new Date().toISOString(), score: currentScore, status: 'time_up' };

    try {
        const { data: updatedAttempt, error: updateError } = await supabaseAnon.from('vpr_test_attempts').update(updates).eq('id', attemptId).select().single();
        if (updateError) throw new Error(`Ошибка принудительного завершения: ${updateError.message}`);
        if (!updatedAttempt) throw new Error("Attempt not found after forced completion update.");
        debugLogger.log(`[VprAction] Attempt ${attemptId} forcibly completed.`);

        // --- Notify Admin on Time Up Completion (Using Helper) ---
        await sendCompletionNotification(updatedAttempt, totalQuestions, true);
        // --- End Notification ---

        return { success: true, updatedAttempt: updatedAttempt };

    } catch (err: any) {
        logger.error(`[VprAction] Error forcing completion (attempt: ${attemptId}):`, err);
        return { success: false, error: err.message || "Не удалось принудительно завершить тест." };
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
        const { error: deleteError } = await supabaseAnon.from('vpr_test_attempts').delete().eq('user_id', userId).eq('subject_id', subjectId).is('completed_at', null);
        if (deleteError) {
            logger.error(`[VprAction] Error deleting active attempts during reset...`, deleteError);
            return { success: false, error: `Не удалось удалить предыдущие незавершенные попытки: ${deleteError.message}` };
        }
        debugLogger.log(`[VprAction] Active attempts deleted for user ${userId}, subject ${subjectId}.`);
        return { success: true };
    } catch (err: any) {
        logger.error(`[VprAction] Exception during reset...`, err);
        return { success: false, error: err.message || "Произошла ошибка при сбросе теста." };
    }
}