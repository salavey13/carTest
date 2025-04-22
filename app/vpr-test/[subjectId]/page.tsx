"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Loader2, Sparkles, Lock } from "lucide-react";

// Removed supabaseAdmin import from client
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

// Import VPR components (paths remain same)
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
// Import Server Actions
import {
    startOrResumeVprAttempt,
    recordVprAnswer,
    updateVprAttemptProgress,
    forceCompleteVprAttempt,
    resetVprTest
} from "@/app/actions/vprActions"; // Adjusted path
import { purchaseDisableDummyMode } from "@/app/actions/dummy_actions"; // Keep this one

// --- Interfaces (Can potentially be moved to a shared types file) ---
export interface SubjectData { // Export if needed by actions, otherwise keep internal
    id: number;
    name: string;
    description?: string;
    grade_level?: number;
}
export interface VprQuestionData {
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
export interface VprTestAttempt {
    id: string; // UUID typically
    user_id: string;
    subject_id: number;
    variant_number: number;
    started_at: string; // ISO timestamp string
    completed_at?: string | null; // ISO timestamp string or null
    score?: number | null;
    total_questions: number;
    last_question_index: number;
    status?: string | null;
    metadata?: Record<string, any> | null;
    created_at?: string;
    updated_at?: string;
}
// --- End Interfaces ---

export default function VprTestPage() {
    // --- States ---
    const { user, dbUser, isLoading: isUserLoading } = useAppContext(); // Removed token, no longer needed directly here
    const params = useParams();
    const router = useRouter();
    const subjectIdParam = params.subjectId as string;
    const [subjectId, setSubjectId] = useState<number | null>(null);

    // Component States (mostly UI related now)
    const [subject, setSubject] = useState<SubjectData | null>(null);
    const [questions, setQuestions] = useState<VprQuestionData[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAttempt, setCurrentAttempt] = useState<VprTestAttempt | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false); // Still useful for disabling buttons during action calls
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
    const [timeLimit] = useState(3600);
    const [timeUpModal, setTimeUpModal] = useState(false);
    const [isCurrentQuestionNonAnswerable, setIsCurrentQuestionNonAnswerable] = useState(false);
    const [resetCounter, setResetCounter] = useState(0); // Still used to trigger re-initialization
    const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
    const [isDummyModeActive, setIsDummyModeActive] = useState(false);
    const [isPurchasingDisable, setIsPurchasingDisable] = useState(false);

    // Derived State
    const isDummyModeGloballyDisabled = dbUser?.metadata?.is_dummy_mode_disabled_by_parent === true;

    // --- Parse subjectId safely ---
    useEffect(() => {
        const parsedId = parseInt(subjectIdParam, 10);
        debugLogger.log(`Parsing subjectIdParam: ${subjectIdParam} -> ${parsedId}`);
        if (!isNaN(parsedId)) {
            // Only update if different to avoid unnecessary re-renders
            if (subjectId !== parsedId) {
                setSubjectId(parsedId);
                // Reset error ONLY if it was specifically the URL error
                if (error === "Неверный ID предмета в URL.") setError(null);
            }
        } else {
            setError("Неверный ID предмета в URL.");
            setIsLoading(false); // Stop loading if ID is invalid from the start
            setSubjectId(null);
        }
    }, [subjectIdParam, error, subjectId]); // Added subjectId to prevent loops if param changes but result is same


    // --- Timer Functions ---
    const handleTimeUp = useCallback(() => {
        debugLogger.log("Timer: Time is up!");
        if (!isTestComplete && !timeUpModal && !isDummyModeActive) {
            setIsTimerRunning(false);
            setShowFeedback(false);
            setTimeUpModal(true);
        } else if (isDummyModeActive) {
            debugLogger.log("Timer: Time up ignored, Dummy Mode is active.");
        }
    }, [isTestComplete, timeUpModal, isDummyModeActive]);

