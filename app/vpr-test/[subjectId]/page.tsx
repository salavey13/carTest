"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Loader2, Zap, HelpCircle, Sparkles, Eye, EyeOff, Lock } from "lucide-react";

// Import Supabase clients (using admin client for simplicity/consistency as per context)
// *** SECURITY WARNING: Using supabaseAdmin on the client is insecure. Refactor to Server Actions. ***
import { supabaseAdmin } from "@/hooks/supabase";
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
import { notifyAdmins } from "@/app/actions";
import { purchaseDisableDummyMode } from "@/app/actions/dummy_actions";

// Optional: Use a date library for cleaner duration formatting in notifications
import { formatDistanceStrict } from 'date-fns';
import { ru } from 'date-fns/locale';

// --- Interfaces ---
interface SubjectData {
    id: number;
    name: string;
    description?: string;
    grade_level?: number;
}

interface VprQuestionData {
    id: number;
    subject_id: number;
    variant_number: number;
    text: string;
    explanation?: string;
    position: number;
    vpr_answers: VprAnswerData[];
    visual_data?: any | null;
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
    status?: string | null; // THIS FIELD NEEDS TO EXIST IN THE DB TABLE
    metadata?: Record<string, any> | null; // THIS FIELD NEEDS TO EXIST IN THE DB TABLE
    created_at?: string; // Optional: if needed from DB select
    updated_at?: string; // Optional: if needed from DB select
}
// --- End Interfaces ---

