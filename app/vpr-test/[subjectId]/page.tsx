"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Loader2, Zap, HelpCircle, Sparkles, Eye, EyeOff, Lock } from "lucide-react"; // Added icons

// Import Supabase clients (using admin client for simplicity/consistency as per context)
import { supabaseAdmin } from "@/hooks/supabase"; // Used for most DB interactions in this component
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

// Import VPR components
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
// Import specific actions needed
import { notifyAdmin } from "@/app/actions"; // Use the simpler notifyAdmin for direct string messages
import { purchaseDisableDummyMode } from "@/app/actions/dummy_actions";

// Optional: Use a date library for cleaner duration formatting in notifications
import { formatDistanceStrict } from 'date-fns';
import { ru } from 'date-fns/locale';

// --- Interfaces ---
interface SubjectData {
    id: number;
    name: string;
    description?: string;
    grade_level?: number; // Optional grade level
}

interface VprQuestionData {
    id: number;
    subject_id: number;
    variant_number: number;
    text: string;
    explanation?: string;
    position: number;
    vpr_answers: VprAnswerData[];
    visual_data?: any | null; // Can be a structured type or any
}

export interface VprAnswerData {
    id: number;
    question_id: number;
    text: string;
    is_correct: boolean;
}

interface VprTestAttempt {
    id: string; // UUID typically
    user_id: string;
    subject_id: number;
    variant_number: number;
    started_at: string; // ISO timestamp string
    completed_at?: string | null; // ISO timestamp string or null
    score?: number | null;
    total_questions: number;
    last_question_index: number;
    status?: string | null; // Optional status field (e.g., 'completed', 'time_up', 'in_progress')
    metadata?: Record<string, any> | null;
}
// --- End Interfaces ---