    // Refactored to use Server Action
    const completeTestDueToTime = useCallback(async () => {
         setTimeUpModal(false);
         if (!currentAttempt || isSaving || isTestComplete) return;
         debugLogger.log("Completing test due to time up via action for attempt:", currentAttempt.id);
         setIsSaving(true);
         setError(null);

         try {
             const currentScore = currentAttempt.score || 0;
             const totalQ = currentAttempt.total_questions || questions.length || 0; // Get total questions safely

             // Call Server Action
             const result = await forceCompleteVprAttempt(currentAttempt.id, currentScore, totalQ);

              if (!result.success || !result.updatedAttempt) {
                  throw new Error(result.error || "Не удалось принудительно завершить тест через сервер.");
              }

              // Update client state based on server action result
              setCurrentAttempt(result.updatedAttempt);
              setIsTestComplete(true);
              setFinalScore(result.updatedAttempt.score ?? 0);
              toast.warning("Время вышло! Тест завершен.", { duration: 5000 });
              // Admin notification is handled within the server action

         } catch (err: any) {
             debugLogger.error("Error forcing test completion via action:", err);
             setError(err.message || "Не удалось завершить тест.");
             toast.error("Ошибка принудительного завершения теста.");
         } finally {
            setIsSaving(false);
         }
    }, [currentAttempt, isSaving, isTestComplete, questions.length]); // Removed dependencies not needed by action call


    // --- Data Fetching & Attempt Handling (Refactored to use Server Action) ---
    useEffect(() => {
        // --- Early Exits ---
        if (subjectId === null && !error) {
            if (!isLoading) setIsLoading(true);
            debugLogger.log("useEffect waiting for valid subjectId.");
            return;
        }
         if (isUserLoading) {
             if (!isLoading) setIsLoading(true);
            debugLogger.log("useEffect waiting for user data from AppContext...");
            return;
        }
        if (error) {
             debugLogger.log(`useEffect aborted due to existing error: ${error}`);
             if (isLoading) setIsLoading(false);
             return;
        }
        if (!user?.id) {
             debugLogger.error("No user ID found in AppContext after loading.");
             setError("Не удалось получить данные пользователя. Попробуйте перезайти.");
             if (isLoading) setIsLoading(false); // Stop loading on critical error
             return;
        }
        if (typeof subjectId !== 'number' || isNaN(subjectId)) {
             debugLogger.error(`Invalid subjectId in main effect: ${subjectId}`);
             setError("Внутренняя ошибка: ID предмета не установлен.");
             if (isLoading) setIsLoading(false); // Stop loading on critical error
             return;
        }
        // --- End Early Exits ---

        debugLogger.log(`Initialize effect running for Subject: ${subjectId}, User: ${user.id}, Reset: ${resetCounter}`);
        let isMounted = true;

        const initialize = async () => {
            if (!isMounted) return;
            debugLogger.log("Initialize action starting...");
            setIsLoading(true);
            setError(null); // Clear previous errors before fetching

            // Call the server action to get all initial data
            const result = await startOrResumeVprAttempt(user.id, subjectId);

            if (!isMounted) return; // Check again after await

            if (result.error || !result.attempt || !result.subject || result.selectedVariant === null) {
                debugLogger.error("Initialization failed:", result.error || "Missing data from server action.");
                setError(result.error || "Не удалось загрузить данные теста.");
                // Clear potentially inconsistent state if action failed partially
                setCurrentAttempt(null); setSubject(null); setQuestions([]); setSelectedVariant(null);
            } else {
                // --- Success: Update client state from action result ---
                debugLogger.log("Initialization successful. Setting state.");
                setCurrentAttempt(result.attempt);
                setSubject(result.subject);
                setQuestions(result.questions);
                setSelectedVariant(result.selectedVariant);
                setFinalScore(result.attempt.score || 0);

                const loadedQuestionCount = result.questions.length;
                const resumeIndex = Math.max(0, result.attempt.last_question_index);
                const validResumeIndex = Math.min(resumeIndex, loadedQuestionCount); // Index cannot exceed length

                if (result.attempt.completed_at || (validResumeIndex >= loadedQuestionCount && loadedQuestionCount > 0)) {
                    debugLogger.log(`Attempt ${result.attempt.id} already completed.`);
                    setCurrentQuestionIndex(loadedQuestionCount);
                    setIsTestComplete(true);
                    setIsTimerRunning(false);
                 } else if (loadedQuestionCount === 0) {
                    debugLogger.error("No questions loaded, cannot proceed.");
                    setError("Вопросы не загрузились, тест не может быть продолжен.");
                    setIsTimerRunning(false);
                 } else {
                     // Attempt is active
                    setIsTestComplete(false); // Ensure test is not marked complete
                    setCurrentQuestionIndex(validResumeIndex);
                    debugLogger.log(`Setting current question index to: ${validResumeIndex}`);

                    const currentQ = result.questions[validResumeIndex];
                    const currentAnswers = currentQ?.vpr_answers || [];
                    const isNonAnswerable = currentAnswers.length > 0 && currentAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
                    setIsCurrentQuestionNonAnswerable(isNonAnswerable);

                    // Reset dummy mode state on each successful initialization
                    setIsDummyModeActive(false);
                    // Start timer only if active, not dummy, and not globally disabled
                    const shouldTimerRun = !isDummyModeGloballyDisabled; // Start assuming dummy is off initially
                    setIsTimerRunning(shouldTimerRun);
                    debugLogger.log(`Attempt is active. Timer running: ${shouldTimerRun}`);
                 }
            }
            // --- End Success ---

            setIsLoading(false); // Stop loading regardless of success/error
            debugLogger.log("Initialize action finished.");
        };

        initialize();

        // Cleanup function
        return () => {
            isMounted = false;
            debugLogger.log("useEffect cleanup triggered.");
        };
     // Dependencies trigger re-initialization if user, subject, or resetCounter changes
     }, [user, subjectId, resetCounter, isUserLoading, isDummyModeGloballyDisabled]); // Removed error, token


