"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Loader2 } from "lucide-react"; // Added Loader2 back
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger } from "@/lib/debugLogger";
import { useParams, useRouter } from 'next/navigation';

// Import VPR components from their new location
import { VprProgressIndicator } from "@/components/VprProgressIndicator";
import { ExplanationDisplay } from "@/components/ExplanationDisplay"; // Assuming this is correctly placed
import { VprLoadingIndicator } from "@/components/vpr/VprLoadingIndicator";
import { VprErrorDisplay } from "@/components/vpr/VprErrorDisplay";
import { VprCompletionScreen } from "@/components/vpr/VprCompletionScreen";
import { VprHeader } from "@/components/vpr/VprHeader";
import { VprDescription } from "@/components/vpr/VprDescription";
import { VprQuestionContent } from "@/components/vpr/VprQuestionContent";
import { VprAnswerList } from "@/components/vpr/VprAnswerList";
import { VprTimeUpModal } from "@/components/vpr/VprTimeUpModal";

import { toast } from "sonner";

// --- Interfaces ---
interface SubjectData {
    id: number;
    name: string;
    description?: string;
}

interface VprQuestionData {
    id: number;
    subject_id: number;
    variant_number: number;
    text: string;
    explanation?: string;
    position: number;
    vpr_answers: VprAnswerData[];
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

// --- Default Variant ---
// TODO: Implement logic to select or pass variant dynamically if needed
const DEFAULT_VARIANT = 1;

export default function VprTestPage() {
    // --- States ---
    const { user } = useAppContext();
    const params = useParams();
    const router = useRouter();
    const subjectId = parseInt(params.subjectId as string, 10);
    const variantNumber = DEFAULT_VARIANT; // Use default for now

    const [subject, setSubject] = useState<SubjectData | null>(null);
    const [questions, setQuestions] = useState<VprQuestionData[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [currentAttempt, setCurrentAttempt] = useState<VprTestAttempt | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Loading state for initial load and resets
    const [isSaving, setIsSaving] = useState(false); // Specific loading state for DB operations (answer/next)
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
    const [timeLimit] = useState(3600); // 60 minutes = 3600 seconds
    const [timeUpModal, setTimeUpModal] = useState(false);
    const [isCurrentQuestionNonAnswerable, setIsCurrentQuestionNonAnswerable] = useState(false); // New state
    // --- End States ---


    // --- Timer Functions ---
    const handleTimeUp = useCallback(() => {
        debugLogger.log("Timer: Time is up!");
        if (!isTestComplete && !timeUpModal) {
            setIsTimerRunning(false);
            setShowFeedback(false);
            setTimeUpModal(true);
        }
    }, [isTestComplete, timeUpModal]);

    const completeTestDueToTime = useCallback(async () => {
         setTimeUpModal(false);
         if (!currentAttempt || isSaving || isTestComplete) return;
         debugLogger.log("Completing test due to time up for attempt:", currentAttempt.id);
         setIsSaving(true); // Use isSaving indicator
         try {
             const currentScore = currentAttempt.score || 0;
             const updates: Partial<VprTestAttempt> = {
                 last_question_index: questions.length,
                 completed_at: new Date().toISOString(),
                 score: currentScore
             };
             const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                 .from('vpr_test_attempts')
                 .update(updates)
                 .eq('id', currentAttempt.id)
                 .select()
                 .single();

              if (updateError) throw updateError;
              if (!updatedAttempt) throw new Error("Attempt not found after forced completion update.");

              setCurrentAttempt(updatedAttempt);
              setIsTestComplete(true);
              setFinalScore(updatedAttempt.score ?? 0);
              toast.warning("Время вышло! Тест завершен.", { duration: 5000 });
         } catch (err: any) {
             debugLogger.error("Error forcing test completion:", err);
             setError(`Не удалось завершить тест (${err.message || 'Неизвестная ошибка'}). Попробуйте обновить страницу.`);
         } finally {
            setIsSaving(false); // Turn off saving indicator
         }
    }, [currentAttempt, isSaving, isTestComplete, questions.length]);
    // --- End Timer Functions ---


    // --- Data Fetching & Attempt Handling ---
    useEffect(() => {
        // Basic validation
        if (!user?.id || !subjectId || isNaN(subjectId) || !variantNumber || isNaN(variantNumber)) {
            if (!user?.id) router.push('/login');
            else setError("Неверный ID предмета или номер варианта");
            setIsLoading(false);
            return;
        }

        debugLogger.log(`Initializing test for Subject ID: ${subjectId}, Variant: ${variantNumber}`);
        let isMounted = true; // Flag to prevent state updates on unmounted component

        const initializeTest = async () => {
            if (!isMounted) return; // Don't run if component unmounted
            setIsLoading(true); // Start full loading state
            setError(null);
            // Reset states...
            setShowDescription(false);
            setIsTestComplete(false);
            setShowFeedback(false);
            setSelectedAnswerId(null);
            setIsTimerRunning(false);
            setTimerKey(Date.now());
            setTimeUpModal(false);
            setIsCorrect(false);
            setFeedbackExplanation(null);
            setFinalScore(0);
            setCurrentQuestionIndex(0);
            setCurrentAttempt(null);
            setQuestions([]);
            setIsCurrentQuestionNonAnswerable(false); // Reset flag


            try {
                // Fetch Subject
                debugLogger.log("Fetching subject data...");
                const { data: subjectData, error: subjectError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .eq('id', subjectId)
                    .single();
                if (!isMounted) return;
                if (subjectError) throw new Error(`Ошибка загрузки предмета: ${subjectError.message}`);
                if (!subjectData) throw new Error('Предмет не найден');
                setSubject(subjectData);
                debugLogger.log("Subject data loaded:", subjectData.name);

                // Fetch Questions for the specific VARIANT
                debugLogger.log(`Fetching questions for variant ${variantNumber}...`);
                const { data: questionData, error: questionError } = await supabaseAdmin
                    .from('vpr_questions')
                    .select(`*, vpr_answers ( * )`) // Fetch nested answers
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantNumber)
                    .order('position', { ascending: true });

                if (!isMounted) return;
                if (questionError) throw new Error(`Ошибка загрузки вопросов: ${questionError.message}`);
                if (!questionData || questionData.length === 0) throw new Error(`Вопросы для варианта ${variantNumber} не найдены`);
                setQuestions(questionData);
                debugLogger.log(`Loaded ${questionData.length} questions.`);

                // Find Active (non-completed) Attempt for the specific VARIANT
                debugLogger.log("Finding active test attempt...");
                const { data: existingAttempts, error: attemptError } = await supabaseAdmin
                    .from('vpr_test_attempts')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('subject_id', subjectId)
                    .eq('variant_number', variantNumber)
                    .is('completed_at', null) // <<< Key change: Only look for active attempts
                    .order('started_at', { ascending: false })
                    .limit(1);

                 if (!isMounted) return;
                 if (attemptError) throw new Error(`Ошибка поиска попытки: ${attemptError.message}`);

                let attemptToUse: VprTestAttempt | null = null; // Initialize as null

                if (existingAttempts && existingAttempts.length > 0) {
                    const potentialAttempt = existingAttempts[0];
                    // Double check if question count matches (test structure might have changed)
                    if (potentialAttempt.total_questions !== questionData.length) {
                        debugLogger.warn("Question count mismatch. Active attempt is outdated. Will create new one.");
                        // Don't use this attempt, let the logic create a new one below
                    } else {
                        attemptToUse = potentialAttempt; // Use the found active attempt
                        debugLogger.log(`Resuming active attempt ID: ${attemptToUse.id}, Last Index: ${attemptToUse.last_question_index}`);
                        setFinalScore(attemptToUse.score || 0); // Restore score
                    }
                }

                // If no suitable active attempt was found, create a new one
                if (!attemptToUse) {
                     debugLogger.log("No active attempt found or existing was outdated. Creating new one.");
                     const { data: newAttemptData, error: newAttemptError } = await createNewAttempt(user.id, subjectId, variantNumber, questionData.length);
                     if (!isMounted) return;
                     if (newAttemptError || !newAttemptData) throw newAttemptError || new Error('Не удалось создать новую попытку');
                     attemptToUse = newAttemptData;
                     debugLogger.log(`New attempt created ID: ${attemptToUse.id}`);
                     setFinalScore(0); // Ensure score is 0 for new attempt
                }

                // Set the attempt state
                setCurrentAttempt(attemptToUse);

                // Set current question index based on the attempt to use
                const resumeIndex = Math.max(0, Math.min(attemptToUse.last_question_index, questionData.length - 1));
                setCurrentQuestionIndex(resumeIndex);
                debugLogger.log(`Setting current question index to: ${resumeIndex}`);

                // Check if the current question (after loading/resuming) is non-answerable
                const currentQ = questionData[resumeIndex];
                const currentAnswers = currentQ?.vpr_answers || [];
                const isNonAnswerable = currentAnswers.length > 0 && currentAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение)\].*/.test(a.text));
                setIsCurrentQuestionNonAnswerable(isNonAnswerable);
                debugLogger.log(`Is current question (${resumeIndex}) non-answerable? ${isNonAnswerable}`);

                // Start Timer (only possible if attemptToUse is set and not completed - which is guaranteed by the query)
                debugLogger.log("Attempt is active. Starting timer.");
                setIsTimerRunning(true);


            } catch (err: any) {
                if (!isMounted) return;
                debugLogger.error("Error during test initialization:", err);
                setError(err.message || 'Произошла ошибка при загрузке теста');
                setIsTimerRunning(false);
            } finally {
                 if (isMounted) {
                    setIsLoading(false); // Turn off initial loading indicator
                    debugLogger.log("Initialization complete.");
                 }
            }
        };

        // Helper to create attempt (includes variant)
        const createNewAttempt = async (userId: string, subjId: number, variantNum: number, totalQ: number) => {
             debugLogger.log(`Creating new attempt for user ${userId}, subject ${subjId}, variant ${variantNum}, totalQ ${totalQ}`);
             return await supabaseAdmin
                 .from('vpr_test_attempts')
                 .insert({
                     user_id: userId,
                     subject_id: subjId,
                     variant_number: variantNum,
                     total_questions: totalQ,
                     last_question_index: 0,
                     score: 0
                 })
                 .select()
                 .single();
         };

        initializeTest();

        // Cleanup function
        return () => {
            isMounted = false; // Set flag when component unmounts
            debugLogger.log("VprTestPage unmounting or dependencies changed.");
        };
     // currentQuestionIndex removed - it's set internally based on attempt, re-checking non-answerable inside handleNextQuestion
     }, [user, subjectId, variantNumber, router]); // router might be needed if used elsewhere
    // --- End Data Fetching ---


    // --- Answer Handling ---
    const handleAnswer = useCallback(async (selectedAnswer: VprAnswerData) => {
        // More robust guards
        if (!currentAttempt || showFeedback || isTestComplete || isSaving || !isTimerRunning || timeUpModal || !questions[currentQuestionIndex]) return;

        debugLogger.log(`Handling answer selection: Answer ID ${selectedAnswer.id} for Question ID ${questions[currentQuestionIndex].id}`);
        setIsTimerRunning(false);
        setIsSaving(true); // Indicate DB operation start
        setSelectedAnswerId(selectedAnswer.id);

        const correct = selectedAnswer.is_correct;
        setIsCorrect(correct);
        setFeedbackExplanation(questions[currentQuestionIndex]?.explanation || "Объяснение отсутствует.");
        setShowFeedback(true);

        const scoreIncrement = correct ? 1 : 0;
        const newScore = (currentAttempt.score || 0) + scoreIncrement;
        // Optimistic UI update happens just by setting showFeedback=true and isCorrect
        // We update the attempt *after* DB confirmation for consistency
        debugLogger.log(`Answer Correct: ${correct}. Proposed Score: ${newScore}`);

        try {
            debugLogger.log("Recording answer to DB...");
            const { error: recordError } = await supabaseAdmin
                .from('vpr_attempt_answers')
                .insert({
                    attempt_id: currentAttempt.id,
                    question_id: questions[currentQuestionIndex].id,
                    selected_answer_id: selectedAnswer.id,
                    was_correct: correct,
                });
            if (recordError && recordError.code !== '23505') throw new Error(`Ошибка записи ответа: ${recordError.message}`);
            if (recordError?.code === '23505') debugLogger.warn("Attempt answer already recorded.");
            else debugLogger.log("Answer recorded successfully.");

            debugLogger.log("Updating attempt score in DB...");
            const { data: updatedData, error: updateScoreError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update({ score: newScore }) // Update score using calculated value
                .eq('id', currentAttempt.id)
                .select() // Get updated attempt data
                .single();

            if (updateScoreError) throw new Error(`Ошибка обновления счета: ${updateScoreError.message}`);
            if (!updatedData) throw new Error("Attempt data not returned after score update.");

            // Update local attempt state with confirmed score from DB
            setCurrentAttempt(updatedData);
            debugLogger.log("Attempt score updated successfully in DB and local state.");

        } catch (err: any) {
            debugLogger.error("Error saving answer/score:", err);
            toast.error(`Не удалось сохранить результат: ${err.message}`);
            // No score rollback needed as we update state *after* DB success
        } finally {
             setIsSaving(false); // Indicate DB operation end
        }
    }, [currentAttempt, showFeedback, isTestComplete, isSaving, isTimerRunning, timeUpModal, questions, currentQuestionIndex]);
    // --- End Answer Handling ---


    // --- Navigation Logic ---
    const handleNextQuestion = useCallback(async (isSkip: boolean = false) => { // Added isSkip flag
        if (!currentAttempt || isSaving || isTestComplete || timeUpModal || !questions.length) return;

        const currentQIndex = currentQuestionIndex; // Capture current index before async ops
        const nextIndex = currentQIndex + 1;
        const isFinishing = nextIndex >= questions.length;
        debugLogger.log(`Handling next question. From: ${currentQIndex}, To: ${nextIndex}, Finishing: ${isFinishing}, Skip: ${isSkip}`);

        setIsSaving(true); // Indicate DB operation start

        // Reset UI states immediately
        setShowFeedback(false);
        setSelectedAnswerId(null);
        setIsCorrect(false);
        setFeedbackExplanation(null);

        // Determine non-answerable status for the *next* question
        let nextIsNonAnswerable = false;
        if (!isFinishing) {
            const nextQ = questions[nextIndex];
            const nextAnswers = nextQ?.vpr_answers || [];
            nextIsNonAnswerable = nextAnswers.length > 0 && nextAnswers.every(a => /^\[(Рисунок|Ввод текста|Диаграмма|Изображение)\].*/.test(a.text));
            debugLogger.log(`Next question (${nextIndex}) non-answerable? ${nextIsNonAnswerable}`);
        }

        // Update local state for next question display *after* DB update for consistency
        // setIsCurrentQuestionNonAnswerable(nextIsNonAnswerable);
        // setCurrentQuestionIndex(nextIndex);
        // if (!isFinishing) setIsTimerRunning(true); else setIsTimerRunning(false);

        // --- Async DB Update for Progress/Completion ---
        try {
            const updates: Partial<VprTestAttempt> = isFinishing
                ? {
                      last_question_index: questions.length,
                      completed_at: new Date().toISOString(),
                  }
                : {
                      last_question_index: nextIndex
                  };

            // If skipping a non-answerable question, don't update score (it wasn't changed)
            // If answering normally, score was updated in handleAnswer already
            // So, only need to update index/completion status here.

            debugLogger.log(`Updating attempt progress/completion in DB to index: ${updates.last_question_index}`);
            const { data: updatedAttempt, error: updateError } = await supabaseAdmin
                .from('vpr_test_attempts')
                .update(updates)
                .eq('id', currentAttempt.id)
                .select()
                .single();

            if (updateError) throw new Error(`Ошибка обновления прогресса: ${updateError.message}`);
            if (!updatedAttempt) throw new Error("Attempt not found after update.");

            // --- Update UI state AFTER successful DB update ---
            setCurrentAttempt(updatedAttempt); // Update with latest data from DB
             if (!isFinishing) {
                 setCurrentQuestionIndex(nextIndex);
                 setIsCurrentQuestionNonAnswerable(nextIsNonAnswerable); // Set flag for the now current question
                 setIsTimerRunning(true); // Start timer for the new question
                 debugLogger.log(`Moved to question index: ${nextIndex}. Timer restarted.`);
             } else {
                 setIsCurrentQuestionNonAnswerable(false); // Reset flag on completion
                 setIsTimerRunning(false); // Ensure timer is stopped
                 setIsTestComplete(true);
                 setFinalScore(updatedAttempt.score ?? 0);
                 debugLogger.log("Test marked as complete. Final Score from DB:", updatedAttempt.score);
                 toast.success("Тест завершен!", { duration: 4000 });
             }

        } catch(err: any) {
            debugLogger.error("Error updating attempt on navigation:", err);
            setError(`Не удалось сохранить прогресс (${err.message}). Попробуйте обновить страницу.`);
            toast.error("Ошибка сохранения прогресса.");
            // If DB fails, potentially revert UI changes? Or leave user on current question?
            // Revert timer state if it was changed optimistically
            if (!isFinishing) setIsTimerRunning(false);
        } finally {
            setIsSaving(false); // Indicate DB operation end
        }
    }, [currentAttempt, isSaving, isTestComplete, timeUpModal, questions, currentQuestionIndex]);
    // --- End Navigation Logic ---


    // --- Reset Logic ---
     const resetTest = useCallback(async () => {
         if (!user?.id || !subjectId || isSaving) return; // Prevent reset during save
         debugLogger.log("Resetting test...");
         setIsLoading(true); // Use full loading indicator for reset

         try {
             // Attempt to delete the currently loaded ACTIVE attempt (if any)
             if (currentAttempt && !currentAttempt.completed_at) {
                 debugLogger.log(`Deleting active attempt ID: ${currentAttempt.id} before reset.`);
                 const { error: deleteError } = await supabaseAdmin
                     .from('vpr_test_attempts')
                     .delete()
                     .eq('id', currentAttempt.id)
                     .is('completed_at', null); // Safety check

                 if (deleteError) {
                     debugLogger.error("Error deleting active attempt during reset:", deleteError);
                     toast.error("Не удалось корректно сбросить предыдущую попытку.");
                     // Proceed with UI reset anyway
                 } else {
                      debugLogger.log("Active attempt deleted successfully.");
                 }
             } else {
                 debugLogger.log("No active attempt loaded or it was already completed. Skipping delete.");
             }

             // Clear local state to force re-initialization via useEffect
             setCurrentAttempt(null);
             setIsTestComplete(false);
             setShowFeedback(false);
             setSelectedAnswerId(null);
             setFinalScore(0);
             setCurrentQuestionIndex(0);
             setError(null);
             setIsTimerRunning(false);
             setTimerKey(Date.now());
             setTimeUpModal(false);
             setShowDescription(false);
             setQuestions([]); // Clear questions
             setIsCurrentQuestionNonAnswerable(false);

             toast.info("Тест сброшен. Загрузка...", { duration: 1500});
             // useEffect will now run again because user/subjectId/variantNumber are the same,
             // but it won't find an active attempt, forcing creation of a new one.
             // setIsLoading(true) is already set, useEffect will set it to false when done.

         } catch (err: any) {
              debugLogger.error("Error during reset process:", err);
              setError(`Ошибка сброса теста: ${err.message}`);
              setIsLoading(false); // Ensure loading stops on error
         }
     }, [user?.id, subjectId, variantNumber, isSaving, currentAttempt]); // Added currentAttempt dependency
    // --- End Reset Logic ---


    // --- Rendering Logic ---

    // Initial Loading State (before attempt is loaded)
    if (isLoading && !currentAttempt) return <VprLoadingIndicator />;
    if (error) return <VprErrorDisplay error={error} onRetry={resetTest} />;
    if (isTestComplete) {
        return (
            <VprCompletionScreen
                subjectName={subject?.name}
                finalScore={finalScore}
                totalQuestions={questions.length}
                onReset={resetTest}
                onGoToList={() => router.push('/vpr-tests')}
            />
        );
    }

    // If loading happened but failed to load attempt or questions (should be caught by error state, but as a safeguard)
    if (!currentAttempt || questions.length === 0) {
         return <VprErrorDisplay error="Не удалось загрузить данные теста. Попробуйте сбросить." onRetry={resetTest} />;
    }

    // Get current question data safely
    const currentQuestionData = questions[currentQuestionIndex];
    const answersForCurrent = currentQuestionData?.vpr_answers || [];

    // Loading overlay for saving state
    const showSavingOverlay = isSaving; // Use the dedicated saving state

    return (
        <motion.div
            key={currentAttempt.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-page-gradient text-light-text flex flex-col items-center pt-6 pb-10 px-4"
        >
            <VprTimeUpModal show={timeUpModal} onConfirm={completeTestDueToTime} />

            <div className="max-w-3xl w-full bg-dark-card shadow-xl rounded-2xl p-5 md:p-8 flex-grow flex flex-col border border-brand-blue/20 relative">
                 {showSavingOverlay && (
                    <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-sm flex items-center justify-center z-40 rounded-2xl">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                        <span className="ml-3 text-light-text">Сохранение...</span>
                    </div>
                 )}

                <VprHeader
                    subjectName={subject?.name}
                    showDescriptionButton={!!subject?.description}
                    isDescriptionShown={showDescription}
                    onToggleDescription={() => setShowDescription(!showDescription)}
                    timerKey={timerKey}
                    timeLimit={timeLimit}
                    onTimeUp={handleTimeUp}
                    isTimerRunning={isTimerRunning && !isSaving && !isTestComplete && !showFeedback && !timeUpModal}
                 />

                <VprDescription description={subject?.description} show={showDescription} />
                <VprProgressIndicator current={currentQuestionIndex} total={questions.length} />
                <VprQuestionContent
                     questionText={currentQuestionData?.text}
                     questionNumber={currentQuestionIndex + 1}
                     totalQuestions={questions.length}
                 />
                 <VprAnswerList
                     answers={answersForCurrent}
                     selectedAnswerId={selectedAnswerId}
                     showFeedback={showFeedback}
                     timeUpModal={timeUpModal}
                     handleAnswer={handleAnswer}
                 />

                 {/* Button for Non-Answerable Questions */}
                 {isCurrentQuestionNonAnswerable && !showFeedback && !isTestComplete && !timeUpModal && (
                     <div className="mt-4 text-center">
                         <button
                             onClick={() => handleNextQuestion(true)} // Pass skip flag (true)
                             disabled={isSaving} // Disable while saving previous state
                             className="bg-brand-purple text-white px-6 py-2 rounded-lg font-semibold hover:bg-brand-purple/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
                         >
                             Пропустить / Далее
                         </button>
                         <p className="text-xs text-gray-400 mt-2">Этот вопрос требует рисунка, ввода текста или анализа изображения.</p>
                     </div>
                 )}

                 {/* Explanation Display (only shows if showFeedback is true) */}
                 <AnimatePresence>
                     {showFeedback && (
                         <ExplanationDisplay
                             explanation={feedbackExplanation}
                             isCorrect={isCorrect}
                             onNext={() => handleNextQuestion(false)} // Standard next, not skipping
                             isLastQuestion={currentQuestionIndex >= questions.length - 1}
                         />
                     )}
                 </AnimatePresence>

                <div className="mt-auto pt-6 text-center">
                    <button
                        onClick={resetTest}
                        disabled={isSaving || isLoading} // Disable during any loading state
                        className="text-xs text-gray-500 hover:text-brand-pink underline transition-colors flex items-center justify-center gap-1 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RotateCcw className="h-3 w-3"/>
                        Сбросить и начать заново
                    </button>
                </div>
            </div>
        </motion.div>
    );
}