export default function VprTestPage() {
    // --- States ---
    // Use `user` (TG user) and `dbUser` (DB user) from useAppContext
    const { user, dbUser, token, isLoading: isUserLoading } = useAppContext();

    const params = useParams();
    const router = useRouter();
    const subjectId = parseInt(params.subjectId as string, 10);

    // Existing states
    const [subject, setSubject] = useState<SubjectData | null>(null);
    const [questions, setQuestions] = useState<VprQuestionData[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAttempt, setCurrentAttempt] = useState<VprTestAttempt | null>(null);
    const [isLoading, setIsLoading] = useState(true); // General test loading
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
    const [timeLimit] = useState(3600); // 1 hour in seconds
    const [timeUpModal, setTimeUpModal] = useState(false);
    const [isCurrentQuestionNonAnswerable, setIsCurrentQuestionNonAnswerable] = useState(false);
    const [resetCounter, setResetCounter] = useState(0);
    const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

    // --- NEW Dummy Mode States ---
    const [isDummyModeActive, setIsDummyModeActive] = useState(false);
    const [isPurchasingDisable, setIsPurchasingDisable] = useState(false);

    // Check if dummy mode is permanently disabled using `dbUser.metadata`
    const isDummyModeGloballyDisabled = dbUser?.metadata?.is_dummy_mode_disabled_by_parent === true;
    // --- End Dummy Mode States ---

    // --- Timer Functions ---
    const handleTimeUp = useCallback(() => {
        debugLogger.log("Timer: Time is up!");
        // Don't trigger time up if test already handled or dummy mode is active
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
                 score: currentScore, // Keep the score as it was
                 status: 'time_up' // Set status explicitly
             };

             // Using supabaseAdmin client for update
             const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                 .from('vpr_test_attempts')
                 .update(updates)
                 .eq('id', currentAttempt.id)
                 .select() // Fetch the updated row
                 .single();

              if (updateError) throw updateError;
              if (!updatedAttempt) throw new Error("Attempt not found after forced completion update.");

              // --- Notify Admin (Time up) - VERBOSE Version ---
              if (user && dbUser && subject && updatedAttempt && updatedAttempt.id) { // Check for all data including dbUser
                    const score = updatedAttempt.score ?? 0;
                    const total = typeof updatedAttempt.total_questions === 'number' ? updatedAttempt.total_questions : 0;
                    const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : 'N/A';

                    let durationStr = 'N/A';
                    let startTimeStr = 'N/A';
                    let endTimeStr = 'N/A';

                    // Calculate Duration and Format Timestamps if available
                    if (updatedAttempt.started_at && updatedAttempt.completed_at) {
                        try {
                            const startDate = new Date(updatedAttempt.started_at);
                            const endDate = new Date(updatedAttempt.completed_at);
                            const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
                            startTimeStr = startDate.toLocaleString('ru-RU', options);
                            endTimeStr = endDate.toLocaleString('ru-RU', options);
                            durationStr = formatDistanceStrict(endDate, startDate, { locale: ru, unit: 'minute', roundingMethod: 'ceil' });
                            const durationSeconds = formatDistanceStrict(endDate, startDate, { locale: ru, unit: 'second'});
                             if (durationStr !== durationSeconds && !durationStr.includes('меньше')) {
                               durationStr += ` (${durationSeconds})`;
                             }
                        } catch (e) {
                            debugLogger.warn("Error parsing/calculating test duration (TimeUp):", e);
                            durationStr = 'Ошибка расчета';
                            startTimeStr = String(updatedAttempt.started_at);
                            endTimeStr = String(updatedAttempt.completed_at);
                        }
                    } else {
                        if (updatedAttempt.started_at) startTimeStr = new Date(updatedAttempt.started_at).toLocaleString('ru-RU');
                    }

                    const userIdentifier = dbUser.full_name
                        ? `${dbUser.full_name} (${user.username || 'no_tg_username'})`
                        : (user.username || `ID:${user.id}`);

                    const message = `🔔 *Тест ВПР Завершен (Время вышло!)* ⏳

👤 *Пользователь:*
   - ID: \`${user.id}\`
   - Имя: ${userIdentifier}
   - TG: ${user.username ? `@${user.username}` : 'N/A'}
   - Статус в БД: \`${dbUser.status || 'N/A'}\`
   - Роль: \`${dbUser.role || 'N/A'}\`

📚 *Тест:*
   - Предмет: *${subject.name}* (ID: ${subject.id})
   - Вариант: №${updatedAttempt.variant_number}
   - ID Попытки: \`${updatedAttempt.id}\`

⏱️ *Время:*
   - Начало: ${startTimeStr}
   - Завершение: ${endTimeStr}
   - Длительность: *${durationStr}*

🎯 *Результат:*
   - Баллы: *${score}* из *${total}*
   - Процент: *${percentage}%* ${percentage !== 'N/A' && parseFloat(percentage) >= 80 ? '🏆' : percentage !== 'N/A' && parseFloat(percentage) >= 50 ? '👍' : '🤔'}
   - Статус попытки: \`time_up\` ⏳

*Notification generated: ${new Date().toLocaleString('ru-RU')}*`;

                  try {
                      await notifyAdmin(message); // Use imported notifyAdmin with the verbose message
                      debugLogger.log(`Admin notified (VERBOSE) of time-up completion. Attempt ID: ${updatedAttempt.id}`);
                  } catch (notifyError) {
                      debugLogger.error("Failed to notify admin about time-up completion (VERBOSE):", notifyError);
                  }
              } else {
                  // Improved logging for missing data
                  const missing = [
                      !user && "Telegram User", !dbUser && "Database User", !subject && "Subject",
                      !updatedAttempt && "Attempt Data", updatedAttempt && !updatedAttempt.id && "Attempt ID missing",
                      updatedAttempt && !updatedAttempt.total_questions && "Total Questions missing"
                  ].filter(Boolean).join(", ");
                  debugLogger.warn(`Could not notify admin (time-up): missing critical data: ${missing || 'Unknown reason'}. Available: user=${!!user}, dbUser=${!!dbUser}, subject=${!!subject}, attempt=${!!updatedAttempt}`);
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
    }, [currentAttempt, isSaving, isTestComplete, questions.length, user, dbUser, subject]); // Added dbUser dependency


    // --- Data Fetching & Attempt Handling ---
    useEffect(() => {
        debugLogger.log(`useEffect running. Reset Counter: ${resetCounter}`);

        // Wait for user data (both TG user and DB user) from context
        if (isUserLoading) {
            debugLogger.log("Waiting for user data from AppContext...");
            setIsLoading(true);
            return;
        }

        // Check for required IDs after user context is loaded
        if (!user?.id || !subjectId || isNaN(subjectId)) {
            if (!user?.id) {
                 debugLogger.error("No user ID found in AppContext after loading.");
                 setError("Не удалось получить данные пользователя. Попробуйте перезайти.");
                 setIsLoading(false);
            } else if (isNaN(subjectId)) {
                 setError("Неверный ID предмета");
                 setIsLoading(false);
            }
            return;
        }

        debugLogger.log(`Initializing test for Subject ID: ${subjectId}, User ID: ${user.id}`);
        let isMounted = true;

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
                // --- Variant Selection Logic (using supabaseAdmin) ---
                debugLogger.log("Selecting variant...");
                const { data: variantData, error: variantError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select('variant_number')
                    .eq('subject_id', subjectId);

                 if (!isMounted) return;
                 if (variantError) throw new Error(`Ошибка получения вариантов: ${variantError.message}`);
                 if (!variantData || variantData.length === 0) throw new Error('Для этого предмета не найдено ни одного варианта.');
                 const allAvailableVariants = [...new Set(variantData.map(q => q.variant_number))].sort((a,b) => a - b);

                 const { data: completedAttemptsData, error: completedError } = await supabaseAdmin
                     .from('vpr_test_attempts')
                     .select('variant_number')
                     .eq('user_id', user.id)
                     .eq('subject_id', subjectId)
                     .not('completed_at', 'is', null);
                  if (!isMounted) return;
                  if (completedError) throw new Error(`Ошибка получения пройденных попыток: ${completedError.message}`);
                  const completedVariants = [...new Set(completedAttemptsData.map(a => a.variant_number))];
                  const untriedVariants = allAvailableVariants.filter(v => !completedVariants.includes(v));
                  if (untriedVariants.length > 0) { variantToLoad = untriedVariants[Math.floor(Math.random() * untriedVariants.length)]; }
                  else if (allAvailableVariants.length > 0) { variantToLoad = allAvailableVariants[Math.floor(Math.random() * allAvailableVariants.length)]; }
                  else { throw new Error('Не удалось определить вариант для загрузки.'); }

                  if (!variantToLoad) throw new Error("Variant selection failed.");
                  setSelectedVariant(variantToLoad);
                  debugLogger.log(`Selected Variant: ${variantToLoad}`);

                // --- Fetch Subject Data (using supabaseAdmin) ---
                debugLogger.log("Fetching subject data...");
                const { data: subjectData, error: subjectError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .eq('id', subjectId)
                    .single();
                 if (!isMounted) return;
                 if (subjectError || !subjectData) throw subjectError || new Error('Предмет не найден');
                 setSubject(subjectData);
                 debugLogger.log("Subject data loaded:", subjectData.name);

                // --- Fetch Questions (using supabaseAdmin) ---
                debugLogger.log(`Fetching questions for selected variant ${variantToLoad}...`);
                const { data: questionData, error: questionError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select(`*, vpr_answers ( * )`) // Fetch nested answers
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantToLoad)
                    .order('position', { ascending: true });
                 if (!isMounted) return;
                 if (questionError || !questionData || questionData.length === 0) throw questionError || new Error(`Вопросы для варианта ${variantToLoad} не найдены`);
                 setQuestions(questionData);
                 debugLogger.log(`Loaded ${questionData.length} questions.`);

                // --- Find or Create Attempt (using supabaseAdmin) ---
                debugLogger.log(`Finding active test attempt for variant ${variantToLoad}...`);
                const { data: existingAttempts, error: attemptError } = await supabaseAdmin
                    .from('vpr_test_attempts')
                    .select('*')
                    .eq('user_id', user.id)
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
                    // Validate if the existing attempt matches the current question set length
                    if (potentialAttempt.total_questions !== questionData.length) {
                        debugLogger.warn(`Question count mismatch (DB: ${potentialAttempt.total_questions}, Loaded: ${questionData.length}) for variant ${variantToLoad}. Active attempt seems outdated. Deleting old attempt ID: ${potentialAttempt.id} and creating new.`);
                        try {
                            const { error: deleteErr } = await supabaseAdmin.from('vpr_test_attempts').delete().eq('id', potentialAttempt.id);
                            if (deleteErr) throw deleteErr;
                            debugLogger.log(`Deleted outdated attempt ID: ${potentialAttempt.id}`);
                        } catch (deleteErr: any) {
                             debugLogger.error("Failed to delete outdated attempt:", deleteErr);
                             toast.error("Не удалось удалить старую попытку, возможны несоответствия.");
                             // Continue to create a new one even if delete fails
                        }
                    } else {
                        // Attempt seems valid, resume it
                        attemptToUse = potentialAttempt;
                        debugLogger.log(`Resuming active attempt ID: ${attemptToUse.id} for variant ${variantToLoad}, Last Index: ${attemptToUse.last_question_index}, Score: ${attemptToUse.score}`);
                        setFinalScore(attemptToUse.score || 0); // Restore score on resume
                    }
                } else {
                     debugLogger.log(`No active attempt found in DB for variant ${variantToLoad}. Will create a new one.`);
                }

                // Create new attempt if no valid one was found to resume
                if (!attemptToUse) {
                     debugLogger.log(`Creating new attempt for variant ${variantToLoad}.`);
                     const { data: newAttemptData, error: newAttemptError } = await supabaseAdmin
                         .from('vpr_test_attempts')
                         // Ensure score is explicitly set to 0 for new attempts
                         .insert({ user_id: user.id, subject_id: subjectId, variant_number: variantToLoad, total_questions: questionData.length, last_question_index: 0, score: 0, status: 'in_progress' })
                         .select()
                         .single();
                     if (!isMounted) return;
                     if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                     attemptToUse = newAttemptData;
                     debugLogger.log(`New attempt created ID: ${attemptToUse.id}`);
                     setFinalScore(0); // Ensure score is 0 for new attempt state
                }

                setCurrentAttempt(attemptToUse);
                // Calculate a safe resume index, ensuring it doesn't exceed bounds
                const resumeIndex = Math.max(0, attemptToUse.last_question_index);
                const validResumeIndex = Math.min(resumeIndex, questionData.length > 0 ? questionData.length : 0); // Allow index up to length for completed state check

                 // Check if the attempt is already completed based on DB data
                 if (attemptToUse.completed_at || validResumeIndex >= questionData.length) {
                    debugLogger.log(`Attempt ID ${attemptToUse.id} already completed (completed_at: ${attemptToUse.completed_at}, index: ${validResumeIndex}/${questionData.length}). Setting completion state.`);
                    setCurrentQuestionIndex(questionData.length); // Ensure index reflects completion
                    setIsTestComplete(true);
                    setFinalScore(attemptToUse.score ?? 0);
                    setIsTimerRunning(false);
                 } else {
                    // Attempt is active, set the question index
                    setCurrentQuestionIndex(validResumeIndex);
                    debugLogger.log(`Setting current question index to: ${validResumeIndex}`);

                    // Check if the current question is non-answerable
                    const currentQ = questionData[validResumeIndex];
                    const currentAnswers = currentQ?.vpr_answers || [];
                    const isNonAnswerable = currentAnswers.length > 0 && currentAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
                    setIsCurrentQuestionNonAnswerable(isNonAnswerable);
                    debugLogger.log(`Is current question (${validResumeIndex}) non-answerable? ${isNonAnswerable}`);

                    // Start timer if the test is active and not in dummy mode
                    debugLogger.log("Attempt is active. Starting timer (if dummy mode is off).");
                    setIsTimerRunning(!isDummyModeActive && !isDummyModeGloballyDisabled); // Start only if NOT dummy and NOT globally disabled
                 }

            } catch (err: any) {
                if (!isMounted) return;
                debugLogger.error("Error during test initialization:", err);
                setError(err.message || 'Произошла ошибка при загрузке теста');
                setIsTimerRunning(false); // Ensure timer is off on error
            } finally {
                 if (isMounted) {
                    setIsLoading(false);
                    debugLogger.log("InitializeTest finished.");
                 }
            }
        };

        initializeTest();

        // Cleanup function
        return () => {
            isMounted = false;
            debugLogger.log("useEffect cleanup: component unmounting or dependencies changed.");
        };
     }, [user, dbUser, subjectId, resetCounter, router, token, isUserLoading, isDummyModeGloballyDisabled]); // Added dbUser, isDummyModeGloballyDisabled


    // --- Answer Handling ---
    const handleAnswer = useCallback(async (selectedAnswer: VprAnswerData) => {
        // Prevent action if dummy mode active
        if (isDummyModeActive) {
            debugLogger.log("Answer clicked while Dummy Mode is active. Ignoring.");
            toast.info("В Режиме Подсказок выбор ответа отключен.", { duration: 2000 });
            return;
        }
        // Prevent action if already showing feedback, saving, completed, timed out, timer not running, or no current question
        if (!currentAttempt || showFeedback || isTestComplete || isSaving || !isTimerRunning || timeUpModal || !questions[currentQuestionIndex]) {
             debugLogger.warn("handleAnswer prevented:", { showFeedback, isTestComplete, isSaving, isTimerRunning, timeUpModal, dummyActive: isDummyModeActive });
             return;
        }

        debugLogger.log(`Handling answer selection: Answer ID ${selectedAnswer.id} for Question ID ${questions[currentQuestionIndex].id} (Attempt: ${currentAttempt.id})`);
        setIsTimerRunning(false); // Pause timer immediately on answer selection
        setIsSaving(true);
        setSelectedAnswerId(selectedAnswer.id);

        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct);
        setFeedbackExplanation(questions[currentQuestionIndex]?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true); // Show normal feedback UI

        const scoreIncrement = correct ? 1 : 0;
        const newScore = (currentAttempt.score || 0) + scoreIncrement;
        debugLogger.log(`Answer Correct: ${correct}. Proposed Score: ${newScore}`);

        try {
            // Record the specific answer selection (using supabaseAdmin)
            debugLogger.log("Recording answer to DB...");
            const { error: recordError } = await supabaseAdmin.from('vpr_attempt_answers').insert({
                attempt_id: currentAttempt.id,
                question_id: questions[currentQuestionIndex].id,
                selected_answer_id: selectedAnswer.id,
                was_correct: correct
            });
            // Ignore duplicate errors (e.g., user double-clicks), log others
            if (recordError && recordError.code !== '23505') {
                throw new Error(`Ошибка записи ответа: ${recordError.message}`);
            } else if (recordError?.code === '23505') {
                debugLogger.warn("Attempt answer already recorded for this question. Ignoring duplicate.");
            } else {
                debugLogger.log("Answer recorded successfully.");
            }

            // Update the attempt's score (using supabaseAdmin)
            debugLogger.log("Updating attempt score in DB...");
            const { data: updatedData, error: updateScoreError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update({ score: newScore })
                .eq('id', currentAttempt.id)
                .select() // Select the updated row data
                .single();

            if (updateScoreError) throw new Error(`Ошибка обновления счета: ${updateScoreError.message}`);
            if (!updatedData) throw new Error("Attempt data not returned after score update.");

            setCurrentAttempt(updatedData); // Update local state with the confirmed data from DB
            debugLogger.log("Attempt score updated successfully in local state:", updatedData);

        } catch (err: any) {
            debugLogger.error("Error saving answer/score:", err);
            toast.error(`Не удалось сохранить результат: ${err.message}`);
            // Even if saving fails, keep feedback showing so user knows their choice was registered visually
        } finally {
             setIsSaving(false);
             // Timer remains paused. It will be restarted by handleNextQuestion if appropriate.
        }
    }, [currentAttempt, showFeedback, isTestComplete, isSaving, isTimerRunning, timeUpModal, questions, currentQuestionIndex, isDummyModeActive]);


    // --- Navigation Logic ---
    const handleNextQuestion = useCallback(async (isSkip: boolean = false) => {
        if (!currentAttempt || isSaving || isTestComplete || timeUpModal || !questions.length) {
            debugLogger.warn("handleNextQuestion prevented:", { isSaving, isTestComplete, timeUpModal });
            return;
        }

        const currentQIndex = currentQuestionIndex;
        const nextIndex = currentQIndex + 1;
        const isFinishing = nextIndex >= questions.length;
        debugLogger.log(`Handling next question. From: ${currentQIndex}, To: ${nextIndex}, Finishing: ${isFinishing}, Skip: ${isSkip}, DummyActive: ${isDummyModeActive}`);

        setIsSaving(true);
        // Reset feedback/selection states immediately
        setShowFeedback(false); setSelectedAnswerId(null); setIsCorrect(false); setFeedbackExplanation(null);

        let nextIsNonAnswerable = false;
        if (!isFinishing) {
            const nextQ = questions[nextIndex]; const nextAnswers = nextQ?.vpr_answers || [];
            nextIsNonAnswerable = nextAnswers.length > 0 && nextAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
            debugLogger.log(`Next question (${nextIndex}) non-answerable? ${nextIsNonAnswerable}`);
        }

        try {
            // Prepare updates for the attempt record
            const updates: Partial<VprTestAttempt> = isFinishing
                ? { last_question_index: questions.length, completed_at: new Date().toISOString(), status: 'completed' } // Mark as completed
                : { last_question_index: nextIndex, status: 'in_progress' }; // Update progress

            debugLogger.log(`Updating attempt progress/completion in DB to index: ${updates.last_question_index}, Status: ${updates.status}`);

            // Update the attempt in the database (using supabaseAdmin)
            const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update(updates)
                .eq('id', currentAttempt.id)
                .select() // Select the updated data
                .single();

            if (updateError) throw new Error(`Ошибка обновления прогресса: ${updateError.message}`);
            if (!updatedAttempt) throw new Error("Attempt not found after update.");

            setCurrentAttempt(updatedAttempt); // Update local state with confirmed data from DB *first*

            // --- State transitions based on whether the test is finishing ---
            if (!isFinishing) {
                // Moving to the next question
                setCurrentQuestionIndex(nextIndex);
                setIsCurrentQuestionNonAnswerable(nextIsNonAnswerable);

                // Timer logic: Restart only if NOT finishing AND dummy mode is OFF (and not globally disabled)
                if (!isDummyModeActive && !isDummyModeGloballyDisabled) {
                    setIsTimerRunning(true);
                    debugLogger.log(`Moved to question index: ${nextIndex}. Timer restarted.`);
                } else {
                    setIsTimerRunning(false); // Ensure timer is paused if dummy mode is ON or globally disabled
                    const reason = isDummyModeActive ? "Dummy Mode Active" : (isDummyModeGloballyDisabled ? "Globally Disabled" : "Finishing");
                    debugLogger.log(`Moved to question index: ${nextIndex}. Timer remains paused (${reason}).`);
                }
            } else {
                // Finishing the test
                setIsCurrentQuestionNonAnswerable(false); // Reset non-answerable state
                setIsTimerRunning(false); // Ensure timer stops on completion
                setIsTestComplete(true);
                setFinalScore(updatedAttempt.score ?? 0);
                debugLogger.log("Test marked as complete. Final Score from DB:", updatedAttempt.score);
                toast.success("Тест завершен!", { duration: 4000 });

                // --- Notify Admin (Normal Completion) - VERBOSE Version ---
                if (user && dbUser && subject && updatedAttempt && updatedAttempt.id) { // Check for all data including dbUser
                    const score = updatedAttempt.score ?? 0;
                    const total = typeof updatedAttempt.total_questions === 'number' ? updatedAttempt.total_questions : 0;
                    const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : 'N/A';

                    let durationStr = 'N/A';
                    let startTimeStr = 'N/A';
                    let endTimeStr = 'N/A';

                    // Calculate Duration and Format Timestamps if available
                    if (updatedAttempt.started_at && updatedAttempt.completed_at) {
                         try {
                            const startDate = new Date(updatedAttempt.started_at);
                            const endDate = new Date(updatedAttempt.completed_at);
                            const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
                            startTimeStr = startDate.toLocaleString('ru-RU', options);
                            endTimeStr = endDate.toLocaleString('ru-RU', options);
                            durationStr = formatDistanceStrict(endDate, startDate, { locale: ru, unit: 'minute', roundingMethod: 'ceil' });
                            const durationSeconds = formatDistanceStrict(endDate, startDate, { locale: ru, unit: 'second'});
                             if (durationStr !== durationSeconds && !durationStr.includes('меньше')) {
                               durationStr += ` (${durationSeconds})`;
                             }
                         } catch (e) {
                            debugLogger.warn("Error parsing/calculating test duration (Normal):", e);
                            durationStr = 'Ошибка расчета';
                            startTimeStr = String(updatedAttempt.started_at);
                            endTimeStr = String(updatedAttempt.completed_at);
                         }
                    } else {
                         if (updatedAttempt.started_at) startTimeStr = new Date(updatedAttempt.started_at).toLocaleString('ru-RU');
                    }

                    const userIdentifier = dbUser.full_name
                        ? `${dbUser.full_name} (${user.username || 'no_tg_username'})`
                        : (user.username || `ID:${user.id}`);

                    // Construct the verbose message using Markdown
                    const message = `✅ *Тест ВПР Завершен: Детальная Статистика* 📊

👤 *Пользователь:*
   - ID: \`${user.id}\`
   - Имя: ${userIdentifier}
   - TG: ${user.username ? `@${user.username}` : 'N/A'}
   - Статус в БД: \`${dbUser.status || 'N/A'}\`
   - Роль: \`${dbUser.role || 'N/A'}\`

📚 *Тест:*
   - Предмет: *${subject.name}* (ID: ${subject.id})
   - Вариант: №${updatedAttempt.variant_number}
   - ID Попытки: \`${updatedAttempt.id}\`

⏱️ *Время:*
   - Начало: ${startTimeStr}
   - Завершение: ${endTimeStr}
   - Длительность: *${durationStr}*

🎯 *Результат:*
   - Баллы: *${score}* из *${total}*
   - Процент: *${percentage}%* ${percentage !== 'N/A' && parseFloat(percentage) >= 80 ? '🏆' : percentage !== 'N/A' && parseFloat(percentage) >= 50 ? '👍' : '🤔'}
   - Статус попытки: \`${updatedAttempt.status || 'completed'}\` ✅

*Notification generated: ${new Date().toLocaleString('ru-RU')}*`;

                    try {
                        await notifyAdmin(message); // Use imported notifyAdmin with the verbose message
                        debugLogger.log(`Admin notified (VERBOSE) of normal test completion. Attempt ID: ${updatedAttempt.id}`);
                    } catch (notifyError) {
                        debugLogger.error("Failed to notify admin about normal completion (VERBOSE):", notifyError);
                    }
                } else {
                    // Improved logging for missing data
                    const missing = [
                        !user && "Telegram User", !dbUser && "Database User", !subject && "Subject",
                        !updatedAttempt && "Attempt Data", updatedAttempt && !updatedAttempt.id && "Attempt ID missing",
                        updatedAttempt && !updatedAttempt.total_questions && "Total Questions missing"
                    ].filter(Boolean).join(", ");
                     debugLogger.warn(`Could not notify admin (normal completion): missing critical data: ${missing || 'Unknown reason'}. Available: user=${!!user}, dbUser=${!!dbUser}, subject=${!!subject}, attempt=${!!updatedAttempt}`);
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
    }, [currentAttempt, isSaving, isTestComplete, timeUpModal, questions, currentQuestionIndex, user, dbUser, subject, isDummyModeActive, isDummyModeGloballyDisabled]); // Added dbUser, subject, isDummyModeGloballyDisabled dependencies


    // --- Reset Logic ---
     const resetTest = useCallback(async () => {
         if (isSaving) {
             toast.warning("Подождите, идет сохранение...");
             return;
         }
         debugLogger.log("Reset button clicked.");
         setIsLoading(true); // Show loading indicator during reset process

         try {
             // Stop ongoing processes
             setIsTimerRunning(false);
             setIsDummyModeActive(false); // Ensure dummy mode is off on reset

             // Attempt to delete any incomplete attempts for this user/subject (using supabaseAdmin)
             if (user?.id && subjectId) {
                 debugLogger.log(`Attempting to delete ANY active attempt for subject ${subjectId} and user ${user.id} before reset.`);
                 const { error: deleteError } = await supabaseAdmin
                     .from('vpr_test_attempts')
                     .delete()
                     .eq('user_id', user.id)
                     .eq('subject_id', subjectId)
                     .is('completed_at', null); // Target only incomplete attempts

                 if (deleteError) {
                      // Log error but proceed with reset, as the main goal is to start fresh
                      debugLogger.error("Error deleting active attempt(s) during reset:", deleteError);
                      toast.warning(`Не удалось удалить предыдущую попытку: ${deleteError.message}`);
                 } else {
                      debugLogger.log("Any active attempts for this subject/user deleted successfully.");
                 }
             } else {
                  debugLogger.warn("Cannot delete active attempt during reset: missing user ID or subject ID.");
             }

             // Reset frontend state fully to prepare for re-initialization
             setCurrentAttempt(null); setQuestions([]); setCurrentQuestionIndex(0);
             setError(null); setSelectedVariant(null); setSubject(null);
             setFinalScore(0); setIsTestComplete(false); setShowFeedback(false);
             setSelectedAnswerId(null); setTimeUpModal(false);
             setShowDescription(false); setFeedbackExplanation(null); setIsCorrect(false);
             setIsCurrentQuestionNonAnswerable(false);

             toast.info("Сброс теста...", { duration: 1500});
             // Increment counter to trigger the useEffect hook, which will re-fetch and re-initialize
             setResetCounter(prev => prev + 1);
             debugLogger.log("Reset counter incremented, useEffect will re-run.");

         } catch (err: any) {
              // Catch any unexpected errors during the reset process itself
              debugLogger.error("Error during reset process:", err);
              setError(`Ошибка сброса теста: ${err.message}`);
              setIsLoading(false); // Ensure loading stops if reset itself fails critically
         }
         // Note: setIsLoading(false) is primarily handled by the useEffect after re-fetching completes successfully or fails.
     }, [isSaving, user?.id, subjectId]);


    // --- Purchase Disabling of Dummy Mode ---
    const handlePurchaseDisableDummy = async () => {
        if (!user?.id || !dbUser?.id) { // Need user ID for the action
            toast.error("Не удалось определить пользователя для покупки.");
            return;
        }
        if (isPurchasingDisable || isDummyModeGloballyDisabled) {
             // Prevent purchase if already disabled or purchase in progress
             if (isDummyModeGloballyDisabled) {
                 toast.info("Режим подсказок уже отключен родителем.", { duration: 3000 });
             }
             return;
        }

        debugLogger.log(`Attempting to purchase DISABLE Dummy Mode feature for user ID: ${user.id}`);
        setIsPurchasingDisable(true);
        toast.loading("Отправка запроса на покупку...", { id: "purchase-disable-dummy" });

        try {
            // Call the server action
            const result = await purchaseDisableDummyMode(user.id); // Pass TG user ID

            if (result.success) {
                if (result.alreadyDisabled) {
                    toast.success("Режим подсказок уже отключен для этого пользователя.", { id: "purchase-disable-dummy" });
                    // Ideally, AppContext would update the user state automatically via listeners/polling
                    // If not, might need a manual refresh mechanism here
                } else {
                    toast.success("Счет на отключение режима подсказок отправлен в Telegram! Пожалуйста, оплатите его там.", { id: "purchase-disable-dummy", duration: 6000 });
                     // The actual disabling happens server-side after payment confirmation via webhook
                }
            } else {
                // Handle specific errors returned by the action
                throw new Error(result.error || "Неизвестная ошибка при запросе покупки.");
            }
        } catch (error: any) {
            debugLogger.error("Failed to initiate disable dummy mode purchase:", error);
            toast.error(`Ошибка покупки: ${error.message}`, { id: "purchase-disable-dummy" });
        } finally {
            setIsPurchasingDisable(false);
        }
    };

    // --- Toggle Dummy Mode ---
    const toggleDummyMode = () => {
        // Prevent toggle if globally disabled by parent
        if (isDummyModeGloballyDisabled) {
             toast.info("Режим подсказок отключен родителем и не может быть включен.", { duration: 3000 });
             return;
        }
        // Prevent toggle if test is finished or saving
        if (isTestComplete || timeUpModal || isSaving) return;

        setIsDummyModeActive(prev => {
            const newState = !prev;
            debugLogger.log(`Dummy Mode Toggled: ${newState}`);
            if (newState) {
                // Turning ON Dummy Mode
                setIsTimerRunning(false); // Pause timer explicitly
                setShowFeedback(false); // Hide normal feedback if it was showing
                setSelectedAnswerId(null); // Clear any visible selection state
                toast.info("🧠 Режим Подсказок ВКЛ", { duration: 1500 });
            } else {
                // Turning OFF Dummy Mode
                // Restart timer ONLY if the test is ongoing, not showing feedback, and not timed out
                if (!isTestComplete && !showFeedback && !timeUpModal) {
                     setIsTimerRunning(true);
                }
                toast.info("💪 Режим Подсказок ВЫКЛ", { duration: 1500 });
            }
            return newState;
        });
    };

    // --- Rendering Logic ---

    // Primary loading state: Waits for user context OR initial test data load
    if (isUserLoading || (isLoading && !currentAttempt)) {
        return <VprLoadingIndicator text={isUserLoading ? "Загрузка пользователя..." : "Загрузка теста..."} />;
    }

    // Error state: If error occurred during init AND we don't have attempt data yet
    if (error && !currentAttempt) {
        return <VprErrorDisplay error={error} onRetry={resetTest} />;
    }

    // Completion screen: Shown when `isTestComplete` is true
    if (isTestComplete) {
        return ( <VprCompletionScreen
                    subjectName={subject?.name}
                    variantNumber={currentAttempt?.variant_number} // Pass variant from the completed attempt
                    finalScore={finalScore}
                    totalQuestions={currentAttempt?.total_questions ?? questions.length} // Use attempt's total, fallback
                    onReset={resetTest}
                    onGoToList={() => router.push('/vpr-tests')} /> );
    }

    // Safeguard: If not loading, not error, not complete, but still missing critical data
    if (!isLoading && (!currentAttempt || !currentAttempt.id || questions.length === 0 || !selectedVariant || !subject)) {
         debugLogger.error("Critical data missing after load:", { currentAttempt: !!currentAttempt, qLen: questions.length, variant: selectedVariant, subject: !!subject });
         return <VprErrorDisplay error={error || "Критические данные теста (попытка, вопросы, вариант или предмет) не загружены. Попробуйте сбросить тест."} onRetry={resetTest} />;
    }

    // Get data for the current question safely
    const currentQuestionData = questions?.[currentQuestionIndex];
    if (!currentQuestionData) {
        // This case should ideally not happen if logic is correct, but good to handle
        debugLogger.error("currentQuestionData is undefined for index:", currentQuestionIndex, " Attempt:", currentAttempt?.id);
        if (isLoading) { // If somehow still loading at this point
            return <VprLoadingIndicator text="Загрузка вопроса..." />;
        } else {
             // Treat as an error if not loading but question data is missing
            return <VprErrorDisplay error={`Не удалось загрузить данные вопроса #${currentQuestionIndex + 1}. Попробуйте сбросить тест.`} onRetry={resetTest} />;
        }
    }

    const answersForCurrent = currentQuestionData.vpr_answers || [];
    const showSavingOverlay = isSaving; // Show overlay when isSaving is true

    // Determine if explanation display should be active
    const shouldShowExplanation = (isDummyModeActive && !isCurrentQuestionNonAnswerable) || showFeedback;
    // Determine what explanation text to show
    const explanationToShow = isDummyModeActive
                                ? (currentQuestionData?.explanation || "Объяснение отсутствует.") // In dummy mode, show the official explanation
                                : feedbackExplanation; // In normal feedback, show the explanation set by handleAnswer
    // Determine the correctness state for the explanation display's styling/title
    const explanationIsCorrectState = isDummyModeActive ? true : isCorrect; // In dummy mode, it's always "correct"; otherwise use feedback state

    return (
        <TooltipProvider>
            {/* Main container with animation key based on attempt ID */}
            <motion.div
                key={currentAttempt?.id || 'loading-attempt'} // Unique key for animation on attempt change/load
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="min-h-screen bg-page-gradient text-light-text flex flex-col items-center pt-6 pb-10 px-4"
            >
                {/* Time Up Modal */}
                <VprTimeUpModal show={timeUpModal} onConfirm={completeTestDueToTime} />

                {/* Main test card */}
                <div className="max-w-3xl w-full bg-dark-card shadow-xl rounded-2xl p-5 md:p-8 flex-grow flex flex-col border border-brand-blue/20 relative overflow-hidden">
                     {/* Saving Overlay */}
                     {showSavingOverlay && (
                        <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-sm flex items-center justify-center z-40 rounded-2xl">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                            <span className="ml-3 text-light-text">Сохранение...</span>
                        </div>
                     )}

                    {/* --- HEADER AREA --- */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-y-3 flex-wrap">
                        {/* Test Header Info (Subject, Timer, Description Button) */}
                        <VprHeader
                            subjectName={subject?.name}
                            variantNumber={selectedVariant}
                            showDescriptionButton={!!subject?.description}
                            isDescriptionShown={showDescription}
                            onToggleDescription={() => setShowDescription(!showDescription)}
                            timerKey={timerKey}
                            timeLimit={timeLimit}
                            onTimeUp={handleTimeUp}
                            // Timer runs if conditions are met
                            isTimerRunning={isTimerRunning && !isSaving && !isTestComplete && !timeUpModal && !isDummyModeActive && !isDummyModeGloballyDisabled}
                        />
                        {/* --- Dummy Mode Controls --- */}
                        <div className="flex items-center space-x-3 self-center sm:self-auto">
                             {/* === Show Toggle ONLY if NOT globally disabled === */}
                             {!isDummyModeGloballyDisabled ? (
                                 <Tooltip>
                                     <TooltipTrigger asChild>
                                         <div className="flex items-center space-x-2">
                                             <Sparkles className={`h-5 w-5 transition-colors ${isDummyModeActive ? 'text-yellow-400 animate-pulse' : 'text-gray-500'}`} />
                                             <Switch
                                                 id="dummy-mode-toggle"
                                                 checked={isDummyModeActive}
                                                 onCheckedChange={toggleDummyMode}
                                                 disabled={isTestComplete || timeUpModal || isSaving} // Disable if test ended or saving
                                                 aria-label="Режим Подсказок"
                                                 className="data-[state=checked]:bg-yellow-500 data-[state=unchecked]:bg-gray-600"
                                             />
                                             <label htmlFor="dummy-mode-toggle" className={`text-sm font-medium transition-colors ${isDummyModeActive ? 'text-yellow-400' : 'text-gray-400'} cursor-pointer select-none`}>
                                                 Подсказки
                                             </label>
                                         </div>
                                     </TooltipTrigger>
                                     <TooltipContent>
                                         <p>{isDummyModeActive ? 'Выключить' : 'Включить'} режим подсказок (покажет правильный ответ и объяснение)</p>
                                     </TooltipContent>
                                 </Tooltip>
                             ) : (
                                // === Show Lock Icon/Text if globally disabled ===
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center space-x-2 text-yellow-600 opacity-80 cursor-not-allowed">
                                            <Lock className="h-5 w-5" />
                                            <span className="text-sm font-medium select-none">Подсказки</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Режим подсказок отключен родителем.</p>
                                    </TooltipContent>
                                </Tooltip>
                             )}

                            {/* === Show button to PERMANENTLY disable dummy mode IF NOT already disabled === */}
                            {!isDummyModeGloballyDisabled && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePurchaseDisableDummy}
                                            disabled={isPurchasingDisable || !user?.id || !dbUser?.id} // Disable if purchasing or user data missing
                                            className="border-red-500/50 text-red-400 hover:bg-red-900/30 hover:text-red-300 px-2 py-1 h-auto"
                                            title="Отключить подсказки навсегда (опция для родителя)"
                                        >
                                            {isPurchasingDisable ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4"/>}
                                            <span className="ml-1 text-xs hidden sm:inline">Отключить</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p className="text-xs max-w-[200px]">Запросить у родителя <br/> навсегда отключить режим <br/> подсказок для этого <br/> пользователя (через оплату).</p>
                                    </TooltipContent>
                                </Tooltip>
                             )}
                        </div>
                    </div>
                    {/* --- END HEADER AREA --- */}

                    {/* Optional Subject Description */}
                    <VprDescription description={subject?.description} show={showDescription} />

                    {/* Progress Indicator */}
                    <VprProgressIndicator current={currentQuestionIndex} total={questions.length} />

                    {/* Question and Answer Area (Animated on question change) */}
                     <motion.div
                        key={currentQuestionIndex} // Animate content swap when question index changes
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="mb-auto" // Push content down, allowing reset button to be at bottom
                    >
                         {/* Question Content (Text, Images, Visuals) */}
                         <VprQuestionContent
                             questionData={currentQuestionData}
                             questionNumber={currentQuestionIndex + 1}
                             totalQuestions={questions.length}
                         />
                         {/* Answer Options List */}
                         <VprAnswerList
                            answers={answersForCurrent}
                            selectedAnswerId={selectedAnswerId}
                            showFeedback={showFeedback} // For normal feedback highlights
                            timeUpModal={timeUpModal}
                            handleAnswer={handleAnswer}
                            isDummyModeActive={isDummyModeActive} // Pass dummy state for styling/disabling
                        />
                     </motion.div>

                     {/* Skip Button for Non-Answerable Questions */}
                     {isCurrentQuestionNonAnswerable && !shouldShowExplanation && !isTestComplete && !timeUpModal && (
                         <div className="mt-4 text-center">
                             <button
                                onClick={() => handleNextQuestion(true)} // Trigger skip action
                                disabled={isSaving} // Disable while saving
                                className="bg-brand-purple text-white px-6 py-2 rounded-lg font-semibold hover:bg-brand-purple/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
                             >
                                 Пропустить / Далее
                             </button>
                             <p className="text-xs text-gray-400 mt-2">Этот вопрос требует рисунка, ввода текста или анализа изображения (нет выбора варианта).</p>
                         </div>
                     )}

                     {/* Explanation Display Area (Animated In/Out) */}
                     <AnimatePresence>
                        {shouldShowExplanation && (
                            <ExplanationDisplay
                                key={`exp-${currentQuestionIndex}-${isDummyModeActive}`} // Key ensures animation triggers correctly
                                explanation={explanationToShow}
                                isCorrect={explanationIsCorrectState} // Pass contextual correctness
                                onNext={() => handleNextQuestion(false)} // Standard 'Next' button action
                                isLastQuestion={currentQuestionIndex >= questions.length - 1}
                                isDummyModeExplanation={isDummyModeActive} // Pass flag for styling/title
                            />
                        )}
                     </AnimatePresence>

                    {/* Reset Button Area (Pushed to bottom) */}
                    <div className="mt-auto pt-6 text-center">
                        <button
                            onClick={resetTest}
                            disabled={isSaving || isLoading} // Disable if saving or initially loading
                            className="text-xs text-gray-500 hover:text-brand-pink underline transition-colors flex items-center justify-center gap-1 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                             <RotateCcw className="h-3 w-3"/>
                             Сбросить и начать другой вариант
                        </button>
                    </div>
                </div>
            </motion.div>
        </TooltipProvider>
    );
}