    // --- Answer Handling (Refactored to use Server Action) ---
    const handleAnswer = useCallback(async (selectedAnswer: VprAnswerData) => {
        if (isDummyModeActive) {
            toast.info("В Режиме Подсказок выбор ответа отключен.", { duration: 2000 });
            return;
        }
        const currentQ = questions[currentQuestionIndex];
        if (!currentAttempt || !currentQ || showFeedback || isTestComplete || isSaving || !isTimerRunning || timeUpModal) {
             debugLogger.warn("handleAnswer prevented: UI/State checks failed.");
             return;
        }

        debugLogger.log(`Handling answer UI: Answer ID ${selectedAnswer.id}`);
        setIsTimerRunning(false); // Pause timer visually
        setIsSaving(true); // Show saving state
        setSelectedAnswerId(selectedAnswer.id);
        setError(null);

        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct); // Update UI feedback state immediately
        setFeedbackExplanation(currentQ?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true);

        const currentScore = typeof currentAttempt.score === 'number' ? currentAttempt.score : 0;

        // Call Server Action to record answer and update score
        const result = await recordVprAnswer(
            currentAttempt.id,
            currentQ.id,
            selectedAnswer.id,
            correct,
            currentScore
        );

        setIsSaving(false); // Hide saving state

        if (!result.success || !result.updatedAttempt) {
            debugLogger.error("Failed to record answer via action:", result.error);
            setError(result.error || "Не удалось сохранить ответ.");
            toast.error(result.error || "Не удалось сохранить ответ.");
            // Optionally revert UI feedback? Or leave it to show user their choice?
            // setShowFeedback(false); setIsCorrect(false); setSelectedAnswerId(null);
        } else {
            debugLogger.log("Answer recorded successfully via action. Updating local attempt state.");
            // Sync local state with the confirmed state from the server
            setCurrentAttempt(result.updatedAttempt);
            // Score is already updated in the attempt object
        }
         // Timer remains paused, handled by handleNextQuestion
    }, [currentAttempt, showFeedback, isTestComplete, isSaving, isTimerRunning, timeUpModal, questions, currentQuestionIndex, isDummyModeActive]);


    // --- Navigation Logic (Refactored to use Server Action) ---
    const handleNextQuestion = useCallback(async (isSkip: boolean = false) => {
        if (!currentAttempt || isSaving || isTestComplete || timeUpModal || !questions.length) {
            debugLogger.warn("handleNextQuestion prevented: UI/State checks failed.");
            return;
        }

        const currentQIndex = currentQuestionIndex;
        const nextIndex = currentQIndex + 1;
        const totalQ = questions.length; // Use current questions length
        const isFinishing = nextIndex >= totalQ;

        debugLogger.log(`Handling next question UI. From: ${currentQIndex}, To: ${nextIndex}, Finishing: ${isFinishing}, Skip: ${isSkip}`);
        setIsSaving(true);
        setShowFeedback(false); setSelectedAnswerId(null); setIsCorrect(false); setFeedbackExplanation(null);
        setError(null);

        // Call Server Action to update progress/completion
        const result = await updateVprAttemptProgress(currentAttempt.id, nextIndex, totalQ);

        setIsSaving(false);

        if (!result.success || !result.updatedAttempt) {
            debugLogger.error("Failed to update progress via action:", result.error);
            setError(result.error || "Не удалось сохранить прогресс.");
            toast.error(result.error || "Не удалось сохранить прогресс.");
            // Stop timer if navigation failed
            setIsTimerRunning(false);
        } else {
            debugLogger.log("Progress update successful via action. Updating local state.");
            // Sync local state with the confirmed state from the server
            setCurrentAttempt(result.updatedAttempt);

            if (!isFinishing) {
                setCurrentQuestionIndex(nextIndex);
                // Check if next question is non-answerable
                const nextQ = questions[nextIndex];
                const nextAnswers = nextQ?.vpr_answers || [];
                const nextIsNonAnswerable = nextAnswers.length > 0 && nextAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));
                setIsCurrentQuestionNonAnswerable(nextIsNonAnswerable);

                // Timer logic: Run only if NOT finishing AND dummy mode is OFF (and not globally disabled)
                const shouldTimerRun = !isDummyModeActive && !isDummyModeGloballyDisabled;
                setIsTimerRunning(shouldTimerRun);
                debugLogger.log(`Moved to question index: ${nextIndex}. Timer running: ${shouldTimerRun}.`);
            } else {
                // Finishing the test
                setIsCurrentQuestionNonAnswerable(false);
                setIsTimerRunning(false); // Ensure timer stops
                setIsTestComplete(true);
                setFinalScore(result.updatedAttempt.score ?? 0); // Use score from the final updated attempt
                debugLogger.log("Test marked as complete locally. Final Score:", result.updatedAttempt.score);
                toast.success("Тест завершен!", { duration: 4000 });
                // Admin notification handled by server action
            }
        }
    }, [currentAttempt, isSaving, isTestComplete, timeUpModal, questions, currentQuestionIndex, isDummyModeActive, isDummyModeGloballyDisabled]);


    // --- Reset Logic (Refactored to use Server Action) ---
     const resetTest = useCallback(async () => {
         if (isSaving) {
             toast.warning("Подождите, идет сохранение...");
             return;
         }
         debugLogger.log("Reset button clicked.");
         setIsSaving(true); // Indicate saving during reset process
         setError(null);

         try {
             // Stop timer visually
             setIsTimerRunning(false);
             setIsDummyModeActive(false);

             // Call server action to delete attempts
             if (user?.id && subjectId) {
                 const result = await resetVprTest(user.id, subjectId);
                 if (!result.success) {
                     // Log the error but proceed with UI reset and re-initialization
                     debugLogger.error("Error deleting active attempt(s) during reset:", result.error);
                     toast.warning(result.error || "Не удалось удалить предыдущую попытку.");
                 } else {
                     debugLogger.log("Active attempts deleted successfully via action.");
                 }
             } else {
                 debugLogger.warn("Cannot delete active attempt during reset: missing user ID or subject ID.");
             }

             // Reset UI state immediately after action call (success or fail)
             setCurrentAttempt(null); setQuestions([]); setCurrentQuestionIndex(0);
             setSelectedVariant(null); setSubject(null);
             setFinalScore(0); setIsTestComplete(false); setShowFeedback(false);
             setSelectedAnswerId(null); setTimeUpModal(false);
             setShowDescription(false); setFeedbackExplanation(null); setIsCorrect(false);
             setIsCurrentQuestionNonAnswerable(false);

             toast.info("Сброс теста...", { duration: 1500});
             // Increment counter to trigger the main useEffect to re-fetch and re-initialize
             setResetCounter(prev => prev + 1);
             debugLogger.log("Reset counter incremented, useEffect will re-run initialization.");

         } catch (err: any) { // Catch errors from the action call itself
              debugLogger.error("Error calling resetVprTest action:", err);
              setError(`Ошибка сброса теста: ${err.message}`);
         } finally {
             setIsSaving(false); // Stop saving indicator
             // Loading state is handled by the main useEffect triggered by resetCounter
         }
     }, [isSaving, user?.id, subjectId]);


    // --- Purchase/Toggle Dummy Mode (Logic remains client-side, calls server action) ---
    const handlePurchaseDisableDummy = useCallback(async () => {
        // Requires both target (dbUser.id) and requester (user.id?)
        // Adjust based on who should receive the invoice
        if (!user?.id || !dbUser?.id) {
            toast.error("Не удалось определить пользователя для покупки.");
            return;
        }
         // Use dbUser.id as the target for disabling
        const targetUserId = dbUser.id;
        // Assuming the currently logged-in user (user.id) is the requester
        const requesterUserId = user.id;

        if (isPurchasingDisable || isDummyModeGloballyDisabled) {
             if (isDummyModeGloballyDisabled) {
                 toast.info("Режим подсказок уже отключен родителем.", { duration: 3000 });
             }
             return;
        }

        debugLogger.log(`Attempting to purchase DISABLE Dummy Mode for target user ID: ${targetUserId} by requester ${requesterUserId}`);
        setIsPurchasingDisable(true);
        toast.loading("Отправка запроса на покупку...", { id: "purchase-disable-dummy" });
        setError(null);

        try {
            // Call the server action, passing both IDs
            const result = await purchaseDisableDummyMode(targetUserId, requesterUserId);

            if (result.success) {
                toast.dismiss("purchase-disable-dummy"); // Dismiss loading
                if (result.alreadyDisabled) {
                    toast.success(result.message || "Режим подсказок уже отключен.", { duration: 3000 });
                    // Potentially refresh dbUser context here if needed immediately
                } else {
                    toast.success(result.message || "Счет на отключение режима подсказок отправлен вам в Telegram!", { duration: 6000 });
                }
            } else {
                throw new Error(result.error || "Неизвестная ошибка при запросе покупки.");
            }
        } catch (error: any) {
            debugLogger.error("Failed to initiate disable dummy mode purchase:", error);
            const errorMsg = `Ошибка покупки: ${error.message}`;
            setError(errorMsg);
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
                setIsTimerRunning(false);
                setShowFeedback(false);
                setSelectedAnswerId(null);
                toast.info("🧠 Режим Подсказок ВКЛ", { duration: 1500 });
            } else {
                if (!isTestComplete && !showFeedback && !timeUpModal) {
                     setIsTimerRunning(true);
                }
                toast.info("💪 Режим Подсказок ВЫКЛ", { duration: 1500 });
            }
            return newState;
        });
    }, [isDummyModeGloballyDisabled, isTestComplete, timeUpModal, isSaving, showFeedback]);


    // --- Rendering Logic ---

    // Primary loading state
    if (isUserLoading || isLoading || (subjectId === null && !error)) {
        return <VprLoadingIndicator />;
    }

    // Error state
    if (error) {
        const allowRetry = subjectId !== null && !error.includes("ID предмета в URL") && !error.includes("данные пользователя");
        return <VprErrorDisplay error={error} onRetry={allowRetry ? resetTest : undefined} />;
    }

    // Completion screen
    if (isTestComplete) {
        if (!currentAttempt) {
             return <VprErrorDisplay error="Ошибка: Не удалось загрузить данные завершенной попытки." onRetry={resetTest} />;
        }
        return ( <VprCompletionScreen
                    subjectName={subject?.name ?? "Тест"}
                    variantNumber={currentAttempt.variant_number}
                    finalScore={finalScore}
                    totalQuestions={currentAttempt.total_questions ?? questions.length}
                    onReset={resetTest}
                    onGoToList={() => router.push('/vpr-tests')} /> );
    }

    // Critical Data Check - needs attempt, subject, questions, variant *after* loading/error checks passed
    if (!currentAttempt || !subject || questions.length === 0 || selectedVariant === null) {
         debugLogger.error("Critical data missing before rendering main test UI (after load/error checks passed):", {
             hasAttempt: !!currentAttempt, hasSubject: !!subject, qCount: questions.length, hasVariant: selectedVariant !== null,
         });
         // This indicates an issue with the initialization logic or server action response
         return <VprErrorDisplay error={"Критическая ошибка: Неполные данные теста после загрузки. Попробуйте сбросить."} onRetry={resetTest} />;
    }

    // Get current question data (safe now)
    const currentQuestionData = questions[currentQuestionIndex];
    if (!currentQuestionData) {
        // This should ideally not happen if index is managed correctly
        debugLogger.error("currentQuestionData is null unexpectedly for index:", currentQuestionIndex);
        return <VprErrorDisplay error={`Ошибка: Не найдены данные для вопроса #${currentQuestionIndex + 1}.`} onRetry={resetTest} />;
    }

    // Prepare render variables
    const answersForCurrent = currentQuestionData.vpr_answers || [];
    const showSavingOverlay = isSaving;
    const shouldShowExplanation = (isDummyModeActive && !isCurrentQuestionNonAnswerable) || showFeedback;
    const explanationToShow = isDummyModeActive ? (currentQuestionData.explanation || "Объяснение отсутствует.") : feedbackExplanation;
    const explanationIsCorrectState = isDummyModeActive ? true : isCorrect;

    // --- Render Main Test UI ---
    return (
        <TooltipProvider>
            <motion.div
                key={currentAttempt.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="min-h-screen bg-page-gradient text-light-text flex flex-col items-center pt-6 pb-10 px-4"
            >
                <VprTimeUpModal show={timeUpModal} onConfirm={completeTestDueToTime} />

                <div className="max-w-3xl w-full bg-dark-card shadow-xl rounded-2xl p-5 md:p-8 flex-grow flex flex-col border border-brand-blue/20 relative overflow-hidden">
                     {showSavingOverlay && (
                        <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-sm flex items-center justify-center z-40 rounded-2xl">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                            <span className="ml-3 text-light-text">Сохранение...</span>
                        </div>
                     )}

                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-y-3 flex-wrap">
                        <VprHeader
                            subjectName={subject.name}
                            variantNumber={selectedVariant}
                            showDescriptionButton={!!subject.description}
                            isDescriptionShown={showDescription}
                            onToggleDescription={() => setShowDescription(!showDescription)}
                            timerKey={timerKey}
                            timeLimit={timeLimit}
                            onTimeUp={handleTimeUp}
                            isTimerRunning={isTimerRunning && !showSavingOverlay && !isTestComplete && !timeUpModal && !isDummyModeActive && !isDummyModeGloballyDisabled}
                        />
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

                    <VprDescription description={subject.description} show={showDescription} />
                    <VprProgressIndicator current={currentQuestionIndex} total={questions.length} />

                     <motion.div
                        key={currentQuestionIndex}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="mb-auto"
                    >
                         <VprQuestionContent
                             questionData={currentQuestionData}
                             questionNumber={currentQuestionIndex + 1}
                             totalQuestions={questions.length}
                         />
                         <VprAnswerList
                            answers={answersForCurrent}
                            selectedAnswerId={selectedAnswerId}
                            showFeedback={showFeedback}
                            timeUpModal={timeUpModal}
                            handleAnswer={handleAnswer}
                            isDummyModeActive={isDummyModeActive}
                        />
                     </motion.div>

                     {isCurrentQuestionNonAnswerable && !shouldShowExplanation && !isTestComplete && !timeUpModal && (
                         <div className="mt-4 text-center">
                             <button
                                onClick={() => handleNextQuestion(true)}
                                disabled={isSaving}
                                className="bg-brand-purple text-white px-6 py-2 rounded-lg font-semibold hover:bg-brand-purple/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
                             >
                                 Пропустить / Далее
                             </button>
                             <p className="text-xs text-gray-400 mt-2">Этот вопрос требует рисунка, ввода текста или анализа изображения (нет выбора варианта).</p>
                         </div>
                     )}

                     <AnimatePresence>
                        {shouldShowExplanation && (
                            <ExplanationDisplay
                                key={`exp-${currentQuestionIndex}-${isDummyModeActive}`}
                                explanation={explanationToShow}
                                isCorrect={explanationIsCorrectState}
                                onNext={() => handleNextQuestion(false)}
                                isLastQuestion={currentQuestionIndex >= questions.length - 1}
                                isDummyModeExplanation={isDummyModeActive}
                            />
                        )}
                     </AnimatePresence>

                    <div className="mt-auto pt-6 text-center">
                        <button
                            onClick={resetTest}
                            disabled={isSaving || isLoading}
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