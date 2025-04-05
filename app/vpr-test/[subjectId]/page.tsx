"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Loader2, Zap, HelpCircle, Sparkles, Eye, EyeOff, Lock } from "lucide-react"; // Added icons
// Use client for reads if possible, keep admin for specific tasks like deletion
import { createClient } from "@/hooks/supabase";
import { supabaseAdmin } from "@/hooks/supabase"; // Used for deleting attempts on reset
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger } from "@/lib/debugLogger";
import { useParams, useRouter } from 'next/navigation';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import VPR components (Restoring original paths from context)
import { VprProgressIndicator } from "@/components/VprProgressIndicator";
import { ExplanationDisplay } from "@/components/ExplanationDisplay";
import { VprLoadingIndicator } from "@/components/vpr/VprLoadingIndicator";
import { VprErrorDisplay } from "@/components/vpr/VprErrorDisplay";
import { VprCompletionScreen } from "@/components/vpr/VprCompletionScreen";
import { VprHeader } from "@/components/vpr/VprHeader";
import { VprDescription } from "@/components/vpr/VprDescription";
import { VprQuestionContent } from "@/components/vpr/VprQuestionContent";
import { VprAnswerList } from "@/components/vpr/VprAnswerList";
import { VprTimeUpModal } from "@/components/vpr/VprTimeUpModal";

import { toast } from "sonner";
// Import specific actions needed (Restoring notifyAdmin, adding new dummy action)
import { notifyAdmin } from "@/app/actions";
import { purchaseDisableDummyMode } from "@/app/actions/dummy_actions";

// --- Interfaces --- (Restoring original definitions from context)
interface SubjectData {
    id: number;
    name: string;
    description?: string;
    // Assuming grade_level might be needed based on schema, adding it back if relevant
    grade_level?: number; // Make optional or ensure it's always fetched
}

interface VprQuestionData {
    id: number;
    subject_id: number;
    variant_number: number;
    text: string;
    explanation?: string;
    position: number;
    vpr_answers: VprAnswerData[];
    visual_data?: any | null; // Keep 'any' or define specific type
}

export interface VprAnswerData {
    id: number;
    question_id: number;
    text: string;
    is_correct: boolean;
}

interface VprTestAttempt {
    id: string;
    user_id: string;
    subject_id: number;
    variant_number: number;
    started_at: string;
    completed_at?: string;
    score?: number;
    total_questions: number;
    last_question_index: number;
}
// --- End Interfaces ---