export default function VprTestPage() {
    // --- States ---
    const { user, dbUser, token, isLoading: isUserLoading } = useAppContext();
    const params = useParams();
    const router = useRouter(); // Keep router instance for navigation
    const subjectIdParam = params.subjectId as string;
    const [subjectId, setSubjectId] = useState<number | null>(null);

    // Component States
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
    const [isDummyModeActive, setIsDummyModeActive] = useState(false);
    const [isPurchasingDisable, setIsPurchasingDisable] = useState(false);

    // Derived State
    const isDummyModeGloballyDisabled = dbUser?.metadata?.is_dummy_mode_disabled_by_parent === true;

    // --- Parse subjectId safely ---
    useEffect(() => {
        const parsedId = parseInt(subjectIdParam, 10);
        if (!isNaN(parsedId)) {
            setSubjectId(parsedId);
             // Reset error if previously set due to parsing
            if (error === "Неверный ID предмета в URL.") setError(null);
        } else {
            setError("Неверный ID предмета в URL.");
            setIsLoading(false); // Stop loading if ID is invalid
            setSubjectId(null);
        }
    }, [subjectIdParam, error]); // Add error to dep array to allow resetting it


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
    }, [isTestComplete, timeUpModal, isDummyModeActive]);

    const completeTestDueToTime = useCallback(async () => {
         setTimeUpModal(false);
         if (!currentAttempt || isSaving || isTestComplete) return;
         debugLogger.log("Completing test due to time up for attempt:", currentAttempt.id);
         setIsSaving(true);
         setError(null); // Clear previous errors
         try {
             // *** SECURITY WARNING: Using supabaseAdmin on the client is insecure. ***
             const currentScore = currentAttempt.score || 0;
             const totalQ = questions.length > 0 ? questions.length : (currentAttempt.total_questions || 0);
             const updates: Partial<VprTestAttempt> = {
                 last_question_index: totalQ, // Mark all questions as 'passed'
                 completed_at: new Date().toISOString(),
                 score: currentScore, // Keep the score as it was
                 status: 'time_up' // Set status explicitly (Requires 'status' column in DB)
             };

             const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                 .from('vpr_test_attempts')
                 .update(updates)
                 .eq('id', currentAttempt.id)
                 .select() // Fetch the updated row
                 .single();

              if (updateError) {
                  // Check for the specific schema cache error
                  if (updateError.message.includes("column") && updateError.message.includes("does not exist")) {
                       const specificError = `Ошибка базы данных: Колонка (например, 'status' или другая) не найдена в таблице 'vpr_test_attempts'. Проверьте SQL схему и обновите кэш Supabase. (${updateError.message})`;
                       setError(specificError);
                       throw new Error(specificError); // Throw specific error
                  }
                   throw updateError; // Throw other errors
              }
              if (!updatedAttempt) throw new Error("Attempt not found after forced completion update.");

              // --- Notify Admin (Time up - Verbose) ---
              if (user && dbUser && subject && updatedAttempt && updatedAttempt.id) {
                    const score = updatedAttempt.score ?? 0;
                    // Use total from attempt if available, otherwise use loaded questions length
                    const total = typeof updatedAttempt.total_questions === 'number' ? updatedAttempt.total_questions : totalQ;
                    const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : '0.0';
                    let durationStr = 'N/A', startTimeStr = 'N/A', endTimeStr = 'N/A';

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
   - Статус попытки: \`${updatedAttempt.status || 'time_up'}\` ⏳

*Notification generated: ${new Date().toLocaleString('ru-RU')}*`;

                  try {
                      await notifyAdmins(message);
                      debugLogger.log(`Admin notified (VERBOSE) of time-up completion. Attempt ID: ${updatedAttempt.id}`);
                  } catch (notifyError) {
                      debugLogger.error("Failed to notify admin about time-up completion (VERBOSE):", notifyError);
                  }
              } else {
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
             // Use error state if it was set, otherwise use generic message
             const errorMsg = error || `Не удалось завершить тест (${err.message || 'Неизвестная ошибка'}). Попробуйте обновить страницу.`;
             setError(errorMsg);
             toast.error("Ошибка принудительного завершения теста.");
         } finally {
            setIsSaving(false);
         }
    }, [currentAttempt, isSaving, isTestComplete, questions.length, user, dbUser, subject, error]); // Added questions.length, error dependency


    // --- Data Fetching & Attempt Handling ---
    useEffect(() => {
        // Exit early if subjectId is not validly parsed yet or user is loading
        if (subjectId === null && !error) {
            if (!isLoading) setIsLoading(true); // Ensure loading is true while waiting
            debugLogger.log("useEffect waiting for valid subjectId.");
            return;
        }
         if (isUserLoading) {
             if (!isLoading) setIsLoading(true); // Ensure loading is true while waiting
            debugLogger.log("useEffect waiting for user data from AppContext...");
            return;
        }
        // If an error already exists (e.g., from ID parsing), stop execution
        if (error) {
             debugLogger.log(`useEffect aborted due to existing error: ${error}`);
             if (isLoading) setIsLoading(false); // Ensure loading stops if error exists
             return;
        }

        // Check for required user ID now that context is loaded
        if (!user?.id) {
             debugLogger.error("No user ID found in AppContext after loading.");
             setError("Не удалось получить данные пользователя. Попробуйте перезайти.");
             setIsLoading(false);
             return;
        }

        // Ensure subjectId is a valid number (should be set by the first effect)
        if (typeof subjectId !== 'number' || isNaN(subjectId)) {
             debugLogger.error(`Invalid subjectId in main effect: ${subjectId}`);
             setError("Внутренняя ошибка: ID предмета не установлен."); // Should not happen if logic is correct
             setIsLoading(false);
             return;
        }

        debugLogger.log(`Initializing test for Subject ID: ${subjectId}, User ID: ${user.id}, Reset Counter: ${resetCounter}`);
        let isMounted = true;

        const initializeTest = async () => {
            if (!isMounted) {
                debugLogger.log("InitializeTest aborted: component unmounted.");
                return;
            }
            debugLogger.log("InitializeTest starting...");

            // Reset states thoroughly *before* async operations
            setIsLoading(true); setError(null); setShowDescription(false);
            setIsTestComplete(false); setShowFeedback(false); setSelectedAnswerId(null);
            setIsTimerRunning(false); setTimerKey(Date.now()); setTimeUpModal(false);
            setIsCorrect(false); setFeedbackExplanation(null); setFinalScore(0);
            setCurrentQuestionIndex(0); setCurrentAttempt(null); setQuestions([]);
            setSubject(null);
            setIsCurrentQuestionNonAnswerable(false); setSelectedVariant(null);
            setIsDummyModeActive(false);

            let variantToLoad: number | null = null;

            try {
                // *** SECURITY WARNING: Using supabaseAdmin on the client is insecure. ***

                // --- Variant Selection Logic ---
                debugLogger.log("Selecting variant...");
                const { data: variantData, error: variantError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select('variant_number')
                    .eq('subject_id', subjectId);

                 if (!isMounted) return;
                 if (variantError) throw new Error(`Ошибка получения вариантов: ${variantError.message}`);
                 if (!variantData || variantData.length === 0) throw new Error(`Для предмета с ID ${subjectId} не найдено ни одного варианта.`);
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
                  else { throw new Error('Не удалось определить вариант для загрузки (нет доступных вариантов).'); }

                  if (variantToLoad === null || isNaN(variantToLoad)) throw new Error("Не удалось выбрать номер варианта.");
                  setSelectedVariant(variantToLoad);
                  debugLogger.log(`Selected Variant: ${variantToLoad}`);

                // --- Fetch Subject Data ---
                debugLogger.log("Fetching subject data...");
                const { data: subjectData, error: subjectError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .eq('id', subjectId)
                    .single();
                 if (!isMounted) return;
                 if (subjectError) throw new Error(`Ошибка загрузки предмета: ${subjectError.message}`);
                 if (!subjectData) throw new Error(`Предмет с ID ${subjectId} не найден`);
                 setSubject(subjectData);
                 debugLogger.log("Subject data loaded:", subjectData.name);

                // --- Fetch Questions ---
                debugLogger.log(`Fetching questions for selected variant ${variantToLoad}...`);
                const { data: questionData, error: questionError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select(`*, vpr_answers ( * )`)
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantToLoad)
                    .order('position', { ascending: true });
                 if (!isMounted) return;
                 if (questionError) throw new Error(`Ошибка загрузки вопросов: ${questionError.message}`);
                 if (!questionData || questionData.length === 0) throw new Error(`Вопросы для предмета '${subjectData.name}', варианта ${variantToLoad} не найдены`);
                 setQuestions(questionData);
                 const loadedQuestionCount = questionData.length;
                 debugLogger.log(`Loaded ${loadedQuestionCount} questions.`);

                // --- Find or Create Attempt ---
                debugLogger.log(`Finding active test attempt for variant ${variantToLoad}...`);
                const { data: existingAttempts, error: attemptError } = await supabaseAdmin
                    .from('vpr_test_attempts')
                    .select('*') // Select all columns, including the new 'status' and 'metadata'
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
                    if (typeof potentialAttempt.total_questions !== 'number' || potentialAttempt.total_questions !== loadedQuestionCount) {
                        debugLogger.warn(`Question count mismatch (DB: ${potentialAttempt.total_questions}, Loaded: ${loadedQuestionCount}). Deleting old attempt ID: ${potentialAttempt.id}...`);
                        try {
                            const { error: deleteErr } = await supabaseAdmin.from('vpr_test_attempts').delete().eq('id', potentialAttempt.id);
                            if (deleteErr) throw new Error(`Не удалось удалить устаревшую попытку: ${deleteErr.message}`);
                            debugLogger.log(`Deleted outdated attempt ID: ${potentialAttempt.id}`);
                        } catch (deleteErr: any) {
                             debugLogger.error("Failed to delete outdated attempt:", deleteErr);
                             toast.warning("Не удалось удалить старую попытку, возможны несоответствия.");
                        }
                    } else {
                        attemptToUse = potentialAttempt;
                        debugLogger.log(`Resuming active attempt ID: ${attemptToUse.id}, Last Index: ${attemptToUse.last_question_index}, Score: ${attemptToUse.score}, Status: ${attemptToUse.status}`);
                        setFinalScore(attemptToUse.score || 0);
                    }
                } else {
                     debugLogger.log(`No active attempt found for variant ${variantToLoad}. Will create a new one.`);
                }

                // Create new attempt if needed
                if (!attemptToUse) {
                     debugLogger.log(`Creating new attempt for variant ${variantToLoad}.`);
                     const { data: newAttemptData, error: newAttemptError } = await supabaseAdmin
                         .from('vpr_test_attempts')
                         .insert({
                             user_id: user.id,
                             subject_id: subjectId,
                             variant_number: variantToLoad,
                             total_questions: loadedQuestionCount,
                             last_question_index: 0,
                             score: 0,
                             status: 'in_progress' // Set initial status (Requires 'status' column in DB)
                             // metadata: null // Explicitly set metadata if needed
                         })
                         .select()
                         .single();
                     if (!isMounted) return;
                     if (newAttemptError) {
                         // Check for the specific schema cache error
                         if (newAttemptError.message.includes("column") && newAttemptError.message.includes("does not exist")) {
                             const specificError = `Ошибка базы данных: Колонка (например, 'status' или 'metadata') не найдена в таблице 'vpr_test_attempts'. Проверьте SQL схему и обновите кэш Supabase. (${newAttemptError.message})`;
                             setError(specificError);
                             throw new Error(specificError); // Throw specific error
                         }
                         throw new Error(`Не удалось создать новую попытку: ${newAttemptError.message}`);
                     }
                     if (!newAttemptData) throw new Error('Не удалось получить данные новой попытки после создания.');
                     attemptToUse = newAttemptData;
                     debugLogger.log(`New attempt created ID: ${attemptToUse.id}`);
                     setFinalScore(0);
                }

                setCurrentAttempt(attemptToUse); // Set attempt state

                // --- Determine initial state (completed, active, etc.) ---
                const resumeIndex = Math.max(0, attemptToUse.last_question_index);
                const validResumeIndex = Math.min(resumeIndex, loadedQuestionCount);

                if (attemptToUse.completed_at || (validResumeIndex >= loadedQuestionCount && loadedQuestionCount > 0)) {
                    debugLogger.log(`Attempt ID ${attemptToUse.id} already completed.`);
                    setCurrentQuestionIndex(loadedQuestionCount);
                    setIsTestComplete(true);
                    setFinalScore(attemptToUse.score ?? 0);
                    setIsTimerRunning(false);
                 } else if (loadedQuestionCount === 0) {
                    debugLogger.error("No questions loaded, cannot proceed.");
                    throw new Error("Вопросы не загрузились, тест не может быть продолжен.");
                 } else {
                    setCurrentQuestionIndex(validResumeIndex);
                    debugLogger.log(`Setting current question index to: ${validResumeIndex}`);

                    const currentQ = questionData[validResumeIndex];
                    const currentAnswers = currentQ?.vpr_answers || [];
                    const isNonAnswerable = currentAnswers.length > 0 && currentAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
                    setIsCurrentQuestionNonAnswerable(isNonAnswerable);
                    debugLogger.log(`Is current question (${validResumeIndex}) non-answerable? ${isNonAnswerable}`);

                    const shouldTimerRun = !isDummyModeActive && !isDummyModeGloballyDisabled;
                    setIsTimerRunning(shouldTimerRun);
                    debugLogger.log(`Attempt is active. Timer running: ${shouldTimerRun}`);
                 }

            } catch (err: any) {
                if (!isMounted) return;
                debugLogger.error("Error during test initialization:", err);
                // Use specific error if set, otherwise use generic message
                const errorMsg = error || err.message || 'Произошла ошибка при загрузке теста. Попробуйте сбросить.';
                setError(errorMsg);
                setIsTimerRunning(false);
                setSubject(null); setQuestions([]); setCurrentAttempt(null); setSelectedVariant(null); // Clear potentially inconsistent data
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
     // Dependencies: user/dbUser for auth, subjectId state, resetCounter for manual trigger, token/loading for context, global disable flag.
     }, [user, dbUser, subjectId, resetCounter, token, isUserLoading, isDummyModeGloballyDisabled, error, isLoading]); // Added error, isLoading to deps


    // --- Answer Handling ---
    const handleAnswer = useCallback(async (selectedAnswer: VprAnswerData) => {
        if (isDummyModeActive) {
            debugLogger.log("Answer clicked while Dummy Mode is active. Ignoring.");
            toast.info("В Режиме Подсказок выбор ответа отключен.", { duration: 2000 });
            return;
        }
        const currentQ = questions[currentQuestionIndex];
        if (!currentAttempt || !currentQ || showFeedback || isTestComplete || isSaving || !isTimerRunning || timeUpModal) {
             debugLogger.warn("handleAnswer prevented:", { attempt:!!currentAttempt, q:!!currentQ, feedback: showFeedback, complete: isTestComplete, saving: isSaving, timer: isTimerRunning, timeUp: timeUpModal });
             return;
        }

        debugLogger.log(`Handling answer: Answer ID ${selectedAnswer.id}, Question ID ${currentQ.id}, Attempt: ${currentAttempt.id}`);
        setIsTimerRunning(false); // Pause timer
        setIsSaving(true);
        setSelectedAnswerId(selectedAnswer.id);
        setError(null); // Clear errors

        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct);
        setFeedbackExplanation(currentQ?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true);

        const currentScore = typeof currentAttempt.score === 'number' ? currentAttempt.score : 0;
        const newScore = currentScore + (correct ? 1 : 0);
        debugLogger.log(`Answer Correct: ${correct}. Score: ${currentScore} -> ${newScore}`);

        try {
            // *** SECURITY WARNING: Using supabaseAdmin on the client is insecure. ***
            // Record answer selection
            debugLogger.log("Recording answer to DB...");
            const { error: recordError } = await supabaseAdmin.from('vpr_attempt_answers').insert({
                attempt_id: currentAttempt.id,
                question_id: currentQ.id,
                selected_answer_id: selectedAnswer.id,
                was_correct: correct
            });
             if (recordError && recordError.code !== '23505') { throw new Error(`Ошибка записи ответа: ${recordError.message}`); }
             else if (recordError?.code === '23505') { debugLogger.warn("Attempt answer already recorded. Ignoring duplicate."); }
             else { debugLogger.log("Answer recorded successfully."); }

            // Update attempt score
            debugLogger.log("Updating attempt score in DB...");
            const { data: updatedData, error: updateScoreError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update({ score: newScore }) // Only update score here
                .eq('id', currentAttempt.id)
                .select() // Select updated row
                .single();

             if (updateScoreError) {
                 // Check for the specific schema cache error
                 if (updateScoreError.message.includes("column") && updateScoreError.message.includes("does not exist")) {
                     const specificError = `Ошибка базы данных: Колонка не найдена при обновлении счета. (${updateScoreError.message})`;
                     setError(specificError);
                     throw new Error(specificError);
                 }
                 throw new Error(`Ошибка обновления счета: ${updateScoreError.message}`);
             }
            if (!updatedData) throw new Error("Attempt data not returned after score update.");

            setCurrentAttempt(updatedData); // Update local state with confirmed data
            debugLogger.log("Attempt score updated successfully in local state:", updatedData);

        } catch (err: any) {
            debugLogger.error("Error saving answer/score:", err);
            const errorMsg = error || `Не удалось сохранить результат: ${err.message}`;
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
             setIsSaving(false);
             // Timer remains paused, handled by handleNextQuestion
        }
    }, [currentAttempt, showFeedback, isTestComplete, isSaving, isTimerRunning, timeUpModal, questions, currentQuestionIndex, isDummyModeActive, error]); // Added error dependency


    // --- Navigation Logic ---
    const handleNextQuestion = useCallback(async (isSkip: boolean = false) => {
        if (!currentAttempt || isSaving || isTestComplete || timeUpModal || !questions.length) {
            debugLogger.warn("handleNextQuestion prevented:", { saving: isSaving, complete: isTestComplete, timeUp: timeUpModal, qLen: questions.length });
            return;
        }

        const currentQIndex = currentQuestionIndex;
        const nextIndex = currentQIndex + 1;
        const isFinishing = nextIndex >= questions.length;
        debugLogger.log(`Handling next question. From: ${currentQIndex}, To: ${nextIndex}, Finishing: ${isFinishing}, Skip: ${isSkip}, DummyActive: ${isDummyModeActive}`);

        setIsSaving(true);
        setShowFeedback(false); setSelectedAnswerId(null); setIsCorrect(false); setFeedbackExplanation(null);
        setError(null); // Clear errors

        let nextIsNonAnswerable = false;
        if (!isFinishing) {
            const nextQ = questions[nextIndex]; const nextAnswers = nextQ?.vpr_answers || [];
            nextIsNonAnswerable = nextAnswers.length > 0 && nextAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
            debugLogger.log(`Next question (${nextIndex}) non-answerable? ${nextIsNonAnswerable}`);
        }

        try {
            // *** SECURITY WARNING: Using supabaseAdmin on the client is insecure. ***
            const updates: Partial<VprTestAttempt> = isFinishing
                ? { last_question_index: questions.length, completed_at: new Date().toISOString(), status: 'completed' } // Requires 'status' column
                : { last_question_index: nextIndex, status: 'in_progress' }; // Requires 'status' column

            debugLogger.log(`Updating attempt progress/completion in DB to index: ${updates.last_question_index}, Status: ${updates.status}`);

            const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update(updates)
                .eq('id', currentAttempt.id)
                .select()
                .single();

            if (updateError) {
                 // Check for the specific schema cache error
                 if (updateError.message.includes("column") && updateError.message.includes("does not exist")) {
                     const specificError = `Ошибка базы данных: Колонка (например, 'status') не найдена при обновлении прогресса. (${updateError.message})`;
                     setError(specificError);
                     throw new Error(specificError);
                 }
                throw new Error(`Ошибка обновления прогресса: ${updateError.message}`);
            }
            if (!updatedAttempt) throw new Error("Attempt not found after update.");

            setCurrentAttempt(updatedAttempt); // Update local state *first*

            if (!isFinishing) {
                setCurrentQuestionIndex(nextIndex);
                setIsCurrentQuestionNonAnswerable(nextIsNonAnswerable);
                const shouldTimerRun = !isDummyModeActive && !isDummyModeGloballyDisabled;
                setIsTimerRunning(shouldTimerRun);
                debugLogger.log(`Moved to question index: ${nextIndex}. Timer running: ${shouldTimerRun}.`);
            } else {
                // Finishing the test
                setIsCurrentQuestionNonAnswerable(false);
                setIsTimerRunning(false); // Stop timer
                setIsTestComplete(true);
                setFinalScore(updatedAttempt.score ?? 0);
                debugLogger.log("Test marked as complete. Final Score from DB:", updatedAttempt.score);
                toast.success("Тест завершен!", { duration: 4000 });

                // --- Notify Admin (Normal Completion - Verbose) ---
                 if (user && dbUser && subject && updatedAttempt && updatedAttempt.id) {
                     const score = updatedAttempt.score ?? 0;
                     const total = typeof updatedAttempt.total_questions === 'number' ? updatedAttempt.total_questions : questions.length;
                     const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : '0.0';
                     let durationStr = 'N/A', startTimeStr = 'N/A', endTimeStr = 'N/A';

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
                        await notifyAdmins(message);
                        debugLogger.log(`Admin notified (VERBOSE) of normal test completion. Attempt ID: ${updatedAttempt.id}`);
                    } catch (notifyError) {
                        debugLogger.error("Failed to notify admin about normal completion (VERBOSE):", notifyError);
                    }
                 } else {
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
            const errorMsg = error || `Не удалось сохранить прогресс (${err.message}). Попробуйте обновить страницу.`;
            setError(errorMsg);
            toast.error("Ошибка сохранения прогресса.");
            // Stop timer if navigation failed before completion
            if (!isFinishing) setIsTimerRunning(false);
        } finally {
            setIsSaving(false);
        }
    }, [currentAttempt, isSaving, isTestComplete, timeUpModal, questions, currentQuestionIndex, user, dbUser, subject, isDummyModeActive, isDummyModeGloballyDisabled, error]); // Added error dependency


    // --- Reset Logic ---
     const resetTest = useCallback(async () => {
         if (isSaving) {
             toast.warning("Подождите, идет сохранение...");
             return;
         }
         debugLogger.log("Reset button clicked.");
         setIsLoading(true); // Show loading indicator
         setError(null); // Clear errors before reset

         try {
             // Stop ongoing processes
             setIsTimerRunning(false);
             setIsDummyModeActive(false);

             // Attempt to delete any incomplete attempts
             if (user?.id && subjectId) {
                 debugLogger.log(`Attempting to delete ANY active attempt for subject ${subjectId} and user ${user.id} before reset.`);
                 // *** SECURITY WARNING: Using supabaseAdmin on the client is insecure. ***
                 const { error: deleteError } = await supabaseAdmin
                     .from('vpr_test_attempts')
                     .delete()
                     .eq('user_id', user.id)
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

             // Reset frontend state *before* triggering re-fetch
             setCurrentAttempt(null); setQuestions([]); setCurrentQuestionIndex(0);
             setSelectedVariant(null); setSubject(null);
             setFinalScore(0); setIsTestComplete(false); setShowFeedback(false);
             setSelectedAnswerId(null); setTimeUpModal(false);
             setShowDescription(false); setFeedbackExplanation(null); setIsCorrect(false);
             setIsCurrentQuestionNonAnswerable(false);

             toast.info("Сброс теста...", { duration: 1500});
             // Trigger the useEffect hook to re-fetch and re-initialize
             setResetCounter(prev => prev + 1);
             debugLogger.log("Reset counter incremented, useEffect will re-run.");

         } catch (err: any) {
              debugLogger.error("Error during reset process:", err);
              setError(`Ошибка сброса теста: ${err.message}`);
              setIsLoading(false); // Ensure loading stops if reset fails
         }
         // setIsLoading(false) is handled by the useEffect upon successful/failed re-fetch
     }, [isSaving, user?.id, subjectId]);


    // --- Purchase/Toggle Dummy Mode ---
    const handlePurchaseDisableDummy = useCallback(async () => {
        if (!user?.id || !dbUser?.id) {
            toast.error("Не удалось определить пользователя для покупки.");
            return;
        }
        if (isPurchasingDisable || isDummyModeGloballyDisabled) {
             if (isDummyModeGloballyDisabled) {
                 toast.info("Режим подсказок уже отключен родителем.", { duration: 3000 });
             }
             return;
        }

        debugLogger.log(`Attempting to purchase DISABLE Dummy Mode feature for user ID: ${user.id}`);
        setIsPurchasingDisable(true);
        toast.loading("Отправка запроса на покупку...", { id: "purchase-disable-dummy" });
        setError(null); // Clear errors

        try {
            // Call the server action
            const result = await purchaseDisableDummyMode(user.id); // Pass TG user ID

            if (result.success) {
                if (result.alreadyDisabled) {
                    toast.success("Режим подсказок уже отключен для этого пользователя.", { id: "purchase-disable-dummy" });
                    // Need mechanism to refresh dbUser state here if AppContext doesn't auto-update
                } else {
                    toast.success("Счет на отключение режима подсказок отправлен в Telegram! Пожалуйста, оплатите его там.", { id: "purchase-disable-dummy", duration: 6000 });
                }
            } else {
                throw new Error(result.error || "Неизвестная ошибка при запросе покупки.");
            }
        } catch (error: any) {
            debugLogger.error("Failed to initiate disable dummy mode purchase:", error);
            const errorMsg = `Ошибка покупки: ${error.message}`;
            setError(errorMsg); // Set error state
            toast.error(errorMsg, { id: "purchase-disable-dummy" });
        } finally {
            setIsPurchasingDisable(false);
        }
    }, [user, dbUser, isPurchasingDisable, isDummyModeGloballyDisabled]);

    const toggleDummyMode = useCallback(() => {
        if (isDummyModeGloballyDisabled) {
             toast.info("Режим подсказок отключен родителем и не может быть включен.", { duration: 3000 });
             return;
        }
        if (isTestComplete || timeUpModal || isSaving) {
            debugLogger.log("Dummy mode toggle prevented: Test complete, time up, or saving.");
            return;
        }

        setIsDummyModeActive(prev => {
            const newState = !prev;
            debugLogger.log(`Dummy Mode Toggled: ${newState}`);
            if (newState) {
                // Turning ON
                setIsTimerRunning(false); // Pause timer
                setShowFeedback(false); // Hide normal feedback
                setSelectedAnswerId(null); // Clear selection
                toast.info("🧠 Режим Подсказок ВКЛ", { duration: 1500 });
            } else {
                // Turning OFF
                // Restart timer ONLY if the test is ongoing, not showing feedback, not timed out
                if (!isTestComplete && !showFeedback && !timeUpModal) {
                     setIsTimerRunning(true);
                }
                toast.info("💪 Режим Подсказок ВЫКЛ", { duration: 1500 });
            }
            return newState;
        });
    }, [isDummyModeGloballyDisabled, isTestComplete, timeUpModal, isSaving, showFeedback]); // Added dependencies


    // --- Rendering Logic ---

    // Primary loading state: Waits for user context OR initial test data load OR valid subjectId
    if (isUserLoading || isLoading || (subjectId === null && !error)) {
        const loadingText = isUserLoading ? "Загрузка пользователя..." : (subjectId === null ? "Проверка ID предмета..." : "Загрузка теста...");
        // Use the VprLoadingIndicator component directly
        return <VprLoadingIndicator />; // Assuming it shows a generic "Loading..." or takes a prop
    }

    // Error state: If error occurred (during init OR ID parsing)
    if (error) {
        // Provide retry only if it makes sense (e.g., not invalid ID error)
        const allowRetry = subjectId !== null && !error.includes("ID предмета в URL");
        return <VprErrorDisplay error={error} onRetry={allowRetry ? resetTest : undefined} />;
    }

    // Completion screen: Shown when `isTestComplete` is true
    if (isTestComplete) {
        if (!currentAttempt) {
             debugLogger.error("Completion screen cannot render: currentAttempt is null.");
             return <VprErrorDisplay error="Ошибка: Не удалось загрузить данные завершенной попытки." onRetry={resetTest} />;
        }
        return ( <VprCompletionScreen
                    subjectName={subject?.name ?? "Тест"} // Fallback subject name
                    variantNumber={currentAttempt.variant_number}
                    finalScore={finalScore}
                    totalQuestions={currentAttempt.total_questions ?? questions.length}
                    onReset={resetTest}
                    onGoToList={() => router.push('/vpr-tests')} /> );
    }

    // --- Critical Data Check before rendering main test UI ---
    // Ensure all core data needed for the test UI is present
    if (!currentAttempt || !currentAttempt.id || !subject || questions.length === 0 || selectedVariant === null) {
         debugLogger.error("Critical data missing before rendering main test UI:", {
             hasAttempt: !!currentAttempt?.id,
             hasSubject: !!subject,
             qCount: questions.length,
             hasVariant: selectedVariant !== null,
             isLoading, isTestComplete, error
         });
         return <VprErrorDisplay error={"Ошибка: Не удалось загрузить основные данные теста. Попробуйте сбросить тест."} onRetry={resetTest} />;
    }

    // Get data for the current question safely *after* critical data check
    const currentQuestionData = (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length)
                                 ? questions[currentQuestionIndex]
                                 : null;

    if (!currentQuestionData) {
        debugLogger.error("currentQuestionData is null for index:", currentQuestionIndex, `(Total: ${questions.length})`);
        return <VprErrorDisplay error={`Ошибка: Не удалось загрузить данные вопроса #${currentQuestionIndex + 1}. Попробуйте сбросить тест.`} onRetry={resetTest} />;
    }
    // --- End Critical Data Checks ---

    // --- Prepare data/variables for rendering ---
    const answersForCurrent = currentQuestionData.vpr_answers || [];
    const showSavingOverlay = isSaving;
    const shouldShowExplanation = (isDummyModeActive && !isCurrentQuestionNonAnswerable) || showFeedback;
    const explanationToShow = isDummyModeActive
                                ? (currentQuestionData?.explanation || "Объяснение отсутствует.")
                                : feedbackExplanation;
    const explanationIsCorrectState = isDummyModeActive ? true : isCorrect;

    // --- Render Main Test UI ---
    return (
        <TooltipProvider>
            <motion.div
                key={currentAttempt.id} // Use attempt ID for main container animation key
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
                        <VprHeader
                            subjectName={subject.name} // Guaranteed non-null here
                            variantNumber={selectedVariant} // Guaranteed non-null here
                            showDescriptionButton={!!subject.description}
                            isDescriptionShown={showDescription}
                            onToggleDescription={() => setShowDescription(!showDescription)}
                            timerKey={timerKey}
                            timeLimit={timeLimit}
                            onTimeUp={handleTimeUp}
                            isTimerRunning={isTimerRunning && !showSavingOverlay && !isTestComplete && !timeUpModal && !isDummyModeActive && !isDummyModeGloballyDisabled}
                        />
                        {/* --- Dummy Mode Controls --- */}
                         <div className="flex items-center space-x-3 self-center sm:self-auto">
                             {!isDummyModeGloballyDisabled ? (
                                 <Tooltip>
                                     <TooltipTrigger asChild>
                                         <div className="flex items-center space-x-2">
                                             <Sparkles className={`h-5 w-5 transition-colors ${isDummyModeActive ? 'text-yellow-400 animate-pulse' : 'text-gray-500'}`} />
                                             <Switch
                                                 id="dummy-mode-toggle"
                                                 checked={isDummyModeActive}
                                                 onCheckedChange={toggleDummyMode}
                                                 disabled={isTestComplete || timeUpModal || isSaving}
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

                            {!isDummyModeGloballyDisabled && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePurchaseDisableDummy}
                                            disabled={isPurchasingDisable || !user?.id || !dbUser?.id}
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
                    <VprDescription description={subject.description} show={showDescription} />

                    {/* Progress Indicator */}
                    <VprProgressIndicator current={currentQuestionIndex} total={questions.length} />

                    {/* Question and Answer Area (Animated on question change) */}
                     <motion.div
                        key={currentQuestionIndex} // Animate content swap when question index changes
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="mb-auto" // Push content down
                    >
                         {/* Question Content - Pass guaranteed non-null questionData */}
                         <VprQuestionContent
                             questionData={currentQuestionData}
                             questionNumber={currentQuestionIndex + 1}
                             totalQuestions={questions.length}
                         />
                         {/* Answer Options List */}
                         <VprAnswerList
                            answers={answersForCurrent}
                            selectedAnswerId={selectedAnswerId}
                            showFeedback={showFeedback}
                            timeUpModal={timeUpModal}
                            handleAnswer={handleAnswer}
                            isDummyModeActive={isDummyModeActive}
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