export default function VprTestPage() {
    // --- States ---
    // Using `user` from useAppContext as per context, rename dbUser usage to user
    const { user, token } = useAppContext(); // Use `user` which corresponds to `dbUser`
    const supabase = createClient(token); // Create client instance with token
    const params = useParams();
    const router = useRouter();
    const subjectId = parseInt(params.subjectId as string, 10);

    // .. (keep existing states from context, matching names)
    const [subject, setSubject] = useState<SubjectData | null>(null);
    const [questions, setQuestions] = useState<VprQuestionData[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAttempt, setCurrentAttempt] = useState<VprTestAttempt | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [feedbackExplanation, setFeedbackExplanation] = useState<string | null>(null);
    const [isTestComplete, setIsTestComplete] = useState(false);
    const [finalScore, setFinalScore] = useState<number>(0);
    const [showDescription, setShowDescription] = useState(false);
    const [timerKey, setTimerKey] = useState(Date.now());
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timeLimit] = useState(3600); // 1 hour
    const [timeUpModal, setTimeUpModal] = useState(false);
    const [isCurrentQuestionNonAnswerable, setIsCurrentQuestionNonAnswerable] = useState(false);
    const [resetCounter, setResetCounter] = useState(0);
    const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

    // --- NEW Dummy Mode States ---
    const [isDummyModeActive, setIsDummyModeActive] = useState(false);
    const [isPurchasingDisable, setIsPurchasingDisable] = useState(false);

    // Check if dummy mode is permanently disabled using `user.metadata`
    const isDummyModeGloballyDisabled = user?.metadata?.is_dummy_mode_disabled_by_parent === true;
    // --- End Dummy Mode States ---

    // --- Timer Functions --- (Restoring originals and adding dummy check)
    const handleTimeUp = useCallback(() => {
        debugLogger.log("Timer: Time is up!");
        // Don't trigger time up if dummy mode is active or test already handled
        if (!isTestComplete && !timeUpModal && !isDummyModeActive) {
            setIsTimerRunning(false);
            setShowFeedback(false); // Hide any pending feedback
            setTimeUpModal(true);   // Show the time up modal
        } else if (isDummyModeActive) {
            debugLogger.log("Timer: Time up ignored, Dummy Mode is active.");
        }
    }, [isTestComplete, timeUpModal, isDummyModeActive]); // Add isDummyModeActive dependency

    const completeTestDueToTime = useCallback(async () => {
         setTimeUpModal(false);
         if (!currentAttempt || isSaving || isTestComplete) return;
         debugLogger.log("Completing test due to time up for attempt:", currentAttempt.id);
         setIsSaving(true);
         try {
             const currentScore = currentAttempt.score || 0;
             const updates: Partial<VprTestAttempt> = {
                 last_question_index: questions.length, // Mark all questions as 'passed'
                 completed_at: new Date().toISOString(),
                 score: currentScore // Keep the score as it was
             };
             // Use supabaseAdmin as per original context for critical updates? Or stick to client?
             // Let's use supabaseAdmin for consistency with original context's completion logic
             const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                 .from('vpr_test_attempts')
                 .update(updates)
                 .eq('id', currentAttempt.id)
                 .select()
                 .single();

              if (updateError) throw updateError;
              if (!updatedAttempt) throw new Error("Attempt not found after forced completion update.");

              // --- Notify Admin (Time up) - Using `user` from context ---
              if (user && subject && updatedAttempt) {
                const message = `🔔 Тест ВПР завершен (Время вышло)!
Пользователь: ${user.username || user.user_id} (${user.user_id})
Предмет: ${subject.name}
Вариант: ${updatedAttempt.variant_number}
Результат: ${updatedAttempt.score ?? 0} из ${updatedAttempt.total_questions}`;
                  try {
                      await notifyAdmin(message); // Use imported notifyAdmin
                      debugLogger.log("Admin notified of time-up completion.");
                  } catch (notifyError) {
                      debugLogger.error("Failed to notify admin about time-up completion:", notifyError);
                  }
              } else {
                  debugLogger.warn("Could not notify admin (time-up): missing user, subject, or attempt data.");
              }
              // --- End Notify Admin ---

              setCurrentAttempt(updatedAttempt);
              setIsTestComplete(true);
              setFinalScore(updatedAttempt.score ?? 0);
              toast.warning("Время вышло! Тест завершен.", { duration: 5000 });
         } catch (err: any) {
             debugLogger.error("Error forcing test completion:", err);
             setError(`Не удалось завершить тест (${err.message || 'Неизвестная ошибка'}). Попробуйте обновить страницу.`);
             toast.error("Ошибка принудительного завершения теста.");
         } finally {
            setIsSaving(false);
         }
    }, [currentAttempt, isSaving, isTestComplete, questions.length, user, subject]); // Keep dependencies


    // --- Data Fetching & Attempt Handling (Restoring context's useEffect logic) ---
    useEffect(() => {
        debugLogger.log(`useEffect running. Reset Counter: ${resetCounter}`);

        // Use `user.user_id` as per context
        if (!user?.user_id || !token || !subjectId || isNaN(subjectId)) {
            if (!user?.user_id) {
                 // Let AppContext handle redirection or show loading/error
                 debugLogger.warn("No user ID found in AppContext yet.");
                 // Don't redirect immediately, show loading or wait
                 // setError("Ожидание данных пользователя..."); // Or keep loading
                 // return; // Wait for user context
                 // Redirecting as per original context if no user
                 router.push('/login');
                 return;
            }
            else if (isNaN(subjectId)) {
                 setError("Неверный ID предмета");
                 setIsLoading(false);
            }
            return;
        }

        debugLogger.log(`Initializing test for Subject ID: ${subjectId}, User ID: ${user.user_id}`);
        let isMounted = true;
        // Use client with token for reads initially
        const supabaseClient = createClient(token);

        const initializeTest = async () => {
            if (!isMounted) {
                debugLogger.log("InitializeTest aborted: component unmounted.");
                return;
            }
            debugLogger.log("InitializeTest starting...");
            // Reset states thoroughly
            setIsLoading(true); setError(null); setShowDescription(false);
            setIsTestComplete(false); setShowFeedback(false); setSelectedAnswerId(null);
            setIsTimerRunning(false); setTimerKey(Date.now()); setTimeUpModal(false);
            setIsCorrect(false); setFeedbackExplanation(null); setFinalScore(0);
            setCurrentQuestionIndex(0); setCurrentAttempt(null); setQuestions([]);
            setIsCurrentQuestionNonAnswerable(false); setSelectedVariant(null);
            setIsDummyModeActive(false); // Reset dummy mode on init/reset

            let variantToLoad: number | null = null;

            try {
                // --- Variant Selection Logic (using supabaseClient) ---
                debugLogger.log("Selecting variant...");
                // Using supabaseClient for reads
                const { data: variantData, error: variantError } = await supabaseClient
                    .from('vpr_questions')
                    .select('variant_number')
                    .eq('subject_id', subjectId);

                 if (!isMounted) return;
                 if (variantError) throw new Error(`Ошибка получения вариантов: ${variantError.message}`);
                 if (!variantData || variantData.length === 0) throw new Error('Для этого предмета не найдено ни одного варианта.');
                 const allAvailableVariants = [...new Set(variantData.map(q => q.variant_number))].sort((a,b) => a - b);

                 // Using supabaseClient for reads
                 const { data: completedAttemptsData, error: completedError } = await supabaseClient
                     .from('vpr_test_attempts')
                     .select('variant_number')
                     .eq('user_id', user.user_id) // Use user.user_id
                     .eq('subject_id', subjectId)
                     .not('completed_at', 'is', null);
                  if (!isMounted) return;
                  if (completedError) throw new Error(`Ошибка получения пройденных попыток: ${completedError.message}`);
                  const completedVariants = [...new Set(completedAttemptsData.map(a => a.variant_number))];
                  const untriedVariants = allAvailableVariants.filter(v => !completedVariants.includes(v));
                  if (untriedVariants.length > 0) { variantToLoad = untriedVariants[Math.floor(Math.random() * untriedVariants.length)]; }
                  else if (allAvailableVariants.length > 0) { variantToLoad = allAvailableVariants[Math.floor(Math.random() * allAvailableVariants.length)]; }
                  else { throw new Error('Не удалось определить вариант для загрузки.'); }
                  setSelectedVariant(variantToLoad);
                  if (!variantToLoad) throw new Error("Variant selection failed.");

                // --- Fetch Subject Data (using supabaseClient) ---
                debugLogger.log("Fetching subject data...");
                const { data: subjectData, error: subjectError } = await supabaseClient
                    .from('subjects')
                    .select('*') // Select all fields, including potential grade_level
                    .eq('id', subjectId)
                    .single();
                 if (!isMounted) return;
                 if (subjectError || !subjectData) throw subjectError || new Error('Предмет не найден');
                 setSubject(subjectData);
                 debugLogger.log("Subject data loaded:", subjectData.name);

                // --- Fetch Questions (using supabaseClient) ---
                debugLogger.log(`Fetching questions for selected variant ${variantToLoad}...`);
                const { data: questionData, error: questionError } = await supabaseClient
                    .from('vpr_questions')
                    .select(`*, vpr_answers ( * )`) // Fetch nested answers
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantToLoad)
                    .order('position', { ascending: true });
                 if (!isMounted) return;
                 if (questionError || !questionData || questionData.length === 0) throw questionError || new Error(`Вопросы для варианта ${variantToLoad} не найдены`);
                 setQuestions(questionData);
                 debugLogger.log(`Loaded ${questionData.length} questions.`);

                // --- Find or Create Attempt (using supabaseClient for read, supabaseAdmin for delete, client for insert) ---
                debugLogger.log(`Finding active test attempt for variant ${variantToLoad}...`);
                const { data: existingAttempts, error: attemptError } = await supabaseClient // Use client
                    .from('vpr_test_attempts')
                    .select('*')
                    .eq('user_id', user.user_id) // Use user.user_id
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantToLoad)
                    .is('completed_at', null)
                    .order('started_at', { ascending: false })
                    .limit(1);
                 if (!isMounted) return;
                 if (attemptError) throw new Error(`Ошибка поиска попытки: ${attemptError.message}`);

                let attemptToUse: VprTestAttempt | null = null;

                if (existingAttempts && existingAttempts.length > 0) {
                    const potentialAttempt = existingAttempts[0];
                    if (potentialAttempt.total_questions !== questionData.length) {
                        debugLogger.warn(`Question count mismatch for variant ${variantToLoad}. Active attempt outdated. Deleting old and creating new.`);
                        try {
                            // Use supabaseAdmin for delete as per original reset logic
                            const { error: deleteErr } = await supabaseAdmin.from('vpr_test_attempts').delete().eq('id', potentialAttempt.id);
                            if (deleteErr) throw deleteErr;
                            debugLogger.log(`Deleted outdated attempt ID: ${potentialAttempt.id}`);
                        } catch (deleteErr: any) {
                             debugLogger.error("Failed to delete outdated attempt:", deleteErr);
                             toast.error("Не удалось удалить старую попытку, возможны несоответствия.");
                             // Continue to create a new one
                        }
                    } else {
                        attemptToUse = potentialAttempt;
                        debugLogger.log(`Resuming active attempt ID: ${attemptToUse.id} for variant ${variantToLoad}, Last Index: ${attemptToUse.last_question_index}`);
                        setFinalScore(attemptToUse.score || 0); // Restore score on resume
                    }
                } else {
                     debugLogger.log(`No active attempt found in DB for variant ${variantToLoad}.`);
                }

                // Create new attempt if needed (using client, assuming RLS allows)
                if (!attemptToUse) {
                     debugLogger.log(`Creating new attempt for variant ${variantToLoad}.`);
                     // Use client for insert (check RLS policies)
                     const { data: newAttemptData, error: newAttemptError } = await supabaseClient
                         .from('vpr_test_attempts')
                         .insert({ user_id: user.user_id, subject_id: subjectId, variant_number: variantToLoad, total_questions: questionData.length, last_question_index: 0, score: 0 })
                         .select()
                         .single();
                     if (!isMounted) return;
                     if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                     attemptToUse = newAttemptData;
                     debugLogger.log(`New attempt created ID: ${attemptToUse.id}`);
                     setFinalScore(0); // Reset score for new attempt
                }

                setCurrentAttempt(attemptToUse);
                const resumeIndex = Math.max(0, Math.min(attemptToUse.last_question_index, questionData.length - 1));
                // Ensure resumeIndex doesn't exceed actual questions length if attempt is somehow ahead
                 const validResumeIndex = Math.min(resumeIndex, questionData.length > 0 ? questionData.length - 1 : 0);

                 // If attempt is already completed, jump to the end state immediately
                 if (attemptToUse.completed_at) {
                    debugLogger.log("Attempt already completed, setting completion state.");
                    setCurrentQuestionIndex(questionData.length); // Go past last question index
                    setIsTestComplete(true);
                    setFinalScore(attemptToUse.score ?? 0);
                    setIsTimerRunning(false);
                 } else {
                    setCurrentQuestionIndex(validResumeIndex);
                    debugLogger.log(`Setting current question index to: ${validResumeIndex}`);

                    const currentQ = questionData[validResumeIndex];
                    const currentAnswers = currentQ?.vpr_answers || [];
                    const isNonAnswerable = currentAnswers.length > 0 && currentAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
                    setIsCurrentQuestionNonAnswerable(isNonAnswerable);
                    debugLogger.log(`Is current question (${validResumeIndex}) non-answerable? ${isNonAnswerable}`);

                    debugLogger.log("Attempt is active. Starting timer.");
                    setIsTimerRunning(true); // Start timer only for active attempts
                 }

            } catch (err: any) {
                if (!isMounted) return;
                debugLogger.error("Error during test initialization:", err);
                setError(err.message || 'Произошла ошибка при загрузке теста');
                setIsTimerRunning(false);
            } finally {
                 if (isMounted) {
                    setIsLoading(false);
                    debugLogger.log("InitializeTest finished.");
                 }
            }
        };

        // Removing createNewAttempt helper as insert is done directly above
        initializeTest();

        return () => {
            isMounted = false;
            debugLogger.log("useEffect cleanup: component unmounting or dependencies changed.");
        };
     }, [user, subjectId, resetCounter, router, token]); // Keep dependencies
    // --- End Data Fetching ---


    // --- Answer Handling (Restoring context's version + dummy check) ---
    const handleAnswer = useCallback(async (selectedAnswer: VprAnswerData) => {
        // --- Add check for Dummy Mode ---
        if (isDummyModeActive) {
            debugLogger.log("Answer clicked while Dummy Mode is active. Ignoring.");
            toast.info("В Режиме Подсказок выбор ответа отключен.", { duration: 2000 });
            return;
        }
        // --- End Dummy Mode Check ---

        // Standard checks from context
        if (!currentAttempt || showFeedback || isTestComplete || isSaving || !isTimerRunning || timeUpModal || !questions[currentQuestionIndex]) return;

        debugLogger.log(`Handling answer selection: Answer ID ${selectedAnswer.id} for Question ID ${questions[currentQuestionIndex].id} (Variant: ${currentAttempt.variant_number})`);
        setIsTimerRunning(false); // Pause timer on answer selection
        setIsSaving(true);
        setSelectedAnswerId(selectedAnswer.id);

        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct);
        setFeedbackExplanation(questions[currentQuestionIndex]?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true); // Show normal feedback

        const scoreIncrement = correct ? 1 : 0;
        const newScore = (currentAttempt.score || 0) + scoreIncrement;
        debugLogger.log(`Answer Correct: ${correct}. Proposed Score: ${newScore}`);

        // Use supabaseAdmin for DB operations as per original context
        try {
            debugLogger.log("Recording answer to DB using supabaseAdmin...");
            const { error: recordError } = await supabaseAdmin.from('vpr_attempt_answers').insert({ attempt_id: currentAttempt.id, question_id: questions[currentQuestionIndex].id, selected_answer_id: selectedAnswer.id, was_correct: correct });
            // Игнорируем ошибку дубликата (23505), но выводим остальные
            if (recordError && recordError.code !== '23505') throw new Error(`Ошибка записи ответа: ${recordError.message}`);
            if (recordError?.code === '23505') debugLogger.warn("Attempt answer already recorded."); else debugLogger.log("Answer recorded successfully.");

            debugLogger.log("Updating attempt score in DB using supabaseAdmin...");
            const { data: updatedData, error: updateScoreError } = await supabaseAdmin.from('vpr_test_attempts').update({ score: newScore }).eq('id', currentAttempt.id).select().single();
            if (updateScoreError) throw new Error(`Ошибка обновления счета: ${updateScoreError.message}`);
            if (!updatedData) throw new Error("Attempt data not returned after score update.");

            setCurrentAttempt(updatedData); // Update local state with confirmed score from DB
            debugLogger.log("Attempt score updated successfully.");
        } catch (err: any) {
            debugLogger.error("Error saving answer/score:", err);
            toast.error(`Не удалось сохранить результат: ${err.message}`);
            // Keep feedback showing even if save fails
        } finally {
             setIsSaving(false);
             // Timer remains paused until 'Next' is clicked
        }
    }, [currentAttempt, showFeedback, isTestComplete, isSaving, isTimerRunning, timeUpModal, questions, currentQuestionIndex, isDummyModeActive, token]); // Added isDummyModeActive, token


    // --- Navigation Logic (Restoring context's version + dummy logic) ---
    const handleNextQuestion = useCallback(async (isSkip: boolean = false) => {
        // Standard checks from context
        if (!currentAttempt || isSaving || isTestComplete || timeUpModal || !questions.length) return;

        const currentQIndex = currentQuestionIndex;
        const nextIndex = currentQIndex + 1;
        const isFinishing = nextIndex >= questions.length;
        debugLogger.log(`Handling next question. From: ${currentQIndex}, To: ${nextIndex}, Finishing: ${isFinishing}, Skip: ${isSkip}, DummyActive: ${isDummyModeActive}`);

        setIsSaving(true);
        // Reset feedback/selection states
        setShowFeedback(false); setSelectedAnswerId(null); setIsCorrect(false); setFeedbackExplanation(null);
        // Keep dummy mode state as it is unless explicitly changed

        let nextIsNonAnswerable = false;
        if (!isFinishing) {
            const nextQ = questions[nextIndex]; const nextAnswers = nextQ?.vpr_answers || [];
            nextIsNonAnswerable = nextAnswers.length > 0 && nextAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
            debugLogger.log(`Next question (${nextIndex}) non-answerable? ${nextIsNonAnswerable}`);
        }

        // Use supabaseAdmin for updates as per original context
        try {
            const updates: Partial<VprTestAttempt> = isFinishing
                ? { last_question_index: questions.length, completed_at: new Date().toISOString() }
                : { last_question_index: nextIndex };
            debugLogger.log(`Updating attempt progress/completion in DB to index: ${updates.last_question_index} using supabaseAdmin`);

            const { data: updatedAttempt, error: updateError } = await supabaseAdmin.from('vpr_test_attempts').update(updates).eq('id', currentAttempt.id).select().single();
            if (updateError) throw new Error(`Ошибка обновления прогресса: ${updateError.message}`);
            if (!updatedAttempt) throw new Error("Attempt not found after update.");

            setCurrentAttempt(updatedAttempt); // Update with DB data *first*

            if (!isFinishing) {
                setCurrentQuestionIndex(nextIndex);
                setIsCurrentQuestionNonAnswerable(nextIsNonAnswerable);
                // Timer logic: Run only if not finishing AND dummy mode is OFF
                if (!isDummyModeActive) {
                    setIsTimerRunning(true);
                    debugLogger.log(`Moved to question index: ${nextIndex}. Timer restarted.`);
                } else {
                    setIsTimerRunning(false); // Ensure timer is paused if dummy mode is ON
                    debugLogger.log(`Moved to question index: ${nextIndex}. Timer remains paused (Dummy Mode Active).`);
                }
            } else {
                // Test completion logic (restored from context)
                setIsCurrentQuestionNonAnswerable(false);
                setIsTimerRunning(false); // Ensure timer stops on completion
                setIsTestComplete(true);
                setFinalScore(updatedAttempt.score ?? 0);
                debugLogger.log("Test marked as complete. Final Score from DB:", updatedAttempt.score);
                toast.success("Тест завершен!", { duration: 4000 });

                // --- Notify Admin (Normal Completion) - Using `user` from context ---
                if (user && subject && updatedAttempt) {
                    const message = `✅ Тест ВПР завершен!
Пользователь: ${user.username || user.user_id} (${user.user_id})
Предмет: ${subject.name}
Вариант: ${updatedAttempt.variant_number}
Результат: ${updatedAttempt.score ?? 0} из ${updatedAttempt.total_questions}`;
                    try {
                        await notifyAdmin(message); // Use imported notifyAdmin
                        debugLogger.log("Admin notified of normal test completion.");
                    } catch (notifyError) {
                        debugLogger.error("Failed to notify admin about normal completion:", notifyError);
                    }
                } else {
                    debugLogger.warn("Could not notify admin (normal completion): missing user, subject, or attempt data.");
                }
                // --- End Notify Admin ---
            }
        } catch(err: any) {
            debugLogger.error("Error updating attempt on navigation:", err);
            setError(`Не удалось сохранить прогресс (${err.message}). Попробуйте обновить страницу.`);
            toast.error("Ошибка сохранения прогресса.");
            // Stop timer if navigation failed before completion
            if (!isFinishing) setIsTimerRunning(false);
        } finally {
            setIsSaving(false);
        }
    }, [currentAttempt, isSaving, isTestComplete, timeUpModal, questions, currentQuestionIndex, user, subject, isDummyModeActive]); // Added isDummyModeActive


    // --- Reset Logic (Restoring context's version + dummy reset) ---
     const resetTest = useCallback(async () => {
         if (isSaving) {
             toast.warning("Подождите, идет сохранение...");
             return;
         }
         debugLogger.log("Reset button clicked.");
         setIsLoading(true);

         try {
             setIsTimerRunning(false);
             setIsDummyModeActive(false); // Ensure dummy mode is off on reset

             // Using user.user_id and supabaseAdmin for delete as per context
             if (user?.user_id && subjectId) {
                 debugLogger.log(`Attempting to delete ANY active attempt for subject ${subjectId} and user ${user.user_id} before reset using supabaseAdmin.`);
                 const { error: deleteError } = await supabaseAdmin
                     .from('vpr_test_attempts')
                     .delete()
                     .eq('user_id', user.user_id) // Use user.user_id
                     .eq('subject_id', subjectId)
                     .is('completed_at', null);

                 if (deleteError) {
                      debugLogger.error("Error deleting active attempt(s) during reset:", deleteError);
                      toast.warning(`Не удалось удалить предыдущую попытку: ${deleteError.message}`);
                 } else {
                      debugLogger.log("Any active attempts for this subject/user deleted successfully.");
                 }
             } else {
                  debugLogger.warn("Cannot delete active attempt during reset: missing user ID or subject ID.");
             }

             // Reset frontend state fully
             setCurrentAttempt(null); setQuestions([]); setCurrentQuestionIndex(0);
             setError(null); setSelectedVariant(null); setSubject(null);
             setFinalScore(0); setIsTestComplete(false); setShowFeedback(false);
             setSelectedAnswerId(null); setTimeUpModal(false);

             toast.info("Сброс теста...", { duration: 1500});
             // Increment counter to trigger useEffect reload
             setResetCounter(prev => prev + 1);
             debugLogger.log("Reset counter incremented, useEffect will re-run.");

         } catch (err: any) {
              debugLogger.error("Error during reset process:", err);
              setError(`Ошибка сброса теста: ${err.message}`);
              setIsLoading(false); // Stop loading on error
         }
         // Let useEffect handle setting isLoading to false after re-fetch
     }, [isSaving, user?.user_id, subjectId]); // Dependency on user.user_id


    // --- NEW: Purchase Disabling of Dummy Mode ---
    const handlePurchaseDisableDummy = async () => {
        if (!user?.user_id) { // Use user.user_id
            toast.error("Не удалось определить пользователя для покупки.");
            return;
        }
        if (isPurchasingDisable) return;

        debugLogger.log("Attempting to purchase DISABLE Dummy Mode feature...");
        setIsPurchasingDisable(true);
        toast.loading("Отправка запроса на покупку...", { id: "purchase-disable-dummy" });

        try {
            // Use user.user_id
            const result = await purchaseDisableDummyMode(user.user_id);
            if (result.success) {
                if (result.alreadyDisabled) {
                    toast.success("Режим подсказок уже отключен для этого пользователя.", { id: "purchase-disable-dummy" });
                    // AppContext should update user eventually, maybe force refresh context?
                } else {
                    toast.success("Счет на отключение отправлен в Telegram! Пожалуйста, оплатите его там.", { id: "purchase-disable-dummy", duration: 5000 });
                }
            } else {
                throw new Error(result.error || "Неизвестная ошибка при покупке отключения.");
            }
        } catch (error: any) {
            debugLogger.error("Failed to initiate disable dummy mode purchase:", error);
            toast.error(`Ошибка покупки: ${error.message}`, { id: "purchase-disable-dummy" });
        } finally {
            setIsPurchasingDisable(false);
        }
    };
    // --- End Purchase Disable ---

    // --- Toggle Dummy Mode ---
    const toggleDummyMode = () => {
        if (isDummyModeGloballyDisabled) {
             toast.info("Режим подсказок отключен родителем.", { duration: 3000 });
             return;
        }
        if (isTestComplete || timeUpModal) return; // Don't allow toggle if test finished

        setIsDummyModeActive(prev => {
            const newState = !prev;
            debugLogger.log(`Dummy Mode Toggled: ${newState}`);
            if (newState) {
                // Turning ON Dummy Mode
                setIsTimerRunning(false); // Pause timer
                setShowFeedback(false); // Hide normal feedback if it was shown
                setSelectedAnswerId(null); // Clear selection
                toast.info("🧠 Режим Подсказок ВКЛ", { duration: 1500 });
            } else {
                // Turning OFF Dummy Mode
                // Restart timer only if the test is ongoing and not showing feedback
                if (!isTestComplete && !showFeedback) {
                     setIsTimerRunning(true);
                }
                toast.info("💪 Режим Подсказок ВЫКЛ", { duration: 1500 });
            }
            return newState;
        });
    };
    // --- End Toggle Dummy Mode ---

    // --- Rendering Logic (Restoring structure from context + merging new UI) ---
    // Loading state from context
    if (isLoading && !currentAttempt) return <VprLoadingIndicator />; // Adjusted condition slightly
    // Error state from context
    if (error && !currentAttempt) return <VprErrorDisplay error={error} onRetry={resetTest} />; // Adjusted condition
    // Completion screen from context
    if (isTestComplete) {
        return ( <VprCompletionScreen
                    subjectName={subject?.name}
                    variantNumber={currentAttempt?.variant_number}
                    finalScore={finalScore}
                    // Use attempt's total questions if available, fallback to question length
                    totalQuestions={currentAttempt?.total_questions ?? questions.length}
                    onReset={resetTest}
                    onGoToList={() => router.push('/vpr-tests')} /> );
    }
    // Safeguard check from context
    if (!isLoading && (!currentAttempt || questions.length === 0 || !selectedVariant || !subject)) {
         return <VprErrorDisplay error={error || "Критические данные теста (предмет, вариант или вопросы) не загружены. Попробуйте сбросить."} onRetry={resetTest} />;
    }

    const currentQuestionData = questions?.[currentQuestionIndex];
    // Add check for currentQuestionData validity
    if (!currentQuestionData) {
        debugLogger.warn("currentQuestionData is undefined for index:", currentQuestionIndex);
        // Avoid rendering components that rely on it if it's missing
        return <VprLoadingIndicator text="Загрузка вопроса..." />;
        // Or show error if this state persists
        // return <VprErrorDisplay error="Не удалось загрузить данные текущего вопроса." onRetry={resetTest} />;
    }

    const answersForCurrent = currentQuestionData.vpr_answers || [];
    const showSavingOverlay = isSaving;

    // Determine if explanation should be shown (dummy mode OR normal feedback)
    const shouldShowExplanation = isDummyModeActive || showFeedback;
    const correctAnswer = isDummyModeActive ? answersForCurrent.find(a => a.is_correct) : null;
    const explanationToShow = isDummyModeActive
                                ? (currentQuestionData?.explanation || "Объяснение отсутствует.") // Show general explanation in dummy mode
                                : feedbackExplanation; // Normal feedback explanation
    const explanationIsCorrectState = isDummyModeActive ? true : isCorrect;


    return (
        <TooltipProvider>
            {/* Using motion.div key from context */}
            <motion.div
                key={currentAttempt.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen bg-page-gradient text-light-text flex flex-col items-center pt-6 pb-10 px-4"
            >
                <VprTimeUpModal show={timeUpModal} onConfirm={completeTestDueToTime} />

                {/* Using layout structure from context */}
                <div className="max-w-3xl w-full bg-dark-card shadow-xl rounded-2xl p-5 md:p-8 flex-grow flex flex-col border border-brand-blue/20 relative">
                     {showSavingOverlay && (
                        <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-sm flex items-center justify-center z-40 rounded-2xl">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                            <span className="ml-3 text-light-text">Сохранение...</span>
                        </div>
                     )}

                    {/* --- HEADER AREA (Merging VprHeader and Dummy Toggle) --- */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-y-3">
                        {/* VprHeader component as in context */}
                        <VprHeader
                            subjectName={subject?.name}
                            variantNumber={selectedVariant} // Pass variant number
                            showDescriptionButton={!!subject?.description}
                            isDescriptionShown={showDescription}
                            onToggleDescription={() => setShowDescription(!showDescription)}
                            timerKey={timerKey}
                            timeLimit={timeLimit}
                            onTimeUp={handleTimeUp}
                            // Adjust timer running condition based on merged logic
                            isTimerRunning={isTimerRunning && !isSaving && !isTestComplete && !timeUpModal && !isDummyModeActive}
                        />
                        {/* --- Dummy Mode Toggle & Purchase Button --- */}
                        <div className="flex items-center space-x-3 self-center sm:self-auto">
                             <Tooltip>
                                <TooltipTrigger asChild>
                                     <div className="flex items-center space-x-2">
                                         {isDummyModeGloballyDisabled ? (
                                            <Lock className="h-5 w-5 text-yellow-500" />
                                         ) : (
                                            <Sparkles className={`h-5 w-5 transition-colors ${isDummyModeActive ? 'text-yellow-400' : 'text-gray-500'}`} />
                                         )}
                                        <Switch
                                            id="dummy-mode-toggle"
                                            checked={isDummyModeActive}
                                            onCheckedChange={toggleDummyMode}
                                            disabled={isDummyModeGloballyDisabled || isTestComplete || timeUpModal || isSaving}
                                            aria-label="Режим Подсказок"
                                            className="data-[state=checked]:bg-yellow-500 data-[state=unchecked]:bg-gray-600"
                                        />
                                        <label htmlFor="dummy-mode-toggle" className={`text-sm font-medium transition-colors ${isDummyModeActive ? 'text-yellow-400' : 'text-gray-400'} ${isDummyModeGloballyDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                             Подсказки
                                         </label>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {isDummyModeGloballyDisabled
                                        ? <p>Режим подсказок отключен родителем.</p>
                                        : <p>{isDummyModeActive ? 'Выключить' : 'Включить'} режим подсказок (показать правильный ответ)</p>
                                    }
                                </TooltipContent>
                            </Tooltip>
                            {/* Show button to disable if not already disabled */}
                            {!isDummyModeGloballyDisabled && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePurchaseDisableDummy}
                                            disabled={isPurchasingDisable || !user?.user_id}
                                            className="border-red-500/50 text-red-400 hover:bg-red-900/30 hover:text-red-300 px-2 py-1 h-auto"
                                        >
                                            {isPurchasingDisable ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4"/>}
                                            <span className="ml-1 text-xs hidden sm:inline">Отключить</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Купить опцию для родителя: <br/> навсегда отключить режим подсказок.</p>
                                    </TooltipContent>
                                </Tooltip>
                             )}
                        </div>
                    </div>
                    {/* --- END HEADER AREA --- */}

                    <VprDescription description={subject?.description} show={showDescription} />
                    <VprProgressIndicator current={currentQuestionIndex} total={questions.length} />

                    {/* Question and Answer area with animation */}
                     <motion.div
                        key={currentQuestionIndex} // Animate when question changes
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                         <VprQuestionContent
                             questionData={currentQuestionData} // Pass the whole data object
                             questionNumber={currentQuestionIndex + 1}
                             totalQuestions={questions.length}
                         />
                         <VprAnswerList
                            answers={answersForCurrent}
                            selectedAnswerId={selectedAnswerId}
                            showFeedback={showFeedback} // For normal feedback
                            timeUpModal={timeUpModal}
                            handleAnswer={handleAnswer}
                            isDummyModeActive={isDummyModeActive} // Pass dummy state
                        />
                     </motion.div>

                     {/* Non-answerable question skip button (restored from context) */}
                     {isCurrentQuestionNonAnswerable && !showFeedback && !isTestComplete && !timeUpModal && !isDummyModeActive && (
                         <div className="mt-4 text-center">
                             <button
                                onClick={() => handleNextQuestion(true)} // Skip non-answerable question
                                disabled={isSaving}
                                className="bg-brand-purple text-white px-6 py-2 rounded-lg font-semibold hover:bg-brand-purple/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
                             >
                                 Пропустить / Далее
                             </button>
                             <p className="text-xs text-gray-400 mt-2">Этот вопрос требует рисунка, ввода текста или анализа изображения.</p>
                         </div>
                     )}

                     {/* Explanation Display (Animated, shown in dummy mode or normal feedback) */}
                     <AnimatePresence>
                        {shouldShowExplanation && (
                            <ExplanationDisplay
                                key={`exp-${currentQuestionIndex}`} // Ensure re-render on question change
                                explanation={explanationToShow}
                                isCorrect={explanationIsCorrectState} // Contextual correctness
                                onNext={() => handleNextQuestion(false)} // Normal next action
                                isLastQuestion={currentQuestionIndex >= questions.length - 1}
                                isDummyModeExplanation={isDummyModeActive} // Indicate if shown due to dummy mode
                            />
                        )}
                     </AnimatePresence>

                    {/* Reset button (restored from context) */}
                    <div className="mt-auto pt-6 text-center">
                        <button
                            onClick={resetTest}
                            disabled={isSaving || isLoading}
                            className="text-xs text-gray-500 hover:text-brand-pink underline transition-colors flex items-center justify-center gap-1 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                             <RotateCcw className="h-3 w-3"/>
                             Сбросить и начать заново
                        </button>
                    </div>
                </div>
            </motion.div>
        </TooltipProvider>
    );
}